/**
 * Repository statistics. Thin wrappers over GitHub REST API.
 * @module github-tools/stats
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * Get commit activity (last year, by week).
 * @param {object} params - { owner, repo }
 * @param {object} context - { userId }
 */
async function github_getCommitActivity(params, context) {
  const { owner, repo } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/stats/commit_activity`,
    })
  );
}

/**
 * Get contributor stats (additions, deletions, commit counts).
 * @param {object} params - { owner, repo }
 * @param {object} context - { userId }
 */
async function github_getContributorsStats(params, context) {
  const { owner, repo } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/stats/contributors`,
    })
  );
}

module.exports = {
  github_getCommitActivity,
  github_getContributorsStats,
};
