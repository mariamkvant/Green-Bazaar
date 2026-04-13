import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

// Create dispute
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { order_id, reason, description, requested_resolution } = req.body;
    const order = await db.get('SELECT * FROM orders WHERE id = ? AND buyer_id = ?', order_id, req.userId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    await db.run('INSERT INTO disputes (order_id, buyer_id, seller_id, reason, description, requested_resolution) VALUES (?,?,?,?,?,?)',
      order_id, req.userId, order.seller_id, reason, description || '', requested_resolution || 'refund');
    await db.run("UPDATE orders SET status = 'disputed', escrow_status = 'held' WHERE id = ?", order_id);
    await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, body) VALUES (?,?,?,?)',
      req.userId, order.seller_id, order_id, `⚠️ Dispute opened. Reason: ${reason}. Our team will review within 48 hours.`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get my disputes
router.get('/my', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const disputes = await db.all('SELECT * FROM disputes WHERE buyer_id = ? OR seller_id = ? ORDER BY created_at DESC', req.userId, req.userId);
    res.json(disputes);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
