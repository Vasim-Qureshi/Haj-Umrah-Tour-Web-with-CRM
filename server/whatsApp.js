// whatsapp.js 
import pkg from 'whatsapp-web.js';
 import qrcode from 'qrcode-terminal';
  import fs from 'fs'; import csv from 'csv-parser';
   import { sendLogToDashboard } from './server.js'; // ✅ add this const { Client, LocalAuth, MessageMedia } = pkg; const client = new Client({ authStrategy: new LocalAuth(), puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], }, }); // Generate QR for login client.on('qr', (qr) => { console.log('📱 Scan QR Code to log in:'); qrcode.generate(qr, { small: true }); }); // Confirm ready client.on('ready', () => { console.log('✅ WhatsApp Client is Ready!'); sendLogToDashboard('✅ WhatsApp client is connected.'); }); // Auto reply example client.on('message', async (msg) => { console.log(📩 Message from ${msg.from}: ${msg.body}); sendLogToDashboard(📩 Incoming from ${msg.from}: ${msg.body}); // ✅ emit to dashboard if (msg.body.toLowerCase().includes('umrah')) { await msg.reply( '🌙 *Assalamu Alaikum!* 🙏\nWelcome to *Safar Makkah Hajj Umrah Travels*\n\n📅 November 2025 Umrah Packages from Jaipur available now!\n\nReply *Package* to get Brochure or *Plan* for Plan prices.' ); } if (msg.body.toLowerCase() === 'package') { await msg.reply('📄 Sending you the Umrah Brochure...'); if (!fs.existsSync('./files/umrah-brochure.pdf')) { await msg.reply('❌ Brochure file not found. Please contact support to 9024710909.'); return; } else { const media = MessageMedia.fromFilePath('./files/umrah-brochure.pdf'); await client.sendMessage(msg.from, media); await msg.reply('✅ Brochure sent successfully!'); } } if (msg.body.toLowerCase() === 'plan') { await msg.reply( '📊 *Umrah November 2025 Rates (Jaipur → Jaipur)*\n\nBudget Plan: ₹74,000\nEconomy Plan: ₹77,000\nSemi-Deluxe Plan: ₹89,500\nDeluxe Plan: ₹93,000\n\nIncludes Flight and Bus Tickets, Hotel, Visa & Ziyarat and Others.' ); } }); // Send single message const sendMessage = async (number, message, mediaPath = null) => { try { const chatId = ${number}@c.us; if (mediaPath) { const media = MessageMedia.fromFilePath(mediaPath); await client.sendMessage(chatId, media, { caption: message }); } else { await client.sendMessage(chatId, message); } sendLogToDashboard(📩 Sent message to ${number}: ${message}); console.log(✅ Message sent to ${number}); } catch (err) { sendLogToDashboard(❌ Failed to send message to ${number}: ${err.message}); console.error(❌ Failed to send message to ${number}:, err.message); } }; // Broadcast messages from CSV const broadcastFromCSV = async (filePath, message, mediaPath = null) => { const contacts = []; fs.createReadStream(filePath) .pipe(csv()) .on('data', (row) => contacts.push(row)) .on('end', async () => { console.log(📤 Sending messages to ${contacts.length} contacts...); for (const contact of contacts) { await sendMessage(contact.number, message, mediaPath); await new Promise((r) => setTimeout(r, 3000)); // delay 3 sec each } sendLogToDashboard(✅ Broadcast Completed!); console.log('✅ Broadcast Completed!'); }); }; client.initialize(); export { sendMessage, broadcastFromCSV, client };
  const { Client, LocalAuth, MessageMedia } = pkg;
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  // Generate QR for login
  client.on('qr', (qr) => {
    console.log('📱 Scan QR Code to log in:');
    qrcode.generate(qr, { small: true });
  });

  // Confirm ready
  client.on('ready', () => {
    console.log('✅ WhatsApp Client is Ready!');
    sendLogToDashboard('✅ WhatsApp client is connected.');
  });

  // Auto reply example
  client.on('message', async (msg) => {
    console.log(`📩 Message from ${msg.from}: ${msg.body}`);
    sendLogToDashboard(`📩 Incoming from ${msg.from}: ${msg.body}`);

    // ✅ emit to dashboard
    if (msg.body.toLowerCase().includes('umrah')) {
      await msg.reply(
        '🌙 *Assalamu Alaikum!* 🙏\nWelcome to *Safar Makkah Hajj Umrah Travels*\n\n📅 November 2025 Umrah Packages from Jaipur available now!\n\nReply *Package* to get Brochure or *Plan* for Plan prices.'
      );
    }
    if (msg.body.toLowerCase() === 'package') {
      await msg.reply('📄 Sending you the Umrah Brochure...');
      if (!fs.existsSync('./files/umrah-brochure.pdf')) {
        await msg.reply('❌ Brochure file not found. Please contact support to 9024710909.');
        return;
      } else {
        const media = MessageMedia.fromFilePath('./files/umrah-brochure.pdf');
        await client.sendMessage(msg.from, media);
        await msg.reply('✅ Brochure sent successfully!');
      }
    }
    if (msg.body.toLowerCase() === 'plan') {
      await msg.reply(
        '📊 *Umrah November 2025 Rates (Jaipur → Jaipur)*\n\nBudget Plan: ₹74,000\nEconomy Plan: ₹77,000\nSemi-Deluxe Plan: ₹89,500\nDeluxe Plan: ₹93,000\n\nIncludes Flight and Bus Tickets, Hotel, Visa & Ziyarat and Others.'
      );
    }
  });

  // Send single message
  const sendMessage = async (number, message, mediaPath = null) => {
    try {
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

  // Broadcast messages from CSV
  const broadcastFromCSV = async (filePath, message, mediaPath = null) => {
    const contacts = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => contacts.push(row))
      .on('end', async () => {
        console.log(`📤 Sending messages to ${contacts.length} contacts...`);
        for (const contact of contacts) {
          await sendMessage(contact.number, message, mediaPath);
          await new Promise((r) => setTimeout(r, 3000)); // delay 3 sec each
        }
        sendLogToDashboard(`✅ Broadcast Completed!`);
        console.log('✅ Broadcast Completed!');
      });
  };

  client.initialize();

  export { sendMessage, broadcastFromCSV, client };