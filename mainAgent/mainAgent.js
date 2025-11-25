/**
 * Main Coordinator Agent
 * 
 * This is the central agent that coordinates all app-specific agents.
 * It analyzes user requests, determines which specialized agents are needed,
 * routes queries to appropriate agents, and combines their responses into
 * a coherent final output.
 * 
 * Features:
 * - Natural language query analysis and intent detection
 * - Multi-agent coordination and routing
 * - Response aggregation and deduplication
 * - Intelligent context management
 * - Comprehensive error handling
 * - Support for single and multi-app queries
 * 
 * Available Agents:
 * - CalendarAgent: Google Calendar operations
 * - DocsAgent: Google Docs operations
 * - FormsAgent: Google Forms operations
 * - GitHubAgent: GitHub operations
 * - MeetAgent: Google Meet operations
 * - SheetsAgent: Google Sheets operations
 * 
 * Usage:
 * const mainAgent = new MainAgent();
 * const result = await mainAgent.processQuery("schedule a meeting and create a document", userId);
 */

const OpenAI = require('openai');
const CalendarAgent = require('../calendar/calendarAgent');
const docsAgent = require('../docs/docsAgent'); // Note: This exports functions, not a class
const FormsAgent = require('../forms/formsAgent');
const GitHubAgent = require('../github/githubAgent');
const MeetAgent = require('../meet/meetAgent');
const SheetsAgent = require('../sheets/sheetsAgent');

class MainAgent {
  constructor() {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize all specialized agents
    // Note: docsAgent exports functions, not a class, so we wrap it
    this.agents = {
      calendar: new CalendarAgent(),
      docs: {
        processQuery: (query, userId) => docsAgent.processQuery(query, userId)
      },
      forms: new FormsAgent(),
      github: new GitHubAgent(),
      meet: new MeetAgent(),
      sheets: new SheetsAgent()
    };

    // System prompt for the main coordinator
    this.systemPrompt = this.createSystemPrompt();
  }

  /**
   * Create the system prompt that defines the main agent's behavior
   */
  createSystemPrompt() {
    return `You are an intelligent Main Coordinator Agent that manages multiple specialized agents for different services.

Your responsibilities:
1. Analyze user requests to understand their intent
2. Determine which specialized agent(s) are needed to fulfill the request
3. Route queries to the appropriate agent(s)
4. Combine and structure responses from multiple agents when needed
5. Ensure responses are coherent, non-repetitive, and user-friendly
6. Provide helpful, conversational responses

Available specialized agents and their capabilities:

**CalendarAgent**: Google Calendar operations
- Create, update, delete calendar events
- List events by date range or search criteria
- Manage calendars
- Handle recurring events

**DocsAgent**: Google Docs operations
- Create new documents
- Insert, append, replace, and delete text
- Format text (bold, italic, underline, etc.)
- Add headings, lists, and links
- Share and manage document permissions

**FormsAgent**: Google Forms operations
- Create new forms
- Add and manage questions
- Update form settings
- Retrieve form responses
- List all forms

**GitHubAgent**: GitHub operations
- View profile and repositories
- List commits, issues, pull requests
- Search code and repositories
- View repository statistics
- Filter by language, date, etc.

**MeetAgent**: Google Meet operations
- Create meeting spaces
- Get meeting details
- List conference history
- Manage recordings
- Track participants

**SheetsAgent**: Google Sheets operations
- Create spreadsheets
- Read and write data to cells
- Add/delete rows and columns
- Format cells and ranges
- Share and manage permissions

Guidelines:
- If a request involves multiple services, coordinate the agents appropriately
- Be conversational and friendly in your responses
- If a request is ambiguous, ask clarifying questions
- Always provide context about what actions were taken
- Handle errors gracefully and provide helpful error messages
- Combine related information to avoid redundancy
- Maintain conversation context across multiple queries`;
  }

