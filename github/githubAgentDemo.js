/**
 * GitHub AI Agent Demonstration
 * 
 * This file demonstrates how to use the GitHub AI Agent in various scenarios.
 * It shows different types of queries and how the agent responds to them.
 */

require('dotenv').config();
const GitHubAgent = require('./githubAgent');

/**
 * Demo function to showcase the GitHub Agent capabilities
 */
async function runGitHubAgentDemo() {
  console.log('🤖 GitHub AI Agent Demo Starting...\n');
  console.log('=' .repeat(60));

  // Initialize the agent
  const agent = new GitHubAgent();
  
  // Example user ID (in a real app, this would come from authentication)
  const userId = "demo-user-123";

  // Demo queries showing different capabilities
  const demoQueries = [
    {
      query: "Am I connected to GitHub?",
      description: "Check GitHub connection status"
    },
    {
      query: "Show me my GitHub profile information",
      description: "Retrieve user's GitHub profile"
    },
    {
      query: "List my repositories sorted by last update",
      description: "Get user's repositories with sorting"
    },
    {
      query: "Show me recent commits from my main repository",
      description: "Get commits (requires specific repo)"
    },
    {
      query: "What issues are assigned to me?",
      description: "Retrieve assigned issues"
    },
    {
      query: "Show my open pull requests",
      description: "Get user's pull requests"
    },
    {
      query: "Check my GitHub notifications",
      description: "Retrieve notifications"
    },
    {
      query: "Tell me about the microsoft/vscode repository",
      description: "Get specific repository details"
    }
  ];

  // Run each demo query
  for (let i = 0; i < demoQueries.length; i++) {
    const { query, description } = demoQueries[i];
    
    console.log(`\n${i + 1}. ${description}`);
    console.log(`Query: "${query}"`);
    console.log('-'.repeat(50));
    
    try {
      const startTime = Date.now();
      const result = await agent.processQuery(query, userId);
      const endTime = Date.now();
      
      console.log(`⏱️  Processing time: ${endTime - startTime}ms`);
      console.log(`🔧 Tools used: ${result.tools_used.map(t => t.name).join(', ') || 'None'}`);
      console.log(`📊 Success: ${result.success ? '✅' : '❌'}`);
      
      if (result.success) {
        console.log(`🤖 Agent Response:\n${result.response}`);
        
        // Show raw data summary if available
        if (result.data && result.data.length > 0) {
          console.log('\n📋 Data Summary:');
          result.data.forEach(toolResult => {
            const data = toolResult.result.data;
            if (Array.isArray(data)) {
              console.log(`   ${toolResult.tool}: ${data.length} items`);
            } else if (typeof data === 'object' && data !== null) {
              console.log(`   ${toolResult.tool}: Object with ${Object.keys(data).length} properties`);
            } else {
              console.log(`   ${toolResult.tool}: ${typeof data}`);
            }
          });
        }
      } else {
        console.log(`❌ Error: ${result.error}`);
        if (result.technical_error) {
          console.log(`🔧 Technical details: ${result.technical_error}`);
        }
      }
      
    } catch (error) {
      console.log(`💥 Unexpected error: ${error.message}`);
    }
    
    console.log('='.repeat(60));
    
    // Add delay between queries to be respectful to APIs
    if (i < demoQueries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n🎉 Demo completed!');
  console.log('\nNext steps:');
  console.log('1. Set up your OPENAI_API_KEY in environment variables');
  console.log('2. Ensure GitHub connection is established for a user');
  console.log('3. Integrate the agent into your Express routes');
  console.log('4. Customize the agent responses for your UI needs');
}

/**
 * Integration example for Express.js routes
 */
function expressIntegrationExample() {
  console.log('\n📝 Express.js Integration Example:\n');
  
  const exampleCode = `
// In your Express route file (e.g., routes/github.js)
const express = require('express');
const GitHubAgent = require('../github/githubAgent');
const router = express.Router();

// Initialize the agent
const githubAgent = new GitHubAgent();

// Route to handle natural language GitHub queries
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body;
    const userId = req.user.id; // Assuming you have user authentication
    
    // Validate input
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }
    
    // Process the query with the AI agent
    const result = await githubAgent.processQuery(query, userId);
    
    // Return the result
    res.json(result);
    
  } catch (error) {
    console.error('GitHub query error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error processing GitHub query'
    });
  }
});

// Route for testing the agent
router.get('/test', async (req, res) => {
  try {
    const userId = req.user.id;
    const testQuery = "Show me my GitHub profile";
    
    const result = await githubAgent.processQuery(testQuery, userId);
    res.json({ test_query: testQuery, result });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// Don't forget to add this to your main app.js:
// app.use('/api/github', require('./routes/github'));
`;

  console.log(exampleCode);
}

/**
 * Frontend integration example
 */
function frontendIntegrationExample() {
  console.log('\n🌐 Frontend Integration Example:\n');
  
  const exampleCode = `
// Frontend JavaScript/TypeScript code
class GitHubAssistant {
  constructor(apiBaseUrl = '/api/github') {
    this.apiBaseUrl = apiBaseUrl;
  }
  
  async askQuestion(query) {
    try {
      const response = await fetch(\`\${this.apiBaseUrl}/query\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${this.getAuthToken()}\`
        },
        body: JSON.stringify({ query })
      });
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('GitHub assistant error:', error);
      return {
        success: false,
        error: 'Failed to process your GitHub query'
      };
    }
  }
  
  getAuthToken() {
    // Return your auth token (from localStorage, context, etc.)
    return localStorage.getItem('authToken');
  }
}

// Usage in your React/Vue/Angular component:
const githubAssistant = new GitHubAssistant();

// Example queries:
const queries = [
  "Show me my latest repositories",
  "What issues need my attention?",
  "Show commits from last week",
  "List my open pull requests"
];

// Process a query
async function handleUserQuery(userInput) {
  const result = await githubAssistant.askQuestion(userInput);
  
  if (result.success) {
    // Display the AI response to user
    displayResponse(result.response);
    
    // Optionally use the raw data for custom UI
    if (result.data) {
      updateDataVisualization(result.data);
    }
  } else {
    // Handle error
    showError(result.error);
  }
}
`;

  console.log(exampleCode);
}

// Main execution
if (require.main === module) {
  runGitHubAgentDemo()
    .then(() => {
      expressIntegrationExample();
      frontendIntegrationExample();
      process.exit(0);
    })
    .catch(error => {
      console.error('Demo failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runGitHubAgentDemo,
  expressIntegrationExample,
  frontendIntegrationExample
};