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
import notificationRoutes from "./routes/notifications.js";
import profileRoutes from "./routes/profile.js";
import userRoutes from "./routes/users.js";
import {
  scheduleAutomaticEventCatalogRefresh,
  triggerStartupEventCatalogRefresh,
} from "./services/eventSync.js";
import { syncMockEventCatalog } from "./services/mockEventCatalog.js";
import { syncMockUserCatalog } from "./services/mockUserCatalog.js";

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
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(passport.initialize());

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/interactions", interactionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/users", userRoutes);

app.use((error, req, res, next) => {
  if (!error) {
    return next();
  }

  if (res.headersSent) {
    return next(error);
  }

  const status = Number.isInteger(error.status) ? error.status : 500;

  if (status >= 500) {
    console.error("Unhandled server error:", error);
  }

  return res.status(status).json({
    success: false,
    message: error.message || "Server error.",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "Backend running" });
});

const PORT = process.env.PORT || process.env.APP_PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

void scheduleAutomaticEventCatalogRefresh().catch((error) => {
  console.error("Unable to schedule the SerpAPI event refresh:", error);
});

void triggerStartupEventCatalogRefresh().catch((error) => {
  console.error("Unable to refresh the SerpAPI event catalog on startup:", error);
});

void syncMockEventCatalog({ reason: "startup" }).catch((error) => {
  console.error("Unable to sync the mock event catalog:", error);
});

void syncMockUserCatalog({ reason: "startup" }).catch((error) => {
  console.error("Unable to sync the mock user catalog:", error);
});
