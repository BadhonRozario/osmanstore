import { z } from 'zod';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import { inTransaction } from '../services/transactions.js';
import cloudinary, { cloudinaryReady } from '../config/cloudinary.js';

const productInput = z.object({ name: z.string().trim().min(1).max(120), nameBn: z.string().max(120).optional(), description: z.string().max(2000).optional(), category: z.string().min(1), imageUrl: z.string().url().optional().or(z.literal('')), imagePublicId: z.string().max(200).optional(), price: z.number().nonnegative(), offerPrice: z.number().nonnegative().nullable().optional(), offerStartsAt: z.string().datetime().optional().or(z.literal('')), offerEndsAt: z.string().datetime().optional().or(z.literal('')), unit: z.string().trim().min(1).max(30), onHand: z.number().nonnegative(), lowStockThreshold: z.number().nonnegative().optional(), isActive: z.boolean().optional() }).strict();

function parseProduct(body) {
  const parsed = productInput.parse(body);
  if (parsed.offerPrice != null && parsed.offerPrice > parsed.price) throw Object.assign(new Error('Offer price cannot exceed the regular price.'), { status: 400 });
  return parsed;
}

export async function listProducts(req, res, next) {
  try {
    const filter = { isActive: true };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.q) filter.$text = { $search: String(req.query.q).slice(0, 100) };
    const sort = req.query.sort === 'price_asc' ? { price: 1 } : req.query.sort === 'price_desc' ? { price: -1 } : { createdAt: -1 };
    const products = await Product.find(filter).populate('category', 'name nameBn').sort(sort).lean();
    const now = new Date();
    res.json({ success: true, data: products.map((p) => { const offerActive = p.offerPrice != null && (!p.offerStartsAt || p.offerStartsAt <= now) && (!p.offerEndsAt || p.offerEndsAt >= now); return { ...p, available: p.onHand - p.reserved, effectivePrice: offerActive ? p.offerPrice : p.price }; }) });
  } catch (error) { next(error); }
}

export async function createProduct(req, res, next) {
  try {
    const data = parseProduct(req.body);
    if (!(await Category.exists({ _id: data.category, isActive: true }))) return res.status(400).json({ success: false, message: 'Choose an active category.' });
    const product = await inTransaction(async (session) => {
      const [created] = await Product.create([data], { session });
      if (data.onHand > 0) await InventoryTransaction.create([{ product: created._id, type: 'ADJUSTMENT', quantity: data.onHand, note: 'Initial stock', createdBy: req.user.id }], { session });
      return created;
    });
    res.status(201).json({ success: true, data: product });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}

export async function updateProduct(req, res, next) {
  try {
    const data = parseProduct(req.body);
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (data.onHand !== product.onHand) return res.status(400).json({ success: false, message: 'Use the inventory adjustment action to change stock.' });
    if (!(await Category.exists({ _id: data.category, isActive: true }))) return res.status(400).json({ success: false, message: 'Choose an active category.' });
    Object.assign(product, data);
    await product.save();
    res.json({ success: true, data: product });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}

export async function deactivateProduct(req, res, next) {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, data: product });
  } catch (error) { next(error); }
}

export async function listCategories(req, res, next) {
  try { res.json({ success: true, data: await Category.find({ isActive: true }).sort({ name: 1 }).lean() }); } catch (error) { next(error); }
}

export async function createCategory(req, res, next) {
  try {
    const data = z.object({ name: z.string().trim().min(1).max(80), nameBn: z.string().max(80).optional() }).strict().parse(req.body);
    const category = await Category.create(data);
    res.status(201).json({ success: true, data: category });
  } catch (error) { if (error.code === 11000) return res.status(409).json({ success: false, message: 'That category already exists.' }); if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}

export async function updateCategory(req, res, next) {
  try {
    const data = z.object({ name: z.string().trim().min(1).max(80).optional(), nameBn: z.string().max(80).optional() }).strict().parse(req.body);
    const category = await Category.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    res.json({ success: true, data: category });
  } catch (error) { if (error.code === 11000) return res.status(409).json({ success: false, message: 'That category already exists.' }); if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}

export async function deleteCategory(req, res, next) {
  try {
    const result = await inTransaction(async (session) => {
      const category = await Category.findOne({ _id: req.params.id, isActive: true }).session(session);
      if (!category) throw Object.assign(new Error('Category not found.'), { status: 404 });
      if (await Product.exists({ category: category._id, isActive: true, reserved: { $gt: 0 } }).session(session)) {
        throw Object.assign(new Error('This category has products reserved for active orders. Finish or cancel those orders before removing the category.'), { status: 409 });
      }
      category.isActive = false;
      await category.save({ session });
      const products = await Product.updateMany({ category: category._id, isActive: true }, { $set: { isActive: false } }, { session });
      return { category, deactivatedProductCount: products.modifiedCount };
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function uploadProductImage(req, res, next) {
  try {
    if (!cloudinaryReady()) return res.status(503).json({ success: false, message: 'Image storage is not configured on the server.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Select an image file.' });
    const uploaded = await new Promise((resolve, reject) => cloudinary.uploader.upload_stream({ folder: 'osman-store/products', resource_type: 'image', transformation: [{ width: 1200, height: 1200, crop: 'limit' }] }, (error, result) => error ? reject(error) : resolve(result)).end(req.file.buffer));
    res.status(201).json({ success: true, data: { imageUrl: uploaded.secure_url, imagePublicId: uploaded.public_id } });
  } catch (error) { next(error); }
}

export async function removeProductImage(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (product.imagePublicId && cloudinaryReady()) await cloudinary.uploader.destroy(product.imagePublicId, { resource_type: 'image' });
    product.imageUrl = ''; product.imagePublicId = ''; await product.save();
    res.json({ success: true, data: product });
  } catch (error) { next(error); }
}
