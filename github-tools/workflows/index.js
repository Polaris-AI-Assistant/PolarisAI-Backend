/**
 * GitHub Actions workflow tools. Thin wrappers over GitHub REST API.
 * @module github-tools/workflows
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * Trigger a workflow dispatch event.
 * @param {object} params - { owner, repo, workflow_id, ref?, inputs? }
 * @param {object} context - { userId }
 */
async function github_triggerWorkflow(params, context) {
  const { owner, repo, workflow_id, ref, inputs } = params || {};
  if (!owner || !repo || !workflow_id) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and workflow_id are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`,
      data: { ref: ref || 'main', inputs: inputs || {} },
    })
  );
}

/**
 * Get workflow status (list workflows for repo; or a single workflow).
 * @param {object} params - { owner, repo, workflow_id? }
 * @param {object} context - { userId }
 */
async function github_getWorkflowStatus(params, context) {
  const { owner, repo, workflow_id } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  const path = workflow_id ? `/repos/${owner}/${repo}/actions/workflows/${workflow_id}` : `/repos/${owner}/${repo}/actions/workflows`;
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: path,
    })
  );
}

/**
 * List workflow runs.
 * @param {object} params - { owner, repo, workflow_id?, branch?, status?, per_page?, page? }
 * @param {object} context - { userId }
 */
async function github_listWorkflowRuns(params, context) {
  const { owner, repo, workflow_id, branch, status, per_page, page } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  const path = workflow_id
    ? `/repos/${owner}/${repo}/actions/workflows/${workflow_id}/runs`
    : `/repos/${owner}/${repo}/actions/runs`;
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: path,
      params: { branch, status, per_page, page },
    })
  );
}

module.exports = {
  github_triggerWorkflow,
  github_getWorkflowStatus,
  github_listWorkflowRuns,
};
