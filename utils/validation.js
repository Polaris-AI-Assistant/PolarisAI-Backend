// Email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation (minimum 8 characters, at least one letter and one number)
function isValidPassword(password) {
  if (password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
}

// Validate required fields
function validateRequiredFields(data, requiredFields) {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      missing.push(field);
    }
  }
  
  return missing;
}

// Sanitize input (basic XSS prevention)
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove basic HTML tags
    .slice(0, 500); // Limit length
}

module.exports = {
  isValidEmail,
  isValidPassword,
  validateRequiredFields,
  sanitizeInput
};
