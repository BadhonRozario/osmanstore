import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

function notificationScope(user) {
  return user.role === 'OWNER'
    ? { audience: 'OWNER' }
    : { audience: 'CUSTOMER', recipient: user.id };
}

export async function listNotifications(req, res, next) {
  try {
    const rows = await Notification.find(notificationScope(req.user))
      .sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

export async function markNotificationRead(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID.' });
    }
    const row = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...notificationScope(req.user) },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!row) return res.status(404).json({ success: false, message: 'Notification not found.' });
    res.json({ success: true, data: row });
  } catch (error) { next(error); }
}
