# GitHub AI Agent Documentation

## Overview

The GitHub AI Agent is an intelligent assistant that enables natural language interaction with GitHub data using OpenAI's Agent SDK. It dynamically selects and executes appropriate GitHub API functions based on user intent, providing a seamless experience for accessing GitHub information.

## Features

- 🤖 **Natural Language Processing**: Users can ask questions in plain English
- 🔧 **Dynamic Tool Selection**: AI automatically chooses the right GitHub functions to call
- 📊 **Real-time Data**: Fetches live GitHub data without storing large datasets
- 🔄 **Multi-tool Queries**: Can combine multiple GitHub functions to answer complex questions
- 🛡️ **Error Handling**: Comprehensive error handling with user-friendly messages
- 📝 **Natural Responses**: Converts raw GitHub data into readable summaries

## Architecture

### Core Components

1. **GitHubAgent Class**: Main agent class that orchestrates AI interactions
2. **Tool Definitions**: OpenAI function schemas for each GitHub function
3. **Function Mapping**: Maps OpenAI function calls to actual GitHub API functions
4. **Response Generation**: Converts raw data into natural language responses

### Available Tools

| Function | Description | Parameters |
|----------|-------------|------------|
| `getGithubStatus` | Check GitHub connection status | None |
| `getGithubProfile` | Get user's GitHub profile information | None |
| `getGithubRepos` | List user's repositories | `page`, `per_page`, `sort`, `type` |
| `getGithubCommits` | Get commit history for a repository | `repo` (required), `page`, `per_page`, `author`, `since`, `until` |
| `getGithubIssues` | Get user's issues | `page`, `per_page`, `state`, `filter`, `sort`, `direction` |
| `getGithubPullRequests` | Get user's pull requests | `page`, `per_page`, `state`, `sort`, `direction`, `repo` |
| `getGithubNotifications` | Get user's notifications | `page`, `per_page`, `all`, `participating` |
| `getGithubRepository` | Get detailed repository information | `owner` (required), `repo` (required) |

## Installation & Setup

### Prerequisites

1. Node.js environment
2. OpenAI API key
3. Existing GitHub functions (from `githubFunctions.js`)
4. Supabase setup for storing GitHub tokens

### Environment Variables

Create a `.env` file with:

```env
OPENAI_API_KEY=your_openai_api_key_here
# Other existing environment variables...
```

### Dependencies

The agent uses existing dependencies in your project:
- `openai`: OpenAI SDK for AI interactions
- `axios`: HTTP client for GitHub API calls
- `@supabase/supabase-js`: Database operations

## Usage

### Basic Usage

```javascript
const GitHubAgent = require('./github/githubAgent');

// Initialize the agent
const agent = new GitHubAgent();

// Process a user query
async function handleUserQuery() {
  const userId = "user-123"; // From your authentication system
  const query = "Show me my recent repositories";
  
  const result = await agent.processQuery(query, userId);
  
  if (result.success) {
    console.log("AI Response:", result.response);
    console.log("Raw Data:", result.data);
    console.log("Tools Used:", result.tools_used);
  } else {
    console.log("Error:", result.error);
  }
}
```

### Express.js Integration

