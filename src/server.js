import dotenv from "dotenv";
dotenv.config(); 

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "./routes/db.js"; 

import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";

const app = express();

// ─── Middleware ───────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────
app.use("/api/auth", authRoutes); 
app.use("/api/events", eventRoutes);

// ─── Health Check ─────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "Backend running " });
});

// ─── Server Start ─────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

