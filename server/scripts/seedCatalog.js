import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import User from '../models/User.js';

const categories = [
  ['Rice', 'চাল'], ['Lentils', 'ডাল'], ['Oil', 'তেল'], ['Spices', 'মসলা'], ['Snacks', 'নাস্তা'],
  ['Beverages', 'পানীয়'], ['Dairy Products', 'দুগ্ধজাত'], ['Personal Care', 'ব্যক্তিগত পরিচর্যা'], ['Household Products', 'গৃহস্থালি'], ['Other', 'অন্যান্য']
];
const products = [
  { name: 'Miniket Rice', nameBn: 'মিনিকেট চাল', price: 75, unit: 'kg', stock: 50, category: 'Rice' },
  { name: 'Masoor Dal', nameBn: 'মসুর ডাল', price: 130, unit: 'kg', stock: 30, category: 'Lentils' },
  { name: 'Soybean Oil', nameBn: 'সয়াবিন তেল', price: 175, unit: 'litre', stock: 40, category: 'Oil' },
  { name: 'Turmeric Powder', nameBn: 'হলুদ গুঁড়া', price: 35, unit: '100 g', stock: 25, category: 'Spices' },
  { name: 'Black Tea', nameBn: 'চা পাতা', price: 95, unit: 'packet', stock: 24, category: 'Beverages' },
  { name: 'Bath Soap', nameBn: 'গোসলের সাবান', price: 55, unit: 'piece', stock: 20, category: 'Personal Care' }
];

try {
  await connectDB();
  if (!(await User.exists({ role: 'OWNER' }))) throw new Error('Create the initial owner first with npm run seed:owner -w server.');
  const byName = new Map();
  for (const [name, nameBn] of categories) byName.set(name, await Category.findOneAndUpdate({ name }, { $setOnInsert: { name, nameBn } }, { upsert: true, new: true }));
  for (const row of products) {
    if (await Product.exists({ name: row.name })) continue;
    await Product.create({ name: row.name, nameBn: row.nameBn, price: row.price, unit: row.unit, onHand: row.stock, category: byName.get(row.category)._id });
  }
  console.log('Sample categories and products are ready. Existing products were kept unchanged.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
