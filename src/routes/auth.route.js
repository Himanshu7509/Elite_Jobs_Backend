import express from 'express';
import { 
  signup, 
  login, 
  getProfile, 
  updateProfile, 
  deleteProfile,
  getProfileEnumOptions,
  forgotPassword,
  verifyOTP,
  resetPassword
} from '../controllers/auth.controller.js';
import { 
  updateProfileWithFile,
  updateProfilePicture,
  updateResume,
  updateCompanyLogo,
  uploadJobCompanyLogo,
  uploadCompanyDocument,
  updateCompanyDocument,
  deleteCompanyDocument,
  uploadMultipleFiles
} from '../controllers/file.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import upload from '../config/multer.js';

const authRouter = express.Router();

// Public routes
authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.post('/forgot-password', forgotPassword);
authRouter.post('/verify-otp', verifyOTP);
authRouter.post('/reset-password', resetPassword);
authRouter.get('/profile-options', getProfileEnumOptions);

// Protected routes
authRouter.get('/profile', authMiddleware, getProfile);
authRouter.put('/profile', authMiddleware, updateProfile);
authRouter.delete('/profile', authMiddleware, deleteProfile);

// File upload routes
authRouter.put('/profile/photo', authMiddleware, upload.single('photo'), updateProfilePicture);
authRouter.put('/profile/resume', authMiddleware, upload.single('resume'), updateResume);
authRouter.put('/profile/company-logo', authMiddleware, upload.single('companyLogo'), updateCompanyLogo);
authRouter.post('/profile/company-document', authMiddleware, upload.single('companyDocument'), uploadCompanyDocument);
authRouter.put('/profile/company-document', authMiddleware, upload.single('companyDocument'), updateCompanyDocument);
authRouter.delete('/profile/company-document', authMiddleware, deleteCompanyDocument);
authRouter.post('/upload-multiple', authMiddleware, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
  { name: 'companyLogo', maxCount: 1 },
  { name: 'companyDocument', maxCount: 5 }
]), uploadMultipleFiles);
authRouter.put('/job/:jobId/company-logo', authMiddleware, upload.single('companyLogo'), uploadJobCompanyLogo);

export default authRouter;