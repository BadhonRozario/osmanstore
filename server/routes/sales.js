import { Router } from 'express';
import { createDirectSale, getMyPurchases } from '../controllers/financeController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
const router = Router();
router.get('/mine', authenticate, requireRole('CUSTOMER'), getMyPurchases);
router.post('/direct', authenticate, requireRole('OWNER'), createDirectSale);
export default router;
