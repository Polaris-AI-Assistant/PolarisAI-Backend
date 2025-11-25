const { google } = require('googleapis');
const supabase = require('../supabase/supabaseConnect');

// Define OAuth scopes
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

/**
 * Get Calendar API client with user credentials
 */
async function getCalendarClient(userIdentifier) {
  try {
    // Get tokens from Supabase calendar_tokens table
    let query = supabase.from("calendar_tokens").select("access_token, refresh_token, email, user_id");
    
    // Check if userIdentifier is an email or user_id
    if (userIdentifier.includes('@')) {
      query = query.eq("email", userIdentifier);
    } else {
      query = query.eq("user_id", userIdentifier);
    }
    
    const { data: tokenRow, error } = await query.single();

    if (error || !tokenRow) {
      throw new Error("User tokens not found. Please connect Google Calendar first.");
    }

    // Create OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      process.env.GOOGLE_CALENDAR_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials({ 
      access_token: tokenRow.access_token, 
      refresh_token: tokenRow.refresh_token 
    });

    // Handle token refresh
    oAuth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        console.log('New refresh token received');
      }
      
      // Update access token in database
      await supabase
        .from("calendar_tokens")
        .update({
          access_token: tokens.access_token,
          expiry_date: tokens.expiry_date || null,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", tokenRow.user_id);
    });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    
    return { calendar, oAuth2Client, userId: tokenRow.user_id, email: tokenRow.email };

  } catch (error) {
    console.error('Error getting Calendar client:', error);
    throw error;
  }
}

/**
 * Create a new calendar event
 */
