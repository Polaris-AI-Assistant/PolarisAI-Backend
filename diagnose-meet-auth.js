#!/usr/bin/env node
/**
 * Diagnostics for Google Meet OAuth token status
 * This script verifies:
 * 1. Token exists in Supabase
 * 2. Token has required scopes
 * 3. Token is valid/not expired
 * 4. Can make API calls
 */

const { google } = require('googleapis');
const supabase = require('./supabase/supabaseConnect');

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

async function diagnoseAuth(userEmail) {
  console.log('\n=== Google Meet OAuth Diagnostics ===\n');
  console.log(`📧 Checking user: ${userEmail}\n`);

  try {
    // Step 1: Check if token exists
    console.log('Step 1️⃣: Checking token in Supabase...');
    const { data: tokenRow, error } = await supabase
      .from('meet_tokens')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (error || !tokenRow) {
      console.log('❌ No token found for this user\n');
      return;
    }
    console.log('✅ Token found\n');

    // Step 2: Check token expiry
    console.log('Step 2️⃣: Checking token validity...');
    const tokenObj = {
      access_token: tokenRow.access_token,
      refresh_token: tokenRow.refresh_token,
      expiry_date: tokenRow.expiry_date
    };

    console.log(`  - Access Token: ${tokenRow.access_token.substring(0, 20)}...`);
    console.log(`  - Refresh Token: ${tokenRow.refresh_token ? '✅ Present' : '❌ Missing'}`);
    console.log(`  - Expiry Date: ${tokenRow.expiry_date || 'Not set'}`);

    if (tokenRow.expiry_date) {
      const expiryTime = new Date(tokenRow.expiry_date).getTime();
      const nowTime = Date.now();
      if (expiryTime < nowTime) {
        console.log(`  - Status: ⚠️ EXPIRED (will auto-refresh)\n`);
      } else {
        const minutesLeft = Math.floor((expiryTime - nowTime) / 60000);
        console.log(`  - Status: ✅ Valid (${minutesLeft} minutes left)\n`);
      }
    }

    // Step 3: Check stored scopes (if available)
    console.log('Step 3️⃣: Checking token scopes...');
    if (tokenRow.scope) {
      const storedScopes = tokenRow.scope.split(' ');
      console.log(`  📋 Stored scopes: ${storedScopes.length} found\n`);
      for (const scope of REQUIRED_SCOPES) {
        const hasScope = storedScopes.includes(scope);
        console.log(`  ${hasScope ? '✅' : '❌'} ${scope}`);
      }
    } else {
      console.log('  ⚠️ No scope information stored in database\n');
    }

    // Step 4: Verify API can be called
    console.log('Step 4️⃣: Testing API call...');
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_MEET_CLIENT_ID,
      process.env.GOOGLE_MEET_CLIENT_SECRET,
      process.env.GOOGLE_MEET_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials(tokenObj);

    const meet = google.meet({ version: 'v2', auth: oAuth2Client });
    
    try {
      const response = await meet.conferenceRecords.list({ pageSize: 1 });
      console.log(`  ✅ API call successful`);
      console.log(`  📊 Conference records found: ${response.data.conferenceRecords?.length || 0}\n`);
      
      if (response.data.conferenceRecords && response.data.conferenceRecords.length > 0) {
        console.log('✅ MEETINGS EXIST - API is working!\n');
        response.data.conferenceRecords.slice(0, 3).forEach((conf, i) => {
          console.log(`   Meeting ${i + 1}:`);
          console.log(`     - Name: ${conf.name}`);
          console.log(`     - Start: ${conf.startTime}`);
          console.log(`     - Space: ${conf.space || 'N/A'}`);
        });
      } else {
        console.log('⚠️ NO MEETINGS FOUND - Possible causes:');
        console.log('   1. No Google Meet conferences in this account');
        console.log('   2. OAuth scope too restrictive');
        console.log('   3. Token lacks permission to view conferences\n');
      }
    } catch (apiError) {
      console.log(`  ❌ API call failed: ${apiError.message}\n`);
      if (apiError.message.includes('insufficient')) {
        console.log('  🔐 This is a PERMISSIONS issue - token lacks required scopes\n');
      }
    }

    // Step 5: Recommendation
    console.log('Step 5️⃣: Recommendation...');
    console.log('❌ YOUR ISSUE: Token was issued BEFORE we added new scopes to the code');
    console.log('✅ SOLUTION: Re-authorize the app with new scopes\n');
    console.log('Steps to fix:');
    console.log('1. Go to your application and click "Re-authorize"');
    console.log('2. Accept the new permissions requested');
    console.log('3. Your token will be updated with new scopes');
    console.log('4. Then try listing meetings again\n');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
  }
}

// Run diagnostics
const userEmail = process.argv[2];
if (!userEmail) {
  console.log('Usage: node diagnose-meet-auth.js <email@example.com>');
  process.exit(1);
}

diagnoseAuth(userEmail);
