import express from 'express';
import {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  applyForJob,
  getJobApplications,
  getUserApplications,
  getUserJobs,
  updateApplicationStatus,
  getApplicationById,
  deleteAccount,
  updateAllJobsWithCompanyLogo,
  getJobCountsByCategory,
  getJobApplicationById
} from '../controllers/job.controller.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware.js';

const jobRouter = express.Router();

// Public routes
jobRouter.get('/', getAllJobs);
jobRouter.get('/categories', getJobCountsByCategory);

// Protected routes - Job Seekers
jobRouter.post('/:id/apply', authMiddleware, authorizeRole('jobSeeker'), applyForJob);
jobRouter.get('/applications/my', authMiddleware, authorizeRole('jobSeeker'), getUserApplications);
jobRouter.delete('/account', authMiddleware, authorizeRole('jobSeeker'), deleteAccount);

// Protected routes - Job Hosters
jobRouter.post('/', authMiddleware, authorizeRole('jobHoster'), createJob);
jobRouter.get('/my', authMiddleware, authorizeRole('jobHoster'), getUserJobs);
jobRouter.put('/:id', authMiddleware, authorizeRole('jobHoster'), updateJob);
jobRouter.delete('/:id', authMiddleware, authorizeRole('jobHoster'), deleteJob);
jobRouter.get('/:id/applications', authMiddleware, authorizeRole('jobHoster'), getJobApplications);
jobRouter.get('/:jobId/applications/:applicationId', authMiddleware, authorizeRole('jobHoster'), getJobApplicationById);
jobRouter.patch('/applications/:id/status', authMiddleware, authorizeRole('jobHoster'), updateApplicationStatus);
jobRouter.delete('/account', authMiddleware, authorizeRole('jobHoster'), deleteAccount);

// Public route - But placed at the end to avoid conflicting with /my
jobRouter.get('/:id', getJobById);

// Development only route - update all jobs with company logos
jobRouter.post('/update-all-jobs-logos', updateAllJobsWithCompanyLogo);

export default jobRouter;