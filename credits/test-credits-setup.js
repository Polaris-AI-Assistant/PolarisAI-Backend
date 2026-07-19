/**
 * Test Script: Credit System Setup Checker
 * 
 * Run this script to verify your credit system is properly set up.
 * 
 * Usage: cd PolarisAI-Backend && node credits/test-credits-setup.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const supabase = require('../supabase/supabaseConnect');

async function testCreditSetup() {
  console.log('\n🔍 CREDIT SYSTEM DIAGNOSTIC\n');
  console.log('=' .repeat(60));
  
  let allGood = true;

  // Test 1: Check if user_credits table exists
  console.log('\n1️⃣  Checking user_credits table...');
  try {
    const { data, error } = await supabase
      .from('user_credits')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('   ❌ FAILED: user_credits table does not exist');
        console.log('   → Run create_credits_tables.sql in Supabase SQL Editor');
        allGood = false;
      } else {
        console.log('   ❌ FAILED:', error.message);
        allGood = false;
      }
    } else {
      console.log('   ✅ PASSED: user_credits table exists');
      console.log(`   → Found ${data ? data.length : 0} user(s) with credits`);
    }
  } catch (err) {
    console.log('   ❌ FAILED:', err.message);
    allGood = false;
  }

  // Test 2: Check if credit_costs table exists
  console.log('\n2️⃣  Checking credit_costs table...');
  try {
    const { data, error } = await supabase
      .from('credit_costs')
      .select('agent_name, cost')
      .limit(5);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('   ❌ FAILED: credit_costs table does not exist');
        console.log('   → Run create_credits_tables.sql in Supabase SQL Editor');
        allGood = false;
      } else {
        console.log('   ❌ FAILED:', error.message);
        allGood = false;
      }
    } else {
      console.log('   ✅ PASSED: credit_costs table exists');
      console.log(`   → Found ${data ? data.length : 0} agent cost(s) configured`);
      if (data && data.length > 0) {
        console.log('   → Sample costs:');
        data.forEach(cost => {
          console.log(`      - ${cost.agent_name}: ${cost.cost} credits`);
        });
      }
    }
  } catch (err) {
    console.log('   ❌ FAILED:', err.message);
    allGood = false;
  }

  // Test 3: Check if credit_transactions table exists
  console.log('\n3️⃣  Checking credit_transactions table...');
  try {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('   ❌ FAILED: credit_transactions table does not exist');
        console.log('   → Run create_credits_tables.sql in Supabase SQL Editor');
        allGood = false;
      } else {
        console.log('   ❌ FAILED:', error.message);
        allGood = false;
      }
    } else {
      console.log('   ✅ PASSED: credit_transactions table exists');
    }
  } catch (err) {
    console.log('   ❌ FAILED:', err.message);
    allGood = false;
  }

  // Test 4: Check if initialize_user_credits function exists
  console.log('\n4️⃣  Checking initialize_user_credits function...');
  try {
    // Try to call the function with a fake UUID to see if it exists
    const { data, error } = await supabase.rpc('initialize_user_credits', {
      p_user_id: '00000000-0000-0000-0000-000000000000'
    });
    
    if (error && error.code === '42883') {
      console.log('   ❌ FAILED: initialize_user_credits function does not exist');
      console.log('   → Run create_credits_tables.sql in Supabase SQL Editor');
      allGood = false;
    } else {
      console.log('   ✅ PASSED: initialize_user_credits function exists');
    }
  } catch (err) {
    console.log('   ❌ FAILED:', err.message);
    allGood = false;
  }

  // Test 5: List all users and their credit status
  console.log('\n5️⃣  Checking user credit status...');
  try {
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.log('   ⚠️  WARNING: Cannot list users (admin access needed)');
    } else {
      console.log(`   📊 Total users in system: ${users.users.length}`);
      
      // Check how many have credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('user_id, balance');
      
      if (!creditsError && creditsData) {
        console.log(`   💰 Users with credits: ${creditsData.length}`);
        console.log(`   ⚠️  Users WITHOUT credits: ${users.users.length - creditsData.length}`);
        
        if (users.users.length - creditsData.length > 0) {
          console.log('   → Run initialize_existing_users.sql to grant credits to existing users');
          allGood = false;
        }
      }
    }
  } catch (err) {
    console.log('   ⚠️  WARNING:', err.message);
  }

  // Test 6: Check environment variables
  console.log('\n6️⃣  Checking environment variables...');
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_KEY',
  ];
  
  let envOk = true;
  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName} is set`);
    } else {
      console.log(`   ❌ ${varName} is NOT set`);
      envOk = false;
      allGood = false;
    }
  });

  // Final Summary
  console.log('\n' + '='.repeat(60));
  if (allGood) {
    console.log('\n✅ ALL CHECKS PASSED! Credit system is ready to use.\n');
    console.log('Next steps:');
    console.log('1. Restart your backend server');
    console.log('2. Refresh your frontend');
    console.log('3. You should see credit balance in the dashboard\n');
  } else {
    console.log('\n❌ SOME CHECKS FAILED. Please fix the issues above.\n');
    console.log('Quick Fix Guide:');
    console.log('1. Open Supabase Dashboard → SQL Editor');
    console.log('2. Run: PolarisAI-Backend/credits/create_credits_tables.sql');
    console.log('3. Run: PolarisAI-Backend/credits/initialize_existing_users.sql');
    console.log('4. Restart backend server');
    console.log('5. Run this test again: node test-credits-setup.js\n');
  }
  console.log('='.repeat(60) + '\n');
}

// Run the test
testCreditSetup()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
