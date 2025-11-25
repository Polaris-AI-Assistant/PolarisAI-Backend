// routes/githubAuth.js
const express = require("express");
const axios = require("axios");
const supabase = require("../supabase/supabaseConnect"); // <-- import supabase client
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Step 1: Get GitHub OAuth URL (API endpoint)
router.get("/url", authenticateToken, (req, res) => {
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  const clientId = process.env.GITHUB_CLIENT_ID;
  
  // Encode user ID in state parameter to maintain session
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo,user&state=${state}`;

  res.json({ authUrl: githubAuthUrl });
});

// Step 1: Redirect user to GitHub for authentication (legacy route)
router.get("/login", authenticateToken, (req, res) => {
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  const clientId = process.env.GITHUB_CLIENT_ID;
  
  // Encode user ID in state parameter to maintain session
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo,user&state=${state}`;

  res.redirect(githubAuthUrl);
});

// Step 2: GitHub redirects back with "code"
router.get("/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) {
    const errorUrl = `http://localhost:3001/auth/github/callback?error=${encodeURIComponent('missing_code')}&error_description=${encodeURIComponent('Missing authorization code from GitHub')}`;
    return res.redirect(errorUrl);
  }

  if (!state) {
    const errorUrl = `http://localhost:3001/auth/github/callback?error=${encodeURIComponent('missing_state')}&error_description=${encodeURIComponent('Missing state parameter')}`;
    return res.redirect(errorUrl);
  }

  try {
    // Decode user ID from state parameter
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const userId = stateData.userId;

    if (!userId) {
      const errorUrl = `http://localhost:3001/auth/github/callback?error=${encodeURIComponent('invalid_state')}&error_description=${encodeURIComponent('Invalid state parameter')}`;
      return res.redirect(errorUrl);
    }

    // Exchange code for access token
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const accessToken = tokenRes.data.access_token;

    if (!accessToken) {
      const errorUrl = `http://localhost:3001/auth/github/callback?error=${encodeURIComponent('token_error')}&error_description=${encodeURIComponent('Failed to get access token from GitHub')}`;
      return res.redirect(errorUrl);
    }

    // Fetch user profile to confirm integration
    const userRes = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const githubUser = userRes.data;

    // ✅ Save accessToken + githubUser info in Supabase
    console.log("Attempting to save GitHub token for user:", userId);
    console.log("GitHub user data:", {
      id: githubUser.id,
      login: githubUser.login,
      name: githubUser.name
    });

    const { data, error } = await supabase
      .from("github_tokens")
      .upsert(
        {
          user_id: userId, // comes from state parameter
          github_user_id: githubUser.id,
          github_username: githubUser.login,
          access_token: accessToken,
        },
        { onConflict: "user_id" } // ensures one row per user_id
      )
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      const errorUrl = `http://localhost:3001/auth/github/callback?error=${encodeURIComponent('database_error')}&error_description=${encodeURIComponent('Failed to save GitHub token')}`;
      return res.redirect(errorUrl);
    }

    console.log("Successfully saved GitHub token:", data);

    // Redirect to frontend callback with success
    const successUrl = `http://localhost:3001/auth/github/callback?success=true&username=${encodeURIComponent(githubUser.login)}`;
    res.redirect(successUrl);
  } catch (err) {
    console.error("GitHub OAuth callback error:", err);
    const errorUrl = `http://localhost:3001/auth/github/callback?error=${encodeURIComponent('authentication_failed')}&error_description=${encodeURIComponent(err.message || 'OAuth process failed')}`;
    res.redirect(errorUrl);
  }
});

// Step 3: Disconnect GitHub account
router.post("/disconnect", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const actualUserId = userId || req.user.id;

    console.log("Attempting to disconnect GitHub for user:", actualUserId);

    // First, get the access token to revoke it
    const { data: tokenData, error: fetchError } = await supabase
      .from("github_tokens")
      .select("access_token")
      .eq("user_id", actualUserId)
      .single();

    if (fetchError) {
      console.error("Error fetching GitHub token:", fetchError);
      return res.status(500).json({ 
        error: "Failed to fetch GitHub token for revocation", 
        details: fetchError.message 
      });
    }

    if (!tokenData) {
      return res.status(404).json({ 
        error: "GitHub token not found for user" 
      });
    }

    // Revoke the token with GitHub
    try {
      console.log("Revoking GitHub token...");
      
      // Method 1: Try to revoke using the applications endpoint
      await axios.delete(
        `https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/grant`, 
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString('base64')}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'FYP-App'
          },
          data: {
            access_token: tokenData.access_token
          }
        }
      );
      console.log("Successfully revoked GitHub token via applications endpoint");
    } catch (revokeError) {
      console.error("Error revoking GitHub token via applications endpoint:", revokeError.response?.data || revokeError.message);
      
      // Method 2: Try alternative revocation method
      try {
        console.log("Trying alternative token revocation method...");
        await axios.delete(
          `https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/token`,
          {
            headers: {
              'Authorization': `Basic ${Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString('base64')}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'FYP-App'
            },
            data: {
              access_token: tokenData.access_token
            }
          }
        );
        console.log("Successfully revoked GitHub token via token endpoint");
      } catch (altRevokeError) {
        console.error("Error with alternative revocation method:", altRevokeError.response?.data || altRevokeError.message);
        // Continue with deletion even if both revocation methods fail
        console.log("Continuing with database deletion despite both revocation errors");
      }
    }

    // Delete the token from our database
    const { error: deleteError } = await supabase
      .from("github_tokens")
      .delete()
      .eq("user_id", actualUserId);

    if (deleteError) {
      console.error("Supabase delete error:", deleteError);
      return res.status(500).json({ 
        error: "Failed to delete GitHub token from database", 
        details: deleteError.message 
      });
    }

    console.log("Successfully disconnected GitHub for user:", actualUserId);

    res.json({
      success: true,
      message: "GitHub account disconnected successfully. All data has been removed."
    });
  } catch (err) {
    console.error("GitHub disconnect error:", err);
    res.status(500).json({ error: "Failed to disconnect GitHub account" });
  }
});

module.exports = router;
