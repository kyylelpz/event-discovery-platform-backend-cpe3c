import mongoose from "mongoose";
import { userDB } from "../routes/db.js";

const userEventInteractionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    hearted: {
      type: Boolean,
      default: false,
    },
    saved: {
      type: Boolean,
      default: false,
    },
    attending: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    date: {
      type: String,
      default: "",
    },
    time: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    eventUrl: {
      type: String,
      default: "",
    },
    province: {
      type: String,
      default: "",
    },
    host: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "user_event_interactions",
  },
);

userEventInteractionSchema.index({ userId: 1, eventId: 1 }, { unique: true });

export default userDB.models.UserEventInteraction || userDB.model("UserEventInteraction", userEventInteractionSchema);
