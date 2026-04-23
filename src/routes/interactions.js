import express from "express";
import protect from "../middleware/protect.js";
import UserEventInteraction from "../models/UserEventInteraction.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

const router = express.Router();
const SHARED_ATTENDANCE_TYPE = "shared-attendance";

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

const pickUserDisplayName = (user = {}) => {
  const name = String(user.name || "").trim();
  const username = String(user.username || "").trim();

  if (name) {
    return name;
  }

  if (username) {
    return username;
  }

  const emailPrefix = String(user.email || "").trim().split("@")[0];
  return emailPrefix || "Eventcinity user";
};

const buildConnectedUserIds = (user) => {
  const currentUserId = String(user?._id || "");

  return Array.from(
    new Set(
      [...(Array.isArray(user?.followers) ? user.followers : []), ...(Array.isArray(user?.following) ? user.following : [])]
        .map((value) => String(value || "").trim())
        .filter((value) => value && value !== currentUserId),
    ),
  );
};

const buildSharedAttendanceDedupeKey = ({ recipientUserId, actorUserId, eventId }) =>
  [SHARED_ATTENDANCE_TYPE, String(recipientUserId || ""), String(actorUserId || ""), String(eventId || "").trim()].join(":");

const removeSharedAttendanceNotifications = async ({ currentUser, eventId }) => {
  const normalizedEventId = pickString(eventId);

  if (!normalizedEventId || !currentUser?._id) {
    return;
  }

  const connectedUserIds = buildConnectedUserIds(currentUser);

  if (!connectedUserIds.length) {
    await Notification.deleteMany({
      type: SHARED_ATTENDANCE_TYPE,
      eventId: normalizedEventId,
      $or: [{ userId: currentUser._id }, { actorUserId: currentUser._id }],
    });
    return;
  }

  await Notification.deleteMany({
    type: SHARED_ATTENDANCE_TYPE,
    eventId: normalizedEventId,
    $or: [
      {
        userId: currentUser._id,
        actorUserId: { $in: connectedUserIds },
      },
      {
        actorUserId: currentUser._id,
        userId: { $in: connectedUserIds },
      },
    ],
  });
};

const syncSharedAttendanceNotifications = async ({ currentUser, eventId, eventTitle }) => {
  const normalizedEventId = pickString(eventId);

  if (!normalizedEventId || !currentUser?._id) {
    return;
  }

  const connectedUserIds = buildConnectedUserIds(currentUser);

  if (!connectedUserIds.length) {
    await removeSharedAttendanceNotifications({ currentUser, eventId: normalizedEventId });
    return;
  }

  const matchingInteractions = await UserEventInteraction.find({
    eventId: normalizedEventId,
    attending: true,
    userId: { $in: connectedUserIds },
  }).select("userId");
  const matchingUserIds = Array.from(
    new Set(
      matchingInteractions
        .map((record) => String(record.userId || "").trim())
        .filter(Boolean),
    ),
  );

  if (!matchingUserIds.length) {
    await removeSharedAttendanceNotifications({ currentUser, eventId: normalizedEventId });
    return;
  }

  const matchedUsers = await User.find({
    _id: { $in: matchingUserIds },
  }).select("name username email avatar");
  const matchedUserMap = new Map(
    matchedUsers.map((user) => [String(user._id), user]),
  );
  const currentUserLabel = pickUserDisplayName(currentUser);
  const safeEventTitle = pickString(eventTitle) || "this event";

  await Promise.all(
    matchingUserIds.flatMap((matchedUserId) => {
      const matchedUser = matchedUserMap.get(matchedUserId);

      if (!matchedUser) {
        return [];
      }

      const matchedUserLabel = pickUserDisplayName(matchedUser);
      const matchedUsername = String(matchedUser.username || "").trim().toLowerCase();
      const matchedAvatar = String(matchedUser.avatar || "").trim();
      const currentUsername = String(currentUser.username || "").trim().toLowerCase();
      const currentAvatar = String(currentUser.avatar || "").trim();

      return [
        Notification.findOneAndUpdate(
          {
            dedupeKey: buildSharedAttendanceDedupeKey({
              recipientUserId: currentUser._id,
              actorUserId: matchedUser._id,
              eventId: normalizedEventId,
            }),
          },
          {
            userId: currentUser._id,
            actorUserId: matchedUser._id,
            type: SHARED_ATTENDANCE_TYPE,
            dedupeKey: buildSharedAttendanceDedupeKey({
              recipientUserId: currentUser._id,
              actorUserId: matchedUser._id,
              eventId: normalizedEventId,
            }),
            title: matchedUserLabel,
            body: `Is also attending ${safeEventTitle}.`,
            eventId: normalizedEventId,
            username: matchedUsername,
            profilePic: matchedAvatar,
            isRead: false,
            readAt: null,
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            runValidators: true,
          },
        ),
        Notification.findOneAndUpdate(
          {
            dedupeKey: buildSharedAttendanceDedupeKey({
              recipientUserId: matchedUser._id,
              actorUserId: currentUser._id,
              eventId: normalizedEventId,
            }),
          },
          {
            userId: matchedUser._id,
            actorUserId: currentUser._id,
            type: SHARED_ATTENDANCE_TYPE,
            dedupeKey: buildSharedAttendanceDedupeKey({
              recipientUserId: matchedUser._id,
              actorUserId: currentUser._id,
              eventId: normalizedEventId,
            }),
            title: currentUserLabel,
            body: `Is also attending ${safeEventTitle}.`,
            eventId: normalizedEventId,
            username: currentUsername,
            profilePic: currentAvatar,
            isRead: false,
            readAt: null,
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            runValidators: true,
          },
        ),
      ];
    }),
  );
};

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

