import mongoose from "mongoose";
import { userDB } from "../routes/db.js"; 

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
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
    isEmailVerified: {
      type: Boolean,
      default: false 
    }
  },
  { timestamps: true }
);


export default userDB.model("User", userSchema);