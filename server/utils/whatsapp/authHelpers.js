import { downloadFile, extractZip, zipAuthFiles, AUTH_ZIP_LOCAL } from "./fileHelpers.js";
import cloudinary from "../../config/cloudinary.js";
import { sendLogToDashboard } from "../../server.js";

const CLOUDFOLDER = process.env.CLOUDINARY_AUTH_FOLDER || "whatsapp_auth";
const AUTH_PUBLIC_ID = process.env.CLOUDINARY_AUTH_PUBLIC_ID || "wwebjs_auth_backup";

export async function uploadAuthToCloud() {
  try {
    // Wait briefly so files are released
    await new Promise(r => setTimeout(r, 2000));

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

export async function downloadAuthFromCloudIfExists() {
  try {
    const res = await cloudinary.api.resource(`${CLOUDFOLDER}/${AUTH_PUBLIC_ID}`, {
      resource_type: "raw",
    });
    console.log("⬇️ Downloading auth backup...");
    await downloadFile(res.secure_url, AUTH_ZIP_LOCAL);
    extractZip(AUTH_ZIP_LOCAL, process.cwd());
    console.log("✅ Auth restored locally.");
    sendLogToDashboard("✅ WhatsApp session restored from Cloudinary");
  } catch {
    console.log("ℹ️ No previous auth found in Cloudinary.");
  }
}
