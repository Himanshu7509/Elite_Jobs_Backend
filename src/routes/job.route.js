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
  getJobApplicationById,
  getJobApplicationStats,
  updateJobVerificationStatus,
  getJobsByVerificationStatus,
  migrateVerificationStatus,
  getJobCountsByVerificationStatus,
  getJobCountsByTeamMember, // Import the new function
  getJobEnumOptions
} from '../controllers/job.controller.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware.js';

const jobRouter = express.Router();

// Public routes
jobRouter.get('/', getAllJobs);
jobRouter.get('/categories', getJobCountsByCategory);
jobRouter.get('/verification-counts', getJobCountsByVerificationStatus);
jobRouter.get('/team-stats', getJobCountsByTeamMember); // Add the new route
jobRouter.get('/options', getJobEnumOptions);

// Protected routes - Job Seekers
jobRouter.post('/:id/apply', authMiddleware, authorizeRole('jobSeeker'), applyForJob);
jobRouter.get('/applications/my', authMiddleware, authorizeRole('jobSeeker'), getUserApplications);
jobRouter.delete('/account', authMiddleware, authorizeRole('jobSeeker'), deleteAccount);

// Protected routes - Job Hosters, Recruiters, Admins, and EliteTeam
jobRouter.post('/', authMiddleware, authorizeRole('jobHoster', 'recruiter', 'admin', 'eliteTeam'), createJob);
jobRouter.get('/my', authMiddleware, authorizeRole('jobHoster', 'recruiter', 'admin', 'eliteTeam'), getUserJobs);
jobRouter.get('/stats', authMiddleware, authorizeRole('jobHoster', 'recruiter', 'admin', 'eliteTeam'), getJobApplicationStats);
jobRouter.put('/:id', authMiddleware, authorizeRole('jobHoster', 'recruiter', 'admin', 'eliteTeam'), updateJob);
jobRouter.get('/:id/applications', authMiddleware, authorizeRole('jobHoster', 'recruiter', 'admin', 'eliteTeam'), getJobApplications);
jobRouter.get('/:jobId/applications/:applicationId', authMiddleware, authorizeRole('jobHoster', 'recruiter', 'admin', 'eliteTeam'), getJobApplicationById);
jobRouter.patch('/applications/:id/status', authMiddleware, authorizeRole('jobHoster', 'recruiter', 'admin', 'eliteTeam'), updateApplicationStatus);
// New route for updating job verification status (Admin and EliteTeam only)
jobRouter.patch('/:id/verification', authMiddleware, authorizeRole('admin', 'eliteTeam'), updateJobVerificationStatus);
// New route for getting jobs by verification status (Admin and EliteTeam only)
jobRouter.get('/verification', authMiddleware, authorizeRole('admin', 'eliteTeam'), getJobsByVerificationStatus);

// Migration route (Admin only)
jobRouter.post('/migrate-verification-status', authMiddleware, authorizeRole('admin'), migrateVerificationStatus);

// Protected routes - Job Hosters, Recruiters, and Admins only (EliteTeam cannot delete)
jobRouter.delete('/:id', authMiddleware, authorizeRole('jobHoster', 'recruiter', 'admin'), deleteJob);

jobRouter.delete('/account', authMiddleware, authorizeRole('jobHoster', 'recruiter'), deleteAccount);
jobRouter.get('/applicant/:id', getApplicationById);

// Public route - But placed at the end to avoid conflicting with /my
jobRouter.get('/:id', getJobById);

// Development only route - update all jobs with company logos
jobRouter.post('/update-all-jobs-logos', updateAllJobsWithCompanyLogo);

export default jobRouter;