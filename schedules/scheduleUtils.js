const { CronExpressionParser } = require('cron-parser');

/**
 * Validate cron expression
 */
function isValidCron(cronExpression) {
  try {
    CronExpressionParser.parse(cronExpression);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get next execution time from cron expression
 * @param {string} cronExpression - Cron expression (5 fields)
 * @param {string} timezone - User's timezone (e.g., 'America/New_York')
 * @returns {Date} Next execution time in UTC
 */
function getNextExecution(cronExpression, timezone = 'UTC') {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: new Date(),
      tz: timezone
    });

    return interval.next().toDate();
  } catch (error) {
    throw new Error(`Invalid cron expression: ${error.message}`);
  }
}

/**
 * Convert UTC date to user's timezone string
 */
function convertToUserTimezone(utcDate, timezone) {
  try {
    const date = new Date(utcDate);
    return date.toLocaleString('en-US', { timeZone: timezone });
  } catch (error) {
    return new Date(utcDate).toISOString();
  }
}

/**
 * Validate schedule is within 1 year
 */
function isWithinOneMonth(date) {
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  return date <= oneYearFromNow;
}

/**
 * Validate cron expression format and constraints
 */
function validateCronExpression(cronExpression) {
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error('Cron expression must have 5 fields: minute hour day month dayOfWeek');
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Check if both day-of-month and day-of-week are specified
  const hasDayOfMonth = dayOfMonth !== '*' && dayOfMonth !== '?';
  const hasDayOfWeek = dayOfWeek !== '*' && dayOfWeek !== '?';

  if (hasDayOfMonth && hasDayOfWeek) {
    throw new Error('Cannot specify both day-of-month and day-of-week');
  }

  return true;
}

/**
 * Get a human-readable description of a cron expression
 */
function describeCron(cronExpression) {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return cronExpression;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Simple descriptions for common patterns
  if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every minute';
  }
  if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every hour';
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Daily at ${hour}:${minute.padStart(2, '0')}`;
  }

  return cronExpression;
}

module.exports = {
  isValidCron,
  getNextExecution,
  convertToUserTimezone,
  isWithinOneMonth,
  validateCronExpression,
  describeCron
};
