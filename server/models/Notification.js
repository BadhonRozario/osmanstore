import mongoose from 'mongoose';
const schema = new mongoose.Schema({ recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true }, audience: { type: String, enum: ['OWNER', 'CUSTOMER'], required: true }, type: { type: String, required: true }, title: { type: String, required: true }, message: { type: String, required: true }, relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null }, readAt: Date }, { timestamps: true });
export default mongoose.models.Notification || mongoose.model('Notification', schema);
