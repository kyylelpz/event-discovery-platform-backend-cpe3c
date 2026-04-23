import express from "express";
import CreatedEvent from "../models/CreatedEvent.js";
import protect from "../middleware/protect.js";
import User from "../models/User.js";
import { serializePublicUser, serializeUser } from "../utils/userHelpers.js";

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

router.post("/:username/follow", protect, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim().toLowerCase();

    if (!username) {
      return res.status(400).json({ message: "Username is required." });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.user._id),
      User.findOne({ username }),
    ]);

    if (!currentUser) {
      return res.status(401).json({ message: "User no longer exists." });
    }

    if (!targetUser) {
      return res.status(404).json({ message: "User not found." });
    }

    if (String(currentUser._id) === String(targetUser._id)) {
      return res.status(400).json({ message: "You cannot follow yourself." });
    }

    const isAlreadyFollowing = currentUser.following.some(
      (followedUserId) => String(followedUserId) === String(targetUser._id),
    );

    if (!isAlreadyFollowing) {
      currentUser.following.push(targetUser._id);
    }

    const isAlreadyFollower = targetUser.followers.some(
      (followerUserId) => String(followerUserId) === String(currentUser._id),
    );

    if (!isAlreadyFollower) {
      targetUser.followers.push(currentUser._id);
    }

    await Promise.all([currentUser.save(), targetUser.save()]);
    await currentUser.populate("followers", "username");
    await currentUser.populate("following", "username");

    const createdEventCountMap = await buildCreatedEventCountMap();

    res.json({
      success: true,
      currentUser: serializeUser(currentUser, {
        createdEventsCount: createdEventCountMap.get(String(currentUser._id)) || 0,
        ...buildConnectionStats(currentUser),
      }),
      targetUser: serializePublicUser(targetUser, {
        createdEventsCount: createdEventCountMap.get(String(targetUser._id)) || 0,
        followersCount: targetUser.followers?.length || 0,
        followingCount: targetUser.following?.length || 0,
      }),
    });
  } catch (error) {
    console.error("Follow user error:", error);
    res.status(500).json({ message: "Server error while following user." });
  }
});

router.delete("/:username/follow", protect, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim().toLowerCase();

    if (!username) {
      return res.status(400).json({ message: "Username is required." });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.user._id),
      User.findOne({ username }),
    ]);

    if (!currentUser) {
      return res.status(401).json({ message: "User no longer exists." });
    }

    if (!targetUser) {
      return res.status(404).json({ message: "User not found." });
    }

    currentUser.following = currentUser.following.filter(
      (followedUserId) => String(followedUserId) !== String(targetUser._id),
    );
    targetUser.followers = targetUser.followers.filter(
      (followerUserId) => String(followerUserId) !== String(currentUser._id),
    );

    await Promise.all([currentUser.save(), targetUser.save()]);
    await currentUser.populate("followers", "username");
    await currentUser.populate("following", "username");

    const createdEventCountMap = await buildCreatedEventCountMap();

    res.json({
      success: true,
      currentUser: serializeUser(currentUser, {
        createdEventsCount: createdEventCountMap.get(String(currentUser._id)) || 0,
        ...buildConnectionStats(currentUser),
      }),
      targetUser: serializePublicUser(targetUser, {
        createdEventsCount: createdEventCountMap.get(String(targetUser._id)) || 0,
        followersCount: targetUser.followers?.length || 0,
        followingCount: targetUser.following?.length || 0,
      }),
    });
  } catch (error) {
    console.error("Unfollow user error:", error);
    res.status(500).json({ message: "Server error while unfollowing user." });
  }
});

export default router;
