import { Router } from 'express';
import { adjustInventory, inventoryHistory, inventoryList } from '../controllers/inventoryController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, requireRole('OWNER'), inventoryList);
router.get('/:id/history', authenticate, requireRole('OWNER'), inventoryHistory);
router.post('/adjustments', authenticate, requireRole('OWNER'), adjustInventory);
export default router;
