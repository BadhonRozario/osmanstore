import { z } from 'zod';
import Product from '../models/Product.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import { inTransaction } from '../services/transactions.js';
export async function inventoryList(req, res, next) {
  try { const rows = await Product.find({ isActive: true }).populate('category', 'name nameBn').sort({ name: 1 }).lean(); const now = new Date(); res.json({ success: true, data: rows.map(p => { const offerActive = p.offerPrice != null && (!p.offerStartsAt || p.offerStartsAt <= now) && (!p.offerEndsAt || p.offerEndsAt >= now); return { ...p, available: p.onHand - p.reserved, lowStock: p.onHand - p.reserved <= p.lowStockThreshold, effectivePrice: offerActive ? p.offerPrice : p.price }; }) }); } catch (error) { next(error); }
}
export async function adjustInventory(req, res, next) {
  try {
    const data = z.object({ productId: z.string(), delta: z.number().finite().refine(v => v !== 0), note: z.string().trim().min(3).max(300) }).strict().parse(req.body);
    const product = await inTransaction(async (session) => {
      const updated = await Product.findOneAndUpdate({ _id: data.productId, isActive: true, $expr: { $gte: [{ $add: ['$onHand', data.delta] }, '$reserved'] } }, { $inc: { onHand: data.delta } }, { new: true, session });
      if (!updated) throw Object.assign(new Error('Product not found or stock cannot be lower than reserved units.'), { status: 409 });
      await InventoryTransaction.create([{ product: updated._id, type: 'ADJUSTMENT', quantity: data.delta, note: data.note, createdBy: req.user.id }], { session });
      return updated;
    });
    res.json({ success: true, data: product });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}
export async function inventoryHistory(req, res, next) {
  try { const rows = await InventoryTransaction.find({ product: req.params.id }).populate('createdBy', 'name').sort({ createdAt: -1 }).limit(200); res.json({ success: true, data: rows }); } catch (error) { next(error); }
}
