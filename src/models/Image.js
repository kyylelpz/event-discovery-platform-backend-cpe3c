const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  title: String,
  imageUrl: String,    // This stores the link from Cloudinary
  cloudinaryId: String // Useful if you ever need to delete the image later
});

module.exports = mongoose.model('Image', imageSchema);
