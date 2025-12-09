import express from 'express';
import {
  createJobDirect,
  createEliteTeamUser,
  getAllEliteTeamUsers,
  getEliteTeamUserById,
  updateEliteTeamUser,
  deleteEliteTeamUser
} from '../controllers/eliteTeam.controller.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware.js';

const eliteTeamRouter = express.Router();

// Protected routes - Admin only
eliteTeamRouter.post('/', authMiddleware, authorizeRole('admin'), createEliteTeamUser);
eliteTeamRouter.get('/:id', authMiddleware, authorizeRole('admin'), getEliteTeamUserById);
eliteTeamRouter.put('/:id', authMiddleware, authorizeRole('admin'), updateEliteTeamUser);
eliteTeamRouter.delete('/:id', authMiddleware, authorizeRole('admin'), deleteEliteTeamUser);

// Protected routes - Admin and EliteTeam
eliteTeamRouter.get('/', authMiddleware, authorizeRole('admin', 'eliteTeam'), getAllEliteTeamUsers);

// Protected routes - EliteTeam only
eliteTeamRouter.post('/jobs', authMiddleware, authorizeRole('eliteTeam'), createJobDirect);

export default eliteTeamRouter;