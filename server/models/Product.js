import mongoose from 'mongoose';
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true }, nameBn: { type: String, trim: true, default: '' }, description: { type: String, trim: true, default: '' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true }, imageUrl: { type: String, default: '' }, imagePublicId: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 }, offerPrice: { type: Number, min: 0, default: null }, offerStartsAt: Date, offerEndsAt: Date,
  unit: { type: String, required: true, trim: true, default: 'piece' }, onHand: { type: Number, required: true, min: 0, default: 0 }, reserved: { type: Number, min: 0, default: 0 }, lowStockThreshold: { type: Number, min: 0, default: 5 }, isActive: { type: Boolean, default: true }
}, { timestamps: true });
productSchema.index({ name: 'text', nameBn: 'text', description: 'text' });
productSchema.virtual('available').get(function () { return this.onHand - this.reserved; });
export default mongoose.models.Product || mongoose.model('Product', productSchema);
