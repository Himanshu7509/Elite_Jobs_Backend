import express from 'express';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware.js';
import {
  saveToken,
  sendNotification,
  sendBroadcast,
  sendJobAlert,
} from '../controllers/notification.controller.js';

const router = express.Router();

// Save push token — any authenticated user
router.post('/save-token', authMiddleware, saveToken);

// Send notification to a specific user — admin only
router.post('/send-notification', authMiddleware, authorizeRole('admin'), sendNotification);

// Send broadcast to all users — admin only
router.post('/send-broadcast', authMiddleware, authorizeRole('admin'), sendBroadcast);

// Send job alert to subscribed users — admin only
router.post('/send-job-alert', authMiddleware, authorizeRole('admin'), sendJobAlert);

export default router;
