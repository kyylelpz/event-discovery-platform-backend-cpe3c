import mongoose from "mongoose";
import { eventDB } from "../routes/db.js";

const createdEventSchema = new mongoose.Schema(
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
      unique: true,
      index: true,
      trim: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    creatorName: {
      type: String,
      default: "",
      trim: true,
    },
    creatorAvatar: {
      type: String,
      default: "",
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
    venueGoogleMapsUrl: {
      type: String,
      default: "",
    },
    venuePlaceId: {
      type: String,
      default: "",
    },
    venueRating: {
      type: Number,
      default: 0,
    },
    venueReviewCount: {
      type: Number,
      default: 0,
    },
    venueCoordinates: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
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
    source: {
      type: String,
      default: "website",
    },
    status: {
      type: String,
      default: "published",
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true, collection: "created_events" },
);

export default eventDB.models.CreatedEvent || eventDB.model("CreatedEvent", createdEventSchema);
