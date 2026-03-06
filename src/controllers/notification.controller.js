import User from '../models/auth.model.js';
import {
  sendNotificationToUser,
  sendBroadcastNotification,
  sendJobAlertNotification,
} from '../services/notificationService.js';

/**
 * Save push token for the authenticated user.
 * POST /notifications/save-token
 * Body: { pushToken }
 */
export const saveToken = async (req, res) => {
  try {
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: 'pushToken is required',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { pushToken },
      { new: true, select: 'name email pushToken' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log(`✅ Push token saved for user: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Push token saved successfully',
      data: { userId: user._id, pushToken: user.pushToken },
    });
  } catch (error) {
    console.error('Error saving push token:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * Send notification to a specific user.
 * POST /notifications/send-notification
 * Body: { userId, title, message, data? }
 */
export const sendNotification = async (req, res) => {
  try {
    const { userId, title, message, data } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'userId, title, and message are required',
      });
    }

    const user = await User.findById(userId, 'pushToken email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.pushToken) {
      return res.status(400).json({
        success: false,
        message: 'User does not have a push token registered',
      });
    }

    const result = await sendNotificationToUser(
      user.pushToken,
      title,
      message,
      data || {}
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Notification sent successfully',
        data: { messageId: result.messageId },
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send notification',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * Send broadcast notification to all users.
 * POST /notifications/send-broadcast
 * Body: { title, message, data? }
 */
export const sendBroadcast = async (req, res) => {
  try {
    const { title, message, data } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'title and message are required',
      });
    }

    const result = await sendBroadcastNotification(title, message, {
      ...data,
      type: 'broadcast',
    });

    res.status(200).json({
      success: true,
      message: 'Broadcast notification sent',
      data: result,
    });
  } catch (error) {
    console.error('Error sending broadcast:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * Send job alert notification to subscribed users.
 * POST /notifications/send-job-alert
 * Body: { title, message, data? }
 */
export const sendJobAlert = async (req, res) => {
  try {
    const { title, message, data } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'title and message are required',
      });
    }

    const result = await sendJobAlertNotification(title, message, {
      ...data,
      type: 'jobAlert',
    });

    res.status(200).json({
      success: true,
      message: 'Job alert notification sent',
      data: result,
    });
  } catch (error) {
    console.error('Error sending job alert:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
