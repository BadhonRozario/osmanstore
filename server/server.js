import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import { connectDB } from './config/db.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import orderRoutes from './routes/orders.js';
import dueRoutes from './routes/due.js';
import salesRoutes from './routes/sales.js';
import ownerRoutes from './routes/owner.js';
import inventoryRoutes from './routes/inventory.js';
import notificationRoutes from './routes/notifications.js';
import storefrontRoutes from './routes/storefront.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' } });
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('_id role isActive');
    if (!user || !user.isActive) return next(new Error('Account unavailable'));
    socket.data.user = { id: user.id, role: user.role };
    next();
  } catch { next(new Error('Invalid socket session')); }
});
io.on('connection', (socket) => {
  if (socket.data.user.role === 'OWNER') socket.join('owners');
  else socket.join(`customer:${socket.data.user.id}`);
});
app.set('io', io);
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/due', dueRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/storefront', storefrontRoutes);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 5000);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters.');
connectDB().then(() => httpServer.listen(port, () => console.log(`Osman Store API listening on ${port}`)))
  .catch((error) => { console.error('Unable to start API:', error.message); process.exit(1); });

export { app, httpServer, io };
