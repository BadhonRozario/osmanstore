import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, unique: true, trim: true, index: true },
  email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
  password: { type: String, required: true, select: false, minlength: 8 },
  role: { type: String, enum: ['CUSTOMER', 'OWNER'], default: 'CUSTOMER', immutable: true },
  address: { type: String, trim: true, maxlength: 500, default: '' },
  dueBalance: { type: Number, min: 0, default: 0, select: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});
userSchema.methods.comparePassword = function (candidate) { return bcrypt.compare(candidate, this.password); };

export default mongoose.models.User || mongoose.model('User', userSchema);
