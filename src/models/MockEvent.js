import mongoose from "mongoose";
import { eventDB } from "../routes/db.js";

const mockEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "Community",
    },
    province: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "Philippines",
    },
    venue: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    startDate: {
      type: String,
      default: "",
    },
    timeLabel: {
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
    organizer: {
      type: String,
      default: "",
    },
    createdBy: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    attendeeCount: {
      type: Number,
      default: 0,
    },
    savedCount: {
      type: Number,
      default: 0,
    },
    reactions: {
      type: Number,
      default: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      default: "mock",
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    lastSeededAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, collection: "mock_events" },
);

export default eventDB.models.MockEvent || eventDB.model("MockEvent", mockEventSchema);
