// server/server.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import dbConnection from "./config/db.js";
import Booking from "./models/bookingSchema.js";
import multer from "multer";
import http from "http";
import { Server } from "socket.io";
import { sendMessage, broadcastFromCSV, client, uploadMediaToCloud } from "./whatsApp.js";
import authRoutes from "./routes/authRoutes.js";
import { requireAuth, requireRole } from "./middlewares/authMiddleware.js";
import cloudinaryPackage from 'cloudinary';
import path from 'path';
import fse from 'fs-extra';

dotenv.config();

// configure cloudinary (optional here)
const cloudinary = cloudinaryPackage.v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://umrah-crm.vercel.app",
  "https://umrah-crm-v2.vercel.app"
];

app.use(cors({
  origin: (origin, callback) => {
    // allow Postman / server-to-server (no origin)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

const dbConn = dbConnection; // ensure dbConnection connects inside that module

// multer disk storage for uploads (CSV / media)
const tmpUploadsDir = path.resolve(process.cwd(), 'tmp', 'uploads');
fse.ensureDirSync(tmpUploadsDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tmpUploadsDir);
  },
  filename: function (req, file, cb) {
    const ts = Date.now();
    cb(null, `${ts}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Create HTTP + Socket.io server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

global.io = io; // make io globally accessible (used in whatsapp.js)

// SOCKET.IO connection
io.on("connection", (socket) => {
  console.log("🟢 Dashboard connected via socket.io");

  socket.on("disconnect", () => {
    console.log("🔴 Dashboard disconnected");
  });
});

// Emit log to dashboard
const sendLogToDashboard = (msg) => io.emit("log", msg);

// AUTH ROUTES
app.use("/api", authRoutes);

// LEAD CRUD APIs (same as your original)
app.post("/api/bookings", async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();
    sendLogToDashboard(`✅ New Lead Added: ${booking.name}`);
    res.status(201).json(booking);
  } catch (err) {
    console.error("❌ Error saving booking:", err);
    res.status(500).json({ error: "Error saving booking" });
  }
});

app.get("/api/bookings", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const data = await Booking.find().sort({ date: -1 });
    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching bookings:", err);
    res.status(500).json({ error: "Error fetching data" });
  }
});

app.get("/api/bookings/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Lead not found" });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: "Error fetching lead" });
  }
});

app.put("/api/bookings/:id", async (req, res) => {
  try {
    const updated = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ error: "Lead not found" });

    sendLogToDashboard(`✏️ Lead Updated: ${updated.name}`);
    res.json(updated);
  } catch (err) {
    console.error("❌ Error updating lead:", err);
    res.status(500).json({ error: "Error updating lead" });
  }
});

app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Lead not found" });

    sendLogToDashboard(`🗑️ Lead Deleted: ${deleted.name}`);
    res.json({ success: true, message: "Lead deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting lead:", err);
    res.status(500).json({ error: "Error deleting lead" });
  }
});

// WHATSAPP ROUTES
app.get("/", (req, res) => {
  res.send("🕌 WhatsApp Automation API is Running - Safar Makkah Tours");
});

// send single message
app.post("/send-message", async (req, res) => {
  const { number, message } = req.body;
  if (!number || !message) {
    return res.status(400).json({ error: "number and message required" });
  }
  await sendMessage(number, message);
  sendLogToDashboard(`📤 Sent message to ${number}: ${message}`);
  res.json({ success: true, number, message });
});

// send media message (accepts a local file path (uploaded) or remote url)
app.post("/send-media", upload.single('file'), async (req, res) => {
  try {
    const { number, message } = req.body;
    let mediaPath = req.body.mediaPath || null;

    // if file uploaded via form-data as 'file' -> upload to cloud and use that URL
    if (req.file) {
      const secureUrl = await uploadMediaToCloud(req.file.path);
      // optional: delete uploaded temp file
      await fse.remove(req.file.path).catch(() => { });
      mediaPath = secureUrl;
    }

    await sendMessage(number, message, mediaPath);
    res.json({ success: true, media: mediaPath });
  } catch (err) {
    console.error('send-media error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// broadcast from CSV - expects form-data file field named 'file'
app.post("/broadcast", upload.single("file"), async (req, res) => {
  try {
    const { message, mediaPath } = req.body;
    if (!req.file) return res.status(400).json({ error: "CSV file required in 'file' field" });

    const filePath = req.file.path; // multer diskStorage gives us a path
    broadcastFromCSV(filePath, message, mediaPath)
      .then(async () => {
        // delete temp csv (cleanup)
        await fse.remove(filePath).catch(() => { });
        sendLogToDashboard(`🚀 Broadcast completed: ${filePath}`);
      })
      .catch((err) => {
        console.error('Broadcast error:', err.message);
        sendLogToDashboard(`❌ Broadcast error: ${err.message}`);
      });

    sendLogToDashboard(`🚀 Broadcast started: ${filePath}`);
    res.json({ success: true, info: "Broadcast started", file: filePath });
  } catch (err) {
    console.error('broadcast route error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// whatsapp status
app.get("/status", async (req, res) => {
  res.json({
    connected: client.info ? true : false,
    user: client.info || null,
  });
});

// SERVER START
server.listen(process.env.PORT || 5000, () => {
  console.log(`✅ Server & Socket.io running on port ${process.env.PORT || 5000}`);
});

export { sendLogToDashboard };
