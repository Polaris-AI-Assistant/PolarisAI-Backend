const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const supabase = require('./supabase/supabaseConnect');
const { initializeSocket } = require('./socket/socketManager');
const agentRoutes = require('./gmail/agentConnect');
const authRoutes = require('./auth/auth');
const gmailRoutes = require('./gmail/gmailData');
const gmailAgentRoutes = require('./gmail/gmailAgentController');
const embeddingRoutes = require('./gmail/embeddingRoutes');
const githubRoutes = require('./github/connectGithub');
const githubStatusRoutes = require('./github/githubStatus');

const githubAgentRoutes = require('./github/githubAgentController');

// Forms routes
const formsAuthRoutes = require('./forms/formsAuth');
const formsDataRoutes = require('./forms/formsData');
const formsAgentRoutes = require('./forms/formsAgentController');

// Calendar routes
const calendarAuthRoutes = require('./calendar/calendarAuth');
const calendarDataRoutes = require('./calendar/calendarData');
const calendarAgentRoutes = require('./calendar/calendarAgentController');

// Sheets routes
const sheetsAuthRoutes = require('./sheets/sheetsAuth');
const sheetsDataRoutes = require('./sheets/sheetsData');
const sheetsAgentRoutes = require('./sheets/sheetsAgentController');

// Docs routes
const docsAuthRoutes = require('./docs/docsAuth');
const docsDataRoutes = require('./docs/docsData');
const docsAgentRoutes = require('./docs/docsAgentController');

// Meet routes
const meetAuthRoutes = require('./meet/meetAuth');
const meetDataRoutes = require('./meet/meetData');
const meetAgentRoutes = require('./meet/meetAgentController');

// Flights routes
const flightsAgentRoutes = require('./flights/flightsAgentController');

// Maps routes
const mapsAgentRoutes = require('./maps/mapsAgentController');

// Main Coordinator Agent routes
const mainAgentRoutes = require('./mainAgent/mainAgentController');

// Chat History routes
const chatRoutes = require('./chat/chatController');

// Memory routes
const memoryRoutes = require('./memory/memoryController');
const memorySettingsRoutes = require('./memory/memorySettingsController');

// User Settings routes
const userSettingsRoutes = require('./user/userSettingsController');

// Microsoft routes
const microsoftAuthRoutes = require('./microsoft/microsoftAuth');
const microsoftAgentRoutes = require('./microsoft/microsoftAgentController');

// File upload routes
const filesRoutes = require('./files/filesRoutes');

// Vault (file management) routes
const vaultRoutes = require('./files/vaultRoutes');

// Schedule routes
const scheduleRoutes = require('./schedules/scheduleController');
const scheduleEngine = require('./schedules/scheduleEngine');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

// Initialize Socket.io on the HTTP server
const io = initializeSocket(server, {
  corsOrigin: process.env.FRONTEND_URL || '*',
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-user-id'],
  credentials: true,
}));

// Use authentication routes
app.use('/api/auth', authRoutes);

// Use agent routes (Gmail OAuth)
app.use('/api', agentRoutes);

// Use Gmail data routes
app.use('/api', gmailRoutes);

// Use Gmail AI Agent routes
app.use('/api/gmail', gmailAgentRoutes);

// Use embedding routes
app.use('/api', embeddingRoutes);

// Use Forms routes
app.use('/api', formsAuthRoutes);
app.use('/api', formsDataRoutes);

// Use Forms AI Agent routes
app.use('/api/forms', formsAgentRoutes);

// Use Calendar routes
app.use('/api', calendarAuthRoutes);
app.use('/api', calendarDataRoutes);

// Use Calendar AI Agent routes
app.use('/api/calendar', calendarAgentRoutes);

// Use Sheets routes
app.use('/api', sheetsAuthRoutes);
app.use('/api', sheetsDataRoutes);

// Use Sheets AI Agent routes
app.use('/api/sheets', sheetsAgentRoutes);

// Use Docs routes
app.use('/api', docsAuthRoutes.router);
app.use('/api', docsDataRoutes);

// Use Docs AI Agent routes
app.use('/api/docs', docsAgentRoutes);

// Use Meet routes
app.use('/api', meetAuthRoutes);
app.use('/api', meetDataRoutes);

// Use Meet AI Agent routes
app.use('/api/meet', meetAgentRoutes);

// Use Flights AI Agent routes
app.use('/api/flights', flightsAgentRoutes);

// Use Maps AI Agent routes
app.use('/api/maps', mapsAgentRoutes);

// Use GitHub authentication routes
app.use('/api/auth/github', githubRoutes);

// Use GitHub status and utility routes
app.use('/api/github', githubStatusRoutes);

// Use GitHub AI Agent routes
app.use('/api/github', githubAgentRoutes);

// Use Main Coordinator Agent routes (should be before specific agent routes for priority)
app.use('/api/agent', mainAgentRoutes);

// Use Chat History routes
app.use('/api/chat', chatRoutes);

// Use Memory routes
app.use('/api/memory', memoryRoutes);

// Use Memory Settings routes
app.use('/api/settings', memorySettingsRoutes);

// Use User Settings routes
app.use('/api/user', userSettingsRoutes);

// Use Microsoft routes
app.use('/api', microsoftAuthRoutes.router);
app.use('/api/microsoft', microsoftAgentRoutes);

// Use File upload routes
app.use('/api', filesRoutes);

// Use Vault (file management) routes
app.use('/api/vault', vaultRoutes);

// Use Schedule routes
app.use('/api/schedules', scheduleRoutes);

