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
 * - Smart query enhancement for academic papers, news, etc.
 * - Result filtering to remove listing pages and irrelevant content
 */

const axios = require('axios');

/**
 * Detect search type from query
 * @param {string} query - The search query
 * @returns {string} - Search type: 'academic', 'news', 'images', 'videos', or 'general'
 */
function detectSearchType(query) {
  const lowerQuery = query.toLowerCase();
  
  // Academic papers
  if (lowerQuery.match(/papers?|research|study|studies|academic|journal|arxiv|publication|thesis|dissertation|scholar/)) {
    return 'academic';
  }
  
  // News
  if (lowerQuery.match(/news|latest|breaking|headlines|article|current events/)) {
    return 'news';
  }
  
  // Images
  if (lowerQuery.match(/image|picture|photo|screenshot|visual/)) {
    return 'images';
  }
  
  // Videos
  if (lowerQuery.match(/video|youtube|watch|tutorial|how to/)) {
    return 'videos';
  }
  
  // Default
  return 'general';
}

/**
 * Enhance query based on search type
 * @param {string} query - Original search query
 * @param {string} searchType - Type of search (academic, news, etc.)
 * @returns {string} - Enhanced query
 */
function enhanceQuery(query, searchType) {
  switch (searchType) {
    case 'academic':
      // For academic papers, target specific sites and exclude listing pages
      return `${query} (site:arxiv.org/abs OR site:arxiv.org/pdf OR site:semanticscholar.org/paper OR site:scholar.google.com) -site:arxiv.org/list -site:arxiv.org/recent -site:arxiv.org/current`;
    
    case 'news':
      // For news, add news keyword if not already present
      if (!query.toLowerCase().includes('news')) {
        return `${query} news`;
      }
      return query;
    
    case 'videos':
      // For videos, target video platforms
      return `${query} (site:youtube.com/watch OR site:vimeo.com)`;
    
    case 'images':
    case 'general':
    default:
      return query;
  }
}

/**
 * Filter search results based on search type
 * @param {Array} results - Raw search results from Serper
 * @param {string} searchType - Type of search
 * @returns {Array} - Filtered results
 */
function filterResults(results, searchType) {
  if (!results || !Array.isArray(results)) {
    return [];
  }
  
  if (searchType === 'academic') {
    return results.filter(result => {
      const link = result.link.toLowerCase();
      
      // ❌ Exclude listing pages
      if (link.includes('/list/') || 
          link.includes('/recent') || 
          link.includes('/current') ||
          link.includes('/trending') ||
          link.includes('/new')) {
        console.log(`[WebSearchService] ❌ Filtered out listing page: ${result.title}`);
        return false;
      }
      
      // ✅ Include actual paper pages
      if (link.includes('/abs/') ||      // arXiv abstract
          link.includes('/pdf/') ||      // arXiv PDF
          link.includes('semanticscholar.org/paper') ||
          link.includes('scholar.google.com') ||
          link.includes('doi.org') ||
          link.includes('researchgate.net/publication') ||
          link.includes('ieeexplore.ieee.org/document') ||
          link.includes('dl.acm.org/doi')) {
        return true;
      }
      
      // ❌ Exclude conference pages (unless they're paper links)
      if ((link.includes('mlsys.org') || 
           link.includes('satml.org') ||
           link.includes('neurips.cc') ||
           link.includes('icml.cc') ||
           link.includes('iclr.cc')) &&
          !link.includes('/paper/') &&
          !link.includes('/proceedings/')) {
        console.log(`[WebSearchService] ❌ Filtered out conference page: ${result.title}`);
        return false;
      }
      
      return true;
    });
  }
  
  // For other search types, return all results
  return results;
}

/**
 * Perform a general web search using Serper API
 * 
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query
 * @param {number} [params.num=10] - Number of results (1-100)
 * @param {string} [params.location] - Location for localized results (e.g., "United States")
 * @param {string} [params.gl] - Country code (e.g., "us", "in")
 * @param {string} [params.hl] - Language code (e.g., "en", "hi")
 * @param {string} [params.searchType] - Type of search (academic, news, etc.) - auto-detected if not provided
 * @returns {Promise<Object>} Serper API response with search results
 * @throws {Error} If SERPER_API_KEY is not configured or API call fails
 */
async function searchWeb(params) {
  // Try SERPER_API_KEY first, then fall back to SERPAPI_KEY (in case of confusion)
  let apiKey = process.env.SERPER_API_KEY;
  
  console.log(`[WebSearchService] 🔍 Checking SERPER_API_KEY...`);
  console.log(`[WebSearchService]   process.env.SERPER_API_KEY: ${apiKey ? '✅ SET (' + apiKey.substring(0, 10) + '...)' : '❌ NOT SET'}`);
  
  if (!apiKey) {
    console.error(`[WebSearchService] ❌ SERPER_API_KEY is missing!`);
    throw new Error("SERPER_API_KEY is not set. Please configure the SERPER_API_KEY environment variable.");
  }
  
  console.log(`[WebSearchService] ✅ Using API key: ${apiKey.substring(0, 10)}...`);

  // Validate required parameters
  if (!params.query || typeof params.query !== 'string' || params.query.trim().length === 0) {
    throw new Error("Search query is required and must be a non-empty string");
  }

  // ✅ STEP 1: Detect search type
  const searchType = params.searchType || detectSearchType(params.query);
  console.log(`[WebSearchService] 📊 Search type: ${searchType}`);
  
  // ✅ STEP 2: Enhance query based on type
  const originalQuery = params.query.trim();
  const enhancedQuery = enhanceQuery(originalQuery, searchType);
  
  if (enhancedQuery !== originalQuery) {
    console.log(`[WebSearchService] 🔍 Original query: "${originalQuery}"`);
    console.log(`[WebSearchService] ✨ Enhanced query: "${enhancedQuery}"`);
  }

  // Build request body for Serper API
  const requestBody = {
    q: enhancedQuery,
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

  console.log(`[WebSearchService] Searching web for: "${enhancedQuery}"`);

  try {
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log(`[WebSearchService] Successfully retrieved search results`);
    
    // ✅ STEP 3: Filter results based on search type
    const rawResults = response.data.organic || [];
    const filteredResults = filterResults(rawResults, searchType);
    
    if (filteredResults.length < rawResults.length) {
      console.log(`[WebSearchService] ✅ Filtered: ${rawResults.length} → ${filteredResults.length} results`);
    }
    
    return {
      ...response.data,
      organic: filteredResults,
      search_metadata: {
        original_query: originalQuery,
        enhanced_query: enhancedQuery,
        search_type: searchType,
        original_count: rawResults.length,
        filtered_count: filteredResults.length
      },
      search_params: {
        query: originalQuery,
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
  formatSearchResults,
  detectSearchType,
  enhanceQuery,
  filterResults
};
