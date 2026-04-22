import express from "express";
import protect from "../middleware/protect.js";
import UserEventInteraction from "../models/UserEventInteraction.js";
import User from "../models/User.js";

const router = express.Router();

const pickString = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

const normalizeFlag = (value) =>
  value === true || value === "true" || value === 1 || value === "1";

const serializeInteraction = (record) => ({
  id: String(record._id),
  eventId: record.eventId,
  hearted: Boolean(record.hearted),
  saved: Boolean(record.saved),
  attending: Boolean(record.attending),
  title: record.title || "",
  location: record.location || "",
  date: record.date || "",
  time: record.time || "",
  category: record.category || "",
  description: record.description || "",
  imageUrl: record.imageUrl || "",
  eventUrl: record.eventUrl || "",
  province: record.province || "",
  host: record.host || "",
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const buildInteractionSummary = (records) =>
  records.reduce(
    (summary, record) => {
      if (record.hearted) {
        summary.hearted.push(record.eventId);
      }

      if (record.saved) {
        summary.saved.push(record.eventId);
      }

      if (record.attending) {
        summary.attending.push(record.eventId);
      }

      return summary;
    },
    {
      hearted: [],
      saved: [],
      attending: [],
    },
  );

const buildPayload = (records) => ({
  interactions: buildInteractionSummary(records),
  records: records.map((record) => serializeInteraction(record)),
});

router.get("/", protect, async (req, res) => {
  try {
    const records = await UserEventInteraction.find({ userId: req.user._id }).sort({
      updatedAt: -1,
    });

    res.json({ success: true, data: buildPayload(records) });
  } catch (error) {
    console.error("Interaction fetch error:", error);
    res.status(500).json({ message: "Server error while loading interactions." });
  }
});

router.get("/public/:username/attending", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim().toLowerCase();

    if (!username) {
      return res.status(400).json({ message: "Username is required." });
    }

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const records = await UserEventInteraction.find({
      userId: user._id,
      attending: true,
    }).sort({
      updatedAt: -1,
    });

    res.json({
      success: true,
      data: {
        records: records.map((record) => serializeInteraction(record)),
      },
    });
  } catch (error) {
    console.error("Public attending interactions fetch error:", error);
    res.status(500).json({ message: "Server error while loading attending events." });
  }
});

router.put("/:eventId", protect, async (req, res) => {
  try {
    const eventId = pickString(req.params.eventId, req.body.eventId);

    if (!eventId) {
      return res.status(400).json({ message: "Event id is required." });
    }

    const nextState = {
      hearted: normalizeFlag(req.body.hearted),
      saved: normalizeFlag(req.body.saved),
      attending: normalizeFlag(req.body.attending),
    };
    const hasActiveInteraction = Object.values(nextState).some(Boolean);

    if (!hasActiveInteraction) {
      await UserEventInteraction.findOneAndDelete({
        userId: req.user._id,
        eventId,
      });

      const remainingRecords = await UserEventInteraction.find({ userId: req.user._id }).sort({
        updatedAt: -1,
      });

      return res.json({ success: true, data: buildPayload(remainingRecords) });
    }

    await UserEventInteraction.findOneAndUpdate(
      {
        userId: req.user._id,
        eventId,
      },
      {
        userId: req.user._id,
        eventId,
        ...nextState,
        title: pickString(req.body.title, req.body.event?.title),
        location: pickString(req.body.location, req.body.event?.location),
        date: pickString(req.body.date, req.body.event?.date, req.body.event?.startDate),
        time: pickString(req.body.time, req.body.event?.time, req.body.event?.timeLabel),
        category: pickString(req.body.category, req.body.event?.category),
        description: pickString(req.body.description, req.body.event?.description),
        imageUrl: pickString(req.body.imageUrl, req.body.event?.imageUrl, req.body.event?.image),
        eventUrl: pickString(req.body.eventUrl, req.body.event?.eventUrl),
        province: pickString(req.body.province, req.body.event?.province),
        host: pickString(req.body.host, req.body.event?.host),
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    );

    const records = await UserEventInteraction.find({ userId: req.user._id }).sort({
      updatedAt: -1,
    });

    res.json({ success: true, data: buildPayload(records) });
  } catch (error) {
    console.error("Interaction update error:", error);
    res.status(500).json({ message: "Server error while updating interactions." });
  }
});

export default router;
