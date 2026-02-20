/**
 * Gist tools. Thin wrappers over GitHub REST API.
 * @module github-tools/gists
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * Create a gist.
 * @param {object} params - { files (object: filename -> { content }), description?, public? }
 * @param {object} context - { userId }
 */
async function github_createGist(params, context) {
  const { files, description, public: isPublic } = params || {};
  if (!files || typeof files !== 'object') return { success: false, data: null, error: { code: 'VALIDATION', message: 'files (object) is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: '/gists',
      data: { files, description: description || undefined, public: isPublic },
    })
  );
}

/**
 * List gists for the authenticated user.
 * @param {object} params - { since?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listGists(params, context) {
  const { since, per_page, page } = params || {};
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: '/gists',
      params: { since, per_page, page },
    })
  );
}

/**
 * Get a single gist.
 * @param {object} params - { gist_id }
 * @param {object} context - { userId }
 */
async function github_getGist(params, context) {
  const { gist_id } = params || {};
  if (!gist_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'gist_id is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/gists/${gist_id}`,
    })
  );
}

/**
 * Update a gist.
 * @param {object} params - { gist_id, description?, files? }
 * @param {object} context - { userId }
 */
async function github_updateGist(params, context) {
  const { gist_id, description, files } = params || {};
  if (!gist_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'gist_id is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PATCH',
      url: `/gists/${gist_id}`,
      data: { description, files },
    })
  );
}

/**
 * Delete a gist.
 * @param {object} params - { gist_id }
 * @param {object} context - { userId }
 */
async function github_deleteGist(params, context) {
  const { gist_id } = params || {};
  if (!gist_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'gist_id is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'DELETE',
      url: `/gists/${gist_id}`,
    })
  );
}

/**
 * List public gists (all or by user).
 * @param {object} params - { since?, per_page?, page? } or { username } for a user's public gists
 * @param {object} context - { userId }
 */
async function github_listPublicGists(params, context) {
  const { since, per_page, page } = params || {};
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: '/gists/public',
      params: { since, per_page, page },
    })
  );
}

/**
 * List gists for a given user (public).
 * @param {object} params - { username, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listUserGists(params, context) {
  const { username, per_page, page } = params || {};
  if (!username) return { success: false, data: null, error: { code: 'VALIDATION', message: 'username is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/users/${username}/gists`,
      params: { per_page, page },
    })
  );
}

module.exports = {
  github_createGist,
  github_listGists,
  github_getGist,
  github_updateGist,
  github_deleteGist,
  github_listPublicGists,
  github_listUserGists,
};
