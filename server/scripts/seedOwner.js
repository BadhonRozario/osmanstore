import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['CUSTOMER', 'OWNER'], required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
const User = mongoose.models.User || mongoose.model('User', userSchema);

try {
  await connectDB();
  const { OWNER_NAME, OWNER_PHONE, OWNER_PASSWORD } = process.env;
  if (!OWNER_NAME || !OWNER_PHONE || !OWNER_PASSWORD || OWNER_PASSWORD === 'change-this-before-seeding') {
    throw new Error('Set OWNER_NAME, OWNER_PHONE, and a strong OWNER_PASSWORD before seeding.');
  }
  if (OWNER_PASSWORD.length < 12) throw new Error('OWNER_PASSWORD must contain at least 12 characters.');
  const existing = await User.findOne({ role: 'OWNER' });
  if (existing) throw new Error('An owner already exists; refusing to create another.');
  const password = await bcrypt.hash(OWNER_PASSWORD, 12);
  await User.create({ name: OWNER_NAME, phone: OWNER_PHONE, password, role: 'OWNER' });
  console.log('Initial owner created. Keep the credentials private.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
