/**
 * File and content tools. Thin wrappers over GitHub REST API.
 * @module github-tools/files
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * List contents of a repository path (root if path empty).
 * @param {object} params - { owner, repo, path?, ref? }
 * @param {object} context - { userId }
 */
async function github_listRepoContents(params, context) {
  const { owner, repo, path = '', ref } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  const pathPart = path ? `/${encodeURIComponent(path)}` : '';
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/contents${pathPart}`,
      params: ref ? { ref } : {},
    })
  );
}

/**
 * Get raw file content (or decoded content for small files).
 * @param {object} params - { owner, repo, path, ref? }
 * @param {object} context - { userId }
 */
async function github_getFileContent(params, context) {
  const { owner, repo, path, ref } = params || {};
  if (!owner || !repo || !path) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and path are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      params: ref ? { ref } : {},
    })
  );
}

/**
 * Create a new file in the repository.
 * @param {object} params - { owner, repo, path, message, content (base64), branch?, sha? }
 * @param {object} context - { userId }
 */
async function github_createFile(params, context) {
  const { owner, repo, path, message, content, branch, sha } = params || {};
  if (!owner || !repo || !path || !message || content === undefined) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, path, message, and content are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PUT',
      url: `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      data: { message, content: typeof content === 'string' ? Buffer.from(content, 'utf8').toString('base64') : content, branch: branch || undefined, sha: sha || undefined },
    })
  );
}

/**
 * Update a file (overwrite whole file).
 * @param {object} params - { owner, repo, path, message, content (base64), sha, branch? }
 * @param {object} context - { userId }
 */
async function github_updateWholeFile(params, context) {
  const { owner, repo, path, message, content, sha, branch } = params || {};
  if (!owner || !repo || !path || !message || content === undefined || !sha) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, path, message, content, and sha are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PUT',
      url: `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      data: { message, content: typeof content === 'string' ? Buffer.from(content, 'utf8').toString('base64') : content, sha, branch: branch || undefined },
    })
  );
}

/**
 * Delete a file.
 * @param {object} params - { owner, repo, path, message, sha, branch? }
 * @param {object} context - { userId }
 */
async function github_deleteFile(params, context) {
  const { owner, repo, path, message, sha, branch } = params || {};
  if (!owner || !repo || !path || !message || !sha) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, path, message, and sha are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'DELETE',
      url: `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      data: { message, sha, branch: branch || undefined },
    })
  );
}

/**
 * Search code in a repository.
 * @param {object} params - { owner, repo, q (search query), sort?, order?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_searchRepoCode(params, context) {
  const { owner, repo, q, sort, order, per_page, page } = params || {};
  if (!owner || !repo || !q) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and q are required' } };
  const searchQ = `repo:${owner}/${repo} ${q}`;
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: '/search/code',
      params: { q: searchQ, sort, order, per_page, page },
    })
  );
}

/**
 * Get repository file tree (recursive or not).
 * GitHub allows `tree_sha` to be a SHA or a ref (branch/tag name).
 * @param {object} params - { owner, repo, tree_sha?, ref?, recursive? }
 * @param {object} context - { userId }
 */
async function github_getRepoFileTree(params, context) {
  const { owner, repo, tree_sha, ref, recursive } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  const treeRef = tree_sha || ref || 'main';
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(treeRef)}`,
      params: recursive ? { recursive: '1' } : {},
    })
  );
}

module.exports = {
  github_listRepoContents,
  github_getFileContent,
  github_createFile,
  github_updateWholeFile,
  github_deleteFile,
  github_searchRepoCode,
  github_getRepoFileTree,
};
