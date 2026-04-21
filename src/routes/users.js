import express from "express";
import CreatedEvent from "../models/CreatedEvent.js";
import User from "../models/User.js";
import { serializePublicUser } from "../utils/userHelpers.js";

const router = express.Router();

const buildCreatedEventCountMap = async () => {
  const rows = await CreatedEvent.aggregate([
    {
      $group: {
        _id: "$userId",
        count: { $sum: 1 },
      },
    },
  ]);

  return new Map(rows.map((row) => [String(row._id), row.count]));
};

router.get("/", async (req, res) => {
  try {
    const [users, createdEventCountMap] = await Promise.all([
      User.find({}).sort({ updatedAt: -1, createdAt: -1, name: 1 }),
      buildCreatedEventCountMap(),
    ]);

    res.json({
      users: users.map((user) =>
        serializePublicUser(user, {
          createdEventsCount: createdEventCountMap.get(String(user._id)) || 0,
        }),
      ),
    });
  } catch (error) {
    console.error("User directory fetch error:", error);
    res.status(500).json({ message: "Server error while loading users." });
  }
});

export default router;
