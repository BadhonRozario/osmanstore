import { z } from 'zod';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import Notification from '../models/Notification.js';
import Sale from '../models/Sale.js';
import Payment from '../models/Payment.js';
import DueTransaction from '../models/DueTransaction.js';
import User from '../models/User.js';
import { inTransaction } from '../services/transactions.js';
import { nextNumber } from '../services/sequence.js';

const checkoutSchema = z.object({ items: z.array(z.object({ product: z.string(), quantity: z.number().positive().max(1000) }).strict()).min(1).max(50), paymentPreference: z.enum(['CASH_AT_SHOP', 'BKASH', 'REQUEST_DUE']), note: z.string().max(1000).optional() }).strict();
const orderView = (user) => user.role === 'OWNER' ? {} : { customer: user.id };
async function saveStatus(order, status, session) {
  order.status = status;
  await order.save({ session });
  await Notification.create([{ recipient: order.customer, audience: 'CUSTOMER', type: 'ORDER_STATUS', title: 'Order status updated', message: `Order ${order.orderNumber}: ${status}`, relatedOrder: order._id }], { session });
  return order;
}

export async function placeOrder(req, res, next) {
  try {
    const input = checkoutSchema.parse(req.body);
    const merged = new Map();
    input.items.forEach(({ product, quantity }) => merged.set(product, (merged.get(product) || 0) + quantity));
    const order = await inTransaction(async (session) => {
      const items = []; let subtotal = 0;
      for (const [id, quantity] of merged) {
        const product = await Product.findOneAndUpdate({ _id: id, isActive: true, $expr: { $gte: [{ $subtract: ['$onHand', '$reserved'] }, quantity] } }, { $inc: { reserved: quantity } }, { new: true, session });
        if (!product) throw Object.assign(new Error('A product is unavailable or has insufficient stock.'), { status: 409 });
        const now = new Date();
        const offerActive = product.offerPrice != null && (!product.offerStartsAt || product.offerStartsAt <= now) && (!product.offerEndsAt || product.offerEndsAt >= now);
        const unitPrice = offerActive ? product.offerPrice : product.price;
        const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
        subtotal += lineTotal;
        items.push({ product: product._id, name: product.name, unit: product.unit, quantity, unitPrice, lineTotal });
        await InventoryTransaction.create([{ product: product._id, type: 'RESERVATION', quantity, note: 'Customer checkout reservation' }], { session });
      }
      const orderNumber = await nextNumber('order', 'OS', session);
      const [created] = await Order.create([{ orderNumber, customer: req.user.id, items, subtotal, discount: 0, estimatedTotal: subtotal, paymentPreference: input.paymentPreference, note: input.note || '' }], { session });
      await Notification.create([{ audience: 'OWNER', type: 'NEW_ORDER', title: 'New pickup order', message: `Order ${orderNumber} is waiting for review.`, relatedOrder: created._id }], { session });
      return created;
    });
    const io = req.app.get('io'); io?.to('owners').emit('order:new', { orderId: order.id, orderNumber: order.orderNumber });
    res.status(201).json({ success: true, data: order });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}

export async function listOrders(req, res, next) {
  try { const rows = await Order.find(orderView(req.user)).populate('customer', 'name phone').sort({ createdAt: -1 }).limit(200); res.json({ success: true, data: rows }); } catch (error) { next(error); }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const schema = z.object({ status: z.enum(['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'REJECTED', 'CANCELLED', 'COMPLETED']), paidAmount: z.number().nonnegative().optional(), paymentMethod: z.enum(['CASH', 'BKASH']).optional(), approveDue: z.boolean().optional(), note: z.string().max(1000).optional() }).strict();
    const input = schema.parse(req.body);
    const result = await inTransaction(async (session) => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });
      const transitions = { NEW: ['ACCEPTED', 'REJECTED', 'CANCELLED'], ACCEPTED: ['PREPARING', 'REJECTED', 'CANCELLED'], PREPARING: ['READY_FOR_PICKUP', 'REJECTED', 'CANCELLED'], READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'] };
      if (order.status === 'COMPLETED') throw Object.assign(new Error('Order has already been completed.'), { status: 409 });
      if (!transitions[order.status]?.includes(input.status)) throw Object.assign(new Error('That order status change is not allowed.'), { status: 409 });
      if (['REJECTED', 'CANCELLED'].includes(input.status)) {
        if (!order.stockReleased) {
          for (const item of order.items) {
            const released = await Product.updateOne({ _id: item.product, reserved: { $gte: item.quantity } }, { $inc: { reserved: -item.quantity } }, { session });
            if (!released.modifiedCount) throw Object.assign(new Error('Reserved inventory could not be released safely.'), { status: 409 });
            await InventoryTransaction.create([{ product: item.product, type: 'RESERVATION_RELEASE', quantity: item.quantity, reference: order.orderNumber, createdBy: req.user.id }], { session });
          }
          order.stockReleased = true;
        }
        return saveStatus(order, input.status, session);
      }
      if (input.status !== 'COMPLETED') return saveStatus(order, input.status, session);
      const paidAmount = input.paidAmount ?? (order.paymentPreference === 'REQUEST_DUE' ? 0 : order.estimatedTotal);
      if (paidAmount > order.estimatedTotal) throw Object.assign(new Error('Payment cannot exceed the final bill.'), { status: 400 });
      const dueAmount = Math.round((order.estimatedTotal - paidAmount) * 100) / 100;
      if (dueAmount > 0 && !input.approveDue) throw Object.assign(new Error('Approve the remaining balance as due before completing this order.'), { status: 400 });
      const saleNumber = await nextNumber('sale', 'SALE', session);
      const [sale] = await Sale.create([{ saleNumber, source: 'ONLINE_ORDER', order: order._id, customer: order.customer, items: order.items.map((x) => x.toObject()), subtotal: order.subtotal, discount: order.discount, total: order.estimatedTotal, paidAmount, dueAmount, paymentMethod: paidAmount ? (input.paymentMethod || (order.paymentPreference === 'BKASH' ? 'BKASH' : 'CASH')) : 'NONE', createdBy: req.user.id }], { session });
      for (const item of order.items) {
        const updated = await Product.updateOne({ _id: item.product, onHand: { $gte: item.quantity }, reserved: { $gte: item.quantity } }, { $inc: { onHand: -item.quantity, reserved: -item.quantity } }, { session });
        if (!updated.modifiedCount) throw Object.assign(new Error('Inventory changed; refresh stock before completing.'), { status: 409 });
        await InventoryTransaction.create([{ product: item.product, type: 'SALE', quantity: -item.quantity, reference: sale.saleNumber, createdBy: req.user.id }], { session });
      }
      if (paidAmount > 0) {
        const [payment] = await Payment.create([{ customer: order.customer, sale: sale._id, amount: paidAmount, method: input.paymentMethod || (order.paymentPreference === 'BKASH' ? 'BKASH' : 'CASH'), note: `Payment for ${order.orderNumber}`, createdBy: req.user.id }], { session });
        await DueTransaction.create([{ customer: order.customer, type: 'PAYMENT', amount: paidAmount, sale: sale._id, payment: payment._id, note: payment.note, createdBy: req.user.id }], { session });
      }
      await DueTransaction.create([{ customer: order.customer, type: 'CREDIT_SALE', amount: order.estimatedTotal, sale: sale._id, note: `Purchase ${order.orderNumber}`, createdBy: req.user.id }], { session });
      await User.updateOne({ _id: order.customer }, { $inc: { dueBalance: dueAmount } }, { session });
      order.finalTotal = order.estimatedTotal; order.completedAt = new Date(); await saveStatus(order, 'COMPLETED', session);
      return order;
    });
    req.app.get('io')?.to(`customer:${result.customer}`).emit('order:status', { orderId: result.id, orderNumber: result.orderNumber, status: result.status });
    res.json({ success: true, data: result });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}

export async function cancelMyOrder(req, res, next) {
  try {
    const order = await inTransaction(async (session) => {
      const current = await Order.findOne({ _id: req.params.id, customer: req.user.id }).session(session);
      if (!current) throw Object.assign(new Error('Order not found.'), { status: 404 });
      if (!['NEW', 'ACCEPTED'].includes(current.status)) throw Object.assign(new Error('You can cancel an order only before preparation begins.'), { status: 409 });
      if (!current.stockReleased) {
        for (const item of current.items) {
          const released = await Product.updateOne({ _id: item.product, reserved: { $gte: item.quantity } }, { $inc: { reserved: -item.quantity } }, { session });
          if (!released.modifiedCount) throw Object.assign(new Error('Reserved inventory could not be released safely.'), { status: 409 });
          await InventoryTransaction.create([{ product: item.product, type: 'RESERVATION_RELEASE', quantity: item.quantity, reference: current.orderNumber, note: 'Customer cancelled order', createdBy: req.user.id }], { session });
        }
        current.stockReleased = true;
      }
      return saveStatus(current, 'CANCELLED', session);
    });
    req.app.get('io')?.to('owners').emit('order:status', { orderId: order.id, orderNumber: order.orderNumber, status: order.status });
    req.app.get('io')?.to(`customer:${order.customer}`).emit('order:status', { orderId: order.id, orderNumber: order.orderNumber, status: order.status });
    res.json({ success: true, data: order });
  } catch (error) { next(error); }
}
