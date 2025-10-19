// whatsapp.js
import pkg from 'whatsapp-web.js';
// import qrcode from 'qrcode-terminal';
import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import csv from 'csv-parser';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import axios from 'axios';
import { sendLogToDashboard } from './server.js';
import cloudinaryPackage from 'cloudinary';

const { Client, LocalAuth, MessageMedia } = pkg;
const cloudinary = cloudinaryPackage.v2;

// configure cloudinary using env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const AUTH_LOCAL_DIR = path.resolve(process.cwd(), '.wwebjs_auth');   // LocalAuth dir
const CACHE_LOCAL_DIR = path.resolve(process.cwd(), '.wwebjs_cache'); // Cache dir
const TEMP_DIR = path.resolve(process.cwd(), 'tmp');
const AUTH_ZIP_LOCAL = path.join(TEMP_DIR, 'wwebjs_auth.zip');

const CLOUDFOLDER = process.env.CLOUDINARY_AUTH_FOLDER || 'whatsapp_auth';
const AUTH_PUBLIC_ID = process.env.CLOUDINARY_AUTH_PUBLIC_ID || 'wwebjs_auth_backup';

// ensure tmp exists
fse.ensureDirSync(TEMP_DIR);

// helper: download a remote file (by url) to local path
async function downloadFile(url, destPath) {
  const writer = fs.createWriteStream(destPath);
  const res = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });
  return new Promise((resolve, reject) => {
    res.data.pipe(writer);
    let error = null;
    writer.on('error', (err) => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on('close', () => {
      if (!error) resolve(destPath);
    });
  });
}

// unzip into destination (overwrites)
function extractZip(zipPath, dest) {
  if (!fs.existsSync(zipPath)) return;
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(dest, true);
}

// zip specific dirs into a zip file
function zipAuthFiles(outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(outputPath));
    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    if (fs.existsSync(AUTH_LOCAL_DIR)) {
      archive.directory(AUTH_LOCAL_DIR, '.wwebjs_auth');
    }
    if (fs.existsSync(CACHE_LOCAL_DIR)) {
      archive.directory(CACHE_LOCAL_DIR, '.wwebjs_cache');
    }

    archive.finalize();
  });
}

// upload zip to cloudinary (resource_type 'raw')
async function uploadAuthToCloud() {
  try {
    await fse.ensureDir(TEMP_DIR);
    if (fs.existsSync(AUTH_ZIP_LOCAL)) await fse.remove(AUTH_ZIP_LOCAL);
    await zipAuthFiles(AUTH_ZIP_LOCAL);

    const res = await cloudinary.uploader.upload(AUTH_ZIP_LOCAL, {
      resource_type: 'raw',
      public_id: AUTH_PUBLIC_ID,
      folder: CLOUDFOLDER,
      overwrite: true,
      use_filename: false,
    });
    sendLogToDashboard(`☁️ Auth uploaded to Cloudinary: ${res.public_id}`);
    console.log('☁️ Auth uploaded to Cloudinary', res.public_id);
    return res;
  } catch (err) {
    console.error('❌ uploadAuthToCloud error:', err.message);
    sendLogToDashboard(`❌ uploadAuthToCloud error: ${err.message}`);
    throw err;
  }
}

// download auth zip from Cloudinary (if exists) and extract to local
async function downloadAuthFromCloudIfExists() {
  try {
    // try to get resource info
    const publicId = `${CLOUDFOLDER}/${AUTH_PUBLIC_ID}`.replace(/^\/+/, '');
    let resource;
    try {
      resource = await cloudinary.api.resource(publicId, { resource_type: 'raw' });
    } catch (err) {
      // resource not found
      console.log('ℹ️ No auth backup found in Cloudinary yet.');
      return false;
    }

    const url = resource.secure_url || resource.url;
    console.log('⬇️ Downloading auth zip from Cloudinary:', url);
    await downloadFile(url, AUTH_ZIP_LOCAL);

    // extract to project root (will create .wwebjs_auth & .wwebjs_cache)
    extractZip(AUTH_ZIP_LOCAL, process.cwd());
    console.log('✅ Extracted auth zip to project dir');
    sendLogToDashboard('✅ Downloaded & extracted WhatsApp auth from Cloudinary.');
    return true;
  } catch (err) {
    console.error('❌ downloadAuthFromCloudIfExists error:', err.message);
    sendLogToDashboard(`❌ downloadAuthFromCloudIfExists error: ${err.message}`);
    return false;
  }
}

