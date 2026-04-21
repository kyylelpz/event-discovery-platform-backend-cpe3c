import express from "express";
import protect from "../middleware/protect.js";
import User from "../models/User.js";
import {
  normalizeInterestList,
  serializeUser,
} from "../utils/userHelpers.js";

const router = express.Router();

router.get("/", protect, async (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

router.put("/", protect, async (req, res) => {
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

    res.json({
      message: "Profile updated successfully.",
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error while updating profile." });
  }
});

export default router;
