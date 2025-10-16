// ✅ Booking Schema (Lead Dashboard)
import mongoose from "mongoose";

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
export default Booking;
