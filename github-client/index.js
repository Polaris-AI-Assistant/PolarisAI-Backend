/**
 * GitHub client layer: auth, HTTP client, error handling.
 * @module github-client
 */

const githubAuthService = require('./githubAuthService');
const githubHttpClient = require('./githubHttpClient');
const githubErrorHandler = require('./githubErrorHandler');

module.exports = {
  githubAuthService,
  githubHttpClient,
  githubErrorHandler,
};
