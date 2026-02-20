/**
 * Organization tools. Thin wrappers over GitHub REST API.
 * @module github-tools/orgs
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * List organizations for the authenticated user.
 * @param {object} params - { per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listUserOrgs(params, context) {
  const { per_page, page } = params || {};
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: '/user/orgs',
      params: { per_page, page },
    })
  );
}

/**
 * List organization members.
 * @param {object} params - { org, filter?, role?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listOrgMembers(params, context) {
  const { org, filter, role, per_page, page } = params || {};
  if (!org) return { success: false, data: null, error: { code: 'VALIDATION', message: 'org is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/orgs/${org}/members`,
      params: { filter, role, per_page, page },
    })
  );
}

/**
 * List outside collaborators of an org.
 * @param {object} params - { org, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listOrgOutsideCollaborators(params, context) {
  const { org, per_page, page } = params || {};
  if (!org) return { success: false, data: null, error: { code: 'VALIDATION', message: 'org is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/orgs/${org}/outside_collaborators`,
      params: { per_page, page },
    })
  );
}

/**
 * List pending organization invitations.
 * @param {object} params - { org, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listPendingOrgInvitations(params, context) {
  const { org, per_page, page } = params || {};
  if (!org) return { success: false, data: null, error: { code: 'VALIDATION', message: 'org is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/orgs/${org}/invitations`,
      params: { per_page, page },
    })
  );
}

/**
 * Get organization billing info (e.g. Advanced Security; requires org admin).
 * @param {object} params - { org }
 * @param {object} context - { userId }
 */
async function github_getOrgBillingInfo(params, context) {
  const { org } = params || {};
  if (!org) return { success: false, data: null, error: { code: 'VALIDATION', message: 'org is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/orgs/${org}/settings/billing/advanced-security`,
    })
  );
}

/**
 * List PRs by assignee (search or repo pulls filtered by assignee).
 * @param {object} params - { owner, repo, assignee?, state?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listPrsByAssignee(params, context) {
  const { owner, repo, assignee, state, per_page, page } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/pulls`,
      params: { state, assignee, per_page, page },
    })
  );
}

module.exports = {
  github_listUserOrgs,
  github_listOrgMembers,
  github_listOrgOutsideCollaborators,
  github_listPendingOrgInvitations,
  github_getOrgBillingInfo,
  github_listPrsByAssignee,
};
