/**
 * Issue tools. Thin wrappers over GitHub REST API.
 * @module github-tools/issues
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * List issues (user's issues: assigned, created, etc.).
 * @param {object} params - { filter?, state?, labels?, sort?, direction?, since?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listIssues(params, context) {
  const { filter, state, labels, sort, direction, since, per_page, page } = params || {};
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: '/user/issues',
      params: { filter, state, labels, sort, direction, since, per_page, page },
    })
  );
}

/**
 * Get a single issue (repo-scoped).
 * @param {object} params - { owner, repo, issue_number }
 * @param {object} context - { userId }
 */
async function github_getIssueDetails(params, context) {
  const { owner, repo, issue_number } = params || {};
  if (!owner || !repo || issue_number == null) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and issue_number are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/issues/${issue_number}`,
    })
  );
}

/**
 * Create an issue.
 * @param {object} params - { owner, repo, title, body?, assignees?, labels?, milestone? }
 * @param {object} context - { userId }
 */
async function github_createIssue(params, context) {
  const { owner, repo, title, body, assignees, labels, milestone } = params || {};
  if (!owner || !repo || !title) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and title are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/issues`,
      data: { title, body: body || undefined, assignees: assignees || undefined, labels: labels || undefined, milestone: milestone },
    })
  );
}

/**
 * Update an issue.
 * @param {object} params - { owner, repo, issue_number, title?, body?, state?, assignees?, labels?, milestone? }
 * @param {object} context - { userId }
 */
async function github_updateIssue(params, context) {
  const { owner, repo, issue_number, title, body, state, assignees, labels, milestone } = params || {};
  if (!owner || !repo || issue_number == null) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and issue_number are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PATCH',
      url: `/repos/${owner}/${repo}/issues/${issue_number}`,
      data: { title, body, state, assignees, labels, milestone },
    })
  );
}

/**
 * Close an issue.
 * @param {object} params - { owner, repo, issue_number }
 * @param {object} context - { userId }
 */
async function github_closeIssue(params, context) {
  return github_updateIssue({ ...params, state: 'closed' }, context);
}

/**
 * Add a comment to an issue.
 * @param {object} params - { owner, repo, issue_number, body }
 * @param {object} context - { userId }
 */
async function github_addIssueComment(params, context) {
  const { owner, repo, issue_number, body } = params || {};
  if (!owner || !repo || issue_number == null || !body) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, issue_number, and body are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/issues/${issue_number}/comments`,
      data: { body },
    })
  );
}

/**
 * Add labels to an issue.
 * @param {object} params - { owner, repo, issue_number, labels[] }
 * @param {object} context - { userId }
 */
async function github_addLabelsToIssue(params, context) {
  const { owner, repo, issue_number, labels } = params || {};
  if (!owner || !repo || issue_number == null || !Array.isArray(labels)) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, issue_number, and labels (array) are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/issues/${issue_number}/labels`,
      data: labels,
    })
  );
}

/**
 * List issues for an organization (repos owned by org).
 * @param {object} params - { org, filter?, state?, labels?, sort?, direction?, since?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listOrgIssues(params, context) {
  const { org, filter, state, labels, sort, direction, since, per_page, page } = params || {};
  if (!org) return { success: false, data: null, error: { code: 'VALIDATION', message: 'org is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/orgs/${org}/issues`,
      params: { filter, state, labels, sort, direction, since, per_page, page },
    })
  );
}

/**
 * List issues by assignee (repo-scoped).
 * @param {object} params - { owner, repo, assignee, creator?, mentioned?, state?, labels?, sort?, direction?, since?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listIssuesByAssignee(params, context) {
  const { owner, repo, assignee, creator, mentioned, state, labels, sort, direction, since, per_page, page } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/issues`,
      params: { assignee, creator, mentioned, state, labels, sort, direction, since, per_page, page },
    })
  );
}

module.exports = {
  github_listIssues,
  github_getIssueDetails,
  github_createIssue,
  github_updateIssue,
  github_closeIssue,
  github_addIssueComment,
  github_addLabelsToIssue,
  github_listOrgIssues,
  github_listIssuesByAssignee,
};
