# Polaris AI Billing System

## Complete Production-Ready SaaS Billing Infrastructure

This billing system provides a complete, production-ready solution for subscription management, credit allocation, and payment processing via Razorpay.

---

## 📁 File Structure

```
PolarisAI-Backend/billing/
├── COMPLETE_BILLING_MIGRATION.sql   # Complete database schema (run once)
├── billingConfig.js                 # Centralized configuration service
├── billingService.js                # Core billing operations
├── razorpayService.js              # Razorpay integration
├── billingController.js            # API endpoints
└── BILLING_SYSTEM_README.md        # This file

PolarisAI-Frontend/app/dashboard/credits/
└── page.tsx                        # Credits & Billing UI
```

---

## 🚀 Installation Steps

### 1. Database Setup

Run the complete SQL migration in **Supabase SQL Editor**:

```bash
# Open: PolarisAI-Backend/billing/COMPLETE_BILLING_MIGRATION.sql
# Copy all content and run in Supabase SQL Editor
```

This creates:
- ✅ Centralized billing configuration table
- ✅ Subscription plans table (with initial data)
- ✅ User subscriptions tracking
- ✅ Credit packs table (with initial data)
- ✅ Payment history table
- ✅ Billing history table
- ✅ All necessary functions and triggers

### 2. Environment Variables

Add to `PolarisAI-Backend/.env`:

```env
# Razorpay Test Mode Credentials
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_secret_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

**To get test credentials:**
1. Go to https://dashboard.razorpay.com/
2. Switch to "Test Mode" (toggle in top-left)
3. Go to Settings > API Keys
4. Generate Test Keys
5. For webhook secret: Settings > Webhooks > Create Webhook

### 3. Backend Routes

The billing routes are already added to `PolarisAI-Backend/index.js`:

```javascript
const billingRoutes = require('./billing/billingController');
app.use('/api/billing', billingRoutes);
```

No additional configuration needed!

### 4. Frontend Integration

The Credits & Billing page is already created at:
```
/dashboard/credits
```

Clicking the **Credits** button in the sidebar navigates users to this page.

---

## 📊 Centralized Configuration

### Single Source of Truth

All billing values come from the database `billing_config` and `subscription_plans` tables:

```javascript
// Backend usage
const billingConfig = require('./billing/billingConfig');
const plans = await billingConfig.getSubscriptionPlans();
```

```typescript
// Frontend usage
const res = await fetch(`${apiUrl}/api/billing/config`);
const { plans, creditPacks, config } = await res.json();
```

### Updating Pricing (No Code Changes!)

**To change subscription price:**
```sql
UPDATE subscription_plans 
SET monthly_price_inr = 599, yearly_price_inr = 5988
WHERE plan_id = 'pro';
```

**To change monthly credits:**
```sql
UPDATE subscription_plans 
SET monthly_credits = 2000
WHERE plan_id = 'pro';
```

**To add a new credit pack:**
```sql
INSERT INTO credit_packs (pack_id, pack_name, credits, price_inr, display_order)
VALUES ('pack_500', '500 Credits', 500, 249, 4);
```

**To change agent credit cost:**
```sql
UPDATE credit_costs 
SET cost = 15
WHERE agent_name = 'github';
```

Frontend and backend automatically use the new values!

---

## 🎯 API Endpoints

### Public Endpoints (No Auth)

```
GET /api/billing/config
GET /api/billing/plans
GET /api/billing/credit-packs
GET /api/billing/razorpay-status
GET /api/billing/health
```

### Protected Endpoints (Require Auth)

```
GET  /api/billing/subscription
GET  /api/billing/summary
POST /api/billing/create-order
POST /api/billing/verify-payment
POST /api/billing/cancel-subscription
GET  /api/billing/payment-history
GET  /api/billing/history
```

### Webhook Endpoint

```
POST /api/billing/webhook  (Razorpay signature verification)
```

---

## 💳 Payment Flow

### Subscription Purchase

```javascript
// 1. Create Razorpay order
const orderRes = await fetch(`${apiUrl}/api/billing/create-order`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'subscription',
    planId: 'pro',
    billingCycle: 'monthly'
  })
});

// 2. Initialize Razorpay checkout
const options = {
  key: orderData.razorpayKeyId,
  amount: orderData.order.amount * 100,
  order_id: orderData.order.id,
  handler: async (response) => {
    // 3. Verify payment on backend
    await fetch(`${apiUrl}/api/billing/verify-payment`, {
      method: 'POST',
      body: JSON.stringify({
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature
      })
    });
  }
};

const razorpay = new window.Razorpay(options);
razorpay.open();
```

### Credit Pack Purchase

Same flow, just use:
```javascript
{
  type: 'credit_pack',
  packId: 'pack_250'
}
```

---

## 🔐 Security Features

### Payment Verification

1. **Backend Signature Verification**: Every payment response is verified using Razorpay signature
2. **Idempotent Processing**: Duplicate payments are prevented
3. **Webhook Verification**: Webhook signatures are validated
4. **Database Transactions**: All credit operations are atomic

### Code Examples

```javascript
// Verify payment signature (server-side only)
const verified = razorpayService.verifyPaymentSignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
});

if (!verified) {
  // Mark as failed, don't allocate credits
  return error;
}

