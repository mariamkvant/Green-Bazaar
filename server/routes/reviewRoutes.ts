import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

// Create review
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { order_id, rating, condition, comment } = req.body;
    const order = await db.get('SELECT * FROM orders WHERE id = ? AND buyer_id = ? AND status = ?', order_id, req.userId, 'completed');
    if (!order) return res.status(400).json({ error: 'Can only review completed orders' });
    const existing = await db.get('SELECT id FROM reviews WHERE order_id = ?', order_id);
    if (existing) return res.status(409).json({ error: 'Already reviewed' });
    await db.run('INSERT INTO reviews (order_id, listing_id, buyer_id, seller_id, rating, condition, comment) VALUES (?,?,?,?,?,?,?)',
      order_id, order.listing_id, req.userId, order.seller_id, rating, condition || '', comment || '');
    // Update seller rating
    const stats = await db.get('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE seller_id = ?', order.seller_id);
    await db.run('UPDATE users SET rating = ?, review_count = ? WHERE id = ?', Math.round(stats.avg * 10) / 10, stats.cnt, order.seller_id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get reviews for listing
router.get('/listing/:id', async (req, res) => {
  try {
    const reviews = await db.all('SELECT r.*, u.name as buyer_name FROM reviews r JOIN users u ON r.buyer_id = u.id WHERE r.listing_id = ? ORDER BY r.created_at DESC', req.params.id);
    res.json(reviews);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
