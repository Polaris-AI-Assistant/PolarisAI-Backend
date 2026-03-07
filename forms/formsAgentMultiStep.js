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
            description: 'Create a new Google Form with title, description, and optional questions. If questions are provided, they will be added to the form during creation.',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Title of the form' },
                description: { type: 'string', description: 'Description of the form' },
                questions: {
                  type: 'array',
                  description: 'Optional array of questions to add to the form during creation',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Question text' },
                      type: { type: 'string', description: 'Question type: text, paragraph, scale, radio, checkbox, dropdown' },
                      required: { type: 'boolean', description: 'Whether question is required' },
                      options: { type: 'array', items: { type: 'string' }, description: 'Options for choice questions' }
                    }
                  }
                }
              },
              required: ['title']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[FormsAgent] 📋 Creating form: "${params.title}"`);
          try {
            const result = await formsService.createForm(
              context.userId, 
              params.title, 
              params.description || '', 
              params.questions || []
            );
            console.log(`[FormsAgent] ✅ Form created: ${result.formId}`);
            return {
              success: true,
              formId: result.formId,
              title: result.form.info.title,
              url: result.form.responderUri,
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

1. **Form Creation with Questions**
   - When creating a form, if questions are provided in the confirmation parameters, they are ALREADY included in the createForm execution
   - DO NOT call addQuestion for questions that were part of the createForm parameters
   - After createForm completes successfully with questions, the form is COMPLETE - no need to add questions again

2. **Adding Questions to Existing Forms**
   - Use addQuestion ONLY when adding NEW questions to an EXISTING form
   - Example: User says "add a phone number field to the form we just created"

3. **Multi-Step Example** 
   User: "Create a form titled 'Feedback'"
   Step 1: createForm({ title: "Feedback", description: "..." })
   Result: Form created with all questions already included
   
   User later: "Add another question to that form"
   Step 2: addQuestion({ formId: "abc123", title: "Phone number?", type: "SHORT_ANSWER" })

4. **Question Types**
   - SHORT_ANSWER / TEXT: Single line text
   - PARAGRAPH: Multi-line text
   - LINEAR_SCALE / SCALE: Rating scale
   - MULTIPLE_CHOICE / RADIO: Radio buttons (requires options)
   - CHECKBOX: Multiple selections (requires options)
   - DROPDOWN: Dropdown menu (requires options)
   - DATE: Date picker
   - TIME: Time picker

5. **Publishing**
   - Publish form when user requests
   - Include published URL in response
   
6. **IMPORTANT: When forceToolExecution is active**
   - Execute the tool ONCE with the provided parameters
   - The parameters already include all necessary data (including questions for createForm)
   - Do NOT attempt to add the same data again in subsequent iterations`;
  }

  async processQuery(query, userIdOrContext, options = {}) {
    console.log(`[FormsAgent] 🚀 Processing query (multi-step): "${query}"`);
    
    // Detect which signature is being used
    let context;
    if (typeof userIdOrContext === 'string') {
      context = {
        userId: userIdOrContext,
        conversationId: options.conversationId,
        maxIterations: options.maxIterations || 15,
        forceToolExecution: options.forceToolExecution,
        conversationHistory: options.conversationHistory
      };
    } else if (typeof userIdOrContext === 'object') {
      context = userIdOrContext;
    } else {
      throw new Error(`Invalid processQuery signature`);
    }
    
    const result = await super.processQuery(query, context);

    return {
      success: result.success,
      response: result.summary,
      tools_used: result.executedActions.map(a => ({ name: a.tool })),
      raw_results: result.executedActions.map(a => a.result),
      conversationHistory: context.conversationHistory || [],
      totalSteps: result.totalSteps,
      errors: result.errors
    };
  }
}

module.exports = FormsAgentMultiStep;
