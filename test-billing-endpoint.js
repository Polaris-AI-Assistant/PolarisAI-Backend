// Quick test to check if billing endpoints are working
const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

async function testBillingEndpoints() {
  console.log('\n🧪 Testing Billing Endpoints\n');
  console.log('Backend URL:', BACKEND_URL);
  console.log('='.repeat(50));

  try {
    // Test 1: Get plans (public endpoint - no auth required)
    console.log('\n1️⃣ Testing /api/billing/plans');
    const plansRes = await axios.get(`${BACKEND_URL}/api/billing/plans`);
    console.log('✅ Plans response:', JSON.stringify(plansRes.data, null, 2));
    console.log(`   Found ${plansRes.data.plans?.length || 0} plans`);

    // Test 2: Get credit packs (public endpoint - no auth required)
    console.log('\n2️⃣ Testing /api/billing/credit-packs');
    const packsRes = await axios.get(`${BACKEND_URL}/api/billing/credit-packs`);
    console.log('✅ Packs response:', JSON.stringify(packsRes.data, null, 2));
    console.log(`   Found ${packsRes.data.packs?.length || 0} credit packs`);

    // Test 3: Get complete config (public endpoint - no auth required)
    console.log('\n3️⃣ Testing /api/billing/config');
    const configRes = await axios.get(`${BACKEND_URL}/api/billing/config`);
    console.log('✅ Config response:', JSON.stringify(configRes.data, null, 2));

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response?.data?.error) {
      console.error('   Error details:', error.response.data.error);
    }
    console.log('\n' + '='.repeat(50));
    console.log('❌ Tests failed!\n');
  }
}

testBillingEndpoints();
