import express from "express";
import protect from "../middleware/protect.js";
import Notification from "../models/Notification.js";

const router = express.Router();

const serializeNotification = (notification) => ({
  id: String(notification._id),
  kind: String(notification.type || "").trim() || "notification",
  title: String(notification.title || "").trim(),
  body: String(notification.body || "").trim(),
  eventId: String(notification.eventId || "").trim(),
  username: String(notification.username || "").trim().toLowerCase(),
  profilePic: String(notification.profilePic || "").trim(),
  isRead: Boolean(notification.isRead),
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

router.get("/", protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ isRead: 1, createdAt: -1 })
      .limit(100);

    return res.json({
      success: true,
      data: notifications.map((notification) => serializeNotification(notification)),
    });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    return res
      .status(500)
      .json({ message: "Server error while loading notifications." });
  }
});

router.patch("/:notificationId/read", protect, async (req, res) => {
  try {
    const notificationId = String(req.params.notificationId || "").trim();

    if (!notificationId) {
      return res.status(400).json({ message: "Notification id is required." });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        userId: req.user._id,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        new: true,
      },
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    return res.json({
      success: true,
      data: serializeNotification(notification),
    });
  } catch (error) {
    console.error("Notification read update error:", error);
    return res
      .status(500)
      .json({ message: "Server error while updating the notification." });
  }
});

router.delete("/:notificationId", protect, async (req, res) => {
  try {
    const notificationId = String(req.params.notificationId || "").trim();

    if (!notificationId) {
      return res.status(400).json({ message: "Notification id is required." });
    }

    const deletedNotification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId: req.user._id,
    });

    if (!deletedNotification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Notification delete error:", error);
    return res
      .status(500)
      .json({ message: "Server error while removing the notification." });
  }
});

export default router;
