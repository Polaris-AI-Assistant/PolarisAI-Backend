/**
 * GitHub AI Agent using OpenAI Agent SDK
 * 
 * This agent provides intelligent interaction with GitHub data using natural language queries.
 * It dynamically selects and executes appropriate GitHub API functions based on user intent.
 * 
 * Features:
 * - Natural language query processing
 * - Dynamic tool selection based on user intent
 * - Real-time GitHub data fetching
 * - Multi-tool query support
 * - Comprehensive error handling
 * 
 * Usage:
 * const agent = new GitHubAgent();
 * const result = await agent.processQuery("show me my recent commits", userId);
 */

const OpenAI = require('openai');
const githubFunctions = require('./githubFunctions');

class GitHubAgent {
  constructor() {
    // Initialize OpenAI client with API key from environment
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Define available tools/functions that the agent can use
    this.tools = this.defineTools();
    
    // Map function names to actual implementations
    this.functionMap = this.createFunctionMap();

    // System prompt that defines the agent's behavior and capabilities
    this.systemPrompt = this.createSystemPrompt();
  }

  /**
   * Define OpenAI function schemas for each GitHub function
   * These schemas help the AI understand when and how to use each tool
   */
  defineTools() {
    return [
      {
        type: "function",
        function: {
          name: "getGithubStatus",
          description: "Get GitHub connection status and username for the user. Use this when user asks about connection status or if they're connected to GitHub.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubProfile",
          description: "Get detailed GitHub profile information including bio, followers, repos count, etc. Use when user asks about their profile, account details, or personal GitHub information.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubRepos",
          description: "Get list of user's repositories with pagination. Use when user asks about their repos, repositories, or wants to see their projects.",
          parameters: {
            type: "object",
            properties: {
              page: {
                type: "number",
                description: "Page number for pagination (default: 1)"
              },
              per_page: {
                type: "number",
                description: "Number of repositories per page (default: 30, max: 100). When user asks for a specific number like 'show 10 repos', set this to that number."
              },
              sort: {
                type: "string",
                enum: ["created", "updated", "pushed", "full_name"],
                description: "Sort repositories by (default: updated)"
              },
              type: {
                type: "string",
                enum: ["all", "owner", "public", "private", "member"],
                description: "Type of repositories to fetch (default: all)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubCommits",
          description: "Get commit history for a specific repository. Use when user asks about commits, recent changes, or commit history for a specific repo.",
          parameters: {
            type: "object",
            properties: {
              repo: {
                type: "string",
                description: "Repository name in format 'owner/repo' (e.g., 'octocat/Hello-World')"
              },
              page: {
                type: "number",
                description: "Page number for pagination (default: 1)"
              },
              per_page: {
                type: "number",
                description: "Number of commits per page (default: 30, max: 100)"
              },
              author: {
                type: "string",
                description: "Filter commits by author (GitHub username or email)"
              },
              since: {
                type: "string",
                description: "Only commits after this date (ISO 8601 format)"
              },
              until: {
                type: "string",
                description: "Only commits before this date (ISO 8601 format)"
              }
            },
            required: ["repo"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubIssues",
          description: "Get list of issues assigned to or created by the user. Use when user asks about issues, bugs, tasks, or tickets.",
          parameters: {
            type: "object",
            properties: {
              page: {
                type: "number",
                description: "Page number for pagination (default: 1)"
              },
              per_page: {
                type: "number",
                description: "Number of issues per page (default: 30, max: 100)"
              },
              state: {
                type: "string",
                enum: ["open", "closed", "all"],
                description: "Issue state filter (default: open)"
              },
              filter: {
                type: "string",
                enum: ["assigned", "created", "mentioned", "subscribed", "repos", "all"],
                description: "Filter type (default: assigned)"
              },
              sort: {
                type: "string",
                enum: ["created", "updated", "comments"],
                description: "Sort issues by (default: created)"
              },
              direction: {
                type: "string",
                enum: ["asc", "desc"],
                description: "Sort direction (default: desc)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubPullRequests",
          description: "Get list of pull requests created by the user. Use when user asks about PRs, pull requests, or code reviews.",
          parameters: {
            type: "object",
            properties: {
              page: {
                type: "number",
                description: "Page number for pagination (default: 1)"
              },
              per_page: {
                type: "number",
                description: "Number of PRs per page (default: 30, max: 100)"
              },
              state: {
                type: "string",
                enum: ["open", "closed", "all"],
                description: "PR state filter (default: open)"
              },
              sort: {
                type: "string",
                enum: ["created", "updated", "popularity"],
                description: "Sort PRs by (default: created)"
              },
              direction: {
                type: "string",
                enum: ["asc", "desc"],
                description: "Sort direction (default: desc)"
              },
              repo: {
                type: "string",
                description: "Filter by specific repository (format: owner/repo)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubNotifications",
          description: "Get GitHub notifications for the user. Use when user asks about notifications, alerts, or unread items.",
          parameters: {
            type: "object",
            properties: {
              page: {
                type: "number",
                description: "Page number for pagination (default: 1)"
              },
              per_page: {
                type: "number",
                description: "Number of notifications per page (default: 30, max: 100)"
              },
              all: {
                type: "boolean",
                description: "Show notifications marked as read (default: false)"
              },
              participating: {
                type: "boolean",
                description: "Show only notifications where user is participating (default: false)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubRepository",
          description: "Get detailed information about a specific repository. Use when user asks about a specific repo's details, stats, or information.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              }
            },
            required: ["owner", "repo"]
          }
        }
      }
    ];
  }

  /**
   * Create mapping between function names and their implementations
   * This allows the agent to execute the correct function based on OpenAI's selection
   */
  createFunctionMap() {
    return {
      'getGithubStatus': githubFunctions.getGithubStatus,
      'getGithubProfile': githubFunctions.getGithubProfile,
      'getGithubRepos': githubFunctions.getGithubRepos,
      'getGithubCommits': githubFunctions.getGithubCommits,
      'getGithubIssues': githubFunctions.getGithubIssues,
      'getGithubPullRequests': githubFunctions.getGithubPullRequests,
      'getGithubNotifications': githubFunctions.getGithubNotifications,
      'getGithubRepository': githubFunctions.getGithubRepository
    };
  }

  /**
   * Create system prompt that defines the agent's behavior
   * This helps the AI understand its role and how to interact with users
   */
  createSystemPrompt() {
    // Get current date dynamically
    const now = new Date();
    const currentDateStr = now.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return `You are a helpful GitHub AI Assistant that helps users interact with their GitHub data through natural language queries.

**IMPORTANT - Current date is ${currentDateStr}**. Use this as reference for any date-related queries like commits "today", "this week", etc.

Your capabilities include:
- Checking GitHub connection status
- Retrieving profile information
- Listing repositories with various filters
- Getting commit history for specific repositories
- Finding issues and pull requests
- Checking notifications
- Getting detailed repository information

Guidelines:
1. Always be helpful and provide clear, concise responses
2. When users ask vague questions, clarify what specific information they need
3. For repository-specific queries, ask for the repository name if not provided
4. When users ask about a specific repository (e.g., "info about AutoDB repository"), ALWAYS assume it belongs to the authenticated user unless explicitly told otherwise. Use the user's GitHub username as the owner.
5. Only use external owners (like 'octocat') when users explicitly mention them (e.g., "octocat's Hello-World repository")
6. When users ask for repositories containing specific keywords in the NAME, ONLY show repositories whose names actually contain those keywords
7. When users ask for repositories "where [language] is used" or "written in [language]", filter by the programming language field, NOT the repository name
8. Distinguish between name-based searches ("repos with 'react' in the name") and language-based searches ("repos where Python is used")
9. Always verify that filtered results match the user's criteria before presenting them
10. Be accurate with counts - only count items that actually match the filter criteria
11. If no repositories match the filter criteria, clearly state that no matches were found
12. When users ask for a specific number of repositories (e.g., "show 10 repos", "recent 15 repositories"), use the per_page parameter to fetch exactly that many
13. Default to showing 10 repositories when users ask for "recent repositories" without specifying a number
14. Suggest related actions when appropriate
15. Handle errors gracefully and provide helpful error messages

IMPORTANT: When filtering repositories by name, be precise and only include repositories that actually contain the specified keywords in their names.
IMPORTANT: When users specify a number of repositories to show, always use that exact number in the per_page parameter.
IMPORTANT: When users ask about repositories "where [language] is used" or "written in [language]", they want to filter by programming language, not repository name.
CRITICAL: For repository-specific queries, always assume the repository belongs to the authenticated user unless explicitly told otherwise. Never default to 'octocat' or other external owners.

Remember: You can only access GitHub data for the authenticated user. You cannot perform write operations like creating issues or commits.`;
  }

  /**
   * Main method to process user queries
   * This is the entry point for all user interactions with the agent
   * 
   * @param {string} query - Natural language query from the user
   * @param {string} userId - User ID for authentication
   * @param {Object} options - Additional options like repoCount, forceToolExecution
   * @returns {Promise<Object>} Processed response with GitHub data
   */
  async processQuery(query, userId, options = {}) {
    try {
      console.log(`Processing query: "${query}" for user: ${userId}`);

      // If forceToolExecution is set, directly execute the tool without LLM
      if (options.forceToolExecution && options.forceToolExecution.toolName && options.forceToolExecution.params) {
        console.log(`[GitHubAgent] Force executing tool: ${options.forceToolExecution.toolName}`);
        console.log(`[GitHubAgent] With exact params:`, JSON.stringify(options.forceToolExecution.params, null, 2));
        
        const functionToCall = this.functionMap[options.forceToolExecution.toolName];
        if (!functionToCall) {
          throw new Error(`Unknown function: ${options.forceToolExecution.toolName}`);
        }

        const result = await functionToCall(userId, options.forceToolExecution.params);
        
        let responseText = result.success ? `Successfully executed ${options.forceToolExecution.toolName}` : result.error;
        
        return {
          success: true,
          response: responseText,
          data: [{ tool: options.forceToolExecution.toolName, result: result, arguments: options.forceToolExecution.params }],
          tools_used: [{
            name: options.forceToolExecution.toolName,
            arguments: options.forceToolExecution.params,
            success: result.success
          }],
          raw_results: [result],
          query: query,
          timestamp: new Date().toISOString()
        };
      }

      // Create messages array for OpenAI chat completion with user context
      const githubUsername = options.githubUsername;
      const systemPromptWithUser = this.systemPrompt + (githubUsername ? 
        `\n\nCONTEXT: You are currently helping user '${githubUsername}'. When they ask about repositories without specifying an owner, assume they mean repositories owned by '${githubUsername}'.` : 
        '');

      const messages = [
        {
          role: "system",
          content: systemPromptWithUser
        },
        {
          role: "user",
          content: query
        }
      ];

      // Call OpenAI with function calling enabled
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Use GPT-4o mini for cost efficiency
        messages: messages,
        tools: this.tools,
        tool_choice: "auto", // Let OpenAI decide when to use tools
        max_tokens: 1500,
        temperature: 0.1 // Low temperature for more consistent responses
      });

      const message = response.choices[0].message;

      // Check if OpenAI wants to call any functions
      if (message.tool_calls && message.tool_calls.length > 0) {
        return await this.handleToolCalls(message.tool_calls, userId, query, options);
      } else {
        // No tools needed, return direct response
        return {
          success: true,
          response: message.content,
          query: query,
          tools_used: [],
          timestamp: new Date().toISOString()
        };
      }

    } catch (error) {
      console.error('Error processing query:', error);
      return this.handleError(error, query);
    }
  }

  /**
   * Execute tool calls requested by OpenAI
   * This method handles the actual execution of GitHub functions
   * 
   * @param {Array} toolCalls - Array of tool calls from OpenAI
   * @param {string} userId - User ID for authentication
   * @param {string} originalQuery - Original user query for context
   * @param {Object} options - Additional options like repoCount
   * @returns {Promise<Object>} Results from tool execution
   */
  async handleToolCalls(toolCalls, userId, originalQuery, options = {}) {
    const toolResults = [];
    const toolsUsed = [];

    try {
      // Execute each tool call
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing tool: ${functionName} with args:`, functionArgs);
        
        // Get the actual function implementation
        const functionToCall = this.functionMap[functionName];
        
        if (!functionToCall) {
          throw new Error(`Unknown function: ${functionName}`);
        }

        // Execute the function with userId as first parameter
        let result;
        if (functionName === 'getGithubCommits' || functionName === 'getGithubRepository') {
          // These functions need special parameter handling
          if (functionName === 'getGithubCommits') {
            result = await functionToCall(userId, functionArgs.repo, {
              page: functionArgs.page,
              per_page: functionArgs.per_page,
              author: functionArgs.author,
              since: functionArgs.since,
              until: functionArgs.until
            });
          } else if (functionName === 'getGithubRepository') {
            result = await functionToCall(userId, functionArgs.owner, functionArgs.repo);
          }
        } else if (functionName === 'getGithubRepos') {
          // Handle repository listing with repoCount from options
          const repoArgs = { ...functionArgs };
          if (options.repoCount) {
            repoArgs.per_page = Math.min(options.repoCount, 50); // Respect GitHub API limits
            console.log(`[GitHub Agent] Setting per_page to ${repoArgs.per_page} based on repoCount: ${options.repoCount}`);
          }
          console.log(`[GitHub Agent] Calling getGithubRepos with args:`, repoArgs);
          result = await functionToCall(userId, repoArgs);
          console.log(`[GitHub Agent] getGithubRepos returned ${result.data?.length || 0} repositories`);
        } else {
          // Standard functions that take userId and options
          result = await functionToCall(userId, functionArgs);
        }

        toolResults.push({
          tool: functionName,
          result: result,
          arguments: functionArgs
        });

        toolsUsed.push({
          name: functionName,
          arguments: functionArgs,
          success: result.success || true
        });
      }

      // Generate a natural language response based on the results
      const naturalResponse = await this.generateNaturalResponse(toolResults, originalQuery);

      return {
        success: true,
        response: naturalResponse,
        data: toolResults,
        tools_used: toolsUsed,
        raw_results: toolResults.map(tr => tr.result),  // Include raw results for artifact extraction
        query: originalQuery,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error executing tools:', error);
      return this.handleError(error, originalQuery, toolsUsed);
    }
  }

  /**
   * Generate a natural language response based on tool results
   * This makes the raw data more user-friendly
   * 
   * @param {Array} toolResults - Results from executed tools
   * @param {string} originalQuery - Original user query
   * @returns {Promise<string>} Natural language response
   */
  async generateNaturalResponse(toolResults, originalQuery) {
    try {
      // Create a summary of the results for the AI to process
      const resultSummary = toolResults.map(result => ({
        tool: result.tool,
        success: result.result.success,
        data: result.result.data, // Pass full data instead of truncated summary
        count: Array.isArray(result.result.data) ? result.result.data.length : 1
      }));

      const messages = [
        {
          role: "system",
          content: `You are helping to format GitHub data into a natural, user-friendly response.
                   Based on the tool results, provide a clear and helpful summary that directly answers the user's question.
                   Be concise but informative. If there are multiple results, organize them logically.
                   Always mention the key metrics or important information from the data.
                   
                   CRITICAL: When filtering repositories based on user query:
                   
                   For NAME-based searches ("repos with 'react' in the name"):
                   1. Only include repositories whose names actually contain those keywords
                   2. Filter the data carefully before presenting results
                   3. Provide accurate counts of matching repositories only
                   4. If no repositories match the criteria, clearly state "No repositories found with [keyword] in the name"
                   
                   For LANGUAGE-based searches ("repos where Python is used", "repositories written in JavaScript"):
                   1. Filter by the 'language' field in the repository data
                   2. Include all repositories where the primary language matches (case-insensitive)
                   3. Provide accurate counts of repositories using that language
                   4. If no repositories match, clearly state "No repositories found using [language]"
                   
                   Do not show unrelated repositories that don't match the specific filter criteria.`
        },
        {
          role: "user",
          content: `Original query: "${originalQuery}"
                   
                   Tool results: ${JSON.stringify(resultSummary, null, 2)}
                   
                   Please provide a natural language response that answers the user's question based on this data.
                   
                   FILTERING INSTRUCTIONS:
                   - If the query asks for repositories by LANGUAGE (e.g., "where Python is used"), filter by the 'language' field
                   - If the query asks for repositories by NAME keywords, filter by repository names
                   - If no filtering is requested, show ALL repositories returned
                   
                   Format repository lists with numbered list format:
                   1. **Repository Name**
                      - Privacy: Public/Private
                      - Stars: X | Forks: Y | Language: Z
                      - Last updated: Date
                      - Description: [if available]
                      - [View Repository](URL)
                   
                   Always include the accurate count of matching repositories.`
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        max_tokens: 2000, // Significantly increased for longer repository lists
        temperature: 0.3
      });

      return response.choices[0].message.content;

    } catch (error) {
      console.error('Error generating natural response:', error);
      // Fallback to basic summary if AI response fails
      return this.generateBasicSummary(toolResults);
    }
  }

  /**
   * Create a basic summary of tool results
   * Fallback method when AI-generated response fails
   * 
   * @param {Array} toolResults - Results from executed tools
   * @returns {string} Basic summary of results
   */
  generateBasicSummary(toolResults) {
    let summary = "Here's what I found:\n\n";
    
    toolResults.forEach(result => {
      if (result.result.success) {
        const data = result.result.data;
        switch (result.tool) {
          case 'getGithubProfile':
            summary += `📊 Profile: ${data.name || data.login} (${data.public_repos} repos, ${data.followers} followers)\n`;
            break;
          case 'getGithubRepos':
            console.log(`[GitHub Agent] generateBasicSummary: Found ${data.length} repositories`);
            summary += `📁 Found ${data.length} repositories\n`;
            break;
          case 'getGithubCommits':
            summary += `💻 Found ${data.length} commits for ${result.arguments.repo}\n`;
            break;
          case 'getGithubIssues':
            summary += `🐛 Found ${data.length} issues\n`;
            break;
          case 'getGithubPullRequests':
            summary += `🔄 Found ${data.length} pull requests\n`;
            break;
          case 'getGithubNotifications':
            summary += `🔔 Found ${data.length} notifications\n`;
            break;
          default:
            summary += `✅ ${result.tool} executed successfully\n`;
        }
      } else {
        summary += `❌ ${result.tool} failed\n`;
      }
    });

    return summary;
  }

  /**
   * Summarize data for AI processing
   * Creates concise summaries of large datasets
   * 
   * @param {Object} result - Tool execution result
   * @returns {Object} Summarized data
   */
  summarizeData(result) {
    if (!result.success || !result.data) {
      return { error: result.error || 'No data available' };
    }

    const data = result.data;

    // Handle different data types
    if (Array.isArray(data)) {
      return {
        count: data.length,
        items: data.map(item => ({
          name: item.name || item.title || item.login,
          date: item.created_at || item.updated_at,
          url: item.html_url,
          description: item.description,
          language: item.language,
          stars: item.stargazers_count,
          forks: item.forks_count,
          private: item.private
        }))
      };
    } else if (typeof data === 'object') {
      return {
        name: data.name || data.login || data.title,
        count: data.public_repos || data.total_count,
        date: data.created_at || data.updated_at,
        url: data.html_url
      };
    }

    return { summary: 'Data retrieved successfully' };
  }

  /**
   * Handle errors and provide user-friendly error messages
   * 
   * @param {Error} error - The error that occurred
   * @param {string} query - Original user query
   * @param {Array} toolsUsed - Tools that were used before error
   * @returns {Object} Error response
   */
  handleError(error, query, toolsUsed = []) {
    console.error('GitHub Agent Error:', error);

    let errorMessage = "I encountered an error while processing your request.";

    // Provide specific error messages based on error type
    if (error.message.includes('GitHub token')) {
      errorMessage = "It looks like your GitHub account isn't connected or your token has expired. Please reconnect your GitHub account.";
    } else if (error.message.includes('API Error')) {
      errorMessage = "There was an issue with the GitHub API. Please try again in a moment.";
    } else if (error.message.includes('Repository name')) {
      errorMessage = "I need a valid repository name to fetch that information. Please specify the repository in the format 'owner/repo'.";
    } else if (error.message.includes('OPENAI_API_KEY')) {
      errorMessage = "OpenAI API key is not configured. Please contact support.";
    }

    return {
      success: false,
      error: errorMessage,
      technical_error: error.message,
      query: query,
      tools_used: toolsUsed,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test the agent with sample queries
   * Useful for debugging and demonstration
   * 
   * @param {string} userId - User ID for testing
   */
  async runTests(userId) {
    console.log('\n🚀 Starting GitHub Agent Tests...\n');

    const testQueries = [
      "What's my GitHub connection status?",
      "Show me my GitHub profile",
      "List my repositories",
      "Show me my recent issues",
      "What are my latest pull requests?",
      "Check my GitHub notifications"
    ];

    for (const query of testQueries) {
      console.log(`\n📝 Testing query: "${query}"`);
      console.log('─'.repeat(50));
      
      try {
        const result = await this.processQuery(query, userId);
        console.log('✅ Result:', JSON.stringify(result, null, 2));
      } catch (error) {
        console.log('❌ Error:', error.message);
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n🏁 Tests completed!\n');
  }
}

module.exports = GitHubAgent;