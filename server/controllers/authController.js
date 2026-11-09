import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';

const loginSchema = z.object({ phone: z.string().trim().min(1), password: z.string().min(1) });
const issueToken = (user) => jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const safeUser = (user) => ({ id: user.id, name: user.name, phone: user.phone, email: user.email || '', address: user.address || '', role: user.role });

export async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ phone: data.phone }).select('+password');
    if (!user || !user.isActive || !(await user.comparePassword(data.password))) return res.status(401).json({ success: false, message: 'Phone number or password is incorrect.' });
    if (req.body.portal === 'owner' && user.role !== 'OWNER') return res.status(403).json({ success: false, message: 'Owner access required.' });
    res.json({ success: true, data: { user: safeUser(user), token: issueToken(user) } });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    next(error);
  }
}

export async function me(req, res) { res.json({ success: true, data: safeUser(req.user) }); }

export async function updateProfile(req, res, next) {
  try {
    const schema = z.object({ name: z.string().trim().min(2).max(100).optional(), email: z.string().trim().email().optional().or(z.literal('')), address: z.string().max(500).optional() }).strict();
    const data = schema.parse(req.body);
    const update = { $set: { ...data } };
    if (data.email === '') { delete update.$set.email; update.$unset = { email: 1 }; }
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true, runValidators: true });
    res.json({ success: true, data: safeUser(user) });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}

export async function changePassword(req, res, next) {
  try {
    const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) }).strict();
    const data = schema.parse(req.body);
    const user = await User.findById(req.user.id).select('+password');
    if (!(await user.comparePassword(data.currentPassword))) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    user.password = data.newPassword; await user.save();
    res.json({ success: true, message: 'Password updated.' });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message }); next(error); }
}
