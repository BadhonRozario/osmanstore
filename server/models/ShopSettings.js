import mongoose from 'mongoose';
const schema = new mongoose.Schema({ storeName: { type: String, default: 'Osman Store' }, phone: { type: String, default: '' }, address: { type: String, default: '' }, openingHours: { type: String, default: '' }, currency: { type: String, default: 'BDT' }, defaultLanguage: { type: String, enum: ['bn', 'en'], default: 'bn' } }, { timestamps: true });
export default mongoose.models.ShopSettings || mongoose.model('ShopSettings', schema);