// upload a media file (path or buffer) to Cloudinary and return the secure_url
async function uploadMediaToCloud(localPathOrBuffer, filename = null) {
  try {
    // if buffer passed in, use upload_stream
    if (Buffer.isBuffer(localPathOrBuffer)) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: 'auto', folder: 'whatsapp_media' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          }
        );
        uploadStream.end(localPathOrBuffer);
      });
    } else {
      // path
      const res = await cloudinary.uploader.upload(localPathOrBuffer, {
        resource_type: 'auto',
        folder: 'whatsapp_media',
        use_filename: true,
        unique_filename: false,
      });
      return res.secure_url;
    }
  } catch (err) {
    console.error('❌ uploadMediaToCloud error:', err.message);
    throw err;
  }
}

// download from a remote URL (cloudinary url) and return Buffer (if needed)
async function downloadUrlAsBuffer(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data, 'binary');
}

// ensure auth backup from cloud is present locally BEFORE initializing client
await downloadAuthFromCloudIfExists();

// create client (LocalAuth will use default folder .wwebjs_auth)
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'default' }), // adjust clientId if multiple clients
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

// event: QR
client.on('qr', (qr) => {
  console.log('📱 QR Code generated');
  sendLogToDashboard('📱 QR Code generated, sending to client...');
  global.io.emit('qr', qr);
  // optional: qrcode-terminal
  // qrcode.generate(qr, { small: true });
});

// event: ready
client.on('ready', async () => {
  console.log('✅ WhatsApp Client is Ready!');
  sendLogToDashboard('✅ WhatsApp client is connected.');
  // upload auth to cloud whenever ready (session established)
  try {
    await uploadAuthToCloud();
  } catch (err) {
    console.error('Error uploading auth after ready:', err.message);
  }
});

// event: authenticated (fired when auth successful)
client.on('authenticated', async (session) => {
  console.log('🔐 Authenticated!');
  sendLogToDashboard('🔐 WhatsApp authenticated - saving auth to Cloudinary.');
  try {
    await uploadAuthToCloud();
  } catch (err) {
    console.error('Error uploading auth after authenticated:', err.message);
  }
});

// event: auth_failure
client.on('auth_failure', (msg) => {
  console.error('❌ Auth failure', msg);
  sendLogToDashboard(`❌ WhatsApp auth failure: ${msg}`);
});

// optional: state change (to detect session state)
client.on('auth_state_change', async (state) => {
  // state contains keys added/removed etc. we can upload on changes if needed
  console.log('🔁 auth_state_change', state);
  sendLogToDashboard('🔁 WhatsApp auth state changed, uploading backup.');
  // Debounce or small delay to allow local files to be written
  setTimeout(() => uploadAuthToCloud().catch((e) => console.error(e.message)), 2000);
});

