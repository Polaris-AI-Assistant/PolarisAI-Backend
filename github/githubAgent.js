/**
 * GitHub AI Agent using OpenAI Agent SDK
 * 
 * This agent provides intelligent interaction with GitHub data using natural language queries.
 * It dynamically selects and executes appropriate GitHub API functions based on user intent.
 * 
 * Features:
 * - Natural language query processing
 * - Dynamic tool selection based on user intent
 * - Real-time GitHub data fetching
 * - Multi-tool query support
 * - Comprehensive error handling
 * 
 * Usage:
 * const agent = new GitHubAgent();
 * const result = await agent.processQuery("show me my recent commits", userId);
 */

const OpenAI = require('openai');
const githubFunctions = require('./githubFunctions');
const githubTools = require('../github-tools');
const supabase = require('../supabase/supabaseConnect');

class GitHubAgent {
  constructor() {
    // Initialize OpenAI client with API key from environment
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Define available tools/functions that the agent can use
    this.tools = this.defineTools();
    
    // Map function names to actual implementations
    this.functionMap = this.createFunctionMap();

    // System prompt that defines the agent's behavior and capabilities
    this.systemPrompt = this.createSystemPrompt();
  }

  /**
   * Resolve the connected GitHub username for a userId.
   * @param {string} userId
   * @returns {Promise<string|null>}
   */
  async getConnectedGithubUsername(userId) {
    try {
      const { data, error } = await supabase
        .from('github_tokens')
        .select('github_username')
        .eq('user_id', userId)
        .single();
      if (error || !data) return null;
      return data.github_username || null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Normalize/auto-fill common GitHub params to prevent avoidable failures:
   * - owner: fill from connected username when missing/placeholder
   * - repo: supports "owner/repo" format by splitting
   * @param {string} userId
   * @param {object} args
   * @param {object} options
   * @returns {Promise<object>}
   */
  async normalizeGithubArgs(userId, args, options = {}) {
    const normalized = { ...(args || {}) };

    // Split "owner/repo" if provided in repo field
    if (typeof normalized.repo === 'string' && normalized.repo.includes('/') && !normalized.owner) {
      const [owner, repo] = normalized.repo.split('/');
      if (owner && repo) {
        normalized.owner = owner;
        normalized.repo = repo;
      }
    }

    const placeholderOwners = new Set([
      'your_username',
      'your-username',
      'your username',
      'pending',
      'me',
      'my',
      'owner',
    ]);

    // Auto-fill owner when missing/placeholder
    if (!normalized.owner || placeholderOwners.has(String(normalized.owner).toLowerCase())) {
      const fromOptions = options.githubUsername;
      const fromDb = fromOptions || (await this.getConnectedGithubUsername(userId));
      if (fromDb) normalized.owner = fromDb;
    }

    return normalized;
  }

  /**
   * Create or update README.md for a repo by generating content from repo structure.
   * This is agent-level orchestration (multiple GitHub API calls via wrappers).
   * @param {string} userId
   * @param {object} params - { owner?, repo }
   * @returns {Promise<{ success: boolean, data: any, error: any }>}
   */
  async upsertReadme(userId, params = {}) {
    try {
      const normalized = await this.normalizeGithubArgs(userId, params, {});
      const { owner, repo } = normalized;
      if (!repo) {
        return { success: false, data: null, error: { code: 'VALIDATION', message: 'repo is required' } };
      }
      if (!owner) {
        return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner could not be resolved' } };
      }

      const repoInfo = await githubTools.github_getRepoInfo({ owner, repo }, { userId });
      if (!repoInfo.success) return repoInfo;

      const defaultBranch = repoInfo.data?.default_branch || 'main';

      const treeRes = await githubTools.github_getRepoFileTree(
        { owner, repo, ref: defaultBranch, recursive: true },
        { userId }
      );
      if (!treeRes.success) return treeRes;

      const paths = Array.isArray(treeRes.data?.tree)
        ? treeRes.data.tree.map((t) => t.path).filter(Boolean).slice(0, 300)
        : [];

      const system = `You write high-quality README.md files for software repositories.
Return ONLY markdown content for README.md (no code fences around the whole file).`;

      const user = `Repository: ${owner}/${repo}
Description: ${repoInfo.data?.description || ''}
Default branch: ${defaultBranch}

File tree (top 300 paths):
${paths.map((p) => `- ${p}`).join('\n')}

Task:
Generate a clear, professional README.md tailored to this repository. Include:
- Overview
- Key features (infer from structure if possible)
- Tech stack (infer from file names like package.json, requirements.txt, etc.)
- Setup / Installation
- Usage
- Project structure (brief)
- Contributing
- License (if detectable, otherwise say \"See LICENSE\" if present, else omit)
Keep it concise but useful.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        max_tokens: 1800,
      });

      const readmeContent = (completion.choices[0].message.content || '').trim();
      if (!readmeContent) {
        return { success: false, data: null, error: { code: 'GENERATION_FAILED', message: 'Failed to generate README content' } };
      }

      const readmePath = 'README.md';
      const existing = await githubTools.github_getFileContent(
        { owner, repo, path: readmePath, ref: defaultBranch },
        { userId }
      );

      if (existing.success) {
        const sha = existing.data?.sha;
        if (!sha) {
          return { success: false, data: null, error: { code: 'MISSING_SHA', message: 'Could not determine README sha for update' } };
        }
        const updated = await githubTools.github_updateWholeFile(
          { owner, repo, path: readmePath, message: 'Update README.md', content: readmeContent, sha, branch: defaultBranch },
          { userId }
        );
        if (!updated.success) return updated;
        return { success: true, data: { action: 'updated', owner, repo, branch: defaultBranch, path: readmePath }, error: null };
      }

      if (existing.error && existing.error.code === 'GITHUB_404') {
        const created = await githubTools.github_createFile(
          { owner, repo, path: readmePath, message: 'Add README.md', content: readmeContent, branch: defaultBranch },
          { userId }
        );
        if (!created.success) return created;
        return { success: true, data: { action: 'created', owner, repo, branch: defaultBranch, path: readmePath }, error: null };
      }

      return existing;
    } catch (err) {
      return { success: false, data: null, error: { code: 'UNKNOWN', message: err.message || 'Unknown error' } };
    }
  }

  /**
   * Update a file by resolving its SHA automatically.
   * @param {string} userId
   * @param {object} params - { owner?, repo, path, content, message?, branch? }
   */
  async safeUpdateFile(userId, params = {}) {
    try {
      const normalized = await this.normalizeGithubArgs(userId, params, {});
      const { owner, repo, path, content } = normalized;
      if (!repo || !path || content === undefined) {
        return { success: false, data: null, error: { code: 'VALIDATION', message: 'repo, path, and content are required' } };
      }
      if (!owner) {
        return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner could not be resolved' } };
      }

      const repoInfo = await githubTools.github_getRepoInfo({ owner, repo }, { userId });
      if (!repoInfo.success) return repoInfo;
      const branch = normalized.branch || repoInfo.data?.default_branch || 'main';
      const message = normalized.message || `Update ${path}`;

      const existing = await githubTools.github_getFileContent({ owner, repo, path, ref: branch }, { userId });
      if (!existing.success) return existing;
      const sha = existing.data?.sha;
      if (!sha) return { success: false, data: null, error: { code: 'MISSING_SHA', message: 'Could not determine file sha for update' } };

      const updated = await githubTools.github_updateWholeFile({ owner, repo, path, message, content, sha, branch }, { userId });
      if (!updated.success) return updated;
      return { success: true, data: { action: 'updated', owner, repo, branch, path }, error: null };
    } catch (err) {
      return { success: false, data: null, error: { code: 'UNKNOWN', message: err.message || 'Unknown error' } };
    }
  }

  /**
   * Delete a file by resolving its SHA automatically.
   * @param {string} userId
   * @param {object} params - { owner?, repo, path, message?, branch? }
   */
  async safeDeleteFile(userId, params = {}) {
    try {
      const normalized = await this.normalizeGithubArgs(userId, params, {});
      const { owner, repo, path } = normalized;
      if (!repo || !path) {
        return { success: false, data: null, error: { code: 'VALIDATION', message: 'repo and path are required' } };
      }
      if (!owner) {
        return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner could not be resolved' } };
      }

      const repoInfo = await githubTools.github_getRepoInfo({ owner, repo }, { userId });
      if (!repoInfo.success) return repoInfo;
      const branch = normalized.branch || repoInfo.data?.default_branch || 'main';
      const message = normalized.message || `Delete ${path}`;

      const existing = await githubTools.github_getFileContent({ owner, repo, path, ref: branch }, { userId });
      if (!existing.success) return existing;
      const sha = existing.data?.sha;
      if (!sha) return { success: false, data: null, error: { code: 'MISSING_SHA', message: 'Could not determine file sha for delete' } };

      const deleted = await githubTools.github_deleteFile({ owner, repo, path, message, sha, branch }, { userId });
      if (!deleted.success) return deleted;
      return { success: true, data: { action: 'deleted', owner, repo, branch, path }, error: null };
    } catch (err) {
      return { success: false, data: null, error: { code: 'UNKNOWN', message: err.message || 'Unknown error' } };
    }
  }

  /**
   * Create OR update a file by checking for existence first (prevents 422 errors).
   * @param {string} userId
   * @param {object} params - { owner?, repo, path, content, message?, branch? }
   */
  async upsertFile(userId, params = {}) {
    try {
      const normalized = await this.normalizeGithubArgs(userId, params, {});
      const { owner, repo, path, content } = normalized;
      if (!repo || !path || content === undefined) {
        return { success: false, data: null, error: { code: 'VALIDATION', message: 'repo, path, and content are required' } };
      }
      if (!owner) {
        return { success: false, data: null, error: { code: 'VALIDATION', message: 'owner could not be resolved' } };
      }

      const repoInfo = await githubTools.github_getRepoInfo({ owner, repo }, { userId });
      if (!repoInfo.success) return repoInfo;
      const branch = normalized.branch || repoInfo.data?.default_branch || 'main';

      const existing = await githubTools.github_getFileContent({ owner, repo, path, ref: branch }, { userId });
      if (existing.success) {
        const sha = existing.data?.sha;
        if (!sha) return { success: false, data: null, error: { code: 'MISSING_SHA', message: 'Could not determine file sha for update' } };
        const message = normalized.message || `Update ${path}`;
        const updated = await githubTools.github_updateWholeFile({ owner, repo, path, message, content, sha, branch }, { userId });
        if (!updated.success) return updated;
        return { success: true, data: { action: 'updated', owner, repo, branch, path }, error: null };
      }

      if (existing.error && existing.error.code === 'GITHUB_404') {
        const message = normalized.message || `Add ${path}`;
        const created = await githubTools.github_createFile({ owner, repo, path, message, content, branch }, { userId });
        if (!created.success) return created;
        return { success: true, data: { action: 'created', owner, repo, branch, path }, error: null };
      }

      return existing;
    } catch (err) {
      return { success: false, data: null, error: { code: 'UNKNOWN', message: err.message || 'Unknown error' } };
    }
  }

  /**
   * Define OpenAI function schemas for each GitHub function
   * These schemas help the AI understand when and how to use each tool
   */
  defineTools() {
    return [
      {
        type: "function",
        function: {
          name: "getGithubStatus",
          description: "Get GitHub connection status and username for the user. Use this when user asks about connection status or if they're connected to GitHub.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubProfile",
          description: "Get detailed GitHub profile information including bio, followers, repos count, etc. Use when user asks about their profile, account details, or personal GitHub information.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubRepos",
          description: "Get list of user's repositories with pagination. Use when user asks about their repos, repositories, or wants to see their projects.",
          parameters: {
            type: "object",
            properties: {
              page: {
                type: "number",
                description: "Page number for pagination (default: 1)"
              },
              per_page: {
                type: "number",
                description: "Number of repositories per page (default: 30, max: 100). When user asks for a specific number like 'show 10 repos', set this to that number."
              },
              sort: {
                type: "string",
                enum: ["created", "updated", "pushed", "full_name"],
                description: "Sort repositories by (default: updated)"
              },
              type: {
                type: "string",
                enum: ["all", "owner", "public", "private", "member"],
                description: "Type of repositories to fetch (default: all)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubCommits",
          description: "Get commit history for a specific repository. Use when user asks about commits, recent changes, or commit history for a specific repo.",
          parameters: {
            type: "object",
            properties: {
              repo: {
                type: "string",
                description: "Repository name in format 'owner/repo' (e.g., 'octocat/Hello-World')"
              },
              page: {
                type: "number",
                description: "Page number for pagination (default: 1)"
              },
              per_page: {
                type: "number",
                description: "Number of commits per page (default: 30, max: 100)"
              },
              author: {
                type: "string",
                description: "Filter commits by author (GitHub username or email)"
              },
              since: {
                type: "string",
                description: "Only commits after this date (ISO 8601 format)"
              },
              until: {
                type: "string",
                description: "Only commits before this date (ISO 8601 format)"
              }
            },
            required: ["repo"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubIssues",
          description: "Get list of issues assigned to or created by the user. Use when user asks about issues, bugs, tasks, or tickets.",
          parameters: {
            type: "object",
            properties: {
              page: {
                type: "number",
                description: "Page number for pagination (default: 1)"
              },
              per_page: {
                type: "number",
                description: "Number of issues per page (default: 30, max: 100)"
              },
              state: {
                type: "string",
                enum: ["open", "closed", "all"],
                description: "Issue state filter (default: open)"
              },
              filter: {
                type: "string",
                enum: ["assigned", "created", "mentioned", "subscribed", "repos", "all"],
                description: "Filter type (default: assigned)"
              },
              sort: {
                type: "string",
                enum: ["created", "updated", "comments"],
                description: "Sort issues by (default: created)"
              },
              direction: {
                type: "string",
                enum: ["asc", "desc"],
                description: "Sort direction (default: desc)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubPullRequests",
          description: "Get list of pull requests created by the user. Use when user asks about PRs, pull requests, or code reviews.",
          parameters: {
            type: "object",
            properties: {
              page: {
                type: "number",
                description: "Page number for pagination (default: 1)"
              },
              per_page: {
                type: "number",
                description: "Number of PRs per page (default: 30, max: 100)"
              },
              state: {
                type: "string",
                enum: ["open", "closed", "all"],
                description: "PR state filter (default: open)"
              },
              sort: {
                type: "string",
                enum: ["created", "updated", "popularity"],
                description: "Sort PRs by (default: created)"
              },
              direction: {
                type: "string",
                enum: ["asc", "desc"],
                description: "Sort direction (default: desc)"
              },
              repo: {
                type: "string",
                description: "Filter by specific repository (format: owner/repo)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubNotifications",
          description: "Get GitHub notifications for the user. Use when user asks about notifications, alerts, or unread items.",
          parameters: {
            type: "object",
            properties: {
              page: {
                type: "number",
                description: "Page number for pagination (default: 1)"
              },
              per_page: {
                type: "number",
                description: "Number of notifications per page (default: 30, max: 100)"
              },
              all: {
                type: "boolean",
                description: "Show notifications marked as read (default: false)"
              },
              participating: {
                type: "boolean",
                description: "Show only notifications where user is participating (default: false)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getGithubRepository",
          description: "Get detailed information about a specific repository. Use when user asks about a specific repo's details, stats, or information.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              }
            },
            required: ["owner", "repo"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getRepoFileTree",
          description: "Get a repository file tree (optionally recursive). Use for requests like 'show entire file structure'. If owner is omitted, it will be inferred from the connected GitHub account.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username (optional; inferred if omitted)"
              },
              repo: {
                type: "string",
                description: "Repository name (required)"
              },
              ref: {
                type: "string",
                description: "Branch/tag name to use as tree reference (default: main)"
              },
              tree_sha: {
                type: "string",
                description: "Tree SHA (optional; if provided it overrides ref)"
              },
              recursive: {
                type: "boolean",
                description: "Whether to return the full recursive tree (default: false)"
              }
            },
            required: ["repo"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "upsertReadme",
          description: "Generate and create/update README.md for a repository based on its contents.",
          parameters: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Repository owner (optional; inferred if omitted)" },
              repo: { type: "string", description: "Repository name (required)" }
            },
            required: ["repo"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "upsertFile",
          description: "Create or update a file in a repository by checking existence first (prevents errors).",
          parameters: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Repository owner (optional; inferred if omitted)" },
              repo: { type: "string", description: "Repository name (required)" },
              path: { type: "string", description: "File path (required)" },
              content: { type: "string", description: "File content (plain text)" },
              message: { type: "string", description: "Commit message" },
              branch: { type: "string", description: "Branch name (optional)" }
            },
            required: ["repo", "path", "content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "safeUpdateFile",
          description: "Update a file in a repository by resolving the file SHA automatically.",
          parameters: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Repository owner (optional; inferred if omitted)" },
              repo: { type: "string", description: "Repository name (required)" },
              path: { type: "string", description: "File path (required)" },
              content: { type: "string", description: "New file content (plain text)" },
              message: { type: "string", description: "Commit message" },
              branch: { type: "string", description: "Branch name (optional)" }
            },
            required: ["repo", "path", "content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "safeDeleteFile",
          description: "Delete a file in a repository by resolving the file SHA automatically.",
          parameters: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Repository owner (optional; inferred if omitted)" },
              repo: { type: "string", description: "Repository name (required)" },
              path: { type: "string", description: "File path (required)" },
              message: { type: "string", description: "Commit message" },
              branch: { type: "string", description: "Branch name (optional)" }
            },
            required: ["repo", "path"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "createRepository",
          description: "Create a new GitHub repository. Use when user wants to create a new repo.",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Repository name (required)"
              },
              description: {
                type: "string",
                description: "Repository description"
              },
              private: {
                type: "boolean",
                description: "Whether the repository should be private (default: false for public)"
              },
              auto_init: {
                type: "boolean",
                description: "Initialize repository with README (default: false)"
              }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "createIssue",
          description: "Create a new GitHub issue in a repository. Use when user wants to create an issue.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              title: {
                type: "string",
                description: "Issue title (required)"
              },
              body: {
                type: "string",
                description: "Issue body/description"
              },
              assignees: {
                type: "array",
                items: { type: "string" },
                description: "Array of GitHub usernames to assign"
              },
              labels: {
                type: "array",
                items: { type: "string" },
                description: "Array of label names"
              }
            },
            required: ["owner", "repo", "title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "createPullRequest",
          description: "Create a new GitHub pull request. Use when user wants to create a PR.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              title: {
                type: "string",
                description: "PR title (required)"
              },
              head: {
                type: "string",
                description: "Branch name to merge FROM (required)"
              },
              base: {
                type: "string",
                description: "Branch name to merge INTO (required, usually 'main' or 'master')"
              },
              body: {
                type: "string",
                description: "PR description"
              },
              draft: {
                type: "boolean",
                description: "Create as draft PR (default: false)"
              }
            },
            required: ["owner", "repo", "title", "head", "base"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "createFile",
          description: "Create a new file in a repository. Use when user wants to create a file.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              path: {
                type: "string",
                description: "File path (required)"
              },
              message: {
                type: "string",
                description: "Commit message (required)"
              },
              content: {
                type: "string",
                description: "File content as plain text (will be base64 encoded automatically)"
              },
              branch: {
                type: "string",
                description: "Branch name (default: default branch)"
              }
            },
            required: ["owner", "repo", "path", "message", "content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updateFile",
          description: "Update an existing file in a repository. Use when user wants to modify a file.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              path: {
                type: "string",
                description: "File path (required)"
              },
              message: {
                type: "string",
                description: "Commit message (required)"
              },
              content: {
                type: "string",
                description: "New file content as plain text"
              },
              sha: {
                type: "string",
                description: "SHA of the file being updated (required, get from getFileContent first)"
              },
              branch: {
                type: "string",
                description: "Branch name"
              }
            },
            required: ["owner", "repo", "path", "message", "content", "sha"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deleteFile",
          description: "Delete a file from a repository. Use when user wants to delete a file.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              path: {
                type: "string",
                description: "File path to delete (required)"
              },
              message: {
                type: "string",
                description: "Commit message (required)"
              },
              sha: {
                type: "string",
                description: "SHA of the file being deleted (required, get from getFileContent first)"
              },
              branch: {
                type: "string",
                description: "Branch name"
              }
            },
            required: ["owner", "repo", "path", "message", "sha"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "createBranch",
          description: "Create a new branch in a repository. Use when user wants to create a branch.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              ref: {
                type: "string",
                description: "Full ref name like 'refs/heads/branch-name' or just 'branch-name' (required)"
              },
              sha: {
                type: "string",
                description: "SHA to base the branch on (required, usually 'main' or 'master')"
              }
            },
            required: ["owner", "repo", "ref", "sha"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "mergePullRequest",
          description: "Merge a pull request. Use when user wants to merge a PR.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              pull_number: {
                type: "number",
                description: "Pull request number (required)"
              },
              commit_title: {
                type: "string",
                description: "Custom merge commit title"
              },
              commit_message: {
                type: "string",
                description: "Custom merge commit message"
              },
              merge_method: {
                type: "string",
                enum: ["merge", "squash", "rebase"],
                description: "Merge method (default: merge)"
              }
            },
            required: ["owner", "repo", "pull_number"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "closeIssue",
          description: "Close a GitHub issue. Use when user wants to close an issue.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              issue_number: {
                type: "number",
                description: "Issue number (required)"
              }
            },
            required: ["owner", "repo", "issue_number"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "closePR",
          description: "Close a pull request without merging. Use when user wants to close a PR.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              pull_number: {
                type: "number",
                description: "Pull request number (required)"
              }
            },
            required: ["owner", "repo", "pull_number"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "addIssueComment",
          description: "Add a comment to an issue. Use when user wants to comment on an issue.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              issue_number: {
                type: "number",
                description: "Issue number (required)"
              },
              body: {
                type: "string",
                description: "Comment body (required)"
              }
            },
            required: ["owner", "repo", "issue_number", "body"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "commentOnPR",
          description: "Add a comment to a pull request. Use when user wants to comment on a PR.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              pull_number: {
                type: "number",
                description: "Pull request number (required)"
              },
              body: {
                type: "string",
                description: "Comment body (required)"
              }
            },
            required: ["owner", "repo", "pull_number", "body"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "approvePR",
          description: "Approve a pull request. Use when user wants to approve a PR.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner username"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              pull_number: {
                type: "number",
                description: "Pull request number (required)"
              },
              body: {
                type: "string",
                description: "Optional approval comment"
              }
            },
            required: ["owner", "repo", "pull_number"]
          }
        }
      }
    ];
  }

  /**
   * Create adapter wrapper for new tools (params, context) -> (userId, params)
   * This allows the new tools to work with the existing agent signature
   * Made static to avoid binding issues
   */
  static createToolAdapter(toolFunction) {
    return async (userId, params) => {
      const result = await toolFunction(params || {}, { userId });
      // Convert to old format if needed (new tools already return { success, data, error })
      return result;
    };
  }

  /**
   * Create mapping between function names and their implementations
   * This allows the agent to execute the correct function based on OpenAI's selection
   */
  createFunctionMap() {
    // Legacy functions (read-only, old signature)
    const legacyMap = {
      'getGithubStatus': githubFunctions.getGithubStatus,
      'getGithubProfile': githubFunctions.getGithubProfile,
      'getGithubRepos': githubFunctions.getGithubRepos,
      'getGithubCommits': githubFunctions.getGithubCommits,
      'getGithubIssues': githubFunctions.getGithubIssues,
      'getGithubPullRequests': githubFunctions.getGithubPullRequests,
      'getGithubNotifications': githubFunctions.getGithubNotifications,
      'getGithubRepository': githubFunctions.getGithubRepository,
      // New read tool for file structure
      'getRepoFileTree': GitHubAgent.createToolAdapter(githubTools.github_getRepoFileTree)
    };

    // New tools (all operations, new signature wrapped)
    const newToolsMap = {
      // README orchestration
      'upsertReadme': async (userId, params) => this.upsertReadme(userId, params),
      // Safe file operations (resolve SHA / upsert)
      'upsertFile': async (userId, params) => this.upsertFile(userId, params),
      'safeUpdateFile': async (userId, params) => this.safeUpdateFile(userId, params),
      'safeDeleteFile': async (userId, params) => this.safeDeleteFile(userId, params),

      // Repository operations
      'createRepository': GitHubAgent.createToolAdapter(githubTools.github_createRepo),
      'createRepo': GitHubAgent.createToolAdapter(githubTools.github_createRepo),
      'listRepos': GitHubAgent.createToolAdapter(githubTools.github_listRepos),
      'getRepoInfo': GitHubAgent.createToolAdapter(githubTools.github_getRepoInfo),
      'createOrgRepo': GitHubAgent.createToolAdapter(githubTools.github_createOrgRepo),
      'setRepoVisibility': GitHubAgent.createToolAdapter(githubTools.github_setRepoVisibility),
      'updateRepoSettings': GitHubAgent.createToolAdapter(githubTools.github_updateRepoSettings),
      'archiveRepo': GitHubAgent.createToolAdapter(githubTools.github_archiveRepo),
      'transferRepo': GitHubAgent.createToolAdapter(githubTools.github_transferRepo),
      'forkRepo': GitHubAgent.createToolAdapter(githubTools.github_forkRepo),
      
      // File operations
      'listRepoContents': GitHubAgent.createToolAdapter(githubTools.github_listRepoContents),
      'getFileContent': GitHubAgent.createToolAdapter(githubTools.github_getFileContent),
      'createFile': GitHubAgent.createToolAdapter(githubTools.github_createFile),
      'updateFile': GitHubAgent.createToolAdapter(githubTools.github_updateWholeFile),
      'deleteFile': GitHubAgent.createToolAdapter(githubTools.github_deleteFile),
      'searchRepoCode': GitHubAgent.createToolAdapter(githubTools.github_searchRepoCode),
      'getRepoFileTree': GitHubAgent.createToolAdapter(githubTools.github_getRepoFileTree),
      
      // Branch operations
      'listBranches': GitHubAgent.createToolAdapter(githubTools.github_listBranches),
      'createBranch': GitHubAgent.createToolAdapter(githubTools.github_createBranch),
      'deleteBranch': GitHubAgent.createToolAdapter(githubTools.github_deleteBranch),
      'compareBranches': GitHubAgent.createToolAdapter(githubTools.github_compareBranches),
      'protectBranch': GitHubAgent.createToolAdapter(githubTools.github_protectBranch),
      'unprotectBranch': GitHubAgent.createToolAdapter(githubTools.github_unprotectBranch),
      'rebaseBranch': GitHubAgent.createToolAdapter(githubTools.github_rebaseBranch),
      
      // Pull request operations
      'listPullRequests': GitHubAgent.createToolAdapter(githubTools.github_listPullRequests),
      'createPullRequest': GitHubAgent.createToolAdapter(githubTools.github_createPullRequest),
      'getPullRequestInfo': GitHubAgent.createToolAdapter(githubTools.github_getPullRequestInfo),
      'updatePullRequest': GitHubAgent.createToolAdapter(githubTools.github_updatePullRequest),
      'mergePullRequest': GitHubAgent.createToolAdapter(githubTools.github_mergePullRequest),
      'closePR': GitHubAgent.createToolAdapter(githubTools.github_closePR),
      'checkPullRequestMergeability': GitHubAgent.createToolAdapter(githubTools.github_checkPullRequestMergeability),
      'getPullRequestFiles': GitHubAgent.createToolAdapter(githubTools.github_getPullRequestFiles),
      'getPullRequestFilesSummary': GitHubAgent.createToolAdapter(githubTools.github_getPullRequestFilesSummary),
      'listPRComments': GitHubAgent.createToolAdapter(githubTools.github_listPRComments),
      'addPRReviewers': GitHubAgent.createToolAdapter(githubTools.github_addPRReviewers),
      'approvePR': GitHubAgent.createToolAdapter(githubTools.github_approvePR),
      'requestChangesOnPR': GitHubAgent.createToolAdapter(githubTools.github_requestChangesOnPR),
      'commentOnPR': GitHubAgent.createToolAdapter(githubTools.github_commentOnPR),
      
      // Issue operations
      'listIssues': GitHubAgent.createToolAdapter(githubTools.github_listIssues),
      'getIssueDetails': GitHubAgent.createToolAdapter(githubTools.github_getIssueDetails),
      'createIssue': GitHubAgent.createToolAdapter(githubTools.github_createIssue),
      'updateIssue': GitHubAgent.createToolAdapter(githubTools.github_updateIssue),
      'closeIssue': GitHubAgent.createToolAdapter(githubTools.github_closeIssue),
      'addIssueComment': GitHubAgent.createToolAdapter(githubTools.github_addIssueComment),
      'addLabelsToIssue': GitHubAgent.createToolAdapter(githubTools.github_addLabelsToIssue),
      'listOrgIssues': GitHubAgent.createToolAdapter(githubTools.github_listOrgIssues),
      'listIssuesByAssignee': GitHubAgent.createToolAdapter(githubTools.github_listIssuesByAssignee),
      
      // Commit operations
      'listCommits': GitHubAgent.createToolAdapter(githubTools.github_listCommits),
      'getCommit': GitHubAgent.createToolAdapter(githubTools.github_getCommit),
      'getCommitComments': GitHubAgent.createToolAdapter(githubTools.github_getCommitComments),
      'createCommitComment': GitHubAgent.createToolAdapter(githubTools.github_createCommitComment),
      'getCommitStatuses': GitHubAgent.createToolAdapter(githubTools.github_getCommitStatuses),
      'getCommitCheckRuns': GitHubAgent.createToolAdapter(githubTools.github_getCommitCheckRuns),
      'getCommitSignatureVerification': GitHubAgent.createToolAdapter(githubTools.github_getCommitSignatureVerification),
      'revertCommit': GitHubAgent.createToolAdapter(githubTools.github_revertCommit),
      'deleteCommitComment': GitHubAgent.createToolAdapter(githubTools.github_deleteCommitComment),
      
      // Collaborator operations
      'listRepoCollaborators': GitHubAgent.createToolAdapter(githubTools.github_listRepoCollaborators),
      'addCollaborator': GitHubAgent.createToolAdapter(githubTools.github_addCollaborator),
      'removeCollaborator': GitHubAgent.createToolAdapter(githubTools.github_removeCollaborator),
      'listPendingInvitations': GitHubAgent.createToolAdapter(githubTools.github_listPendingInvitations),
      'listUserRepositoryInvitations': GitHubAgent.createToolAdapter(githubTools.github_listUserRepositoryInvitations),
      'acceptRepositoryInvitation': GitHubAgent.createToolAdapter(githubTools.github_acceptRepositoryInvitation),
      'declineRepositoryInvitation': GitHubAgent.createToolAdapter(githubTools.github_declineRepositoryInvitation),
      
      // Organization operations
      'listUserOrgs': GitHubAgent.createToolAdapter(githubTools.github_listUserOrgs),
      'listOrgMembers': GitHubAgent.createToolAdapter(githubTools.github_listOrgMembers),
      'listOrgOutsideCollaborators': GitHubAgent.createToolAdapter(githubTools.github_listOrgOutsideCollaborators),
      'listPendingOrgInvitations': GitHubAgent.createToolAdapter(githubTools.github_listPendingOrgInvitations),
      'getOrgBillingInfo': GitHubAgent.createToolAdapter(githubTools.github_getOrgBillingInfo),
      'listPrsByAssignee': GitHubAgent.createToolAdapter(githubTools.github_listPrsByAssignee),
      
      // Label operations
      'listLabels': GitHubAgent.createToolAdapter(githubTools.github_listLabels),
      'createLabel': GitHubAgent.createToolAdapter(githubTools.github_createLabel),
      'updateLabel': GitHubAgent.createToolAdapter(githubTools.github_updateLabel),
      'deleteLabel': GitHubAgent.createToolAdapter(githubTools.github_deleteLabel),
      
      // Project operations
      'listRepoProjects': GitHubAgent.createToolAdapter(githubTools.github_listRepoProjects),
      'listOrgProjects': GitHubAgent.createToolAdapter(githubTools.github_listOrgProjects),
      'getProject': GitHubAgent.createToolAdapter(githubTools.github_getProject),
      'createRepoProject': GitHubAgent.createToolAdapter(githubTools.github_createRepoProject),
      'createOrgProject': GitHubAgent.createToolAdapter(githubTools.github_createOrgProject),
      'updateProject': GitHubAgent.createToolAdapter(githubTools.github_updateProject),
      'deleteProject': GitHubAgent.createToolAdapter(githubTools.github_deleteProject),
      'listProjectColumns': GitHubAgent.createToolAdapter(githubTools.github_listProjectColumns),
      'addProjectCard': GitHubAgent.createToolAdapter(githubTools.github_addProjectCard),
      
      // Workflow operations
      'triggerWorkflow': GitHubAgent.createToolAdapter(githubTools.github_triggerWorkflow),
      'getWorkflowStatus': GitHubAgent.createToolAdapter(githubTools.github_getWorkflowStatus),
      'listWorkflowRuns': GitHubAgent.createToolAdapter(githubTools.github_listWorkflowRuns),
      
      // Stats operations
      'getCommitActivity': GitHubAgent.createToolAdapter(githubTools.github_getCommitActivity),
      'getContributorsStats': GitHubAgent.createToolAdapter(githubTools.github_getContributorsStats),
      
      // Gist operations
      'createGist': GitHubAgent.createToolAdapter(githubTools.github_createGist),
      'listGists': GitHubAgent.createToolAdapter(githubTools.github_listGists),
      'getGist': GitHubAgent.createToolAdapter(githubTools.github_getGist),
      'updateGist': GitHubAgent.createToolAdapter(githubTools.github_updateGist),
      'deleteGist': GitHubAgent.createToolAdapter(githubTools.github_deleteGist),
      'listPublicGists': GitHubAgent.createToolAdapter(githubTools.github_listPublicGists),
      'listUserGists': GitHubAgent.createToolAdapter(githubTools.github_listUserGists),
      
      // User operations
      'getUserProfile': GitHubAgent.createToolAdapter(githubTools.github_getUserProfile),
      
      // Comment operations
      'deleteIssueComment': GitHubAgent.createToolAdapter(githubTools.github_deleteIssueComment),
      'deletePRComment': GitHubAgent.createToolAdapter(githubTools.github_deletePRComment),
    };

    return { ...legacyMap, ...newToolsMap };
  }

  /**
   * Create system prompt that defines the agent's behavior
   * This helps the AI understand its role and how to interact with users
   */
  createSystemPrompt() {
    // Get current date dynamically
    const now = new Date();
    const currentDateStr = now.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return `You are a helpful GitHub AI Assistant that helps users interact with their GitHub data through natural language queries.

**CRITICAL LANGUAGE REQUIREMENT:**
- ALWAYS respond in the SAME LANGUAGE as the user's query
- If user writes in English, respond in English
- If user writes in Hindi, respond in Hindi
- If user writes in Spanish, respond in Spanish
- Match the user's language EXACTLY - do not translate or switch languages

**IMPORTANT - Current date is ${currentDateStr}**. Use this as reference for any date-related queries like commits "today", "this week", etc.

Your capabilities include:
- Checking GitHub connection status
- Retrieving profile information
- Listing repositories with various filters
- Getting commit history for specific repositories
- Finding issues and pull requests
- Checking notifications
- Getting detailed repository information
- Creating repositories, issues, pull requests, files, and branches
- Updating and deleting files
- Merging pull requests
- Adding comments to issues and PRs
- Managing collaborators and labels
- And many more GitHub operations

Guidelines:
1. Always be helpful and provide clear, concise responses
2. When users ask vague questions, clarify what specific information they need
3. For repository-specific queries, ask for the repository name if not provided
4. When users ask about a specific repository (e.g., "info about AutoDB repository"), ALWAYS assume it belongs to the authenticated user unless explicitly told otherwise. Use the user's GitHub username as the owner.
5. Only use external owners (like 'octocat') when users explicitly mention them (e.g., "octocat's Hello-World repository")
6. When users ask for repositories containing specific keywords in the NAME, ONLY show repositories whose names actually contain those keywords
7. When users ask for repositories "where [language] is used" or "written in [language]", filter by the programming language field, NOT the repository name
8. Distinguish between name-based searches ("repos with 'react' in the name") and language-based searches ("repos where Python is used")
9. Always verify that filtered results match the user's criteria before presenting them
10. Be accurate with counts - only count items that actually match the filter criteria
11. If no repositories match the filter criteria, clearly state that no matches were found
12. When users ask for a specific number of repositories (e.g., "show 10 repos", "recent 15 repositories"), use the per_page parameter to fetch exactly that many
13. Default to showing 10 repositories when users ask for "recent repositories" without specifying a number
14. Suggest related actions when appropriate
15. Handle errors gracefully and provide helpful error messages

IMPORTANT: When filtering repositories by name, be precise and only include repositories that actually contain the specified keywords in their names.
IMPORTANT: When users specify a number of repositories to show, always use that exact number in the per_page parameter.
IMPORTANT: When users ask about repositories "where [language] is used" or "written in [language]", they want to filter by programming language, not repository name.
CRITICAL: For repository-specific queries, always assume the repository belongs to the authenticated user unless explicitly told otherwise. Never default to 'octocat' or other external owners.

You can perform both read and write operations:
- Read: repositories, commits, issues, PRs, files, branches, etc.
- Write: create repositories, issues, PRs, files, branches; update/delete files; merge PRs; add comments; and more.

When performing write operations, be careful and confirm the user's intent. Always use the appropriate tool for the action requested.`;
  }

  /**
   * Main method to process user queries
   * This is the entry point for all user interactions with the agent
   * 
   * @param {string} query - Natural language query from the user
   * @param {string} userId - User ID for authentication
   * @param {Object} options - Additional options like repoCount, forceToolExecution
   * @returns {Promise<Object>} Processed response with GitHub data
   */
  async processQuery(query, userId, options = {}) {
    try {
      console.log(`Processing query: "${query}" for user: ${userId}`);

      // If forceToolExecution is set, directly execute the tool without LLM
      if (options.forceToolExecution && options.forceToolExecution.toolName && options.forceToolExecution.params) {
        console.log(`[GitHubAgent] Force executing tool: ${options.forceToolExecution.toolName}`);
        console.log(`[GitHubAgent] With exact params:`, JSON.stringify(options.forceToolExecution.params, null, 2));
        
        const functionToCall = this.functionMap[options.forceToolExecution.toolName];
        if (!functionToCall) {
          throw new Error(`Unknown function: ${options.forceToolExecution.toolName}`);
        }

        const normalizedArgs = await this.normalizeGithubArgs(userId, options.forceToolExecution.params, options);
        const result = await functionToCall(userId, normalizedArgs);
        
        let responseText = result.success ? `Successfully executed ${options.forceToolExecution.toolName}` : result.error;
        
        return {
          success: true,
          response: responseText,
          data: [{ tool: options.forceToolExecution.toolName, result: result, arguments: options.forceToolExecution.params }],
          tools_used: [{
            name: options.forceToolExecution.toolName,
            arguments: options.forceToolExecution.params,
            success: result.success
          }],
          raw_results: [result],
          query: query,
          timestamp: new Date().toISOString()
        };
      }

      // Create messages array for OpenAI chat completion with user context
      const githubUsername = options.githubUsername;
      const systemPromptWithUser = this.systemPrompt + (githubUsername ? 
        `\n\nCONTEXT: You are currently helping user '${githubUsername}'. When they ask about repositories without specifying an owner, assume they mean repositories owned by '${githubUsername}'.` : 
        '');

      const messages = [
        {
          role: "system",
          content: systemPromptWithUser
        },
        {
          role: "user",
          content: query
        }
      ];

      // Call OpenAI with function calling enabled
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Use GPT-4o mini for cost efficiency
        messages: messages,
        tools: this.tools,
        tool_choice: "auto", // Let OpenAI decide when to use tools
        max_tokens: 1500,
        temperature: 0.1 // Low temperature for more consistent responses
      });

      const message = response.choices[0].message;

      // Check if OpenAI wants to call any functions
      if (message.tool_calls && message.tool_calls.length > 0) {
        return await this.handleToolCalls(message.tool_calls, userId, query, options);
      } else {
        // No tools needed, return direct response
        return {
          success: true,
          response: message.content,
          query: query,
          tools_used: [],
          timestamp: new Date().toISOString()
        };
      }

    } catch (error) {
      console.error('Error processing query:', error);
      return this.handleError(error, query);
    }
  }

  /**
   * Execute tool calls requested by OpenAI
   * This method handles the actual execution of GitHub functions
   * 
   * @param {Array} toolCalls - Array of tool calls from OpenAI
   * @param {string} userId - User ID for authentication
   * @param {string} originalQuery - Original user query for context
   * @param {Object} options - Additional options like repoCount
   * @returns {Promise<Object>} Results from tool execution
   */
  async handleToolCalls(toolCalls, userId, originalQuery, options = {}) {
    const toolResults = [];
    const toolsUsed = [];

    try {
      // Execute each tool call
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const rawArgs = JSON.parse(toolCall.function.arguments);
        const functionArgs = await this.normalizeGithubArgs(userId, rawArgs, options);
        
        console.log(`Executing tool: ${functionName} with args:`, functionArgs);
        
        // Get the actual function implementation
        const functionToCall = this.functionMap[functionName];
        
        if (!functionToCall) {
          throw new Error(`Unknown function: ${functionName}`);
        }

        // Execute the function with userId as first parameter
        let result;
        if (functionName === 'getGithubCommits' || functionName === 'getGithubRepository') {
          // These functions need special parameter handling
          if (functionName === 'getGithubCommits') {
            result = await functionToCall(userId, functionArgs.repo, {
              page: functionArgs.page,
              per_page: functionArgs.per_page,
              author: functionArgs.author,
              since: functionArgs.since,
              until: functionArgs.until
            });
          } else if (functionName === 'getGithubRepository') {
            result = await functionToCall(userId, functionArgs.owner, functionArgs.repo);
          }
        } else if (functionName === 'getGithubRepos') {
          // Handle repository listing with repoCount from options
          const repoArgs = { ...functionArgs };
          if (options.repoCount) {
            repoArgs.per_page = Math.min(options.repoCount, 50); // Respect GitHub API limits
            console.log(`[GitHub Agent] Setting per_page to ${repoArgs.per_page} based on repoCount: ${options.repoCount}`);
          }
          console.log(`[GitHub Agent] Calling getGithubRepos with args:`, repoArgs);
          result = await functionToCall(userId, repoArgs);
          console.log(`[GitHub Agent] getGithubRepos returned ${result.data?.length || 0} repositories`);
        } else {
          // Standard functions that take userId and options
          result = await functionToCall(userId, functionArgs);
        }

        toolResults.push({
          tool: functionName,
          result: result,
          arguments: functionArgs
        });

        toolsUsed.push({
          name: functionName,
          arguments: functionArgs,
          success: result.success || true
        });
      }

      // Generate a natural language response based on the results
      const naturalResponse = await this.generateNaturalResponse(toolResults, originalQuery);

      return {
        success: true,
        response: naturalResponse,
        data: toolResults,
        tools_used: toolsUsed,
        raw_results: toolResults.map(tr => tr.result),  // Include raw results for artifact extraction
        query: originalQuery,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error executing tools:', error);
      return this.handleError(error, originalQuery, toolsUsed);
    }
  }

  /**
   * Generate a natural language response based on tool results
   * This makes the raw data more user-friendly
   * 
   * @param {Array} toolResults - Results from executed tools
   * @param {string} originalQuery - Original user query
   * @returns {Promise<string>} Natural language response
   */
  async generateNaturalResponse(toolResults, originalQuery) {
    try {
      // Create a summary of the results for the AI to process
      const resultSummary = toolResults.map(result => ({
        tool: result.tool,
        success: result.result.success,
        data: result.result.data, // Pass full data instead of truncated summary
        count: Array.isArray(result.result.data) ? result.result.data.length : 1
      }));

      const messages = [
        {
          role: "system",
          content: `You are helping to format GitHub data into a natural, user-friendly response.
                   Based on the tool results, provide a clear and helpful summary that directly answers the user's question.
                   Be concise but informative. If there are multiple results, organize them logically.
                   Always mention the key metrics or important information from the data.
                   
                   CRITICAL: When filtering repositories based on user query:
                   
                   For NAME-based searches ("repos with 'react' in the name"):
                   1. Only include repositories whose names actually contain those keywords
                   2. Filter the data carefully before presenting results
                   3. Provide accurate counts of matching repositories only
                   4. If no repositories match the criteria, clearly state "No repositories found with [keyword] in the name"
                   
                   For LANGUAGE-based searches ("repos where Python is used", "repositories written in JavaScript"):
                   1. Filter by the 'language' field in the repository data
                   2. Include all repositories where the primary language matches (case-insensitive)
                   3. Provide accurate counts of repositories using that language
                   4. If no repositories match, clearly state "No repositories found using [language]"
                   
                   Do not show unrelated repositories that don't match the specific filter criteria.`
        },
        {
          role: "user",
          content: `Original query: "${originalQuery}"
                   
                   Tool results: ${JSON.stringify(resultSummary, null, 2)}
                   
                   Please provide a natural language response that answers the user's question based on this data.
                   
                   FILTERING INSTRUCTIONS:
                   - If the query asks for repositories by LANGUAGE (e.g., "where Python is used"), filter by the 'language' field
                   - If the query asks for repositories by NAME keywords, filter by repository names
                   - If no filtering is requested, show ALL repositories returned
                   
                   Format repository lists with numbered list format:
                   1. **Repository Name**
                      - Privacy: Public/Private
                      - Stars: X | Forks: Y | Language: Z
                      - Last updated: Date
                      - Description: [if available]
                      - [View Repository](URL)
                   
                   Always include the accurate count of matching repositories.`
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        max_tokens: 2000, // Significantly increased for longer repository lists
        temperature: 0.3
      });

      return response.choices[0].message.content;

    } catch (error) {
      console.error('Error generating natural response:', error);
      // Fallback to basic summary if AI response fails
      return this.generateBasicSummary(toolResults);
    }
  }

  /**
   * Create a basic summary of tool results
   * Fallback method when AI-generated response fails
   * 
   * @param {Array} toolResults - Results from executed tools
   * @returns {string} Basic summary of results
   */
  generateBasicSummary(toolResults) {
    let summary = "Here's what I found:\n\n";
    
    toolResults.forEach(result => {
      if (result.result.success) {
        const data = result.result.data;
        switch (result.tool) {
          case 'getGithubProfile':
            summary += `📊 Profile: ${data.name || data.login} (${data.public_repos} repos, ${data.followers} followers)\n`;
            break;
          case 'getGithubRepos':
            console.log(`[GitHub Agent] generateBasicSummary: Found ${data.length} repositories`);
            summary += `📁 Found ${data.length} repositories\n`;
            break;
          case 'getGithubCommits':
            summary += `💻 Found ${data.length} commits for ${result.arguments.repo}\n`;
            break;
          case 'getGithubIssues':
            summary += `🐛 Found ${data.length} issues\n`;
            break;
          case 'getGithubPullRequests':
            summary += `🔄 Found ${data.length} pull requests\n`;
            break;
          case 'getGithubNotifications':
            summary += `🔔 Found ${data.length} notifications\n`;
            break;
          default:
            summary += `✅ ${result.tool} executed successfully\n`;
        }
      } else {
        summary += `❌ ${result.tool} failed\n`;
      }
    });

    return summary;
  }

  /**
   * Summarize data for AI processing
   * Creates concise summaries of large datasets
   * 
   * @param {Object} result - Tool execution result
   * @returns {Object} Summarized data
   */
  summarizeData(result) {
    if (!result.success || !result.data) {
      return { error: result.error || 'No data available' };
    }

    const data = result.data;

    // Handle different data types
    if (Array.isArray(data)) {
      return {
        count: data.length,
        items: data.map(item => ({
          name: item.name || item.title || item.login,
          date: item.created_at || item.updated_at,
          url: item.html_url,
          description: item.description,
          language: item.language,
          stars: item.stargazers_count,
          forks: item.forks_count,
          private: item.private
        }))
      };
    } else if (typeof data === 'object') {
      return {
        name: data.name || data.login || data.title,
        count: data.public_repos || data.total_count,
        date: data.created_at || data.updated_at,
        url: data.html_url
      };
    }

    return { summary: 'Data retrieved successfully' };
  }

  /**
   * Handle errors and provide user-friendly error messages
   * 
   * @param {Error} error - The error that occurred
   * @param {string} query - Original user query
   * @param {Array} toolsUsed - Tools that were used before error
   * @returns {Object} Error response
   */
  handleError(error, query, toolsUsed = []) {
    console.error('GitHub Agent Error:', error);

    let errorMessage = "I encountered an error while processing your request.";

    // Provide specific error messages based on error type
    if (error.message.includes('GitHub token')) {
      errorMessage = "It looks like your GitHub account isn't connected or your token has expired. Please reconnect your GitHub account.";
    } else if (error.message.includes('API Error')) {
      errorMessage = "There was an issue with the GitHub API. Please try again in a moment.";
    } else if (error.message.includes('Repository name')) {
      errorMessage = "I need a valid repository name to fetch that information. Please specify the repository in the format 'owner/repo'.";
    } else if (error.message.includes('OPENAI_API_KEY')) {
      errorMessage = "OpenAI API key is not configured. Please contact support.";
    }

    return {
      success: false,
      error: errorMessage,
      technical_error: error.message,
      query: query,
      tools_used: toolsUsed,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test the agent with sample queries
   * Useful for debugging and demonstration
   * 
   * @param {string} userId - User ID for testing
   */
  async runTests(userId) {
    console.log('\n🚀 Starting GitHub Agent Tests...\n');

    const testQueries = [
      "What's my GitHub connection status?",
      "Show me my GitHub profile",
      "List my repositories",
      "Show me my recent issues",
      "What are my latest pull requests?",
      "Check my GitHub notifications"
    ];

    for (const query of testQueries) {
      console.log(`\n📝 Testing query: "${query}"`);
      console.log('─'.repeat(50));
      
      try {
        const result = await this.processQuery(query, userId);
        console.log('✅ Result:', JSON.stringify(result, null, 2));
      } catch (error) {
        console.log('❌ Error:', error.message);
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n🏁 Tests completed!\n');
  }
}

module.exports = GitHubAgent;