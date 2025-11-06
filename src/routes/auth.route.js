import express from 'express';
import { 
  signup, 
  login, 
  getProfile, 
  updateProfile, 
  deleteProfile,
  getProfileEnumOptions
} from '../controllers/auth.controller.js';
import { 
  updateProfileWithFile,
  updateProfilePicture,
  updateResume,
  updateCompanyLogo,
  uploadCompanyDocument,
  deleteCompanyDocument
} from '../controllers/file.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import upload from '../config/multer.js';

const authRouter = express.Router();

// Public routes
authRouter.post('/signup', signup);
authRouter.post('/login', login);
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
authRouter.delete('/profile/company-document', authMiddleware, deleteCompanyDocument);

export default authRouter;