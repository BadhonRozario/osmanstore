import mongoose from 'mongoose';
const categorySchema = new mongoose.Schema({ name: { type: String, required: true, trim: true, unique: true }, nameBn: { type: String, trim: true, default: '' }, isActive: { type: Boolean, default: true } }, { timestamps: true });
export default mongoose.models.Category || mongoose.model('Category', categorySchema);
