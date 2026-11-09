import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import User from '../models/User.js';
import EmailRegistrationOtp from '../models/EmailRegistrationOtp.js';
import { sendRegistrationCode } from '../services/email.js';

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(24),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  address: z.string().max(500).optional().default(''),
  password: z.string().min(8).max(100),
});
const sendSchema = registrationSchema;
const verifySchema = registrationSchema.extend({ code: z.string().regex(/^\d{6}$/) });
const OTP_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_DELAY_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const hashCode = (email, code) => createHmac('sha256', process.env.OTP_SECRET || process.env.JWT_SECRET).update(`${email}:${code}`).digest();

export async function sendRegistrationOtp(req, res, next) {
  try {
    const data = sendSchema.parse(req.body);
    const [emailExists, phoneExists] = await Promise.all([
      User.exists({ email: data.email }),
      User.exists({ phone: data.phone }),
    ]);
    if (emailExists) return res.status(409).json({ success: false, message: 'This email is already registered.' });
    if (phoneExists) return res.status(409).json({ success: false, message: 'This phone number is already registered.' });

    const now = new Date();
    let pending = await EmailRegistrationOtp.findOne({ email: data.email });
    if (pending && now - pending.sentAt < RESEND_DELAY_MS) {
      return res.status(429).json({ success: false, message: 'Please wait one minute before requesting another code.' });
    }

    const code = String(randomInt(100000, 1000000));
    const otpSecret = process.env.OTP_SECRET || process.env.JWT_SECRET;
    if (!otpSecret) throw new Error('OTP_SECRET or JWT_SECRET must be configured.');
    const values = { codeHash: hashCode(data.email, code).toString('hex'), attempts: 0, sentAt: now, expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS) };
    if (pending) Object.assign(pending, values);
    else pending = new EmailRegistrationOtp({ email: data.email, ...values });
    await pending.save();

    try {
      await sendRegistrationCode(data.email, code);
    } catch (error) {
      await EmailRegistrationOtp.deleteOne({ _id: pending._id });
      console.error('Registration email delivery failed:', error.message);
      return res.status(503).json({ success: false, message: 'Could not send the verification email. Check Gmail settings and try again.' });
    }
    res.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    next(error);
  }
}

export async function verifyRegistrationOtp(req, res, next) {
  try {
    const data = verifySchema.parse(req.body);
    const pending = await EmailRegistrationOtp.findOne({ email: data.email }).select('+codeHash');
    if (!pending || pending.expiresAt <= new Date()) {
      if (pending) await pending.deleteOne();
      return res.status(400).json({ success: false, message: 'The code has expired. Request a new one.' });
    }
    if (pending.attempts >= MAX_ATTEMPTS) {
      await pending.deleteOne();
      return res.status(429).json({ success: false, message: 'Too many incorrect codes. Request a new one.' });
    }

    const submitted = hashCode(data.email, data.code);
    const stored = Buffer.from(pending.codeHash, 'hex');
    if (submitted.length !== stored.length || !timingSafeEqual(submitted, stored)) {
      pending.attempts += 1;
      await pending.save();
      return res.status(400).json({ success: false, message: 'The verification code is incorrect.' });
    }

    const [emailExists, phoneExists] = await Promise.all([
      User.exists({ email: data.email }),
      User.exists({ phone: data.phone }),
    ]);
    if (emailExists) return res.status(409).json({ success: false, message: 'This email is already registered.' });
    if (phoneExists) return res.status(409).json({ success: false, message: 'This phone number is already registered.' });

    await User.create({ name: data.name, phone: data.phone, email: data.email, address: data.address, password: data.password, role: 'CUSTOMER' });
    await pending.deleteOne();
    res.status(201).json({ success: true, message: 'Email verified and account created. Please log in.' });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Phone or email is already registered.' });
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    next(error);
  }
}
