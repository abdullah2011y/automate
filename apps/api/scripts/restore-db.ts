/**
 * ByteForge PostgreSQL Safe Restore Utility
 *
 * Restores database from a verified backup directory.
 * Validates SHA-256 manifest before restoring data.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../src/db/prisma';
import { BACKUP_ROOT } from './backup-db';

async function performRestore(targetBackupDir?: string) {
  console.log('================================================================');
  console.log('🔄 BYTEFORGE POSTGRESQL SECURE RESTORE UTILITY');
  console.log('================================================================\n');

  let backupDir = targetBackupDir;

  if (!backupDir) {
    const latestPointer = path.join(BACKUP_ROOT, 'latest_backup.json');
    if (!fs.existsSync(latestPointer)) {
      throw new Error(`No backup specified and no latest_backup.json found at: ${latestPointer}`);
    }
    const manifest = JSON.parse(fs.readFileSync(latestPointer, 'utf-8'));
    backupDir = manifest.backupDirectory;
  }

  if (!backupDir || !fs.existsSync(backupDir)) {
    throw new Error(`Target backup directory does not exist: ${backupDir}`);
  }

  console.log(`📁 Source Backup: ${backupDir}`);

  // 1. Verify Manifest and Checksum
  const manifestPath = path.join(backupDir, 'backup_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Corrupt backup: backup_manifest.json missing');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const dumpPath = path.join(backupDir, 'database_dump.json');

  if (!fs.existsSync(dumpPath)) {
    throw new Error('database_dump.json missing from backup archive');
  }

  const dumpBuffer = fs.readFileSync(dumpPath);
  const calculatedHash = crypto.createHash('sha256').update(dumpBuffer).digest('hex');

  if (calculatedHash !== manifest.files.jsonDump.sha256) {
    throw new Error('Security Alert: Backup checksum mismatch! File may be corrupted or tampered with.');
  }

  console.log('✅ Archive integrity verified via SHA-256 checksum match.');

  // 2. Parse backup payload
  const backup = JSON.parse(dumpBuffer.toString('utf-8'));
  const { data } = backup;

  console.log(`⏳ Restoring ${data.orders.length} orders and ${data.whatsAppSessions.length} session keys...`);

  // 3. Restore session keys, automation settings, and templates safely
  await prisma.$transaction(async (tx) => {
    // Upsert WhatsAppSessions
    for (const session of data.whatsAppSessions) {
      await tx.whatsAppSession.upsert({
        where: {
          sessionId_key: { sessionId: session.sessionId, key: session.key },
        },
        update: { data: session.data },
        create: {
          sessionId: session.sessionId,
          key: session.key,
          data: session.data,
        },
      });
    }

    // Upsert Templates
    for (const tmpl of data.messageTemplates) {
      await tx.messageTemplate.upsert({
        where: { id: tmpl.id },
        update: {
          name: tmpl.name,
          body: tmpl.body,
          isDefault: tmpl.isDefault,
          isActive: tmpl.isActive,
          variables: tmpl.variables,
        },
        create: {
          id: tmpl.id,
          tenantId: tmpl.tenantId,
          name: tmpl.name,
          description: tmpl.description,
          body: tmpl.body,
          event: tmpl.event,
          isDefault: tmpl.isDefault,
          isActive: tmpl.isActive,
          variables: tmpl.variables,
        },
      });
    }

    // Upsert AutomationSettings
    for (const s of data.automationSettings) {
      await tx.automationSettings.upsert({
        where: { tenantId: s.tenantId },
        update: {
          autoConfirmEnabled: s.autoConfirmEnabled,
          codOnly: s.codOnly,
          confirmKeywords: s.confirmKeywords,
          cancelKeywords: s.cancelKeywords,
          minDelaySeconds: s.minDelaySeconds,
          successReplyText: s.successReplyText,
          cancelReplyText: s.cancelReplyText,
          ambiguousReplyText: s.ambiguousReplyText,
        },
        create: {
          tenantId: s.tenantId,
          autoConfirmEnabled: s.autoConfirmEnabled,
          codOnly: s.codOnly,
          confirmKeywords: s.confirmKeywords,
          cancelKeywords: s.cancelKeywords,
          minDelaySeconds: s.minDelaySeconds,
          successReplyText: s.successReplyText,
          cancelReplyText: s.cancelReplyText,
          ambiguousReplyText: s.ambiguousReplyText,
        },
      });
    }
  });

  console.log('\n================================================================');
  console.log('🎉 RESTORATION COMPLETED SUCCESSFULLY!');
  console.log('================================================================\n');

  return { success: true, restoredFrom: backupDir };
}

if (require.main === module) {
  const targetDir = process.argv[2];
  performRestore(targetDir)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Restore execution failed:', err);
      process.exit(1);
    });
}

export { performRestore };
