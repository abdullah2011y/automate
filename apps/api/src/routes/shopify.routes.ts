import { Router } from 'express';
import {
  getStatus,
  connect,
  disconnect,
  triggerSync,
  handleWebhook,
  initiateOAuth,
} from '../controllers/shopify.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Public webhook receiver for Shopify
router.post('/webhooks', handleWebhook);

// Public OAuth initiation
router.get('/auth', initiateOAuth);

// Tenant-protected management routes
router.use(requireAuth);
router.get('/status', getStatus);
router.post('/connect', connect);
router.delete('/disconnect', disconnect);
router.post('/sync', triggerSync);

export default router;
