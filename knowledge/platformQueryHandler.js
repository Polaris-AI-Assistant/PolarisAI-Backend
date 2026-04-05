/**
 * Platform Query Handler - LLM-Based Detection
 * 
 * Uses LLM classification to detect platform knowledge questions about Polaris AI
 * instead of regex patterns. This approach:
 * - Works in any language (multilingual support)
 * - Understands semantic meaning, not just keywords
 * - Aligns with the platform's NLP-first philosophy
 * - Handles edge cases and variations naturally
 * 
 * This provides instant, consistent responses for questions like:
 * - "Who are you?" (works in any language)
 * - "What can you do?"
 * - "Tell me your capabilities"
 * - "How does memory work?"
 * 
 * Quick LLM call (temperature=0.1, deterministic) before any other processing.
 */

const OpenAI = require('openai');
const { POLARIS_IDENTITY, AGENT_CAPABILITIES } = require('./polarisKnowledge');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Detect if a query is asking about Polaris platform itself using LLM
 * Fast, deterministic classification - works in any language
 */
async function detectPlatformQuery(query) {
  if (!query || typeof query !== 'string') return { isPlatformQuery: false };
  
  try {
    const classificationPrompt = `You are determining whether a user query is asking about the Polaris AI platform itself.

Polaris is: An intelligent multi-agent productivity platform that connects Gmail, Calendar, Docs, 
Sheets, Forms, GitHub, Microsoft 365, Flights, Maps, Web Search, Deep Research, and Reminders.

CLASSIFY the query as ONE of:
- "identity": User asking who/what Polaris is
- "overview": User asking what Polaris can do / capabilities
- "agent_[NAME]": User asking about a specific agent (e.g., "agent_gmail", "agent_github")
- "integrations": User asking what services are connected
- "memory": User asking how memory/remembering works
- "not_platform": Query is NOT about Polaris platform (e.g., "send an email", "create a doc")

EXAMPLES:
- "Who are you?" → identity
- "What can you do?" → overview  
- "What Gmail tasks?" → agent_gmail
- "Tell me about your capabilities" → overview
- "What services do you support?" → integrations
- "How does memory work?" → memory
- "Send email to john" → not_platform (ACTION query, not about Polaris)
- "What's the capital of France?" → not_platform (KNOWLEDGE query, not about Polaris)
- "누가 너야?" (Korean "who are you") → identity
- "que puedes hacer?" (Spanish "what can you do") → overview

User Query: "${query}"

Respond with ONLY JSON (no markdown):
{
  "isPlatformQuery": true/false,
  "type": "identity" | "overview" | "agent_*" | "integrations" | "memory" | "not_platform",
  "agent": "gmail" | "calendar" | ... | null,
  "confidence": 0.0-1.0
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: classificationPrompt }],
      temperature: 0.1, // Deterministic
      max_tokens: 100,
    });

    const responseText = response.choices[0].message.content.trim();
    const classification = JSON.parse(responseText);
    
    if (classification.type === 'not_platform') {
      return { isPlatformQuery: false };
    }
    
    // Map "agent_*" type to proper format
    let type = classification.type;
    let agent = null;
    if (type.startsWith('agent_')) {
      agent = type.replace('agent_', '');
      type = 'agent';
    }
    
    return {
      isPlatformQuery: classification.isPlatformQuery,
      type,
      agent,
      confidence: classification.confidence
    };
  } catch (error) {
    console.error('[PlatformQueryHandler] Error in LLM classification:', error.message);
    // Fallback: be conservative and return false (let it go through normal pipeline)
    return { isPlatformQuery: false };
  }
}

function buildIdentityResponse() {
  return `# ${POLARIS_IDENTITY.name}
*${POLARIS_IDENTITY.tagline}*

${POLARIS_IDENTITY.description}

## What I Can Do For You

I connect to **${Object.keys(AGENT_CAPABILITIES).length} specialized agents** to help you manage everything in one place:

${Object.values(AGENT_CAPABILITIES).map(a => 
  `- **${a.displayName}** — ${a.description}`
).join('\n')}

## How It Works
Just tell me what you need in plain English — I'll figure out which tools to use and get it done. I can handle tasks that require multiple apps simultaneously (e.g., "Create a form and email the link to my team").

I also have **long-term memory** — I remember your preferences and past interactions to give you more personalized assistance over time.

What would you like to do?`;
}

function buildOverviewResponse() {
  const agents = Object.values(AGENT_CAPABILITIES);
  return `# Everything I Can Do

Here's a complete overview of my capabilities across all **${agents.length} integrated services**:

${agents.map(a => `## ${a.displayName}
${a.description}

**Key capabilities:**
${a.capabilities.slice(0, 4).map(c => `- ${c}`).join('\n')}

**Example commands:**
${a.examples.slice(0, 2).map(e => `- "${e}"`).join('\n')}

---
`).join('\n')}

## Cross-App Workflows
I can combine multiple agents in one request:
- *"Create a feedback form and email it to the team"* → Forms + Gmail
- *"Schedule a meeting and send invites"* → Calendar + Gmail
- *"Research a topic, create a doc, and share it"* → Research + Docs + Gmail

## Smart Features
- **Long-term Memory** — I remember your preferences across sessions
- **Confirmation Flow** — I ask before taking sensitive actions like sending emails
- **Deep Research** — Multi-source research with 50+ citations
- **File Generation** — Export responses as PDF or text files
- **Multi-language** — I respond in your language automatically

## What Would You Like To Get Started?

Try asking me to:
- Create and share documents
- Schedule meetings with Google Meet
- Manage your emails and inbox
- Search the web or research topics
- Set reminders or automate tasks

Just tell me what you need!`;
}

function buildAgentResponse(agentKey) {
  const agent = AGENT_CAPABILITIES[agentKey];
  if (!agent) return null;

  return `# ${agent.displayName}

*${agent.description}*

## What I Can Do

${agent.capabilities.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Example Commands

Here are things you can ask me to do:

${agent.examples.map(e => `> "${e}"`).join('\n')}

## Ready to Get Started?

Just describe what you need, and I'll handle it. For example:

- ${agent.examples[0]}
- ${agent.examples[1] || 'Tell me how to use this service'}`;
}

function buildIntegrationsResponse() {
  return `# Connected Integrations

Polaris AI currently integrates with **${Object.keys(AGENT_CAPABILITIES).length} services** to help you manage all your productivity tools in one place:

## Google Workspace
- **Gmail** - Email management and communication
- **Google Calendar** - Event scheduling and meeting management
- **Google Docs** - Document creation and collaboration
- **Google Sheets** - Spreadsheet operations
- **Google Forms** - Survey and form creation
- **Google Meet** - Video meeting integration with calendar

## Microsoft 365
- **Outlook** - Email and calendar management
- **Word** - Document creation and editing
- **Excel** - Spreadsheet management
- **Teams** - Team communication and meetings
- **OneDrive** - File storage and sharing

## Developer Tools
- **GitHub** - Repository management, files, issues, and pull requests

## Web & Research
- **Web Search** - Real-time web search and news
- **Deep Research** - Comprehensive multi-source research (50+ sources)

## Travel & Productivity
- **Flights** - Flight search and travel planning
- **Maps** - Location search and directions
- **Reminders & Scheduling** - Smart reminders and automated scheduling

## AI Features
- **Long-Term Memory** - Remembers your preferences and past interactions
- **Multi-language Support** - Responds in your preferred language
- **File Generation** - Export content as PDF or text files
- **Confirmation Flow** - User control over sensitive actions

## Coming Soon
More integrations are in development, including:
- Slack, Notion, Trello, Asana, and more

## How to Connect

Just ask me to use any of these services! For example:
- "Send an email to john@example.com"
- "Schedule a team meeting tomorrow at 2 PM"
- "Create a budget spreadsheet"
- "Search GitHub for React projects"

What would you like to do?`;
}

function handlePlatformQuery(query) {
  const detection = detectPlatformQuery(query);
  if (!detection.isPlatformQuery) return null;

  switch (detection.type) {
    case 'identity':
      return buildIdentityResponse();
    case 'overview':
      return buildOverviewResponse();
    case 'agent':
      return buildAgentResponse(detection.agent);
    case 'integrations':
      return buildIntegrationsResponse();
    case 'examples':
      return buildOverviewResponse(); // reuse with examples
    default:
      return null;
  }
}

module.exports = { detectPlatformQuery, handlePlatformQuery };
