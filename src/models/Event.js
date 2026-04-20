import { eventDB } from "../routes/db.js";
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({

  title: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  venue_id: { type: mongoose.Schema.Types.ObjectId, ref: "Venue" },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  api_source: { type: String },
  image: { type: String },
  tickets_info: { type: String },
}, { timestamps: true });

export default eventDB.model("Event", eventSchema);
