/**
 * Collaborators and permissions. Thin wrappers over GitHub REST API.
 * @module github-tools/collaborators
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * List repository collaborators.
 * @param {object} params - { owner, repo, affiliation?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listRepoCollaborators(params, context) {
  const { owner, repo, affiliation, per_page, page } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/collaborators`,
      params: { affiliation, per_page, page },
    })
  );
}

/**
 * Add a collaborator to a repo.
 * @param {object} params - { owner, repo, username, permission? }
 * @param {object} context - { userId }
 */
async function github_addCollaborator(params, context) {
  const { owner, repo, username, permission } = params || {};
  if (!owner || !repo || !username) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and username are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PUT',
      url: `/repos/${owner}/${repo}/collaborators/${username}`,
      data: permission ? { permission } : undefined,
    })
  );
}

/**
 * Remove a collaborator.
 * @param {object} params - { owner, repo, username }
 * @param {object} context - { userId }
 */
async function github_removeCollaborator(params, context) {
  const { owner, repo, username } = params || {};
  if (!owner || !repo || !username) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and username are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'DELETE',
      url: `/repos/${owner}/${repo}/collaborators/${username}`,
    })
  );
}

/**
 * List pending repository invitations.
 * @param {object} params - { owner, repo, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listPendingInvitations(params, context) {
  const { owner, repo, per_page, page } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/invitations`,
      params: { per_page, page },
    })
  );
}

/**
 * List repository invitations for the authenticated user.
 * @param {object} params - { per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listUserRepositoryInvitations(params, context) {
  const { per_page, page } = params || {};
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: '/user/repository_invitations',
      params: { per_page, page },
    })
  );
}

/**
 * Accept a repository invitation.
 * @param {object} params - { invitation_id }
 * @param {object} context - { userId }
 */
async function github_acceptRepositoryInvitation(params, context) {
  const { invitation_id } = params || {};
  if (!invitation_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'invitation_id is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PATCH',
      url: `/user/repository_invitations/${invitation_id}`,
    })
  );
}

/**
 * Decline a repository invitation.
 * @param {object} params - { invitation_id }
 * @param {object} context - { userId }
 */
async function github_declineRepositoryInvitation(params, context) {
  const { invitation_id } = params || {};
  if (!invitation_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'invitation_id is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'DELETE',
      url: `/user/repository_invitations/${invitation_id}`,
    })
  );
}

module.exports = {
  github_listRepoCollaborators,
  github_addCollaborator,
  github_removeCollaborator,
  github_listPendingInvitations,
  github_listUserRepositoryInvitations,
  github_acceptRepositoryInvitation,
  github_declineRepositoryInvitation,
};
