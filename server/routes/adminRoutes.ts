import { Router, Response } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

async function adminCheck(req: AuthRequest, res: Response, next: Function) {
  const user = await db.get('SELECT is_admin FROM users WHERE id = ?', req.userId);
  if (!user?.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

// Check admin status
router.get('/check', authMiddleware, async (req: AuthRequest, res) => {
  const user = await db.get('SELECT is_admin FROM users WHERE id = ?', req.userId);
  res.json({ is_admin: !!user?.is_admin });
});

// Dashboard stats
router.get('/stats', authMiddleware, adminCheck, async (_req: AuthRequest, res) => {
  try {
    const users = await db.get('SELECT COUNT(*) as c FROM users');
    const sellers = await db.get("SELECT COUNT(*) as c FROM users WHERE type = 'seller'");
    const buyers = await db.get("SELECT COUNT(*) as c FROM users WHERE type = 'buyer'");
    const verified = await db.get("SELECT COUNT(*) as c FROM users WHERE verified = true");
    const listings = await db.get('SELECT COUNT(*) as c FROM listings WHERE active = true');
    const orders = await db.get('SELECT COUNT(*) as c FROM orders');
    const completed = await db.get("SELECT COUNT(*) as c FROM orders WHERE status = 'completed'");
    const disputed = await db.get("SELECT COUNT(*) as c FROM orders WHERE status = 'disputed'");
    const revenue = await db.get("SELECT COALESCE(SUM(service_fee),0) as total FROM orders WHERE status = 'completed'");
    const weekUsers = await db.get("SELECT COUNT(*) as c FROM users WHERE created_at > NOW() - INTERVAL '7 days'");
    const weekOrders = await db.get("SELECT COUNT(*) as c FROM orders WHERE created_at > NOW() - INTERVAL '7 days'");
    const messages = await db.get('SELECT COUNT(*) as c FROM messages');
    const reviews = await db.get('SELECT COUNT(*) as c FROM reviews');
    const avgRating = await db.get('SELECT AVG(rating) as avg FROM reviews');
    const disputes = await db.get('SELECT COUNT(*) as c FROM disputes');
    const openDisputes = await db.get("SELECT COUNT(*) as c FROM disputes WHERE status = 'open'");

    res.json({
      total_users: parseInt(users?.c||'0'), sellers: parseInt(sellers?.c||'0'), buyers: parseInt(buyers?.c||'0'),
      verified_users: parseInt(verified?.c||'0'), active_listings: parseInt(listings?.c||'0'),
      total_orders: parseInt(orders?.c||'0'), completed_orders: parseInt(completed?.c||'0'),
      disputed_orders: parseInt(disputed?.c||'0'), platform_revenue: parseInt(revenue?.total||'0'),
      new_users_week: parseInt(weekUsers?.c||'0'), orders_week: parseInt(weekOrders?.c||'0'),
      total_messages: parseInt(messages?.c||'0'), total_reviews: parseInt(reviews?.c||'0'),
      avg_rating: parseFloat(avgRating?.avg||'0').toFixed(1),
      total_disputes: parseInt(disputes?.c||'0'), open_disputes: parseInt(openDisputes?.c||'0'),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// List users
router.get('/users', authMiddleware, adminCheck, async (req: AuthRequest, res) => {
  try {
    const users = await db.all('SELECT id, name, email, type, city, verified, verified_seller, rating, review_count, completed_orders, created_at FROM users ORDER BY created_at DESC LIMIT 100');
    res.json(users);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Verify user email (admin)
router.put('/users/:id/verify', authMiddleware, adminCheck, async (req: AuthRequest, res) => {
  try {
    await db.run('UPDATE users SET verified = true, verify_code = NULL WHERE id = ?', req.params.id);
    res.json({ message: 'User verified' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Toggle admin
router.put('/users/:id/admin', authMiddleware, adminCheck, async (req: AuthRequest, res) => {
  try {
    const { is_admin } = req.body;
    await db.run('UPDATE users SET is_admin = ? WHERE id = ?', !!is_admin, req.params.id);
    res.json({ message: is_admin ? 'Admin granted' : 'Admin removed' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// List disputes
router.get('/disputes', authMiddleware, adminCheck, async (_req: AuthRequest, res) => {
  try {
    const disputes = await db.all(`
      SELECT d.*, b.name as buyer_name, s.name as seller_name, l.name as plant_name
      FROM disputes d JOIN users b ON d.buyer_id = b.id JOIN users s ON d.seller_id = s.id
      JOIN orders o ON d.order_id = o.id JOIN listings l ON o.listing_id = l.id
      ORDER BY CASE WHEN d.status = 'open' THEN 0 ELSE 1 END, d.created_at DESC
    `);
    res.json(disputes);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Resolve dispute
router.put('/disputes/:id/resolve', authMiddleware, adminCheck, async (req: AuthRequest, res) => {
  try {
    const { resolution } = req.body; // 'refund' or 'release'
    const dispute = await db.get('SELECT * FROM disputes WHERE id = ?', req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Not found' });
    await db.run("UPDATE disputes SET status = 'resolved' WHERE id = ?", dispute.id);
    if (resolution === 'refund') {
      await db.run("UPDATE orders SET status = 'cancelled', escrow_status = 'refunded' WHERE id = ?", dispute.order_id);
    } else {
      await db.run("UPDATE orders SET status = 'completed', escrow_status = 'released' WHERE id = ?", dispute.order_id);
    }
    res.json({ message: `Dispute resolved: ${resolution}` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Make mariamkvant@gmail.com admin on first call
router.post('/init-admin', async (req, res) => {
  try {
    const secret = req.headers['x-admin-secret'] || req.query.secret;
    if (secret !== (process.env.ADMIN_SECRET || 'gb-admin-2026')) return res.status(403).json({ error: 'Unauthorized' });
    await db.run("UPDATE users SET is_admin = true, verified = true WHERE email = 'mariamkvant@gmail.com'");
    res.json({ message: 'Admin initialized' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
