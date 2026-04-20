import mongoose from "mongoose";
import { userDB } from "../routes/db.js";

const SavedEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    eventId: { type: String, required: true },
    title: { type: String },
    location: { type: String },
    date: { type: String },
    time: { type: String },
    category: { type: String },
    description: { type: String },
    imageUrl: { type: String },
    eventUrl: { type: String },
  },
  { timestamps: true },
);

export default userDB.model("SavedEvent", SavedEventSchema);
