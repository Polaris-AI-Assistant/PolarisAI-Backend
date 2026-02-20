/**
 * Commit tools. Thin wrappers over GitHub REST API.
 * @module github-tools/commits
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * List commits.
 * @param {object} params - { owner, repo, sha?, path?, author?, since?, until?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listCommits(params, context) {
  const { owner, repo, sha, path, author, since, until, per_page, page } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/commits`,
      params: { sha, path, author, since, until, per_page, page },
    })
  );
}

/**
 * Get a single commit.
 * @param {object} params - { owner, repo, ref }
 * @param {object} context - { userId }
 */
async function github_getCommit(params, context) {
  const { owner, repo, ref } = params || {};
  if (!owner || !repo || !ref) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and ref are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/commits/${ref}`,
    })
  );
}

/**
 * Get comments for a commit.
 * @param {object} params - { owner, repo, ref, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_getCommitComments(params, context) {
  const { owner, repo, ref, per_page, page } = params || {};
  if (!owner || !repo || !ref) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and ref are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/commits/${ref}/comments`,
      params: { per_page, page },
    })
  );
}

/**
 * Create a comment on a commit.
 * @param {object} params - { owner, repo, ref, body, path?, position?, line? }
 * @param {object} context - { userId }
 */
async function github_createCommitComment(params, context) {
  const { owner, repo, ref, body, path, position, line } = params || {};
  if (!owner || !repo || !ref || !body) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, ref, and body are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/commits/${ref}/comments`,
      data: { body, path: path || undefined, position: position, line: line },
    })
  );
}

/**
 * Get combined status for a commit.
 * @param {object} params - { owner, repo, ref }
 * @param {object} context - { userId }
 */
async function github_getCommitStatuses(params, context) {
  const { owner, repo, ref } = params || {};
  if (!owner || !repo || !ref) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and ref are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/commits/${ref}/status`,
    })
  );
}

/**
 * Get check runs for a commit.
 * @param {object} params - { owner, repo, ref, per_page?, page?, filter? }
 * @param {object} context - { userId }
 */
async function github_getCommitCheckRuns(params, context) {
  const { owner, repo, ref, per_page, page, filter } = params || {};
  if (!owner || !repo || !ref) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and ref are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/commits/${ref}/check-runs`,
      params: { per_page, page, filter },
    })
  );
}

/**
 * Get signature verification for a commit.
 * @param {object} params - { owner, repo, ref }
 * @param {object} context - { userId }
 */
async function github_getCommitSignatureVerification(params, context) {
  const res = await github_getCommit(params, context);
  if (!res.success) return res;
  return { success: true, data: res.data.commit ? { verification: res.data.commit.verification } : res.data.verification, error: null };
}

/**
 * Create a commit (e.g. for reverts). GitHub has no single "revert" REST call; caller provides tree_sha and parents.
 * @param {object} params - { owner, repo, message, tree_sha, parents (array of commit SHAs) }
 * @param {object} context - { userId }
 */
async function github_revertCommit(params, context) {
  const { owner, repo, message, tree_sha, parents } = params || {};
  if (!owner || !repo || !message || !tree_sha || !Array.isArray(parents) || parents.length === 0) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, message, tree_sha, and parents (array) are required for creating a revert commit' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/git/commits`,
      data: { message, tree: tree_sha, parents },
    })
  );
}

/**
 * Delete a commit comment.
 * @param {object} params - { owner, repo, comment_id }
 * @param {object} context - { userId }
 */
async function github_deleteCommitComment(params, context) {
  const { owner, repo, comment_id } = params || {};
  if (!owner || !repo || !comment_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and comment_id are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'DELETE',
      url: `/repos/${owner}/${repo}/comments/${comment_id}`,
    })
  );
}

module.exports = {
  github_listCommits,
  github_getCommit,
  github_getCommitComments,
  github_createCommitComment,
  github_getCommitStatuses,
  github_getCommitCheckRuns,
  github_getCommitSignatureVerification,
  github_revertCommit,
  github_deleteCommitComment,
};
