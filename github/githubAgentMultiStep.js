/**
 * GitHub Agent - Multi-Step Execution Version
 * Extends BaseAgent to support sequential multi-step operations.
 */

const BaseAgent = require('../base/BaseAgent');
const githubTools = require('../github-tools');
const OpenAI = require('openai');

class GitHubAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    const tools = {
      createRepository: {
        definition: {
          type: 'function',
          function: {
            name: 'createRepository',
            description: 'Create a new GitHub repository',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Repository name' },
                description: { type: 'string', description: 'Repository description' },
                private: { type: 'boolean', description: 'Whether the repo is private', default: false },
                auto_init: { type: 'boolean', description: 'Initialize with README', default: true }
              },
              required: ['name']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 📦 Creating repository: "${params.name}"`);
          try {
            const result = await githubTools.github_createRepo(params, context);
            if (!result.success) {
              throw new Error(result.error?.message || 'Failed to create repository');
            }
            console.log(`[GitHubAgent] ✅ Repository created: ${result.data.id}`);
            return {
              success: true,
              repoId: result.data.id,
              name: result.data.name,
              url: result.data.html_url,
              createdAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error creating repository:`, error.message);
            throw error;
          }
        }
      },

      createIssue: {
        definition: {
          type: 'function',
          function: {
            name: 'createIssue',
            description: 'Create a new GitHub issue',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                title: { type: 'string', description: 'Issue title' },
                body: { type: 'string', description: 'Issue description' },
                labels: { type: 'array', items: { type: 'string' }, description: 'Labels for the issue' }
              },
              required: ['owner', 'repo', 'title']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 🐛 Creating issue: "${params.title}"`);
          try {
            const result = await githubTools.github_createIssue(params, context);
            if (!result.success) {
              throw new Error(result.error?.message || 'Failed to create issue');
            }
            console.log(`[GitHubAgent] ✅ Issue created: ${result.data.id}`);
            return { success: true, issueId: result.data.id, issueNumber: result.data.number, url: result.data.html_url };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error creating issue:`, error.message);
            throw error;
          }
        }
      },

      createPullRequest: {
        definition: {
          type: 'function',
          function: {
            name: 'createPullRequest',
            description: 'Create a new GitHub pull request',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                title: { type: 'string', description: 'PR title' },
                body: { type: 'string', description: 'PR description' },
                head: { type: 'string', description: 'Source branch' },
                base: { type: 'string', description: 'Target branch', default: 'main' }
              },
              required: ['owner', 'repo', 'title', 'head']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 🔀 Creating pull request: "${params.title}"`);
          try {
            const result = await githubTools.github_createPR(params, context);
            if (!result.success) {
              throw new Error(result.error?.message || 'Failed to create pull request');
            }
            console.log(`[GitHubAgent] ✅ Pull request created: ${result.data.id}`);
            return { success: true, prId: result.data.id, prNumber: result.data.number, url: result.data.html_url };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error creating pull request:`, error.message);
            throw error;
          }
        }
      },

      addComment: {
        definition: {
          type: 'function',
          function: {
            name: 'addComment',
            description: 'Add a comment to an issue or pull request',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                issue_number: { type: 'number', description: 'Issue or PR number' },
                body: { type: 'string', description: 'Comment text' }
              },
              required: ['owner', 'repo', 'issue_number', 'body']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 💬 Adding comment to issue #${params.issue_number}`);
          try {
            const result = await githubTools.github_createIssueComment(params, context);
            if (!result.success) {
              throw new Error(result.error?.message || 'Failed to add comment');
            }
            console.log(`[GitHubAgent] ✅ Comment added successfully`);
            return { success: true, commentId: result.data.id, url: result.data.html_url };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error adding comment:`, error.message);
            throw error;
          }
        }
      },

      getRepositoryInfo: {
        definition: {
          type: 'function',
          function: {
            name: 'getRepositoryInfo',
            description: 'Get repository information including default branch and latest commit SHA',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' }
              },
              required: ['owner', 'repo']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 📖 Getting repository info: ${params.owner}/${params.repo}`);
          try {
            const result = await githubTools.github_getRepoInfo(params, context);
            if (!result.success) {
              throw new Error(result.error?.message || 'Failed to get repository info');
            }
            console.log(`[GitHubAgent] ✅ Repository info retrieved`);
            return {
              success: true,
              name: result.data.name,
              fullName: result.data.full_name,
              defaultBranch: result.data.default_branch,
              url: result.data.html_url,
              private: result.data.private,
              description: result.data.description
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error getting repository info:`, error.message);
            throw error;
          }
        }
      },

      listBranches: {
        definition: {
          type: 'function',
          function: {
            name: 'listBranches',
            description: 'List all branches in a repository',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                per_page: { type: 'number', description: 'Results per page (max 100)', default: 30 },
                page: { type: 'number', description: 'Page number', default: 1 }
              },
              required: ['owner', 'repo']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 🌿 Listing branches for ${params.owner}/${params.repo}`);
          try {
            const result = await githubTools.github_listBranches(params, context);
            if (!result.success) {
              throw new Error(result.error?.message || 'Failed to list branches');
            }
            console.log(`[GitHubAgent] ✅ Found ${result.data.length} branches`);
            return {
              success: true,
              branches: result.data.map(b => ({
                name: b.name,
                sha: b.commit.sha,
                protected: b.protected
              }))
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error listing branches:`, error.message);
            throw error;
          }
        }
      },

      createBranch: {
        definition: {
          type: 'function',
          function: {
            name: 'createBranch',
            description: 'Create a new branch from a specific commit SHA or from the default branch',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                branch: { type: 'string', description: 'New branch name (without refs/heads/ prefix)' },
                sha: { type: 'string', description: 'Commit SHA to branch from. If not provided, will use default branch HEAD' }
              },
              required: ['owner', 'repo', 'branch']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 🌱 Creating branch: ${params.branch}`);
          try {
            let sha = params.sha;
            
            // If no SHA provided, get the default branch HEAD
            if (!sha) {
              console.log(`[GitHubAgent] 📖 No SHA provided, getting default branch HEAD`);
              const repoInfo = await githubTools.github_getRepoInfo(
                { owner: params.owner, repo: params.repo },
                context
              );
              if (!repoInfo.success) {
                throw new Error('Failed to get repository info for default branch');
              }
              
              // Get the default branch to find its SHA
              const defaultBranch = repoInfo.data.default_branch;
              const branchInfo = await githubTools.github_listBranches(
                { owner: params.owner, repo: params.repo },
                context
              );
              if (!branchInfo.success) {
                throw new Error('Failed to get branch information');
              }
              
              const defaultBranchData = branchInfo.data.find(b => b.name === defaultBranch);
              if (!defaultBranchData) {
                throw new Error(`Default branch ${defaultBranch} not found`);
              }
              
              sha = defaultBranchData.commit.sha;
              console.log(`[GitHubAgent] 📍 Using SHA from ${defaultBranch}: ${sha}`);
            }

            // Create the branch with proper ref format
            const ref = `refs/heads/${params.branch}`;
            const result = await githubTools.github_createBranch(
              { owner: params.owner, repo: params.repo, ref, sha },
              context
            );
            
            if (!result.success) {
              throw new Error(result.error?.message || 'Failed to create branch');
            }
            
            console.log(`[GitHubAgent] ✅ Branch created: ${params.branch}`);
            return {
              success: true,
              branch: params.branch,
              ref: result.data.ref,
              sha: result.data.object.sha,
              url: result.data.url
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error creating branch:`, error.message);
            throw error;
          }
        }
      },

      deleteBranch: {
        definition: {
          type: 'function',
          function: {
            name: 'deleteBranch',
            description: 'Delete a branch from a repository',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                branch: { type: 'string', description: 'Branch name to delete (without refs/heads/ prefix)' }
              },
              required: ['owner', 'repo', 'branch']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 🗑️ Deleting branch: ${params.branch}`);
          try {
            const ref = `refs/heads/${params.branch}`;
            const result = await githubTools.github_deleteBranch(
              { owner: params.owner, repo: params.repo, ref },
              context
            );
            
            if (!result.success) {
              throw new Error(result.error?.message || 'Failed to delete branch');
            }
            
            console.log(`[GitHubAgent] ✅ Branch deleted: ${params.branch}`);
            return { success: true, branch: params.branch, deleted: true };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error deleting branch:`, error.message);
            throw error;
          }
        }
      }
    };

    super('GitHubAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  }

  getSystemPrompt() {
    const basePrompt = super.getSystemPrompt();
    return `${basePrompt}

GITHUB SPECIFIC GUIDELINES:

1. **Repository Creation**
   - Create repository first if user wants to create one
   - Include name and description

2. **Branch Management**
   - Use getRepositoryInfo to find the default branch and owner
   - Use listBranches to see existing branches
   - Use createBranch to create new branches (SHA is optional, will use default branch HEAD if not provided)
   - Use deleteBranch to remove branches

3. **Multi-Step Examples**
   
   Example 1: "Create a repository and add an issue"
   Step 1: createRepository({ name: "my-repo", description: "..." })
   Result: { repoId: "abc123", url: "..." }
   Step 2: createIssue({ owner: "...", repo: "my-repo", title: "First issue" })
   Result: { success: true }
   
   Example 2: "Create a dev branch in my-app repository"
   Step 1: getRepositoryInfo({ owner: "username", repo: "my-app" })
   Result: { defaultBranch: "main", ... }
   Step 2: createBranch({ owner: "username", repo: "my-app", branch: "dev" })
   Result: { success: true, branch: "dev", sha: "..." }

4. **Issue and PR Management**
   - Create issues for bug reports and features
   - Create pull requests for code changes
   - Add comments to discuss changes

5. **Important Notes**
   - When creating branches without a SHA, the tool will automatically use the default branch HEAD
   - Always get repository info first if you need to know the owner or default branch
   - Branch names should not include "refs/heads/" prefix (the tool handles this)`;
  }

  async processQuery(query, userId, options = {}) {
    console.log(`[GitHubAgent] 🚀 Processing query (multi-step): "${query}"`);
    const result = await super.processQuery(query, {
      userId: userId,
      conversationId: options.conversationId,
      maxIterations: options.maxIterations || 15,
      forceToolExecution: options.forceToolExecution  // ✅ CRITICAL: Pass forceToolExecution to BaseAgent
    });

    return {
      success: result.success,
      response: result.summary,
      tools_used: result.executedActions.map(a => ({ name: a.tool })),
      raw_results: result.executedActions.map(a => a.result),
      conversationHistory: options.conversationHistory || [],
      totalSteps: result.totalSteps,
      errors: result.errors
    };
  }
}

module.exports = GitHubAgentMultiStep;
