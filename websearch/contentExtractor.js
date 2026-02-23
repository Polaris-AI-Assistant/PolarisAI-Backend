/**
 * Content Extraction Service
 * 
 * Fetches web pages and extracts clean, readable content.
 * Removes navigation, ads, scripts, and other noise.
 * 
 * This is Stage 2 of the Research Pipeline:
 * Stage 1: Search (Discovery) → Stage 2: Fetch & Extract → Stage 3: Synthesize → Stage 4: Act
 */

const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fetch and extract clean content from a URL
 * @param {string} url - The URL to fetch
 * @param {number} maxLength - Maximum content length (default: 10000 chars)
 * @returns {Promise<Object>} - { success, url, title, content, excerpt, error }
 */
async function extractContent(url, maxLength = 10000) {
  console.log(`[ContentExtractor] 📄 Fetching: ${url}`);
  
  try {
    // Fetch the page with timeout
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      maxRedirects: 5
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, iframe, noscript, .ad, .advertisement, .social-share, .comments').remove();

    // Extract title
    let title = $('title').text().trim();
    if (!title) {
      title = $('h1').first().text().trim();
    }

    // Try to find main content area
    let content = '';
    
    // Common content selectors (in order of preference)
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      '#content',
      '.main-content'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        content = element.text();
        if (content.length > 200) {
          break;
        }
      }
    }

    // Fallback: get body text
    if (!content || content.length < 200) {
      content = $('body').text();
    }

    // Clean up the content
    content = content
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n\s*\n/g, '\n')  // Remove multiple newlines
      .trim();

    // Truncate if too long
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '...';
      console.log(`[ContentExtractor] ✂️ Truncated content to ${maxLength} chars`);
    }

    // Create excerpt (first 200 chars)
    const excerpt = content.substring(0, 200) + (content.length > 200 ? '...' : '');

    console.log(`[ContentExtractor] ✅ Extracted ${content.length} chars from: ${title}`);

    return {
      success: true,
      url: url,
      title: title,
      content: content,
      excerpt: excerpt,
      contentLength: content.length
    };

  } catch (error) {
    console.error(`[ContentExtractor] ❌ Error fetching ${url}:`, error.message);
    
    return {
      success: false,
      url: url,
      error: error.message,
      title: null,
      content: null,
      excerpt: null
    };
  }
}

/**
 * Extract content from multiple URLs in parallel
 * @param {Array<string>} urls - Array of URLs to fetch
 * @param {number} maxLength - Maximum content length per page
 * @returns {Promise<Array>} - Array of extraction results
 */
async function extractMultiple(urls, maxLength = 10000) {
  console.log(`[ContentExtractor] 📚 Fetching ${urls.length} URLs...`);
  
  const promises = urls.map(url => extractContent(url, maxLength));
  const results = await Promise.allSettled(promises);
  
  const extracted = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        success: false,
        url: urls[index],
        error: result.reason?.message || 'Unknown error',
        title: null,
        content: null,
        excerpt: null
      };
    }
  });

  const successCount = extracted.filter(r => r.success).length;
  console.log(`[ContentExtractor] ✅ Successfully extracted ${successCount}/${urls.length} pages`);

  return extracted;
}

/**
 * Check if a URL is likely to be extractable
 * @param {string} url - The URL to check
 * @returns {boolean} - True if URL is likely extractable
 */
function isExtractableUrl(url) {
  const lowerUrl = url.toLowerCase();
  
  // Exclude PDFs, images, videos
  if (lowerUrl.match(/\.(pdf|jpg|jpeg|png|gif|mp4|mp3|zip|exe)$/)) {
    return false;
  }
  
  // Exclude social media posts (often require login)
  if (lowerUrl.includes('facebook.com') || 
      lowerUrl.includes('twitter.com') || 
      lowerUrl.includes('instagram.com') ||
      lowerUrl.includes('linkedin.com/posts')) {
    return false;
  }
  
  return true;
}

module.exports = {
  extractContent,
  extractMultiple,
  isExtractableUrl
};
