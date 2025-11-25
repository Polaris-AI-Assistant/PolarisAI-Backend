const express = require('express');
const { getGmailMessages, storeGmailMessages } = require('./gmailService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Route to check Gmail connection status
router.get('/gmail/connection/:userIdentifier', async (req, res) => {
  try {
    const { userIdentifier } = req.params;
    const supabase = require('../supabase/supabaseConnect');
    
    // Check if user has Gmail tokens
    let query = supabase.from('gmail_tokens').select('email, expiry_date, created_at');
    
    if (userIdentifier.includes('@')) {
      query = query.eq('email', userIdentifier);
    } else {
      query = query.eq('user_id', userIdentifier);
    }
    
    const { data, error } = await query.single();
    
    if (error || !data) {
      return res.json({
        connected: false,
        message: 'Gmail not connected for this user'
      });
    }
    
    const isExpired = data.expiry_date ? Date.now() > data.expiry_date : false;
    
    res.json({
      connected: true,
      email: data.email,
      isExpired,
      connectedAt: data.created_at,
      message: isExpired ? 'Gmail connected but tokens expired' : 'Gmail connected successfully'
    });
  } catch (error) {
    console.error('Connection check error:', error);
    res.status(500).json({ error: 'Failed to check Gmail connection status' });
  }
});

// Route to fetch and store Gmail messages for a user
router.get('/gmail/:userIdentifier', async (req, res) => {
  try {
    const { userIdentifier } = req.params;
    const result = await storeGmailMessages(userIdentifier);
    
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    res.json({
      message: `✅ Stored ${result.count} Gmail messages for user ${userIdentifier}`,
      count: result.count,
      messages: result.messages
    });
  } catch (error) {
    console.error('Gmail fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch Gmail messages' });
  }
});

// Route to get stored Gmail messages for a user
router.get('/gmail/:userIdentifier/messages', async (req, res) => {
  try {
    const { userIdentifier } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const supabase = require('../supabase/supabaseConnect');
    
    // Build query based on whether userIdentifier is email or user_id
    let query = supabase.from('gmail_messages').select('*');
    
    if (userIdentifier.includes('@')) {
      query = query.eq('user_email', userIdentifier);
    } else {
      query = query.eq('user_id', userIdentifier);
    }
    
    const { data, error } = await query
      .order('date', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      messages: data,
      count: data.length,
      total_count: data.length // You might want to get actual count with a separate query
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get Gmail messages' });
  }
});

// Route to search Gmail messages
router.get('/gmail/:userIdentifier/search', async (req, res) => {
  try {
    const { userIdentifier } = req.params;
    const { query, sender, subject, limit = 50 } = req.query;
    
    const supabase = require('../supabase/supabaseConnect');
    
    // Build base query
    let searchQuery = supabase.from('gmail_messages').select('*');
    
    // Add user filter
    if (userIdentifier.includes('@')) {
      searchQuery = searchQuery.eq('user_email', userIdentifier);
    } else {
      searchQuery = searchQuery.eq('user_id', userIdentifier);
    }

    // Add search filters
    if (query) {
      searchQuery = searchQuery.or(`snippet.ilike.%${query}%,body.ilike.%${query}%,subject.ilike.%${query}%`);
    }
    
    if (sender) {
      searchQuery = searchQuery.ilike('sender', `%${sender}%`);
    }
    
    if (subject) {
      searchQuery = searchQuery.ilike('subject', `%${subject}%`);
    }

    const { data, error } = await searchQuery
      .order('date', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      messages: data,
      count: data.length,
      searchParams: { query, sender, subject }
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Failed to search Gmail messages' });
  }
});

// Route to get Gmail statistics for a user
router.get('/gmail/:userIdentifier/stats', async (req, res) => {
  try {
    const { userIdentifier } = req.params;
    const supabase = require('../supabase/supabaseConnect');
    
    // Build query based on whether userIdentifier is email or user_id
    let baseFilter = {};
    if (userIdentifier.includes('@')) {
      baseFilter.user_email = userIdentifier;
    } else {
      baseFilter.user_id = userIdentifier;
    }
    
    // Get total count
    const { count: totalCount } = await supabase
      .from('gmail_messages')
      .select('*', { count: 'exact', head: true })
      .match(baseFilter);
    
    // Get count by labels (if needed)
    const { data: labelStats, error: labelError } = await supabase
      .from('gmail_messages')
      .select('labels')
      .match(baseFilter);
    
    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { count: recentCount } = await supabase
      .from('gmail_messages')
      .select('*', { count: 'exact', head: true })
      .match(baseFilter)
      .gte('date', sevenDaysAgo.toISOString());

    if (labelError) {
      console.error('Label stats error:', labelError);
    }

    res.json({
      totalMessages: totalCount || 0,
      recentMessages: recentCount || 0,
      stats: {
        totalCount: totalCount || 0,
        last7Days: recentCount || 0,
        // You can add more stats here like top senders, etc.
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get Gmail statistics' });
  }
});

module.exports = router;
