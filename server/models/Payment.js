import mongoose from 'mongoose';
const paymentSchema = new mongoose.Schema({ customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null }, amount: { type: Number, required: true, min: 0.01 }, method: { type: String, enum: ['CASH', 'BKASH'], required: true }, reference: { type: String, trim: true, default: '' }, note: { type: String, trim: true, default: '' }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true });
paymentSchema.index({ customer: 1, createdAt: -1 });
export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
