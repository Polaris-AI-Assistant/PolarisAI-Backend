/**
 * Deep Research AI Agent
 * 
 * Perplexity-style research agent that performs multi-step web research
 * with streaming progress updates and high-quality synthesis.
 */

const ResearchService = require('./researchService');

class ResearchAgent {
  constructor() {
    this.researchService = new ResearchService();
  }

  /**
   * Process research query with streaming progress
   * 
   * @param {string} query - User's research query
   * @param {Object|Function} optionsOrCallback - Options object or progress callback (for backward compatibility)
   * @returns {Promise<Object>} Research results
   */
  async processQuery(query, optionsOrCallback) {
    try {
      console.log(`[ResearchAgent] Starting research for: "${query}"`);

      // Handle both old callback style and new options style
      let onProgress = null;
      let options = {};
      
      if (typeof optionsOrCallback === 'function') {
        // Old style: direct callback
        onProgress = optionsOrCallback;
      } else if (typeof optionsOrCallback === 'object') {
        // New style: options object
        options = optionsOrCallback || {};
        onProgress = options.onProgress || null;
      }

      // Validate query
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Query is required and must be a non-empty string');
      }

      if (query.length > 500) {
        throw new Error('Query is too long. Please keep it under 500 characters.');
      }

      // Start research pipeline
      onProgress?.({ 
        step: 'started', 
        message: '🚀 Starting deep research...',
        progress: 0
      });

      const result = await this.researchService.conductResearch(query, (update) => {
        // Pass through all progress updates including plan
        onProgress?.({ ...update });
      });

      if (result.success) {
        onProgress?.({ 
          step: 'completed', 
          message: '✅ Research completed!',
          progress: 100
        });
      } else {
        onProgress?.({ 
          step: 'failed', 
          message: '❌ Research failed',
          progress: 0
        });
      }

      return result;

    } catch (error) {
      console.error('[ResearchAgent] Error:', error);
      
      const onProgress = typeof optionsOrCallback === 'function' 
        ? optionsOrCallback 
        : optionsOrCallback?.onProgress;
      
      onProgress?.({ 
        step: 'error', 
        message: `❌ Error: ${error.message}`,
        progress: 0
      });

      return {
        success: false,
        error: error.message,
        answer: `I encountered an error while researching: ${error.message}`,
        sources: [],
        steps: [],
        metadata: {
          query,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Get agent capabilities
   */
  getCapabilities() {
    return {
      name: 'Deep Research Agent',
      description: 'Perplexity-style multi-step research with comprehensive synthesis',
      features: [
        'Multi-step web research',
        'Parallel search execution',
        'Iterative deep research',
        'Source citation',
        'Follow-up question generation',
        'Real-time progress updates'
      ],
      limitations: [
        'Requires active internet connection',
        'Subject to API rate limits',
        'Research quality depends on available sources'
      ],
      model: 'Gemini 1.5 Flash',
      maxQueryLength: 500
    };
  }

  /**
   * Get example queries
   */
  getExamples() {
    return {
      informational: [
        'What are the best AI models for startups in 2026?',
        'Explain quantum computing and its current applications',
        'What is the latest research on climate change solutions?',
        'How does blockchain technology work?',
        'What are the benefits of meditation for mental health?'
      ],
      comparative: [
        'Compare React vs Vue.js for web development',
        'What are the differences between GPT-4 and Claude?',
        'Compare electric cars vs hybrid cars',
        'Python vs JavaScript for beginners',
        'Compare different cloud providers (AWS, Azure, GCP)'
      ],
      analytical: [
        'Analyze the impact of AI on job markets',
        'What are the pros and cons of remote work?',
        'Evaluate the effectiveness of renewable energy',
        'Analyze trends in cryptocurrency adoption',
        'What are the challenges in space exploration?'
      ],
      current_events: [
        'Latest developments in artificial intelligence',
        'Recent breakthroughs in medical research',
        'Current trends in technology industry',
        'Latest news on climate policy',
        'Recent advances in space exploration'
      ]
    };
  }

  /**
   * Clear research cache
   */
  clearCache() {
    this.researchService.clearCache();
  }
}

module.exports = ResearchAgent;
