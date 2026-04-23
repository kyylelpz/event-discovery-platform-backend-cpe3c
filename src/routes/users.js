import express from "express";
import CreatedEvent from "../models/CreatedEvent.js";
import MockEvent from "../models/MockEvent.js";
import MockUser from "../models/MockUser.js";
import protect from "../middleware/protect.js";
import User from "../models/User.js";
import { ensureMockEventCatalogSeeded } from "../services/mockEventCatalog.js";
import { ensureMockUserCatalogSeeded } from "../services/mockUserCatalog.js";
import { serializePublicUser, serializeUser } from "../utils/userHelpers.js";

const router = express.Router();

const buildCreatedEventCountMap = async () => {
  const [createdRows, mockRows] = await Promise.all([
const buildCreatedEventCountMaps = async () => {
  const [createdEventRows, mockEventRows] = await Promise.all([
    CreatedEvent.aggregate([
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
        },
      },
    ]),
    MockEvent.aggregate([
      {
        $group: {
          _id: "$hostUserId",
        $match: {
          source: "mock",
          createdBy: { $exists: true, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$createdBy",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  return new Map([
    ...createdRows.map((row) => [String(row._id), Number(row.count || 0)]),
    ...mockRows.map((row) => [String(row._id), Number(row.count || 0)]),
  ]);
  return {
    realByUserId: new Map(createdEventRows.map((row) => [String(row._id), row.count])),
    mockByUsername: new Map(
      mockEventRows.map((row) => [String(row._id || "").trim().toLowerCase(), row.count]),
    ),
  };
};

const getCreatedEventsCountForUser = (user, createdEventCountMaps) => {
  const source = String(user?.source || "").trim().toLowerCase();

  if (source === "mock") {
    const username = String(user?.username || "").trim().toLowerCase();
    return createdEventCountMaps.mockByUsername.get(username) || 0;
  }

  return createdEventCountMaps.realByUserId.get(String(user?._id || "")) || 0;
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
    const [users, mockUsers, createdEventCountMap] = await Promise.all([
      User.find({}).sort({ updatedAt: -1, createdAt: -1, name: 1 }),
      MockUser.find({}).sort({ updatedAt: -1, createdAt: -1, name: 1 }),
      buildCreatedEventCountMap(),
    await Promise.all([ensureMockUserCatalogSeeded(), ensureMockEventCatalogSeeded()]);

    const [users, createdEventCountMaps] = await Promise.all([
      User.find({}).sort({ updatedAt: -1, createdAt: -1, name: 1 }),
      buildCreatedEventCountMaps(),
    ]);

    const mergedUsers = [
      ...users.map((user) =>
        serializePublicUser(user, {
          createdEventsCount: createdEventCountMap.get(String(user._id)) || 0,
          isMock: false,
          createdEventsCount: getCreatedEventsCountForUser(user, createdEventCountMaps),
        }),
      ),
      ...mockUsers.map((user) =>
        serializePublicUser(user, {
          createdEventsCount: createdEventCountMap.get(String(user._id)) || 0,
          followersCount: 0,
          followingCount: 0,
          isMock: true,
        }),
      ),
    ];

    res.json({ users: mergedUsers });
  } catch (error) {
    console.error("User directory fetch error:", error);
    res.status(500).json({ message: "Server error while loading users." });
  }
});

router.post("/:username/follow", protect, async (req, res) => {
  try {
    await Promise.all([ensureMockUserCatalogSeeded(), ensureMockEventCatalogSeeded()]);

    const username = String(req.params.username || "").trim().toLowerCase();

    if (!username) {
      return res.status(400).json({ message: "Username is required." });
    }

    const [currentUser, targetUser, mockTargetUser] = await Promise.all([
      User.findById(req.user._id),
      User.findOne({ username }),
      MockUser.findOne({ username }),
    ]);

    if (!currentUser) {
      return res.status(401).json({ message: "User no longer exists." });
    }

    if (mockTargetUser) {
      return res.status(400).json({ message: "Mock community accounts are read-only." });
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

    const createdEventCountMaps = await buildCreatedEventCountMaps();

    res.json({
      success: true,
      currentUser: serializeUser(currentUser, {
        createdEventsCount: getCreatedEventsCountForUser(currentUser, createdEventCountMaps),
        ...buildConnectionStats(currentUser),
      }),
      targetUser: serializePublicUser(targetUser, {
        createdEventsCount: getCreatedEventsCountForUser(targetUser, createdEventCountMaps),
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
    await Promise.all([ensureMockUserCatalogSeeded(), ensureMockEventCatalogSeeded()]);

    const username = String(req.params.username || "").trim().toLowerCase();

    if (!username) {
      return res.status(400).json({ message: "Username is required." });
    }

    const [currentUser, targetUser, mockTargetUser] = await Promise.all([
      User.findById(req.user._id),
      User.findOne({ username }),
      MockUser.findOne({ username }),
    ]);

    if (!currentUser) {
      return res.status(401).json({ message: "User no longer exists." });
    }

    if (mockTargetUser) {
      return res.status(400).json({ message: "Mock community accounts are read-only." });
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

    const createdEventCountMaps = await buildCreatedEventCountMaps();

    res.json({
      success: true,
      currentUser: serializeUser(currentUser, {
        createdEventsCount: getCreatedEventsCountForUser(currentUser, createdEventCountMaps),
        ...buildConnectionStats(currentUser),
      }),
      targetUser: serializePublicUser(targetUser, {
        createdEventsCount: getCreatedEventsCountForUser(targetUser, createdEventCountMaps),
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
