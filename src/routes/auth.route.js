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
  resetPassword,
  resendOTP,
  googleSignup,
  googleLogin
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

console.log('=== LOADING AUTH ROUTES ===');

const authRouter = express.Router();

// Add logging middleware to see all requests to auth routes
authRouter.use((req, res, next) => {
  console.log('=== AUTH ROUTER REQUEST ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Full URL:', req.originalUrl);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  next();
});

// Public routes
console.log('Setting up /signup route');
authRouter.post('/signup', signup);
console.log('Setting up /login route');
authRouter.post('/login', login);
console.log('Setting up /forgot-password route');
authRouter.post('/forgot-password', forgotPassword);
console.log('Setting up /verify-otp route');
authRouter.post('/verify-otp', verifyOTP);
console.log('Setting up /reset-password route');
authRouter.post('/reset-password', resetPassword);
console.log('Setting up /resend-otp route');
authRouter.post('/resend-otp', resendOTP);
console.log('Setting up /google-signup route');
authRouter.post('/google-signup', googleSignup);
console.log('Setting up /google-login route');
authRouter.post('/google-login', googleLogin);
console.log('Setting up /profile-options route');
authRouter.get('/profile-options', getProfileEnumOptions);

// Protected routes
console.log('Setting up /profile GET route');
authRouter.get('/profile', authMiddleware, getProfile);
console.log('Setting up /profile PUT route');
authRouter.put('/profile', authMiddleware, updateProfile);
console.log('Setting up /profile DELETE route');
authRouter.delete('/profile', authMiddleware, deleteProfile);

// File upload routes
console.log('Setting up /profile/photo PUT route');
authRouter.put('/profile/photo', authMiddleware, upload.single('photo'), updateProfilePicture);
console.log('Setting up /profile/resume PUT route');
authRouter.put('/profile/resume', authMiddleware, upload.single('resume'), updateResume);
console.log('Setting up /profile/company-logo PUT route');
authRouter.put('/profile/company-logo', authMiddleware, upload.single('companyLogo'), updateCompanyLogo);
console.log('Setting up /profile/company-document POST route');
authRouter.post('/profile/company-document', authMiddleware, upload.single('companyDocument'), uploadCompanyDocument);
console.log('Setting up /profile/company-document PUT route');
authRouter.put('/profile/company-document', authMiddleware, upload.single('companyDocument'), updateCompanyDocument);
console.log('Setting up /profile/company-document DELETE route');
authRouter.delete('/profile/company-document', authMiddleware, deleteCompanyDocument);
console.log('Setting up /upload-multiple POST route');
authRouter.post('/upload-multiple', authMiddleware, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
  { name: 'companyLogo', maxCount: 1 },
  { name: 'companyDocument', maxCount: 5 }
]), uploadMultipleFiles);
console.log('Setting up /job/:jobId/company-logo PUT route');
authRouter.put('/job/:jobId/company-logo', authMiddleware, upload.single('companyLogo'), uploadJobCompanyLogo);

export default authRouter;