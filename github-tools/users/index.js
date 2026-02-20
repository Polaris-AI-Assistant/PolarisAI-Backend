/**
 * User profile tool. Thin wrapper over GitHub REST API.
 * @module github-tools/users
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * Get user profile (authenticated user if no username; otherwise that user's public profile).
 * @param {object} params - { username? } If omitted, returns authenticated user.
 * @param {object} context - { userId }
 */
async function github_getUserProfile(params, context) {
  const { username } = params || {};
  const path = username ? `/users/${encodeURIComponent(username)}` : '/user';
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: path,
    })
  );
}

module.exports = {
  github_getUserProfile,
};
