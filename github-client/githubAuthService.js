/**
 * Centralized GitHub token retrieval.
 * Uses existing github_tokens table (Supabase). No database writes; read-only.
 * @module github-client/githubAuthService
 */

const supabase = require('../supabase/supabaseConnect');

/**
 * Get GitHub access token for a user.
 * @param {string} userId - User ID (auth.users.id or equivalent).
 * @returns {Promise<string>} Access token.
 * @throws {Error} When token is missing or retrieval fails.
 */
async function getToken(userId) {
  if (!userId) {
    throw new Error('GitHub token requires userId');
  }
  const { data, error } = await supabase
    .from('github_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to retrieve GitHub token: ${error.message}`);
  }
  if (!data || !data.access_token) {
    throw new Error('GitHub token not found. Please connect your GitHub account first.');
  }
  return data.access_token;
}

module.exports = {
  getToken,
};
