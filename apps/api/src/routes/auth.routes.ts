import { Router } from 'express';
import { signup, login, getMe } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/signup', authRateLimiter, signup);
router.post('/login', authRateLimiter, login);
router.get('/me', requireAuth, getMe);

export default router;