// Complete payment atomically
await billingService.completePayment({...});
```

---

## 📈 Subscription Lifecycle

### Auto-Renewal (Future Implementation)

The system is designed for auto-renewal:

```sql
-- Check subscriptions needing renewal
SELECT * FROM user_subscriptions 
WHERE status = 'active'
AND current_period_end < now()
AND cancel_at_period_end = false;

-- Allocate monthly credits
SELECT allocate_monthly_credits(subscription_id);
```

### Cancellation

```javascript
// Cancel at period end (recommended)
await fetch('/api/billing/cancel-subscription', {
  method: 'POST',
  body: JSON.stringify({ immediately: false })
});

// Cancel immediately
await fetch('/api/billing/cancel-subscription', {
  method: 'POST',
  body: JSON.stringify({ immediately: true })
});
```

---

## 🧪 Testing

### Test with Razorpay Test Cards

```
Card Number: 4111 1111 1111 1111
CVV: Any 3 digits
Expiry: Any future date
```

### Test Scenarios

1. **Successful Payment**: Use test card above
2. **Failed Payment**: Use card `4000 0000 0000 0002`
3. **Insufficient Funds**: Use card `4000 0000 0000 9995`

### Verify in Database

```sql
-- Check payment record
SELECT * FROM payments ORDER BY created_at DESC LIMIT 1;

-- Check subscription created
SELECT * FROM user_subscriptions WHERE user_id = 'your-user-id';

-- Check credits allocated
SELECT * FROM user_credits WHERE user_id = 'your-user-id';

-- Check billing history
SELECT * FROM billing_history WHERE user_id = 'your-user-id';
```

---

## 🔄 Moving to Production

### 1. Switch to Live Mode

Update `.env`:
```env
RAZORPAY_KEY_ID=rzp_live_your_live_key
RAZORPAY_KEY_SECRET=your_live_secret
```

That's it! No code changes needed.

### 2. Setup Razorpay Webhook

1. Go to Razorpay Dashboard > Settings > Webhooks
2. Add webhook URL: `https://yourdomain.com/api/billing/webhook`
3. Select events:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `subscription.charged`
   - `subscription.cancelled`
4. Copy webhook secret to `.env`

### 3. Test Live Payments

Start with small test purchases before going fully live.

---

## 📊 Analytics & Reporting

### User Billing Summary

```javascript
const summary = await fetch('/api/billing/summary', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Returns:
// {
//   subscription: { plan, status, credits, nextRenewal },
//   credits: { balance, totalEarned, totalSpent },
//   payments: { total, totalSpent }
// }
```

### Payment History

```javascript
const history = await fetch('/api/billing/payment-history', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Billing Events

```javascript
const events = await fetch('/api/billing/history', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## 🎨 Customization

### Adding a New Plan

```sql
INSERT INTO subscription_plans (
  plan_id, plan_name, description,
  monthly_price_inr, yearly_price_inr,
  monthly_credits, features, limitations,
  display_order
) VALUES (
  'enterprise',
  'Enterprise',
  'For large teams',
  1999,
  19188,
  10000,
  '["Everything in Power", "Custom integrations", "Dedicated support"]'::jsonb,
  '{"max_schedules": -1, "priority_queue": true}'::jsonb,
  4
);
```

Restart backend, and the new plan appears automatically in the UI!

### Adding a New Credit Pack

```sql
INSERT INTO credit_packs (
  pack_id, pack_name, credits, price_inr,
  savings_percentage, display_order
) VALUES (
  'pack_5000',
  '5000 Credits',
  5000,
  1799,
  40,
  4
);
```

---

## 🐛 Troubleshooting

### Payment Not Completing

1. Check Razorpay dashboard for payment status
2. Check browser console for errors
3. Verify signature validation:
   ```javascript
   // Should return true
   const result = razorpayService.verifyPaymentSignature({...});
   ```

### Credits Not Allocated

```sql
-- Check if payment completed
SELECT * FROM payments WHERE razorpay_order_id = 'order_xxx';

-- Check if subscription created
SELECT * FROM user_subscriptions WHERE user_id = 'xxx';

-- Manually allocate if needed
SELECT create_or_update_subscription('user-id', 'pro', 'monthly');
```

### Webhook Not Working

1. Verify webhook secret in `.env`
2. Check webhook signature validation
3. Test with Razorpay webhook test tool
4. Check server logs for errors

---

## 📝 Summary

This billing system provides:

✅ **Complete database schema** (one SQL file)  
✅ **Centralized configuration** (change pricing without code)  
✅ **Razorpay integration** (test mode → live mode with env vars)  
✅ **Subscription management** (create, cancel, upgrade)  
✅ **Credit allocation** (monthly + top-ups)  
✅ **Payment verification** (secure signature validation)  
✅ **Billing history** (complete audit trail)  
✅ **Frontend UI** (ready-to-use credits page)  
✅ **Production-ready** (security, idempotency, error handling)  

---

## 🎯 Next Steps

1. Run the SQL migration
2. Add Razorpay test credentials
3. Test subscription purchase
4. Test credit pack purchase
5. Verify credits allocated
6. Check billing history
7. Test cancellation
8. Switch to live mode when ready!

---

## 💡 Support

For issues or questions:
1. Check this README
2. Check console logs (frontend & backend)
3. Check Supabase logs
4. Check Razorpay dashboard
5. Review the code comments (extensively documented)

---

**Built with ❤️ for Polaris AI**
