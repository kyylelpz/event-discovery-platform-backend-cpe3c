import mongoose from "mongoose";
import { eventDB } from "../routes/db.js";

const venueSchema = new mongoose.Schema({
  venue_name: { type: String, required: true },
  description: String,
  location: String,
  google_maps_link: String,
  google_maps_place_id: String,
  rating: {
    type: Number,
    default: 0,
  },
  reviewCount: {
    type: Number,
    default: 0,
  },
  coordinates: {
    lat: {
      type: Number,
      default: null,
    },
    lng: {
      type: Number,
      default: null,
    },
  },
});

export default eventDB.models.Venue || eventDB.model("Venue", venueSchema);
