import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const DEFAULT_EVENT_IMAGE_FILE_SIZE_MB = 8;
const DEFAULT_AVATAR_FILE_SIZE_MB = 5;

const readUploadSizeInBytes = (value, fallbackInMegabytes) => {
  const parsedMegabytes = Number(value);

  if (!Number.isFinite(parsedMegabytes) || parsedMegabytes <= 0) {
    return fallbackInMegabytes * 1024 * 1024;
  }

  return Math.round(parsedMegabytes * 1024 * 1024);
};

const formatUploadLimit = (bytes) => {
  const megabytes = bytes / (1024 * 1024);
  return Number.isInteger(megabytes) ? `${megabytes}MB` : `${megabytes.toFixed(1)}MB`;
};

const createUploadError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeUploadError = (error, fieldLabel, fileSizeLimit) => {
  if (!error) {
    return null;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return createUploadError(
        `${fieldLabel} must be ${formatUploadLimit(fileSizeLimit)} or smaller.`,
        413,
      );
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return createUploadError(`Upload only one ${fieldLabel.toLowerCase()} file.`);
    }

    return createUploadError(error.message || "Upload failed.");
  }

  if (typeof error.status === "number") {
    return error;
  }

  return createUploadError(error.message || "Upload failed.");
};

const createSingleImageUpload = ({
  fieldName,
  fieldLabel,
  maxFileSizeBytes,
}) => {
  const uploader = multer({
    storage,
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1,
    },
    fileFilter(req, file, callback) {
      if (!IMAGE_MIME_TYPES.has(String(file?.mimetype || "").toLowerCase())) {
        callback(
          createUploadError(
            `${fieldLabel} must be a JPG, PNG, WEBP, or GIF image.`,
          ),
        );
        return;
      }

      callback(null, true);
    },
  });

  const singleUpload = uploader.single(fieldName);

  return (req, res, next) => {
    singleUpload(req, res, (error) => {
      next(normalizeUploadError(error, fieldLabel, maxFileSizeBytes));
    });
  };
};

const eventImageFileSizeLimit = readUploadSizeInBytes(
  process.env.EVENT_IMAGE_MAX_SIZE_MB,
  DEFAULT_EVENT_IMAGE_FILE_SIZE_MB,
);
const avatarFileSizeLimit = readUploadSizeInBytes(
  process.env.AVATAR_IMAGE_MAX_SIZE_MB,
  DEFAULT_AVATAR_FILE_SIZE_MB,
);

const uploadEventImage = createSingleImageUpload({
  fieldName: "image",
  fieldLabel: "Event image",
  maxFileSizeBytes: eventImageFileSizeLimit,
});
const uploadAvatarImage = createSingleImageUpload({
  fieldName: "avatar",
  fieldLabel: "Avatar image",
  maxFileSizeBytes: avatarFileSizeLimit,
});

export { cloudinary, uploadAvatarImage, uploadEventImage };
