import express from "express";
import CreatedEvent from "../models/CreatedEvent.js";
import protect from "../middleware/protect.js";
import User from "../models/User.js";
import {
  normalizeInterestList,
  serializePublicUser,
  serializeUser,
} from "../utils/userHelpers.js";

const router = express.Router();

const getCreatedEventsCount = async (userId) =>
  CreatedEvent.countDocuments({ userId });

const findUserByUsername = async (username) =>
  User.findOne({
    username: String(username || "").trim().toLowerCase(),
  });

const sendCurrentProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const createdEventsCount = await getCreatedEventsCount(user._id);

  res.json({
    user: serializeUser(user, { createdEventsCount }),
  });
};

const updateCurrentProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (typeof req.body.name === "string") {
      user.name = req.body.name.trim() || user.name;
    }

    if (typeof req.body.username === "string") {
      const nextUsername = req.body.username.trim().toLowerCase();

      if (nextUsername && nextUsername !== user.username) {
        const existingUser = await User.findOne({
          username: nextUsername,
          _id: { $ne: user._id },
        });

        if (existingUser) {
          return res.status(400).json({ message: "That username is already in use." });
        }

        user.username = nextUsername;
      }
    }

    if (typeof req.body.location === "string") {
      user.location = req.body.location.trim() || "Philippines";
    }

    if (typeof req.body.phone === "string") {
      user.phone = req.body.phone.trim();
    }

    if (typeof req.body.bio === "string") {
      user.bio = req.body.bio.trim();
    }

    if (typeof req.body.profilePic === "string") {
      user.avatar = req.body.profilePic.trim();
    }

    if (typeof req.body.avatar === "string") {
      user.avatar = req.body.avatar.trim();
    }

    if (Array.isArray(req.body.interests)) {
      user.interests = normalizeInterestList(req.body.interests);
    }

    await user.save();
    const createdEventsCount = await getCreatedEventsCount(user._id);

    res.json({
      message: "Profile updated successfully.",
      user: serializeUser(user, { createdEventsCount }),
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error while updating profile." });
  }
};

router.get("/", protect, sendCurrentProfile);
router.get("/me", protect, sendCurrentProfile);

router.put("/", protect, updateCurrentProfile);
router.put("/me", protect, updateCurrentProfile);

router.get("/:username", async (req, res) => {
  try {
    const user = await findUserByUsername(req.params.username);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const createdEventsCount = await getCreatedEventsCount(user._id);

    res.json({
      user: serializePublicUser(user, { createdEventsCount }),
    });
  } catch (error) {
    console.error("Public profile fetch error:", error);
    res.status(500).json({ message: "Server error while loading profile." });
  }
});

export default router;
