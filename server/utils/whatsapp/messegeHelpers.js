// server/utils/whatsapp/messegeHelpers.js
import fs from "fs";
import csv from "csv-parser";
import { prepareMedia } from "./mediaHelpers.js";
import { logToDashboard } from "./logger.js";
import {
  setClient as registerClient,
  ensureSendable,
} from "./clientState.js";

// Kept for backwards compatibility with existing imports.
export function setClient(clientInstance) {
  registerClient(clientInstance);
  console.log("✅ WhatsApp client linked to messageHelpers");
}

const DEFAULT_COUNTRY_CODE = process.env.WA_DEFAULT_COUNTRY_CODE || "91";

/** "+91 98765-43210" / "9876543210" -> "919876543210" */
export function normalizeNumber(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) throw new Error("Empty phone number");
  if (digits.length === 10) digits = DEFAULT_COUNTRY_CODE + digits;
  if (digits.startsWith("0")) digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
  return digits;
}

/**
 * Resolves the real chat id via WhatsApp instead of blindly building
 * `${number}@c.us`. A wrong/unregistered number is reported clearly rather
 * than failing deep inside the page with a cryptic error.
 */
async function resolveChatId(client, raw) {
  const number = normalizeNumber(raw);
  const numberId = await client.getNumberId(number);
  if (!numberId) {
    throw new Error(`${number} is not a registered WhatsApp number`);
  }
  return numberId._serialized;
}

export async function sendMessage(number, message, mediaPath = null) {
  // Guarantees client is ready AND window.WWebJS is injected in the page.
  const client = await ensureSendable();
  const chatId = await resolveChatId(client, number);

  if (mediaPath) {
    const { media, type, fileName, mimeType } = prepareMedia(mediaPath);
    console.log(`📤 Sending ${mimeType} to ${chatId}…`);

    const sent = await client.sendMessage(chatId, media, {
      caption: message,
      sendMediaAsDocument: type === "document",
    });

    logToDashboard(`✅ Sent ${fileName} (${mimeType}) to ${number}`);
    return sent;
  }

  const sent = await client.sendMessage(chatId, message);
  logToDashboard(`✅ Sent text to ${number}`);
  return sent;
  // NOTE: errors are intentionally NOT swallowed here. The old version caught
  // them and logged only, so /send-media always answered { success: true }
  // even when nothing was delivered.
}

function readContacts(csvPath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (r) => rows.push(r))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

export async function broadcastFromCSV(csvPath, message, mediaPath = null) {
  const client = await ensureSendable();
  const contacts = await readContacts(csvPath);

  logToDashboard(`📤 Starting broadcast to ${contacts.length} contacts`);

  let mediaData = null;
  if (mediaPath && fs.existsSync(mediaPath)) {
    try {
      mediaData = prepareMedia(mediaPath);
      console.log(`✅ Media ready: ${mediaData.mimeType}`);
    } catch (err) {
      logToDashboard(`❌ Media prep error: ${err.message}`);
    }
  }

  const result = { total: contacts.length, sent: 0, failed: [] };

  for (const c of contacts) {
    const raw = (c.number || c.phone || c.mobile || "").trim();
    if (!raw) continue;

    try {
      // Re-check between sends: a long broadcast can outlive the session.
      await ensureSendable();
      const chatId = await resolveChatId(client, raw);

      if (mediaData) {
        await client.sendMessage(chatId, mediaData.media, {
          caption: message,
          sendMediaAsDocument: mediaData.type === "document",
        });
      } else {
        await client.sendMessage(chatId, message);
      }

      result.sent += 1;
      logToDashboard(`✅ Sent to ${raw}`);
    } catch (err) {
      result.failed.push({ number: raw, error: err.message });
      logToDashboard(`❌ Send error for ${raw}: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 3000)); // rate-limit guard
  }

  logToDashboard(
    `✅ Broadcast complete — ${result.sent}/${result.total} sent, ${result.failed.length} failed`
  );
  return result;
}
