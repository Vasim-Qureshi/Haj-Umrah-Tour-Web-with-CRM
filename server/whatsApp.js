import pkg from "whatsapp-web.js";
import { sendLogToDashboard } from "./server.js";
import { uploadAuthToCloud, downloadAuthFromCloudIfExists } from "./utils/whatsApp/authHelpers.js";
import { sendMessage, broadcastFromCSV, setClient } from "./utils/whatsapp/messegeHelpers.js";
import fs from "fs";
import mime from "mime-types";
import path from "path";

const { Client, LocalAuth, MessageMedia } = pkg;

// Restore session before init
await downloadAuthFromCloudIfExists();

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "default" }),
  puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
});

setClient(client);

client.on("qr", (qr) => {
  console.log("📱 QR generated");
  sendLogToDashboard("📱 QR code generated — Scan it to login");
  global.io.emit("qr", qr);
});

client.on("ready", async () => {
  console.log("✅ WhatsApp ready");
  sendLogToDashboard("✅ WhatsApp client ready");
});

client.on("authenticated", async () => {
  await uploadAuthToCloud();
});

client.on("message", async (msg) => {
  console.log(`📩 ${msg.from}: ${msg.body}`);
  sendLogToDashboard(`📩 ${msg.from}: ${msg.body}`);

  // Trigger word (you can change it)
  if (msg.body.toLowerCase() === "package") {
    // 📦 Detect file to send
    const filePath = "./files/umrah-brochure.mp4"; // change extension as needed (.jpg, .mp4, .pdf)
    if (!fs.existsSync(filePath)) {
      await msg.reply("❌ Brochure not found!");
      return;
    }

    try {
      // ✅ Detect MIME type safely
      const mimeType = mime.lookup(filePath) || "application/octet-stream";
      const fileName = path.basename(filePath);
      const stats = fs.statSync(filePath);
      const maxSize = mimeType.includes("video") ? 16 : 100; // MB limit check

      if (stats.size > maxSize * 1024 * 1024) {
        await msg.reply(`⚠️ File too large for WhatsApp (max ${maxSize}MB).`);
        return;
      }

      // ✅ Convert to base64
      const fileData = fs.readFileSync(filePath);
      const base64 = fileData.toString("base64");

      const media = new MessageMedia(mimeType, base64, fileName);

      // ✅ Choose send type
      const isDocument =
        mimeType.includes("pdf") ||
        mimeType.includes("msword") ||
        mimeType.includes("officedocument");
      const isVideo = mimeType.includes("video");

      if (isDocument) {
        await client.sendMessage(msg.from, media, {
          caption: "📄 Here’s your brochure!",
          sendMediaAsDocument: true,
        });
      } else if (isVideo) {
        await client.sendMessage(msg.from, media, {
          caption: "🎬 Here’s your video package!",
          sendMediaAsDocument: false,
        });
      } else {
        await client.sendMessage(msg.from, media, { caption: "🖼️ Brochure sent!" });
      }

      // await msg.reply("✅ Brochure sent successfully!");
      sendLogToDashboard(`✅ Brochure (${mimeType}) sent to ${msg.from}`);
    } catch (err) {
      console.error("❌ Error sending brochure:", err);
      await msg.reply("❌ Error sending brochure. Check logs.");
      sendLogToDashboard(`❌ Brochure send error: ${err.message}`);
    }
  }
});


client.on("disconnected", () => {
  sendLogToDashboard("⚠️ WhatsApp disconnected");
  console.log("⚠️ WhatsApp disconnected");
});

client.initialize();

export { client, sendMessage, broadcastFromCSV };
