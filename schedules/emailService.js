const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// ─── SMTP transporter (Titan) ────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.titan.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // false → STARTTLS on 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_NAME  = process.env.FROM_NAME  || 'Polaris AI';
const FROM_EMAIL = process.env.FROM_EMAIL || 'team@polaris-ai.tech';

// ─── Supabase admin client (service role — can read auth.users) ──────
function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Look up a user's email from their Supabase auth user ID
 */
async function getUserEmail(userId) {
  try {
    const admin = getAdminClient();
    const { data: { user }, error } = await admin.auth.admin.getUserById(userId);

    if (error || !user) {
      console.error('[Email] Could not fetch user:', error?.message);
      return null;
    }

    return user.email;
  } catch (err) {
    console.error('[Email] Error looking up user email:', err.message);
    return null;
  }
}

/**
 * Send a reminder email to a user
 *
 * @param {string} userId   - Supabase user ID
 * @param {string} content  - Reminder message text
 * @param {string} scheduleId - Schedule UUID (for reference)
 */
async function sendScheduleReminder(userId, content, scheduleId) {
  const recipientEmail = await getUserEmail(userId);

  if (!recipientEmail) {
    console.warn(`[Email] No email found for user ${userId} — skipping`);
    return null;
  }

  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid #2a2a2a;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 20px;border-bottom:1px solid #2a2a2a;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;">⏰ Polaris Reminder</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 40px;">
              <p style="color:#e0e0e0;font-size:16px;line-height:1.6;margin:0 0 20px;">
                ${content}
              </p>
              <p style="color:#888;font-size:13px;margin:0;">
                ${now} (IST)
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #2a2a2a;">
              <p style="color:#555;font-size:12px;margin:0;">
                This is an automated reminder from <strong style="color:#10b981;">Polaris AI</strong>. 
                You created this reminder in your Polaris dashboard.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: recipientEmail,
      subject: `🔔 Reminder: ${content.substring(0, 60)}${content.length > 60 ? '…' : ''}`,
      text: `Polaris Reminder\n\n${content}\n\nTime: ${now} (IST)\n\nSchedule ID: ${scheduleId}`,
      html: htmlBody,
    });

    console.log(`[Email] Reminder sent to ${recipientEmail} (messageId: ${info.messageId})`);
    return info;
  } catch (err) {
    console.error(`[Email] Failed to send reminder to ${recipientEmail}:`, err.message);
    return null;
  }
}

/**
 * Send an email notification when a scheduled action completes
 */
async function sendActionCompleted(userId, actionContent, scheduleId, chatId) {
  const recipientEmail = await getUserEmail(userId);

  if (!recipientEmail) {
    console.warn(`[Email] No email found for user ${userId} — skipping`);
    return null;
  }

  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid #2a2a2a;">
          <tr>
            <td style="padding:32px 40px 20px;border-bottom:1px solid #2a2a2a;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;">⚡ Scheduled Action Completed</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 40px;">
              <p style="color:#e0e0e0;font-size:16px;line-height:1.6;margin:0 0 20px;">
                Your scheduled action has been executed:
              </p>
              <div style="background:#111;border-left:3px solid #10b981;padding:12px 16px;border-radius:4px;margin:0 0 20px;">
                <p style="color:#d0d0d0;font-size:14px;margin:0;">${actionContent}</p>
              </div>
              <p style="color:#888;font-size:13px;margin:0;">
                ${now} (IST)
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #2a2a2a;">
              <p style="color:#555;font-size:12px;margin:0;">
                View the full result in your <strong style="color:#10b981;">Polaris AI</strong> chat history.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: recipientEmail,
      subject: `⚡ Action Completed: ${actionContent.substring(0, 50)}${actionContent.length > 50 ? '…' : ''}`,
      text: `Polaris Scheduled Action Completed\n\nAction: ${actionContent}\n\nTime: ${now} (IST)\n\nChat ID: ${chatId || 'N/A'}`,
      html: htmlBody,
    });

    console.log(`[Email] Action-completed email sent to ${recipientEmail} (messageId: ${info.messageId})`);
    return info;
  } catch (err) {
    console.error(`[Email] Failed to send action email to ${recipientEmail}:`, err.message);
    return null;
  }
}

module.exports = {
  sendScheduleReminder,
  sendActionCompleted,
  getUserEmail,
};
