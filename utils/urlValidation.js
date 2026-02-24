/**
 * URL Validation Utility
 * 
 * Validates URLs in user queries to catch typos and incomplete URLs
 * before executing web searches or other URL-dependent operations.
 * 
 * Features:
 * - Detects common protocol typos (htp://, htps://, etc.)
 * - Validates domain structure and extensions
 * - Provides helpful suggestions for corrections
 * - Prevents silent auto-correction of invalid URLs
 */

class URLValidator {
  /**
   * Extract URLs from a query string
   * @param {string} query - User's query
   * @returns {Array<string>} - Array of found URLs
   */
  static extractURLs(query) {
    const urls = [];
    
    // Pattern 1: URLs with protocol (including typos)
    const protocolPattern = /\b(https?|htps?|htp):\/\/[^\s]+/gi;
    const protocolMatches = query.match(protocolPattern);
    if (protocolMatches) {
      urls.push(...protocolMatches);
    }
    
    // Pattern 2: URLs without protocol (www.example.com or example.com)
    const noProtocolPattern = /\b(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+\b/g;
    const noProtocolMatches = query.match(noProtocolPattern);
    if (noProtocolMatches) {
      // Filter out common false positives (email addresses, etc.)
      const filtered = noProtocolMatches.filter(match => {
        // Skip if it's part of an email address
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        if (emailPattern.test(match)) return false;
        
        // Skip if it's a file extension
        if (/\.(js|ts|py|java|cpp|txt|md|json|xml|html|css)$/i.test(match)) return false;
        
        return true;
      });
      urls.push(...filtered);
    }
    
    return [...new Set(urls)]; // Remove duplicates
  }

  /**
   * Validate a single URL
   * @param {string} url - URL to validate
   * @returns {Object} - Validation result
   */
  static validateURL(url) {
    const trimmedURL = url.trim();
    
    // Check for common protocol typos
    const protocolTypos = [
      { pattern: /^htp:\/\//i, correct: 'http://', typo: 'htp://' },
      { pattern: /^htps:\/\//i, correct: 'https://', typo: 'htps://' },
      { pattern: /^htttp:\/\//i, correct: 'http://', typo: 'htttp://' },
      { pattern: /^httpss:\/\//i, correct: 'https://', typo: 'httpss://' },
      { pattern: /^htt:\/\//i, correct: 'http://', typo: 'htt://' },
      { pattern: /^ttp:\/\//i, correct: 'http://', typo: 'ttp://' },
    ];
    
    for (const typo of protocolTypos) {
      if (typo.pattern.test(trimmedURL)) {
        return {
          isValid: false,
          error: 'PROTOCOL_TYPO',
          message: `URL has a typo in the protocol: "${typo.typo}" should be "${typo.correct}"`,
          suggestions: [
            trimmedURL.replace(typo.pattern, 'https://'),
            trimmedURL.replace(typo.pattern, 'http://')
          ],
          originalURL: trimmedURL
        };
      }
    }
    
    // Add protocol if missing for validation
    let urlToValidate = trimmedURL;
    if (!trimmedURL.match(/^https?:\/\//i)) {
      urlToValidate = 'https://' + trimmedURL;
    }
    
    // Try to parse the URL
    try {
      const parsedURL = new URL(urlToValidate);
      const hostname = parsedURL.hostname;
      
      // Check if domain has an extension
      if (!hostname.includes('.')) {
        return {
          isValid: false,
          error: 'MISSING_EXTENSION',
          message: `URL is missing a domain extension (like .com, .org, .net)`,
          suggestions: [
            `${trimmedURL}.com`,
            `${trimmedURL}.org`,
            `${trimmedURL}.net`
          ],
          originalURL: trimmedURL
        };
      }
      
      // Check for incomplete domain (e.g., "www.example")
      const parts = hostname.split('.');
      const lastPart = parts[parts.length - 1];
      
      // Check if the last part is a valid TLD (at least 2 chars and not a number)
      if (lastPart.length < 2 || /^\d+$/.test(lastPart)) {
        return {
          isValid: false,
          error: 'INVALID_EXTENSION',
          message: `Domain extension "${lastPart}" is too short or invalid`,
          suggestions: [
            `${trimmedURL}.com`,
            `${trimmedURL}.org`
          ],
          originalURL: trimmedURL
        };
      }
      
      // Check if the last part looks like a common word (not a TLD)
      // Common words that are NOT valid TLDs
      const commonWords = ['example', 'test', 'demo', 'sample', 'localhost', 'local'];
      if (commonWords.includes(lastPart.toLowerCase())) {
        return {
          isValid: false,
          error: 'MISSING_EXTENSION',
          message: `URL appears incomplete - "${lastPart}" is not a valid domain extension`,
          suggestions: [
            `${trimmedURL}.com`,
            `${trimmedURL}.org`,
            `${trimmedURL}.net`
          ],
          originalURL: trimmedURL
        };
      }
      
      // Check for common typos in domain extensions
      const extensionTypos = {
        'con': 'com',
        'cmo': 'com',
        'ocm': 'com',
        'comm': 'com',
        'ogr': 'org',
        'rog': 'org',
        'nte': 'net',
        'ent': 'net'
      };
      
      if (extensionTypos[lastPart.toLowerCase()]) {
        return {
          isValid: false,
          error: 'EXTENSION_TYPO',
          message: `Domain extension "${lastPart}" looks like a typo. Did you mean "${extensionTypos[lastPart.toLowerCase()]}"?`,
          suggestions: [
            trimmedURL.replace(new RegExp(`\\.${lastPart}$`, 'i'), `.${extensionTypos[lastPart.toLowerCase()]}`)
          ],
          originalURL: trimmedURL
        };
      }
      
      // URL is valid
      return {
        isValid: true,
        originalURL: trimmedURL,
        normalizedURL: urlToValidate
      };
      
    } catch (error) {
      // URL parsing failed
      return {
        isValid: false,
        error: 'INVALID_FORMAT',
        message: `"${trimmedURL}" doesn't appear to be a valid URL`,
        suggestions: [
          `https://${trimmedURL}`,
          `Did you mean a different URL?`
        ],
        originalURL: trimmedURL
      };
    }
  }

  /**
   * Validate all URLs in a query
   * @param {string} query - User's query
   * @returns {Object} - Validation result with all found URLs
   */
  static validateURLsInQuery(query) {
    const urls = this.extractURLs(query);
    
    if (urls.length === 0) {
      return {
        hasURLs: false,
        isValid: true,
        urls: []
      };
    }
    
    const validationResults = urls.map(url => this.validateURL(url));
    const invalidURLs = validationResults.filter(result => !result.isValid);
    
    return {
      hasURLs: true,
      isValid: invalidURLs.length === 0,
      urls: validationResults,
      invalidURLs: invalidURLs
    };
  }

  /**
   * Format validation errors into a user-friendly message
   * @param {Array} invalidURLs - Array of invalid URL validation results
   * @returns {string} - Formatted error message
   */
  static formatValidationErrors(invalidURLs) {
    if (!invalidURLs || invalidURLs.length === 0) {
      return '';
    }
    
    let message = '';
    
    for (const urlError of invalidURLs) {
      message += `I noticed an issue with the URL: "${urlError.originalURL}"\n\n`;
      message += `${urlError.message}\n\n`;
      
      if (urlError.suggestions && urlError.suggestions.length > 0) {
        message += `Did you mean:\n`;
        urlError.suggestions.forEach((suggestion, index) => {
          message += `${index + 1}. ${suggestion}\n`;
        });
        message += `\n`;
      }
    }
    
    message += `Please provide the correct URL and I'll help you with your request.`;
    
    return message.trim();
  }
}

module.exports = URLValidator;
