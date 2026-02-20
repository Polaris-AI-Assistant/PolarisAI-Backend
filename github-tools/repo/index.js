/**
 * Repository management tools. Thin wrappers over GitHub REST API.
 * @module github-tools/repo
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * Create a repository for the authenticated user.
 * @param {object} params - { name, description?, private?, auto_init?, gitignore_template?, license_template? }
 * @param {object} context - { userId }
 * @returns {Promise<{ success: boolean, data: object|null, error: object|null }>}
 */
async function github_createRepo(params, context) {
  const { name, description, private: isPrivate, auto_init, gitignore_template, license_template } = params || {};
  if (!name) return { success: false, data: null, error: { code: 'VALIDATION', message: 'name is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: '/user/repos',
      data: {
        name,
        description: description || undefined,
        private: isPrivate,
        auto_init: auto_init,
        gitignore_template: gitignore_template || undefined,
        license_template: license_template || undefined,
      },
    })
  );
}

/**
 * List repositories for the authenticated user.
 * @param {object} params - { page?, per_page?, sort?, type? (all|owner|public|private|member), direction? }
 * @param {object} context - { userId }
 */
async function github_listRepos(params, context) {
  const { page, per_page, sort, type, direction } = params || {};
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: '/user/repos',
      params: { page, per_page, sort, type, direction },
    })
  );
}

/**
 * Get a single repository by owner and repo name.
 * @param {object} params - { owner, repo }
 * @param {object} context - { userId }
 */
async function github_getRepoInfo(params, context) {
  const { owner, repo } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, { method: 'GET', url: `/repos/${owner}/${repo}` })
  );
}

/**
 * Create a repository under an organization.
 * @param {object} params - { org, name, description?, private?, auto_init?, gitignore_template?, license_template? }
 * @param {object} context - { userId }
 */
async function github_createOrgRepo(params, context) {
  const { org, name, description, private: isPrivate, auto_init, gitignore_template, license_template } = params || {};
  if (!org || !name) return { success: false, data: null, error: { code: 'VALIDATION', message: 'org and name are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/orgs/${org}/repos`,
      data: {
        name,
        description: description || undefined,
        private: isPrivate,
        auto_init: auto_init,
        gitignore_template: gitignore_template || undefined,
        license_template: license_template || undefined,
      },
    })
  );
}

/**
 * Set repository visibility (public/private).
 * @param {object} params - { owner, repo, private: boolean }
 * @param {object} context - { userId }
 */
async function github_setRepoVisibility(params, context) {
  const { owner, repo, private: isPrivate } = params || {};
  if (!owner || !repo || typeof isPrivate !== 'boolean') return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and private (boolean) are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PATCH',
      url: `/repos/${owner}/${repo}`,
      data: { private: isPrivate },
    })
  );
}

/**
 * Update repository settings (description, homepage, etc.).
 * @param {object} params - { owner, repo, description?, homepage?, has_issues?, has_projects?, has_wiki?, default_branch? }
 * @param {object} context - { userId }
 */
async function github_updateRepoSettings(params, context) {
  const { owner, repo, description, homepage, has_issues, has_projects, has_wiki, default_branch } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PATCH',
      url: `/repos/${owner}/${repo}`,
      data: {
        description: description !== undefined ? description : undefined,
        homepage: homepage !== undefined ? homepage : undefined,
        has_issues: has_issues,
        has_projects: has_projects,
        has_wiki: has_wiki,
        default_branch: default_branch || undefined,
      },
    })
  );
}

/**
 * Archive a repository.
 * @param {object} params - { owner, repo }
 * @param {object} context - { userId }
 */
async function github_archiveRepo(params, context) {
  const { owner, repo } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PATCH',
      url: `/repos/${owner}/${repo}`,
      data: { archived: true },
    })
  );
}

/**
 * Transfer a repository to another user or org.
 * @param {object} params - { owner, repo, new_owner, team_ids?[] }
 * @param {object} context - { userId }
 */
async function github_transferRepo(params, context) {
  const { owner, repo, new_owner, team_ids } = params || {};
  if (!owner || !repo || !new_owner) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and new_owner are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/transfer`,
      data: { new_owner, team_ids: team_ids || undefined },
    })
  );
}

/**
 * Fork a repository.
 * @param {object} params - { owner, repo, organization?, name? }
 * @param {object} context - { userId }
 */
async function github_forkRepo(params, context) {
  const { owner, repo, organization, name } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/forks`,
      data: { organization: organization || undefined, name: name || undefined },
    })
  );
}

module.exports = {
  github_createRepo,
  github_listRepos,
  github_getRepoInfo,
  github_createOrgRepo,
  github_setRepoVisibility,
  github_updateRepoSettings,
  github_archiveRepo,
  github_transferRepo,
  github_forkRepo,
};
