import { Router } from 'express';
import ShopSettings from '../models/ShopSettings.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';

const router = Router();

router.get('/featured-categories', async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [categories, counts, sales] = await Promise.all([
      Category.find({ isActive: true }).select('name nameBn').lean(),
      Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$category', productCount: { $sum: 1 } } }]),
      Sale.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $unwind: '$items' },
        { $lookup: { from: Product.collection.name, localField: 'items.product', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $match: { 'product.isActive': true } },
        { $group: { _id: '$product.category', salesTotal: { $sum: { $ifNull: ['$items.lineTotal', 0] } }, unitsSold: { $sum: { $ifNull: ['$items.quantity', 0] } } } }
      ])
    ]);
    const countByCategory = new Map(counts.map(row => [String(row._id), row.productCount]));
    const salesByCategory = new Map(sales.map(row => [String(row._id), row]));
    const ranked = categories
      .filter(category => (countByCategory.get(String(category._id)) || 0) > 0)
      .map(category => {
        const salesRow = salesByCategory.get(String(category._id));
        return { ...category, productCount: countByCategory.get(String(category._id)) || 0, salesTotal: salesRow?.salesTotal || 0, unitsSold: salesRow?.unitsSold || 0 };
      })
      .sort((a, b) => b.salesTotal - a.salesTotal || b.unitsSold - a.unitsSold || b.productCount - a.productCount || a.name.localeCompare(b.name))
      .slice(0, 4);
    res.json({ success: true, data: ranked });
  } catch (error) { next(error); }
});

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
