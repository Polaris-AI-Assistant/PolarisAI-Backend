/**
 * Schedules Agent - Multi-Step Execution Version
 * 
 * Handles scheduling reminders and future actions
 * Integrates with the scheduler engine for automated execution
 */

const BaseAgent = require('../base/BaseAgent');
const scheduleData = require('./scheduleData');
const { getNextExecution, convertToUserTimezone, isWithinOneMonth } = require('./scheduleUtils');
const OpenAI = require('openai');
const chrono = require('chrono-node');
const moment = require('moment-timezone');

class SchedulesAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    // Define tools with definition + execute pattern
    const tools = {
      createReminder: {
        definition: {
          type: 'function',
          function: {
            name: 'createReminder',
            description: 'Create a reminder that will be sent to the user at a specific time. Use for queries like "remind me to...", "set a reminder for...", "schedule a reminder..."',
            parameters: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'The reminder message/content (e.g., "Check Bitcoin price", "Call mom", "Submit report")'
                },
                datetime: {
                  type: 'string',
                  description: 'When to send the reminder in natural language (e.g., "tomorrow at 2 PM", "in 2 hours", "next Monday at 9 AM", "December 25 at 10:00")'
                },
                recurring: {
                  type: 'boolean',
                  description: 'Whether this reminder should repeat',
                  default: false
                },
                timezone: {
                  type: 'string',
                  description: 'User timezone (e.g., "America/New_York", "Asia/Kolkata", "UTC")',
                  default: 'UTC'
                }
              },
              required: ['content', 'datetime']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[SchedulesAgent] ⏰ Creating reminder: "${params.content}" at ${params.datetime}`);
          
          try {
            // Parse natural language datetime to cron expression
            const cronResult = this.parseDateTimeToCron(params.datetime, params.timezone || 'UTC');
            
            if (!cronResult.success) {
              throw new Error(cronResult.error || 'Failed to parse datetime');
            }

            // Create schedule in database
            const schedule = await scheduleData.createSchedule({
              user_id: context.userId,
              type: 'reminder',
              content: params.content,
              cron_expression: cronResult.cronExpression,
              recurring: params.recurring || false,
              next_execution: cronResult.nextExecution,
              timezone: params.timezone || 'UTC',
              status: 'active'
            });

            console.log(`[SchedulesAgent] ✅ Reminder created successfully: ${schedule.id}`);
            
            return {
              success: true,
              scheduleId: schedule.id,
              content: params.content,
              nextExecution: schedule.next_execution,
              nextExecutionLocal: convertToUserTimezone(schedule.next_execution, schedule.timezone),
              cronExpression: schedule.cron_expression,
              recurring: schedule.recurring,
              timezone: schedule.timezone,
              message: `Reminder scheduled for ${convertToUserTimezone(schedule.next_execution, schedule.timezone)}`
            };
          } catch (error) {
            console.error(`[SchedulesAgent] ❌ Error creating reminder:`, error);
            throw error;
          }
        }
      },

      createScheduledAction: {
        definition: {
          type: 'function',
          function: {
            name: 'createScheduledAction',
            description: 'Schedule an action to be automatically executed at a specific time. The action will be processed by the AI agent at the scheduled time. Use for queries like "schedule an email to...", "automatically send... tomorrow", "create a document next week"',
            parameters: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'The action to execute (e.g., "Send email to john@example.com about the meeting", "Create a document titled Project Plan")'
                },
                datetime: {
                  type: 'string',
                  description: 'When to execute the action in natural language (e.g., "tomorrow at 2 PM", "in 2 hours", "next Monday at 9 AM")'
                },
                recurring: {
                  type: 'boolean',
                  description: 'Whether this action should repeat',
                  default: false
                },
                timezone: {
                  type: 'string',
                  description: 'User timezone',
                  default: 'UTC'
                }
              },
              required: ['content', 'datetime']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[SchedulesAgent] 📅 Creating scheduled action: "${params.content}" at ${params.datetime}`);
          
          try {
            // Parse natural language datetime to cron expression
            const cronResult = this.parseDateTimeToCron(params.datetime, params.timezone || 'UTC');
            
            if (!cronResult.success) {
              throw new Error(cronResult.error || 'Failed to parse datetime');
            }

            // Create schedule in database
            const schedule = await scheduleData.createSchedule({
              user_id: context.userId,
              type: 'action',
              content: params.content,
              cron_expression: cronResult.cronExpression,
              recurring: params.recurring || false,
              next_execution: cronResult.nextExecution,
              timezone: params.timezone || 'UTC',
              status: 'active'
            });

            console.log(`[SchedulesAgent] ✅ Scheduled action created successfully: ${schedule.id}`);
            
            return {
              success: true,
              scheduleId: schedule.id,
              content: params.content,
              nextExecution: schedule.next_execution,
              nextExecutionLocal: convertToUserTimezone(schedule.next_execution, schedule.timezone),
              cronExpression: schedule.cron_expression,
              recurring: schedule.recurring,
              timezone: schedule.timezone,
              message: `Action scheduled for ${convertToUserTimezone(schedule.next_execution, schedule.timezone)}`
            };
          } catch (error) {
            console.error(`[SchedulesAgent] ❌ Error creating scheduled action:`, error);
            throw error;
          }
        }
      },

      listSchedules: {
        definition: {
          type: 'function',
          function: {
            name: 'listSchedules',
            description: 'List user\'s scheduled reminders and actions. Use for queries like "show my reminders", "list my scheduled tasks", "what reminders do I have"',
            parameters: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['all', 'active', 'paused', 'completed'],
                  description: 'Filter by status',
                  default: 'active'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of schedules to return',
                  default: 20
                }
              }
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[SchedulesAgent] 📋 Listing schedules (status: ${params.status || 'active'})`);
          
          try {
            const { schedules, total } = await scheduleData.getSchedules(context.userId, {
              status: params.status || 'active',
              limit: params.limit || 20,
              offset: 0
            });

            // Add local time to each schedule
            const schedulesWithLocalTime = schedules.map(s => ({
              id: s.id,
              type: s.type,
              content: s.content,
              nextExecution: s.next_execution,
              nextExecutionLocal: convertToUserTimezone(s.next_execution, s.timezone),
              recurring: s.recurring,
              status: s.status,
              timezone: s.timezone,
              createdAt: s.created_at
            }));

            console.log(`[SchedulesAgent] ✅ Found ${schedules.length} schedules`);
            
            return {
              success: true,
              schedules: schedulesWithLocalTime,
              total: total,
              count: schedules.length
            };
          } catch (error) {
            console.error(`[SchedulesAgent] ❌ Error listing schedules:`, error);
            throw error;
          }
        }
      },

      deleteSchedule: {
        definition: {
          type: 'function',
          function: {
            name: 'deleteSchedule',
            description: 'Delete a scheduled reminder or action. Use for queries like "delete my reminder", "cancel the scheduled task", "remove the reminder about..."',
            parameters: {
              type: 'object',
              properties: {
                scheduleId: {
                  type: 'string',
                  description: 'The ID of the schedule to delete (if known)'
                },
                content: {
                  type: 'string',
                  description: 'The content/description of the schedule to delete (if ID is not known)'
                }
              }
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[SchedulesAgent] 🗑️ Deleting schedule`);
          
          try {
            let scheduleId = params.scheduleId;
            
            // If no ID provided, search by content
            if (!scheduleId && params.content) {
              const { schedules } = await scheduleData.getSchedules(context.userId, {
                status: 'all',
                limit: 100,
                offset: 0
              });
              
              // Find schedule matching content
              const matchingSchedule = schedules.find(s => 
                s.content.toLowerCase().includes(params.content.toLowerCase())
              );
              
              if (matchingSchedule) {
                scheduleId = matchingSchedule.id;
              } else {
                throw new Error('No matching schedule found');
              }
            }
            
            if (!scheduleId) {
              throw new Error('Schedule ID or content is required');
            }

            await scheduleData.deleteSchedule(scheduleId, context.userId);

            console.log(`[SchedulesAgent] ✅ Schedule deleted successfully`);
            
            return {
              success: true,
              scheduleId: scheduleId,
              message: 'Schedule deleted successfully'
            };
          } catch (error) {
            console.error(`[SchedulesAgent] ❌ Error deleting schedule:`, error);
            throw error;
          }
        }
      }
    };

    // Initialize BaseAgent with tools
    super('SchedulesAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
    
    // Set custom system prompt for schedules agent
    this.systemPrompt = `You are a helpful scheduling assistant. You help users create reminders and schedule future actions.

IMPORTANT GUIDELINES:
1. Use createReminder for simple reminders (notifications only)
2. Use createScheduledAction for actions that should be automatically executed (emails, documents, etc.)
3. Parse natural language time expressions accurately
4. Always confirm the scheduled time with the user
5. CRITICAL: Always try to determine the user's timezone from context or ask if unclear
6. Provide friendly, conversational responses

TIMEZONE HANDLING:
- If timezone is provided in context, use it
- If user mentions a location (e.g., "2 PM in New York"), infer timezone from location
- Common timezones: America/New_York (EST/EDT), America/Los_Angeles (PST/PDT), Europe/London (GMT/BST), Asia/Kolkata (IST), Asia/Tokyo (JST)
- If timezone is unclear, default to UTC but mention this in your response
- ALWAYS pass the timezone parameter to createReminder and createScheduledAction

TOOL SELECTION:
- "Remind me to check Bitcoin price tomorrow at 2 PM" → createReminder (with timezone)
- "Set a reminder to call mom" → createReminder
- "Schedule an email to john@example.com next Monday" → createScheduledAction
- "Automatically send a report every Friday" → createScheduledAction (recurring: true)
- "Show my reminders" → listSchedules
- "Cancel my reminder about Bitcoin" → deleteSchedule

RESPONSE FORMATTING:
- Use emojis to make responses engaging (⏰ 📅 ✅ 🔔)
- Confirm the scheduled time clearly WITH timezone
- Mention timezone if relevant
- For recurring schedules, explain the recurrence pattern
- Be concise but informative

EXAMPLES:
Query: "Remind me to check Bitcoin price tomorrow at 2 PM"
Response: "⏰ Got it! I'll remind you to check Bitcoin price tomorrow at 2:00 PM (your local time). You'll receive a notification at that time. 🔔"

Query: "Schedule an email to john@example.com about the meeting next Monday at 9 AM"
Response: "📅 Perfect! I've scheduled an action to send an email to john@example.com about the meeting next Monday at 9:00 AM. The email will be automatically sent at that time. ✅"

Query: "Show my reminders"
Response: "📋 Here are your active reminders:

1. ⏰ Check Bitcoin price - Tomorrow at 2:00 PM
2. 📞 Call mom - Friday at 6:00 PM
3. 📧 Submit report - Next Monday at 9:00 AM

You have 3 active reminders scheduled."`;
  }

  /**
   * Parse natural language datetime to cron expression
   * Uses chrono-node for natural language parsing and moment-timezone for timezone handling
   */
  parseDateTimeToCron(datetimeStr, timezone = 'UTC') {
    try {
      console.log(`[SchedulesAgent] 🕐 Parsing datetime: "${datetimeStr}" (timezone: ${timezone})`);
      
      // Parse natural language datetime (chrono parses in local/system timezone)
      const parsed = chrono.parseDate(datetimeStr, new Date());
      
      if (!parsed) {
        return {
          success: false,
          error: `Could not parse datetime: "${datetimeStr}". Please provide a clear time like "tomorrow at 2 PM" or "December 25 at 10:00 AM"`
        };
      }

      console.log(`[SchedulesAgent] 📅 Parsed date (system time): ${parsed.toISOString()}`);
      
      // Extract the date/time components that the user intended
      const year = parsed.getFullYear();
      const month = parsed.getMonth() + 1; // 0-indexed
      const day = parsed.getDate();
      const hour = parsed.getHours();
      const minute = parsed.getMinutes();
      
      // Create a moment object in the USER'S timezone with these components
      // This ensures "2 PM" means "2 PM in the user's timezone"
      const userTimezoneMoment = moment.tz({
        year,
        month: month - 1, // moment months are 0-indexed
        day,
        hour,
        minute,
        second: 0
      }, timezone);
      
      console.log(`[SchedulesAgent] 🌍 User timezone (${timezone}): ${userTimezoneMoment.format('YYYY-MM-DD HH:mm:ss Z')}`);
      
      // Convert to UTC for storage (cron runs in UTC)
      const utcMoment = userTimezoneMoment.clone().utc();
      
      console.log(`[SchedulesAgent] 🌐 UTC time: ${utcMoment.format('YYYY-MM-DD HH:mm:ss Z')}`);
      
      // Check if the date is in the past
      if (utcMoment.isBefore(moment())) {
        return {
          success: false,
          error: 'The specified time is in the past. Please provide a future date and time.'
        };
      }

      // Check if within 1 year
      const oneYearFromNow = moment().add(1, 'year');
      if (utcMoment.isAfter(oneYearFromNow)) {
        return {
          success: false,
          error: 'Schedules must be within 1 year from now.'
        };
      }

      // Convert to cron expression (one-time execution in UTC)
      // Format: minute hour day month dayOfWeek
      const cronMinute = utcMoment.minute();
      const cronHour = utcMoment.hour();
      const cronDay = utcMoment.date();
      const cronMonth = utcMoment.month() + 1; // moment months are 0-indexed
      
      // One-time cron: specific minute, hour, day, month, any day of week
      const cronExpression = `${cronMinute} ${cronHour} ${cronDay} ${cronMonth} *`;
      
      console.log(`[SchedulesAgent] ⚙️ Generated cron (UTC): ${cronExpression}`);
      console.log(`[SchedulesAgent] 📅 Will execute at: ${utcMoment.toISOString()}`);
      console.log(`[SchedulesAgent] 🕐 User will see: ${userTimezoneMoment.format('YYYY-MM-DD [at] h:mm A z')}`);
      
      return {
        success: true,
        cronExpression: cronExpression,
        nextExecution: utcMoment.toISOString(),
        parsedDate: utcMoment.toDate(),
        userTimezoneDisplay: userTimezoneMoment.format('YYYY-MM-DD [at] h:mm A z')
      };
    } catch (error) {
      console.error(`[SchedulesAgent] ❌ Error parsing datetime:`, error);
      return {
        success: false,
        error: `Failed to parse datetime: ${error.message}`
      };
    }
  }
}

module.exports = SchedulesAgentMultiStep;
