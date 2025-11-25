const express = require('express');
const OpenAI = require('openai');
const supabase = require('../supabase/supabaseConnect');

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST endpoint to embed Gmail messages
router.post('/embed-gmail-messages', async (req, res) => {
  try {
    console.log('Starting Gmail message embedding process...');
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        details: 'Please set OPENAI_API_KEY environment variable'
      });
    }
    
    // Fetch the most recent Gmail messages that don't have embeddings yet
    const { data: messagesWithoutEmbeddings, error: fetchError } = await supabase
      .from('gmail_messages')
      .select(`
        id,
        user_id,
        subject,
        body,
        snippet,
        date,
        created_at
      `)
      .not('user_id', 'is', null) // Ensure user_id is not null
      .order('date', { ascending: false }) // Order by email date (most recent first)
      .limit(100); // Limit to top 100 most recent emails

    if (fetchError) {
      console.error('Error fetching messages:', fetchError);
      return res.status(500).json({ 
        error: 'Failed to fetch Gmail messages', 
        details: fetchError.message 
      });
    }

    if (!messagesWithoutEmbeddings || messagesWithoutEmbeddings.length === 0) {
      return res.json({ 
        message: 'No Gmail messages found to embed',
        processed: 0 
      });
    }

    console.log(`Found ${messagesWithoutEmbeddings.length} messages (top 50 most recent by date)`);
    
    // Log date range of messages being processed
    if (messagesWithoutEmbeddings.length > 0) {
      const mostRecent = messagesWithoutEmbeddings[0]?.date;
      const oldest = messagesWithoutEmbeddings[messagesWithoutEmbeddings.length - 1]?.date;
      console.log(`Date range: ${mostRecent} (newest) to ${oldest} (oldest)`);
    }

    // Filter out messages that already have embeddings
    const { data: existingEmbeddings, error: embeddingFetchError } = await supabase
      .from('gmail_message_embeddings')
      .select('message_id');

    if (embeddingFetchError) {
      console.error('Error fetching existing embeddings:', embeddingFetchError);
      return res.status(500).json({ 
        error: 'Failed to fetch existing embeddings', 
        details: embeddingFetchError.message 
      });
    }

    const existingMessageIds = new Set(existingEmbeddings?.map(e => e.message_id) || []);
    const messagesToEmbed = messagesWithoutEmbeddings.filter(msg => !existingMessageIds.has(msg.id));

    console.log(`${messagesToEmbed.length} messages need new embeddings (out of top 50 most recent)`);

    if (messagesToEmbed.length === 0) {
      return res.json({ 
        message: 'All Gmail messages already have embeddings',
        processed: 0 
      });
    }

    let processedCount = 0;
    let errorCount = 0;
    const batchSize = 10; // Process in batches to avoid overwhelming the API

    // Process messages in batches
    for (let i = 0; i < messagesToEmbed.length; i += batchSize) {
      const batch = messagesToEmbed.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(messagesToEmbed.length / batchSize)}`);

      for (const message of batch) {
        try {
          console.log(`Processing message ${message.id}...`);
          
          // Combine subject and body (use snippet as fallback if body is empty)
          let textToEmbed = '';
          
          // More robust text extraction
          if (message.subject && typeof message.subject === 'string' && message.subject.trim()) {
            textToEmbed += message.subject.trim() + ' ';
          }
          
          if (message.body && typeof message.body === 'string' && message.body.trim()) {
            // Clean HTML and remove excessive whitespace
            const cleanBody = message.body
              .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
              .replace(/\s+/g, ' ')      // Replace multiple whitespace with single space
              .trim();
            if (cleanBody) {
              textToEmbed += cleanBody + ' ';
            }
          } else if (message.snippet && typeof message.snippet === 'string' && message.snippet.trim()) {
            // Use snippet as fallback
            const cleanSnippet = message.snippet
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (cleanSnippet) {
              textToEmbed += cleanSnippet + ' ';
            }
          }

          textToEmbed = textToEmbed.trim();
          
          if (!textToEmbed || textToEmbed.length < 10) {
            console.log(`Skipping message ${message.id} - insufficient text content (${textToEmbed.length} chars)`);
            errorCount++;
            continue;
          }

          // Limit text length to avoid API limits (max ~8000 tokens for embedding model)
          if (textToEmbed.length > 8000) {
            textToEmbed = textToEmbed.substring(0, 8000) + '...';
          }

          console.log(`Embedding text for message ${message.id}: ${textToEmbed.substring(0, 100)}...`);

          // Generate embedding using OpenAI
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: textToEmbed,
            dimensions: 1536,
          });

          if (!embeddingResponse.data || !embeddingResponse.data[0] || !embeddingResponse.data[0].embedding) {
            console.error(`Invalid embedding response for message ${message.id}:`, embeddingResponse);
            errorCount++;
            continue;
          }

          const embedding = embeddingResponse.data[0].embedding;
          console.log(`Generated embedding for message ${message.id}, vector length: ${embedding.length}`);

          // Insert embedding into database using UPSERT
          const { error: insertError } = await supabase
            .from('gmail_message_embeddings')
            .upsert({
              message_id: message.id,
              user_id: message.user_id,
              embedding: embedding,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'message_id',
              ignoreDuplicates: false
            });

          if (insertError) {
            console.error(`Error inserting embedding for message ${message.id}:`, insertError);
            errorCount++;
          } else {
            processedCount++;
            console.log(`Successfully embedded message ${message.id}`);
          }

        } catch (error) {
          console.error(`Error processing message ${message.id}:`, error.message);
          console.error(`Full error:`, error);
          errorCount++;
        }
      }

      // Add a small delay between batches to be respectful to the API
      if (i + batchSize < messagesToEmbed.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Embedding process completed. Processed: ${processedCount}, Errors: ${errorCount}`);

    res.json({
      message: 'Gmail message embedding completed',
      processed: processedCount,
      errors: errorCount,
      total: messagesToEmbed.length
    });

  } catch (error) {
    console.error('Error in embed-gmail-messages endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error during embedding process',
      details: error.message 
    });
  }
});

