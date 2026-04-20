import mongoose from "mongoose";

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
    imageUrl: { type: String },
    eventUrl: { type: String },
  },
  { timestamps: true },
);

export default mongoose.model("SavedEvent", SavedEventSchema);
