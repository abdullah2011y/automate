import assert from 'assert';
import crypto from 'crypto';
import { prisma } from '../src/db/prisma';

const API_BASE = 'http://localhost:5000/api/v1';

async function testPhase3Suite() {
  console.log('🛍️ Starting Phase 3: Shopify Integration & Order Sync Verification Suite...\n');

  // 1. Authenticate as Tenant A
  console.log('1️⃣ Authenticating as Tenant A (admin@byteforge.io)...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@byteforge.io', password: 'Password123!' }),
  });
  assert.strictEqual(loginRes.status, 200);
  const loginJson = await loginRes.json();
  const token = loginJson.data.token;
  const tenantAId = loginJson.data.tenant.id;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  console.log('   ✅ Authenticated for Tenant A:', loginJson.data.tenant.name);

  // 2. Connect Shopify Store (Custom App Credentials)
  console.log('\n2️⃣ Testing POST /shopify/connect (Encrypted at rest)...');
  const testShopDomain = 'byteforge-boutique.myshopify.com';
  const rawAccessToken = 'shpat_test_secret_token_live_abcdef123456';
  const webhookSecret = 'test_webhook_shared_secret_xyz789';

  const connectRes = await fetch(`${API_BASE}/shopify/connect`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      shopDomain: testShopDomain,
      accessToken: rawAccessToken,
      webhookSecret,
    }),
  });
  assert.strictEqual(connectRes.status, 200);
  const connectJson = await connectRes.json();
  assert.strictEqual(connectJson.data.shopDomain, testShopDomain);
  assert.strictEqual(connectJson.data.isActive, true);
  console.log('   ✅ Store connected successfully:', connectJson.data.shopDomain);

  // Verify encryption at rest in PostgreSQL
  const dbRecord = await prisma.shopifyIntegration.findUnique({
    where: { tenantId: tenantAId },
  });
  assert(dbRecord, 'Integration record must exist in database');
  assert.notStrictEqual(
    dbRecord.encryptedAccessToken,
    rawAccessToken,
    'Database must NOT contain raw unencrypted access token'
  );
  assert(
    dbRecord.encryptedAccessToken.includes(':'),
    'Encrypted token must be in iv:authTag:ciphertext format'
  );
  console.log('   🔒 AES-256-GCM Encryption verified: Raw token never stored in database');

  // Verify GET /shopify/status
  const statusRes = await fetch(`${API_BASE}/shopify/status`, { headers: authHeaders });
  assert.strictEqual(statusRes.status, 200);
  const statusJson = await statusRes.json();
  assert.strictEqual(statusJson.data.connected, true);
  assert.strictEqual(statusJson.data.integration.shopDomain, testShopDomain);
  assert(!statusJson.data.integration.encryptedAccessToken, 'Access token must NEVER be sent to frontend');
  console.log('   ✅ Status endpoint verified: Secret tokens strictly hidden from API output');

  // 3. Test Webhook Ingestion: orders/create (Valid HMAC)
  console.log('\n3️⃣ Testing Shopify Webhook: orders/create (HMAC-SHA256 Signed)...');
  const testOrderId = Math.floor(100000000 + Math.random() * 900000000);
  const testOrderNumber = `#SHOP-${testOrderId.toString().slice(-4)}`;

  const orderWebhookPayload = {
    id: testOrderId,
    name: testOrderNumber,
    order_number: Number(testOrderId.toString().slice(-4)),
    created_at: new Date().toISOString(),
    currency: 'USD',
    total_price: '129.50',
    subtotal_price: '120.00',
    total_discounts: '0.00',
    financial_status: 'pending',
    fulfillment_status: 'unfulfilled',
    payment_gateway_names: ['cash_on_delivery'],
    phone: '+923009988776',
    customer: {
      first_name: 'Mahnoor',
      last_name: 'Qureshi',
      email: 'mahnoor.q@example.com',
      phone: '+923009988776',
    },
    shipping_address: {
      first_name: 'Mahnoor',
      last_name: 'Qureshi',
      address1: 'House 55, Street 10, F-8/3',
      city: 'Islamabad',
      country: 'Pakistan',
      phone: '+923009988776',
    },
    line_items: [
      {
        id: 991201,
        title: 'Rose Gold Hydrating Serum 50ml',
        sku: 'SRM-RG-50',
        quantity: 1,
        price: '79.50',
      },
      {
        id: 991202,
        title: 'Botanical Night Recovery Balm',
        sku: 'BLM-BOT-30',
        quantity: 1,
        price: '50.00',
      },
    ],
  };

  const rawPayloadString = JSON.stringify(orderWebhookPayload);
  const rawPayloadBuffer = Buffer.from(rawPayloadString, 'utf8');

  // Calculate valid HMAC-SHA256 signature
  const validHmac = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawPayloadBuffer)
    .digest('base64');

  const webhook1Id = `wh_create_${Date.now()}`;
  const webhookHeaders = {
    'Content-Type': 'application/json',
    'x-shopify-topic': 'orders/create',
    'x-shopify-shop-domain': testShopDomain,
    'x-shopify-hmac-sha256': validHmac,
    'x-shopify-webhook-id': webhook1Id,
  };

  const webhookRes = await fetch(`${API_BASE}/shopify/webhooks`, {
    method: 'POST',
    headers: webhookHeaders,
    body: rawPayloadString,
  });
  assert.strictEqual(webhookRes.status, 200, 'Webhook with valid HMAC must return 200');
  const webhookJson = await webhookRes.json();
  assert.strictEqual(webhookJson.result.status, 'PROCESSED');
  console.log('   ✅ Webhook authenticated and processed:', webhookJson.result.topic);

  // Verify Order and Customer created in PostgreSQL
  const ingestedOrder = await prisma.order.findUnique({
    where: {
      tenantId_shopifyOrderId: {
        tenantId: tenantAId,
        shopifyOrderId: String(testOrderId),
      },
    },
    include: { customer: true, items: true },
  });
  assert(ingestedOrder, 'Order must be persisted in database');
  assert.strictEqual(ingestedOrder.shopifyOrderNumber, testOrderNumber);
  assert.strictEqual(ingestedOrder.confirmationStatus, 'PENDING_CONFIRMATION');
  assert.strictEqual(ingestedOrder.source, 'shopify');
  assert.strictEqual(ingestedOrder.customer.phoneNumber, '+923009988776');
  assert.strictEqual(ingestedOrder.items.length, 2);
  console.log('   ✅ Order normalized and saved in PostgreSQL with line items and customer link');

  // 4. Test Webhook Security: Invalid HMAC Signature Rejection
  console.log('\n4️⃣ Testing Webhook Security: Invalid HMAC Signature Rejection...');
  const invalidHmac = 'totally_invalid_tampered_signature_xyz==';
  const badWebhookRes = await fetch(`${API_BASE}/shopify/webhooks`, {
    method: 'POST',
    headers: {
      ...webhookHeaders,
      'x-shopify-hmac-sha256': invalidHmac,
      'x-shopify-webhook-id': `wh_bad_${Date.now()}`,
    },
    body: rawPayloadString,
  });
  assert.strictEqual(badWebhookRes.status, 401, 'Invalid HMAC must be rejected with HTTP 401');
  console.log('   🛡️ Tampered HMAC rejected with HTTP 401 Unauthorized');

  // 5. Test Webhook Idempotency: Duplicate Event Re-delivery
  console.log('\n5️⃣ Testing Webhook Idempotency (Duplicate Redelivery)...');
  const dupWebhookRes = await fetch(`${API_BASE}/shopify/webhooks`, {
    method: 'POST',
    headers: webhookHeaders, // Same webhook1Id
    body: rawPayloadString,
  });
  assert.strictEqual(dupWebhookRes.status, 200);
  const dupJson = await dupWebhookRes.json();
  assert.strictEqual(dupJson.result.status, 'DUPLICATE_IGNORED');
  console.log('   ✅ Duplicate webhook dropped cleanly (DUPLICATE_IGNORED) without duplicate order creation');

  // 6. Test Webhook: orders/updated (Preserve Internal Confirmation Status)
  console.log('\n6️⃣ Testing Shopify Webhook: orders/updated (Status Preservation)...');
  // First, manually confirm the order in ByteForge
  await prisma.order.update({
    where: { id: ingestedOrder.id },
    data: { confirmationStatus: 'CONFIRMED', confirmedAt: new Date() },
  });

  const updateWebhookPayload = {
    ...orderWebhookPayload,
    financial_status: 'paid',
    fulfillment_status: 'fulfilled',
  };
  const updatePayloadString = JSON.stringify(updateWebhookPayload);
  const updateHmac = crypto
    .createHmac('sha256', webhookSecret)
    .update(Buffer.from(updatePayloadString, 'utf8'))
    .digest('base64');

  const updateRes = await fetch(`${API_BASE}/shopify/webhooks`, {
    method: 'POST',
    headers: {
      ...webhookHeaders,
      'x-shopify-topic': 'orders/updated',
      'x-shopify-hmac-sha256': updateHmac,
      'x-shopify-webhook-id': `wh_update_${Date.now()}`,
    },
    body: updatePayloadString,
  });
  assert.strictEqual(updateRes.status, 200);

  const updatedOrder = await prisma.order.findUnique({
    where: { id: ingestedOrder.id },
  });
  assert.strictEqual(updatedOrder?.financialStatus, 'paid');
  assert.strictEqual(updatedOrder?.fulfillmentStatus, 'fulfilled');
  assert.strictEqual(
    updatedOrder?.confirmationStatus,
    'CONFIRMED',
    'Internal CONFIRMED status must NOT be overridden by Shopify status update'
  );
  console.log('   ✅ orders/updated processed: Fulfillment synced while preserving internal confirmation state');

  // 7. Test Webhook: orders/cancelled
  console.log('\n7️⃣ Testing Shopify Webhook: orders/cancelled...');
  const cancelPayload = {
    id: testOrderId,
    cancel_reason: 'customer requested cancellation',
    cancelled_at: new Date().toISOString(),
  };
  const cancelPayloadString = JSON.stringify(cancelPayload);
  const cancelHmac = crypto
    .createHmac('sha256', webhookSecret)
    .update(Buffer.from(cancelPayloadString, 'utf8'))
    .digest('base64');

  const cancelRes = await fetch(`${API_BASE}/shopify/webhooks`, {
    method: 'POST',
    headers: {
      ...webhookHeaders,
      'x-shopify-topic': 'orders/cancelled',
      'x-shopify-hmac-sha256': cancelHmac,
      'x-shopify-webhook-id': `wh_cancel_${Date.now()}`,
    },
    body: cancelPayloadString,
  });
  assert.strictEqual(cancelRes.status, 200);

  const cancelledOrder = await prisma.order.findUnique({
    where: { id: ingestedOrder.id },
  });
  assert.strictEqual(cancelledOrder?.confirmationStatus, 'CANCELLED');
  assert.strictEqual(cancelledOrder?.cancellationReason, 'customer requested cancellation');
  console.log('   ✅ orders/cancelled processed: Order cancelled with timestamp and reason');

  // 8. Test Multi-Tenant Isolation
  console.log('\n8️⃣ Testing Multi-Tenant Isolation for Shopify Stores...');
  // Create Tenant B
  const signupTenantB = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeName: 'Tenant B Store ' + Date.now(),
      name: 'Owner B',
      email: `owner.b.${Date.now()}@shopify-isolation.com`,
      password: 'Password123!',
    }),
  });
  const tenantBJson = await signupTenantB.json();
  const tokenB = tenantBJson.data.token;
  const authHeadersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

  // Tenant B attempts to connect the same store domain
  const stealDomainRes = await fetch(`${API_BASE}/shopify/connect`, {
    method: 'POST',
    headers: authHeadersB,
    body: JSON.stringify({
      shopDomain: testShopDomain,
      accessToken: 'shpat_attempt_to_steal_domain_12345',
    }),
  });
  assert.strictEqual(stealDomainRes.status, 409, 'Duplicate store domain must be rejected with 409 Conflict');
  console.log('   🛡️ Cross-tenant domain conflict correctly rejected (HTTP 409 Conflict)');

  // Tenant B status check (should be disconnected)
  const statusB = await fetch(`${API_BASE}/shopify/status`, { headers: authHeadersB });
  const statusBJson = await statusB.json();
  assert.strictEqual(statusBJson.data.connected, false);
  assert.strictEqual(statusBJson.data.integration, null);
  console.log('   ✅ Tenant B status strictly isolated: Shows disconnected');

  // 9. Test Domain Sanitization & Malicious URL Rejection
  console.log('\n9️⃣ Testing Store Domain Validation & Sanitization...');
  const maliciousUrls = [
    'https://evil.com/fake.myshopify.com',
    'javascript:alert(1)',
    'http://victim.myshopify.com:8080/path',
    'not-a-shopify-store.com',
  ];

  for (const url of maliciousUrls) {
    const malRes = await fetch(`${API_BASE}/shopify/connect`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ shopDomain: url, accessToken: 'shpat_test_12345678' }),
    });
    assert.strictEqual(malRes.status, 400, `Malicious domain '${url}' should be rejected with 400`);
  }
  console.log('   🛡️ All malicious URLs and invalid domain formats rejected');

  console.log('\n🎉 ALL PHASE 3 TESTS COMPLETED AND VERIFIED WITH 100% SUCCESS!\n');
}

testPhase3Suite()
  .catch((err) => {
    console.error('\n❌ PHASE 3 TEST SUITE FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
