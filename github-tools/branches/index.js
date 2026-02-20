/**
 * Branch tools. Thin wrappers over GitHub REST API.
 * @module github-tools/branches
 */

const { githubHttpClient } = require('../../github-client');
const { withToken } = require('../utils');

/**
 * List branches.
 * @param {object} params - { owner, repo, per_page?, page?, protected? }
 * @param {object} context - { userId }
 */
async function github_listBranches(params, context) {
  const { owner, repo, per_page, page, protected: isProtected } = params || {};
  if (!owner || !repo) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner and repo are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/branches`,
      params: { per_page, page, protected: isProtected },
    })
  );
}

/**
 * Create a branch (create ref).
 * @param {object} params - { owner, repo, ref (e.g. refs/heads/my-branch), sha }
 * @param {object} context - { userId }
 */
async function github_createBranch(params, context) {
  const { owner, repo, ref, sha } = params || {};
  if (!owner || !repo || !ref || !sha) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, ref, and sha are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/git/refs`,
      data: { ref, sha },
    })
  );
}

/**
 * Delete a branch (delete ref).
 * @param {object} params - { owner, repo, ref (e.g. refs/heads/branch-name) }
 * @param {object} context - { userId }
 */
async function github_deleteBranch(params, context) {
  const { owner, repo, ref } = params || {};
  if (!owner || !repo || !ref) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and ref are required' } };
  const refPath = ref.startsWith('refs/') ? ref : `refs/heads/${ref}`;
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'DELETE',
      url: `/repos/${owner}/${repo}/git/refs/${encodeURIComponent(refPath)}`,
    })
  );
}

/**
 * Compare two branches/commits.
 * @param {object} params - { owner, repo, base, head }
 * @param {object} context - { userId }
 */
async function github_compareBranches(params, context) {
  const { owner, repo, base, head } = params || {};
  if (!owner || !repo || !base || !head) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, base, and head are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'GET',
      url: `/repos/${owner}/${repo}/compare/${base}...${head}`,
    })
  );
}

/**
 * Protect a branch (update branch protection).
 * @param {object} params - { owner, repo, branch, required_status_checks?, enforce_admins?, required_pull_request_reviews?, restrictions?, allow_force_pushes?, allow_deletions? }
 * @param {object} context - { userId }
 */
async function github_protectBranch(params, context) {
  const { owner, repo, branch, required_status_checks, enforce_admins, required_pull_request_reviews, restrictions, allow_force_pushes, allow_deletions } = params || {};
  if (!owner || !repo || !branch) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and branch are required' } };
  const branchName = branch.replace('refs/heads/', '');
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'PUT',
      url: `/repos/${owner}/${repo}/branches/${branchName}/protection`,
      data: {
        required_status_checks: required_status_checks || null,
        enforce_admins: enforce_admins || false,
        required_pull_request_reviews: required_pull_request_reviews || null,
        restrictions: restrictions || null,
        allow_force_pushes: allow_force_pushes || false,
        allow_deletions: allow_deletions || false,
      },
    })
  );
}

/**
 * Remove branch protection.
 * @param {object} params - { owner, repo, branch }
 * @param {object} context - { userId }
 */
async function github_unprotectBranch(params, context) {
  const { owner, repo, branch } = params || {};
  if (!owner || !repo || !branch) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, and branch are required' } };
  const branchName = branch.replace('refs/heads/', '');
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'DELETE',
      url: `/repos/${owner}/${repo}/branches/${branchName}/protection`,
    })
  );
}

/**
 * Rebase a branch (merge base into head via API: create merge commit or use Git data API).
 * GitHub REST does not have a direct "rebase branch" endpoint; we use merge with squash false and same ref as workaround, or Git create commit.
 * Documented behavior: merge base into head. POST /repos/{owner}/{repo}/merges with base=head and head=base inverts; actually we need to merge base into head: base=base, head=head. So merge is "create merge commit". For rebase we'd need to use Git API to create new commits. Per spec "thin wrapper", we expose the Merges API as "rebase" alternative: merge head into base (result on base). So we call POST /repos/.../merges with base=base, head=head to create merge commit from head into base.
 * Implementing as merge (create merge commit from head into base) since REST has no rebase. Name kept as github_rebaseBranch per spec.
 * @param {object} params - { owner, repo, base, head, commit_message? }
 * @param {object} context - { userId }
 */
async function github_rebaseBranch(params, context) {
  const { owner, repo, base, head, commit_message } = params || {};
  if (!owner || !repo || !base || !head) return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner, repo, base, and head are required' } };
  return withToken(context, (token) =>
    githubHttpClient.request(token, {
      method: 'POST',
      url: `/repos/${owner}/${repo}/merges`,
      data: { base, head, commit_message: commit_message || undefined },
    })
  );
}

module.exports = {
  github_listBranches,
  github_createBranch,
  github_deleteBranch,
  github_compareBranches,
  github_protectBranch,
  github_unprotectBranch,
  github_rebaseBranch,
};