const serializeAttendingUser = (user, interaction) => {
  if (!user?._id) {
    return null;
  }

  return {
    id: String(user._id),
    username: String(user.username || "").trim().toLowerCase(),
    name: pickUserDisplayName(user),
    profilePic: String(user.avatar || "").trim(),
    attendedAt: interaction?.updatedAt || interaction?.createdAt || null,
  };
};

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

router.get("/:eventId/following-attendees", protect, async (req, res) => {
  try {
    const eventId = pickString(req.params.eventId, req.query.eventId);

    if (!eventId) {
      return res.status(400).json({ message: "Event id is required." });
    }

    const followingIds = Array.from(
      new Set(
        (Array.isArray(req.user?.following) ? req.user.following : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    );

    if (!followingIds.length) {
      return res.json({ success: true, data: [] });
    }

    const records = await UserEventInteraction.find({
      eventId,
      attending: true,
      userId: { $in: followingIds },
    })
      .sort({ updatedAt: -1 })
      .populate("userId", "name username email avatar");

    const attendees = records
      .map((record) => serializeAttendingUser(record.userId, record))
      .filter(Boolean);

    return res.json({ success: true, data: attendees });
  } catch (error) {
    console.error("Following attendees fetch error:", error);
    return res.status(500).json({
      message: "Server error while loading followed attendees for this event.",
    });
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
    const previousRecord = await UserEventInteraction.findOne({
      userId: req.user._id,
      eventId,
    });
    const wasAttending = Boolean(previousRecord?.attending);
    const eventTitle = pickString(req.body.title, req.body.event?.title, previousRecord?.title);

    if (!hasActiveInteraction) {
      await UserEventInteraction.findOneAndDelete({
        userId: req.user._id,
        eventId,
      });
      await removeSharedAttendanceNotifications({
        currentUser: req.user,
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

    if (nextState.attending && !wasAttending) {
      await syncSharedAttendanceNotifications({
        currentUser: req.user,
        eventId,
        eventTitle,
      });
    } else if (wasAttending && !nextState.attending) {
      await removeSharedAttendanceNotifications({
        currentUser: req.user,
        eventId,
      });
    }

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
