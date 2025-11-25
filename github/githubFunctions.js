// GitHub API Functions
// This module provides reusable functions for interacting with GitHub API
// Each function corresponds to a specific GitHub API endpoint

const axios = require("axios");
const supabase = require("../supabase/supabaseConnect");

/**
 * Helper function to get GitHub access token for a user
 * @param {string} userId - The user ID from authentication
 * @returns {Promise<string>} GitHub access token
 * @throws {Error} If token not found or retrieval fails
 */
async function getGitHubToken(userId) {
  try {
    const { data, error } = await supabase
      .from("github_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .single();

    if (error) {
      throw new Error(`Failed to retrieve GitHub token: ${error.message}`);
    }

    if (!data) {
      throw new Error("GitHub token not found. Please connect your GitHub account first.");
    }

    return data.access_token;
  } catch (err) {
    throw new Error(`Error fetching GitHub token: ${err.message}`);
  }
}

/**
 * Helper function to make GitHub API requests
 * @param {string} accessToken - GitHub access token
 * @param {string} endpoint - GitHub API endpoint (e.g., "/user")
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} GitHub API response data
 * @throws {Error} If API request fails
 */
async function makeGitHubRequest(accessToken, endpoint, params = {}) {
  try {
    const response = await axios.get(`https://api.github.com${endpoint}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
      params,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`GitHub API Error: ${error.response.status} - ${error.response.data.message}`);
    }
    throw new Error(`Request failed: ${error.message}`);
  }
}

/**
 * 1. Get GitHub connection status and username
 * @param {string} userId - The user ID from authentication
 * @returns {Promise<Object>} Connection status and user information
 */
async function getGithubStatus(userId) {
  try {
    const { data, error } = await supabase
      .from("github_tokens")
      .select("github_username, created_at")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return {
        success: true,
        connected: false,
        message: "GitHub account not connected",
      };
    }

    // Test the token by making a simple API call
    try {
      const accessToken = await getGitHubToken(userId);
      await makeGitHubRequest(accessToken, "/user");

      return {
        success: true,
        connected: true,
        username: data.github_username,
        connected_at: data.created_at,
      };
    } catch (tokenError) {
      return {
        success: true,
        connected: false,
        error: "GitHub token is invalid or expired",
        message: "Please reconnect your GitHub account",
      };
    }
  } catch (error) {
    throw new Error(`GitHub status check error: ${error.message}`);
  }
}

/**
 * 2. Get user's full GitHub profile information
 * @param {string} userId - The user ID from authentication
 * @returns {Promise<Object>} User's GitHub profile data
 */
async function getGithubProfile(userId) {
  try {
    const accessToken = await getGitHubToken(userId);
    const profile = await makeGitHubRequest(accessToken, "/user");

    return {
      success: true,
      data: {
        id: profile.id,
        login: profile.login,
        name: profile.name,
        email: profile.email,
        bio: profile.bio,
        company: profile.company,
        location: profile.location,
        blog: profile.blog,
        twitter_username: profile.twitter_username,
        public_repos: profile.public_repos,
        public_gists: profile.public_gists,
        followers: profile.followers,
        following: profile.following,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        avatar_url: profile.avatar_url,
        html_url: profile.html_url,
      },
    };
  } catch (error) {
    throw new Error(`GitHub profile fetch error: ${error.message}`);
  }
}

/**
 * 3. Get list of repositories with pagination
 * @param {string} userId - The user ID from authentication
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.per_page - Items per page (default: 30)
 * @param {string} options.sort - Sort order (default: "updated")
 * @param {string} options.type - Repository type (default: "all")
 * @returns {Promise<Object>} List of repositories
 */
async function getGithubRepos(userId, options = {}) {
  try {
    const accessToken = await getGitHubToken(userId);
    const { page = 1, per_page = 30, sort = "updated", type = "all" } = options;

    const repos = await makeGitHubRequest(accessToken, "/user/repos", {
      page,
      per_page,
      sort,
      affiliation: "owner,collaborator,organization_member", // Get all affiliated repos instead of type
    });

    const formattedRepos = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      fork: repo.fork,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      ssh_url: repo.ssh_url,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      watchers_count: repo.watchers_count,
      forks_count: repo.forks_count,
      open_issues_count: repo.open_issues_count,
      default_branch: repo.default_branch,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      size: repo.size,
      owner: {
        login: repo.owner.login,
        avatar_url: repo.owner.avatar_url,
        html_url: repo.owner.html_url,
      },
    }));

    return {
      success: true,
      data: formattedRepos,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: formattedRepos.length,
      },
    };
  } catch (error) {
    throw new Error(`GitHub repos fetch error: ${error.message}`);
  }
}

/**
 * 4. Get commit history for a specified repository
 * @param {string} userId - The user ID from authentication
 * @param {string} repo - Repository name in format "owner/repo"
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.per_page - Items per page (default: 30)
 * @param {string} options.sha - SHA or branch to start listing commits from
 * @param {string} options.path - Only commits containing this file path
 * @param {string} options.author - GitHub login or email address
 * @param {string} options.since - ISO 8601 date
 * @param {string} options.until - ISO 8601 date
 * @returns {Promise<Object>} List of commits
 */
async function getGithubCommits(userId, repo, options = {}) {
  try {
    if (!repo) {
      throw new Error("Repository name is required. Use format: owner/repo");
    }

    const accessToken = await getGitHubToken(userId);
    const { page = 1, per_page = 30, sha, path, author, since, until } = options;

    const commits = await makeGitHubRequest(accessToken, `/repos/${repo}/commits`, {
      page,
      per_page,
      sha,
      path,
      author,
      since,
      until,
    });

    const formattedCommits = commits.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author.name,
        email: commit.commit.author.email,
        date: commit.commit.author.date,
        login: commit.author ? commit.author.login : null,
        avatar_url: commit.author ? commit.author.avatar_url : null,
      },
      committer: {
        name: commit.commit.committer.name,
        email: commit.commit.committer.email,
        date: commit.commit.committer.date,
        login: commit.committer ? commit.committer.login : null,
        avatar_url: commit.committer ? commit.committer.avatar_url : null,
      },
      html_url: commit.html_url,
      tree: {
        sha: commit.commit.tree.sha,
        url: commit.commit.tree.url,
      },
      parents: commit.parents.map(parent => ({
        sha: parent.sha,
        url: parent.url,
      })),
    }));

    return {
      success: true,
      data: formattedCommits,
      repository: repo,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: formattedCommits.length,
      },
    };
  } catch (error) {
    throw new Error(`GitHub commits fetch error: ${error.message}`);
  }
}

/**
 * 5. Get list of issues assigned to the user
 * @param {string} userId - The user ID from authentication
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.per_page - Items per page (default: 30)
 * @param {string} options.state - Issue state: "open", "closed", "all" (default: "open")
 * @param {string} options.filter - Filter type: "assigned", "created", "mentioned", "subscribed", "repos", "all" (default: "assigned")
 * @param {string} options.sort - Sort by: "created", "updated", "comments" (default: "created")
 * @param {string} options.direction - Sort direction: "asc", "desc" (default: "desc")
 * @param {string} options.labels - Comma-separated list of label names
 * @param {string} options.since - ISO 8601 date
 * @returns {Promise<Object>} List of issues
 */
async function getGithubIssues(userId, options = {}) {
  try {
    const accessToken = await getGitHubToken(userId);
    const { 
      page = 1, 
      per_page = 30, 
      state = "open", 
      filter = "assigned", 
      sort = "created", 
      direction = "desc",
      labels,
      since
    } = options;

    const issues = await makeGitHubRequest(accessToken, "/issues", {
      page,
      per_page,
      state,
      filter,
      sort,
      direction,
      labels,
      since,
    });

    const formattedIssues = issues.map(issue => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      locked: issue.locked,
      assignee: issue.assignee ? {
        login: issue.assignee.login,
        avatar_url: issue.assignee.avatar_url,
        html_url: issue.assignee.html_url,
      } : null,
      assignees: issue.assignees.map(assignee => ({
        login: assignee.login,
        avatar_url: assignee.avatar_url,
        html_url: assignee.html_url,
      })),
      labels: issue.labels.map(label => ({
        name: label.name,
        color: label.color,
        description: label.description,
      })),
      user: {
        login: issue.user.login,
        avatar_url: issue.user.avatar_url,
        html_url: issue.user.html_url,
      },
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      closed_at: issue.closed_at,
      html_url: issue.html_url,
      repository_url: issue.repository_url,
      comments: issue.comments,
      repository: issue.repository ? {
        id: issue.repository.id,
        name: issue.repository.name,
        full_name: issue.repository.full_name,
        html_url: issue.repository.html_url,
      } : null,
    }));

    return {
      success: true,
      data: formattedIssues,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: formattedIssues.length,
      },
    };
  } catch (error) {
    throw new Error(`GitHub issues fetch error: ${error.message}`);
  }
}

/**
 * 6. Get list of pull requests created by the user
 * @param {string} userId - The user ID from authentication
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.per_page - Items per page (default: 30)
 * @param {string} options.state - PR state: "open", "closed", "all" (default: "open")
 * @param {string} options.sort - Sort by: "created", "updated", "popularity", "long-running" (default: "created")
 * @param {string} options.direction - Sort direction: "asc", "desc" (default: "desc")
 * @param {string} options.repo - Filter by specific repository (format: "owner/repo")
 * @returns {Promise<Object>} List of pull requests
 */
async function getGithubPullRequests(userId, options = {}) {
  try {
    const accessToken = await getGitHubToken(userId);
    const { 
      page = 1, 
      per_page = 30, 
      state = "open", 
      sort = "created", 
      direction = "desc",
      repo
    } = options;

    let endpoint = "/search/issues";
    let searchQuery = "is:pr author:@me";
    
    if (state !== "all") {
      searchQuery += ` state:${state}`;
    }
    
    if (repo) {
      searchQuery += ` repo:${repo}`;
    }

    const response = await makeGitHubRequest(accessToken, endpoint, {
      q: searchQuery,
      sort,
      order: direction,
      page,
      per_page,
    });

    const formattedPRs = response.items.map(pr => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      locked: pr.locked,
      user: {
        login: pr.user.login,
        avatar_url: pr.user.avatar_url,
        html_url: pr.user.html_url,
      },
      assignee: pr.assignee ? {
        login: pr.assignee.login,
        avatar_url: pr.assignee.avatar_url,
        html_url: pr.assignee.html_url,
      } : null,
      assignees: pr.assignees.map(assignee => ({
        login: assignee.login,
        avatar_url: assignee.avatar_url,
        html_url: assignee.html_url,
      })),
      labels: pr.labels.map(label => ({
        name: label.name,
        color: label.color,
        description: label.description,
      })),
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      closed_at: pr.closed_at,
      html_url: pr.html_url,
      repository_url: pr.repository_url,
      comments: pr.comments,
      draft: pr.draft,
    }));

    return {
      success: true,
      data: formattedPRs,
      total_count: response.total_count,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: formattedPRs.length,
      },
    };
  } catch (error) {
    throw new Error(`GitHub pull requests fetch error: ${error.message}`);
  }
}

/**
 * 7. Get list of notifications for the user
 * @param {string} userId - The user ID from authentication
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.per_page - Items per page (default: 30)
 * @param {boolean} options.all - Show notifications marked as read (default: false)
 * @param {boolean} options.participating - Show only notifications in which the user is directly participating or mentioned (default: false)
 * @param {string} options.since - ISO 8601 date
 * @param {string} options.before - ISO 8601 date
 * @returns {Promise<Object>} List of notifications
 */
async function getGithubNotifications(userId, options = {}) {
  try {
    const accessToken = await getGitHubToken(userId);
    const { 
      page = 1, 
      per_page = 30, 
      all = false, 
      participating = false, 
      since,
      before
    } = options;

    const notifications = await makeGitHubRequest(accessToken, "/notifications", {
      page,
      per_page,
      all,
      participating,
      since,
      before,
    });

    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      unread: notification.unread,
      reason: notification.reason,
      updated_at: notification.updated_at,
      last_read_at: notification.last_read_at,
      url: notification.url,
      subscription_url: notification.subscription_url,
      subject: {
        title: notification.subject.title,
        url: notification.subject.url,
        latest_comment_url: notification.subject.latest_comment_url,
        type: notification.subject.type,
      },
      repository: {
        id: notification.repository.id,
        name: notification.repository.name,
        full_name: notification.repository.full_name,
        description: notification.repository.description,
        private: notification.repository.private,
        html_url: notification.repository.html_url,
        owner: {
          login: notification.repository.owner.login,
          avatar_url: notification.repository.owner.avatar_url,
          html_url: notification.repository.owner.html_url,
        },
      },
    }));

    return {
      success: true,
      data: formattedNotifications,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: formattedNotifications.length,
      },
    };
  } catch (error) {
    throw new Error(`GitHub notifications fetch error: ${error.message}`);
  }
}

/**
 * 8. Get detailed information about a specified repository
 * @param {string} userId - The user ID from authentication
 * @param {string} owner - Repository owner username
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} Detailed repository information
 */
async function getGithubRepository(userId, owner, repo) {
  try {
    if (!owner || !repo) {
      throw new Error("Both owner and repository name are required");
    }

    const accessToken = await getGitHubToken(userId);
    const repository = await makeGitHubRequest(accessToken, `/repos/${owner}/${repo}`);

    return {
      success: true,
      data: {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        description: repository.description,
        private: repository.private,
        fork: repository.fork,
        html_url: repository.html_url,
        clone_url: repository.clone_url,
        ssh_url: repository.ssh_url,
        language: repository.language,
        stargazers_count: repository.stargazers_count,
        watchers_count: repository.watchers_count,
        forks_count: repository.forks_count,
        open_issues_count: repository.open_issues_count,
        default_branch: repository.default_branch,
        created_at: repository.created_at,
        updated_at: repository.updated_at,
        pushed_at: repository.pushed_at,
        size: repository.size,
        topics: repository.topics,
        license: repository.license,
        owner: {
          login: repository.owner.login,
          avatar_url: repository.owner.avatar_url,
          html_url: repository.owner.html_url,
        },
      },
    };
  } catch (error) {
    throw new Error(`GitHub repository fetch error: ${error.message}`);
  }
}

/**
 * Additional utility function: Mark notification as read
 * @param {string} userId - The user ID from authentication
 * @param {string} notificationId - The notification ID
 * @returns {Promise<Object>} Success response
 */
async function markGithubNotificationAsRead(userId, notificationId) {
  try {
    if (!notificationId) {
      throw new Error("Notification ID is required");
    }

    const accessToken = await getGitHubToken(userId);

    await axios.patch(
      `https://api.github.com/notifications/threads/${notificationId}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    return {
      success: true,
      message: "Notification marked as read",
    };
  } catch (error) {
    throw new Error(`Mark notification as read error: ${error.response?.data?.message || error.message}`);
  }
}

module.exports = {
  getGithubStatus,
  getGithubProfile,
  getGithubRepos,
  getGithubCommits,
  getGithubIssues,
  getGithubPullRequests,
  getGithubNotifications,
  getGithubRepository,
  markGithubNotificationAsRead,
  // Export helper functions for advanced usage
  getGitHubToken,
  makeGitHubRequest,
};