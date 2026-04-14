import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './database';
import userRoutes from './routes/userRoutes';
import listingRoutes from './routes/listingRoutes';
import orderRoutes from './routes/orderRoutes';
import messageRoutes from './routes/messageRoutes';
import reviewRoutes from './routes/reviewRoutes';
import disputeRoutes from './routes/disputeRoutes';
import favoriteRoutes from './routes/favoriteRoutes';
import notificationRoutes from './routes/notificationRoutes';
import seedRoutes from './routes/seedRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// API routes
app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', seedRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend — try multiple paths
const path1 = path.resolve(__dirname, '..');
const path2 = path.resolve(__dirname, '..', '..');
const fs = require('fs');
const staticPath = fs.existsSync(path.join(path2, 'index.html')) ? path2 : 
                   fs.existsSync(path.join(path1, 'index.html')) ? path1 : path2;
console.log('Serving static files from:', staticPath);
app.use(express.static(staticPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

initDatabase().then(() => {
  console.log('Database connected successfully');
}).catch(err => {
  console.error('WARNING: DB init failed, starting without DB:', err.message);
});

app.listen(PORT, () => {
  console.log(`Green Bazaar running on port ${PORT}`);
});
