import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (_req, file, callback) => {
  if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) {
    return callback(new Error("Only image and video uploads are allowed"));
  }

  return callback(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

export const uploadImages = upload.any();
