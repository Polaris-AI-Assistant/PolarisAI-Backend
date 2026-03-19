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
      getGithubProfile: {
        definition: {
          type: 'function',
          function: {
            name: 'getGithubProfile',
            description: 'Get the authenticated user\'s GitHub profile information including name, bio, followers, public repositories count, location, company, blog, and more. Use this when user asks about their profile, account details, or personal GitHub information.',
            parameters: {
              type: 'object',
              properties: {
                username: {
                  type: 'string',
                  description: 'Optional: GitHub username to get public profile. If not provided, returns the authenticated user\'s profile.'
                }
              },
              required: []
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 👤 Getting GitHub profile${params?.username ? ` for user: ${params.username}` : ' for authenticated user'}`);
          try {
            const result = await githubTools.github_getUserProfile(params || {}, context);
            if (!result.success) {
              throw new Error(result.error?.message || 'Failed to get profile');
            }
            const profile = result.data;
            return {
              success: true,
              profile: {
                username: profile.login,
                name: profile.name,
                bio: profile.bio,
                location: profile.location,
                company: profile.company,
                blog: profile.blog,
                followers: profile.followers,
                following: profile.following,
                publicRepos: profile.public_repos,
                publicGists: profile.public_gists,
                created: profile.created_at,
                updated: profile.updated_at,
                profileUrl: profile.html_url,
                avatarUrl: profile.avatar_url,
                email: profile.email,
                hireable: profile.hireable,
                twitterUsername: profile.twitter_username
              }
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error getting profile:`, error.message);
            throw error;
          }
        }
      },

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

      listRepositories: {
        definition: {
          type: 'function',
          function: {
            name: 'listRepositories',
            description: 'List repositories for the authenticated user',
            parameters: {
              type: 'object',
              properties: {
                page: { type: 'number', description: 'Page number for pagination', default: 1 },
                per_page: { type: 'number', description: 'Number of results per page (max 100)', default: 30 },
                sort: { type: 'string', description: 'Sort by: created, updated, pushed, full_name', default: 'updated' },
                type: { type: 'string', description: 'Filter by type: all, owner, public, private, member', default: 'all' },
                direction: { type: 'string', description: 'Sort direction: asc or desc', default: 'desc' }
              },
              required: []
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 📚 Listing repositories`);
          try {
            const result = await githubTools.github_listRepos(params, context);
            if (!result.success) {
              throw new Error(result.error?.message || 'Failed to list repositories');
            }
            console.log(`[GitHubAgent] ✅ Found ${result.data.length} repositories`);
            return {
              success: true,
              count: result.data.length,
              repositories: result.data.map(repo => ({
                name: repo.name,
                fullName: repo.full_name,
                description: repo.description,
                url: repo.html_url,
                private: repo.private,
                stars: repo.stargazers_count,
                language: repo.language,
                updatedAt: repo.updated_at
              }))
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error listing repositories:`, error.message);
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
      },

      // ==================== PULL REQUEST TOOLS ====================
      listPullRequests: {
        definition: {
          type: 'function',
          function: {
            name: 'listPullRequests',
            description: 'List pull requests in a repository',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                state: { type: 'string', description: 'Filter by state: open, closed, all', default: 'open' },
                sort: { type: 'string', description: 'Sort by: created, updated, popularity, long-running', default: 'created' },
                direction: { type: 'string', description: 'Sort direction: asc or desc', default: 'desc' },
                per_page: { type: 'number', description: 'Results per page (max 100)', default: 30 },
                page: { type: 'number', description: 'Page number', default: 1 }
              },
              required: ['owner', 'repo']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 📋 Listing pull requests for ${params.owner}/${params.repo}`);
          try {
            const result = await githubTools.github_listPullRequests(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to list PRs');
            console.log(`[GitHubAgent] ✅ Found ${result.data.length} PRs`);
            return {
              success: true,
              count: result.data.length,
              pullRequests: result.data.map(pr => ({
                number: pr.number,
                title: pr.title,
                state: pr.state,
                author: pr.user.login,
                url: pr.html_url,
                createdAt: pr.created_at,
                updatedAt: pr.updated_at
              }))
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error listing PRs:`, error.message);
            throw error;
          }
        }
      },

      getPullRequestInfo: {
        definition: {
          type: 'function',
          function: {
            name: 'getPullRequestInfo',
            description: 'Get detailed information about a specific pull request',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                pull_number: { type: 'number', description: 'Pull request number' }
              },
              required: ['owner', 'repo', 'pull_number']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 🔍 Getting PR info: #${params.pull_number}`);
          try {
            const result = await githubTools.github_getPullRequestInfo(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to get PR info');
            return {
              success: true,
              pr: {
                number: result.data.number,
                title: result.data.title,
                body: result.data.body,
                state: result.data.state,
                author: result.data.user.login,
                head: result.data.head.ref,
                base: result.data.base.ref,
                mergeable: result.data.mergeable,
                url: result.data.html_url
              }
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error getting PR info:`, error.message);
            throw error;
          }
        }
      },

      updatePullRequest: {
        definition: {
          type: 'function',
          function: {
            name: 'updatePullRequest',
            description: 'Update a pull request (title, body, or state)',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                pull_number: { type: 'number', description: 'Pull request number' },
                title: { type: 'string', description: 'New PR title' },
                body: { type: 'string', description: 'New PR description' },
                state: { type: 'string', description: 'New state: open or closed' }
              },
              required: ['owner', 'repo', 'pull_number']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] ✏️ Updating PR #${params.pull_number}`);
          try {
            const result = await githubTools.github_updatePullRequest(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to update PR');
            return {
              success: true,
              updated: true,
              pr: { number: result.data.number, title: result.data.title, state: result.data.state }
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error updating PR:`, error.message);
            throw error;
          }
        }
      },

      mergePullRequest: {
        definition: {
          type: 'function',
          function: {
            name: 'mergePullRequest',
            description: 'Merge a pull request',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                pull_number: { type: 'number', description: 'Pull request number' },
                commit_title: { type: 'string', description: 'Custom commit message title' },
                commit_message: { type: 'string', description: 'Custom commit message body' },
                merge_method: { type: 'string', description: 'Merge method: merge, squash, or rebase', default: 'merge' }
              },
              required: ['owner', 'repo', 'pull_number']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 🔀 Merging PR #${params.pull_number}`);
          try {
            const result = await githubTools.github_mergePullRequest(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to merge PR');
            return { success: true, merged: true, message: result.data.message };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error merging PR:`, error.message);
            throw error;
          }
        }
      },

      closePullRequest: {
        definition: {
          type: 'function',
          function: {
            name: 'closePullRequest',
            description: 'Close a pull request without merging',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                pull_number: { type: 'number', description: 'Pull request number' }
              },
              required: ['owner', 'repo', 'pull_number']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] ❌ Closing PR #${params.pull_number}`);
          try {
            const result = await githubTools.github_closePR(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to close PR');
            return { success: true, closed: true };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error closing PR:`, error.message);
            throw error;
          }
        }
      },

      getPullRequestFiles: {
        definition: {
          type: 'function',
          function: {
            name: 'getPullRequestFiles',
            description: 'Get files changed in a pull request',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                pull_number: { type: 'number', description: 'Pull request number' },
                per_page: { type: 'number', description: 'Results per page', default: 30 },
                page: { type: 'number', description: 'Page number', default: 1 }
              },
              required: ['owner', 'repo', 'pull_number']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 📄 Getting files changed in PR #${params.pull_number}`);
          try {
            const result = await githubTools.github_getPullRequestFiles(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to get PR files');
            return {
              success: true,
              fileCount: result.data.length,
              files: result.data.map(f => ({
                filename: f.filename,
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
                changes: f.changes
              }))
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error getting PR files:`, error.message);
            throw error;
          }
        }
      },

      addPullRequestReviewers: {
        definition: {
          type: 'function',
          function: {
            name: 'addPullRequestReviewers',
            description: 'Add reviewers to a pull request',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                pull_number: { type: 'number', description: 'Pull request number' },
                reviewers: { type: 'array', items: { type: 'string' }, description: 'GitHub usernames of reviewers' }
              },
              required: ['owner', 'repo', 'pull_number', 'reviewers']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 👥 Adding ${params.reviewers.length} reviewer(s) to PR #${params.pull_number}`);
          try {
            const result = await githubTools.github_addPRReviewers(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to add reviewers');
            return { success: true, reviewersAdded: params.reviewers.length };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error adding reviewers:`, error.message);
            throw error;
          }
        }
      },

      approvePullRequest: {
        definition: {
          type: 'function',
          function: {
            name: 'approvePullRequest',
            description: 'Approve a pull request',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                pull_number: { type: 'number', description: 'Pull request number' },
                body: { type: 'string', description: 'Optional approval comment' }
              },
              required: ['owner', 'repo', 'pull_number']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] ✅ Approving PR #${params.pull_number}`);
          try {
            const result = await githubTools.github_approvePR(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to approve PR');
            return { success: true, approved: true };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error approving PR:`, error.message);
            throw error;
          }
        }
      },

      requestPullRequestChanges: {
        definition: {
          type: 'function',
          function: {
            name: 'requestPullRequestChanges',
            description: 'Request changes on a pull request',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                pull_number: { type: 'number', description: 'Pull request number' },
                body: { type: 'string', description: 'Feedback message' }
              },
              required: ['owner', 'repo', 'pull_number', 'body']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 🔧 Requesting changes on PR #${params.pull_number}`);
          try {
            const result = await githubTools.github_requestChangesOnPR(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to request changes');
            return { success: true, requestSubmitted: true };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error requesting changes:`, error.message);
            throw error;
          }
        }
      },

      // ==================== FILE OPERATION TOOLS ====================
      listRepositoryContents: {
        definition: {
          type: 'function',
          function: {
            name: 'listRepositoryContents',
            description: 'List files and folders in a repository path',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                path: { type: 'string', description: 'File path (empty for root)', default: '' },
                ref: { type: 'string', description: 'Branch or tag name', default: 'main' }
              },
              required: ['owner', 'repo']
            }
          }
        },
        execute: async (params, context) => {
          params = this.applyResolvedRepo(params, context);
          console.log(`[GitHubAgent] 📂 Listing contents of ${params.owner}/${params.repo}${params.path || ''}`);
          try {
            const result = await githubTools.github_listRepoContents(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to list contents');
            return {
              success: true,
              itemCount: result.data.length,
              items: result.data.map(item => ({
                name: item.name,
                type: item.type,
                path: item.path,
                size: item.size,
                url: item.html_url
              }))
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error listing contents:`, error.message);
            throw error;
          }
        }
      },

      getFileContent: {
        definition: {
          type: 'function',
          function: {
            name: 'getFileContent',
            description: 'Get the content of a file from a repository',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                path: { type: 'string', description: 'File path in repository' },
                ref: { type: 'string', description: 'Branch or tag name', default: 'main' }
              },
              required: ['owner', 'repo', 'path']
            }
          }
        },
        execute: async (params, context) => {
          params = this.applyResolvedRepo(params, context);
          console.log(`[GitHubAgent] 📄 Getting file content: ${params.path}`);
          try {
            const result = await githubTools.github_getFileContent(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to get file content');
            const content = result.data.content || result.data.text || '';
            return {
              success: true,
              filename: result.data.name,
              size: result.data.size,
              content: content.substring(0, 5000) // Limit to 5000 chars
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error getting file:`, error.message);
            throw error;
          }
        }
      },

      createFile: {
        definition: {
          type: 'function',
          function: {
            name: 'createFile',
            description: 'Create a new file in a repository',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                path: { type: 'string', description: 'File path where to create file' },
                content: { type: 'string', description: 'File content' },
                message: { type: 'string', description: 'Commit message' },
                branch: { type: 'string', description: 'Branch name', default: 'main' }
              },
              required: ['owner', 'repo', 'path', 'content', 'message']
            }
          }
        },
        execute: async (params, context) => {
          params = this.applyResolvedRepo(params, context);
          console.log(`[GitHubAgent] 📝 Creating file: ${params.path}`);
          try {
            const result = await githubTools.github_createFile(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to create file');
            return {
              success: true,
              filename: params.path,
              url: result.data.content ? result.data.content.html_url : '',
              sha: result.data.content ? result.data.content.sha : ''
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error creating file:`, error.message);
            throw error;
          }
        }
      },

      updateFile: {
        definition: {
          type: 'function',
          function: {
            name: 'updateFile',
            description: 'Update (overwrite) a file in a repository',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                path: { type: 'string', description: 'File path to update' },
                content: { type: 'string', description: 'New file content' },
                message: { type: 'string', description: 'Commit message' },
                sha: { type: 'string', description: 'Current file SHA (get from getFileContent)' },
                branch: { type: 'string', description: 'Branch name', default: 'main' }
              },
              required: ['owner', 'repo', 'path', 'content', 'message', 'sha']
            }
          }
        },
        execute: async (params, context) => {
          params = this.applyResolvedRepo(params, context);
          console.log(`[GitHubAgent] ✏️ Updating file: ${params.path}`);
          try {
            const result = await githubTools.github_updateWholeFile(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to update file');
            return { success: true, filename: params.path, updated: true };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error updating file:`, error.message);
            throw error;
          }
        }
      },

      deleteFile: {
        definition: {
          type: 'function',
          function: {
            name: 'deleteFile',
            description: 'Delete a file from a repository',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                path: { type: 'string', description: 'File path to delete' },
                message: { type: 'string', description: 'Commit message' },
                sha: { type: 'string', description: 'File SHA (get from getFileContent)' },
                branch: { type: 'string', description: 'Branch name', default: 'main' }
              },
              required: ['owner', 'repo', 'path', 'message', 'sha']
            }
          }
        },
        execute: async (params, context) => {
          params = this.applyResolvedRepo(params, context);
          console.log(`[GitHubAgent] 🗑️ Deleting file: ${params.path}`);
          try {
            const result = await githubTools.github_deleteFile(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to delete file');
            return { success: true, filename: params.path, deleted: true };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error deleting file:`, error.message);
            throw error;
          }
        }
      },

      searchRepositoryCode: {
        definition: {
          type: 'function',
          function: {
            name: 'searchRepositoryCode',
            description: 'Search for code in a repository',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                q: { type: 'string', description: 'Search query (e.g., "function_name" or "TODO")' },
                per_page: { type: 'number', description: 'Results per page', default: 10 }
              },
              required: ['owner', 'repo', 'q']
            }
          }
        },
        execute: async (params, context) => {
          // Use resolved repo if available
          params = this.applyResolvedRepo(params, context);
          
          console.log(`[GitHubAgent] 🔍 Searching code in ${params.owner}/${params.repo} for "${params.q}"`);
          try {
            const result = await githubTools.github_searchRepoCode(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to search code');
            return {
              success: true,
              resultCount: result.data.total_count,
              items: result.data.items.slice(0, 5).map(item => ({
                filename: item.name,
                path: item.path,
                url: item.html_url
              }))
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error searching code:`, error.message);
            throw error;
          }
        }
      },

      // ==================== ISSUE MANAGEMENT TOOLS ====================
      listIssues: {
        definition: {
          type: 'function',
          function: {
            name: 'listIssues',
            description: "List the user's issues across all repositories",
            parameters: {
              type: 'object',
              properties: {
                filter: { type: 'string', description: 'Filter type: assigned, created, mentioned, subscribed', default: 'assigned' },
                state: { type: 'string', description: 'Filter by state: open, closed, all', default: 'open' },
                per_page: { type: 'number', description: 'Results per page', default: 30 },
                page: { type: 'number', description: 'Page number', default: 1 }
              },
              required: []
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 📋 Listing user's issues`);
          try {
            const result = await githubTools.github_listIssues(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to list issues');
            return {
              success: true,
              count: result.data.length,
              issues: result.data.slice(0, 10).map(issue => ({
                number: issue.number,
                title: issue.title,
                state: issue.state,
                repo: issue.repository.full_name,
                url: issue.html_url
              }))
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error listing issues:`, error.message);
            throw error;
          }
        }
      },

      getIssueDetails: {
        definition: {
          type: 'function',
          function: {
            name: 'getIssueDetails',
            description: 'Get detailed information about a specific issue',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                issue_number: { type: 'number', description: 'Issue number' }
              },
              required: ['owner', 'repo', 'issue_number']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 🔍 Getting issue details: #${params.issue_number}`);
          try {
            const result = await githubTools.github_getIssueDetails(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to get issue');
            return {
              success: true,
              issue: {
                number: result.data.number,
                title: result.data.title,
                body: result.data.body,
                state: result.data.state,
                createdBy: result.data.user.login,
                url: result.data.html_url
              }
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error getting issue:`, error.message);
            throw error;
          }
        }
      },

      updateIssue: {
        definition: {
          type: 'function',
          function: {
            name: 'updateIssue',
            description: 'Update an issue (title, body, state, labels, or assignees)',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                issue_number: { type: 'number', description: 'Issue number' },
                title: { type: 'string', description: 'New issue title' },
                body: { type: 'string', description: 'New issue body' },
                state: { type: 'string', description: 'New state: open or closed' },
                labels: { type: 'array', items: { type: 'string' }, description: 'Labels to add' },
                assignees: { type: 'array', items: { type: 'string' }, description: 'GitHub usernames to assign' }
              },
              required: ['owner', 'repo', 'issue_number']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] ✏️ Updating issue #${params.issue_number}`);
          try {
            const result = await githubTools.github_updateIssue(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to update issue');
            return { success: true, updated: true, issue: { number: result.data.number, state: result.data.state } };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error updating issue:`, error.message);
            throw error;
          }
        }
      },

      closeIssue: {
        definition: {
          type: 'function',
          function: {
            name: 'closeIssue',
            description: 'Close an issue',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                issue_number: { type: 'number', description: 'Issue number' }
              },
              required: ['owner', 'repo', 'issue_number']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] ❌ Closing issue #${params.issue_number}`);
          try {
            const result = await githubTools.github_closeIssue(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to close issue');
            return { success: true, closed: true };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error closing issue:`, error.message);
            throw error;
          }
        }
      },

      addLabelsToIssue: {
        definition: {
          type: 'function',
          function: {
            name: 'addLabelsToIssue',
            description: 'Add labels to an issue',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                issue_number: { type: 'number', description: 'Issue number' },
                labels: { type: 'array', items: { type: 'string' }, description: 'Labels to add' }
              },
              required: ['owner', 'repo', 'issue_number', 'labels']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 🏷️ Adding ${params.labels.length} label(s) to issue #${params.issue_number}`);
          try {
            const result = await githubTools.github_addLabelsToIssue(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to add labels');
            return { success: true, labelsAdded: params.labels.length };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error adding labels:`, error.message);
            throw error;
          }
        }
      },

      // ==================== COMMIT TOOLS ====================
      listCommits: {
        definition: {
          type: 'function',
          function: {
            name: 'listCommits',
            description: 'List commits in a repository',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                sha: { type: 'string', description: 'Branch or commit SHA to start from', default: 'main' },
                per_page: { type: 'number', description: 'Results per page', default: 30 },
                page: { type: 'number', description: 'Page number', default: 1 }
              },
              required: ['owner', 'repo']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 📜 Listing commits in ${params.owner}/${params.repo}`);
          try {
            const result = await githubTools.github_listCommits(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to list commits');
            return {
              success: true,
              commitCount: result.data.length,
              commits: result.data.slice(0, 10).map(commit => ({
                sha: commit.sha.substring(0, 7),
                author: commit.commit.author.name,
                message: commit.commit.message.split('\n')[0],
                date: commit.commit.author.date
              }))
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error listing commits:`, error.message);
            throw error;
          }
        }
      },

      getCommitDetails: {
        definition: {
          type: 'function',
          function: {
            name: 'getCommitDetails',
            description: 'Get detailed information about a specific commit',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                ref: { type: 'string', description: 'Commit SHA or ref name' }
              },
              required: ['owner', 'repo', 'ref']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] 🔍 Getting commit details: ${params.ref}`);
          try {
            const result = await githubTools.github_getCommit(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to get commit');
            return {
              success: true,
              commit: {
                sha: result.data.sha.substring(0, 7),
                author: result.data.commit.author.name,
                message: result.data.commit.message,
                date: result.data.commit.author.date,
                url: result.data.html_url
              }
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error getting commit:`, error.message);
            throw error;
          }
        }
      },

      getCommitStatuses: {
        definition: {
          type: 'function',
          function: {
            name: 'getCommitStatuses',
            description: 'Get status checks for a commit',
            parameters: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                ref: { type: 'string', description: 'Commit SHA or ref name' }
              },
              required: ['owner', 'repo', 'ref']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GitHubAgent] ✅ Getting commit status checks for ${params.ref}`);
          try {
            const result = await githubTools.github_getCommitStatuses(params, context);
            if (!result.success) throw new Error(result.error?.message || 'Failed to get statuses');
            return {
              success: true,
              state: result.data.state,
              statuses: result.data.statuses.map(s => ({
                context: s.context,
                state: s.state
              }))
            };
          } catch (error) {
            console.error(`[GitHubAgent] ❌ Error getting statuses:`, error.message);
            throw error;
          }
        }
      }
    };

    super('GitHubAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  }

  /**
   * Helper method to resolve repository name from natural language description.
   * Extracts repo name from a query like "my startup mvp builder repo" and finds the actual repo.
   * IMPORTANT: Only performs EXACT matches or very close matches to avoid incorrect repo resolution.
   * @param {string} query - User's query
   * @param {object} context - Context with userId
   * @returns {Promise<{owner: string, repo: string} | null>}
   */
  async resolveRepositoryFromQuery(query, context) {
    try {
      // Extract potential repo description from query
      // Look for patterns like "in <repo name> repo" or "<repo name>"
      const repoMatch = query.match(/(?:in|from|repo:)\s+([^,\.;]+?)(?:\s+repo)?(?:\s+repo|$|,|;)/i);
      const repoPhraseNormalized = repoMatch ? repoMatch[1].trim() : query.split('search')[1]?.trim() || query;
      
      console.log(`[GitHubAgent] 🔍 Attempting to resolve repo from phrase: "${repoPhraseNormalized}"`);
      
      // Get user's repos to find matching one
      const reposResult = await githubTools.github_listRepos(
        { per_page: 100 },
        context
      );
      
      if (!reposResult.success || !reposResult.data || reposResult.data.length === 0) {
        console.log(`[GitHubAgent] ⚠️ Could not list user repos`);
        return null;
      }
      
      // Try to find matching repo by name similarity
      const repos = reposResult.data;
      const normalizedPhrase = repoPhraseNormalized.toLowerCase().trim();
      
      // Exact match (with flexible separators like - and _)
      let matched = repos.find(r => {
        const repoNameNorm = r.name.toLowerCase().replace(/[_-]/g, ' ');
        return repoNameNorm === normalizedPhrase || r.name.toLowerCase() === normalizedPhrase;
      });
      
      // Very close substring match only if phrase is reasonably specific (3+ words or 20+ chars)
      if (!matched && (normalizedPhrase.split(/\s+/).length >= 3 || normalizedPhrase.length >= 20)) {
        const words = normalizedPhrase.split(/\s+/).filter(w => w.length > 3);
        if (words.length >= 2) {
          matched = repos.find(r => {
            const repoNameLower = r.name.toLowerCase();
            // Only match if at least 2 longer words are in the repo name
            const matchCount = words.filter(word => repoNameLower.includes(word)).length;
            return matchCount >= 2;
          });
        }
      }
      
      if (matched) {
        console.log(`[GitHubAgent] ✅ Resolved repo: ${matched.name}`);
        return {
          owner: matched.owner.login,
          repo: matched.name
        };
      }
      
      console.log(`[GitHubAgent] ⚠️ Could not find matching repo for "${repoPhraseNormalized}" - User needs to provide owner/repo explicitly`);
      return null;
    } catch (error) {
      console.error(`[GitHubAgent] ❌ Error resolving repo:`, error.message);
      return null;
    }
  }

  /**
   * Helper to use resolved repo in tool params if owner/repo are missing
   * @param {object} params - Tool parameters
   * @param {object} context - Context with optional resolvedRepo
   * @returns {object} Updated params
   */
  applyResolvedRepo(params, context) {
    if (context.resolvedRepo && (!params.owner || params.owner === 'undefined' || !params.repo || params.repo === 'undefined')) {
      console.log(`[GitHubAgent] 🔧 Applying resolved repo to tool params`);
      console.log(`   From - owner: ${params.owner}, repo: ${params.repo}`);
      console.log(`   To   - owner: ${context.resolvedRepo.owner}, repo: ${context.resolvedRepo.repo}`);
      return {
        ...params,
        owner: context.resolvedRepo.owner,
        repo: context.resolvedRepo.repo
      };
    }
    if (context.resolvedRepo && params.owner && params.repo) {
      console.log(`[GitHubAgent] ✅ Tool params already have owner/repo, not overriding`);
      console.log(`   Params - owner: ${params.owner}, repo: ${params.repo}`);
      console.log(`   Context has - owner: ${context.resolvedRepo.owner}, repo: ${context.resolvedRepo.repo}`);
    }
    return params;
  }

  getSystemPrompt() {
    const basePrompt = super.getSystemPrompt();
    return `${basePrompt}

GITHUB SPECIFIC GUIDELINES:

**CRITICAL: Repository Resolution - READ THIS FIRST**
   🔧 REPOSITORY RESOLUTION MARKER
   
   When you see "🔧 REPOSITORY RESOLVED: owner=..., repo=..." at the start of the query:
   1. This is CRITICAL system information, NOT user text
   2. The user's natural language repo name has been resolved to the actual repo name
   3. Extract the owner and repo values from this line (pattern: owner="VALUE", repo="VALUE")
   4. Use ONLY these values for ALL subsequent repository tool calls
   5. Do NOT try to interpret repo names from the user's message - use the resolved values
   6. If you call any tool that needs owner/repo params, use the resolved values exactly
   
   EXAMPLES:
   - If you see: 🔧 REPOSITORY RESOLVED: owner="Bhumi1729", repo="startup-mvp-builder"
     Then tool call must have: { owner: "Bhumi1729", repo: "startup-mvp-builder", ... }
   - Do NOT use: { owner: "Bhumi1729", repo: "my startup mvp builder", ... } ← WRONG
   - Do NOT use: { owner: "user", repo: "unknown", ... } ← WRONG
   
   NO RESOLUTION MARKER?
   - If there is no "🔧 REPOSITORY RESOLVED:" at the start, repo must be inferred from context
   - Ask user to clarify which repo if ambiguous
   - Use listRepositories tool to help identify the correct repo

1. **Repository Management**
   - listRepositories: Show user's repos (sort: updated, created, pushed)
   - createRepository: Create new repo with optional description
   - getRepositoryInfo: Get repo details (owner, default branch, etc.)

2. **Pull Request Workflow**
   - listPullRequests: List open/closed/all PRs in a repo
   - createPullRequest: Create new PR from one branch to another
   - getPullRequestInfo: Get PR details (state, mergeable, files changed)
   - updatePullRequest: Change PR title, body, or state
   - mergePullRequest: Merge PR (supports merge, squash, rebase)
   - closePullRequest: Close PR without merging
   - getPullRequestFiles: See files changed in PR
   - addPullRequestReviewers: Add reviewers to PR
   - approvePullRequest: Approve a PR
   - requestPullRequestChanges: Request changes on a PR

3. **File Operations**
   - listRepositoryContents: Browse repo files/folders
   - getFileContent: Read file content from repo
   - createFile: Create new file (includes commit message)
   - updateFile: Modify existing file (requires SHA)
   - deleteFile: Delete file (requires SHA)
   - searchRepositoryCode: Search for code patterns in repo

4. **Issue Management**
   - listIssues: List user's issues (assigned, created, mentioned)
   - getIssueDetails: Get issue information
   - createIssue: Create new issue
   - updateIssue: Change issue title, body, state, labels, assignees
   - closeIssue: Close an issue
   - addComment: Add comment to issue
   - addLabelsToIssue: Add labels to issue

5. **Branch Management**
   - listBranches: List all branches in repo
   - createBranch: Create new branch from base branch
   - deleteBranch: Delete branch
   - compareBranches: Compare two branches (shows diff)
   - protectBranch: Enable branch protection rules

6. **Commit Management**
   - listCommits: List commits on a branch
   - getCommitDetails: Get full commit info
   - getCommitStatuses: Check CI/CD status for commit
   - addComment: Add comment to commit

7. **Multi-Step Examples**
   
   Example 1: "Search in my startup mvp builder repo for market research agents"
   System prepends: 🔧 REPOSITORY RESOLVED: owner="Bhumi1729", repo="startup-mvp-builder"
   Correct action:
     searchRepositoryCode({
       owner: "Bhumi1729",     ← From resolution marker
       repo: "startup-mvp-builder",  ← From resolution marker (NOT "my startup mvp builder"!)
       q: "market research agents"
     })
   Result: Searches the CORRECT repo (startup-mvp-builder), NOT my-app or any other repo
   
   Example 2: "List files in my-app repo"
   System prepends: 🔧 REPOSITORY RESOLVED: owner="Bhumi1729", repo="my-app"
   Correct action:
     listRepositoryContents({
       owner: "Bhumi1729",
       repo: "my-app"      ← Exactly as specified in resolution marker
     })
   
   Example 3: "Update README in startup-mvp-builder"
   System prepends: 🔧 REPOSITORY RESOLVED: owner="Bhumi1729", repo="startup-mvp-builder"
   Step 1: getFileContent({ owner: "Bhumi1729", repo: "startup-mvp-builder", path: "README.md" })
   Step 2: updateFile({ owner: "Bhumi1729", repo: "startup-mvp-builder", path: "README.md", ... })
   
   KEY RULE: Always use owner/repo from resolution marker
   ✓ CORRECT: Use "startup-mvp-builder" from resolution marker
   ✗ WRONG: Use "my app" or "app" or "my-app" or any other variation
   ✗ WRONG: Mix repos (search in one repo, update in another)
   ✗ WRONG: Ignore resolution marker and guess the repo

8. **Important Notes**
   - File operations require SHA (get from getFileContent)
   - Branch names don't need "refs/heads/" prefix
   - PR merge_method can be: merge, squash, or rebase
   - Always verify repo owner/name before operations
   - Commit status checks show build/test results`;
  }

  async processQuery(query, userIdOrContext, options = {}) {
    console.log(`[GitHubAgent] 🚀 Processing query (multi-step): "${query}"`);
    
    // Detect which signature is being used
    let context;
    if (typeof userIdOrContext === 'string') {
      context = {
        userId: userIdOrContext,
        conversationId: options.conversationId,
        maxIterations: options.maxIterations || 15,
        forceToolExecution: options.forceToolExecution,
        conversationHistory: options.conversationHistory
      };
    } else if (typeof userIdOrContext === 'object') {
      context = userIdOrContext;
    } else {
      throw new Error(`Invalid processQuery signature`);
    }
    
    // Pre-process: If query mentions "repo", resolve the actual repo name
    if (query.toLowerCase().includes('repo') || query.toLowerCase().includes('repository')) {
      console.log(`[GitHubAgent] 📋 Query mentions repository, attempting to resolve...`);
      const resolved = await this.resolveRepositoryFromQuery(query, context);
      if (resolved) {
        console.log(`[GitHubAgent] ✅ Pre-resolved repo: ${resolved.owner}/${resolved.repo}`);
        console.log(`[GitHubAgent] 📊 Context.resolvedRepo set to:`, resolved);
        // Store resolved repo in context for tools to use
        context.resolvedRepo = resolved;
        
        // IMPORTANT: Prepend resolved repo info to query so LLM sees it clearly
        // Format as simple key-value pairs for easy parsing
        const repoInfo = `🔧 REPOSITORY RESOLVED: owner="${resolved.owner}", repo="${resolved.repo}"\n` +
                         `⚠️ Use THESE EXACT VALUES for all repository tool calls below.\n` +
                         `⚠️ Do NOT use the user's natural language repo name ("${query.match(/(?:in|from|repo:)\s+([^,\.;]+?)(?:\s+repo)?/i)?.[1] || 'unknown'}") - use the resolved values only.\n`;
        const oldQuery = query;
        query = repoInfo + query;
        console.log(`[GitHubAgent] 📝 Prepended resolved repo info to query`);
        console.log(`[GitHubAgent] 🔍 Original query: "${oldQuery.substring(0, 80)}${oldQuery.length > 80 ? '...' : ''}"`);
        console.log(`[GitHubAgent] 🔍 New query prefix: "${repoInfo.substring(0, 120)}${repoInfo.length > 120 ? '...' : ''}"`);
      } else {
        console.log(`[GitHubAgent] ⚠️ Repository resolution failed - proceeding without resolved repo`);
      }
    }
    
    const result = await super.processQuery(query, context);

    return {
      success: result.success,
      response: result.summary,
      tools_used: result.executedActions.map(a => ({ name: a.tool })),
      raw_results: result.executedActions.map(a => a.result),
      conversationHistory: context.conversationHistory || [],
      totalSteps: result.totalSteps,
      errors: result.errors
    };
  }
}

module.exports = GitHubAgentMultiStep;
