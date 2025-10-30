import express from 'express';
import {
  getAllJobSeekers,
  getJobSeekerDetails,
  getAllApplications,
  getApplicationsByJobSeeker,
  getAllJobs,
  getJobById,
  filterApplicants
} from '../controllers/recruiter.controller.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware.js';

const recruiterRouter = express.Router();

// Protected routes - Recruiters only
recruiterRouter.get('/jobseekers', authMiddleware, authorizeRole('recruiter'), getAllJobSeekers);
recruiterRouter.get('/jobseekers/:id', authMiddleware, authorizeRole('recruiter'), getJobSeekerDetails);
recruiterRouter.get('/applications', authMiddleware, authorizeRole('recruiter'), getAllApplications);
recruiterRouter.get('/applications/jobseeker/:id', authMiddleware, authorizeRole('recruiter'), getApplicationsByJobSeeker);
recruiterRouter.get('/jobs', authMiddleware, authorizeRole('recruiter'), getAllJobs);
recruiterRouter.get('/jobs/:id', authMiddleware, authorizeRole('recruiter'), getJobById);
recruiterRouter.get('/applicants/filter', authMiddleware, authorizeRole('recruiter'), filterApplicants);

export default recruiterRouter;