/**
 * Web Search Service Module
 * 
 * Provides web search functionality using Serper API.
 * This service handles all communication with Serper to perform web searches,
 * news searches, and retrieve search results.
 * 
 * Features:
 * - General web search
 * - News search
 * - Image search
 * - Video search
 * - Shopping search
 */

const axios = require('axios');

/**
 * Perform a general web search using Serper API
 * 
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query
 * @param {number} [params.num=10] - Number of results (1-100)
 * @param {string} [params.location] - Location for localized results (e.g., "United States")
 * @param {string} [params.gl] - Country code (e.g., "us", "in")
 * @param {string} [params.hl] - Language code (e.g., "en", "hi")
 * @returns {Promise<Object>} Serper API response with search results
 * @throws {Error} If SERPER_API_KEY is not configured or API call fails
 */
async function searchWeb(params) {
  const apiKey = process.env.SERPER_API_KEY;
  
  if (!apiKey) {
    throw new Error("SERPER_API_KEY is not set. Please configure the SERPER_API_KEY environment variable.");
  }

  // Validate required parameters
  if (!params.query || typeof params.query !== 'string' || params.query.trim().length === 0) {
    throw new Error("Search query is required and must be a non-empty string");
  }

  // Build request body for Serper API
  const requestBody = {
    q: params.query.trim(),
    num: params.num || 10,
  };

  // Add optional parameters
  if (params.location) {
    requestBody.location = params.location;
  }
  if (params.gl) {
    requestBody.gl = params.gl;
  }
  if (params.hl) {
    requestBody.hl = params.hl;
  }

  const endpoint = "https://google.serper.dev/search";

  console.log(`[WebSearchService] Searching web for: "${params.query}"`);
  console.log(`[WebSearchService] Request body:`, JSON.stringify(requestBody, null, 2));

  try {
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log(`[WebSearchService] Successfully retrieved search results`);
    
    return {
      ...response.data,
      search_params: {
        query: params.query,
        num: params.num || 10,
        location: params.location || null,
        gl: params.gl || null,
        hl: params.hl || null
      }
    };

  } catch (error) {
    console.error('[WebSearchService] Error searching web:', error.message);
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401 || status === 403) {
        throw new Error("Invalid Serper API key. Please check your SERPER_API_KEY configuration.");
      } else if (status === 400) {
        throw new Error(`Invalid request: ${data.message || 'Please check your search parameters.'}`);
      } else if (status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      } else {
        throw new Error(`Web search failed: ${data.message || error.message}`);
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error("Request timeout. The search is taking too long. Please try again.");
    } else if (error.code === 'ENOTFOUND') {
      throw new Error("Unable to connect to search service. Please check your internet connection.");
    } else {
      throw new Error(`Web search failed: ${error.message}`);
    }
  }
}

/**
 * Search for news articles using Serper API
 * 
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query
 * @param {number} [params.num=10] - Number of results
 * @param {string} [params.location] - Location for localized results
 * @returns {Promise<Object>} News search results
 */
async function searchNews(params) {
  const apiKey = process.env.SERPER_API_KEY;
  
  if (!apiKey) {
    throw new Error("SERPER_API_KEY is not set. Please configure the SERPER_API_KEY environment variable.");
  }

  if (!params.query || typeof params.query !== 'string' || params.query.trim().length === 0) {
    throw new Error("Search query is required and must be a non-empty string");
  }

  const requestBody = {
    q: params.query.trim(),
    num: params.num || 10,
  };

  if (params.location) {
    requestBody.location = params.location;
  }

  const endpoint = "https://google.serper.dev/news";

  console.log(`[WebSearchService] Searching news for: "${params.query}"`);

  try {
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log(`[WebSearchService] Successfully retrieved news results`);
    
    return {
      ...response.data,
      search_params: {
        query: params.query,
        num: params.num || 10,
        location: params.location || null
      }
    };

  } catch (error) {
    console.error('[WebSearchService] Error searching news:', error.message);
    throw new Error(`News search failed: ${error.message}`);
  }
}

/**
 * Search for images using Serper API
 * 
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query
 * @param {number} [params.num=10] - Number of results
 * @returns {Promise<Object>} Image search results
 */
async function searchImages(params) {
  const apiKey = process.env.SERPER_API_KEY;
  
  if (!apiKey) {
    throw new Error("SERPER_API_KEY is not set.");
  }

  if (!params.query || typeof params.query !== 'string' || params.query.trim().length === 0) {
    throw new Error("Search query is required");
  }

  const requestBody = {
    q: params.query.trim(),
    num: params.num || 10,
  };

  const endpoint = "https://google.serper.dev/images";

  console.log(`[WebSearchService] Searching images for: "${params.query}"`);

  try {
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log(`[WebSearchService] Successfully retrieved image results`);
    
    return {
      ...response.data,
      search_params: {
        query: params.query,
        num: params.num || 10
      }
    };

  } catch (error) {
    console.error('[WebSearchService] Error searching images:', error.message);
    throw new Error(`Image search failed: ${error.message}`);
  }
}

/**
 * Format search results for user-friendly display
 * 
 * @param {Object} searchData - Raw search data from Serper API
 * @returns {Object} Formatted search results
 */
function formatSearchResults(searchData) {
  const formatResult = (result) => {
    if (!result) return null;
    
    return {
      title: result.title,
      link: result.link,
      snippet: result.snippet,
      position: result.position,
      date: result.date || null
    };
  };

  return {
    organic: (searchData.organic || []).map(formatResult).filter(Boolean),
    answerBox: searchData.answerBox || null,
    knowledgeGraph: searchData.knowledgeGraph || null,
    peopleAlsoAsk: searchData.peopleAlsoAsk || [],
    relatedSearches: searchData.relatedSearches || [],
    search_info: searchData.search_params || {}
  };
}

module.exports = {
  searchWeb,
  searchNews,
  searchImages,
  formatSearchResults
};
