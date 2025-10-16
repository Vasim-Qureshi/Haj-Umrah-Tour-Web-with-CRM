// ✅ MongoDB Connection
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const dbConnection = mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

export default dbConnection;