// server/utils/whatsapp/clientState.js
//
// THE FIX for: "TypeError: Cannot read properties of undefined (reading 'getChat')"
//
// whatsapp-web.js Client.sendMessage() runs this inside the browser page:
//     const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
// `window.WWebJS` is only injected at the very end of Client.inject(), just
// before the "ready" event fires. So if you call sendMessage() before "ready"
// (or after the page reloaded / logged out), window.WWebJS is `undefined` and
// reading `.getChat` on it throws.
//
// This module tracks readiness and verifies the injection is actually alive
// in the page before any send is attempted.

import { logToDashboard } from "./logger.js";

let client = null;
let ready = false;
let lastError = null;
let waiters = [];

export function setClient(instance) {
  client = instance;
}

export function getClient() {
  return client;
}

export function markReady() {
  ready = true;
  lastError = null;
  const pending = waiters;
  waiters = [];
  for (const w of pending) {
    clearTimeout(w.timer);
    w.resolve();
  }
}

export function markNotReady(reason = "client not ready") {
  ready = false;
  lastError = reason;
}

export function isReady() {
  return ready;
}

/** Resolves when the client emits "ready", or rejects after timeoutMs. */
export function waitForReady(timeoutMs = 60000) {
  if (ready) return Promise.resolve();
  if (!client) {
    return Promise.reject(new Error("WhatsApp client not initialized"));
  }

  return new Promise((resolve, reject) => {
    const entry = { resolve };
    entry.timer = setTimeout(() => {
      waiters = waiters.filter((w) => w !== entry);
      reject(
        new Error(
          `WhatsApp is not ready yet${lastError ? ` (${lastError})` : ""}. ` +
            `Scan the QR code and wait for the "ready" event before sending.`
        )
      );
    }, timeoutMs);
    waiters.push(entry);
  });
}

/** Asks the live page whether the injected helpers still exist. */
export async function isInjected() {
  const page = client?.pupPage;
  if (!page || page.isClosed?.()) return false;
  try {
    // Check ONLY window.WWebJS — this is the same test the library itself
    // uses. Do not also require window.Store: whatsapp-web.js 1.34.7 dropped
    // the moduleRaid/ExposeStore step and calls window.require(...) inline,
    // so window.Store is undefined there even on a perfectly healthy session.
    return await page.evaluate(() => typeof window.WWebJS !== "undefined");
  } catch {
    // page navigating / detached frame
    return false;
  }
}

/**
 * Call this before EVERY send. Guarantees the client is ready AND that
 * window.WWebJS exists in the page, so sendMessage can't hit the
 * `undefined.getChat` crash.
 */
export async function ensureSendable({ timeoutMs = 60000 } = {}) {
  if (!client) throw new Error("WhatsApp client not initialized");

  await waitForReady(timeoutMs);

  if (await isInjected()) return client;

  // Page reloaded (WhatsApp Web pushed an update, or the session was logged
  // out from the phone). The helpers are gone until inject() runs again.
  markNotReady("WhatsApp Web page lost its injected helpers (window.WWebJS)");
  logToDashboard("♻️ WhatsApp page lost injection — waiting for re-initialization…");

  await waitForReady(timeoutMs);

  if (!(await isInjected())) {
    throw new Error(
      "WhatsApp Web session is not injected (window.WWebJS missing). " +
        "Restart the client or re-scan the QR code."
    );
  }
  return client;
}

export async function getStatus() {
  return {
    ready,
    injected: await isInjected(),
    lastError,
    user: client?.info?.wid?.user || null,
    pushname: client?.info?.pushname || null,
    platform: client?.info?.platform || null,
  };
}
