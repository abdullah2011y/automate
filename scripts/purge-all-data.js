/**
 * ByteForge Database Purge Script
 * Wipes all transactional data (Orders, Customers, WhatsApp Messages,
 * Jobs, Audit Logs, Webhook Events, and Sessions) while safely preserving
 * Store Integrations, User Accounts, and Configuration Templates.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function purgeAllData() {
  console.log('\n\x1b[31m=======================================================');
  console.log('   ⚠️  PURGING ALL TRANSACTIONAL & CUSTOMER DATA');
  console.log('=======================================================\x1b[0m\n');

  try {
    // 1. Delete dependent order items
    const deletedOrderItems = await prisma.orderItem.deleteMany({});
    console.log(`✓ Deleted Order Items:       ${deletedOrderItems.count}`);

    // 2. Delete WhatsApp messages & jobs
    const deletedWAMessages = await prisma.whatsAppMessage.deleteMany({});
    console.log(`✓ Deleted WhatsApp Messages: ${deletedWAMessages.count}`);

    const deletedJobs = await prisma.messageJob.deleteMany({});
    console.log(`✓ Deleted Message Jobs:      ${deletedJobs.count}`);

    // 3. Delete Audit Logs & Webhook Events
    const deletedAudit = await prisma.auditLog.deleteMany({});
    console.log(`✓ Deleted Audit Logs:        ${deletedAudit.count}`);

    const deletedWebhooks = await prisma.webhookEvent.deleteMany({});
    console.log(`✓ Deleted Webhook Events:    ${deletedWebhooks.count}`);

    // 4. Delete Orders
    const deletedOrders = await prisma.order.deleteMany({});
    console.log(`✓ Deleted Orders:            ${deletedOrders.count}`);

    // 5. Delete Customers
    const deletedCustomers = await prisma.customer.deleteMany({});
    console.log(`✓ Deleted Customers:         ${deletedCustomers.count}`);

    // 6. Delete WhatsApp Sessions
    const deletedSessions = await prisma.whatsAppSession.deleteMany({});
    console.log(`✓ Deleted WhatsApp Sessions: ${deletedSessions.count}`);

    // 7. Reset Shopify Integration sync metrics
    const updatedShopify = await prisma.shopifyIntegration.updateMany({
      data: {
        syncedOrdersCount: 0,
        lastSyncedAt: null,
        lastWebhookAt: null,
        syncStatus: 'IDLE',
        syncError: null,
      },
    });
    console.log(`✓ Reset Shopify Sync State:  ${updatedShopify.count} store(s)`);

    // 8. Reset WhatsApp Integration status
    const updatedWA = await prisma.whatsAppIntegration.updateMany({
      data: {
        status: 'DISCONNECTED',
        qrCode: null,
        lastVerifiedAt: null,
        lastConnectedAt: null,
        errorMessage: null,
      },
    });
    console.log(`✓ Reset WhatsApp Connection: ${updatedWA.count} integration(s)`);

    console.log('\n\x1b[32m=======================================================');
    console.log('   ✅ DATA SUCCESSFULLY WIPED CLEAN FROM POSTGRESQL!');
    console.log('=======================================================\x1b[0m');
    console.log('Database is completely clean and ready to store fresh live data.\n');
  } catch (error) {
    console.error('\n\x1b[31m❌ Error purging data:\x1b[0m', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

purgeAllData();
