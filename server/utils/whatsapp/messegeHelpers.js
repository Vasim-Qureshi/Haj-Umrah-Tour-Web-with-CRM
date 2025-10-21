import fs from "fs";
import csv from "csv-parser";
import { prepareMedia } from "./mediaHelpers.js";
import { sendLogToDashboard } from "../../server.js";

let waClient = null;
export function setClient(clientInstance) {
  waClient = clientInstance;
  console.log("✅ WhatsApp client linked to messageHelpers");
}

export async function sendMessage(number, message, mediaPath = null) {
  if (!waClient) throw new Error("WhatsApp client not initialized");
  const chatId = `${number}@c.us`;

  try {
    if (mediaPath) {
      const { media, type, fileName, mimeType } = prepareMedia(mediaPath);
      console.log(`📤 Sending ${mimeType} to ${number}...`);

      if (type === "document") {
        await waClient.sendMessage(chatId, media, {
          caption: message,
          sendMediaAsDocument: true,
        });
      } else {
        await waClient.sendMessage(chatId, media, { caption: message });
      }

      sendLogToDashboard(`✅ Sent ${fileName} (${mimeType}) to ${number}`);
    } else {
      await waClient.sendMessage(chatId, message);
      sendLogToDashboard(`✅ Sent text to ${number}`);
    }
  } catch (err) {
    console.error("❌ Send error:", err);
    sendLogToDashboard(`❌ Send error: ${err.message}`);
  }
}

export async function broadcastFromCSV(csvPath, message, mediaPath = null) {
  if (!waClient) throw new Error("WhatsApp client not initialized");
  const contacts = [];

  fs.createReadStream(csvPath)
    .pipe(csv())
    .on("data", (r) => contacts.push(r))
    .on("end", async () => {
      console.log(`📤 Broadcasting to ${contacts.length} contacts`);
      sendLogToDashboard(`📤 Starting broadcast to ${contacts.length} contacts`);

      let mediaData = null;
      if (mediaPath && fs.existsSync(mediaPath)) {
        try {
          mediaData = prepareMedia(mediaPath);
          console.log(`✅ Media ready: ${mediaData.mimeType}`);
        } catch (err) {
          console.error("❌ Error preparing media:", err);
          sendLogToDashboard(`❌ Media prep error: ${err.message}`);
        }
      }

      for (const c of contacts) {
        const number = c.number?.trim();
        if (!number) continue;
        const chatId = `${number}@c.us`;

        try {
          if (mediaData) {
            const { media, type } = mediaData;
            await waClient.sendMessage(chatId, media, {
              caption: message,
              sendMediaAsDocument: type === "document",
            });
          } else {
            await waClient.sendMessage(chatId, message);
          }
          sendLogToDashboard(`✅ Sent to ${number}`);
        } catch (err) {
          console.error(`❌ Send error for ${number}:`, err.message);
          sendLogToDashboard(`❌ Send error for ${number}: ${err.message}`);
        }

        // Delay to avoid WhatsApp rate limits
        await new Promise((r) => setTimeout(r, 3000));
      }

      sendLogToDashboard("✅ Broadcast complete!");
      console.log("✅ Broadcast complete!");
    });
}
