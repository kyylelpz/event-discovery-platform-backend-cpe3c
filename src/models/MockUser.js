import mongoose from "mongoose";
import { userDB } from "../routes/db.js";

const mockUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    avatar: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "Philippines",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    bio: {
      type: String,
      default: "",
      trim: true,
    },
    interests: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "mock_users",
  },
);

export default userDB.models.MockUser || userDB.model("MockUser", mockUserSchema);
