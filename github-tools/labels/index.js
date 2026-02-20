/**
 * Label tools. Thin wrappers over GitHub REST API.
 * @module github-tools/labels
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * List labels for a repository.
 * @param {object} params - { owner, repo, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listLabels(params, context) {
  const { owner, repo, per_page, page } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/labels`,
      params: { per_page, page },
    })
  );
}

/**
 * Create a label.
 * @param {object} params - { owner, repo, name, color?, description? }
 * @param {object} context - { userId }
 */
async function github_createLabel(params, context) {
  const { owner, repo, name, color, description } = params || {};
  if (!owner || !repo || !name) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and name are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/labels`,
      data: { name, color: color || 'ededed', description: description || undefined },
    })
  );
}

/**
 * Update a label.
 * @param {object} params - { owner, repo, name (current), new_name?, color?, description? }
 * @param {object} context - { userId }
 */
async function github_updateLabel(params, context) {
  const { owner, repo, name, new_name, color, description } = params || {};
  if (!owner || !repo || !name) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and name are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PATCH',
      url: `/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`,
      data: { new_name: new_name || name, color: color, description: description },
    })
  );
}

/**
 * Delete a label.
 * @param {object} params - { owner, repo, name }
 * @param {object} context - { userId }
 */
async function github_deleteLabel(params, context) {
  const { owner, repo, name } = params || {};
  if (!owner || !repo || !name) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and name are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'DELETE',
      url: `/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`,
    })
  );
}

module.exports = {
  github_listLabels,
  github_createLabel,
  github_updateLabel,
  github_deleteLabel,
};
