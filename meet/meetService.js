const { google } = require('googleapis');
const supabase = require('../supabase/supabaseConnect');

// Define OAuth scopes
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/drive.readonly'
];

/**
 * Get Meet API client with user credentials
 */
async function getMeetClient(userIdentifier) {
  try {
    // Get tokens from Supabase meet_tokens table
    let query = supabase.from("meet_tokens").select("access_token, refresh_token, email, user_id");
    
    // Check if userIdentifier is an email or user_id
    if (userIdentifier.includes('@')) {
      query = query.eq("email", userIdentifier);
    } else {
      query = query.eq("user_id", userIdentifier);
    }
    
    const { data: tokenRow, error } = await query.single();

    if (error || !tokenRow) {
      throw new Error("User tokens not found");
    }

    // Create OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_MEET_CLIENT_ID,
      process.env.GOOGLE_MEET_CLIENT_SECRET,
      process.env.GOOGLE_MEET_REDIRECT_URI
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
        .from("meet_tokens")
        .update({
          access_token: tokens.access_token,
          expiry_date: tokens.expiry_date || null,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", tokenRow.user_id);
    });

    // Google Meet API uses the Meet v2 API
    const meet = google.meet({ version: 'v2', auth: oAuth2Client });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    
    return { meet, drive, oAuth2Client, userId: tokenRow.user_id, email: tokenRow.email };

  } catch (error) {
    console.error('Error getting Meet client:', error);
    throw error;
  }
}

/**
 * Create a new Google Meet meeting space
 */
async function createMeetingSpace(userIdentifier) {
  try {
    const { meet, email } = await getMeetClient(userIdentifier);
    
    // Create a new meeting space
    const response = await meet.spaces.create({
      requestBody: {}
    });

    const space = response.data;
    
    return {
      success: true,
      space: {
        name: space.name,
        meetingUri: space.meetingUri,
        meetingCode: space.meetingCode,
        config: space.config
      },
      email
    };

  } catch (error) {
    console.error('Error creating meeting space:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get details of an existing meeting space
 */
async function getMeetingSpace(userIdentifier, spaceName) {
  try {
    const { meet, email } = await getMeetClient(userIdentifier);
    
    // Get meeting space details
    const response = await meet.spaces.get({
      name: spaceName
    });

    const space = response.data;
    
    return {
      success: true,
      space: {
        name: space.name,
        meetingUri: space.meetingUri,
        meetingCode: space.meetingCode,
        config: space.config,
        activeConference: space.activeConference
      },
      email
    };

  } catch (error) {
    console.error('Error getting meeting space:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * End an active conference in a meeting space
 */
async function endActiveConference(userIdentifier, spaceName) {
  try {
    const { meet, email } = await getMeetClient(userIdentifier);
    
    // End the active conference
    const response = await meet.spaces.endActiveConference({
      name: spaceName
    });

    return {
      success: true,
      message: "Conference ended successfully",
      email
    };

  } catch (error) {
    console.error('Error ending conference:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List conferences in a meeting space
 */
async function listConferences(userIdentifier, spaceName, pageSize = 20, pageToken = null) {
  try {
    const { meet, email } = await getMeetClient(userIdentifier);
    
    const params = {
      parent: spaceName,
      pageSize: Math.min(pageSize, 100)
    };
    
    if (pageToken) {
      params.pageToken = pageToken;
    }
    
    // List conferences
    const response = await meet.conferenceRecords.list(params);

    const conferences = response.data.conferenceRecords || [];
    
    return {
      success: true,
      conferences: conferences.map(conf => ({
        name: conf.name,
        startTime: conf.startTime,
        endTime: conf.endTime,
        space: conf.space
      })),
      nextPageToken: response.data.nextPageToken || null,
      count: conferences.length,
      email
    };

  } catch (error) {
    console.error('Error listing conferences:', error);
    return {
      success: false,
      error: error.message,
      conferences: []
    };
  }
}

/**
 * Get a specific conference record
 */
async function getConference(userIdentifier, conferenceName) {
  try {
    const { meet, email } = await getMeetClient(userIdentifier);
    
    // Get conference details
    const response = await meet.conferenceRecords.get({
      name: conferenceName
    });

    const conference = response.data;
    
    return {
      success: true,
      conference: {
        name: conference.name,
        startTime: conference.startTime,
        endTime: conference.endTime,
        space: conference.space
      },
      email
    };

  } catch (error) {
    console.error('Error getting conference:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List recordings for a conference
 */
async function listRecordings(userIdentifier, conferenceName, pageSize = 20, pageToken = null) {
  try {
    const { meet, email } = await getMeetClient(userIdentifier);
    
    const params = {
      parent: conferenceName,
      pageSize: Math.min(pageSize, 100)
    };
    
    if (pageToken) {
      params.pageToken = pageToken;
    }
    
    // List recordings
    const response = await meet.conferenceRecords.recordings.list(params);

    const recordings = response.data.recordings || [];
    
    return {
      success: true,
      recordings: recordings.map(rec => ({
        name: rec.name,
        driveDestination: rec.driveDestination,
        startTime: rec.startTime,
        endTime: rec.endTime,
        state: rec.state
      })),
      nextPageToken: response.data.nextPageToken || null,
      count: recordings.length,
      email
    };

  } catch (error) {
    console.error('Error listing recordings:', error);
    return {
      success: false,
      error: error.message,
      recordings: []
    };
  }
}

/**
 * Get a specific recording
 */
async function getRecording(userIdentifier, recordingName) {
  try {
    const { meet, email } = await getMeetClient(userIdentifier);
    
    // Get recording details
    const response = await meet.conferenceRecords.recordings.get({
      name: recordingName
    });

    const recording = response.data;
    
    return {
      success: true,
      recording: {
        name: recording.name,
        driveDestination: recording.driveDestination,
        startTime: recording.startTime,
        endTime: recording.endTime,
        state: recording.state
      },
      email
    };

  } catch (error) {
    console.error('Error getting recording:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List participants in a conference
 */
async function listParticipants(userIdentifier, conferenceName, pageSize = 20, pageToken = null) {
  try {
    const { meet, email } = await getMeetClient(userIdentifier);
    
    const params = {
      parent: conferenceName,
      pageSize: Math.min(pageSize, 100)
    };
    
    if (pageToken) {
      params.pageToken = pageToken;
    }
    
    // List participants
    const response = await meet.conferenceRecords.participants.list(params);

    const participants = response.data.participants || [];
    
    return {
      success: true,
      participants: participants.map(p => ({
        name: p.name,
        earliestStartTime: p.earliestStartTime,
        latestEndTime: p.latestEndTime,
        signedinUser: p.signedinUser,
        anonymousUser: p.anonymousUser,
        phoneUser: p.phoneUser
      })),
      nextPageToken: response.data.nextPageToken || null,
      count: participants.length,
      email
    };

  } catch (error) {
    console.error('Error listing participants:', error);
    return {
      success: false,
      error: error.message,
      participants: []
    };
  }
}

module.exports = {
  createMeetingSpace,
  getMeetingSpace,
  endActiveConference,
  listConferences,
  getConference,
  listRecordings,
  getRecording,
  listParticipants
};
