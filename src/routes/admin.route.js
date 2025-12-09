import express from 'express';
import {
  createJobDirect,
  getAllApplicants,
  deleteUserAccount,
  getAllJobs,
  getJobSeekerWithApplications,
  getAllJobSeekers,
  getUserStatistics // Import the new function
} from '../controllers/admin.controller.js';
import { getAllApplications } from '../controllers/recruiter.controller.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware.js';

const adminRouter = express.Router();

// Protected routes - Admin only
adminRouter.post('/jobs', authMiddleware, authorizeRole('admin'), createJobDirect);
adminRouter.delete('/users/:userId', authMiddleware, authorizeRole('admin'), deleteUserAccount);
adminRouter.get('/jobs', authMiddleware, authorizeRole('admin'), getAllJobs);
adminRouter.get('/applications', authMiddleware, authorizeRole('admin'), getAllApplications);
adminRouter.get('/jobseekers/:id', authMiddleware, authorizeRole('admin'), getJobSeekerWithApplications);
adminRouter.get('/jobseekers', authMiddleware, authorizeRole('admin'), getAllJobSeekers);
adminRouter.get('/statistics/users', authMiddleware, authorizeRole('admin'), getUserStatistics); // Add the new route

// Protected routes - Admin and EliteTeam
adminRouter.get('/applicants', authMiddleware, authorizeRole('admin', 'eliteTeam'), getAllApplicants);

export default adminRouter;