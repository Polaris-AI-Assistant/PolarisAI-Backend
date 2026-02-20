/**
 * Preconfigured HTTP client for GitHub REST API.
 * No auth in constructor; caller passes token per request.
 * @module github-client/githubHttpClient
 */

const axios = require('axios');

const GITHUB_API_BASE = 'https://api.github.com';
const ACCEPT = 'application/vnd.github.v3+json';

/**
 * Build request config with auth and common headers.
 * @param {string} token - Bearer token from githubAuthService.getToken(userId).
 * @param {object} options - Axios request config (method, url, params, data, etc.).
 * @returns {object} Axios request config.
 */
function request(token, options) {
  const { method = 'GET', url, params, data, headers = {}, ...rest } = options;
  const fullUrl = url.startsWith('http') ? url : `${GITHUB_API_BASE}${url}`;
  return axios({
    method,
    url: fullUrl,
    params,
    data,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: ACCEPT,
      'Content-Type': 'application/json',
      ...headers,
    },
    ...rest,
  });
}

module.exports = {
  request,
  GITHUB_API_BASE,
  ACCEPT,
};
