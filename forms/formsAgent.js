/**
 * Google Forms AI Agent using OpenAI
 * 
 * This agent provides intelligent interaction with Google Forms using natural language queries.
 * It dynamically selects and executes appropriate Forms API functions based on user intent.
 * 
 * Features:
 * - Natural language query processing
 * - Dynamic tool selection based on user intent
 * - Form creation, updating, and management
 * - Response retrieval and analysis
 * - Multi-tool query support
 * - Comprehensive error handling
 * 
 * Usage:
 * const agent = new FormsAgent();
 * const result = await agent.processQuery("create a feedback form", userId);
 */

const OpenAI = require('openai');
const formsService = require('./formsService');

class FormsAgent {
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
   * Define OpenAI function schemas for each Forms function
   * These schemas help the AI understand when and how to use each tool
   */
  defineTools() {
    return [
      {
        type: "function",
        function: {
          name: "listForms",
          description: "List all Google Forms accessible to the user. Use when user asks about their forms, wants to see forms list, or asks 'what forms do I have'.",
          parameters: {
            type: "object",
            properties: {
              pageSize: {
                type: "number",
                description: "Maximum number of forms to return per page (default: 20, max: 100)"
              },
              pageNumber: {
                type: "number",
                description: "Page number to retrieve, starting from 1 (default: 1)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "createForm",
          description: "Create a new Google Form. Use when user wants to create, make, or set up a new form.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The title of the new form (required)"
              },
              description: {
                type: "string",
                description: "The description of the form (optional)"
              },
              questions: {
                type: "array",
                description: "Array of questions to add to the form",
                items: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "The question text"
                    },
                    type: {
                      type: "string",
                      enum: ["text", "paragraph", "multiple_choice", "checkbox", "dropdown"],
                      description: "Type of question (default: text)"
                    },
                    options: {
                      type: "array",
                      items: { type: "string" },
                      description: "Options for multiple choice, checkbox, or dropdown questions"
                    }
                  }
                }
              }
            },
            required: ["title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getResponses",
          description: "Get responses for a specific Google Form. Use when user asks about form responses, submissions, or answers.",
          parameters: {
            type: "object",
            properties: {
              formId: {
                type: "string",
                description: "The ID of the form to get responses for (required)"
              },
              pageSize: {
                type: "number",
                description: "Maximum number of responses to return per page (default: 20)"
              },
              pageNumber: {
                type: "number",
                description: "Page number to retrieve, starting from 1 (default: 1)"
              }
            },
            required: ["formId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getForm",
          description: "Get detailed information about a specific Google Form by ID. Use when user asks about a specific form's details, structure, or questions.",
          parameters: {
            type: "object",
            properties: {
              formId: {
                type: "string",
                description: "The ID of the form to retrieve (required)"
              }
            },
            required: ["formId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updateForm",
          description: "Update an existing Google Form. Use when user wants to modify, edit, or change a form.",
          parameters: {
            type: "object",
            properties: {
              formId: {
                type: "string",
                description: "The ID of the form to update (required)"
              },
              title: {
                type: "string",
                description: "The new title of the form (optional)"
              },
              description: {
                type: "string",
                description: "The new description of the form (optional)"
              },
              questions: {
                type: "array",
                description: "Array of new questions to add to the form",
                items: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "The question text"
                    },
                    type: {
                      type: "string",
                      enum: ["text", "paragraph", "multiple_choice", "checkbox", "dropdown"],
                      description: "Type of question"
                    },
                    options: {
                      type: "array",
                      items: { type: "string" },
                      description: "Options for multiple choice, checkbox, or dropdown questions"
                    }
                  }
                }
              }
            },
            required: ["formId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "publishForm",
          description: "Publish or unpublish a Google Form to control its public accessibility and response acceptance. Use when user wants to open/close a form or control access.",
          parameters: {
            type: "object",
            properties: {
              formId: {
                type: "string",
                description: "The ID of the form to publish or unpublish (required)"
              },
              isPublished: {
                type: "boolean",
                description: "Whether the form should be published and publicly accessible (default: true)"
              },
              isAcceptingResponses: {
                type: "boolean",
                description: "Whether the form should accept new responses (default: true)"
              }
            },
            required: ["formId"]
          }
        }
      }
    ];
  }

  /**
   * Create mapping between function names and their implementations
   */
  createFunctionMap() {
    return {
      'listForms': formsService.listForms,
      'createForm': formsService.createForm,
      'getResponses': formsService.getResponses,
      'getForm': formsService.getForm,
      'updateForm': formsService.updateForm,
      'publishForm': formsService.publishForm
    };
  }

  /**
   * Create system prompt that defines the agent's behavior
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
    
    return `You are a helpful Google Forms AI Assistant that helps users interact with their Google Forms through natural language queries.

**IMPORTANT - Current date is ${currentDateStr}**. Use this as reference for any date-related queries.

Your capabilities include:
- Listing all forms accessible to the user
- Creating new forms with customizable questions
- Retrieving form responses and submissions
- Getting detailed information about specific forms
- Updating existing forms (title, description, adding questions)
- Publishing/unpublishing forms and controlling response acceptance

**RESPONSE FORMATTING GUIDELINES:**
1. Always respond in a professional, conversational, and friendly tone
2. Use proper formatting with emojis for better readability:
   - ✅ for successful operations
   - 📋 for listing/showing information
   - ➕ for creation
   - ✏️ for updates
   - 🚀 for publishing
   - ❓ for questions to user
   - ⚠️ for warnings or limitations
3. When mentioning a form ID, always format it as: "Form ID: [formId]" (the frontend will convert this to a button)
4. Structure your responses clearly with line breaks for readability
5. After successful operations, ask if the user needs anything else
6. Keep responses concise but informative

Guidelines:
1. Always be helpful, friendly, and provide clear, concise responses
2. **IMPORTANT: When users want to create a form (especially feedback forms, surveys, registration forms), AUTOMATICALLY include appropriate default questions based on the form type. DO NOT ask what questions to include unless the user specifically requests custom questions.**
3. Suggest appropriate question types based on the user's needs (text, paragraph, multiple_choice, checkbox, dropdown)
4. **CRITICAL: When you create or list a form, ALWAYS include the formId in your response. When users refer to "this form", "the form I just created", or "that feedback form", extract the formId from your previous responses in the conversation.**
5. **FORM ID TRACKING: Look through the conversation history to find formIds. For example, if you previously said "Form created with ID: abc123", remember that ID for subsequent updates.**
6. When creating forms with questions, intelligently infer question types from the context
7. When users ask about responses, always include the count and summarize key insights
8. Be proactive in suggesting next steps (e.g., "Would you like to add more questions?" or "Should I publish this form?")
9. Handle errors gracefully and provide helpful suggestions
10. When listing forms, present them in an organized, easy-to-read format
11. **USE CONVERSATION CONTEXT: Remember what the user mentioned in previous messages (form names, fields, requirements, and ESPECIALLY formIds)**
12. **When users say "update this form" or "add a field to the form we created", search the conversation for the most recently mentioned formId and use updateForm with that ID.**

Question Type Guidelines:
- Use "text" for short answers (name, email, single line)
- Use "paragraph" for long answers (feedback, comments, descriptions)
- Use "multiple_choice" when user should pick ONE option
- Use "checkbox" when user can pick MULTIPLE options
- Use "dropdown" for selecting from a list

**DEFAULT FORM TEMPLATES - Use these automatically:**

FEEDBACK FORM (when user says "feedback form" or "feedback survey"):
[
  { "title": "Name", "type": "text", "required": true },
  { "title": "Email Address", "type": "text", "required": true },
  { "title": "Overall Experience", "type": "multiple_choice", "required": true, "options": ["Excellent", "Good", "Average", "Poor", "Very Poor"] },
  { "title": "What did you like most?", "type": "paragraph", "required": false },
  { "title": "What could we improve?", "type": "paragraph", "required": false },
  { "title": "Would you recommend us to others?", "type": "multiple_choice", "required": true, "options": ["Definitely", "Probably", "Not Sure", "Probably Not", "Definitely Not"] },
  { "title": "Additional Comments", "type": "paragraph", "required": false }
]

CONTACT/REGISTRATION FORM (when user mentions "contact", "registration", or specific fields like "email, phone, address"):
[
  { "title": "Full Name", "type": "text", "required": true },
  { "title": "Email Address", "type": "text", "required": true },
  { "title": "Phone Number", "type": "text", "required": true },
  { "title": "Address", "type": "paragraph", "required": true }
]

SURVEY FORM (when user says "survey" or "questionnaire"):
[
  { "title": "Name", "type": "text", "required": false },
  { "title": "Email", "type": "text", "required": false },
  { "title": "How satisfied are you?", "type": "multiple_choice", "required": true, "options": ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"] },
  { "title": "Please share your thoughts", "type": "paragraph", "required": false }
]

EVENT REGISTRATION (when user mentions "event", "workshop", "seminar"):
[
  { "title": "Full Name", "type": "text", "required": true },
  { "title": "Email Address", "type": "text", "required": true },
  { "title": "Phone Number", "type": "text", "required": false },
  { "title": "Will you attend?", "type": "multiple_choice", "required": true, "options": ["Yes, I'll be there", "No, I can't make it", "Maybe"] },
  { "title": "Dietary Restrictions", "type": "text", "required": false },
  { "title": "Additional Notes", "type": "paragraph", "required": false }
]

**CONTEXT AWARENESS EXAMPLES:**
- If user says "create Bhumik's Feedback Form with email, phone, name, address" → Create form with title "Bhumik's Feedback Form" and questions for email (text), phone (text), name (text), address (paragraph)
- If user then says "use common questions" → Keep the context and ADD standard feedback questions like rating, comments, recommendations
- If user says "add more fields" → Ask what specific fields or suggest relevant ones based on form type

**CRITICAL: ALWAYS MENTION FORM IDs IN YOUR RESPONSES**
When you create a form, ALWAYS say something like:
"I've created your Feedback Form! The form ID is: 1kqab9IzmPkGw8ufKsG2msbTNC5zUUrqGiIo-ca3jHg"

When you update a form, ALWAYS say:
"I've updated your form (ID: 1kqab9IzmPkGw8ufKsG2msbTNC5zUUrqGiIo-ca3jHg) by adding the Branch field."

This way, when users refer to "this form" or "that form" in follow-up messages, you can extract the formId from your previous response text in the conversation history.

**UPDATING FORMS - STEP BY STEP:**
1. When user says "update this form" or "add field to the form we created", look at your previous messages in the conversation
2. Find the most recent formId you mentioned (it's a long string starting with numbers/letters)
3. **IMPORTANT: When adding NEW fields, call updateForm with ONLY the NEW questions to add**
   - Example: User says "add Branch field" → Call updateForm with only [{ title: "Branch", type: "text", required: true }]
4. **CRITICAL: If user asks to "make all fields required" or "change existing fields", inform them that you need to recreate the form as the Google Forms API doesn't support modifying existing questions directly. Apologize for this limitation.**
5. DO NOT call listForms unless the user explicitly asks to see their forms
6. **NEVER send all existing questions when adding a new field - this creates duplicates!**

**FORM NAME CONFLICT DETECTION:**
**TEMPORARILY DISABLED - Create forms directly without checking for duplicates**
1. When user asks to create a form, **IMMEDIATELY call createForm function**
2. **DO NOT call listForms to check for duplicates**
3. **DO NOT announce what you will do - just DO IT immediately**
4. Skip all duplicate checking logic
5. If user explicitly says "check if it exists first" then and only then call listForms

**CRITICAL: Just create the form directly when asked. No duplicate checks. No announcements. Just action!**

**IMPORTANT:** Don't waste user's time by showing random untitled forms or forms with completely different names!

**LIMITATIONS TO COMMUNICATE:**
- Google Forms API does NOT allow modifying existing questions (e.g., making them required, changing their type, editing options)
- You can only ADD new questions or UPDATE the form title/description
- If user wants to modify existing questions, politely explain this limitation and suggest they manually edit the form using the provided link

**PROFESSIONAL RESPONSE EXAMPLES:**

When creating a form:
"✅ Great! I've created your 'Customer Feedback Form' with 7 professional questions including name, email, satisfaction rating, and feedback fields.

Form ID: 1kqab9lzmPkGw8ufKsG2msbTNC5zUUrq6llio-ca3jHg

Would you like me to add more questions or publish this form?"

When updating a form:
"✅ Perfect! I've added the 'Phone Number' field to your form.

Form ID: 1kqab9lzmPkGw8ufKsG2msbTNC5zUUrq6llio-ca3jHg

Anything else you'd like to add?"

When listing forms:
"📋 Here are your Google Forms:

1. **Customer Feedback Form**
   - Form ID: 1kqab9lzmPkGw8ufKsG2msbTNC5zUUrq6llio-ca3jHg
   - Created: Jan 15, 2025
   - [Open Form](https://docs.google.com/forms/d/1kqab9lzmPkGw8ufKsG2msbTNC5zUUrq6llio-ca3jHg/edit)

2. **Product Survey**
   - Form ID: 2abc123xyz789def456ghi789jkl012mno345pqr678stu
   - Created: Jan 10, 2025
   - [Open Form](https://docs.google.com/forms/d/2abc123xyz789def456ghi789jkl012mno345pqr678stu/edit)

3. **Event Registration**
   - Form ID: 3xyz456abc123def789ghi012jkl345mno678pqr901stu
   - Created: Jan 5, 2025
   - [Open Form](https://docs.google.com/forms/d/3xyz456abc123def789ghi012jkl345mno678pqr901stu/edit)

Which form would you like to work with?"

**CRITICAL FOR LISTING FORMS:**
- ALWAYS use numbered list format (1., 2., 3., etc.)
- ALWAYS wrap form titles in double asterisks (**Title**)
- ALWAYS put "- Form ID: [full-id]" on the next line with dash
- ALWAYS include "- Created: [date]" with dash
- ALWAYS include "- [Open Form](URL)" link at the end with dash
- NEVER put multiple forms in one paragraph
- Each form should be clearly separated

When finding duplicate forms:
"❓ I found an existing form with a similar name:

**'Customer Satisfaction Survey'**
Form ID: 1kqab9lzmPkGw8ufKsG2msbTNC5zUUrq6llio-ca3jHg

Did you mean to update this form, or would you like to create a new one?"

When explaining limitations:
"⚠️ I apologize, but the Google Forms API doesn't support modifying existing questions (like making them required). 

However, I can help you:
- Add new required fields
- Or you can manually edit the form using the link above

What would you prefer?"

Remember: You can perform multiple operations in sequence. For example:
1. Create a form with default questions
2. Add more questions if requested
3. Publish it
All in one conversation flow!

Always confirm successful operations and provide relevant links or IDs for reference.`;
  }

  /**
   * Main method to process user queries
   * 
   * @param {string} query - Natural language query from the user
   * @param {string} userId - User ID for authentication
   * @param {Object} options - Additional options (conversationHistory, forceToolExecution)
   * @returns {Promise<Object>} Processed response with Forms data
   */
  async processQuery(query, userId, options = {}) {
    try {
      console.log(`[FormsAgent] Processing query: "${query}" for user: ${userId}`);

      // If forceToolExecution is set, directly execute the tool without LLM
      if (options.forceToolExecution && options.forceToolExecution.toolName && options.forceToolExecution.params) {
        console.log(`[FormsAgent] Force executing tool: ${options.forceToolExecution.toolName}`);
        console.log(`[FormsAgent] With exact params:`, JSON.stringify(options.forceToolExecution.params, null, 2));
        
        const functionToCall = this.functionMap[options.forceToolExecution.toolName];
        if (!functionToCall) {
          throw new Error(`Unknown function: ${options.forceToolExecution.toolName}`);
        }

        const result = await functionToCall(userId, options.forceToolExecution.params);
        
        return {
          success: true,
          response: result.success ? `Successfully executed ${options.forceToolExecution.toolName}` : result.error,
          query: query,
          tools_used: [{
            name: options.forceToolExecution.toolName,
            arguments: options.forceToolExecution.params
          }],
          raw_results: [result],
          timestamp: new Date().toISOString()
        };
      }

      // Build messages array with conversation history if provided
      const messages = [
        {
          role: "system",
          content: this.systemPrompt
        }
      ];

      // Add conversation history if provided (for context continuity)
      if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
        messages.push(...options.conversationHistory);
      }

      // Add current query
      messages.push({
        role: "user",
        content: query
      });

      // Call OpenAI with function calling enabled
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: this.tools,
        tool_choice: "auto",
        max_tokens: 2000,
        temperature: 0.2 // Slightly higher for creative form suggestions
      });

      const message = response.choices[0].message;

      // Check if OpenAI wants to call any functions
      if (message.tool_calls && message.tool_calls.length > 0) {
        return await this.handleToolCalls(message.tool_calls, userId, query, messages);
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
      console.error('[FormsAgent] Error processing query:', error);
      return this.handleError(error, query);
    }
  }

