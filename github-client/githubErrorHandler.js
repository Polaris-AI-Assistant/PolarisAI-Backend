/**
 * Normalize GitHub API errors to a consistent shape.
 * @module github-client/githubErrorHandler
 */

/**
 * Normalize an error to { code, message }.
 * @param {Error|object} error - Caught error (axios error or Error).
 * @returns {{ code: string, message: string }}
 */
function normalize(error) {
  if (!error) {
    return { code: 'UNKNOWN', message: 'Unknown error' };
  }
  const msg = error.message || (typeof error === 'string' ? error : 'Unknown error');
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data || {};
    const apiMessage = data.message || data.error || msg;
    const code = `GITHUB_${status}`;
    return { code, message: apiMessage };
  }
  if (msg.includes('GitHub token') || msg.includes('token not found')) {
    return { code: 'TOKEN_MISSING_OR_INVALID', message: msg };
  }
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return { code: 'NETWORK_ERROR', message: msg };
  }
  return { code: 'UNKNOWN', message: msg };
}

module.exports = {
  normalize,
};
