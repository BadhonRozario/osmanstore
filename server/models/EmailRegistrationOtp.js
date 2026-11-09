import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  codeHash: { type: String, required: true, select: false },
  attempts: { type: Number, default: 0 },
  sentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.EmailRegistrationOtp || mongoose.model('EmailRegistrationOtp', schema);
