// server/server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import http from "http";
import { Server } from "socket.io";
import { sendMessage, broadcastFromCSV, client } from "./whatsApp.js";

dotenv.config();
const app = express();

// ✅ Multer - file memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Create HTTP + Socket.io server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

global.io = io; // ✅ make io globally accessible (used in whatsApp.js)

app.use(cors());
app.use(express.json());

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ✅ Booking Schema (Lead Dashboard)
const bookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  plan: { type: String },
  duration: { type: String },
  email: { type: String },
  persons: { type: Number },
  message: { type: String },
  leadStage: {
    type: String,
    enum: ["New", "Contacted", "Follow Up", "Converted", "Lost"],
    default: "New",
  },
  date: { type: Date, default: Date.now },
});

const Booking = mongoose.model("Booking", bookingSchema);

//
// ─── SOCKET.IO CONNECTION ────────────────────────────────────────────────
//
io.on("connection", (socket) => {
  console.log("🟢 Dashboard connected via socket.io");

  socket.on("disconnect", () => {
    console.log("🔴 Dashboard disconnected");
  });
});

// ✅ Emit log to dashboard
const sendLogToDashboard = (msg) => io.emit("log", msg);

//
// ─── LEAD CRUD APIs ────────────────────────────────────────────────
//

// ✅ Create (Add Lead)
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

// ✅ Read (All Leads)
app.get("/api/bookings", async (req, res) => {
  try {
    const data = await Booking.find().sort({ date: -1 });
    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching bookings:", err);
    res.status(500).json({ error: "Error fetching data" });
  }
});

// ✅ Read (Single Lead)
app.get("/api/bookings/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Lead not found" });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: "Error fetching lead" });
  }
});

// ✅ Update (Lead)
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

// ✅ Delete (Lead)
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

//
// ─── WHATSAPP ROUTES ─────────────────────────────────────────────
//

// Root
app.get("/", (req, res) => {
  res.send("🕌 WhatsApp Automation API is Running - Safar Makkah Tours");
});

// Send single message
app.post("/send-message", async (req, res) => {
  const { number, message } = req.body;
  if (!number || !message) {
    return res.status(400).json({ error: "number and message required" });
  }
  await sendMessage(number, message);
  sendLogToDashboard(`📤 Sent message to ${number}: ${message}`);
  res.json({ success: true, number, message });
});

// Send media message
app.post("/send-media", async (req, res) => {
  const { number, message, mediaPath } = req.body;
  await sendMessage(number, message, mediaPath);
  res.json({ success: true, media: mediaPath });
});

// Broadcast from CSV
app.post("/broadcast", upload.single("file"), async (req, res) => {
  const { message, mediaPath } = req.body;
  const filePath = req.file.path;
  broadcastFromCSV(filePath, message, mediaPath);
  sendLogToDashboard(`🚀 Broadcast started: ${filePath}`);
  res.json({ success: true, info: "Broadcast started", file: filePath });
});

// WhatsApp status
app.get("/status", async (req, res) => {
  res.json({
    connected: client.info ? true : false,
    user: client.info || null,
  });
});

//
// ─── SERVER START ─────────────────────────────────────────────────
//
server.listen(process.env.PORT, () => {
  console.log(`✅ Server & Socket.io running on port ${process.env.PORT}`);
});

export { sendLogToDashboard };
