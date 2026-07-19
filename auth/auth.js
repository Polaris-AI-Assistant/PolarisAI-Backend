const express = require('express');
const supabase = require('../supabase/supabaseConnect');
const { isValidEmail, isValidPassword, validateRequiredFields, sanitizeInput } = require('../utils/validation');

const router = express.Router();

// Step 1: Send OTP for signup (creates user and sends OTP)
router.post('/signup/send-otp', async (req, res) => {
  try {
    let { email, fullName, password } = req.body;

    // Validate required fields
    const missingFields = validateRequiredFields(req.body, ['email', 'password', 'fullName']);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Sanitize inputs
    email = sanitizeInput(email?.toLowerCase());
    fullName = sanitizeInput(fullName);

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

    // First, create the user with password
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: {
          full_name: fullName,
        }
      }
    });

    if (signUpError) {
      return res.status(400).json({ error: signUpError.message });
    }

    // Then send OTP for email verification
    const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // User already created above
      },
    });

    if (otpError) {
      console.error('OTP send error:', otpError);
      // User is created but OTP failed - still return success
    }

    res.status(201).json({
      message: 'OTP sent to your email',
      email: email,
      userId: signUpData.user?.id,
    });
  } catch (err) {
    console.error('Signup OTP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Step 2: Verify OTP and complete signup with metadata
router.post('/signup/verify-otp', async (req, res) => {
  try {
    let { email, token, metadata } = req.body;

    // Validate required fields
    if (!email || !token) {
      return res.status(400).json({ 
        error: 'Email and OTP token are required' 
      });
    }

    // Sanitize email
    email = sanitizeInput(email?.toLowerCase());

    // Verify OTP
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Update user metadata if provided
    if (metadata && data.session) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: metadata.fullName || null,
          use_cases: metadata.useCases || [],
          user_type: metadata.userType || null,
          onboarding_completed: false,
        }
      });

      if (updateError) {
        console.error('Metadata update error:', updateError);
      }
    }

    // ✅ Initialize credits for new user
    try {
      const { data: creditResult, error: creditError } = await supabase.rpc('initialize_user_credits', {
        p_user_id: data.user?.id
      });
      
      if (creditError) {
        console.error('[Auth] Failed to initialize credits:', creditError);
        // Don't fail signup if credit initialization fails
      } else if (creditResult?.success) {
        console.log(`[Auth] ✅ Initialized ${creditResult.balance} credits for user ${data.user?.id}`);
      } else {
        console.log('[Auth] ℹ️ Credits already initialized or skipped:', creditResult?.message);
      }
    } catch (creditInitError) {
      console.error('[Auth] Error initializing credits:', creditInitError);
      // Don't fail signup if credit initialization fails
    }

    res.status(200).json({
      message: 'Email verified successfully',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        emailConfirmed: true,
        first_name: data.user?.user_metadata?.first_name || data.user?.user_metadata?.full_name?.split(' ')[0] || '',
        last_name: data.user?.user_metadata?.last_name || data.user?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
        display_name: data.user?.user_metadata?.display_name || data.user?.user_metadata?.full_name || data.user?.user_metadata?.first_name || '',
        metadata: data.user?.user_metadata,
      },
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_in: data.session?.expires_in,
        expires_at: data.session?.expires_at,
        token_type: data.session?.token_type,
      }
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend OTP
router.post('/signup/resend-otp', async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Sanitize email
    email = sanitizeInput(email?.toLowerCase());

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'OTP resent successfully',
      email: email,
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
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
        lastSignIn: data.user?.last_sign_in_at,
        first_name: data.user?.user_metadata?.first_name || data.user?.user_metadata?.full_name?.split(' ')[0] || '',
        last_name: data.user?.user_metadata?.last_name || data.user?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
        display_name: data.user?.user_metadata?.display_name || data.user?.user_metadata?.full_name || data.user?.user_metadata?.first_name || ''
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


// Google OAuth Sign In/Sign Up
router.get('/google', async (req, res) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        skipBrowserRedirect: true, // Return URL instead of redirecting
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Return the OAuth URL to the frontend
    res.json({
      url: data.url,
      provider: data.provider
    });
  } catch (err) {
    console.error('Google OAuth error:', err);
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
      user: {
        id: data.user?.id,
        email: data.user?.email,
        emailConfirmed: data.user?.email_confirmed_at ? true : false,
        lastSignIn: data.user?.last_sign_in_at,
        first_name: data.user?.user_metadata?.first_name || data.user?.user_metadata?.full_name?.split(' ')[0] || '',
        last_name: data.user?.user_metadata?.last_name || data.user?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
        display_name: data.user?.user_metadata?.display_name || data.user?.user_metadata?.full_name || data.user?.user_metadata?.first_name || ''
      },
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