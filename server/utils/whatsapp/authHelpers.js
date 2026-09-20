// server/utils/whatsapp/authHelpers.js
import {
  downloadFile,
  extractZip,
  zipAuthFiles,
  AUTH_ZIP_LOCAL,
} from "./fileHelpers.js";
import cloudinary from "../../config/cloudinary.js";
import { logToDashboard } from "./logger.js";

const CLOUDFOLDER = process.env.CLOUDINARY_AUTH_FOLDER || "whatsapp_auth";
const AUTH_PUBLIC_ID =
  process.env.CLOUDINARY_AUTH_PUBLIC_ID || "wwebjs_auth_backup";

// Set WA_CLOUD_SESSION=false on your local Windows machine — LocalAuth already
// keeps the session in .wwebjs_auth, so the Cloudinary backup only earns its
// keep on hosts with an ephemeral filesystem.
const CLOUD_SESSION_ENABLED =
  String(process.env.WA_CLOUD_SESSION ?? "true").toLowerCase() !== "false";

// whatsapp-web.js can emit "authenticated" several times per login, and each
// call used to start its own zip of the same folder into the same output path —
// which is why the EBUSY error repeated ten times. One upload at a time, and
// not more often than MIN_INTERVAL_MS.
const MIN_INTERVAL_MS = Number(process.env.WA_BACKUP_MIN_INTERVAL_MS || 120000);
let uploading = false;
let lastUploadAt = 0;

export async function uploadAuthToCloud({ force = false } = {}) {
  if (!CLOUD_SESSION_ENABLED) return false;

  if (uploading) {
    console.log("⏭️ Auth upload already in progress — skipping");
    return false;
  }

  const since = Date.now() - lastUploadAt;
  if (!force && lastUploadAt && since < MIN_INTERVAL_MS) {
    console.log(`⏭️ Auth backed up ${Math.round(since / 1000)}s ago — skipping`);
    return false;
  }

  uploading = true;
  try {
    // Let Chromium finish flushing the session to disk.
    await new Promise((r) => setTimeout(r, 8000));

    const { copied, skipped } = await zipAuthFiles(AUTH_ZIP_LOCAL);
    if (skipped.length) {
      console.warn(
        `⚠️ Skipped ${skipped.length} locked file(s):`,
        skipped.slice(0, 8)
      );
    }

    const res = await cloudinary.uploader.upload(AUTH_ZIP_LOCAL, {
      resource_type: "raw",
      public_id: AUTH_PUBLIC_ID,
      folder: CLOUDFOLDER,
      overwrite: true,
      invalidate: true,
    });

    lastUploadAt = Date.now();
    logToDashboard(`☁️ WhatsApp session backed up (${copied} files)`);
    return res.public_id;
  } catch (err) {
    console.error("❌ Auth upload error:", err.message);
    logToDashboard(`❌ Auth backup failed: ${err.message}`);
    return false;
  } finally {
    uploading = false;
  }
}

export async function downloadAuthFromCloudIfExists() {
  if (!CLOUD_SESSION_ENABLED) {
    console.log("ℹ️ Cloud session restore disabled (WA_CLOUD_SESSION=false)");
    return false;
  }

  let res;
  try {
    res = await cloudinary.api.resource(`${CLOUDFOLDER}/${AUTH_PUBLIC_ID}`, {
      resource_type: "raw",
    });
  } catch {
    console.log("ℹ️ No previous auth found in Cloudinary.");
    return false;
  }

  // Separate try/catch: a failure here is a real problem and must not be
  // reported as "no previous auth found".
  try {
    console.log("⬇️ Downloading auth backup…");
    await downloadFile(res.secure_url, AUTH_ZIP_LOCAL);
    extractZip(AUTH_ZIP_LOCAL, process.cwd());
    logToDashboard("✅ WhatsApp session restored from Cloudinary");
    return true;
  } catch (err) {
    console.error("❌ Auth restore failed:", err.message);
    logToDashboard(
      `❌ Auth restore failed: ${err.message} — a new QR scan will be needed`
    );
    return false;
  }
}
