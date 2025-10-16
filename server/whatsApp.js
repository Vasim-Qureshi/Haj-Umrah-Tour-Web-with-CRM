// whatsapp.js
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import csv from 'csv-parser';
import { sendLogToDashboard } from './server.js';

const { Client, LocalAuth, MessageMedia } = pkg;

// ✅ Use /tmp for Render (read/write allowed)
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '/tmp/.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
    ],
  },
});

// ✅ Emit QR to frontend (or see logs)
client.on('qr', (qr) => {
  console.log('📱 QR Code generated');
  sendLogToDashboard('📱 QR Code generated, sending to client...');
  if (global.io) global.io.emit('qr', qr);
});

// ✅ Ready check
let isClientReady = false;

client.on('ready', () => {
  console.log('✅ WhatsApp Client is Ready!');
  sendLogToDashboard('✅ WhatsApp client is connected.');
  isClientReady = true;
});

client.on('auth_failure', (msg) => {
  console.error('❌ Auth Failure:', msg);
  sendLogToDashboard(`❌ Auth Failure: ${msg}`);
});

client.on('disconnected', (reason) => {
  console.error('⚠️ WhatsApp Client Disconnected:', reason);
  sendLogToDashboard(`⚠️ Disconnected: ${reason}`);
  isClientReady = false;
});

// ✅ Auto reply example
client.on('message', async (msg) => {
  console.log(`📩 Message from ${msg.from}: ${msg.body}`);
  sendLogToDashboard(`📩 Incoming from ${msg.from}: ${msg.body}`);

  try {
    const lower = msg.body.toLowerCase();

    if (lower.includes('umrah')) {
      await msg.reply(
        '🌙 *Assalamu Alaikum!* 🙏\nWelcome to *Safar Makkah Hajj Umrah Travels*\n\n📅 November 2025 Umrah Packages from Jaipur available now!\n\nReply *Package* to get Brochure or *Plan* for Plan prices.'
      );
    }

    if (lower === 'package') {
      await msg.reply('📄 Sending you the Umrah Brochure...');
      const path = './files/umrah-brochure.pdf';
      if (!fs.existsSync(path)) {
        await msg.reply('❌ Brochure file not found. Please contact support to 9024710909.');
        return;
      }
      const media = MessageMedia.fromFilePath(path);
      await client.sendMessage(msg.from, media);
      await msg.reply('✅ Brochure sent successfully!');
    }

    if (lower === 'plan') {
      await msg.reply(
        '📊 *Umrah November 2025 Rates (Jaipur → Jaipur)*\n\nBudget Plan: ₹74,000\nEconomy Plan: ₹77,000\nSemi-Deluxe Plan: ₹89,500\nDeluxe Plan: ₹93,000\n\nIncludes Flight and Bus Tickets, Hotel, Visa & Ziyarat and Others.'
      );
    }
  } catch (err) {
    console.error('⚠️ Auto reply failed:', err.message);
    sendLogToDashboard(`⚠️ Auto reply failed: ${err.message}`);
  }
});

// ✅ Send single message safely
const sendMessage = async (number, message, mediaPath = null) => {
  try {
    if (!isClientReady) {
      throw new Error('WhatsApp client not ready yet.');
    }

    const chatId = `${number}@c.us`;
    if (mediaPath) {
      const media = MessageMedia.fromFilePath(mediaPath);
      await client.sendMessage(chatId, media, { caption: message });
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

// ✅ Broadcast from CSV
const broadcastFromCSV = async (filePath, message, mediaPath = null) => {
  const contacts = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => contacts.push(row))
    .on('end', async () => {
      console.log(`📤 Sending messages to ${contacts.length} contacts...`);
      for (const contact of contacts) {
        await sendMessage(contact.number, message, mediaPath);
        await new Promise((r) => setTimeout(r, 3000)); // 3s delay
      }
      sendLogToDashboard('✅ Broadcast Completed!');
      console.log('✅ Broadcast Completed!');
    });
};

// ✅ Initialize client
client.initialize();

export { sendMessage, broadcastFromCSV, client };
