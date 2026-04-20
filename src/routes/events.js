import express from "express";
import { getJson } from "serpapi";
import protect from "../middleware/protect.js";
import SavedEvent from "../models/SavedEvent.js";
import { cloudinary, upload } from "../utils/cloudinary.js";

const router = express.Router();

// ─── NEW: Create Custom Event with Image Upload ───────
// Uses 'upload.single("image")' to intercept the file from the form
router.post("/create", protect, upload.single("image"), async (req, res) => {
  try {
    let imageUrl = "";
    let cloudinaryId = "";

    // 2. If a file exists, stream it to Cloudinary
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "user_events" },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        stream.end(req.file.buffer);
      });
      imageUrl = result.secure_url;
      cloudinaryId = result.public_id;
    }

    // 3. Save to MongoDB Atlas
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
      eventId: cloudinaryId || `custom-${Date.now()}`
    });

    res.status(201).json({ success: true, data: newEvent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Fetch Events from SerpApi ───────────────────────
const fetchFromSerpApi = async (location) => {
  const results = await getJson({
    engine: "google_events",
    q: `events in ${location} Philippines`,
    hl: "en",
    gl: "ph",
    api_key: process.env.SERPAPI_KEY,
  });
  return results.events_results || [];
};

// GET /api/events?location=Manila
router.get("/", async (req, res) => {
  try {
    const location = req.query.location || "Manila";
    const events = await fetchFromSerpApi(location);
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/events/save  (protected - must be logged in)
router.post("/save", protect, async (req, res) => {
  try {
    const { eventId, title, location, date, time, category, description, imageUrl, eventUrl } = req.body;
    const existing = await SavedEvent.findOne({
      userId: req.user._id,
      eventId,
    });
    if (existing)
      return res.status(400).json({ message: "Event already saved" });

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

// GET /api/events/saved  (protected)
router.get("/saved", protect, async (req, res) => {
  try {
    const saved = await SavedEvent.find({ userId: req.user._id }).sort(
      "-createdAt",
    );
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/events/saved/:eventId
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