  /**
   * Analyze the query and determine which agents are needed
   * Uses OpenAI to intelligently route the request
   */
  async analyzeQuery(query, conversationHistory = []) {
    try {
      const analysisPrompt = `Analyze the following user query and determine which specialized agent(s) are needed to fulfill it.

User Query: "${query}"

Available agents:
- calendar: Google Calendar operations (events, meetings, schedules)
- docs: Google Docs operations (create/edit documents, text formatting)
- forms: Google Forms operations (create forms, manage questions, view responses)
- github: GitHub operations (repos, commits, issues, PRs, profile)
- meet: Google Meet operations (create meetings, view history, recordings)
- sheets: Google Sheets operations (create/edit spreadsheets, data management)

Respond with a JSON object containing:
{
  "agents": ["agent1", "agent2"],  // Array of agent names needed (can be one or multiple)
  "reasoning": "Why these agents were chosen",
  "queries": {  // Specific queries to send to each agent
    "agent1": "query for agent1",
    "agent2": "query for agent2"
  },
  "requiresSequential": false,  // true if agents must run in sequence, false if parallel
  "dependencies": {}  // Optional: if sequential, specify dependencies like {"agent2": "agent1"}
}

Examples:
- "schedule a meeting tomorrow" -> {"agents": ["calendar"], ...}
- "create a document and add it to my calendar" -> {"agents": ["docs", "calendar"], "requiresSequential": true, ...}
- "show me my GitHub repos" -> {"agents": ["github"], ...}
- "create a form about customer feedback and a spreadsheet to track responses" -> {"agents": ["forms", "sheets"], ...}

Important:
- Only include agents that are actually needed
- Break down complex multi-step requests appropriately
- Be specific in the queries for each agent
- Consider if operations need to be sequential (e.g., create then link) or can be parallel`;

      const messages = [
        { role: 'system', content: 'You are an expert at analyzing user requests and routing them to appropriate specialized agents. Always respond with valid JSON only, no other text.' },
        { role: 'user', content: analysisPrompt }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using gpt-4o-mini which supports JSON mode and is cost-effective
        messages: messages,
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      console.log('[MainAgent] Query analysis:', JSON.stringify(analysis, null, 2));
      
      return analysis;

    } catch (error) {
      console.error('[MainAgent] Error analyzing query:', error);
      throw new Error(`Failed to analyze query: ${error.message}`);
    }
  }

  /**
   * Execute queries on the specified agents
   */
  async executeAgentQueries(analysis, userId) {
    const results = {};
    const errors = {};

    try {
      if (analysis.requiresSequential) {
        // Execute agents sequentially based on dependencies
        for (const agentName of analysis.agents) {
          try {
            const agentQuery = analysis.queries[agentName];
            console.log(`[MainAgent] Executing ${agentName} sequentially with query: "${agentQuery}"`);
            
            const agent = this.agents[agentName];
            if (!agent) {
              throw new Error(`Agent '${agentName}' not found`);
            }

            const result = await agent.processQuery(agentQuery, userId);
            results[agentName] = result;

          } catch (error) {
            console.error(`[MainAgent] Error executing ${agentName}:`, error);
            errors[agentName] = {
              error: error.message,
              query: analysis.queries[agentName]
            };
          }
        }
      } else {
        // Execute agents in parallel for better performance
        const agentPromises = analysis.agents.map(async (agentName) => {
          try {
            const agentQuery = analysis.queries[agentName];
            console.log(`[MainAgent] Executing ${agentName} in parallel with query: "${agentQuery}"`);
            
            const agent = this.agents[agentName];
            if (!agent) {
              throw new Error(`Agent '${agentName}' not found`);
            }

            const result = await agent.processQuery(agentQuery, userId);
            return { agentName, result };

          } catch (error) {
            console.error(`[MainAgent] Error executing ${agentName}:`, error);
            return { 
              agentName, 
              error: {
                error: error.message,
                query: analysis.queries[agentName]
              }
            };
          }
        });

        const agentResults = await Promise.all(agentPromises);
        
        // Organize results and errors
        agentResults.forEach(({ agentName, result, error }) => {
          if (error) {
            errors[agentName] = error;
          } else {
            results[agentName] = result;
          }
        });
      }

      return { results, errors };

    } catch (error) {
      console.error('[MainAgent] Error executing agent queries:', error);
      throw error;
    }
  }

  /**
   * Combine and structure responses from multiple agents
   */
  async combineResponses(query, analysis, results, errors) {
    try {
      // If only one agent and no errors, return its response directly
      if (Object.keys(results).length === 1 && Object.keys(errors).length === 0) {
        const agentName = Object.keys(results)[0];
        return {
          response: results[agentName].response,
          agentUsed: agentName,
          toolsUsed: results[agentName].tools_used || [],
          singleAgent: true
        };
      }

      // For multiple agents or errors, use AI to create a coherent response
      const combinePrompt = `The user asked: "${query}"

The following agents were used to process this request:
${JSON.stringify(analysis.agents)}

Agent Results:
${JSON.stringify(results, null, 2)}

${Object.keys(errors).length > 0 ? `Errors encountered:\n${JSON.stringify(errors, null, 2)}` : ''}

Please create a single, coherent, user-friendly response that:
1. Combines information from all agent responses
2. Eliminates any redundancy or repetition
3. Presents the information in a natural, conversational way
4. Mentions any errors in a helpful manner
5. Provides clear next steps or confirmation of actions taken
6. Uses a friendly, helpful tone

Do not use phrases like "Agent X said" or "According to the Calendar Agent". 
Instead, present the information as if you're directly reporting the results.`;

      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: combinePrompt }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using same model for consistency
        messages: messages,
        temperature: 0.7
      });

