// server/server.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import dbConnection from "./config/db.js";
import { upload } from "./config/multer.js"; // ✅ CSV & Media Upload
import cloudinary from "./config/cloudinary.js"; // ✅ Cloudinary Config
import Booking from "./models/bookingSchema.js";
import authRoutes from "./routes/authRoutes.js";
import { requireAuth, requireRole } from "./middlewares/authMiddleware.js";
import {client, sendMessage, broadcastFromCSV } from "./whatsApp.js"; // ✅ WhatsApp Integration

dotenv.config();
const dbConn = dbConnection; // connect to MongoDB

// ─────────────────────────────────────────────
// Express + Socket.io Setup
// ─────────────────────────────────────────────
const app = express();
const allowedOrigins = [
  "http://localhost:5173",
  "https://umrah-crm.vercel.app",
  "https://umrah-crm-v2.vercel.app",
  "https://umrah.globalinfotechnology.in"
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error("❌ Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// HTTP Server + Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST", "PUT", "DELETE"] },
});

// Global socket instance
global.io = io;

// ─────────────────────────────────────────────
// Socket.io Events
// ─────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("🟢 Dashboard connected");
  socket.on("disconnect", () => console.log("🔴 Dashboard disconnected"));
});

// Helper to send logs to dashboard
export const sendLogToDashboard = (msg) => io.emit("log", msg);

// ─────────────────────────────────────────────
// ROOT TEST ENDPOINT
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("🕌 Safar Makkah WhatsApp Automation API is Running ✅");
});

// ─────────────────────────────────────────────
// AUTH ROUTES (Login, Register, etc.)
// ─────────────────────────────────────────────
app.use("/api", authRoutes);

// ─────────────────────────────────────────────
// WHATSAPP ROUTES
// ─────────────────────────────────────────────

// ✅ Send single message (text or media)
app.post("/send-media", upload.single("file"), async (req, res) => {
  try {
    const { number, message } = req.body;
    if (!number || !message)
      return res.status(400).json({ error: "number and message required" });

    const mediaPath = req.file?.path || null;
    await sendMessage(number, message, mediaPath);
    sendLogToDashboard(`📤 Message sent to ${number}`);
    res.json({ success: true, number, message, mediaPath });
  } catch (err) {
    console.error("❌ Send-media error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Broadcast to contacts from CSV (+ optional media)
app.post("/broadcast", upload.fields([
    { name: "file", maxCount: 1 }, // CSV file
    { name: "mediaFile", maxCount: 1 }, // Media file
  ]),
  async (req, res) => {
    try {
      const { message } = req.body;
      const csvPath = req.files?.file?.[0]?.path;
      const mediaPath = req.files?.mediaFile?.[0]?.path || null;

      if (!csvPath || !message)
        return res
          .status(400)
          .json({ error: "CSV file and message required" });

      broadcastFromCSV(csvPath, message, mediaPath);
      sendLogToDashboard(
        `🚀 Broadcast started: ${csvPath} ${
          mediaPath ? "(with media)" : "(text only)"
        }`
      );
      res.json({ success: true, info: "Broadcast started" });
    } catch (err) {
      console.error("❌ Broadcast error:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ✅ WhatsApp client status
app.get("/status", (req, res) => {
  res.json({
    connected: !!client.info,
    user: client.info || null,
  });
});

// ─────────────────────────────────────────────
// LEAD MANAGEMENT (Booking CRUD)
// ─────────────────────────────────────────────

// ➕ Create Lead
app.post("/api/bookings", async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();
    sendLogToDashboard(`✅ New Lead Added: ${booking.name}`);
    res.status(201).json(booking);
  } catch (err) {
    console.error("❌ Error saving booking:", err.message);
    res.status(500).json({ error: "Error saving booking" });
  }
});

// 📋 Get All Leads (admin only)
app.get("/api/bookings", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const data = await Booking.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching bookings:", err.message);
    res.status(500).json({ error: "Error fetching data" });
  }
});

// 📄 Get Single Lead
app.get("/api/bookings/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Lead not found" });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: "Error fetching lead" });
  }
});

// ✏️ Update Lead
app.put("/api/bookings/:id", async (req, res) => {
  try {
    const updated = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ error: "Lead not found" });
    sendLogToDashboard(`✏️ Lead Updated: ${updated.name}`);
    res.json(updated);
  } catch (err) {
    console.error("❌ Error updating lead:", err.message);
    res.status(500).json({ error: "Error updating lead" });
  }
});

// 🗑️ Delete Lead
app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Lead not found" });
    sendLogToDashboard(`🗑️ Lead Deleted: ${deleted.name}`);
    res.json({ success: true, message: "Lead deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting lead:", err.message);
    res.status(500).json({ error: "Error deleting lead" });
  }
});

// ─────────────────────────────────────────────
// CLOUDINARY TEST API (optional)
// ─────────────────────────────────────────────
app.get("/cloudinary/test", async (req, res) => {
  try {
    const info = await cloudinary.api.ping();
    res.json({ cloudinary: "connected", info });
  } catch (err) {
    res.status(500).json({ error: "Cloudinary not reachable", msg: err.message });
  }
});

// ─────────────────────────────────────────────
// SERVER START
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server & Socket.io running on port ${PORT}`);
});
