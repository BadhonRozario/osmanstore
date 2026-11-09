import { Router } from 'express';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../controllers/catalogController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
const router = Router();
router.get('/', listCategories);
router.post('/', authenticate, requireRole('OWNER'), createCategory);
router.patch('/:id', authenticate, requireRole('OWNER'), updateCategory);
router.delete('/:id', authenticate, requireRole('OWNER'), deleteCategory);
export default router;