```javascript
const express = require('express');
const GitHubAgent = require('./github/githubAgent');
const router = express.Router();

const githubAgent = new GitHubAgent();

router.post('/github/query', async (req, res) => {
  try {
    const { query } = req.body;
    const userId = req.user.id;
    
    const result = await githubAgent.processQuery(query, userId);
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Frontend Integration

```javascript
// Frontend service
class GitHubAssistant {
  async askQuestion(query) {
    const response = await fetch('/api/github/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    return await response.json();
  }
}

// Usage
const assistant = new GitHubAssistant();
const result = await assistant.askQuestion("What are my open issues?");
```

## Example Queries

### Simple Queries
- "Am I connected to GitHub?"
- "Show me my GitHub profile"
- "List my repositories"
- "What are my recent notifications?"

### Advanced Queries
- "Show me commits from last week in my main project"
- "What issues are assigned to me that are still open?"
- "List my pull requests that need review"
- "Tell me about the microsoft/vscode repository"

### Complex Queries
- "Show me my most active repositories and their recent commits"
- "What GitHub activity do I have that needs attention?"
- "Compare my open issues vs closed issues this month"

## Response Format

The agent returns a standardized response object:

```javascript
{
  success: boolean,           // Whether the query was processed successfully
  response: string,           // Natural language response for the user
  data: Array,               // Raw data from GitHub API calls (optional)
  tools_used: Array,         // List of tools/functions that were executed
  query: string,             // Original user query
  timestamp: string,         // ISO timestamp
  error?: string,            // Error message if success is false
  technical_error?: string   // Technical error details for debugging
}
```

## Error Handling

The agent provides specific error messages for common scenarios:

- **GitHub Token Issues**: "Your GitHub account isn't connected or your token has expired"
- **API Errors**: "There was an issue with the GitHub API"
- **Invalid Repository**: "I need a valid repository name in the format 'owner/repo'"
- **Configuration Issues**: "OpenAI API key is not configured"

## Testing

### Run Quick Test
```bash
node github/testAgent.js
```

### Run Full Demo
```bash
node github/githubAgentDemo.js
```

### Manual Testing Queries
```javascript
const agent = new GitHubAgent();

// Test different query types
const queries = [
  "Show me my profile",
  "List my repositories",
  "What issues need my attention?",
  "Tell me about my recent commits",
];

for (const query of queries) {
  const result = await agent.processQuery(query, userId);
  console.log(result);
}
```

## Customization

### Adding New Tools

1. Add the GitHub function to `githubFunctions.js`
2. Define the OpenAI function schema in `defineTools()`
3. Add the function mapping in `createFunctionMap()`
4. Update the `handleToolCalls()` method if needed

### Modifying System Prompt

Edit the `createSystemPrompt()` method to change the agent's behavior:

```javascript
createSystemPrompt() {
  return `You are a GitHub assistant with these specific behaviors:
           - Always be concise
           - Focus on actionable information
           - Suggest next steps when appropriate`;
}
```

### Custom Response Formatting

Override the `generateNaturalResponse()` method to customize how responses are formatted.

## Performance Considerations

- **API Rate Limits**: The agent respects GitHub API rate limits
- **Response Time**: Typical queries complete in 2-5 seconds
- **Token Usage**: Uses approximately 500-1500 OpenAI tokens per query
- **Caching**: Consider implementing caching for frequently requested data

## Security Notes

- User authentication is required for all GitHub operations
- GitHub tokens are securely stored in Supabase
- OpenAI API key should be kept secure in environment variables
- All GitHub API calls are made with proper authentication

## Troubleshooting

### Common Issues

1. **"GitHub token not found"**
   - Ensure user has connected their GitHub account
   - Check GitHub token in database

2. **"OpenAI API Error"**
   - Verify OPENAI_API_KEY is set correctly
   - Check OpenAI account has sufficient credits

3. **"Repository not found"**
   - Ensure repository name is in correct format: "owner/repo"
   - Check user has access to the repository

4. **"Rate limit exceeded"**
   - Implement request throttling
   - Consider caching frequently requested data

### Debug Mode

Enable verbose logging by setting:
```javascript
console.log = (...args) => {
  if (process.env.DEBUG_GITHUB_AGENT) {
    originalConsoleLog(...args);
  }
};
```

## API Reference

### GitHubAgent Class

#### constructor()
Initializes the agent with OpenAI client and tool definitions.

#### processQuery(query, userId)
Main method to process user queries.
- `query`: String - Natural language query
- `userId`: String - User ID for authentication
- Returns: Promise<Object> - Processed response

#### handleToolCalls(toolCalls, userId, originalQuery)
Executes OpenAI tool calls and returns results.

#### generateNaturalResponse(toolResults, originalQuery)
Converts raw tool results into natural language.

#### runTests(userId)
Runs a series of test queries for debugging.

## Contributing

When extending the agent:

1. Follow the existing code patterns
2. Add comprehensive error handling
3. Update documentation
4. Test with various query types
5. Consider token usage optimization

## License

This GitHub AI Agent is part of the Cross App Memory AI project.