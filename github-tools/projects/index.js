/**
 * Project tools (Classic + V2). Thin wrappers over GitHub REST/GraphQL where applicable.
 * Classic: REST API. V2: GraphQL (projects v2). We use REST for classic only; V2 may require GraphQL.
 * @module github-tools/projects
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/** Accept header for projects API */
const PROJECTS_ACCEPT = 'application/vnd.github.inertia-preview+json';

/**
 * List repository projects (Classic).
 * @param {object} params - { owner, repo, state?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listRepoProjects(params, context) {
  const { owner, repo, state, per_page, page } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/projects`,
      params: { state, per_page, page },
      headers: { Accept: PROJECTS_ACCEPT },
    })
  );
}

/**
 * List organization projects (Classic).
 * @param {object} params - { org, state?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listOrgProjects(params, context) {
  const { org, state, per_page, page } = params || {};
  if (!org) return { success: false, data: null, error: { code: 'VALIDATION', message: 'org is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/orgs/${org}/projects`,
      params: { state, per_page, page },
      headers: { Accept: PROJECTS_ACCEPT },
    })
  );
}

/**
 * Get a single project (Classic).
 * @param {object} params - { project_id }
 * @param {object} context - { userId }
 */
async function github_getProject(params, context) {
  const { project_id } = params || {};
  if (!project_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'project_id is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/projects/${project_id}`,
      headers: { Accept: PROJECTS_ACCEPT },
    })
  );
}

/**
 * Create a repository project (Classic).
 * @param {object} params - { owner, repo, name, body? }
 * @param {object} context - { userId }
 */
async function github_createRepoProject(params, context) {
  const { owner, repo, name, body } = params || {};
  if (!owner || !repo || !name) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and name are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/projects`,
      data: { name, body: body || undefined },
      headers: { Accept: PROJECTS_ACCEPT },
    })
  );
}

/**
 * Create an organization project (Classic).
 * @param {object} params - { org, name, body? }
 * @param {object} context - { userId }
 */
async function github_createOrgProject(params, context) {
  const { org, name, body } = params || {};
  if (!org || !name) return { success: false, data: null, error: { code: 'VALIDATION', message: 'org and name are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/orgs/${org}/projects`,
      data: { name, body: body || undefined },
      headers: { Accept: PROJECTS_ACCEPT },
    })
  );
}

/**
 * Update a project (Classic).
 * @param {object} params - { project_id, name?, body?, state? }
 * @param {object} context - { userId }
 */
async function github_updateProject(params, context) {
  const { project_id, name, body, state } = params || {};
  if (!project_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'project_id is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PATCH',
      url: `/projects/${project_id}`,
      data: { name, body, state },
      headers: { Accept: PROJECTS_ACCEPT },
    })
  );
}

/**
 * Delete a project (Classic).
 * @param {object} params - { project_id }
 * @param {object} context - { userId }
 */
async function github_deleteProject(params, context) {
  const { project_id } = params || {};
  if (!project_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'project_id is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'DELETE',
      url: `/projects/${project_id}`,
      headers: { Accept: PROJECTS_ACCEPT },
    })
  );
}

/**
 * List project columns (Classic).
 * @param {object} params - { project_id, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listProjectColumns(params, context) {
  const { project_id, per_page, page } = params || {};
  if (!project_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'project_id is required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/projects/${project_id}/columns`,
      params: { per_page, page },
      headers: { Accept: PROJECTS_ACCEPT },
    })
  );
}

/**
 * Add a project card (Classic).
 * @param {object} params - { column_id, content_id?, content_type?, note? }
 * @param {object} context - { userId }
 */
async function github_addProjectCard(params, context) {
  const { column_id, content_id, content_type, note } = params || {};
  if (!column_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'column_id is required' } };
  if (!content_id && !content_type && !note) return { success: false, data: null, error: { code: 'VALIDATION', message: 'Either content_id+content_type or note is required' } };
  const data = content_id && content_type ? { content_id, content_type } : { note: note || '' };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/projects/columns/${column_id}/cards`,
      data,
      headers: { Accept: PROJECTS_ACCEPT },
    })
  );
}

module.exports = {
  github_listRepoProjects,
  github_listOrgProjects,
  github_getProject,
  github_createRepoProject,
  github_createOrgProject,
  github_updateProject,
  github_deleteProject,
  github_listProjectColumns,
  github_addProjectCard,
};
