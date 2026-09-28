import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/prisma';
import {
  JobStatus,
  MessageDirection,
  MessageStatus,
  OrderConfirmationStatus,
} from '@prisma/client';
import { BaileysService } from '../src/services/baileys.service';
import { AutomationService } from '../src/services/automation.service';

const API_BASE = 'http://localhost:5000/api/v1';

async function runPhase5Suite() {
  console.log('🚀 [ByteForge Phase 5] Starting Production Readiness, Analytics, Security & Testing Suite...\n');

  // =========================================================================
  // 1. HEALTH CHECKS & DIAGNOSTICS
  // =========================================================================
  console.log('1️⃣ Testing Public & Authenticated Health Diagnostics...');

  // 1a. Public Liveness check
  const publicHealthRes = await fetch(`${API_BASE}/health`);
  assert.strictEqual(publicHealthRes.status, 200, 'Public health endpoint should return 200');
  const publicHealthJson = await publicHealthRes.json();
  assert.strictEqual(publicHealthJson.status, 'ok');
  assert.strictEqual(publicHealthJson.database.status, 'connected');
  assert(publicHealthJson.uptimeSeconds >= 0, 'Uptime must be non-negative');
  assert(publicHealthJson.system.memoryUsedMB > 0, 'Memory used must be tracked');
  console.log(`   ✅ Public /health: DB Latency = ${publicHealthJson.database.latencyMs}ms, Memory = ${publicHealthJson.system.memoryUsedMB}MB`);

  // =========================================================================
  // 2. AUTHENTICATION & SECURITY CONTROLS
  // =========================================================================
  console.log('\n2️⃣ Testing Administrator Authentication & Authorization...');

  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@byteforge.io', password: 'Password123!' }),
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login failed');
  const loginJson = await loginRes.json();
  const token = loginJson.data.token;
  const tenantId = loginJson.data.tenant.id;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  console.log('   ✅ Admin logged in successfully:', loginJson.data.user.email);

  // 2b. Detailed Health check (Authenticated)
  const detailedHealthRes = await fetch(`${API_BASE}/health/detailed`, { headers: authHeaders });
  assert.strictEqual(detailedHealthRes.status, 200, 'Detailed health should return 200 for admin');
  const detailedHealthJson = await detailedHealthRes.json();
  assert(detailedHealthJson.success, 'Detailed health success flag');
  assert.strictEqual(detailedHealthJson.data.database.status, 'healthy');
  assert(detailedHealthJson.data.shopify !== undefined, 'Shopify status must be reported');
  assert(detailedHealthJson.data.whatsapp !== undefined, 'WhatsApp socket status must be reported');
  assert(detailedHealthJson.data.queue !== undefined, 'Queue metrics must be reported');
  console.log('   ✅ Authenticated /health/detailed reports DB, Shopify, WhatsApp, and Queue health');

  // 2c. Rate Limiting on /auth/login (5 requests per 15 min limit)
  console.log('\n3️⃣ Testing In-Memory Sliding-Window Rate Limiting on /auth/login...');
  let hitRateLimit = false;
  const rateLimitSimulatedIp = `198.51.100.${Math.floor(Math.random() * 200 + 10)}`;
  for (let i = 0; i < 7; i++) {
    const attemptRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': rateLimitSimulatedIp,
      },
      body: JSON.stringify({ email: 'admin@byteforge.io', password: 'wrongpassword' }),
    });
    if (attemptRes.status === 429) {
      hitRateLimit = true;
      const rateLimitJson = await attemptRes.json();
      assert.strictEqual(rateLimitJson.error.code, 'RATE_LIMIT_EXCEEDED');
      console.log(`   ✅ Brute-force rate limiter triggered on attempt ${i + 1} with HTTP 429`);
      break;
    }
  }
  assert(hitRateLimit, 'Rate limiter should have triggered after threshold');

  // =========================================================================
  // 4. ANALYTICS ENGINE WITH REAL POSTGRESQL DATA
  // =========================================================================
  console.log('\n4️⃣ Testing Analytics Dashboard Engine with Temporal Date Ranges...');

  // Create a controlled sample order with known confirmation duration
  const testCustomer = await prisma.customer.upsert({
    where: {
      tenantId_phoneNumber: {
        tenantId,
        phoneNumber: '+923009998877',
      },
    },
    update: { isOptedOut: false, optedOutAt: null },
    create: {
      tenantId,
      firstName: 'Tariq',
      lastName: 'Mehmood',
      phoneNumber: '+923009998877',
      isOptedOut: false,
    },
  });

  const orderCreatedDate = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
  const orderConfirmedDate = new Date(Date.now() - 10 * 60 * 1000); // 10 mins ago (20 min confirmation duration)

  const sampleOrder = await prisma.order.create({
    data: {
      tenantId,
      customerId: testCustomer.id,
      shopifyOrderId: `phase5_ord_${Date.now()}`,
      shopifyOrderNumber: `#P5-${Math.floor(Math.random() * 9000 + 1000)}`,
      currency: 'PKR',
      totalPrice: 6500.0,
      subtotalPrice: 6500.0,
      financialStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      confirmationStatus: OrderConfirmationStatus.CONFIRMED,
      orderCreatedAt: orderCreatedDate,
      confirmedAt: orderConfirmedDate,
      items: {
        create: [
          {
            shopifyLineId: `item_${Date.now()}`,
            title: 'Phase 5 Performance Polo',
            quantity: 1,
            unitPrice: 6500.0,
          },
        ],
      },
    },
  });

  // Query different ranges
  const rangeTodayRes = await fetch(`${API_BASE}/analytics/overview?range=today`, { headers: authHeaders });
  assert.strictEqual(rangeTodayRes.status, 200);
  const rangeTodayJson = await rangeTodayRes.json();
  assert(rangeTodayJson.data.summary.totalOrdersInRange >= 1);
  assert(rangeTodayJson.data.summary.ordersToday >= 1);
  assert(rangeTodayJson.data.summary.confirmed >= 1);
  assert(rangeTodayJson.data.summary.avgConfirmationTime !== 'N/A', 'Average confirmation time must be calculated');
  console.log(`   ✅ /analytics/overview (today): Orders = ${rangeTodayJson.data.summary.ordersToday}, Avg Time = ${rangeTodayJson.data.summary.avgConfirmationTime}`);

  const range7dRes = await fetch(`${API_BASE}/analytics/overview?range=7d`, { headers: authHeaders });
  assert.strictEqual(range7dRes.status, 200);
  const range7dJson = await range7dRes.json();
  assert(range7dJson.data.trends.length > 0, 'Trends timeseries must be generated');
  console.log(`   ✅ /analytics/overview (7d): Returned ${range7dJson.data.trends.length} daily trend points`);

  const range30dRes = await fetch(`${API_BASE}/analytics/overview?range=30d`, { headers: authHeaders });
  assert.strictEqual(range30dRes.status, 200);
  const range30dJson = await range30dRes.json();
  assert(range30dJson.data.summary.confirmationRate !== undefined);
  assert(range30dJson.data.summary.messageDeliveryRate !== undefined);
  console.log(`   ✅ /analytics/overview (30d): Confirmation Rate = ${range30dJson.data.summary.confirmationRate}, Delivery Rate = ${range30dJson.data.summary.messageDeliveryRate}`);

  // =========================================================================
  // 5. AUTOMATION SETTINGS & SERVER-SIDE VALIDATION
  // =========================================================================
  console.log('\n5️⃣ Testing Automation Settings API & PostgreSQL Persistence...');

  const updateSettingsRes = await fetch(`${API_BASE}/whatsapp/automation-settings`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      autoConfirmEnabled: true,
      codOnly: true,
      minDelaySeconds: 15,
      confirmKeywords: ['1', 'CONFIRM', 'YES', 'HAAN', 'JI'],
      cancelKeywords: ['2', 'CANCEL', 'NO', 'NAHI'],
      optOutKeywords: ['STOP', 'UNSUBSCRIBE', 'OPTOUT', 'RUK JAO'],
      testPhoneNumber: '+923001234567',
      maxRetryAttempts: 3,
      skipMissingPhone: true,
    }),
  });
  assert.strictEqual(updateSettingsRes.status, 200);
  const updateSettingsJson = await updateSettingsRes.json();
  assert.strictEqual(updateSettingsJson.data.minDelaySeconds, 15);
  assert.strictEqual(updateSettingsJson.data.testPhoneNumber, '+923001234567');
  assert(
    updateSettingsJson.data.optOutKeywords.map((k: string) => k.toUpperCase()).includes('RUK JAO')
  );
  console.log('   ✅ Automation settings persisted successfully in PostgreSQL');

  // =========================================================================
  // 6. CUSTOMER OPT-OUT & SUPPRESSION COMPLIANCE
  // =========================================================================
  console.log('\n6️⃣ Testing Customer Opt-Out Suppression Workflow...');

  const optOutCustomerPhone = '923005551122';
  const optOutCustomer = await prisma.customer.upsert({
    where: {
      tenantId_phoneNumber: {
        tenantId,
        phoneNumber: optOutCustomerPhone,
      },
    },
    update: { isOptedOut: false, optedOutAt: null },
    create: {
      tenantId,
      firstName: 'Hamza',
      lastName: 'Khan',
      phoneNumber: optOutCustomerPhone,
      isOptedOut: false,
    },
  });

  // 6a. Simulate customer sending "STOP"
  await BaileysService.handleInboundCustomerMessage({
    key: { remoteJid: `${optOutCustomerPhone}@s.whatsapp.net` },
    message: { conversation: 'STOP please do not message me' },
  } as any);

  // Verify database record has isOptedOut = true
  const updatedCustomer = await prisma.customer.findUnique({
    where: { id: optOutCustomer.id },
  });
  assert(updatedCustomer?.isOptedOut, 'Customer must be marked as opted-out');
  assert(updatedCustomer?.optedOutAt !== null, 'optedOutAt timestamp must be recorded');
  console.log('   ✅ Customer sent "STOP": Database marked isOptedOut = true');

  // 6b. Attempt to queue confirmation for opted-out customer
  const optedOutOrder = await prisma.order.create({
    data: {
      tenantId,
      customerId: updatedCustomer.id,
      shopifyOrderId: `ord_opted_out_${Date.now()}`,
      shopifyOrderNumber: `#OPT-${Math.floor(Math.random() * 9000 + 1000)}`,
      currency: 'PKR',
      totalPrice: 3200.0,
      subtotalPrice: 3200.0,
      financialStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      confirmationStatus: OrderConfirmationStatus.PENDING_CONFIRMATION,
      orderCreatedAt: new Date(),
    },
  });

  const queueResult = await BaileysService.queueOrderConfirmation(tenantId, optedOutOrder.id);
  assert.strictEqual(queueResult.queued, false, 'Should NOT queue message for opted-out customer');
  assert(queueResult.reason?.includes('opted out'), 'Reason must specify customer opted out');
  console.log('   ✅ Queue suppression verified: Automation blocked sending to opted-out customer');

  // 6c. Test Customer Opt-In ("START")
  await BaileysService.handleInboundCustomerMessage({
    key: { remoteJid: `${optOutCustomerPhone}@s.whatsapp.net` },
    message: { conversation: 'START' },
  } as any);

  const reOptedCustomer = await prisma.customer.findUnique({
    where: { id: optOutCustomer.id },
  });
  assert.strictEqual(reOptedCustomer?.isOptedOut, false, 'Customer must be re-consented on START');
  console.log('   ✅ Customer sent "START": Successfully re-consented and opted back in');

  // =========================================================================
  // 7. SAFE TEST SEND SECURITY RESTRICTION
  // =========================================================================
  console.log('\n7️⃣ Testing Safe Test Send Restrictions...');

  // Attempting to send test to an arbitrary phone number NOT matching testPhoneNumber
  const unauthTestRes = await fetch(`${API_BASE}/whatsapp/templates/test-send`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      body: 'Hello World',
      recipientPhone: '+923000000000', // Does not match +923001234567
    }),
  });
  assert.strictEqual(unauthTestRes.status, 400, 'Arbitrary recipient should be blocked');
  const unauthTestJson = await unauthTestRes.json();
  assert(unauthTestJson.error.message.toLowerCase().includes('configured administrator test'));
  console.log('   ✅ Server-side security blocked test send to unconfigured recipient');

  // =========================================================================
  // 8. BACKUP INTEGRITY & ARCHIVAL SAFETY CHECKS
  // =========================================================================
  console.log('\n8️⃣ Verifying Backup Manifest & Safe Archival Protocol...');

  const backupDir = 'E:\\ByteForge-Backups';
  assert(fs.existsSync(backupDir), 'Backup directory E:\\ByteForge-Backups must exist');

  const latestPointer = path.join(backupDir, 'latest_backup.json');
  assert(fs.existsSync(latestPointer), 'latest_backup.json pointer must exist');

  const pointerData = JSON.parse(fs.readFileSync(latestPointer, 'utf8'));
  const backupPath = pointerData.backupDirectory;
  assert(fs.existsSync(backupPath), 'Pointed backup directory must exist');

  const manifestPath = path.join(backupPath, 'backup_manifest.json');
  assert(fs.existsSync(manifestPath), 'backup_manifest.json must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.files?.jsonDump?.sha256, 'Manifest must contain SHA-256 hash');
  assert(manifest.recordCounts?.orders !== undefined, 'Manifest must document orders table');

  // Verify file hash matches recorded SHA-256
  const dataFile = path.join(backupPath, 'database_dump.json');
  const fileBuffer = fs.readFileSync(dataFile);
  const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  assert.strictEqual(actualHash, manifest.files.jsonDump.sha256, 'SHA-256 integrity check must pass');
  console.log(`   ✅ Backup integrity verified: SHA-256 = ${actualHash.substring(0, 16)}...`);

  // Clean up test order
  await prisma.orderItem.deleteMany({ where: { orderId: sampleOrder.id } });
  await prisma.order.delete({ where: { id: sampleOrder.id } });
  await prisma.order.delete({ where: { id: optedOutOrder.id } });

  console.log('\n🎉 [ByteForge Phase 5] All Production Readiness, Analytics, Security & Testing Checks PASSED!');
}

runPhase5Suite()
  .catch((err) => {
    console.error('\n❌ Phase 5 Suite Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
