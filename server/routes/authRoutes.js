import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/userSchema.js";
import { decodeBase64 } from "bcryptjs";
import { requireAuth, requireRole } from "../middlewares/authMiddleware.js";

dotenv.config();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// 🔐 Create cookie options
const cookieOptions = {
  httpOnly: true,       // not accessible by JavaScript
  secure: true,         // only over HTTPS
  sameSite: "None",     // allows cross-site cookies (important for frontend on different domain)
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// ✅ SIGNUP
// signup route example
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "Email already exists" });

    const user = new User({
      name,
      email,
      password,
      role: role || "user", // default is "user"
      permissions: permissions || ["profile"], // default permissions
    });

    await user.save();

    // ... generate JWT and set cookie
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

    // 🍪 send token securely in HTTP-only cookie
    res.cookie("auth_token", token, cookieOptions);
    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, permissions: user.permissions },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// ✅ LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const decodedPassword = Buffer.from(password, 'base64').toString('utf-8');
    const isMatch = bcrypt.compareSync(decodedPassword, user.password);

    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

    // 🍪 send token securely in HTTP-only cookie
    res.cookie("auth_token", token, cookieOptions);
    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, permissions: user.permissions } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ✅ LOGOUT (clear cookie)
router.post("/logout", (req, res) => {
  res.clearCookie("auth_token", { ...cookieOptions, maxAge: 0 });
  res.json({ message: "Logged out successfully" });
});

export default router;