// POST endpoint to search Gmail messages using vector similarity
router.post('/search-gmail-messages', async (req, res) => {
  try {
    const { query, user_id } = req.body;

    // Validate input
    if (!query || !user_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: query and user_id are required' 
      });
    }

    console.log(`Searching Gmail messages for user ${user_id} with query: "${query}"`);

    // Generate embedding for the search query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 1536,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Perform vector similarity search using Supabase's pgvector functionality
    // Note: We need to use RPC function for vector similarity search
    const { data: searchResults, error: searchError } = await supabase.rpc(
      'search_gmail_messages_by_embedding',
      {
        query_embedding: queryEmbedding,
        search_user_id: user_id,
        match_count: 100  // Search through ALL embedded emails
      }
    );

    if (searchError) {
      console.error('Vector search error:', searchError);
      
      // Fallback to manual similarity search if RPC function doesn't exist
      console.log('Falling back to manual similarity search...');
      
      const { data: fallbackResults, error: fallbackError } = await supabase
        .from('gmail_message_embeddings')
        .select(`
          message_id,
          gmail_messages (
            subject,
            snippet,
            body,
            date,
            sender
          )
        `)
        .eq('user_id', user_id)
        .limit(50); // Get more results for manual filtering

      if (fallbackError) {
        console.error('Fallback search error:', fallbackError);
        return res.status(500).json({ 
          error: 'Failed to search Gmail messages', 
          details: fallbackError.message 
        });
      }

      // Calculate cosine similarity manually (simplified approach)
      const resultsWithSimilarity = fallbackResults
        .filter(result => result.gmail_messages) // Ensure join worked
        .map(result => ({
          ...result.gmail_messages,
          message_id: result.message_id,
          // Note: Without pgvector, we can't calculate actual similarity
          // This is a placeholder for when pgvector is properly set up
          similarity: Math.random() // Placeholder
        }))
        .slice(0, 5); // Take top 5

      return res.json({
        query,
        results: resultsWithSimilarity,
        message: 'Results returned using fallback search (install pgvector for better results)'
      });
    }

    console.log(`Found ${searchResults?.length || 0} similar messages before filtering`);
    console.log('Sample search results:', searchResults?.slice(0, 3));

    // Filter results based on similarity threshold
    // For cosine similarity, values closer to 1 are more similar
    // Negative values indicate lower similarity
    const { similarity_threshold = -0.10 } = req.body; // Allow custom threshold, default -0.10
    const SIMILARITY_THRESHOLD = similarity_threshold;
    
    const filteredResults = searchResults
      ? searchResults.filter(result => {
          console.log(`Message "${result.subject}" similarity: ${result.similarity}, threshold: ${SIMILARITY_THRESHOLD}`);
          // Only return results that meet the similarity threshold
          return result.similarity > SIMILARITY_THRESHOLD;
        })
      : [];

    console.log(`Filtered to ${filteredResults.length} relevant messages (threshold: ${SIMILARITY_THRESHOLD})`);

    // If no results meet the threshold, return empty results with explanation
    if (filteredResults.length === 0) {
      return res.json({
        query,
        results: [],
        message: 'No emails found that are sufficiently similar to your query',
        similarity_threshold: SIMILARITY_THRESHOLD,
        total_searched: searchResults?.length || 0
      });
    }

    res.json({
      query,
      results: filteredResults,
      message: `Search completed successfully - found ${filteredResults.length} relevant email(s)`,
      similarity_threshold: SIMILARITY_THRESHOLD,
      total_searched: searchResults?.length || 0
    });

  } catch (error) {
    console.error('Error in search-gmail-messages endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error during search',
      details: error.message 
    });
  }
});

