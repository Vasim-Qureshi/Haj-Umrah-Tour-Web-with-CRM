// server/whatsapp.js
import pkg from "whatsapp-web.js";
// import qrcode from "qrcode-terminal";
import fs from "fs";
import fse from "fs-extra";
import path from "path";
import csv from "csv-parser";
import archiver from "archiver";
import AdmZip from "adm-zip";
import axios from "axios";
import { sendLogToDashboard } from "./server.js";
import cloudinary from "./config/cloudinary.js"; // ✅ from separate config
import mime from "mime-types"; // ✅ install via: npm install mime-types

const { Client, LocalAuth, MessageMedia } = pkg;

const AUTH_LOCAL_DIR = path.resolve(".wwebjs_auth");
const CACHE_LOCAL_DIR = path.resolve(".wwebjs_cache");
const TEMP_DIR = path.resolve("tmp");
const AUTH_ZIP_LOCAL = path.join(TEMP_DIR, "wwebjs_auth.zip");
const CLOUDFOLDER = process.env.CLOUDINARY_AUTH_FOLDER || "whatsapp_auth";
const AUTH_PUBLIC_ID = process.env.CLOUDINARY_AUTH_PUBLIC_ID || "wwebjs_auth_backup";

fse.ensureDirSync(TEMP_DIR);

// ------------------ Helper Functions ------------------
async function downloadFile(url, dest) {
  const writer = fs.createWriteStream(dest);
  const res = await axios({ url, method: "GET", responseType: "stream" });
  return new Promise((resolve, reject) => {
    res.data.pipe(writer);
    writer.on("close", () => resolve(dest));
    writer.on("error", reject);
  });
}

function extractZip(zipPath, dest) {
  if (!fs.existsSync(zipPath)) return;
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(dest, true);
}

function zipAuthFiles(outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(output);
    if (fs.existsSync(AUTH_LOCAL_DIR)) archive.directory(AUTH_LOCAL_DIR, ".wwebjs_auth");
    if (fs.existsSync(CACHE_LOCAL_DIR)) archive.directory(CACHE_LOCAL_DIR, ".wwebjs_cache");
    output.on("close", () => resolve(outPath));
    archive.on("error", reject);
    archive.finalize();
  });
}

async function uploadAuthToCloud() {
  try {
    await zipAuthFiles(AUTH_ZIP_LOCAL);
    const res = await cloudinary.uploader.upload(AUTH_ZIP_LOCAL, {
      resource_type: "raw",
      public_id: AUTH_PUBLIC_ID,
      folder: CLOUDFOLDER,
      overwrite: true,
    });
    console.log("☁️ Auth uploaded:", res.public_id);
    sendLogToDashboard("☁️ WhatsApp session uploaded to Cloudinary");
  } catch (err) {
    console.error("❌ Auth upload error:", err.message);
  }
}

async function downloadAuthFromCloudIfExists() {
  try {
    const res = await cloudinary.api.resource(`${CLOUDFOLDER}/${AUTH_PUBLIC_ID}`, {
      resource_type: "raw",
    });
    const url = res.secure_url;
    console.log("⬇️ Downloading auth backup...");
    await downloadFile(url, AUTH_ZIP_LOCAL);
    extractZip(AUTH_ZIP_LOCAL, process.cwd());
    console.log("✅ Auth restored locally.");
    sendLogToDashboard("✅ WhatsApp session restored from Cloudinary");
  } catch {
    console.log("ℹ️ No previous auth found in Cloudinary.");
  }
}

async function uploadMediaToCloud(localPath) {
  const res = await cloudinary.uploader.upload(localPath, {
    resource_type: "auto",
    folder: "whatsapp_media",
  });
  return res.secure_url;
}

// ------------------ WhatsApp Client ------------------
await downloadAuthFromCloudIfExists();

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "default" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("📱 QR generated");
  sendLogToDashboard("📱 QR code generated — Scan it to login");
  global.io.emit("qr", qr);
  // qrcode.generate(qr, { small: true });
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

