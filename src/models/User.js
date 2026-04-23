import mongoose from "mongoose";
import { userDB } from "../routes/db.js"; 

const userSchema = new mongoose.Schema(
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
      required: true,
      lowercase: true,
      trim: true,
      unique: true
    },

    // only for local accounts
    password: {
      type: String 
    },

    // auth source
    provider: {
      type: String,
      enum: ["local", "google"],
      required: true
    },

    // only for Google accounts
    googleId: {
      type: String,
      unique: true,
      sparse: true
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
    followers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    following: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    isEmailVerified: {
      type: Boolean,
      default: false 
    },
    emailVerificationCode: {
      type: String,
      default: "",
    },
    emailVerificationExpiresAt: {
      type: Date,
      default: null,
    },
    passwordResetCode: {
      type: String,
      default: "",
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);


export default userDB.models.User || userDB.model("User", userSchema);
