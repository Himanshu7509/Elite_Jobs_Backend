import express from 'express';
import {
  createJobDirect,
  getAllApplicants,
  deleteUserAccount,
  getAllJobs
} from '../controllers/admin.controller.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware.js';

const adminRouter = express.Router();

// Protected routes - Admin only
adminRouter.post('/jobs', authMiddleware, authorizeRole('admin'), createJobDirect);
adminRouter.get('/applicants', authMiddleware, authorizeRole('admin'), getAllApplicants);
adminRouter.delete('/users/:userId', authMiddleware, authorizeRole('admin'), deleteUserAccount);
adminRouter.get('/jobs', authMiddleware, authorizeRole('admin'), getAllJobs);

export default adminRouter;