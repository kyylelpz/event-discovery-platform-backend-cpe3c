import mongoose from "mongoose";
import { eventDB } from "../routes/db.js";

const imageSchema = new mongoose.Schema({
  title: String,
  imageUrl: String,
  cloudinaryId: String,
});

export default eventDB.model("Image", imageSchema);
