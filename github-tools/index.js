/**
 * GitHub Tools Layer – single entry point for all GitHub tool wrappers.
 * Each tool: (params, context) => Promise<{ success, data, error }>.
 * Context must include userId for token lookup.
 * @module github-tools
 */

const repo = require('./repo');
const files = require('./files');
const branches = require('./branches');
const pulls = require('./pulls');
const issues = require('./issues');
const commits = require('./commits');
const collaborators = require('./collaborators');
const orgs = require('./orgs');
const labels = require('./labels');
const projects = require('./projects');
const workflows = require('./workflows');
const stats = require('./stats');
const gists = require('./gists');
const users = require('./users');
const comments = require('./comments');

const allTools = {
  ...repo,
  ...files,
  ...branches,
  ...pulls,
  ...issues,
  ...commits,
  ...collaborators,
  ...orgs,
  ...labels,
  ...projects,
  ...workflows,
  ...stats,
  ...gists,
  ...users,
  ...comments,
};

module.exports = allTools;
module.exports.repo = repo;
module.exports.files = files;
module.exports.branches = branches;
module.exports.pulls = pulls;
module.exports.issues = issues;
module.exports.commits = commits;
module.exports.collaborators = collaborators;
module.exports.orgs = orgs;
module.exports.labels = labels;
module.exports.projects = projects;
module.exports.workflows = workflows;
module.exports.stats = stats;
module.exports.gists = gists;
module.exports.users = users;
module.exports.comments = comments;
