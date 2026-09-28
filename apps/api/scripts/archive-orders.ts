/**
 * ByteForge 20-Day Safe Order Archival Utility
 *
 * Requirements:
 * 1. Strictly requires a verified backup in E:\ByteForge-Backups created within the last 24 hours.
 * 2. Archives only completed historical orders older than 20 days (CONFIRMED, CANCELLED, DELIVERED).
 * 3. Soft-archives by setting archivedAt = new Date().
 * 4. NEVER deletes customer records, credentials, session state, or audit logs.
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/prisma';
import { BACKUP_ROOT } from './backup-db';
import { OrderConfirmationStatus } from '@prisma/client';

async function performArchival() {
  console.log('================================================================');
  console.log('📦 BYTEFORGE 20-DAY SAFE ORDER ARCHIVAL UTILITY');
  console.log('================================================================\n');

  // 1. Verify that a recent verified backup exists
  const latestPointer = path.join(BACKUP_ROOT, 'latest_backup.json');
  if (!fs.existsSync(latestPointer)) {
    throw new Error(
      `Safety Abort: No verified backup found at ${latestPointer}. You must run "npm run db:backup" before archival can execute.`
    );
  }

  const manifest = JSON.parse(fs.readFileSync(latestPointer, 'utf-8'));
  const backupTime = new Date(manifest.timestamp).getTime();
  const now = Date.now();
  const maxBackupAgeMs = 24 * 60 * 60 * 1000; // 24 hours

  if (now - backupTime > maxBackupAgeMs) {
    throw new Error(
      `Safety Abort: The latest verified backup was created on ${manifest.timestamp} (> 24 hours ago). Please generate a fresh backup before archiving.`
    );
  }

  console.log(`✅ Verified backup confirmed: ${manifest.backupDirectory} (${manifest.timestamp})`);

  // 2. Query completed historical orders older than 20 days
  const twentyDaysAgo = new Date(now - 20 * 24 * 60 * 60 * 1000);

  const eligibleOrders = await prisma.order.findMany({
    where: {
      archivedAt: null,
      orderCreatedAt: { lte: twentyDaysAgo },
      confirmationStatus: {
        in: [
          OrderConfirmationStatus.CONFIRMED,
          OrderConfirmationStatus.CANCELLED,
          OrderConfirmationStatus.DELIVERED,
        ],
      },
    },
    select: {
      id: true,
      shopifyOrderNumber: true,
      confirmationStatus: true,
      orderCreatedAt: true,
    },
  });

  console.log(`📋 Found ${eligibleOrders.length} completed orders older than 20 days eligible for archival.`);

  if (eligibleOrders.length === 0) {
    console.log('ℹ️  No eligible orders need archival at this time.');
    return { success: true, archivedCount: 0 };
  }

  // 3. Mark eligible orders as archived (soft archival)
  const orderIds = eligibleOrders.map((o) => o.id);
  const result = await prisma.order.updateMany({
    where: { id: { in: orderIds } },
    data: { archivedAt: new Date() },
  });

  // Record in audit log
  const firstTenant = await prisma.tenant.findFirst();
  if (firstTenant) {
    await prisma.auditLog.create({
      data: {
        tenantId: firstTenant.id,
        action: 'HISTORICAL_ORDERS_ARCHIVED',
        details: {
          archivedCount: result.count,
          backupUsed: manifest.backupDirectory,
          cutoffDate: twentyDaysAgo.toISOString(),
        },
      },
    });
  }

  console.log(`🎉 Successfully archived ${result.count} historical orders. Active database records remain intact.`);
  return { success: true, archivedCount: result.count };
}

if (require.main === module) {
  performArchival()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Archival aborted:', err.message);
      process.exit(1);
    });
}

export { performArchival };
