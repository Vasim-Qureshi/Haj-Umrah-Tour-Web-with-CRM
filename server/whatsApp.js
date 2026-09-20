// server/whatsApp.js
import pkg from "whatsapp-web.js";
import fs from "fs";
import mime from "mime-types";
import path from "path";

import { logToDashboard } from "./utils/whatsapp/logger.js";
import {
  setClient,
  markReady,
  markNotReady,
  isReady,
  waitForReady,
  ensureSendable,
  getStatus,
} from "./utils/whatsapp/clientState.js";
import {
  uploadAuthToCloud,
  downloadAuthFromCloudIfExists,
} from "./utils/whatsapp/authHelpers.js";
import { sendMessage, broadcastFromCSV } from "./utils/whatsapp/messegeHelpers.js";

const { Client, LocalAuth, MessageMedia } = pkg;

// ─────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ clientId: "default" }),
  // Give the login/sync more room on slow servers — the default 45s often
  // expires mid-sync, which leaves the page half-injected.
  authTimeoutMs: 120000,
  takeoverOnConflict: true,
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  },
  // If WhatsApp Web ships a breaking update and injection starts failing again,
  // pin a known-good build by setting WA_WEB_VERSION in .env, e.g.
  // WA_WEB_VERSION=2.3000.1015901307
  ...(process.env.WA_WEB_VERSION
    ? {
        webVersion: process.env.WA_WEB_VERSION,
        webVersionCache: {
          type: "remote",
          remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${process.env.WA_WEB_VERSION}.html`,
        },
      }
    : {}),
});

// Register the instance BEFORE initialize() so helpers can see it.
setClient(client);
markNotReady("initializing");

// ─────────────────────────────────────────────
// Lifecycle events
// ─────────────────────────────────────────────
client.on("qr", (qr) => {
  markNotReady("waiting for QR scan");
  logToDashboard("📱 QR code generated — scan it to login");
  global.io?.emit("qr", qr);
});

client.on("loading_screen", (percent) => {
  logToDashboard(`⏳ Loading WhatsApp… ${percent}%`);
});

// ─────────────────────────────────────────────
// Stall watchdog
// ─────────────────────────────────────────────
// "authenticated" and "ready" are emitted from the SAME exposed-function
// callback inside Client.inject(). Everything between them (Store exposure,
// LoadUtils, attachEventListeners) runs inside a puppeteer binding, so if it
// throws or hangs, node prints nothing at all — you just never get "ready".
// This watchdog makes that visible and recovers from it.
const READY_TIMEOUT_MS = Number(process.env.WA_READY_TIMEOUT_MS || 90000);
let readyWatchdog = null;

async function pageDiagnostics() {
  try {
    const page = client.pupPage;
    if (!page || page.isClosed?.()) return { page: "closed" };
    return await page.evaluate(() => ({
      url: location.href,
      waVersion: window.Debug?.VERSION || null,
      hasAuthStore: typeof window.AuthStore !== "undefined",
      hasStore: typeof window.Store !== "undefined",
      hasWWebJS: typeof window.WWebJS !== "undefined",
      appState: window.AuthStore?.AppState?.state || null,
    }));
  } catch (err) {
    return { error: err.message };
  }
}

client.on("authenticated", () => {
  // Fires more than once per login — the backup is triggered from "ready"
  // instead, where the session is actually finished writing to disk.
  logToDashboard("🔑 WhatsApp authenticated");

  clearTimeout(readyWatchdog);
  readyWatchdog = setTimeout(async () => {
    if (isReady()) return;
    const diag = await pageDiagnostics();
    console.error("⛔ Stalled between authenticated and ready:", diag);
    logToDashboard(
      `⛔ Login stalled (WA ${diag.waVersion || "?"}, WWebJS injected: ${diag.hasWWebJS}) — restarting client`
    );
    try {
      await client.destroy();
    } catch {
      /* ignore */
    }
    startClient();
  }, READY_TIMEOUT_MS);
});

client.on("auth_failure", (msg) => {
  markNotReady(`auth failure: ${msg}`);
  logToDashboard(`❌ WhatsApp auth failure: ${msg}`);
});

let backupTimer = null;

client.on("ready", () => {
  // Only now does window.WWebJS exist in the page — sends are safe.
  clearTimeout(readyWatchdog);
  markReady();
  logToDashboard("✅ WhatsApp client ready");
  global.io?.emit("wa-ready", true);

  // Back up once the session has settled; uploadAuthToCloud is itself
  // debounced + mutexed, so repeated "ready" events are harmless.
  uploadAuthToCloud();

  // Chromium keeps rewriting the profile, so refresh the backup periodically.
  if (!backupTimer) {
    const every = Number(process.env.WA_BACKUP_INTERVAL_MS || 30 * 60 * 1000);
    backupTimer = setInterval(() => {
      if (isReady()) uploadAuthToCloud();
    }, every);
    backupTimer.unref?.();
  }
});

client.on("change_state", (state) => {
  logToDashboard(`ℹ️ WhatsApp state: ${state}`);
  if (state !== "CONNECTED") markNotReady(`state: ${state}`);
});

client.on("disconnected", async (reason) => {
  markNotReady(`disconnected: ${reason}`);
  logToDashboard(`⚠️ WhatsApp disconnected (${reason}) — reconnecting…`);
  global.io?.emit("wa-ready", false);
  try {
    await client.destroy();
  } catch (err) {
    console.error("destroy() failed:", err.message);
  }
  setTimeout(() => startClient(), 5000);
});

// ─────────────────────────────────────────────
// Auto-reply: "package"
// ─────────────────────────────────────────────
client.on("message", async (msg) => {
  const body = (msg.body || "").trim();
  logToDashboard(`📩 ${msg.from}: ${body}`);

  if (body.toLowerCase() !== "package") return;

  const filePath = "./files/umrah-brochure.mp4";
  if (!fs.existsSync(filePath)) {
    await msg.reply("❌ Brochure not found!");
    return;
  }

  try {
    await ensureSendable();

    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    const fileName = path.basename(filePath);
    const stats = fs.statSync(filePath);
    const maxSize = mimeType.includes("video") ? 16 : 100; // MB

    if (stats.size > maxSize * 1024 * 1024) {
      await msg.reply(`⚠️ File too large for WhatsApp (max ${maxSize}MB).`);
      return;
    }

    const base64 = fs.readFileSync(filePath).toString("base64");
    const media = new MessageMedia(mimeType, base64, fileName);

    const isDocument =
      mimeType.includes("pdf") ||
      mimeType.includes("msword") ||
      mimeType.includes("officedocument");
    const isVideo = mimeType.includes("video");

    if (isDocument) {
      await client.sendMessage(msg.from, media, {
        caption: "📄 Here's your brochure!",
        sendMediaAsDocument: true,
      });
    } else if (isVideo) {
      await client.sendMessage(msg.from, media, {
        caption: "🎬 Here's your video package!",
      });
    } else {
      await client.sendMessage(msg.from, media, { caption: "🖼️ Brochure sent!" });
    }

    logToDashboard(`✅ Brochure (${mimeType}) sent to ${msg.from}`);
  } catch (err) {
    console.error("❌ Error sending brochure:", err);
    logToDashboard(`❌ Brochure send error: ${err.message}`);
    try {
      await msg.reply("❌ Error sending brochure. Check logs.");
    } catch {
      /* ignore */
    }
  }
});

// ─────────────────────────────────────────────
// Startup (never top-level await — it blocks the whole server boot)
// ─────────────────────────────────────────────
async function startClient() {
  try {
    await downloadAuthFromCloudIfExists();
  } catch (err) {
    logToDashboard(`ℹ️ Session restore skipped: ${err.message}`);
  }

  try {
    await client.initialize();
  } catch (err) {
    markNotReady(`initialize failed: ${err.message}`);
    console.error("❌ WhatsApp initialize failed:", err);
    logToDashboard(`❌ WhatsApp initialize failed: ${err.message} — retrying in 15s`);
    setTimeout(() => startClient(), 15000);
  }
}

// Errors thrown inside puppeteer exposed-function callbacks (the whole
// authenticated -> ready path) arrive here and nowhere else. Without this you
// get total silence instead of the real cause.
process.on("unhandledRejection", (reason) => {
  const msg = reason?.stack || reason?.message || String(reason);
  console.error("⚠️ Unhandled rejection:", msg);
  if (/WWebJS|Store|ready timeout|puppeteer|Evaluation failed/i.test(msg)) {
    logToDashboard(`⚠️ WhatsApp internal error: ${String(reason).slice(0, 300)}`);
  }
});

startClient();

export {
  client,
  sendMessage,
  broadcastFromCSV,
  isReady,
  waitForReady,
  getStatus,
};
