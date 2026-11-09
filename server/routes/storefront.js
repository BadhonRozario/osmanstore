import { Router } from 'express';
import ShopSettings from '../models/ShopSettings.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const settings = await ShopSettings.findOne().select('storeName phone address openingHours -_id').lean();
    res.json({
      success: true,
      data: {
        storeName: settings?.storeName || 'Osman Store',
        phone: settings?.phone || '',
        address: settings?.address || '',
        openingHours: settings?.openingHours || '',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
