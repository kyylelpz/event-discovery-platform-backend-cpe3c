import mongoose from "mongoose";
import { eventDB } from "../routes/db.js";

const mockUserSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    username: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },
    avatar: String,
    location: {
      type: String,
      trim: true,
      default: "Philippines",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    bio: {
      type: String,
      trim: true,
      default: "",
    },
    interests: {
      type: [String],
      default: [],
    },
    source: {
      type: String,
      default: "mock",
      trim: true,
    },
    isMock: {
      type: Boolean,
      default: true,
    },
    lastSeededAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "mock_users",
  },
);

export default eventDB.models.MockUser || eventDB.model("MockUser", mockUserSchema);
