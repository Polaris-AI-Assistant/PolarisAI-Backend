/**
 * Pull request tools. Thin wrappers over GitHub REST API.
 * @module github-tools/pulls
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * List pull requests.
 * @param {object} params - { owner, repo, state?, sort?, direction?, head?, base?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listPullRequests(params, context) {
  const { owner, repo, state, sort, direction, head, base, per_page, page } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/pulls`,
      params: { state, sort, direction, head, base, per_page, page },
    })
  );
}

/**
 * Create a pull request.
 * @param {object} params - { owner, repo, title, head, base, body?, draft?, maintainer_can_modify? }
 * @param {object} context - { userId }
 */
async function github_createPullRequest(params, context) {
  const { owner, repo, title, head, base, body, draft, maintainer_can_modify } = params || {};
  if (!owner || !repo || !title || !head || !base) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, title, head, and base are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/pulls`,
      data: { title, head, base, body: body || undefined, draft: draft, maintainer_can_modify: maintainer_can_modify },
    })
  );
}

/**
 * Get a single pull request.
 * @param {object} params - { owner, repo, pull_number }
 * @param {object} context - { userId }
 */
async function github_getPullRequestInfo(params, context) {
  const { owner, repo, pull_number } = params || {};
  if (!owner || !repo || pull_number == null) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and pull_number are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/pulls/${pull_number}`,
    })
  );
}

/**
 * Update a pull request.
 * @param {object} params - { owner, repo, pull_number, title?, body?, state?, base? }
 * @param {object} context - { userId }
 */
async function github_updatePullRequest(params, context) {
  const { owner, repo, pull_number, title, body, state, base } = params || {};
  if (!owner || !repo || pull_number == null) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and pull_number are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PATCH',
      url: `/repos/${owner}/${repo}/pulls/${pull_number}`,
      data: { title, body, state, base },
    })
  );
}

/**
 * Merge a pull request.
 * @param {object} params - { owner, repo, pull_number, commit_title?, commit_message?, sha?, merge_method? }
 * @param {object} context - { userId }
 */
async function github_mergePullRequest(params, context) {
  const { owner, repo, pull_number, commit_title, commit_message, sha, merge_method } = params || {};
  if (!owner || !repo || pull_number == null) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and pull_number are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PUT',
      url: `/repos/${owner}/${repo}/pulls/${pull_number}/merge`,
      data: { commit_title: commit_title, commit_message: commit_message, sha: sha, merge_method: merge_method },
    })
  );
}

/**
 * Close a pull request (update state to closed).
 * @param {object} params - { owner, repo, pull_number }
 * @param {object} context - { userId }
 */
async function github_closePR(params, context) {
  return github_updatePullRequest({ ...params, state: 'closed' }, context);
}

/**
 * Check mergeability of a PR.
 * @param {object} params - { owner, repo, pull_number }
 * @param {object} context - { userId }
 */
async function github_checkPullRequestMergeability(params, context) {
  const res = await github_getPullRequestInfo(params, context);
  if (!res.success) return res;
  return { success: true, data: { mergeable: res.data.mergeable, mergeable_state: res.data.mergeable_state }, error: null };
}

/**
 * Get files changed in a PR.
 * @param {object} params - { owner, repo, pull_number, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_getPullRequestFiles(params, context) {
  const { owner, repo, pull_number, per_page, page } = params || {};
  if (!owner || !repo || pull_number == null) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and pull_number are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/pulls/${pull_number}/files`,
      params: { per_page, page },
    })
  );
}

/**
 * Get summary of files in a PR (same as files but name indicates summary usage).
 * @param {object} params - { owner, repo, pull_number, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_getPullRequestFilesSummary(params, context) {
  return github_getPullRequestFiles(params, context);
}

/**
 * List comments on a PR.
 * @param {object} params - { owner, repo, pull_number, per_page?, page?, since? }
 * @param {object} context - { userId }
 */
async function github_listPRComments(params, context) {
  const { owner, repo, pull_number, per_page, page, since } = params || {};
  if (!owner || !repo || pull_number == null) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and pull_number are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/pulls/${pull_number}/comments`,
      params: { per_page, page, since },
    })
  );
}

/**
 * Add reviewers to a PR.
 * @param {object} params - { owner, repo, pull_number, reviewers[] }
 * @param {object} context - { userId }
 */
async function github_addPRReviewers(params, context) {
  const { owner, repo, pull_number, reviewers } = params || {};
  if (!owner || !repo || pull_number == null || !Array.isArray(reviewers)) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, pull_number, and reviewers (array) are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/pulls/${pull_number}/requested_reviewers`,
      data: { reviewers },
    })
  );
}

/**
 * Submit an APPROVE review on a PR.
 * @param {object} params - { owner, repo, pull_number, body?, commit_id? }
 * @param {object} context - { userId }
 */
async function github_approvePR(params, context) {
  const { owner, repo, pull_number, body, commit_id } = params || {};
  if (!owner || !repo || pull_number == null) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and pull_number are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/pulls/${pull_number}/reviews`,
      data: { event: 'APPROVE', body: body || '', commit_id: commit_id },
    })
  );
}

/**
 * Submit a REQUEST_CHANGES review on a PR.
 * @param {object} params - { owner, repo, pull_number, body, commit_id? }
 * @param {object} context - { userId }
 */
async function github_requestChangesOnPR(params, context) {
  const { owner, repo, pull_number, body, commit_id } = params || {};
  if (!owner || !repo || pull_number == null || !body) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, pull_number, and body are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/pulls/${pull_number}/reviews`,
      data: { event: 'REQUEST_CHANGES', body, commit_id: commit_id },
    })
  );
}

/**
 * Add a comment to a PR.
 * @param {object} params - { owner, repo, pull_number, body }
 * @param {object} context - { userId }
 */
async function github_commentOnPR(params, context) {
  const { owner, repo, pull_number, body } = params || {};
  if (!owner || !repo || pull_number == null || !body) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, pull_number, and body are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/issues/${pull_number}/comments`,
      data: { body },
    })
  );
}

module.exports = {
  github_listPullRequests,
  github_createPullRequest,
  github_getPullRequestInfo,
  github_updatePullRequest,
  github_mergePullRequest,
  github_closePR,
  github_checkPullRequestMergeability,
  github_getPullRequestFiles,
  github_getPullRequestFilesSummary,
  github_listPRComments,
  github_addPRReviewers,
  github_approvePR,
  github_requestChangesOnPR,
  github_commentOnPR,
};
