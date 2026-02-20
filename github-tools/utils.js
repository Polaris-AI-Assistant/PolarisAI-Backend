/**
 * Shared helper for tool pattern: run request and return normalized { success, data, error }.
 * @module github-tools/utils
 */

const { githubAuthService } = require('../github-client');
const { githubErrorHandler } = require('../github-client');

/**
 * Execute a GitHub API call with token from context and return normalized result.
 * @param {object} context - Must contain userId.
 * @param {function(string): Promise<object>} fn - Receives token, returns axios response (or throws).
 * @returns {Promise<{ success: boolean, data: object|null, error: object|null }>}
 */
async function withToken(context, fn) {
  try {
    const token = await githubAuthService.getToken(context.userId);
    const response = await fn(token);
    const data = response && response.data !== undefined ? response.data : response;
    return { success: true, data, error: null };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: githubErrorHandler.normalize(err),
    };
  }
}

module.exports = { withToken };
