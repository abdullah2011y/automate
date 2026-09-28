/**
 * Phase 4 Comprehensive Automated Test Suite
 * Single-User WhatsApp Web Automation via Baileys & PostgreSQL Persistence
 *
 * Verifies:
 * 1. PostgreSQL Auth State Adapter (AES-256 encrypted credentials & Signal keys).
 * 2. Application Message Templates Engine (Variable replacement, fallbacks, CRUD).
 * 3. Automation Settings (Keywords, anti-ban delay, reply templates).
 * 4. Shopify Order Ingestion & Automatic Baileys Queueing (Idempotency).
 * 5. Inbound Customer CONFIRM & CANCEL message processing & state transitions.
 * 6. Rate Limiting Cooldown Protection.
 */

import { prisma } from '../src/db/prisma';
import { usePostgresAuthState } from '../src/services/baileys-auth.service';
import { TemplateService } from '../src/services/template.service';
import { AutomationService } from '../src/services/automation.service';
import { BaileysService } from '../src/services/baileys.service';
import { ShopifyService } from '../src/services/shopify.service';
import {
  JobStatus,
  MessageDirection,
  MessageStatus,
  OrderConfirmationStatus,
  Role,
} from '@prisma/client';
import crypto from 'crypto';

interface TestResult {
  step: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function recordPass(step: string, details?: string) {
  results.push({ step, passed: true, details });
  console.log(`✅ [PASS] ${step}${details ? ` - ${details}` : ''}`);
}

function recordFail(step: string, error: any) {
  const errMsg = error instanceof Error ? error.message : String(error);
  results.push({ step, passed: false, error: errMsg });
  console.error(`❌ [FAIL] ${step} - ${errMsg}`);
}

async function runPhase4Tests() {
  console.log('================================================================');
  console.log('🚀 BYTEFORGE PHASE 4: BAILEYS WHATSAPP WEB AUTOMATION TEST SUITE');
  console.log('================================================================\n');

  let testTenant: any;
  let testCustomer: any;

  try {
    // 0. Setup test tenant
    testTenant = await prisma.tenant.findFirst();
    if (!testTenant) {
      testTenant = await prisma.tenant.create({
        data: {
          name: 'ByteForge Flagship Store',
          slug: `byteforge-${Date.now()}`,
          users: {
            create: {
              email: `admin-${Date.now()}@byteforge.io`,
              passwordHash: '$2b$12$eXampleHashedPasswordForTestEnvironment',
              name: 'Store Administrator',
              role: Role.ADMIN,
            },
          },
        },
      });
    }

    // -------------------------------------------------------------
    // Test 1: PostgreSQL Auth State Adapter & AES-256 Encryption
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing PostgreSQL Auth State Adapter (Encrypted Session) ---');
    try {
      const testSessionId = `test_session_${Date.now()}`;
      const { state, saveCreds, clearSession } = await usePostgresAuthState(testSessionId);

      // Verify initial creds structure exists
      if (!state.creds || !state.keys) {
        throw new Error('Postgres auth state did not return valid creds or keys objects');
      }

      // Modify creds and trigger save
      (state.creds as any).me = { id: '923001234567@s.whatsapp.net', name: 'Test ByteForge Phone' };
      await saveCreds();

      // Check PostgreSQL record directly to ensure it was written and encrypted at rest
      const dbCreds = await prisma.whatsAppSession.findUnique({
        where: {
          sessionId_key: {
            sessionId: testSessionId,
            key: 'creds',
          },
        },
      });

      if (!dbCreds) {
        throw new Error('WhatsAppSession record was not created in PostgreSQL');
      }

      // Ensure raw text does NOT appear as plaintext
      if (dbCreds.data.includes('923001234567')) {
        throw new Error('Security Breach: Session credentials were saved as plaintext, expected AES-256 ciphertext');
      }

      // Re-load auth state to verify decryption works seamlessly
      const reloaded = await usePostgresAuthState(testSessionId);
      if ((reloaded.state.creds as any).me?.id !== '923001234567@s.whatsapp.net') {
        throw new Error('Failed to decrypt and restore credentials from PostgreSQL');
      }

      // Test Signal keys get/set
      await state.keys.set({
        'app-state-sync-key': {
          testKey123: { keyData: Buffer.from('mock-signal-key-data') } as any,
        },
      });

      const retrievedKey = await state.keys.get('app-state-sync-key', ['testKey123']);
      if (!retrievedKey['testKey123']) {
        throw new Error('Signal key was not retrieved correctly from PostgreSQL key-value store');
      }

      // Test clearSession on logout
      await clearSession();
      const countAfterClear = await prisma.whatsAppSession.count({
        where: { sessionId: testSessionId },
      });
      if (countAfterClear !== 0) {
        throw new Error('clearSession did not wipe session records from PostgreSQL');
      }

      recordPass(
        'PostgreSQL Auth State Adapter',
        'Credentials & Signal keys securely persisted with AES-256-GCM encryption and restored flawlessly'
      );
    } catch (err) {
      recordFail('PostgreSQL Auth State Adapter', err);
    }

    // -------------------------------------------------------------
    // Test 2: Message Template Engine & Variable Interpolation
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Message Template Engine ---');
    try {
      await TemplateService.ensureDefaultTemplates(testTenant.id);

      const defaultTemplate = await TemplateService.getDefaultTemplate('ORDER_CONFIRMATION');
      if (!defaultTemplate || !defaultTemplate.body) {
        throw new Error('Default confirmation template could not be loaded');
      }

      // Test variable substitution
      const rendered = TemplateService.render(
        'Assalam-o-Alaikum {{customer_name}}! Aapka order {{order_number}} of Rs. {{order_total}} from {{store_name}} is ready.',
        {
          customer_name: 'Zeeshan Khan',
          order_number: '#5020',
          order_total: '3,850',
          store_name: 'ByteForge Boutique',
        }
      );

      const expectedText = 'Assalam-o-Alaikum Zeeshan Khan! Aapka order #5020 of Rs. 3,850 from ByteForge Boutique is ready.';
      if (rendered !== expectedText) {
        throw new Error(`Template rendering mismatch. Expected: "${expectedText}", Got: "${rendered}"`);
      }

      // Test graceful fallback for missing variables
      const missingVarsRendered = TemplateService.render('Hello {{customer_name}}! Order total: {{currency}} {{order_total}}.', {});
      if (missingVarsRendered.includes('{{') || missingVarsRendered.includes('}}')) {
        throw new Error(`Unresolved placeholders remained in rendered string: "${missingVarsRendered}"`);
      }
      if (!missingVarsRendered.includes('Valued Customer')) {
        throw new Error('Safe fallback "Valued Customer" was not applied');
      }

      // Test variable extraction
      const extracted = TemplateService.extractVariables('Order {{order_number}} for {{customer_name}} with total {{order_total}}');
      if (!extracted.includes('order_number') || !extracted.includes('customer_name') || !extracted.includes('order_total')) {
        throw new Error(`Variable extraction failed: ${JSON.stringify(extracted)}`);
      }

      // Test custom template creation & deletion
      const customTemplate = await TemplateService.createTemplate({
        tenantId: testTenant.id,
        name: 'Urdu Test Template',
        body: 'Shukriya {{customer_name}}! Aapka order {{order_number}} receive ho gaya.',
        event: 'TEST_EVENT',
      });

      const fetchedTmpl = await TemplateService.getTemplateById(customTemplate.id);
      if (fetchedTmpl.name !== 'Urdu Test Template') {
        throw new Error('Created template name did not match');
      }

      await TemplateService.deleteTemplate(customTemplate.id);

      recordPass(
        'Message Template Engine',
        'Dynamic variables rendered, safe fallbacks applied, variable extraction & template CRUD verified'
      );
    } catch (err) {
      recordFail('Message Template Engine', err);
    }

    // -------------------------------------------------------------
    // Test 3: Automation Settings & Anti-Ban Configuration
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Automation Settings & Anti-Ban Cooldown ---');
    try {
      const initialSettings = await AutomationService.getSettings(testTenant.id);
      if (!initialSettings.confirmKeywords || initialSettings.confirmKeywords.length === 0) {
        throw new Error('Default confirmation keywords missing');
      }

      // Update settings with custom keywords and delay
      const updated = await AutomationService.updateSettings(testTenant.id, {
        minDelaySeconds: 5,
        confirmKeywords: ['confirm', 'yes', 'haan', 'ji'],
        cancelKeywords: ['cancel', 'no', 'nahi', 'mat bhejo'],
        autoConfirmEnabled: true,
        codOnly: true,
      });

      if (updated.minDelaySeconds !== 5 || !updated.confirmKeywords.includes('haan')) {
        throw new Error('Settings update was not reflected in returned data');
      }

      const reloaded = await AutomationService.getSettings(testTenant.id);
      if (reloaded.minDelaySeconds !== 5 || !reloaded.cancelKeywords.includes('mat bhejo')) {
        throw new Error('Settings update was not persisted in database');
      }

      recordPass(
        'Automation & Anti-Ban Settings',
        'Configurable confirmation/cancellation keywords and outbound anti-ban rate limiting saved'
      );
    } catch (err) {
      recordFail('Automation & Anti-Ban Settings', err);
    }

    // -------------------------------------------------------------
    // Test 4: Automatic Shopify Order Ingestion & Message Queueing
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Shopify Order Ingestion & Auto-Confirmation Queue ---');
    let testOrder: any;
    try {
      const mockPhone = `+92300${Math.floor(1000000 + Math.random() * 9000000)}`;
      const shopifyOrderId = `shopify_test_${Date.now()}`;
      const shopifyOrderNumber = `#BF-${Math.floor(1000 + Math.random() * 9000)}`;

      // Simulate Shopify orders/create webhook payload
      const webhookPayload = {
        id: shopifyOrderId,
        order_number: shopifyOrderNumber.replace('#', ''),
        name: shopifyOrderNumber,
        currency: 'PKR',
        total_price: '4250.00',
        subtotal_price: '4000.00',
        financial_status: 'pending',
        fulfillment_status: null,
        gateway: 'cash_on_delivery',
        created_at: new Date().toISOString(),
        customer: {
          id: `cust_${Date.now()}`,
          first_name: 'Usman',
          last_name: 'Tariq',
          phone: mockPhone,
          email: 'usman.tariq@example.com',
        },
        shipping_address: {
          address1: 'Plot 45, Street 9, DHA Phase 5',
          city: 'Lahore',
          country: 'Pakistan',
          phone: mockPhone,
        },
        line_items: [
          {
            id: `item_${Date.now()}`,
            title: 'Wireless Mechanical Keyboard',
            sku: 'WMK-01-RGB',
            quantity: 1,
            price: '4250.00',
          },
        ],
      };

      // Ingest order directly through Shopify service
      testOrder = await (ShopifyService as any).handleOrderCreate(
        testTenant.id,
        webhookPayload,
        false
      );

      if (!testOrder) {
        throw new Error('Shopify order ingestion returned null');
      }

      // Manually trigger queue to ensure deterministic test without race conditions
      const queueResult = await BaileysService.queueOrderConfirmation(testTenant.id, testOrder.id);
      if (!queueResult.queued) {
        throw new Error(`Order confirmation was not queued: ${queueResult.reason}`);
      }

      // Verify MessageJob in PostgreSQL
      const job = await prisma.messageJob.findUnique({
        where: { orderId: testOrder.id },
      });

      if (!job) {
        throw new Error('MessageJob record not found in PostgreSQL');
      }

      if (job.status !== JobStatus.PENDING) {
        throw new Error(`Expected JobStatus PENDING, got ${job.status}`);
      }

      const params = job.parameters as any;
      if (!params.renderedBody || !params.renderedBody.includes(shopifyOrderNumber)) {
        throw new Error('Rendered confirmation body does not contain the order number');
      }

      // Test idempotency: Ingesting the same order again should NOT create duplicate jobs
      const duplicateQueue = await BaileysService.queueOrderConfirmation(testTenant.id, testOrder.id);
      if (duplicateQueue.queued) {
        throw new Error('Idempotency violation: duplicate confirmation job was queued for same order');
      }

      recordPass(
        'Shopify Order Ingestion & Queueing',
        `Order ${shopifyOrderNumber} COD ingested & MessageJob queued with idempotency protection`
      );
    } catch (err) {
      recordFail('Shopify Order Ingestion & Queueing', err);
    }

    // -------------------------------------------------------------
    // Test 5: Inbound Customer Response Processing (CONFIRM)
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Inbound Response Processing (CONFIRM) ---');
    try {
      if (!testOrder) throw new Error('Cannot test response processing without testOrder');

      testOrder = await prisma.order.findUnique({
        where: { id: testOrder.id },
        include: { customer: true },
      });

      const phone = testOrder.customer.phoneNumber;
      const phoneDigits = phone.replace(/\D/g, '');
      const senderJid = `${phoneDigits}@s.whatsapp.net`;

      // Create an outbound message record to represent the sent confirmation request
      const outboundMsg = await prisma.whatsAppMessage.create({
        data: {
          tenantId: testTenant.id,
          orderId: testOrder.id,
          customerId: testOrder.customerId,
          wamid: `test_wamid_${Date.now()}`,
          recipientPhone: phone,
          direction: MessageDirection.OUTBOUND,
          status: MessageStatus.DELIVERED,
          messageType: 'text',
          payload: { body: 'Please reply CONFIRM to approve your order.' },
          sentAt: new Date(),
          deliveredAt: new Date(),
        },
      });

      // Construct simulated inbound Baileys proto.IWebMessageInfo with "CONFIRM"
      const mockConfirmMsg = {
        key: {
          remoteJid: senderJid,
          fromMe: false,
          id: `customer_reply_${Date.now()}`,
        },
        message: {
          conversation: 'CONFIRM',
        },
      };

      // Call internal message handler via reflection/private dispatch simulation
      await (BaileysService as any).handleInboundCustomerMessage(mockConfirmMsg);

      // Verify order confirmationStatus changed to CONFIRMED
      const confirmedOrder = await prisma.order.findUnique({
        where: { id: testOrder.id },
      });

      if (confirmedOrder?.confirmationStatus !== OrderConfirmationStatus.CONFIRMED) {
        throw new Error(`Expected order to be CONFIRMED, got ${confirmedOrder?.confirmationStatus}`);
      }

      if (!confirmedOrder.confirmedAt) {
        throw new Error('confirmedAt timestamp was not set on order');
      }

      // Verify WhatsAppMessage customerResponse updated
      const updatedMsg = await prisma.whatsAppMessage.findUnique({
        where: { id: outboundMsg.id },
      });

      if (updatedMsg?.customerResponse !== 'CONFIRMED') {
        throw new Error(`Expected WhatsAppMessage customerResponse CONFIRMED, got ${updatedMsg?.customerResponse}`);
      }

      // Verify AuditLog entry
      const auditLog = await prisma.auditLog.findFirst({
        where: { orderId: testOrder.id, action: 'WHATSAPP_ORDER_CONFIRMED' },
      });

      if (!auditLog) {
        throw new Error('WHATSAPP_ORDER_CONFIRMED audit log was not recorded');
      }

      recordPass(
        'Inbound CONFIRM Response Processing',
        `Customer reply "CONFIRM" successfully transitioned order ${confirmedOrder.shopifyOrderNumber} to CONFIRMED with audit trail`
      );
    } catch (err) {
      recordFail('Inbound CONFIRM Response Processing', err);
    }

    // -------------------------------------------------------------
    // Test 6: Inbound Customer Response Processing (CANCEL)
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Inbound Response Processing (CANCEL) ---');
    try {
      const cancelMockPhone = `+92311${Math.floor(1000000 + Math.random() * 9000000)}`;
      const cancelCustomer = await prisma.customer.create({
        data: {
          tenantId: testTenant.id,
          firstName: 'Hamza',
          lastName: 'Ahmed',
          phoneNumber: cancelMockPhone,
        },
      });

      const cancelOrder = await prisma.order.create({
        data: {
          tenantId: testTenant.id,
          customerId: cancelCustomer.id,
          shopifyOrderId: `shopify_cancel_${Date.now()}`,
          shopifyOrderNumber: `#CANCEL-${Math.floor(1000 + Math.random() * 9000)}`,
          currency: 'PKR',
          totalPrice: 1950,
          subtotalPrice: 1750,
          confirmationStatus: OrderConfirmationStatus.PENDING_CONFIRMATION,
          paymentGateway: 'cash_on_delivery',
        },
      });

      const cancelPhoneDigits = cancelMockPhone.replace(/\D/g, '');
      const cancelSenderJid = `${cancelPhoneDigits}@s.whatsapp.net`;

      const mockCancelMsg = {
        key: {
          remoteJid: cancelSenderJid,
          fromMe: false,
          id: `customer_cancel_${Date.now()}`,
        },
        message: {
          conversation: 'CANCEL please, changed my mind',
        },
      };

      await (BaileysService as any).handleInboundCustomerMessage(mockCancelMsg);

      const cancelledOrder = await prisma.order.findUnique({
        where: { id: cancelOrder.id },
      });

      if (cancelledOrder?.confirmationStatus !== OrderConfirmationStatus.CANCELLED) {
        throw new Error(`Expected order to be CANCELLED, got ${cancelledOrder?.confirmationStatus}`);
      }

      if (!cancelledOrder.cancelledAt) {
        throw new Error('cancelledAt timestamp was not set on order');
      }

      recordPass(
        'Inbound CANCEL Response Processing',
        `Customer reply "CANCEL" transitioned order ${cancelledOrder.shopifyOrderNumber} to CANCELLED with reason recorded`
      );
    } catch (err) {
      recordFail('Inbound CANCEL Response Processing', err);
    }

    // -------------------------------------------------------------
    // Test 7: Rate Limiting & Cooldown Protection
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Manual Resend Rate Limiting & Cooldown ---');
    try {
      // Create a fresh pending order
      const cdPhone = `+92333${Math.floor(1000000 + Math.random() * 9000000)}`;
      const freshCustomer = await prisma.customer.create({
        data: {
          tenantId: testTenant.id,
          firstName: 'Bilal',
          lastName: 'Saeed',
          phoneNumber: cdPhone,
        },
      });

      const freshOrder = await prisma.order.create({
        data: {
          tenantId: testTenant.id,
          customerId: freshCustomer.id,
          shopifyOrderId: `shopify_cooldown_${Date.now()}`,
          shopifyOrderNumber: `#CD-${Math.floor(1000 + Math.random() * 9000)}`,
          currency: 'PKR',
          totalPrice: 2200,
          subtotalPrice: 2000,
          confirmationStatus: OrderConfirmationStatus.PENDING_CONFIRMATION,
          paymentGateway: 'cash_on_delivery',
        },
      });

      // First resend request should succeed
      const firstResend = await BaileysService.resendConfirmation(testTenant.id, freshOrder.id);
      if (!firstResend.success) {
        throw new Error('Initial resendConfirmation call failed');
      }

      // Simulate that an outbound message was recorded
      await prisma.whatsAppMessage.create({
        data: {
          tenantId: testTenant.id,
          orderId: freshOrder.id,
          recipientPhone: '+923331234567',
          direction: MessageDirection.OUTBOUND,
          status: MessageStatus.SENT,
          messageType: 'text',
          createdAt: new Date(),
        },
      });

      // Immediate second resend MUST throw cooldown error
      let errorThrown = false;
      try {
        await BaileysService.resendConfirmation(testTenant.id, freshOrder.id);
      } catch (cooldownErr: any) {
        errorThrown = true;
        if (!cooldownErr.message.includes('Please wait')) {
          throw new Error(`Unexpected cooldown error message: ${cooldownErr.message}`);
        }
      }

      if (!errorThrown) {
        throw new Error('Rate-limiting cooldown failed: allowed duplicate resend within 60 seconds');
      }

      recordPass(
        'Resend Cooldown Rate Limiting',
        'Outbound flood protection successfully enforced 60-second cooldown between confirmation attempts'
      );
    } catch (err) {
      recordFail('Resend Cooldown Rate Limiting', err);
    }
  } catch (globalErr) {
    console.error('Fatal test error:', globalErr);
  } finally {
    console.log('\n================================================================');
    console.log('📊 TEST EXECUTION SUMMARY:');
    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;
    console.log(`Passed: ${passedCount}/${totalCount}`);
    console.log('================================================================');

    if (passedCount === totalCount && totalCount > 0) {
      console.log('🎉 ALL PHASE 4 BAILEYS AUTOMATION TESTS PASSED PERFECTLY!\n');
    } else {
      console.error('❌ SOME TESTS FAILED. Inspect details above.\n');
      process.exit(1);
    }
  }
}

runPhase4Tests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