// Auto reply + message handling
client.on('message', async (msg) => {
  console.log(`📩 Message from ${msg.from}: ${msg.body}`);
  sendLogToDashboard(`📩 Incoming from ${msg.from}: ${msg.body}`);

  try {
    if (msg.body && msg.body.toLowerCase().includes('umrah')) {
      await msg.reply(
        '🌙 *Assalamu Alaikum!* 🙏\nWelcome to *Safar Makkah Hajj Umrah Travels*\n\n📅 November 2025 Umrah Packages from Jaipur available now!\n\nReply *Package* to get Brochure or *Plan* for Plan prices.'
      );
    }
    if (msg.body && msg.body.toLowerCase() === 'package') {
      await msg.reply('📄 Sending you the Umrah Brochure...');
      const brochurePath = './files/umrah-brochure.pdf';
      if (!fs.existsSync(brochurePath)) {
        await msg.reply('❌ Brochure file not found. Please contact support to 9024710909.');
        return;
      } else {
        // Upload brochure to Cloudinary (once) and then send via URL
        const url = await uploadMediaToCloud(brochurePath);
        // MessageMedia.fromUrl can accept a URL
        const media = await MessageMedia.fromUrl(url);
        await client.sendMessage(msg.from, media);
        await msg.reply('✅ Brochure sent successfully!');
      }
    }
    if (msg.body && msg.body.toLowerCase() === 'plan') {
      await msg.reply(
        '📊 *Umrah November 2025 Rates (Jaipur → Jaipur)*\n\nBudget Plan: ₹74,000\nEconomy Plan: ₹77,000\nSemi-Deluxe Plan: ₹89,500\nDeluxe Plan: ₹93,000\n\nIncludes Flight and Bus Tickets, Hotel, Visa & Ziyarat and Others.'
      );
    }
  } catch (err) {
    console.error('Error handling incoming message:', err.message);
    sendLogToDashboard(`❌ Error handling incoming message: ${err.message}`);
  }
});

// Send single message (number without @c.us)
const sendMessage = async (number, message, mediaPath = null) => {
  try {
    const chatId = `${number}@c.us`;
    if (mediaPath) {
      // if local file exists -> upload to cloud and send via URL
      let media;
      if (fs.existsSync(mediaPath)) {
        const url = await uploadMediaToCloud(mediaPath);
        media = await MessageMedia.fromUrl(url);
        await client.sendMessage(chatId, media, { caption: message });
      } else if (mediaPath.startsWith('http')) {
        media = await MessageMedia.fromUrl(mediaPath);
        await client.sendMessage(chatId, media, { caption: message });
      } else {
        // not found
        await client.sendMessage(chatId, message);
        console.warn('Media path not found locally and not URL:', mediaPath);
      }
    } else {
      await client.sendMessage(chatId, message);
    }
    sendLogToDashboard(`📩 Sent message to ${number}: ${message}`);
    console.log(`✅ Message sent to ${number}`);
  } catch (err) {
    sendLogToDashboard(`❌ Failed to send message to ${number}: ${err.message}`);
    console.error(`❌ Failed to send message to ${number}:`, err.message);
  }
};

// Broadcast messages from CSV (expects CSV with header `number`)
const broadcastFromCSV = async (filePath, message, mediaPath = null) => {
  const contacts = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => contacts.push(row))
      .on('end', async () => {
        console.log(`📤 Sending messages to ${contacts.length} contacts...`);
        for (const contact of contacts) {
          if (!contact.number) continue;
          await sendMessage(contact.number, message, mediaPath);
          await new Promise((r) => setTimeout(r, 3000)); // 3s delay
        }
        sendLogToDashboard(`✅ Broadcast Completed!`);
        console.log('✅ Broadcast Completed!');
        resolve(true);
      })
      .on('error', (err) => {
        console.error('❌ CSV read error', err.message);
        reject(err);
      });
  });
};

// initialize client
client.initialize();

// ensure we upload auth on process exit (graceful)
async function gracefulShutdown() {
  try {
    console.log('🛑 Graceful shutdown triggered - uploading auth backup...');
    await uploadAuthToCloud();
  } catch (err) {
    console.error('Error uploading auth on shutdown:', err.message);
  } finally {
    process.exit();
  }
}
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export { sendMessage, broadcastFromCSV, client, uploadAuthToCloud, downloadAuthFromCloudIfExists, uploadMediaToCloud };
