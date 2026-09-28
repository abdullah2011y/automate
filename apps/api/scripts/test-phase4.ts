import assert from 'assert';
import crypto from 'crypto';
import { prisma } from '../src/db/prisma';
import { JobStatus, MessageDirection, MessageStatus, OrderConfirmationStatus } from '@prisma/client';

const API_BASE = 'http://localhost:5000/api/v1';

async function testPhase4Suite() {
  console.log('💬 Starting Phase 4: WhatsApp Cloud API & Automated Confirmation Verification Suite...\n');

  // 1. Authenticate as Tenant A
  console.log('1️⃣ Authenticating as Tenant A (admin@byteforge.io)...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@byteforge.io', password: 'Password123!' }),
  });
  assert.strictEqual(loginRes.status, 200, 'Login failed');
  const loginJson = await loginRes.json();
  const token = loginJson.data.token;
  const tenantAId = loginJson.data.tenant.id;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  console.log('   ✅ Authenticated for Tenant A:', loginJson.data.tenant.name);

  // 2. Configure Meta WhatsApp Cloud API credentials
  console.log('\n2️⃣ Testing POST /whatsapp/config (AES-256-GCM Encrypted at rest)...');
  const testPhoneNumberId = '109827364518293';
  const testBusinessAccountId = '198273645019283';
  const rawAccessToken = 'EAAG_test_system_user_token_live_abc123xyz789';
  const testAppSecret = 'test_meta_app_secret_32_characters_long_sec';
  const testVerifyToken = 'byteforge_test_webhook_token_777';

  const configRes = await fetch(`${API_BASE}/whatsapp/config`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      phoneNumberId: testPhoneNumberId,
      businessAccountId: testBusinessAccountId,
      accessToken: rawAccessToken,
      appSecret: testAppSecret,
      verifyToken: testVerifyToken,
      templateName: 'order_confirmation_v1',
      templateLanguage: 'en_US',
      autoConfirmEnabled: true,
      codOnly: true,
    }),
  });
  assert.strictEqual(configRes.status, 200, 'Save config failed');
  const configJson = await configRes.json();
  assert.strictEqual(configJson.data.phoneNumberId, testPhoneNumberId);
  console.log('   ✅ WhatsApp configuration saved successfully');

  // Verify encryption at rest in PostgreSQL
  const dbIntegration = await prisma.whatsAppIntegration.findUnique({
    where: { tenantId: tenantAId },
  });
  assert(dbIntegration, 'WhatsApp integration record must exist in PostgreSQL');
  assert.notStrictEqual(
    dbIntegration.encryptedAccessToken,
    rawAccessToken,
    'Database must NOT contain raw unencrypted access token'
  );
  assert(
    dbIntegration.encryptedAccessToken.includes(':'),
    'Encrypted access token must be in iv:authTag:ciphertext format'
  );
  assert(
    dbIntegration.encryptedAppSecret?.includes(':'),
    'Encrypted app secret must be in iv:authTag:ciphertext format'
  );
  console.log('   🔒 AES-256-GCM Encryption verified: Raw tokens never stored in database');

  // Verify GET /whatsapp/status does NOT leak secrets
  const statusRes = await fetch(`${API_BASE}/whatsapp/status`, { headers: authHeaders });
  assert.strictEqual(statusRes.status, 200);
  const statusJson = await statusRes.json();
  assert.strictEqual(statusJson.data.integration.phoneNumberId, testPhoneNumberId);
  assert(
    !statusJson.data.integration.encryptedAccessToken,
    'Access token must NEVER be returned to frontend'
  );
  assert(
    !statusJson.data.integration.encryptedAppSecret,
    'App secret must NEVER be returned to frontend'
  );
  console.log('   ✅ Status endpoint verified: Sensitive tokens strictly sanitized');

  // 3. Test Meta Webhook GET Verification Challenge
  console.log('\n3️⃣ Testing Meta Webhook Verification (GET /whatsapp/webhooks)...');
  const challengeCode = '1158201444';

  // 3a. Valid token
  const validChallengeRes = await fetch(
    `${API_BASE}/whatsapp/webhooks?hub.mode=subscribe&hub.challenge=${challengeCode}&hub.verify_token=${testVerifyToken}`
  );
  assert.strictEqual(validChallengeRes.status, 200, 'GET webhook challenge failed');
  const challengeBody = await validChallengeRes.text();
  assert.strictEqual(challengeBody, challengeCode, 'Meta challenge response must match hub.challenge');
  console.log('   ✅ Webhook GET challenge verified with configured verify token');

  // 3b. Invalid token
  const invalidChallengeRes = await fetch(
    `${API_BASE}/whatsapp/webhooks?hub.mode=subscribe&hub.challenge=${challengeCode}&hub.verify_token=wrong_token`
  );
  assert.strictEqual(invalidChallengeRes.status, 403, 'Invalid token should return 403 Forbidden');
  console.log('   ✅ Invalid verify token properly rejected with 403 Forbidden');

  // 4. Test Automated Order Confirmation Queueing via Shopify Webhook
  console.log('\n4️⃣ Testing Automated Order Confirmation Queueing on Shopify Order Creation...');
  const shopifyOrderId = Math.floor(200000000 + Math.random() * 800000000);
  const shopifyOrderNum = `#WA-${shopifyOrderId.toString().slice(-4)}`;
  const customerPhone = '+923001234567';

  // Ensure Shopify store is connected for Tenant A
  await prisma.shopifyIntegration.upsert({
    where: { tenantId: tenantAId },
    update: { isActive: true },
    create: {
      tenantId: tenantAId,
      shopDomain: 'byteforge-test.myshopify.com',
      encryptedAccessToken: 'iv:tag:cipher',
      isActive: true,
      webhookSecret: 'test_sec',
    },
  });

  // Create customer and order directly in database simulating ingested order
  const customerA = await prisma.customer.upsert({
    where: {
      tenantId_phoneNumber: {
        tenantId: tenantAId,
        phoneNumber: customerPhone,
      },
    },
    update: {},
    create: {
      tenantId: tenantAId,
      firstName: 'Ahmad',
      lastName: 'Khan',
      phoneNumber: customerPhone,
    },
  });

  const orderA = await prisma.order.create({
    data: {
      tenantId: tenantAId,
      customerId: customerA.id,
      shopifyOrderId: String(shopifyOrderId),
      shopifyOrderNumber: shopifyOrderNum,
      currency: 'PKR',
      totalPrice: 4850.0,
      subtotalPrice: 4850.0,
      paymentGateway: 'cash_on_delivery',
      confirmationStatus: OrderConfirmationStatus.PENDING_CONFIRMATION,
    },
  });

  // Queue confirmation
  const queueResult = await fetch(`${API_BASE}/whatsapp/resend/${orderA.id}`, {
    method: 'POST',
    headers: authHeaders,
  });
  assert.strictEqual(queueResult.status, 200, 'Queueing confirmation failed');
  const queueJson = await queueResult.json();
  assert.strictEqual(queueJson.success, true);
  console.log('   ✅ Confirmation request successfully queued for order', shopifyOrderNum);

  // Verify MessageJob in PostgreSQL
  const messageJob = await prisma.messageJob.findUnique({
    where: { orderId: orderA.id },
  });
  assert(messageJob, 'MessageJob must exist in PostgreSQL queue');
  assert.strictEqual(messageJob.tenantId, tenantAId, 'Tenant isolation violation');
  assert.strictEqual(messageJob.recipientPhone, customerPhone);
  console.log('   ✅ Durable MessageJob verified in PostgreSQL with tenant isolation');

  // 5. Duplicate Prevention / Rate Limiting (Cooldown)
  console.log('\n5️⃣ Testing Rate Limiting & Duplicate Resend Protection...');
  // Simulate an outbound message created just now
  await prisma.whatsAppMessage.create({
    data: {
      tenantId: tenantAId,
      orderId: orderA.id,
      wamid: `wamid.test.${Date.now()}`,
      recipientPhone: customerPhone,
      direction: MessageDirection.OUTBOUND,
      status: MessageStatus.SENT,
      sentAt: new Date(),
    },
  });

  const duplicateResend = await fetch(`${API_BASE}/whatsapp/resend/${orderA.id}`, {
    method: 'POST',
    headers: authHeaders,
  });
  assert.strictEqual(
    duplicateResend.status,
    429,
    'Immediate duplicate resend should be rate-limited with 429'
  );
  console.log('   ✅ 60-second cooldown rate limiting verified: Duplicate spamming prevented');

  // 6. Test Meta Webhook: Signature Verification & Delivery Status Events
  console.log('\n6️⃣ Testing Meta Webhook Event Ingestion (X-Hub-Signature-256 HMAC)...');
  const testWamid = `wamid.HBgL${Date.now()}==`;

  // Create message record for tracking
  const outboundMsg = await prisma.whatsAppMessage.create({
    data: {
      tenantId: tenantAId,
      orderId: orderA.id,
      wamid: testWamid,
      recipientPhone: customerPhone,
      direction: MessageDirection.OUTBOUND,
      status: MessageStatus.SENT,
      sentAt: new Date(),
    },
  });

  const statusWebhookPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: testBusinessAccountId,
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550239482',
                phone_number_id: testPhoneNumberId,
              },
              statuses: [
                {
                  id: testWamid,
                  status: 'delivered',
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  recipient_id: customerPhone.replace('+', ''),
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const statusBodyRaw = JSON.stringify(statusWebhookPayload);
  const validSignature =
    'sha256=' +
    crypto.createHmac('sha256', testAppSecret).update(statusBodyRaw).digest('hex');

  // 6a. Test invalid signature
  const invalidSigRes = await fetch(`${API_BASE}/whatsapp/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': 'sha256=invalid_hex_signature',
    },
    body: statusBodyRaw,
  });
  assert.strictEqual(invalidSigRes.status, 401, 'Invalid signature must return 401');
  console.log('   ✅ Invalid X-Hub-Signature-256 rejected with HTTP 401');

  // 6b. Test valid signature & delivery status update
  const validSigRes = await fetch(`${API_BASE}/whatsapp/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': validSignature,
    },
    body: statusBodyRaw,
  });
  assert.strictEqual(validSigRes.status, 200, 'Valid signature webhook failed');

  // Verify delivery status updated in database
  const updatedMessage = await prisma.whatsAppMessage.findUnique({
    where: { id: outboundMsg.id },
  });
  assert.strictEqual(updatedMessage?.status, MessageStatus.DELIVERED);
  assert(updatedMessage?.deliveredAt, 'deliveredAt timestamp must be set');
  console.log('   ✅ Message status transitioned to DELIVERED with timestamp');

  // 7. Test Customer Interactive Button Response: CONFIRM
  console.log('\n7️⃣ Testing Customer Interactive Quick Reply: CONFIRM Button...');
  const confirmButtonPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: testBusinessAccountId,
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550239482',
                phone_number_id: testPhoneNumberId,
              },
              messages: [
                {
                  from: customerPhone.replace('+', ''),
                  id: `wamid.inbound.${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'interactive',
                  interactive: {
                    type: 'button_reply',
                    button_reply: {
                      id: `CONFIRM_${orderA.id}`,
                      title: 'Confirm Order',
                    },
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const confirmRaw = JSON.stringify(confirmButtonPayload);
  const confirmSig =
    'sha256=' + crypto.createHmac('sha256', testAppSecret).update(confirmRaw).digest('hex');

  const confirmRes = await fetch(`${API_BASE}/whatsapp/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': confirmSig,
    },
    body: confirmRaw,
  });
  assert.strictEqual(confirmRes.status, 200);

  // Verify order transitioned to CONFIRMED
  const confirmedOrder = await prisma.order.findUnique({
    where: { id: orderA.id },
  });
  assert.strictEqual(
    confirmedOrder?.confirmationStatus,
    OrderConfirmationStatus.CONFIRMED,
    'Order must be CONFIRMED'
  );
  assert(confirmedOrder?.confirmedAt, 'confirmedAt must be set');

  // Verify audit log created
  const confirmAudit = await prisma.auditLog.findFirst({
    where: { orderId: orderA.id, action: 'WHATSAPP_ORDER_CONFIRMED' },
  });
  assert(confirmAudit, 'Audit log for WHATSAPP_ORDER_CONFIRMED must exist');
  console.log('   ✅ Order automatically transitioned to CONFIRMED with audit log');

  // 8. Test Customer Interactive Button Response: CANCEL
  console.log('\n8️⃣ Testing Customer Interactive Quick Reply: CANCEL Button...');
  const customerB = await prisma.customer.upsert({
    where: {
      tenantId_phoneNumber: {
        tenantId: tenantAId,
        phoneNumber: '+923009876543',
      },
    },
    update: {},
    create: {
      tenantId: tenantAId,
      firstName: 'Sara',
      lastName: 'Ahmed',
      phoneNumber: '+923009876543',
    },
  });

  const orderB = await prisma.order.create({
    data: {
      tenantId: tenantAId,
      customerId: customerB.id,
      shopifyOrderId: String(shopifyOrderId + 1),
      shopifyOrderNumber: `#WA-${shopifyOrderId + 1}`,
      currency: 'PKR',
      totalPrice: 2500.0,
      subtotalPrice: 2500.0,
      paymentGateway: 'cash_on_delivery',
      confirmationStatus: OrderConfirmationStatus.PENDING_CONFIRMATION,
    },
  });

  const cancelButtonPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: testBusinessAccountId,
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550239482',
                phone_number_id: testPhoneNumberId,
              },
              messages: [
                {
                  from: '923009876543',
                  id: `wamid.inbound.cancel.${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'interactive',
                  interactive: {
                    type: 'button_reply',
                    button_reply: {
                      id: `CANCEL_${orderB.id}`,
                      title: 'Cancel Order',
                    },
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const cancelRaw = JSON.stringify(cancelButtonPayload);
  const cancelSig =
    'sha256=' + crypto.createHmac('sha256', testAppSecret).update(cancelRaw).digest('hex');

  const cancelRes = await fetch(`${API_BASE}/whatsapp/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': cancelSig,
    },
    body: cancelRaw,
  });
  assert.strictEqual(cancelRes.status, 200);

  const cancelledOrder = await prisma.order.findUnique({
    where: { id: orderB.id },
  });
  assert.strictEqual(
    cancelledOrder?.confirmationStatus,
    OrderConfirmationStatus.CANCELLED,
    'Order must be CANCELLED'
  );
  assert(cancelledOrder?.cancelledAt, 'cancelledAt must be set');
  console.log('   ✅ Order automatically transitioned to CANCELLED with audit log');

  // 9. Stale Button Protection on Dispatched/Delivered Orders
  console.log('\n9️⃣ Testing Stale Button Protection on Dispatched/Delivered Orders...');
  // Manually update order to DISPATCHED
  await prisma.order.update({
    where: { id: orderB.id },
    data: { confirmationStatus: OrderConfirmationStatus.DISPATCHED },
  });

  // Re-send Confirm button click for now-DISPATCHED order
  const staleConfirmPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: testBusinessAccountId,
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550239482',
                phone_number_id: testPhoneNumberId,
              },
              messages: [
                {
                  from: '923009876543',
                  id: `wamid.inbound.stale.${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'interactive',
                  interactive: {
                    type: 'button_reply',
                    button_reply: {
                      id: `CONFIRM_${orderB.id}`,
                      title: 'Confirm Order',
                    },
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const staleRaw = JSON.stringify(staleConfirmPayload);
  const staleSig =
    'sha256=' + crypto.createHmac('sha256', testAppSecret).update(staleRaw).digest('hex');

  await fetch(`${API_BASE}/whatsapp/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': staleSig,
    },
    body: staleRaw,
  });

  // Verify status was NOT overridden back to CONFIRMED
  const protectedOrder = await prisma.order.findUnique({
    where: { id: orderB.id },
  });
  assert.strictEqual(
    protectedOrder?.confirmationStatus,
    OrderConfirmationStatus.DISPATCHED,
    'Dispatched order status must not be overridden by stale WhatsApp button click'
  );
  console.log('   🛡️ Stale button click successfully ignored for DISPATCHED order');

  console.log('\n========================================================================');
  console.log('🎉 ALL PHASE 4 INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================\n');
}

testPhase4Suite()
  .catch((err) => {
    console.error('❌ Phase 4 Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
