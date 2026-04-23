import express from "express";
import CreatedEvent from "../models/CreatedEvent.js";
import protect from "../middleware/protect.js";
import User from "../models/User.js";
import {
  getUsernameValidationError,
  normalizeUsername,
  normalizeInterestList,
  serializePublicUser,
  serializeUser,
} from "../utils/userHelpers.js";
import { cloudinary, upload } from "../utils/cloudinary.js";

const router = express.Router();

const getCreatedEventsCount = async (userId) =>
  CreatedEvent.countDocuments({ userId });

const buildConnectionStats = (user) => ({
  followersCount: Array.isArray(user?.followers) ? user.followers.length : 0,
  followingCount: Array.isArray(user?.following) ? user.following.length : 0,
  followerUsernames: Array.isArray(user?.followers)
    ? user.followers
        .map((entry) =>
          typeof entry === "object" && entry !== null
            ? String(entry.username || "").trim().toLowerCase()
            : "",
        )
        .filter(Boolean)
    : [],
  followingUsernames: Array.isArray(user?.following)
    ? user.following
        .map((entry) =>
          typeof entry === "object" && entry !== null
            ? String(entry.username || "").trim().toLowerCase()
            : "",
        )
        .filter(Boolean)
    : [],
});

const findUserByUsername = async (username) =>
  User.findOne({
    username: String(username || "").trim().toLowerCase(),
  });

const sendCurrentProfile = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate("followers", "username")
    .populate("following", "username");

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const createdEventsCount = await getCreatedEventsCount(user._id);
  const connectionStats = buildConnectionStats(user);

  res.json({
    user: serializeUser(user, { createdEventsCount, ...connectionStats }),
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
      const nextUsername = normalizeUsername(req.body.username);
      const usernameError = getUsernameValidationError(nextUsername);

      if (usernameError) {
        return res.status(400).json({ message: usernameError });
      }

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

    if (typeof req.body.contact === "string") {
      user.phone = req.body.contact.trim();
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

    if (req.file?.buffer) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "eventcinity/profile-pictures",
            public_id: `user-${user._id}-${Date.now()}`,
            resource_type: "image",
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(result);
          },
        );

        stream.end(req.file.buffer);
      });

      user.avatar = String(uploadResult?.secure_url || "").trim() || user.avatar;
    }

    if (Array.isArray(req.body.interests)) {
      user.interests = normalizeInterestList(req.body.interests);
    }

    await user.save();
    await user.populate("followers", "username");
    await user.populate("following", "username");
    const createdEventsCount = await getCreatedEventsCount(user._id);
    const connectionStats = buildConnectionStats(user);

    res.json({
      message: "Profile updated successfully.",
      user: serializeUser(user, { createdEventsCount, ...connectionStats }),
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error while updating profile." });
  }
};

router.get("/", protect, sendCurrentProfile);
router.get("/me", protect, sendCurrentProfile);

router.put("/", protect, upload.single("avatar"), updateCurrentProfile);
router.put("/me", protect, upload.single("avatar"), updateCurrentProfile);

router.get("/:username", async (req, res) => {
  try {
    const user = await findUserByUsername(req.params.username);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const createdEventsCount = await getCreatedEventsCount(user._id);

    res.json({
      user: serializePublicUser(user, {
        createdEventsCount,
        followersCount: user.followers?.length || 0,
        followingCount: user.following?.length || 0,
      }),
    });
  } catch (error) {
    console.error("Public profile fetch error:", error);
    res.status(500).json({ message: "Server error while loading profile." });
  }
});

export default router;
