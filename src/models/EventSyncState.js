import mongoose from "mongoose";
import { eventDB } from "../routes/db.js";

const eventSyncStateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    budgetDate: {
      type: String,
      default: "",
      trim: true,
    },
    creditsUsedToday: {
      type: Number,
      default: 0,
      min: 0,
    },
    attemptedSearchKeys: {
      type: [String],
      default: [],
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    lastSuccessAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
    lastQuery: {
      type: String,
      default: "",
    },
    lastResultCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastFetchedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastInsertedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUpdatedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPageStarts: {
      type: [Number],
      default: [],
    },
    lastSearchPlans: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    nextScheduledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, collection: "event_sync_state" },
);

export default eventDB.models.EventSyncState ||
  eventDB.model("EventSyncState", eventSyncStateSchema);
