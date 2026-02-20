/**
 * Comment management (delete). Thin wrappers over GitHub REST API.
 * @module github-tools/comments
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * Delete an issue comment.
 * @param {object} params - { owner, repo, comment_id }
 * @param {object} context - { userId }
 */
async function github_deleteIssueComment(params, context) {
  const { owner, repo, comment_id } = params || {};
  if (!owner || !repo || !comment_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and comment_id are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'DELETE',
      url: `/repos/${owner}/${repo}/issues/comments/${comment_id}`,
    })
  );
}

/**
 * Delete a pull request review comment.
 * @param {object} params - { owner, repo, comment_id }
 * @param {object} context - { userId }
 */
async function github_deletePRComment(params, context) {
  const { owner, repo, comment_id } = params || {};
  if (!owner || !repo || !comment_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and comment_id are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'DELETE',
      url: `/repos/${owner}/${repo}/pulls/comments/${comment_id}`,
    })
  );
}

module.exports = {
  github_deleteIssueComment,
  github_deletePRComment,
};
