/**
 * Google Forms Agent - Multi-Step Execution Version
 * Extends BaseAgent to support sequential multi-step operations.
 */

const BaseAgent = require('../base/BaseAgent');
const formsService = require('./formsService');
const OpenAI = require('openai');

class FormsAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    const tools = {
      createForm: {
        definition: {
          type: 'function',
          function: {
            name: 'createForm',
            description: 'Create a new Google Form with a title and description',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Title of the form' },
                description: { type: 'string', description: 'Description of the form' }
              },
              required: ['title']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[FormsAgent] 📋 Creating form: "${params.title}"`);
          try {
            const form = await formsService.createForm(context.userId, params);
            console.log(`[FormsAgent] ✅ Form created: ${form.formId}`);
            return {
              success: true,
              formId: form.formId,
              title: form.info.title,
              url: form.responderUri,
              createdAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[FormsAgent] ❌ Error creating form:`, error.message);
            throw error;
          }
        }
      },

      addQuestion: {
        definition: {
          type: 'function',
          function: {
            name: 'addQuestion',
            description: 'Add a question to a form',
            parameters: {
              type: 'object',
              properties: {
                formId: { type: 'string', description: 'Form ID' },
                title: { type: 'string', description: 'Question text' },
                type: { type: 'string', enum: ['SHORT_ANSWER', 'PARAGRAPH', 'MULTIPLE_CHOICE', 'CHECKBOX', 'DROPDOWN', 'LINEAR_SCALE', 'MULTIPLE_CHOICE_GRID', 'CHECKBOX_GRID', 'DATE', 'TIME'], description: 'Question type' },
                options: { type: 'array', items: { type: 'string' }, description: 'Options for multiple choice questions' },
                required: { type: 'boolean', description: 'Whether the question is required', default: false }
              },
              required: ['formId', 'title', 'type']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[FormsAgent] ❓ Adding question to form: ${params.formId}`);
          try {
            const question = await formsService.addQuestion(context.userId, params);
            console.log(`[FormsAgent] ✅ Question added successfully`);
            return { success: true, formId: params.formId, questionId: question.questionId };
          } catch (error) {
            console.error(`[FormsAgent] ❌ Error adding question:`, error.message);
            throw error;
          }
        }
      },

      addSection: {
        definition: {
          type: 'function',
          function: {
            name: 'addSection',
            description: 'Add a section to a form',
            parameters: {
              type: 'object',
              properties: {
                formId: { type: 'string', description: 'Form ID' },
                title: { type: 'string', description: 'Section title' },
                description: { type: 'string', description: 'Section description' }
              },
              required: ['formId', 'title']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[FormsAgent] 📑 Adding section to form: ${params.formId}`);
          try {
            const section = await formsService.addSection(context.userId, params);
            console.log(`[FormsAgent] ✅ Section added successfully`);
            return { success: true, formId: params.formId, sectionId: section.sectionId };
          } catch (error) {
            console.error(`[FormsAgent] ❌ Error adding section:`, error.message);
            throw error;
          }
        }
      },

      publishForm: {
        definition: {
          type: 'function',
          function: {
            name: 'publishForm',
            description: 'Publish a form to make it available for responses',
            parameters: {
              type: 'object',
              properties: {
                formId: { type: 'string', description: 'Form ID' }
              },
              required: ['formId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[FormsAgent] 🚀 Publishing form: ${params.formId}`);
          try {
            const result = await formsService.publishForm(context.userId, params.formId);
            console.log(`[FormsAgent] ✅ Form published successfully`);
            return { success: true, formId: params.formId, publishedUrl: result.publishedUrl };
          } catch (error) {
            console.error(`[FormsAgent] ❌ Error publishing form:`, error.message);
            throw error;
          }
        }
      },

      getResponses: {
        definition: {
          type: 'function',
          function: {
            name: 'getResponses',
            description: 'Get responses from a form',
            parameters: {
              type: 'object',
              properties: {
                formId: { type: 'string', description: 'Form ID' }
              },
              required: ['formId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[FormsAgent] 📊 Getting responses for form: ${params.formId}`);
          try {
            const responses = await formsService.getResponses(context.userId, params.formId);
            console.log(`[FormsAgent] ✅ Retrieved ${responses.length} responses`);
            return { success: true, formId: params.formId, responses: responses, count: responses.length };
          } catch (error) {
            console.error(`[FormsAgent] ❌ Error getting responses:`, error.message);
            throw error;
          }
        }
      }
    };

    super('FormsAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  }

  getSystemPrompt() {
    const basePrompt = super.getSystemPrompt();
    return `${basePrompt}

GOOGLE FORMS SPECIFIC GUIDELINES:

1. **Form Creation**
   - Create form first if user wants to create one
   - Include title and description

2. **Multi-Step Example**
   User: "Create a form titled 'Feedback' and add a text question and a rating question"
   
   Step 1: createForm({ title: "Feedback", description: "..." })
   Result: { formId: "abc123", url: "..." }
   
   Step 2: addQuestion({ formId: "abc123", title: "What do you think?", type: "PARAGRAPH" })
   Result: { success: true }
   
   Step 3: addQuestion({ formId: "abc123", title: "Rate us", type: "LINEAR_SCALE" })
   Result: { success: true }

3. **Question Types**
   - SHORT_ANSWER: Single line text
   - PARAGRAPH: Multi-line text
   - MULTIPLE_CHOICE: Radio buttons
   - CHECKBOX: Multiple selections
   - LINEAR_SCALE: Rating scale

4. **Publishing**
   - Publish form when user requests
   - Include published URL in response`;
  }

  async processQuery(query, userId, options = {}) {
    console.log(`[FormsAgent] 🚀 Processing query (multi-step): "${query}"`);
    const result = await super.processQuery(query, {
      userId: userId,
      conversationId: options.conversationId,
      maxIterations: options.maxIterations || 15,
      forceToolExecution: options.forceToolExecution  // ✅ CRITICAL: Pass forceToolExecution to BaseAgent
    });

    return {
      success: result.success,
      response: result.summary,
      tools_used: result.executedActions.map(a => ({ name: a.tool })),
      raw_results: result.executedActions.map(a => a.result),
      conversationHistory: options.conversationHistory || [],
      totalSteps: result.totalSteps,
      errors: result.errors
    };
  }
}

module.exports = FormsAgentMultiStep;
