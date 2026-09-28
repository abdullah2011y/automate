import { Router } from 'express';
import {
  getQrStream,
  getStatus,
  reconnect,
  disconnect,
  resetSession,
  resendConfirmation,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  testSendTemplate,
  getAutomationSettings,
  updateAutomationSettings,
  listMessages,
} from '../controllers/whatsapp.controller';
import { requireAuth } from '../middleware/auth';
import {
  qrRateLimiter,
  resendRateLimiter,
  testSendRateLimiter,
} from '../middleware/rateLimiter';

const router = Router();

// Protect all Baileys WhatsApp routes with authentication
// requireAuth supports Bearer token header as well as ?token=<jwt> query parameter for browser EventSource SSE
router.use(requireAuth);

// 1. WhatsApp Connection & Live QR Pairing
router.get('/qr-stream', getQrStream);
router.get('/status', getStatus);
router.post('/reconnect', qrRateLimiter, reconnect);
router.post('/disconnect', qrRateLimiter, disconnect);
router.post('/reset', qrRateLimiter, resetSession);
router.post('/resend/:orderId', resendRateLimiter, resendConfirmation);

// 2. WhatsApp Message Template Engine
router.get('/templates', listTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);
router.post('/templates/preview', previewTemplate);
router.post('/templates/test-send', testSendRateLimiter, testSendTemplate);

// 3. Automation & Anti-Ban Settings
router.get('/automation-settings', getAutomationSettings);
router.put('/automation-settings', updateAutomationSettings);

// 4. Message Delivery History & Inbound Response Logs
router.get('/messages', listMessages);

export default router;
