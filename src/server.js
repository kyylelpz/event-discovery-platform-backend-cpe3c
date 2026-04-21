import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import "./routes/db.js";

import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import interactionRoutes from "./routes/interactions.js";
import profileRoutes from "./routes/profile.js";
import userRoutes from "./routes/users.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS || "").split(","),
]
  .map((origin) => origin?.trim())
  .filter(Boolean);

const isLocalDevelopmentOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

app.set("trust proxy", 1);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (!isProduction && isLocalDevelopmentOrigin(origin))
      ) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/interactions", interactionRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/users", userRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "Backend running" });
});

const PORT = process.env.PORT || process.env.APP_PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
