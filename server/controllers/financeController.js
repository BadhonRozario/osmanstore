import { z } from 'zod';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import DueTransaction from '../models/DueTransaction.js';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import { inTransaction } from '../services/transactions.js';
import { nextNumber } from '../services/sequence.js';

export async function getMyLedger(req, res, next) {
  try {
    const [rows, user] = await Promise.all([DueTransaction.find({ customer: req.user.id }).populate('sale', 'saleNumber source total').populate('payment', 'amount method reference').sort({ createdAt: -1 }).limit(500), User.findById(req.user.id).select('+dueBalance')]);
    res.json({ success: true, data: { currentDue: user.dueBalance || 0, transactions: rows } });
  } catch (error) { next(error); }
}

export async function getMyPurchases(req, res, next) {
  try {
    const rows = await Sale.find({ customer: req.user.id }).sort({ createdAt: -1 }).limit(300).lean();
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

export async function listDueCustomers(req, res, next) {
  try {
    const query = String(req.query.q || '').trim();
    const filter = { role: 'CUSTOMER', dueBalance: { $gt: 0 } };
    if (query) filter.$or = [{ name: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { phone: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }];
    const rows = await User.find(filter).select('name phone dueBalance').sort({ dueBalance: -1 }).limit(300).lean();
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

export async function recordPayment(req, res, next) {
  try {
    const data = z.object({ customerId: z.string(), amount: z.number().positive(), method: z.enum(['CASH', 'BKASH']), reference: z.string().max(120).optional(), note: z.string().max(500).optional() }).strict().parse(req.body);
    const result = await inTransaction(async (session) => {
      const customer = await User.findOne({ _id: data.customerId, role: 'CUSTOMER', isActive: true }).select('+dueBalance').session(session);
      if (!customer) throw Object.assign(new Error('Customer not found.'), { status: 404 });
      const amount = Math.round(data.amount * 100) / 100;
      const updated = await User.updateOne({ _id: customer._id, dueBalance: { $gte: amount } }, { $inc: { dueBalance: -amount } }, { session });
      if (!updated.modifiedCount) throw Object.assign(new Error(`Payment exceeds current due of ৳${customer.dueBalance || 0}.`), { status: 400 });
      const [payment] = await Payment.create([{ customer: customer._id, amount, method: data.method, reference: data.reference || '', note: data.note || '', createdBy: req.user.id }], { session });
      await DueTransaction.create([{ customer: customer._id, type: 'PAYMENT', amount, payment: payment._id, note: data.note || '', createdBy: req.user.id }], { session });
      return { payment, due: Math.round(((customer.dueBalance || 0) - amount) * 100) / 100 };
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}

export async function addAdjustment(req, res, next) {
  try {
    const data = z.object({ customerId: z.string(), amount: z.number().positive(), direction: z.enum(['INCREASE', 'DECREASE']).default('INCREASE'), note: z.string().trim().min(3).max(500) }).strict().parse(req.body);
    const result = await inTransaction(async (session) => {
      const customer = await User.findOne({ _id: data.customerId, role: 'CUSTOMER', isActive: true }).select('+dueBalance').session(session);
      if (!customer) throw Object.assign(new Error('Customer not found.'), { status: 404 });
      const amount = Math.round(data.amount * 100) / 100;
      const inc = data.direction === 'INCREASE' ? amount : -amount;
      const updated = await User.updateOne({ _id: customer._id, ...(inc < 0 ? { dueBalance: { $gte: amount } } : {}) }, { $inc: { dueBalance: inc } }, { session });
      if (!updated.modifiedCount) throw Object.assign(new Error('Adjustment cannot reduce due below zero.'), { status: 400 });
      const [transaction] = await DueTransaction.create([{ customer: customer._id, type: 'ADJUSTMENT', amount, adjustmentDirection: data.direction, note: data.note, createdBy: req.user.id }], { session });
      return { transaction, due: Math.round(((customer.dueBalance || 0) + inc) * 100) / 100 };
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}

export async function createDirectSale(req, res, next) {
  try {
    const input = z.object({ customerId: z.string().nullable().optional(), items: z.array(z.object({ product: z.string(), quantity: z.number().positive().max(1000) }).strict()).min(1).max(50), paidAmount: z.number().nonnegative(), paymentMethod: z.enum(['CASH', 'BKASH']).optional(), approveDue: z.boolean().optional(), note: z.string().max(1000).optional() }).strict().parse(req.body);
    const merged = new Map(); input.items.forEach((i) => merged.set(i.product, (merged.get(i.product) || 0) + i.quantity));
    const result = await inTransaction(async (session) => {
      const customerId = input.customerId || null;
      if (customerId && !(await User.exists({ _id: customerId, role: 'CUSTOMER', isActive: true }).session(session))) throw Object.assign(new Error('Customer not found.'), { status: 404 });
      const items = []; let total = 0;
      for (const [id, quantity] of merged) {
        const product = await Product.findOneAndUpdate({ _id: id, isActive: true, $expr: { $gte: [{ $subtract: ['$onHand', '$reserved'] }, quantity] } }, { $inc: { onHand: -quantity } }, { new: true, session });
        if (!product) throw Object.assign(new Error('A product is unavailable or has insufficient stock.'), { status: 409 });
        const now = new Date(); const offerActive = product.offerPrice != null && (!product.offerStartsAt || product.offerStartsAt <= now) && (!product.offerEndsAt || product.offerEndsAt >= now);
        const unitPrice = offerActive ? product.offerPrice : product.price;
        const lineTotal = Math.round(quantity * unitPrice * 100) / 100; total += lineTotal;
        items.push({ product: product._id, name: product.name, unit: product.unit, quantity, unitPrice, lineTotal });
      }
      total = Math.round(total * 100) / 100;
      if (input.paidAmount > total) throw Object.assign(new Error('Paid amount cannot exceed bill.'), { status: 400 });
      const dueAmount = Math.round((total - input.paidAmount) * 100) / 100;
      if (dueAmount > 0 && (!customerId || !input.approveDue)) throw Object.assign(new Error(customerId ? 'Approve credit to record an unpaid balance.' : 'Walk-in sales must be fully paid.'), { status: 400 });
      const saleNumber = await nextNumber('sale', 'SALE', session);
      const [sale] = await Sale.create([{ saleNumber, source: 'DIRECT', customer: customerId, items, subtotal: total, total, paidAmount: input.paidAmount, dueAmount, paymentMethod: input.paidAmount ? (input.paymentMethod || 'CASH') : 'DUE', note: input.note || '', createdBy: req.user.id }], { session });
      for (const item of items) await InventoryTransaction.create([{ product: item.product, type: 'SALE', quantity: -item.quantity, reference: saleNumber, note: 'Direct shop sale', createdBy: req.user.id }], { session });
      if (customerId) {
        if (input.paidAmount > 0) {
          const [payment] = await Payment.create([{ customer: customerId, sale: sale._id, amount: input.paidAmount, method: input.paymentMethod || 'CASH', note: `Payment for ${saleNumber}`, createdBy: req.user.id }], { session });
          await DueTransaction.create([{ customer: customerId, type: 'PAYMENT', amount: input.paidAmount, sale: sale._id, payment: payment._id, note: payment.note, createdBy: req.user.id }], { session });
        }
        await DueTransaction.create([{ customer: customerId, type: 'CREDIT_SALE', amount: total, sale: sale._id, note: `Purchase ${saleNumber}`, createdBy: req.user.id }], { session });
        await User.updateOne({ _id: customerId }, { $inc: { dueBalance: dueAmount } }, { session });
      }
      return sale;
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}
