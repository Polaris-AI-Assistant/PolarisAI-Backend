/**
 * Polaris Knowledge Base
 * 
 * Static structured data about Polaris AI platform, its agents, capabilities,
 * and integrations. This module provides instant answers to platform-specific
 * questions without requiring LLM calls.
 * 
 * Used by platformQueryHandler to answer questions like:
 * - "Who are you?"
 * - "What can you do?"
 * - "What Gmail tasks can you perform?"
 * - "How does memory work?"
 */

const POLARIS_IDENTITY = {
  name: 'Polaris AI',
  tagline: 'Your intelligent companion for effortless productivity',
  description: `Polaris AI is a multi-agent AI platform that lets you manage all your productivity tools — Gmail, Google Calendar, Docs, Sheets, Forms, GitHub, Microsoft 365, and more — through a single conversational interface. Instead of switching between apps, you just tell Polaris what you need in plain English.`,
  builtWith: 'GPT-4o-mini for reasoning, OpenAI embeddings for memory, Supabase for storage',
  version: '2.0.0'
};

const AGENT_CAPABILITIES = {
  gmail: {
    displayName: 'Gmail',
    icon: 'mail',
    description: 'Full email management through natural language',
    capabilities: [
      'Send emails to one or multiple recipients',
      'Read and summarize your inbox or specific emails',
      'Search emails by sender, subject, keyword, or date',
      'Reply to and forward emails',
      'Mark emails as read/unread',
      'Create and manage email drafts',
      'Organize emails with labels and filters',
      'Check unread email count',
      'Send emails with file attachments'
    ],
    examples: [
      'Send an email to john@example.com about the project update',
      'Show me my unread emails from today',
      'Search for emails from Sarah about the invoice',
      'Reply to the last email from my manager',
      'Send the project proposal document to my team'
    ]
  },
  calendar: {
    displayName: 'Google Calendar',
    icon: 'calendar',
    description: 'Smart scheduling and event management',
    capabilities: [
      'Create events with title, time, location, and description',
      'Automatically add Google Meet links to events',
      'View upcoming events (today, this week, specific dates)',
      'Update existing events (time, title, description)',
      'Delete or cancel events',
      'Schedule recurring events',
      'Check availability and free slots',
      'Send calendar invites to attendees'
    ],
    examples: [
      'Schedule a team meeting tomorrow at 2 PM with Google Meet',
      'Show me my events for this week',
      'Move my 3 PM meeting to 4 PM',
      'Create a recurring standup every Monday at 10 AM',
      'Cancel my meeting with John on Friday'
    ]
  },
  docs: {
    displayName: 'Google Docs',
    icon: 'file-text',
    description: 'Document creation, editing, and sharing',
    capabilities: [
      'Create new Google Docs with AI-generated content',
      'Add, update, or replace content in existing documents',
      'Share documents with specific people or make public',
      'Search your documents by name or content',
      'Read and summarize document contents',
      'Export documents as PDF'
    ],
    examples: [
      'Create a project proposal document for our new app',
      'Add a section about budget to my project doc',
      'Share the Q4 report with my team',
      'Find my document about marketing strategy'
    ]
  },
  sheets: {
    displayName: 'Google Sheets',
    icon: 'table',
    description: 'Spreadsheet operations and data management',
    capabilities: [
      'Create new spreadsheets with custom data',
      'Read and summarize spreadsheet data',
      'Add rows, columns, or update cell values',
      'Create charts and apply formulas',
      'Share spreadsheets with collaborators',
      'Search across your spreadsheets'
    ],
    examples: [
      'Create a budget tracker spreadsheet for Q1',
      'Add this week\'s sales data to my revenue sheet',
      'Show me the data in my inventory spreadsheet'
    ]
  },
  forms: {
    displayName: 'Google Forms',
    icon: 'file-text',
    description: 'Survey and form creation',
    capabilities: [
      'Create forms and surveys with custom questions',
      'Support multiple question types (multiple choice, text, rating, etc.)',
      'Share form links via email',
      'View form responses',
      'Create event registration forms'
    ],
    examples: [
      'Create a customer feedback form with 5 questions',
      'Make an event registration form for our conference',
      'Create a weekly team survey and email it to the team'
    ]
  },
  github: {
    displayName: 'GitHub',
    icon: 'github',
    description: 'Repository and code management',
    capabilities: [
      'Create new repositories (public or private)',
      'List your repositories',
      'Create, read, and update files in repos',
      'Create and manage issues',
      'Open pull requests',
      'Add README files',
      'Search code and repositories'
    ],
    examples: [
      'Create a new private repo called my-project',
      'Add a README to my portfolio repo',
      'Create an issue about the login bug in my-app',
      'Show me my recent repositories',
      'Open a PR from feature-branch to main'
    ]
  },
  microsoft: {
    displayName: 'Microsoft 365',
    icon: 'bot',
    description: 'Outlook, Word, Excel, Teams, and OneDrive',
    capabilities: [
      'Send and read Outlook emails',
      'Create and manage Outlook calendar events',
      'Create Word documents',
      'Create and edit Excel spreadsheets',
      'Upload and manage OneDrive files',
      'Create Teams meetings'
    ],
    examples: [
      'Send an Outlook email to my colleague about the deadline',
      'Schedule a Teams meeting for tomorrow',
      'Create a Word document with the project summary'
    ]
  },
  flights: {
    displayName: 'Flights',
    icon: 'plane',
    description: 'Flight search and travel planning',
    capabilities: [
      'Search one-way and round-trip flights',
      'Compare prices across airlines',
      'Filter by date, stops, and price range',
      'Show flight duration and departure times'
    ],
    examples: [
      'Find flights from Mumbai to Delhi on March 20',
      'Search round-trip flights from Bangalore to London next month',
      'Show me the cheapest flights to Goa this weekend'
    ]
  },
  maps: {
    displayName: 'Maps',
    icon: 'map',
    description: 'Location search and directions',
    capabilities: [
      'Search for places and businesses',
      'Get directions between locations',
      'Find nearby restaurants, hotels, or services',
      'Calculate distance and travel time',
      'Geocoding and reverse geocoding'
    ],
    examples: [
      'Find the best rated restaurants near Connaught Place Delhi',
      'How far is Mumbai from Pune?',
      'Find coffee shops near my location'
    ]
  },
  websearch: {
    displayName: 'Web Search',
    icon: 'search',
    description: 'Real-time web, news, and image search',
    capabilities: [
      'Search the web for current information',
      'Find recent news articles',
      'Search for images',
      'Get stock prices and financial data',
      'Find product information and reviews'
    ],
    examples: [
      'What are the latest developments in quantum computing?',
      'Search for news about the Indian budget 2026',
      'Find images of the Northern Lights'
    ]
  },
  research: {
    displayName: 'Deep Research',
    icon: 'brain',
    description: 'Comprehensive multi-source research with synthesis',
    capabilities: [
      'Conduct deep research across 50+ sources',
      'Search multiple sub-topics automatically',
      'Synthesize findings into structured reports',
      'Cross-reference information across sources',
      'Generate 2000+ word comprehensive reports'
    ],
    examples: [
      'Do a deep research on emerging trends in renewable energy',
      'Research the competitive landscape of SaaS CRM tools',
      'Give me a comprehensive analysis of quantum computing progress'
    ]
  },
  schedules: {
    displayName: 'Reminders & Scheduling',
    icon: 'clock',
    description: 'Smart reminders and automated scheduling',
    capabilities: [
      'Set one-time reminders for any date and time',
      'Create recurring reminders (daily, weekly, monthly)',
      'Schedule automated tasks',
      'Email notifications when reminders trigger',
      'Support for complex cron patterns',
      'Timezone-aware scheduling'
    ],
    examples: [
      'Remind me to call the client tomorrow at 3 PM',
      'Set a reminder to back up files every Friday at 5 PM',
      'Remind me about the deadline on March 15 at 9 AM'
    ]
  },
  memory: {
    displayName: 'Long-Term Memory',
    icon: 'database',
    description: 'Polaris remembers your preferences and past interactions',
    capabilities: [
      'Remembers your preferences and habits automatically',
      'Recalls past tasks and their context',
      'Learns your frequent workflows',
      'Uses memories to give personalized responses',
      'Semantic search — finds relevant memories even with different wording',
      'You can view and delete stored memories in Settings'
    ],
    examples: [
      'Schedule my usual Monday standup',
      'Remember that I prefer formal email tone',
      'What do you know about me?',
      'Forget my email preferences'
    ]
  }
};

const PLATFORM_FAQS = {
  what_can_you_do: 'overview',
  who_are_you: 'identity',
  how_do_you_work: 'architecture',
  what_integrations: 'integrations',
  how_is_memory: 'memory',
  is_data_safe: 'security',
  what_languages: 'languages'
};

module.exports = { POLARIS_IDENTITY, AGENT_CAPABILITIES, PLATFORM_FAQS };
