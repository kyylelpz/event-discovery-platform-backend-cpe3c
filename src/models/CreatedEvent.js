import mongoose from "mongoose";
import { eventDB } from "../routes/db.js";

const createdEventSchema = new mongoose.Schema(
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
    source: {
      type: String,
      default: "website",
    },
    status: {
      type: String,
      default: "draft",
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true, collection: "created_events" },
);

export default eventDB.models.CreatedEvent || eventDB.model("CreatedEvent", createdEventSchema);
