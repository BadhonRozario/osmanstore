import { z } from 'zod';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Sale from '../models/Sale.js';
import Payment from '../models/Payment.js';
import DueTransaction from '../models/DueTransaction.js';
import ShopSettings from '../models/ShopSettings.js';

const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
const dayStart = (date = new Date()) => { const bd = new Date(new Date(date).getTime() + BD_OFFSET_MS); return new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()) - BD_OFFSET_MS); };
export async function dashboard(req, res, next) {
  try {
    const bdToday = new Date(Date.now() + BD_OFFSET_MS); const today = dayStart(); const month = new Date(Date.UTC(bdToday.getUTCFullYear(), bdToday.getUTCMonth(), 1) - BD_OFFSET_MS);
    const [todaySales, monthSales, todayOrders, pendingOrders, productCount, customerCount, dueRows, todayPayments, recentOrders, recentPayments, daily] = await Promise.all([
      Sale.aggregate([{ $match: { createdAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Sale.aggregate([{ $match: { createdAt: { $gte: month } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.countDocuments({ createdAt: { $gte: today } }), Order.countDocuments({ status: { $in: ['NEW', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'] } }),
      Product.countDocuments({ isActive: true }), User.countDocuments({ role: 'CUSTOMER', isActive: true }),
      User.aggregate([{ $match: { role: 'CUSTOMER' } }, { $group: { _id: null, total: { $sum: '$dueBalance' } } }]),
      Payment.aggregate([{ $match: { createdAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Order.find().populate('customer', 'name phone').sort({ createdAt: -1 }).limit(8).lean(),
      Payment.find().populate('customer', 'name phone').sort({ createdAt: -1 }).limit(8).lean(),
      Sale.aggregate([{ $match: { createdAt: { $gte: new Date(today.getTime() - 6 * 86400000) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+06:00' } }, sales: { $sum: '$total' }, direct: { $sum: { $cond: [{ $eq: ['$source', 'DIRECT'] }, '$total', 0] } }, online: { $sum: { $cond: [{ $eq: ['$source', 'ONLINE_ORDER'] }, '$total', 0] } } } }, { $sort: { _id: 1 } }])
    ]);
    res.json({ success: true, data: { todaySales: todaySales[0]?.total || 0, monthSales: monthSales[0]?.total || 0, todayOrders, pendingOrders, productCount, customerCount, totalDue: dueRows[0]?.total || 0, todayPayments: todayPayments[0]?.total || 0, recentOrders, recentPayments, daily } });
  } catch (error) { next(error); }
}

export async function customers(req, res, next) {
  try {
    const q = String(req.query.q || '').trim(); const filter = { role: 'CUSTOMER', ...(req.query.activeOnly === 'true' ? { isActive: true } : {}) };
    if (q) { const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [{ name: new RegExp(safe, 'i') }, { phone: new RegExp(safe, 'i') }]; }
    const result = await User.find(filter).select('name phone email address dueBalance createdAt isActive').sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function customerDetail(req, res, next) {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'CUSTOMER' }).select('name phone email address dueBalance createdAt').lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const [sales, payments, ledger] = await Promise.all([Sale.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(100).lean(), Payment.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(100).lean(), DueTransaction.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(200).lean()]);
    res.json({ success: true, data: { customer, sales, payments, ledger } });
  } catch (error) { next(error); }
}

export async function getSettings(req, res, next) {
  try { const settings = await ShopSettings.findOne().lean() || { storeName: 'Osman Store', currency: 'BDT', defaultLanguage: 'bn' }; res.json({ success: true, data: settings }); } catch (error) { next(error); }
}

export async function updateSettings(req, res, next) {
  try {
    // The settings form is initialized from a Mongo document, so it can include
    // metadata fields such as _id, __v, and timestamps. Keep only editable fields.
    const data = z.object({ storeName: z.string().trim().min(1).max(100).optional(), phone: z.string().max(30).optional(), address: z.string().max(500).optional(), openingHours: z.string().max(200).optional(), currency: z.enum(['BDT']).optional(), defaultLanguage: z.enum(['bn', 'en']).optional() }).strip().parse(req.body);
    const settings = await ShopSettings.findOneAndUpdate({}, { $set: data }, { upsert: true, new: true, runValidators: true }); res.json({ success: true, data: settings });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}

export async function reports(req, res, next) {
  try {
    const schema = z.object({ from: z.string().optional(), to: z.string().optional() }); const { from, to } = schema.parse(req.query);
    const match = {};
    if (from || to) match.createdAt = { ...(from ? { $gte: dayStart(`${from}T00:00:00+06:00`) } : {}), ...(to ? { $lte: new Date(`${to}T23:59:59.999+06:00`) } : {}) };
    const [sales, payments, products] = await Promise.all([
      Sale.aggregate([{ $match: match }, { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+06:00' } }, source: '$source' }, amount: { $sum: '$total' }, count: { $sum: 1 } } }, { $sort: { '_id.date': 1 } }]),
      Payment.aggregate([{ $match: match }, { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+06:00' } }, method: '$method' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { '_id.date': 1 } }]),
      Sale.aggregate([{ $match: match }, { $unwind: '$items' }, { $group: { _id: '$items.name', quantity: { $sum: '$items.quantity' }, sales: { $sum: '$items.lineTotal' } } }, { $sort: { sales: -1 } }, { $limit: 100 }])
    ]);
    const dueCustomers = await User.find({ role: 'CUSTOMER', dueBalance: { $gt: 0 } }).select('name phone dueBalance').sort({ dueBalance: -1 }).limit(500).lean();
    res.json({ success: true, data: { sales, payments, products, dueCustomers } });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}
