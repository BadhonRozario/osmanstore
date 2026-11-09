import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'Please sign in.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('_id name phone email role isActive');
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Account unavailable.' });
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired session.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => req.user && roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ success: false, message: 'You are not allowed to access this resource.' });
}
