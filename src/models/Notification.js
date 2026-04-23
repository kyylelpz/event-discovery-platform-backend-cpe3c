import mongoose from "mongoose";
import { userDB } from "../routes/db.js";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    body: {
      type: String,
      default: "",
      trim: true,
    },
    eventId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    username: {
      type: String,
      default: "",
      trim: true,
    },
    profilePic: {
      type: String,
      default: "",
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "notifications",
  },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export default userDB.models.Notification || userDB.model("Notification", notificationSchema);
