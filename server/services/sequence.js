import Counter from '../models/Counter.js';
export async function nextNumber(key, prefix, session) {
  const counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { value: 1 } }, { upsert: true, new: true, session });
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(counter.value).padStart(5, '0')}`;
}
