// Test database tables directly
const supabase = require('./supabase/supabaseConnect');

async function testDatabase() {
  console.log('\n🧪 Testing Billing Database Tables\n');
  console.log('='.repeat(50));

  try {
    // Test 1: Check if tables exist
    console.log('\n1️⃣ Checking if billing tables exist');
    const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
          'billing_config',
          'subscription_plans',
          'user_subscriptions',
          'credit_packs',
          'payments',
          'billing_history'
        )
        ORDER BY table_name
      `
    });

    if (tablesError) {
      console.log('❌ Cannot check tables (RPC not available)');
      console.log('   Trying direct query instead...');
      
      // Try direct queries
      const { data: plans, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .limit(1);
      
      if (plansError) {
        if (plansError.code === '42P01') {
          console.log('❌ Table subscription_plans does NOT exist');
          console.log('   You need to run COMPLETE_BILLING_MIGRATION.sql');
        } else {
          console.log('❌ Error querying subscription_plans:', plansError.message);
        }
      } else {
        console.log('✅ Table subscription_plans exists');
      }
    } else {
      console.log('✅ Found tables:', tables);
    }

    // Test 2: Query subscription_plans
    console.log('\n2️⃣ Querying subscription_plans');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true);
    
    if (plansError) {
      console.log('❌ Error:', plansError.message);
      if (plansError.code === '42P01') {
        console.log('   Table does not exist! Run COMPLETE_BILLING_MIGRATION.sql');
      }
    } else {
      console.log(`✅ Found ${plans.length} subscription plans:`);
      plans.forEach(plan => {
        console.log(`   - ${plan.plan_name} (${plan.plan_id}): ₹${plan.monthly_price_inr}/month`);
      });
    }

    // Test 3: Query credit_packs
    console.log('\n3️⃣ Querying credit_packs');
    const { data: packs, error: packsError } = await supabase
      .from('credit_packs')
      .select('*')
      .eq('is_active', true);
    
    if (packsError) {
      console.log('❌ Error:', packsError.message);
      if (packsError.code === '42P01') {
        console.log('   Table does not exist! Run COMPLETE_BILLING_MIGRATION.sql');
      }
    } else {
      console.log(`✅ Found ${packs.length} credit packs:`);
      packs.forEach(pack => {
        console.log(`   - ${pack.pack_name}: ${pack.credits} credits for ₹${pack.price_inr}`);
      });
    }

    // Test 4: Query billing_config
    console.log('\n4️⃣ Querying billing_config');
    const { data: config, error: configError } = await supabase
      .from('billing_config')
      .select('*')
      .eq('is_active', true);
    
    if (configError) {
      console.log('❌ Error:', configError.message);
      if (configError.code === '42P01') {
        console.log('   Table does not exist! Run COMPLETE_BILLING_MIGRATION.sql');
      }
    } else {
      console.log(`✅ Found ${config.length} config entries:`);
      config.forEach(cfg => {
        console.log(`   - ${cfg.config_key}: ${JSON.stringify(cfg.config_value)}`);
      });
    }

    // Test 5: Check if payments table exists and RPC functions work
    console.log('\n5️⃣ Checking payments table and RPC functions');
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('id')
      .limit(1);
    
    if (paymentsError) {
      if (paymentsError.code === '42P01') {
        console.log('❌ Table payments does NOT exist - run COMPLETE_BILLING_MIGRATION.sql');
      } else {
        console.log('❌ Error querying payments:', paymentsError.message);
      }
    } else {
      console.log('✅ Table payments exists');
    }

    // Test the create_payment_record RPC (will fail with invalid data but tells us if function exists)
    const { data: rpcTest, error: rpcError } = await supabase.rpc('create_payment_record', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_payment_type: 'subscription',
      p_amount_inr: 1,
      p_razorpay_order_id: 'test_order_check',
      p_plan_id: null,
      p_pack_id: null,
      p_billing_cycle: null,
      p_metadata: {}
    });
    
    if (rpcError) {
      if (rpcError.message?.includes('does not exist') || rpcError.code === '42883') {
        console.log('❌ RPC function create_payment_record does NOT exist - run COMPLETE_BILLING_MIGRATION.sql');
      } else {
        console.log('✅ RPC function create_payment_record exists (error is expected with fake data)');
      }
    } else {
      console.log('✅ RPC function create_payment_record works:', rpcTest);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Database test complete!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.log('\n' + '='.repeat(50));
    console.log('❌ Test failed!\n');
  }
}

testDatabase();
