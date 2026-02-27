import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// Memory storage for multer (store file in memory as Buffer)
const storage = multer.memoryStorage();

// Generic file filter
const fileFilter = function (req, file, cb) {
  // Accept images, PDFs, Excel files, and JSON files
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/json' // .json
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, PDF, Excel, and JSON files are allowed.'));
  }
};

// Configure multer with generic settings
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // Limit file size to 10MB
  },
  fileFilter: fileFilter
});

export default upload;