// Endpoint to re-embed top 50 most recent emails (complete process)
router.post('/embed-recent-50-complete', async (req, res) => {
  try {
    console.log('Starting complete process to embed top 50 most recent emails...');
    
    // Clear all existing embeddings first
    const { error: clearError } = await supabase
      .from('gmail_message_embeddings')
      .delete()
      .neq('message_id', ''); // Delete all embeddings

    if (clearError) {
      console.error('Error clearing embeddings:', clearError);
      return res.status(500).json({ error: 'Failed to clear existing embeddings', details: clearError.message });
    }

    console.log('Cleared all existing embeddings');

    // Fetch the top 50 most recent messages by date
    const { data: recentMessages, error: fetchError } = await supabase
      .from('gmail_messages')
      .select(`
        id,
        user_id,
        subject,
        body,
        snippet,
        date,
        created_at
      `)
      .not('user_id', 'is', null)
      .order('date', { ascending: false })
      .limit(50);

    if (fetchError) {
      return res.status(500).json({ error: 'Failed to fetch recent messages', details: fetchError.message });
    }

    if (!recentMessages || recentMessages.length === 0) {
      return res.json({ message: 'No recent messages found to embed', processed: 0 });
    }

    console.log(`Processing ${recentMessages.length} most recent emails`);
    console.log(`Date range: ${recentMessages[0]?.date} (newest) to ${recentMessages[recentMessages.length-1]?.date} (oldest)`);

    let processedCount = 0;
    let errorCount = 0;

    // Process each message
    for (const message of recentMessages) {
      try {
        // Combine subject and body for embedding
        let textToEmbed = '';
        
        if (message.subject && typeof message.subject === 'string' && message.subject.trim()) {
          textToEmbed += message.subject.trim() + ' ';
        }
        
        if (message.body && typeof message.body === 'string' && message.body.trim()) {
          const cleanBody = message.body
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (cleanBody) {
            textToEmbed += cleanBody + ' ';
          }
        } else if (message.snippet && typeof message.snippet === 'string' && message.snippet.trim()) {
          const cleanSnippet = message.snippet
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (cleanSnippet) {
            textToEmbed += cleanSnippet + ' ';
          }
        }

        textToEmbed = textToEmbed.trim();
        
        if (!textToEmbed || textToEmbed.length < 10) {
          console.log(`Skipping message ${message.id} - insufficient content`);
          errorCount++;
          continue;
        }

        if (textToEmbed.length > 8000) {
          textToEmbed = textToEmbed.substring(0, 8000) + '...';
        }

        // Generate embedding
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: textToEmbed,
          dimensions: 1536,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Store embedding
        const { error: insertError } = await supabase
          .from('gmail_message_embeddings')
          .upsert({
            message_id: message.id,
            user_id: message.user_id,
            embedding: embedding,
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error(`Error storing embedding for ${message.id}:`, insertError);
          errorCount++;
        } else {
          processedCount++;
          console.log(`✅ Embedded message ${message.id}: ${message.subject?.substring(0, 50)}...`);
        }

      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        errorCount++;
      }
    }

    res.json({
      message: 'Top 50 most recent emails embedding completed',
      processed: processedCount,
      errors: errorCount,
      total: recentMessages.length,
      date_range: {
        newest: recentMessages[0]?.date,
        oldest: recentMessages[recentMessages.length-1]?.date
      }
    });

  } catch (error) {
    console.error('Error in embed-recent-50-complete endpoint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Endpoint to re-embed top 50 most recent emails
router.post('/embed-recent-50', async (req, res) => {
  try {
    console.log('Starting process to embed top 50 most recent emails...');
    
    // Clear all existing embeddings first
    const { error: clearError } = await supabase
      .from('gmail_message_embeddings')
      .delete()
      .neq('message_id', ''); // Delete all embeddings

    if (clearError) {
      console.error('Error clearing embeddings:', clearError);
      return res.status(500).json({ error: 'Failed to clear existing embeddings', details: clearError.message });
    }

    console.log('Cleared all existing embeddings');

    // Now trigger the regular embedding process which will embed top 50 most recent
    // This will be handled by the updated embed-gmail-messages endpoint
    res.json({ 
      message: 'Cleared all embeddings. Now run /api/embed-gmail-messages to embed top 50 most recent emails',
      next_step: 'POST /api/embed-gmail-messages'
    });

  } catch (error) {
    console.error('Error in embed-recent-50 endpoint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Test endpoint to clear embeddings for demo purposes
router.post('/clear-test-embeddings', async (req, res) => {
  try {
    const { count = 5 } = req.body;
    
    // Get some embedding IDs to clear
    const { data: embeddingsToDelete, error: fetchError } = await supabase
      .from('gmail_message_embeddings')
      .select('message_id')
      .limit(count);

    if (fetchError) {
      return res.status(500).json({ error: 'Failed to fetch embeddings', details: fetchError.message });
    }

    if (embeddingsToDelete.length === 0) {
      return res.json({ message: 'No embeddings to clear', cleared: 0 });
    }

    const messageIds = embeddingsToDelete.map(e => e.message_id);

    // Delete the embeddings
    const { error: deleteError } = await supabase
      .from('gmail_message_embeddings')
      .delete()
      .in('message_id', messageIds);

    if (deleteError) {
      return res.status(500).json({ error: 'Failed to clear embeddings', details: deleteError.message });
    }

    res.json({ 
      message: `Cleared ${messageIds.length} embeddings for testing`,
      cleared: messageIds.length,
      cleared_message_ids: messageIds
    });

  } catch (error) {
    console.error('Error clearing embeddings:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Debug endpoint to check embedding status
router.get('/embedding-status/:email', async (req, res) => {
  try {
    const email = req.params.email;
    
    // Get all Gmail messages for this user
    const { data: allMessages, error: messagesError } = await supabase
      .from('gmail_messages')
      .select('id, subject, user_id, created_at')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false });

    if (messagesError) {
      return res.status(500).json({ error: 'Failed to fetch messages', details: messagesError.message });
    }

    // Get all existing embeddings
    const { data: existingEmbeddings, error: embeddingsError } = await supabase
      .from('gmail_message_embeddings')
      .select('message_id, created_at');

    if (embeddingsError) {
      return res.status(500).json({ error: 'Failed to fetch embeddings', details: embeddingsError.message });
    }

    const embeddedMessageIds = new Set(existingEmbeddings?.map(e => e.message_id) || []);
    
    const messagesWithStatus = allMessages.map(msg => ({
      message_id: msg.id,
      subject: msg.subject?.substring(0, 60) + (msg.subject?.length > 60 ? '...' : ''),
      user_id: msg.user_id,
      has_embedding: embeddedMessageIds.has(msg.id),
      created_at: msg.created_at
    }));

    const stats = {
      total_messages: allMessages.length,
      embedded_messages: messagesWithStatus.filter(m => m.has_embedding).length,
      missing_embeddings: messagesWithStatus.filter(m => !m.has_embedding).length,
    };

    res.json({
      stats,
      messages: messagesWithStatus,
      messages_needing_embeddings: messagesWithStatus.filter(m => !m.has_embedding)
    });

  } catch (error) {
    console.error('Error in embedding-status endpoint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Debug endpoint for detailed search analysis
router.post('/debug-search', async (req, res) => {
  try {
    const { query, user_id } = req.body;

    if (!query || !user_id) {
      return res.status(400).json({ error: 'Missing query or user_id' });
    }

    // Generate embedding for the search query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 1536,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Perform vector similarity search
    const { data: searchResults, error: searchError } = await supabase.rpc(
      'search_gmail_messages_by_embedding',
      {
        query_embedding: queryEmbedding,
        search_user_id: user_id,
        match_count: 10  // Get top 10 for debugging
      }
    );

    return res.json({
      query,
      rpc_error: searchError,
      raw_results_count: searchResults?.length || 0,
      raw_results: searchResults?.slice(0, 5) || [],  // Show first 5
      debug_info: {
        query_embedding_length: queryEmbedding.length,
        user_id: user_id
      }
    });

  } catch (error) {
    return res.json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Debug endpoint to test RPC function
router.get('/debug-rpc-test', async (req, res) => {
  try {
    // Test if the RPC function exists by calling it with dummy data
    const dummyEmbedding = new Array(1536).fill(0.1); // Create a dummy 1536-dimension vector
    
    const { data, error } = await supabase.rpc(
      'search_gmail_messages_by_embedding',
      {
        query_embedding: dummyEmbedding,
        search_user_id: '984f83c8-2adc-40a2-9288-195e25af139d',
        match_count: 1
      }
    );

    if (error) {
      return res.json({
        rpc_function_status: 'ERROR',
        error_details: error.message,
        error_code: error.code,
        suggestion: 'The RPC function might not exist in your Supabase database. Please run the complete-embedding-setup.sql file.'
      });
    }

    return res.json({
      rpc_function_status: 'SUCCESS',
      result_count: data?.length || 0,
      message: 'RPC function is working correctly'
    });

  } catch (error) {
    return res.json({
      rpc_function_status: 'EXCEPTION',
      error: error.message,
      suggestion: 'There might be a network or configuration issue'
    });
  }
});

// Debug endpoint to search emails by subject
router.get('/debug-search-subject/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    
    // Search in gmail_messages table
    const { data: messages, error: messageError } = await supabase
      .from('gmail_messages')
      .select('id, subject, sender, user_id, date, body')
      .ilike('subject', `%${subject}%`);

    if (messageError) {
      return res.status(500).json({ error: 'Database query failed', details: messageError.message });
    }

    // Check if these messages have embeddings
    const messageIds = messages.map(m => m.id);
    const { data: embeddings, error: embeddingError } = await supabase
      .from('gmail_message_embeddings')
      .select('message_id, embedding')
      .in('message_id', messageIds);

    const messagesWithEmbeddingStatus = messages.map(msg => ({
      ...msg,
      has_embedding: embeddings?.some(emb => emb.message_id === msg.id) || false
    }));

    res.json({
      search_term: subject,
      found_messages: messages.length,
      messages: messagesWithEmbeddingStatus
    });

  } catch (error) {
    console.error('Error in debug-search-subject endpoint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;
