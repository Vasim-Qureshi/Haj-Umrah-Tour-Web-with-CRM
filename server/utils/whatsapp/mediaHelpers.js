import fs from "fs";
import path from "path";
import mime from "mime-types";
import cloudinary from "../../config/cloudinary.js";
import pkg from "whatsapp-web.js";

const { MessageMedia } = pkg;

export async function uploadMediaToCloud(localPath) {
  const res = await cloudinary.uploader.upload(localPath, {
    resource_type: "auto",
    folder: "whatsapp_media",
  });
  return res.secure_url;
}

export function prepareMedia(mediaPath) {
  if (!fs.existsSync(mediaPath)) throw new Error(`File not found: ${mediaPath}`);

  const mimeType = mime.lookup(mediaPath) || "application/octet-stream";
  const fileName = path.basename(mediaPath);
  const stats = fs.statSync(mediaPath);
  const maxSize = mimeType.includes("video") ? 16 : 100; // MB

  if (stats.size > maxSize * 1024 * 1024)
    throw new Error(`File exceeds WhatsApp limit (${maxSize}MB)`);

  const fileData = fs.readFileSync(mediaPath).toString("base64");
  const media = new MessageMedia(mimeType, fileData, fileName);

  const type = mimeType.includes("pdf") || mimeType.includes("msword")
    ? "document"
    : mimeType.includes("video")
    ? "video"
    : "image";

  return { media, mimeType, fileName, type };
}
