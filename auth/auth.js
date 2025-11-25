const express = require('express');
const supabase = require('../supabase/supabaseConnect');
const { isValidEmail, isValidPassword, validateRequiredFields, sanitizeInput } = require('../utils/validation');

const router = express.Router();

// Sign up with email and password
router.post('/signup', async (req, res) => {
  try {
    let { email, password, firstName, lastName } = req.body;

    // Validate required fields
    const missingFields = validateRequiredFields(req.body, ['email', 'password']);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Sanitize inputs
    email = sanitizeInput(email?.toLowerCase());
    firstName = sanitizeInput(firstName);
    lastName = sanitizeInput(lastName);

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (!isValidPassword(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long and contain both letters and numbers' 
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName || null,
          last_name: lastName || null,
        }
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        emailConfirmed: data.user?.email_confirmed_at ? true : false
      },
      session: data.session ? {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      } : null
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign in with email and password
router.post('/signin', async (req, res) => {
  try {
    let { email, password } = req.body;

    // Validate required fields
    const missingFields = validateRequiredFields(req.body, ['email', 'password']);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Sanitize email
    email = sanitizeInput(email?.toLowerCase());

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      message: 'Signed in successfully',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        emailConfirmed: data.user?.email_confirmed_at ? true : false,
        lastSignIn: data.user?.last_sign_in_at
      },
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at
      }
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Redirect to success page or send JSON response
    res.json({
      message: 'Authentication successful',
      user: data.user,
      session: data.session
    });
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign out
router.post('/signout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Signed out successfully' });
  } catch (err) {
    console.error('Signout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/user', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      message: 'Token refreshed successfully',
      session: data.session
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Password reset email sent' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update password
router.post('/update-password', async (req, res) => {
  try {
    const { password } = req.body;
    const authHeader = req.headers.authorization;

    if (!password) {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Set the auth token for this request
    supabase.auth.setSession({ access_token: token });

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;