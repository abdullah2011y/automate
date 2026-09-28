import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { BaileysService } from '../services/baileys.service';
import { config } from '../config';
import { JobStatus } from '@prisma/client';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Public Liveness & Health Probe
 * Used by Northflank and load balancers to verify service availability.
 */
router.get('/', async (_req: Request, res: Response) => {
  const memory = process.memoryUsage();
  let dbOk = false;
  let dbLatencyMs = -1;

  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch (err) {
    dbOk = false;
  }

  const statusCode = dbOk ? 200 : 503;

  res.status(statusCode).json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'byteforge-omni-commerce-api',
    version: '1.0.0',
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbOk ? 'connected' : 'disconnected',
      latencyMs: dbLatencyMs,
    },
    system: {
      memoryUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
      memoryTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
      nodeVersion: process.version,
    },
  });
});

/**
 * Authenticated Detailed Diagnostics Endpoint
 * Provides comprehensive monitoring of DB, Shopify, Baileys, and Queue health for dashboard.
 */
router.get('/detailed', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const memory = process.memoryUsage();

  // Test DB latency
  const t0 = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const dbLatencyMs = Date.now() - t0;

  // Retrieve Shopify integration status
  const shopify = await prisma.shopifyIntegration.findFirst({
    where: { tenantId },
    select: {
      shopDomain: true,
      isActive: true,
      lastSyncedAt: true,
      lastWebhookAt: true,
      syncStatus: true,
      syncError: true,
    },
  });

  // Retrieve Baileys live status
  const baileys = BaileysService.getStatus();

  // Retrieve Message Queue stats
  const [pendingJobs, processingJobs, failedJobs, completedJobs] = await Promise.all([
    prisma.messageJob.count({ where: { tenantId, status: JobStatus.PENDING } }),
    prisma.messageJob.count({ where: { tenantId, status: JobStatus.PROCESSING } }),
    prisma.messageJob.count({ where: { tenantId, status: JobStatus.FAILED } }),
    prisma.messageJob.count({ where: { tenantId, status: JobStatus.COMPLETED } }),
  ]);

  // Retrieve last successful message
  const lastSuccessfulMessage = await prisma.whatsAppMessage.findFirst({
    where: { tenantId, status: { in: ['SENT', 'DELIVERED', 'READ'] } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, recipientPhone: true, status: true },
  });

  res.status(200).json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      service: 'byteforge-omni-commerce-api',
      environment: config.NODE_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: 'healthy',
        latencyMs: dbLatencyMs,
      },
      shopify: {
        connected: !!shopify?.isActive,
        shopDomain: shopify?.shopDomain || null,
        lastSyncedAt: shopify?.lastSyncedAt || null,
        lastWebhookAt: shopify?.lastWebhookAt || null,
        syncStatus: shopify?.syncStatus || 'IDLE',
        recentError: shopify?.syncError || null,
      },
      whatsapp: {
        status: baileys.status,
        displayPhoneNumber: baileys.displayPhoneNumber,
        connectedAt: baileys.connectedAt,
        uptimeSeconds: baileys.uptimeSeconds,
        lastError: baileys.lastError,
        lastSuccessfulMessageAt: lastSuccessfulMessage?.createdAt || null,
      },
      queue: {
        pending: pendingJobs,
        processing: processingJobs,
        failed: failedJobs,
        completed: completedJobs,
      },
      system: {
        memoryHeapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        memoryHeapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
        nodeVersion: process.version,
      },
    },
  });
});

export default router;