async function createEvent(userIdentifier, eventDetails) {
  try {
    const { calendar } = await getCalendarClient(userIdentifier);
    
    const {
      summary,
      description,
      location,
      startDateTime,
      endDateTime,
      timeZone = 'UTC',
      calendarId = 'primary',
      attendees = [],
      recurrence,
      reminders,
      sendUpdates = 'none',
      addGoogleMeet = false
    } = eventDetails;

    // Validate required fields
    if (!summary) {
      throw new Error("Event summary (title) is required");
    }
    if (!startDateTime) {
      throw new Error("Event start time is required");
    }
    if (!endDateTime) {
      throw new Error("Event end time is required");
    }

    // Build event object
    const event = {
      summary,
      start: {
        dateTime: startDateTime,
        timeZone: timeZone
      },
      end: {
        dateTime: endDateTime,
        timeZone: timeZone
      }
    };

    // Add optional fields
    if (description) event.description = description;
    if (location) event.location = location;
    
    if (attendees && attendees.length > 0) {
      event.attendees = attendees.map(email => ({ email }));
    }
    
    if (recurrence) {
      event.recurrence = Array.isArray(recurrence) ? recurrence : [recurrence];
    }
    
    if (reminders) {
      event.reminders = reminders;
    } else {
      event.reminders = { useDefault: true };
    }

    // Add Google Meet conference if requested
    if (addGoogleMeet) {
      event.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      };
    }

    // Create the event
    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: event,
      conferenceDataVersion: addGoogleMeet ? 1 : 0,
      sendUpdates: sendUpdates
    });

    return {
      success: true,
      event: response.data,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      hangoutLink: response.data.hangoutLink,
      message: "Event created successfully"
    };

  } catch (error) {
    console.error('Error creating event:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get calendar events within a time range
 */
async function getEvents(userIdentifier, filters = {}) {
  try {
    const { calendar } = await getCalendarClient(userIdentifier);
    
    const {
      timeMin,
      timeMax,
      maxResults = 20, // Default to 20 events instead of 250
      calendarId = 'primary',
      orderBy = 'startTime',
      query
    } = filters;

    // If no time range specified, default to current year only (2025)
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Default time range: from now until end of current year
    const defaultTimeMin = timeMin || now.toISOString();
    const defaultTimeMax = timeMax || new Date(currentYear, 11, 31, 23, 59, 59).toISOString(); // Dec 31, 2025 23:59:59

    // Build request parameters
    const params = {
      calendarId: calendarId,
      singleEvents: true, // Expand recurring events
      orderBy: orderBy,
      timeMin: defaultTimeMin,
      timeMax: defaultTimeMax,
      maxResults: Math.min(maxResults, 50) // Cap at 50 events maximum to avoid token limits
    };

    if (query) params.q = query;

    // Get events
    const response = await calendar.events.list(params);

    const events = response.data.items || [];

    return {
      success: true,
      events: events,
      count: events.length,
      summary: response.data.summary,
      timeZone: response.data.timeZone,
      message: `Retrieved ${events.length} events`
    };

  } catch (error) {
    console.error('Error getting events:', error);
    return {
      success: false,
      error: error.message,
      events: []
    };
  }
}

/**
 * Update an existing calendar event
 */
async function updateEvent(userIdentifier, eventId, updates, calendarId = 'primary', sendUpdates = 'none') {
  try {
    const { calendar } = await getCalendarClient(userIdentifier);

    if (!eventId) {
      throw new Error("Event ID is required");
    }

    // Get the existing event first
    const existingEvent = await calendar.events.get({
      calendarId: calendarId,
      eventId: eventId
    });

    // Build updated event object
    const updatedEvent = { ...existingEvent.data };

    // Apply updates
    if (updates.summary !== undefined) updatedEvent.summary = updates.summary;
    if (updates.description !== undefined) updatedEvent.description = updates.description;
    if (updates.location !== undefined) updatedEvent.location = updates.location;
    
    if (updates.startDateTime) {
      updatedEvent.start = {
        dateTime: updates.startDateTime,
        timeZone: updates.timeZone || updatedEvent.start.timeZone || 'UTC'
      };
    }
    
    if (updates.endDateTime) {
      updatedEvent.end = {
        dateTime: updates.endDateTime,
        timeZone: updates.timeZone || updatedEvent.end.timeZone || 'UTC'
      };
    }
    
    if (updates.attendees) {
      updatedEvent.attendees = updates.attendees.map(email => ({ email }));
    }
    
    if (updates.recurrence) {
      updatedEvent.recurrence = Array.isArray(updates.recurrence) ? updates.recurrence : [updates.recurrence];
    }

    // Add Google Meet if requested
    if (updates.addGoogleMeet && !updatedEvent.conferenceData) {
      updatedEvent.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      };
    }

    // Update the event
    const response = await calendar.events.update({
      calendarId: calendarId,
      eventId: eventId,
      resource: updatedEvent,
      conferenceDataVersion: updates.addGoogleMeet ? 1 : 0,
      sendUpdates: sendUpdates
    });

    return {
      success: true,
      event: response.data,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      message: "Event updated successfully"
    };

  } catch (error) {
    console.error('Error updating event:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a calendar event
 */
async function deleteEvent(userIdentifier, eventId, calendarId = 'primary', sendUpdates = 'none') {
  try {
    const { calendar } = await getCalendarClient(userIdentifier);

    if (!eventId) {
      throw new Error("Event ID is required");
    }

    await calendar.events.delete({
      calendarId: calendarId,
      eventId: eventId,
      sendUpdates: sendUpdates
    });

    return {
      success: true,
      eventId: eventId,
      message: "Event deleted successfully"
    };

  } catch (error) {
    console.error('Error deleting event:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get list of calendars
 */
async function getCalendars(userIdentifier) {
  try {
    const { calendar } = await getCalendarClient(userIdentifier);

    const response = await calendar.calendarList.list();

    const calendars = response.data.items || [];

    return {
      success: true,
      calendars: calendars.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description,
        timeZone: cal.timeZone,
        primary: cal.primary || false,
        accessRole: cal.accessRole,
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor
      })),
      count: calendars.length,
      message: `Retrieved ${calendars.length} calendars`
    };

  } catch (error) {
    console.error('Error getting calendars:', error);
    return {
      success: false,
      error: error.message,
      calendars: []
    };
  }
}

/**
 * Get detailed information about a specific calendar
 */
async function getCalendar(userIdentifier, calendarId = 'primary') {
  try {
    const { calendar } = await getCalendarClient(userIdentifier);

    const response = await calendar.calendars.get({
      calendarId: calendarId
    });

    return {
      success: true,
      calendar: response.data,
      message: "Calendar retrieved successfully"
    };

  } catch (error) {
    console.error('Error getting calendar:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a secondary calendar
 */
async function createCalendar(userIdentifier, summary, description = '', timeZone = 'UTC') {
  try {
    const { calendar } = await getCalendarClient(userIdentifier);

    if (!summary) {
      throw new Error("Calendar summary (name) is required");
    }

    const calendarData = {
      summary: summary,
      timeZone: timeZone
    };

    if (description) {
      calendarData.description = description;
    }

    const response = await calendar.calendars.insert({
      resource: calendarData
    });

    return {
      success: true,
      calendar: response.data,
      calendarId: response.data.id,
      message: "Calendar created successfully"
    };

  } catch (error) {
    console.error('Error creating calendar:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update calendar properties
 */
async function updateCalendar(userIdentifier, calendarId, updates) {
  try {
    const { calendar } = await getCalendarClient(userIdentifier);

    if (!calendarId) {
      throw new Error("Calendar ID is required");
    }

    // Get existing calendar
    const existingCalendar = await calendar.calendars.get({
      calendarId: calendarId
    });

    // Build updated calendar object
    const updatedCalendar = { ...existingCalendar.data };

    if (updates.summary !== undefined) updatedCalendar.summary = updates.summary;
    if (updates.description !== undefined) updatedCalendar.description = updates.description;
    if (updates.timeZone !== undefined) updatedCalendar.timeZone = updates.timeZone;

    const response = await calendar.calendars.update({
      calendarId: calendarId,
      resource: updatedCalendar
    });

    return {
      success: true,
      calendar: response.data,
      message: "Calendar updated successfully"
    };

  } catch (error) {
    console.error('Error updating calendar:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a secondary calendar
 */
async function deleteCalendar(userIdentifier, calendarId) {
  try {
    const { calendar } = await getCalendarClient(userIdentifier);

    if (!calendarId || calendarId === 'primary') {
      throw new Error("Cannot delete primary calendar. Please provide a secondary calendar ID.");
    }

    await calendar.calendars.delete({
      calendarId: calendarId
    });

    return {
      success: true,
      calendarId: calendarId,
      message: "Calendar deleted successfully"
    };

  } catch (error) {
    console.error('Error deleting calendar:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update response status for an event
 */
async function respondToEvent(userIdentifier, eventId, responseStatus, calendarId = 'primary') {
  try {
    const { calendar } = await getCalendarClient(userIdentifier);

    if (!eventId) {
      throw new Error("Event ID is required");
    }

    const validResponses = ['accepted', 'declined', 'tentative', 'needsAction'];
    if (!validResponses.includes(responseStatus)) {
      throw new Error(`Invalid response status. Must be one of: ${validResponses.join(', ')}`);
    }

    // Get the current user's email
    const { email } = await getCalendarClient(userIdentifier);

    // Get the event
    const event = await calendar.events.get({
      calendarId: calendarId,
      eventId: eventId
    });

    // Find the attendee and update their response
    const attendees = event.data.attendees || [];
    const attendeeIndex = attendees.findIndex(a => a.email === email);

    if (attendeeIndex !== -1) {
      attendees[attendeeIndex].responseStatus = responseStatus;
    } else {
      // Add the user as an attendee with the response
      attendees.push({
        email: email,
        responseStatus: responseStatus
      });
    }

    // Update the event
    const response = await calendar.events.patch({
      calendarId: calendarId,
      eventId: eventId,
      resource: {
        attendees: attendees
      }
    });

    return {
      success: true,
      event: response.data,
      responseStatus: responseStatus,
      message: `Event response updated to: ${responseStatus}`
    };

  } catch (error) {
    console.error('Error responding to event:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  getCalendarClient,
  createEvent,
  getEvents,
  updateEvent,
  deleteEvent,
  getCalendars,
  getCalendar,
  createCalendar,
  updateCalendar,
  deleteCalendar,
  respondToEvent
};