  /**
   * Execute tool calls requested by OpenAI
   */
  async handleToolCalls(toolCalls, userId, originalQuery, conversationHistory) {
    try {
      console.log(`[FormsAgent] Executing ${toolCalls.length} tool call(s)`);

      const toolResults = [];
      const toolsUsed = [];

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`[FormsAgent] Calling function: ${functionName}`, functionArgs);

        toolsUsed.push({
          name: functionName,
          arguments: functionArgs
        });

        // Get the function from our map
        const functionToCall = this.functionMap[functionName];

        if (!functionToCall) {
          throw new Error(`Function ${functionName} not found`);
        }

        // Call the function with userId as first parameter, then spread other args
        let result;
        if (functionName === 'listForms') {
          result = await functionToCall(userId, functionArgs.pageSize, functionArgs.pageNumber);
        } else if (functionName === 'createForm') {
          result = await functionToCall(userId, functionArgs.title, functionArgs.description, functionArgs.questions);
        } else if (functionName === 'getResponses') {
          result = await functionToCall(userId, functionArgs.formId, functionArgs.pageSize, functionArgs.pageNumber);
        } else if (functionName === 'getForm') {
          result = await functionToCall(userId, functionArgs.formId);
        } else if (functionName === 'updateForm') {
          result = await functionToCall(userId, functionArgs.formId, functionArgs.title, functionArgs.description, functionArgs.questions);
        } else if (functionName === 'publishForm') {
          result = await functionToCall(userId, functionArgs.formId, functionArgs.isPublished, functionArgs.isAcceptingResponses);
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: JSON.stringify(result)
        });
      }

      // Send tool results back to OpenAI for final response
      const finalMessages = [
        ...conversationHistory,
        {
          role: "assistant",
          content: null,
          tool_calls: toolCalls
        },
        ...toolResults
      ];

      const finalResponse = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: finalMessages,
        max_tokens: 2000,
        temperature: 0.2
      });

      return {
        success: true,
        response: finalResponse.choices[0].message.content,
        query: originalQuery,
        tools_used: toolsUsed,
        raw_results: toolResults.map(r => JSON.parse(r.content)),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[FormsAgent] Error handling tool calls:', error);
      return this.handleError(error, originalQuery);
    }
  }

  /**
   * Handle errors gracefully
   */
  handleError(error, query) {
    const errorMessage = error.message || 'An unknown error occurred';
    
    let userFriendlyMessage = 'I encountered an error while processing your request. ';
    
    if (errorMessage.includes('tokens not found')) {
      userFriendlyMessage += 'Please make sure you have connected your Google Forms account.';
    } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      userFriendlyMessage += 'The form you requested could not be found. Please check the form ID.';
    } else if (errorMessage.includes('permission') || errorMessage.includes('403')) {
      userFriendlyMessage += 'You do not have permission to access this form.';
    } else if (errorMessage.includes('rate limit')) {
      userFriendlyMessage += 'Too many requests. Please try again in a moment.';
    } else {
      userFriendlyMessage += `Error: ${errorMessage}`;
    }

    return {
      success: false,
      response: userFriendlyMessage,
      query: query,
      error: errorMessage,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = FormsAgent;
