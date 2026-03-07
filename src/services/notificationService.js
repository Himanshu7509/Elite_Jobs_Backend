import { messaging } from '../firebase/firebaseAdmin.js';
import User from '../models/auth.model.js';

/**
 * Send a push notification to a single user via their FCM token.
 */
export const sendNotificationToUser = async (token, title, body, data = {}) => {
  try {
    const message = {
      token,
      notification: { title, body },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
        },
      },
    };

    const response = await messaging.send(message);
    console.log('✅ Notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    // If token is invalid, return specific error so caller can clean up
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      return { success: false, error: 'invalid-token', token };
    }
    return { success: false, error: error.message };
  }
};

/**
 * Send a push notification to multiple users via their FCM tokens.
 * FCM supports up to 500 tokens per batch.
 */
export const sendNotificationToMultipleUsers = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) {
    console.log('No tokens provided for notification');
    return { success: true, successCount: 0, failureCount: 0 };
  }

  // Filter out empty/null tokens
  const validTokens = tokens.filter((t) => t && t.trim() !== '');
  if (validTokens.length === 0) {
    console.log('No valid tokens after filtering');
    return { success: true, successCount: 0, failureCount: 0 };
  }

  try {
    const message = {
      notification: { title, body },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
        },
      },
      tokens: validTokens,
    };

    const response = await messaging.sendEachForMulticast(message);
    console.log(
      `✅ Batch notification: ${response.successCount} sent, ${response.failureCount} failed`
    );

    // Clean up invalid tokens and collect failure details
    const invalidTokens = [];
    const failureDetails = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        console.error(`❌ Token failed: ${validTokens[idx]}, Code: ${resp.error.code}, Message: ${resp.error.message}`);
        failureDetails.push({
          token: validTokens[idx].substring(0, 20) + '...',
          code: resp.error.code,
          message: resp.error.message,
        });
        if (
          resp.error.code === 'messaging/invalid-registration-token' ||
          resp.error.code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(validTokens[idx]);
        }
      }
    });

    // Remove invalid tokens from database
    if (invalidTokens.length > 0) {
      await User.updateMany(
        { pushToken: { $in: invalidTokens } },
        { $set: { pushToken: '' } }
      );
      console.log(`🧹 Cleaned up ${invalidTokens.length} invalid token(s)`);
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      failureDetails,
    };
  } catch (error) {
    console.error('❌ Error sending batch notification:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send a broadcast notification to ALL users who have a push token.
 */
export const sendBroadcastNotification = async (title, body, data = {}) => {
  try {
    const users = await User.find(
      { pushToken: { $exists: true, $ne: '' } },
      { pushToken: 1 }
    );

    const tokens = users.map((u) => u.pushToken);
    console.log(`📢 Broadcasting to ${tokens.length} user(s)`);

    if (tokens.length === 0) {
      return { success: true, message: 'No users with push tokens found' };
    }

    // Send in batches of 500
    const batchSize = 500;
    let totalSuccess = 0;
    let totalFailure = 0;
    const allFailureDetails = [];

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const result = await sendNotificationToMultipleUsers(batch, title, body, data);
      if (result.success) {
        totalSuccess += result.successCount || 0;
        totalFailure += result.failureCount || 0;
        if (result.failureDetails) allFailureDetails.push(...result.failureDetails);
      }
    }

    return { success: true, successCount: totalSuccess, failureCount: totalFailure, failureDetails: allFailureDetails };
  } catch (error) {
    console.error('❌ Error sending broadcast notification:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send a job alert notification to users subscribed to job alerts.
 */
export const sendJobAlertNotification = async (title, body, data = {}) => {
  try {
    const users = await User.find(
      {
        pushToken: { $exists: true, $ne: '' },
        subscribedToJobAlerts: { $ne: false }, // default true, so include docs without the field
      },
      { pushToken: 1 }
    );

    const tokens = users.map((u) => u.pushToken);
    console.log(`🔔 Sending job alert to ${tokens.length} subscribed user(s)`);

    if (tokens.length === 0) {
      return { success: true, message: 'No subscribed users with push tokens found' };
    }

    const notificationData = { ...data, type: 'jobAlert' };

    // Send in batches of 500
    const batchSize = 500;
    let totalSuccess = 0;
    let totalFailure = 0;
    const allFailureDetails = [];

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const result = await sendNotificationToMultipleUsers(batch, title, body, notificationData);
      if (result.success) {
        totalSuccess += result.successCount || 0;
        totalFailure += result.failureCount || 0;
        if (result.failureDetails) allFailureDetails.push(...result.failureDetails);
      }
    }

    return { success: true, successCount: totalSuccess, failureCount: totalFailure, failureDetails: allFailureDetails };
  } catch (error) {
    console.error('❌ Error sending job alert notification:', error.message);
    return { success: false, error: error.message };
  }
};
