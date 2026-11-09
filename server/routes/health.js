import { Router } from 'express';
const router = Router();
router.get('/', (req, res) => res.json({ success: true, service: 'Osman Store API', status: 'ok' }));
export default router;
