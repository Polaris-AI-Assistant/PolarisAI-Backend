/**
 * Base Agent Class - Universal Multi-Step Execution Engine
 * 
 * All specialized agents (Docs, Gmail, GitHub, etc.) inherit from this class.
 * Implements the ReAct loop (Reasoning + Acting) for sequential multi-step execution.
 * 
 * Key Features:
 * - Sequential tool execution (one at a time)
 * - Context propagation between steps
 * - Automatic result capture and reuse
 * - Parameter validation (no placeholders)
 * - Comprehensive error handling
 * - Works for ANY agent type
 */

const OpenAI = require('openai');

class BaseAgent {
  constructor(agentName, tools, llmClient) {
    this.agentName = agentName;
    this.tools = tools; // { toolName: { definition, execute }, ... }
    this.llm = llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = 'gpt-4o-mini';
  }

  /**
   * Universal multi-step query processor
   * Works for ANY agent (Docs, Gmail, Slack, GitHub, etc.)
   * 
   * @param {string} query - User's request
   * @param {Object} context - Execution context (userId, conversationId, etc.)
   * @returns {Promise<Object>} - Execution result with all completed actions
   */
  async processQuery(query, context = {}) {
    console.log(`\n[${this.agentName}] 🚀 Processing query: "${query}"`);
    console.log(`[${this.agentName}] 📋 Context:`, { userId: context.userId, conversationId: context.conversationId });

    // ✅ Detect query language using LLM
    const languageDetection = require('../utils/languageDetection');
    const detectedLanguage = await languageDetection.detectLanguage(query);
    const languageName = languageDetection.getLanguageName(detectedLanguage);
    console.log(`[${this.agentName}] 🌐 Detected language: ${languageName} (${detectedLanguage})`);

    // ✅ VALIDATION: Detect if query has been incorrectly rewritten
    const rewritePatterns = [
      /^Execute the following action:/i,
      /^Perform this action:/i,
      /^Run this tool:/i,
      /^Call this function:/i
    ];
    
    for (const pattern of rewritePatterns) {
      if (pattern.test(query)) {
        console.error(`[${this.agentName}] ❌ CRITICAL ERROR: Query has been rewritten!`);
        console.error(`[${this.agentName}] Original query was replaced with: "${query}"`);
        console.error(`[${this.agentName}] This will cause multi-step execution to fail!`);
        console.error(`[${this.agentName}] FIX: Pass the original user query, not a rewritten version`);
        
        // In development, throw error to force fix
        if (process.env.NODE_ENV === 'development') {
          throw new Error(
            `Query rewriting detected! Pass original user query to agents. ` +
            `Received: "${query}"`
          );
        }
      }
    }

    const messages = this.buildInitialMessages(query, context, detectedLanguage);
    
    const executionContext = {
      conversationId: context.conversationId,
      userId: context.userId,
      forceToolExecution: context.forceToolExecution || null,  // ✅ CRITICAL: Copy forceToolExecution to executionContext
      detectedLanguage: detectedLanguage,  // ✅ Store detected language
      languageName: languageName,  // ✅ Store language name
      language: detectedLanguage,  // ✅ Pass language for sub-agent calls
      llmClient: this.llm,  // ✅ Pass LLM client for sub-agent calls
      results: {}, // Store results from each step
      iteration: 0,
      maxIterations: context.maxIterations || 15,
      executedActions: [],
      errors: []
    };

    // ========== MULTI-STEP EXECUTION LOOP ==========
    // This loop continues until:
    // 1. LLM decides no more actions are needed (no tool calls)
    // 2. Max iterations reached (safety check)
    // 3. Critical error occurs
    while (executionContext.iteration < executionContext.maxIterations) {
      executionContext.iteration++;
      console.log(`\n[${this.agentName}] 🔄 Iteration ${executionContext.iteration}/${executionContext.maxIterations}`);

      try {
        // Call LLM to decide next action
        const response = await this.callLLM(messages);

        // Check if LLM is done (no more tool calls)
        if (!response.tool_calls || response.tool_calls.length === 0) {
          console.log(`[${this.agentName}] ✅ All actions completed (LLM decided no more tools needed)`);
          
          // Add final assistant message to conversation
          if (response.content) {
            messages.push({
              role: 'assistant',
              content: response.content
            });
          }
          break;
        }

        // Add assistant message with tool calls to conversation
        messages.push({
          role: 'assistant',
          content: response.content || null,
          tool_calls: response.tool_calls
        });

        // ========== EXECUTE EACH TOOL CALL SEQUENTIALLY ==========
        for (const toolCall of response.tool_calls) {
          const toolName = toolCall.function.name;
          console.log(`\n[${this.agentName}] 📞 Calling tool: ${toolName}`);

          try {
            // Parse and validate parameters
            let rawParams = JSON.parse(toolCall.function.arguments);
            
            // ✅ CRITICAL FIX: If forceToolExecution is set and this is the forced tool,
            // use the EXACT params from forceToolExecution, not what the LLM generated
            if (executionContext.forceToolExecution && 
                executionContext.forceToolExecution.toolName === toolName &&
                executionContext.iteration === 1) {
              console.log(`[${this.agentName}] 🔒 FORCING exact parameters from confirmation`);
              console.log(`[${this.agentName}] ❌ LLM generated params (IGNORED):`, rawParams);
              rawParams = executionContext.forceToolExecution.params;
              console.log(`[${this.agentName}] ✅ Using forced params:`, rawParams);
              
              // Clear forceToolExecution after first use so subsequent tools use LLM params
              executionContext.forceToolExecution = null;
            }
            
            console.log(`[${this.agentName}] 📥 Parameters:`, rawParams);

            // ✅ CRITICAL: Validate parameters (no placeholders allowed)
            this.validateParameters(rawParams, toolName);

            // Execute the tool
            const result = await this.executeToolCall(toolCall, executionContext, rawParams);

            console.log(`[${this.agentName}] ✅ Result:`, result);

            // Store result for future steps
            executionContext.results[toolCall.id] = result;
            executionContext.executedActions.push({
              tool: toolName,
              params: rawParams,
              result: result,
              timestamp: new Date().toISOString(),
              iteration: executionContext.iteration
            });

            // Add tool result to conversation so LLM can use it in next iteration
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(result)
            });

            console.log(`[${this.agentName}] ✅ Step completed: ${toolName}`);

          } catch (error) {
            console.error(`[${this.agentName}] ❌ Error executing ${toolName}:`, error.message);

            // Store error for tracking
            executionContext.errors.push({
              tool: toolName,
              error: error.message,
              iteration: executionContext.iteration
            });

            // Add error to conversation so LLM can handle it
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify({
                error: true,
                message: error.message,
                code: error.code || 'UNKNOWN_ERROR'
              })
            });

            // Let LLM decide how to handle the error
            // It might retry, skip, or ask user for help
            console.log(`[${this.agentName}] 🤔 LLM will decide how to handle this error in next iteration`);
          }
        }

      } catch (error) {
        console.error(`[${this.agentName}] ❌ Critical error in iteration ${executionContext.iteration}:`, error.message);
        executionContext.errors.push({
          iteration: executionContext.iteration,
          error: error.message,
          critical: true
        });
        break;
      }
    }

    // Safety check for infinite loops
    if (executionContext.iteration >= executionContext.maxIterations) {
      console.warn(`[${this.agentName}] ⚠️ Max iterations (${executionContext.maxIterations}) reached`);
    }

    // Generate summary
    const summary = await this.generateSummary(executionContext.executedActions, messages);

    console.log(`\n[${this.agentName}] 📊 Execution Summary:`);
    console.log(`[${this.agentName}]   Total steps: ${executionContext.executedActions.length}`);
    console.log(`[${this.agentName}]   Errors: ${executionContext.errors.length}`);
    console.log(`[${this.agentName}]   Summary: ${summary}`);

    return {
      success: executionContext.errors.length === 0,
      agentName: this.agentName,
      executedActions: executionContext.executedActions,
      totalSteps: executionContext.executedActions.length,
      errors: executionContext.errors,
      summary: summary,
      results: executionContext.results
    };
  }

  /**
   * Call LLM to get next action(s)
   * 
   * @param {Array} messages - Conversation history
   * @returns {Promise<Object>} - LLM response with tool_calls
   */
  async callLLM(messages) {
    try {
      const response = await this.llm.chat.completions.create({
        model: this.model,
        messages: messages,
        tools: this.getToolDefinitions(),
        tool_choice: 'auto',
        parallel_tool_calls: false, // ✅ CRITICAL: Force sequential execution
        max_tokens: 4096
      });

      const choice = response.choices[0];

      // Extract tool calls if present
      const toolCalls = choice.message.tool_calls || [];

      return {
        content: choice.message.content,
        tool_calls: toolCalls,
        stop_reason: choice.finish_reason
      };

    } catch (error) {
      console.error(`[${this.agentName}] ❌ LLM API error:`, error.message);
      throw new Error(`LLM call failed: ${error.message}`);
    }
  }

  /**
   * Execute a single tool call
   * 
   * @param {Object} toolCall - Tool call from LLM
   * @param {Object} executionContext - Current execution context
   * @param {Object} overrideParams - Optional params to override LLM's params (for forceToolExecution)
   * @returns {Promise<Object>} - Tool execution result
   */
  async executeToolCall(toolCall, executionContext, overrideParams = null) {
    const toolName = toolCall.function.name;
    const tool = this.tools[toolName];

    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in ${this.agentName}`);
    }

    if (!tool.execute) {
      throw new Error(`Tool '${toolName}' has no execute function`);
    }

    // Use overridden params if provided, otherwise parse from toolCall
    const params = overrideParams || JSON.parse(toolCall.function.arguments);

    // Execute the tool with execution context
    const result = await tool.execute(params, executionContext);

    return result;
  }

  /**
   * Validate parameters don't contain placeholders
   * 
   * @param {Object} params - Parameters to validate
   * @param {string} toolName - Name of the tool
   * @throws {Error} - If validation fails
   */
  validateParameters(params, toolName) {
    const paramString = JSON.stringify(params);

    // Check for common placeholder patterns
    const placeholderPatterns = [
      /<from step \d+>/i,
      /<previous step>/i,
      /<step \d+>/i,
      /<result>/i,
      /\{from_step_\d+\}/i,
      /\$\{step\d+\}/i,
      /\[from step \d+\]/i,
      /placeholder/i
    ];

    for (const pattern of placeholderPatterns) {
      if (pattern.test(paramString)) {
        const match = paramString.match(pattern);
        throw new Error(
          `❌ Invalid parameters for ${toolName}: Contains placeholder "${match[0]}". ` +
          `Previous step did not execute properly or result was not captured.`
        );
      }
    }

    // Check for empty/null critical ID fields
    const criticalIdFields = [
      'documentId', 'messageId', 'threadId', 'fileId', 'channelId', 'issueId',
      'prNumber', 'commitSha', 'repoId', 'userId', 'email', 'url'
    ];

    for (const field of criticalIdFields) {
      if (field in params) {
        const value = params[field];
        if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
          throw new Error(
            `❌ Invalid parameters for ${toolName}: Required field "${field}" is empty or null. ` +
            `Previous step may have failed or result was not captured.`
          );
        }
      }
    }
  }

  /**
   * Build initial conversation messages
   * 
   * @param {string} query - User's query
   * @param {Object} context - Execution context
   * @param {string} detectedLanguage - Detected language code
   * @returns {Array} - Initial messages array
   */
  buildInitialMessages(query, context, detectedLanguage = 'en') {
    const languageDetection = require('../utils/languageDetection');
    const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
    
    const messages = [
      {
        role: 'system',
        content: this.getSystemPrompt() + '\n\n' + languageInstruction
      }
    ];

    // If there's a confirmed action, add it as helpful context
    // This tells the agent which action to execute first with EXACT parameters
    if (context.forceToolExecution) {
      const { toolName, params } = context.forceToolExecution;
      messages.push({
        role: 'system',
        content: `CRITICAL: User has confirmed the action ${toolName} with these EXACT parameters:
${JSON.stringify(params, null, 2)}

You MUST execute this tool with these EXACT parameters. DO NOT modify, regenerate, or change any parameter values.
After executing this action, proceed with any remaining actions from the user's request.`
      });
    }

    // ✅ CRITICAL: Always include the ORIGINAL user query
    messages.push({
      role: 'user',
      content: query  // This must be the original query, not a rewritten version
    });

    return messages;
  }

  /**
   * System prompt for multi-step execution
   * 
   * @returns {string} - System prompt
   */
  getSystemPrompt() {
    return `You are a ${this.agentName} agent that executes user requests step-by-step using the ReAct loop (Reasoning + Acting).

CRITICAL RULES FOR MULTI-STEP EXECUTION:

1. **Execute ONE action at a time**
   - Call one tool, wait for result
   - Use the result in the next action
   - Never plan all steps upfront
   - Never call multiple tools in one iteration

2. **Use ACTUAL values from results**
   - After creating a resource, you'll get its ID
   - Use that ACTUAL ID in subsequent actions
   - NEVER use placeholders like "<from step 1>" or "{previous_result}"
   - NEVER use generic IDs like "doc_id" or "message_id"

3. **Handle dependencies correctly**
   - If step 2 needs output from step 1, execute step 1 first
   - Wait for the result before proceeding
   - The result will be provided to you automatically in the conversation

4. **Error handling**
   - If a step fails, analyze the error message
   - Decide whether to retry, skip, or ask user for help
   - Don't continue if a critical step fails
   - Provide clear error messages to the user

5. **Completion**
   - Continue until ALL requested actions are complete
   - When done, stop calling tools (don't call any more tools)
   - Provide a summary of what was accomplished

EXECUTION FLOW EXAMPLE:
User: "Create a document titled 'Plan' and add an introduction section"

Iteration 1:
- You reason: "I need to create a document first"
- You call: createDocument({ title: "Plan" })
- System returns: { documentId: "abc123xyz", url: "https://..." }

Iteration 2:
- You reason: "Now I have the document ID, I can add content"
- You see documentId from previous step in the conversation
- You call: appendContent({ documentId: "abc123xyz", content: "# Introduction\\n\\n..." })
- System returns: { success: true }

Iteration 3:
- You reason: "All requested actions are complete"
- You don't call any tools
- Execution completes

Available tools: ${Object.keys(this.tools).join(', ')}

Remember: The key to multi-step execution is SEQUENTIAL execution with ACTUAL values from previous steps.`;
  }

  /**
   * Get tool definitions for LLM
   * 
   * @returns {Array} - Tool definitions
   */
  getToolDefinitions() {
    return Object.values(this.tools)
      .map(tool => tool.definition)
      .filter(def => def !== undefined);
  }

  /**
   * Generate summary of executed actions
   * 
   * @param {Array} executedActions - List of executed actions
   * @param {Array} messages - Conversation messages
   * @returns {Promise<string>} - Summary text
   */
  async generateSummary(executedActions, messages) {
    if (executedActions.length === 0) {
      return 'No actions were executed.';
    }

    try {
      // Let LLM generate a natural language summary
      const summaryPrompt = {
        role: 'user',
        content: `Summarize what was accomplished in 1-2 sentences. Be specific about what was created/modified and include relevant IDs or links if available.`
      };

      const response = await this.llm.chat.completions.create({
        model: this.model,
        messages: [...messages, summaryPrompt],
        tools: [],
        max_tokens: 200
      });

      return response.choices[0].message.content || 'Execution completed.';
    } catch (error) {
      console.error(`[${this.agentName}] ⚠️ Error generating summary:`, error.message);
      // Fallback summary
      return `Executed ${executedActions.length} action(s): ${executedActions.map(a => a.tool).join(', ')}`;
    }
  }
}

module.exports = BaseAgent;
