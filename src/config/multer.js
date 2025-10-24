import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// Memory storage for multer (store file in memory as Buffer)
const storage = multer.memoryStorage();

// Generic file filter
const fileFilter = function (req, file, cb) {
  // Accept only image and PDF files
  if (
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/gif' ||
    file.mimetype === 'application/pdf'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'));
  }
};

// Configure multer with generic settings
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limit file size to 5MB
  },
  fileFilter: fileFilter
});

export default upload;
