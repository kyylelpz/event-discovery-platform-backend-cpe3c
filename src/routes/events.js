import express from "express";
import protect from "../middleware/protect.js";
import Event from "../models/Event.js";
import SavedEvent from "../models/SavedEvent.js";
import {
  ensureEventCatalog,
  getEventCatalogStatus,
  getStoredEvents,
  refreshEventCatalog,
} from "../services/eventSync.js";
import { cloudinary, upload } from "../utils/cloudinary.js";

const router = express.Router();

router.get("/status", async (req, res) => {
  try {
    const status = await getEventCatalogStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const configuredToken = process.env.EVENTS_REFRESH_TOKEN;
    const providedToken = req.get("x-refresh-token");

    if (configuredToken && providedToken !== configuredToken) {
      return res.status(401).json({ success: false, message: "Unauthorized refresh request" });
    }

    const query = req.body?.query || process.env.EVENTS_REFRESH_QUERY || "Events in the Philippines";
    const result = await refreshEventCatalog({ query, reason: "manual" });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const location = req.query.location || "All Luzon";

    await ensureEventCatalog();
    const events = await getStoredEvents(location);
    const totalCount = await Event.countDocuments();

    res.json({
      success: true,
      data: events,
      count: events.length,
      totalCount,
      source: "database",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/create", protect, upload.single("image"), async (req, res) => {
  try {
    let imageUrl = "";
    let cloudinaryId = "";

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "user_events" },
          (error, uploadResult) => {
            if (uploadResult) resolve(uploadResult);
            else reject(error);
          },
        );
        stream.end(req.file.buffer);
      });

      imageUrl = result.secure_url;
      cloudinaryId = result.public_id;
    }

    const newEvent = await SavedEvent.create({
      userId: req.user._id,
      title: req.body.title,
      location: req.body.location || req.body.venue || req.body.province,
      date: req.body.date,
      time: req.body.time || "",
      category: req.body.category || "Community",
      description: req.body.description || "",
      eventUrl: req.body.eventUrl || "",
      imageUrl: imageUrl || req.body.imageUrl || "",
      eventId: cloudinaryId || `custom-${Date.now()}`,
    });

    res.status(201).json({ success: true, data: newEvent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/save", protect, async (req, res) => {
  try {
    const { eventId, title, location, date, time, category, description, imageUrl, eventUrl } = req.body;
    const existing = await SavedEvent.findOne({
      userId: req.user._id,
      eventId,
    });

    if (existing) {
      return res.status(400).json({ message: "Event already saved" });
    }

    const saved = await SavedEvent.create({
      userId: req.user._id,
      eventId,
      title,
      location,
      date,
      time,
      category,
      description,
      imageUrl,
      eventUrl,
    });

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/saved", protect, async (req, res) => {
  try {
    const saved = await SavedEvent.find({ userId: req.user._id }).sort("-createdAt");
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/saved/:eventId", protect, async (req, res) => {
  try {
    await SavedEvent.findOneAndDelete({
      userId: req.user._id,
      eventId: req.params.eventId,
    });

    res.json({ success: true, message: "Event removed from saved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
