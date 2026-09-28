import { Router } from 'express';
import {
  getOrders,
  getOrderById,
  updateOrderStatus,
  createOrder,
} from '../controllers/order.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All order routes are strictly protected by requireAuth & tenant isolation
router.use(requireAuth);

router.get('/', getOrders);
router.post('/', createOrder);
router.get('/:id', getOrderById);
router.patch('/:id/status', updateOrderStatus);

export default router;
