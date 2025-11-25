/**
 * Simulate language filtering logic without OpenAI API
 */

// Simulate repository data from the debug test
const mockRepositories = [
  { name: 'nexora-ui-website', language: 'JavaScript', stargazers_count: 0, private: false },
  { name: 'docs', language: null, stargazers_count: 1, private: false },
  { name: 'Personalised-Content-Dashboard', language: 'Python', stargazers_count: 2, private: false },
  { name: 'telecalling_backend', language: 'Python', stargazers_count: 0, private: true },
  { name: 'telecalling_frontend', language: 'JavaScript', stargazers_count: 0, private: true },
  { name: 'nexora-ui', language: 'TypeScript', stargazers_count: 0, private: true },
  { name: 'Autodb.AI', language: 'Python', stargazers_count: 5, private: false },
  { name: 'Fly-Your-Tech-Assignment', language: 'JavaScript', stargazers_count: 1, private: false },
  { name: 'Password-Manager-using-ECC', language: 'Python', stargazers_count: 3, private: false },
  { name: 'ECC-Based-Password-Manager', language: 'C++', stargazers_count: 2, private: false }
];

function filterRepositoriesByLanguage(repos, language) {
  const targetLanguage = language.toLowerCase();
  return repos.filter(repo => 
    repo.language && repo.language.toLowerCase() === targetLanguage
  );
}

function filterRepositoriesByName(repos, keyword) {
  const targetKeyword = keyword.toLowerCase();
  return repos.filter(repo => 
    repo.name.toLowerCase().includes(targetKeyword)
  );
}

function formatRepositoryList(repos, filterType, filterValue) {
  if (repos.length === 0) {
    if (filterType === 'language') {
      return `No repositories found using ${filterValue}.`;
    } else {
      return `No repositories found with '${filterValue}' in the name.`;
    }
  }

  let header = '';
  if (filterType === 'language') {
    header = `Found ${repos.length} repositories using ${filterValue}:\n\n`;
  } else if (filterType === 'name') {
    header = `Found ${repos.length} repositories with '${filterValue}' in the name:\n\n`;
  } else {
    header = `Found ${repos.length} repositories:\n\n`;
  }

  const repoList = repos.map((repo, index) => {
    const stars = repo.stargazers_count ? `⭐ ${repo.stargazers_count}` : '';
    const language = repo.language ? `📝 ${repo.language}` : '';
    const privacy = repo.private ? '🔒 Private' : '🌍 Public';
    
    return `${index + 1}. **${repo.name}** ${privacy}\n   ${stars} ${language}`;
  }).join('\n\n');

  return header + repoList;
}

console.log('=== Simulating Language-Based Repository Filtering ===\n');

// Test 1: Python language filter
console.log('--- Test 1: "Show all repositories where Python is used" ---');
const pythonRepos = filterRepositoriesByLanguage(mockRepositories, 'Python');
console.log(formatRepositoryList(pythonRepos, 'language', 'Python'));

// Test 2: JavaScript language filter
console.log('\n--- Test 2: "List repositories written in JavaScript" ---');
const jsRepos = filterRepositoriesByLanguage(mockRepositories, 'JavaScript');
console.log(formatRepositoryList(jsRepos, 'language', 'JavaScript'));

// Test 3: Name-based filter for comparison
console.log('\n--- Test 3: "Show repositories with password in the name" ---');
const passwordRepos = filterRepositoriesByName(mockRepositories, 'password');
console.log(formatRepositoryList(passwordRepos, 'name', 'password'));

// Test 4: Language not found
console.log('\n--- Test 4: "Show repositories using PHP" ---');
const phpRepos = filterRepositoriesByLanguage(mockRepositories, 'PHP');
console.log(formatRepositoryList(phpRepos, 'language', 'PHP'));

console.log('\n=== Summary ===');
console.log(`Total repositories: ${mockRepositories.length}`);
console.log(`Python repositories: ${pythonRepos.length}`);
console.log(`JavaScript repositories: ${jsRepos.length}`);
console.log(`Repositories with 'password' in name: ${passwordRepos.length}`);