      const combinedResponse = response.choices[0].message.content;

      // Collect all tools used across agents
      const allToolsUsed = [];
      Object.entries(results).forEach(([agentName, result]) => {
        if (result.tools_used) {
          result.tools_used.forEach(tool => {
            allToolsUsed.push({
              agent: agentName,
              tool: tool
            });
          });
        }
      });

      return {
        response: combinedResponse,
        agentsUsed: Object.keys(results),
        toolsUsed: allToolsUsed,
        multiAgent: true,
        errors: Object.keys(errors).length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('[MainAgent] Error combining responses:', error);
      throw new Error(`Failed to combine responses: ${error.message}`);
    }
  }

  /**
   * Main method to process user queries with streaming support
   * This orchestrates the entire flow from analysis to final response with SSE streaming
   */
  async processQueryWithStreaming(query, userId, options = {}, onChunk) {
    const startTime = Date.now();
    
    try {
      console.log(`[MainAgent] Processing streaming query for user ${userId}: "${query}"`);

      // Send initial status
      onChunk({ type: 'status', message: 'Analyzing your request...' });

      // Step 1: Analyze the query to determine which agents are needed
      const analysis = await this.analyzeQuery(query, options.conversationHistory);
      
      // Send analysis result
      onChunk({ 
        type: 'analysis', 
        agents: analysis.agents,
        reasoning: analysis.reasoning 
      });

      // Send status for agent execution
      if (analysis.agents.length === 1) {
        onChunk({ type: 'status', message: `Connecting to ${analysis.agents[0]} agent...` });
      } else {
        onChunk({ type: 'status', message: `Coordinating ${analysis.agents.length} agents...` });
      }

      // Step 2: Execute queries on the appropriate agents
      const { results, errors } = await this.executeAgentQueries(analysis, userId);

      // Send status for response generation
      onChunk({ type: 'status', message: 'Generating response...' });

      // Step 3: Stream the final response generation
      await this.streamCombinedResponse(query, analysis, results, errors, onChunk);

      const processingTime = Date.now() - startTime;

      // Send metadata
      onChunk({ 
        type: 'metadata',
        agentsUsed: analysis.agents,
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[MainAgent] Error processing streaming query:', error);
      onChunk({ 
        type: 'error', 
        error: 'Failed to process query',
        message: error.message 
      });
    }
  }

  /**
   * Stream the combined response using OpenAI's streaming API
   */
  async streamCombinedResponse(query, analysis, results, errors, onChunk) {
    try {
      // Build context for the LLM
      const agentResults = Object.entries(results).map(([agent, result]) => {
        return `${agent.toUpperCase()} Agent Result:\n${JSON.stringify(result, null, 2)}`;
      }).join('\n\n');

      const agentErrors = Object.entries(errors).map(([agent, error]) => {
        return `${agent.toUpperCase()} Agent Error: ${error}`;
      }).join('\n');

      const responsePrompt = `The user asked: "${query}"

Query Analysis:
${JSON.stringify(analysis, null, 2)}

Agent Results:
${agentResults}

${agentErrors ? `Errors encountered:\n${agentErrors}\n` : ''}

Please provide a natural, conversational response to the user that:
1. Directly addresses their request
2. Summarizes what was accomplished
3. Includes relevant details from the agent results
4. Mentions any errors or limitations encountered
5. Is friendly and helpful in tone

Format the response in a clear, readable way. Use bullet points or numbered lists where appropriate.
If events were created, include key details like title, date, time, and location.
Do not include raw JSON or technical details unless specifically relevant.`;

      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: responsePrompt }
      ];

      // Use OpenAI streaming
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        stream: true,
      });

      // Send thinking indicator off
      onChunk({ type: 'thinking', status: 'stop' });

      // Stream each token
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          onChunk({ type: 'content', text: content });
        }
      }

    } catch (error) {
      console.error('[MainAgent] Error streaming response:', error);
      throw error;
    }
  }

  /**
   * Main method to process user queries
   * This orchestrates the entire flow from analysis to final response
   */
  async processQuery(query, userId, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`[MainAgent] Processing query for user ${userId}: "${query}"`);

      // Step 1: Analyze the query to determine which agents are needed
      const analysis = await this.analyzeQuery(query, options.conversationHistory);

      // Step 2: Execute queries on the appropriate agents
      const { results, errors } = await this.executeAgentQueries(analysis, userId);

      // Step 3: Combine responses into a coherent final response
      const finalResponse = await this.combineResponses(query, analysis, results, errors);

      const processingTime = Date.now() - startTime;

      // Return comprehensive result
      return {
        success: true,
        query: query,
        ...finalResponse,
        analysis: {
          reasoning: analysis.reasoning,
          sequential: analysis.requiresSequential || false
        },
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[MainAgent] Error processing query:', error);
      
      return {
        success: false,
        query: query,
        error: 'Failed to process query',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get information about available agents and their capabilities
   */
  getAgentInfo() {
    return {
      mainAgent: {
        name: 'Main Coordinator Agent',
        description: 'Central agent that coordinates all specialized agents',
        capabilities: [
          'Multi-agent coordination',
          'Query analysis and routing',
          'Response aggregation',
          'Context management'
        ]
      },
      specializedAgents: {
        calendar: {
          name: 'Calendar Agent',
          service: 'Google Calendar',
          capabilities: [
            'Create and manage events',
            'View schedules',
            'Update and delete events',
            'Handle recurring events'
          ]
        },
        docs: {
          name: 'Docs Agent',
          service: 'Google Docs',
          capabilities: [
            'Create and edit documents',
            'Format text',
            'Manage content',
            'Share documents'
          ]
        },
        forms: {
          name: 'Forms Agent',
          service: 'Google Forms',
          capabilities: [
            'Create and manage forms',
            'Add questions',
            'View responses',
            'Update form settings'
          ]
        },
        github: {
          name: 'GitHub Agent',
          service: 'GitHub',
          capabilities: [
            'View repositories and profile',
            'List commits and issues',
            'Search code',
            'View pull requests'
          ]
        },
        meet: {
          name: 'Meet Agent',
          service: 'Google Meet',
          capabilities: [
            'Create meeting spaces',
            'View meeting history',
            'Manage recordings',
            'Track participants'
          ]
        },
        sheets: {
          name: 'Sheets Agent',
          service: 'Google Sheets',
          capabilities: [
            'Create and edit spreadsheets',
            'Manage data',
            'Format cells',
            'Share spreadsheets'
          ]
        }
      }
    };
  }
}

module.exports = MainAgent;