const sendMessage = async (number, message, mediaPath = null) => {
  const chatId = `${number}@c.us`;

  try {
    if (mediaPath) {
      // ✅ Ensure file exists locally first
      if (!fs.existsSync(mediaPath)) throw new Error(`File not found: ${mediaPath}`);

      // ✅ Get MIME type safely
      const mimeType = mime.lookup(mediaPath) || "application/octet-stream";
      const fileName = path.basename(mediaPath);

      // ✅ Check size limits
      const stats = fs.statSync(mediaPath);
      const maxSize = mimeType.includes("video") ? 16 : 100; // MB limit
      if (stats.size > maxSize * 1024 * 1024) {
        throw new Error(`File too large for WhatsApp (${maxSize} MB limit).`);
      }

      // ✅ Read and convert to base64
      const fileBuffer = fs.readFileSync(mediaPath);
      const base64 = fileBuffer.toString("base64");

      const media = new MessageMedia(mimeType, base64, fileName);

      // ✅ Detect type
      const isDocument =
        mimeType.includes("pdf") ||
        mimeType.includes("msword") ||
        mimeType.includes("officedocument");
      const isVideo = mimeType.includes("video");

      console.log(`📤 Sending ${mimeType} to ${number}...`);

      // ✅ Send accordingly
      if (isDocument) {
        await client.sendMessage(chatId, media, {
          caption: message,
          sendMediaAsDocument: true,
        });
      } else if (isVideo) {
        await client.sendMessage(chatId, media, {
          caption: message,
          sendMediaAsDocument: false,
        });
      } else {
        await client.sendMessage(chatId, media, { caption: message });
      }

      sendLogToDashboard(`✅ Sent ${fileName} (${mimeType}) to ${number}`);
    } else {
      await client.sendMessage(chatId, message);
      sendLogToDashboard(`✅ Sent text to ${number}`);
    }
  } catch (err) {
    console.error("❌ Send error:", err);
    sendLogToDashboard(`❌ Send error: ${err.message}`);
  }
};

const broadcastFromCSV = async (csvPath, message, mediaPath = null) => {
  const contacts = [];

  fs.createReadStream(csvPath)
    .pipe(csv())
    .on("data", (r) => contacts.push(r))
    .on("end", async () => {
      console.log(`📤 Broadcasting to ${contacts.length} contacts`);
      sendLogToDashboard(`📤 Starting broadcast to ${contacts.length} contacts`);

      // ✅ Preload media once (for efficiency)
      let media = null;
      let mimeType = null;

      if (mediaPath && fs.existsSync(mediaPath)) {
        try {
          mimeType = mime.lookup(mediaPath) || "application/octet-stream";
          const fileBuffer = fs.readFileSync(mediaPath);
          const base64 = fileBuffer.toString("base64");
          const fileName = path.basename(mediaPath);

          // File size validation
          const stats = fs.statSync(mediaPath);
          const maxSize = mimeType.includes("video") ? 16 : 100; // MB limits
          if (stats.size > maxSize * 1024 * 1024) {
            console.error(`❌ ${fileName} exceeds WhatsApp limit (${maxSize}MB).`);
            sendLogToDashboard(`❌ File too large: ${fileName}`);
            media = null;
          } else {
            media = new MessageMedia(mimeType, base64, fileName);
            console.log(`✅ Media loaded (${mimeType})`);
          }
        } catch (err) {
          console.error("❌ Error preparing media:", err);
          sendLogToDashboard(`❌ Error preparing media: ${err.message}`);
          media = null;
        }
      }

      // ✅ Send sequentially with delay
      for (const c of contacts) {
        const number = c.number?.trim();
        if (!number) continue;

        const chatId = `${number}@c.us`;
        console.log(`📨 Sending to ${number}...`);

        try {
          if (media) {
            const isDocument =
              mimeType.includes("pdf") ||
              mimeType.includes("msword") ||
              mimeType.includes("officedocument");
            const isVideo = mimeType.includes("video");

            if (isDocument) {
              await client.sendMessage(chatId, media, {
                caption: message,
                sendMediaAsDocument: true,
              });
            } else if (isVideo) {
              await client.sendMessage(chatId, media, {
                caption: message,
                sendMediaAsDocument: false,
              });
            } else {
              await client.sendMessage(chatId, media, { caption: message });
            }
          } else {
            await client.sendMessage(chatId, message);
          }

          sendLogToDashboard(`✅ Sent to ${number}`);
        } catch (err) {
          console.error(`❌ Send error for ${number}:`, err.message);
          sendLogToDashboard(`❌ Send error for ${number}: ${err.message}`);
        }

        // ✅ Add delay between messages to avoid rate-limit
        await new Promise((r) => setTimeout(r, 3000));
      }

      sendLogToDashboard("✅ Broadcast complete!");
      console.log("✅ Broadcast complete!");
    });
};

client.initialize();

export { client, sendMessage, broadcastFromCSV };
