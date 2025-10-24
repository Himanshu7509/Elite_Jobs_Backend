import express from 'express';
import { signup, login, getProfile, updateProfile, deleteProfile } from '../controllers/auth.controller.js';
import { uploadFile, updateProfileWithFile, uploadMultipleFiles, updateProfilePicture, updateResume, updateCompanyLogo } from '../controllers/file.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import upload from '../config/multer.js';

const authRouter = express.Router();

// Public routes
authRouter.post('/signup', signup);
authRouter.post('/login', login);

// Protected routes
authRouter.get('/profile', authMiddleware, getProfile);
authRouter.patch('/profile', authMiddleware, updateProfile);
authRouter.delete('/profile', authMiddleware, deleteProfile);

// Dedicated file update routes
authRouter.put('/profile/photo', authMiddleware, upload.single('photo'), updateProfilePicture);
authRouter.put('/profile/resume', authMiddleware, upload.single('resume'), updateResume);
authRouter.put('/profile/company-logo', authMiddleware, upload.single('companyLogo'), updateCompanyLogo);

// File upload routes with specific validation
authRouter.post('/profile/upload-multiple', authMiddleware, upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
  { name: 'companyLogo', maxCount: 1 }
]), uploadMultipleFiles);

// Legacy routes (keeping for backward compatibility)
authRouter.post('/profile/resume', authMiddleware, upload.single('resume'), updateProfileWithFile);
authRouter.post('/profile/photo', authMiddleware, upload.single('photo'), updateProfileWithFile);
authRouter.post('/profile/company-logo', authMiddleware, upload.single('companyLogo'), updateProfileWithFile);
authRouter.post('/profile/upload', authMiddleware, upload.single('file'), updateProfileWithFile);

export default authRouter;