import { Router } from 'express';
import { getOverviewAnalytics } from '../controllers/analytics.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Protected with tenant isolation
router.use(requireAuth);

router.get('/overview', getOverviewAnalytics);

export default router;
