const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// 1. Configure Cloudinary with your .env credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Set up Multer (using memory storage for direct upload)
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = { cloudinary, upload };
