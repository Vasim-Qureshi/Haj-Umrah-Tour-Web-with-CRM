import fs from "fs";
import AdmZip from "adm-zip";
import axios from "axios";
import archiver from "archiver";
import fse from "fs-extra";
import path from "path";

const AUTH_LOCAL_DIR = path.resolve(".wwebjs_auth");
const CACHE_LOCAL_DIR = path.resolve(".wwebjs_cache");
const TEMP_DIR = path.resolve("tmp");

fse.ensureDirSync(TEMP_DIR);

export const AUTH_ZIP_LOCAL = path.join(TEMP_DIR, "wwebjs_auth.zip");

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

export function zipAuthFiles(outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(output);

    if (fs.existsSync(AUTH_LOCAL_DIR))
      archive.directory(AUTH_LOCAL_DIR, ".wwebjs_auth");
    if (fs.existsSync(CACHE_LOCAL_DIR))
      archive.directory(CACHE_LOCAL_DIR, ".wwebjs_cache");

    output.on("close", () => resolve(outPath));
    archive.on("error", reject);
    archive.finalize();
  });
}
