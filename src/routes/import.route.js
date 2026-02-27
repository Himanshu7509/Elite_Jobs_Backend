import express from 'express';
import { 
  importJobSeekers,
  getImportedJobSeekers,
  sendWelcomeEmails,
  getImportStatistics
} from '../controllers/import.controller.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware.js';
import upload from '../config/multer.js';

const importRouter = express.Router();

// Protected routes - Admin only
importRouter.post('/jobseekers', 
  authMiddleware, 
  authorizeRole('admin'), 
  upload.single('excelFile'), 
  importJobSeekers
);

importRouter.get('/jobseekers', 
  authMiddleware, 
  authorizeRole('admin'), 
  getImportedJobSeekers
);

importRouter.post('/jobseekers/welcome-emails', 
  authMiddleware, 
  authorizeRole('admin'), 
  sendWelcomeEmails
);

importRouter.get('/statistics', 
  authMiddleware, 
  authorizeRole('admin'), 
  getImportStatistics
);

export default importRouter;