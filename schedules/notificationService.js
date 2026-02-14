const axios = require('axios');

// OneSignal configuration
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

/**
 * Send push notification to a specific user via OneSignal
 * Uses external_id (Supabase user ID) to target the user
 * 
 * @param {string} userId - Supabase user ID (mapped as OneSignal external_id)
 * @param {object} notification - Notification payload
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {string} [notification.type] - Notification type (reminder, action_completed)
 * @param {string} [notification.scheduleId] - Associated schedule ID
 * @param {string} [notification.chatId] - Associated chat ID
 */
async function sendNotification(userId, notification) {
  try {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.warn('[Notifications] OneSignal not configured - skipping notification');
      return null;
    }

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      // Target user by external_id (Supabase userId)
      include_aliases: {
        external_id: [userId]
      },
      target_channel: 'push',
      headings: { en: notification.title || 'Polaris Reminder' },
      contents: { en: notification.body || '' },
      // Custom data passed to the app
      data: {
        type: notification.type || 'reminder',
        scheduleId: notification.scheduleId || '',
        chatId: notification.chatId || ''
      },
      // Web push specific
      web_url: notification.url || undefined,
      // Chrome web push icon
      chrome_web_icon: notification.icon || undefined,
    };

    const response = await axios.post(
      'https://api.onesignal.com/notifications',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`
        }
      }
    );

    console.log(`[Notifications] Sent notification to user ${userId}:`, response.data);
    return response.data;

  } catch (error) {
    // OneSignal returns 200 even for "no subscribers" - check for actual errors
    if (error.response) {
      console.error('[Notifications] OneSignal API error:', error.response.data);
    } else {
      console.error('[Notifications] Error sending notification:', error.message);
    }
    // Don't throw - notification failure shouldn't break schedule execution
    return null;
  }
}

/**
 * Send notification for a schedule reminder
 */
async function sendScheduleReminder(userId, scheduleContent, scheduleId) {
  return sendNotification(userId, {
    title: '🔔 Reminder',
    body: scheduleContent,
    type: 'reminder',
    scheduleId
  });
}

/**
 * Send notification for a completed action
 */
async function sendActionCompleted(userId, actionContent, scheduleId, chatId) {
  return sendNotification(userId, {
    title: '⚡ Scheduled Action Completed',
    body: `Action completed: ${actionContent}`,
    type: 'action_completed',
    scheduleId,
    chatId
  });
}

module.exports = {
  sendNotification,
  sendScheduleReminder,
  sendActionCompleted
};