// Health check route
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const { data, error } = await supabase.from('gmail_tokens').select('count', { count: 'exact', head: true });
    
    if (error) throw error;
    
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API documentation route
app.get('/api', (req, res) => {
  res.json({
    message: 'FYP AI Agent Integration API',
    version: '2.0.0',
    description: 'Multi-agent AI system for Google Workspace, GitHub, and more',
    endpoints: {
      mainAgent: {
        'POST /api/agent/query': 'Process queries using the Main Coordinator Agent (multi-service support)',
        'GET /api/agent/info': 'Get information about all available agents',
        'GET /api/agent/examples': 'Get example queries for single and multi-agent scenarios',
        'GET /api/agent/health': 'Health check for the main agent system',
        'POST /api/agent/test': 'Test endpoint (development only)'
      },
      memory: {
        'POST /api/memory/add': 'Add a conversation to long-term memory',
        'POST /api/memory/retrieve': 'Retrieve relevant memories using semantic search',
        'GET /api/memory/list': 'List all memories for a user',
        'DELETE /api/memory/:id': 'Delete a specific memory'
      },
      schedules: {
        'POST /api/schedules': 'Create a new schedule (reminder or action)',
        'GET /api/schedules': 'List user schedules (filter by status)',
        'GET /api/schedules/:id': 'Get a specific schedule',
        'PATCH /api/schedules/:id': 'Update a schedule',
        'DELETE /api/schedules/:id': 'Delete a schedule',
        'POST /api/schedules/:id/pause': 'Pause a schedule',
        'POST /api/schedules/:id/resume': 'Resume a paused schedule'
      },
      specializedAgents: {
        'POST /api/calendar/agent/query': 'Google Calendar AI Agent',
        'POST /api/docs/agent/query': 'Google Docs AI Agent',
        'POST /api/forms/agent/query': 'Google Forms AI Agent',
        'POST /api/github/agent/query': 'GitHub AI Agent',
        'POST /api/gmail/agent/query': 'Gmail AI Agent',
        'GET /api/gmail/agent/examples': 'Get Gmail agent example queries',
        'GET /api/gmail/agent/capabilities': 'Get Gmail agent capabilities',
        'POST /api/meet/agent/query': 'Google Meet AI Agent',
        'POST /api/sheets/agent/query': 'Google Sheets AI Agent',
        'POST /api/flights/agent/query': 'Flights Search AI Agent (SerpAPI Google Flights)',
        'GET /api/flights/agent/examples': 'Get flight search example queries',
        'GET /api/flights/agent/airports': 'Get list of common airport codes',
        'GET /api/flights/agent/status': 'Check flights agent status',
        'POST /api/maps/agent/query': 'Google Maps AI Agent (places, directions, geocoding)',
        'GET /api/maps/agent/examples': 'Get Maps agent example queries',
        'GET /api/maps/agent/capabilities': 'Get Maps agent capabilities',
        'GET /api/maps/agent/place-types': 'Get list of supported place types',
        'GET /api/maps/agent/status': 'Check Maps agent status'
      },
      auth: {
        'POST /api/auth/signup': 'Create new user account',
        'POST /api/auth/signin': 'Sign in user',
        'POST /api/auth/signout': 'Sign out user',
        'GET /api/auth/user': 'Get current user (requires Bearer token)',
        'POST /api/auth/refresh': 'Refresh access token',
        'POST /api/auth/reset-password': 'Request password reset',
        'POST /api/auth/update-password': 'Update user password (requires Bearer token)'
      },
      gmail: {
        'GET /api/auth/gmail': 'Start Gmail OAuth flow',
        'GET /api/auth/gmail/url': 'Get Gmail OAuth URL',
        'GET /api/auth/gmail/url/authenticated': 'Get Gmail OAuth URL for authenticated user',
        'GET /api/auth/gmail/callback': 'Handle Gmail OAuth callback',
        'POST /api/auth/gmail/disconnect': 'Disconnect Gmail (requires auth)',
        'GET /api/gmail/status': 'Check Gmail connection status (requires auth)',
        'POST /api/gmail/fetch-and-embed': 'Manually fetch and embed Gmail messages (requires auth)',
        'GET /api/gmail/stats': 'Get Gmail statistics (requires auth)',
        'POST /api/gmail/send': 'Send email via Gmail (requires auth)',
        'GET /api/gmail/connection/:userIdentifier': 'Check Gmail connection status',
        'GET /api/gmail/:userIdentifier': 'Fetch and store Gmail messages',
        'GET /api/gmail/:userIdentifier/messages': 'Get stored Gmail messages',
        'GET /api/gmail/:userIdentifier/search': 'Search Gmail messages',
        'GET /api/gmail/:userIdentifier/stats': 'Get Gmail statistics'
      }
    },
    features: [
      'Main Coordinator Agent for multi-service queries',
      'Long-term semantic memory with vector embeddings',
      'Specialized agents for each service',
      'Parallel and sequential execution',
      'Intelligent query routing',
      'Natural language processing'
    ],
    notes: [
      'Use /api/agent/query for queries that may involve multiple services',
      'Use specialized agent endpoints for service-specific queries',
      'userIdentifier can be either email address or user_id',
      'Most endpoints require authentication with Bearer token',
      'Use /health endpoint to check API status'
    ]
  });
});

// Example route (for testing database connection)
app.get('/test-db', async (req, res) => {
  try {
    // Example: fetch data from gmail_tokens table
    const { data, error } = await supabase.from('gmail_tokens').select('email, created_at').limit(5);
    if (error) throw error;
    
    res.json({ 
      message: 'Database connection successful',
      sampleData: data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} does not exist`,
    availableRoutes: '/api for documentation'
  });
});

server.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 API documentation available at http://localhost:${port}/api`);
  console.log(`❤️  Health check available at http://localhost:${port}/health`);
  console.log(`🔌 Socket.io ready for WebSocket connections`);

  // Start the self-hosted schedule engine
  scheduleEngine.start();
});
