// server/utils/whatsapp/fileHelpers.js
import fs from "fs";
import AdmZip from "adm-zip";
import axios from "axios";
import archiver from "archiver";
import fse from "fs-extra";
import path from "path";

const AUTH_LOCAL_DIR = path.resolve(".wwebjs_auth");
const TEMP_DIR = path.resolve("tmp");
const STAGE_DIR = path.join(TEMP_DIR, "auth-stage");

fse.ensureDirSync(TEMP_DIR);

export const AUTH_ZIP_LOCAL = path.join(TEMP_DIR, "wwebjs_auth.zip");

// ─────────────────────────────────────────────
// Why this file changed
// ─────────────────────────────────────────────
// `archive.directory(".wwebjs_auth")` streams EVERY file in the Chromium
// profile. On Windows, Chromium keeps exclusive handles on a lot of them
// (LOCK, SingletonLock, LOG, *-journal, the Cache/ trees…), so reading them
// throws EBUSY and archiver aborts the whole archive.
//
// Instead we copy the profile into tmp/auth-stage first, skipping throwaway
// directories and tolerating per-file failures, then zip the staging copy —
// where nothing is locked.

// Regenerable caches: big, always locked, and worthless for session restore.
const SKIP_DIRS = new Set([
  "Cache",
  "Code Cache",
  "GPUCache",
  "GrShaderCache",
  "ShaderCache",
  "DawnCache",
  "DawnGraphiteCache",
  "DawnWebGPUCache",
  "GraphiteDawnCache",
  "CacheStorage",
  "ScriptCache",
  "blob_storage",
  "Crashpad",
  "Crash Reports",
  "BrowserMetrics",
  "component_crx_cache",
  "extensions_crx_cache",
  "Safe Browsing",
  "optimization_guide_model_store",
  "segmentation_platform",
  "Download Service",
  "Reporting and NEL",
]);

// Lock/journal/log files — always held open, never needed on restore.
const SKIP_FILE_PATTERNS = [
  /^LOCK$/,
  /^LOG(\.old)?$/,
  /^lockfile$/,
  /^SingletonLock$/,
  /^SingletonCookie$/,
  /^SingletonSocket$/,
  /^DevToolsActivePort$/,
  /^CrashpadMetrics/,
  /-journal$/,
  /\.log$/,
  /^first_party_sets\.db/,
  /^\.org\.chromium\./,
  /^\.com\.google\.Chrome\./,
];

const isSkippedFile = (name) => SKIP_FILE_PATTERNS.some((re) => re.test(name));
const IGNORABLE = new Set(["EBUSY", "EPERM", "EACCES", "ENOENT", "EINVAL"]);

/**
 * Recursive copy that never throws on a locked file — it skips it and keeps
 * going. Returns { copied, skipped }.
 */
function safeCopyDir(src, dest, stats = { copied: 0, skipped: [] }) {
  let entries;
  try {
    entries = fs.readdirSync(src, { withFileTypes: true });
  } catch (err) {
    stats.skipped.push(`${src} (${err.code})`);
    return stats;
  }

  fse.ensureDirSync(dest);

  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      safeCopyDir(from, to, stats);
      continue;
    }

    if (!entry.isFile() || isSkippedFile(entry.name)) continue;

    try {
      fs.copyFileSync(from, to);
      stats.copied += 1;
    } catch (err) {
      if (!IGNORABLE.has(err.code)) throw err;
      stats.skipped.push(`${entry.name} (${err.code})`);
    }
  }

  return stats;
}

export async function downloadFile(url, dest) {
  const writer = fs.createWriteStream(dest);
  const res = await axios({ url, method: "GET", responseType: "stream" });
  return new Promise((resolve, reject) => {
    res.data.pipe(writer);
    writer.on("close", () => resolve(dest));
    writer.on("error", reject);
  });
}

export function extractZip(zipPath, dest) {
  if (!fs.existsSync(zipPath)) return;
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(dest, true);
}

/**
 * Stage the auth folder, then zip the staging copy.
 * Resolves { outPath, copied, skipped }.
 */
export async function zipAuthFiles(outPath) {
  if (!fs.existsSync(AUTH_LOCAL_DIR)) {
    throw new Error(".wwebjs_auth does not exist yet — nothing to back up");
  }

  // Fresh staging dir each run so deleted session files don't linger.
  await fse.remove(STAGE_DIR);
  const stats = safeCopyDir(
    AUTH_LOCAL_DIR,
    path.join(STAGE_DIR, ".wwebjs_auth")
  );

  if (stats.copied === 0) {
    await fse.remove(STAGE_DIR);
    throw new Error("no session files could be read (all locked)");
  }

  // Write to a temp name, then rename — avoids EBUSY on the zip itself if a
  // previous upload is still streaming it to Cloudinary.
  const tmpOut = `${outPath}.${Date.now()}.tmp`;

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(tmpOut);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") console.warn("⚠️ zip warning:", err.message);
      else reject(err);
    });

    archive.pipe(output);
    archive.directory(path.join(STAGE_DIR, ".wwebjs_auth"), ".wwebjs_auth");
    archive.finalize();
  });

  await fse.remove(outPath).catch(() => {});
  await fse.move(tmpOut, outPath, { overwrite: true });
  await fse.remove(STAGE_DIR);

  return { outPath, copied: stats.copied, skipped: stats.skipped };
}
