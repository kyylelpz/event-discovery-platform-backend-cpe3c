import mongoose from "mongoose";
import { eventDB } from "../routes/db.js";

const venueSchema = new mongoose.Schema({
  venue_name: { type: String, required: true },
  description: String,
  location: String,
  google_maps_link: String,
});

export default eventDB.model("Venue", venueSchema);
