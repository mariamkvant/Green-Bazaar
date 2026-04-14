import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest, optionalAuth } from '../auth';
import { sendEmail, orderNotificationHtml } from '../email';

const router = Router();

// Create support ticket (works for logged in and anonymous)
router.post('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { email, subject, message, type } = req.body;
    if (!email || !subject || !message) return res.status(400).json({ error: 'All fields required' });
    // Store in notifications for admin (simple approach)
    const admins = await db.all('SELECT id, email FROM users WHERE is_admin = true');
    for (const admin of admins) {
      await db.run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        admin.id, 'support', `Support: ${subject}`, `From: ${email}\nType: ${type || 'general'}\n\n${message}`, '/admin');
      await sendEmail(admin.email, `[Support] ${subject}`, orderNotificationHtml(`Support Request: ${subject}`, `From: ${email}<br>Type: ${type || 'general'}<br><br>${message}`));
    }
    res.json({ message: 'Support request sent. We\'ll respond within 24 hours.' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Partnership inquiry
router.post('/partnership', async (req, res) => {
  try {
    const { name, email, company, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'All fields required' });
    const admins = await db.all('SELECT id, email FROM users WHERE is_admin = true');
    for (const admin of admins) {
      await db.run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)',
        admin.id, 'partnership', `Partnership: ${company || name}`, `From: ${name} (${email})\nCompany: ${company || 'N/A'}\n\n${message}`, '/admin');
      await sendEmail(admin.email, `[Partnership] ${company || name}`, orderNotificationHtml(`Partnership Inquiry`, `From: ${name} (${email})<br>Company: ${company || 'N/A'}<br><br>${message}`));
    }
    res.json({ message: 'Partnership inquiry sent. We\'ll be in touch!' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Dashboard stats for current user
router.get('/dashboard-stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.userId);
    const ordersBought = await db.all("SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC LIMIT 5", req.userId);
    const ordersSold = await db.all("SELECT * FROM orders WHERE seller_id = ? ORDER BY created_at DESC LIMIT 5", req.userId);
    const totalSpent = await db.get("SELECT COALESCE(SUM(total),0) as t FROM orders WHERE buyer_id = ? AND status = 'completed'", req.userId);
    const totalEarned = await db.get("SELECT COALESCE(SUM(price),0) as t FROM orders WHERE seller_id = ? AND status = 'completed'", req.userId);
    const myListings = await db.get('SELECT COUNT(*) as c FROM listings WHERE seller_id = ? AND active = true', req.userId);
    const myReviews = await db.all('SELECT r.*, l.name as plant_name FROM reviews r JOIN listings l ON r.listing_id = l.id WHERE r.seller_id = ? ORDER BY r.created_at DESC LIMIT 5', req.userId);
    const recentActivity = await db.all(`
      SELECT 'order' as type, o.id, o.status, o.created_at, l.name as plant_name
      FROM orders o JOIN listings l ON o.listing_id = l.id
      WHERE o.buyer_id = ? OR o.seller_id = ?
      UNION ALL
      SELECT 'review' as type, r.id, CAST(r.rating AS TEXT) as status, r.created_at, l.name as plant_name
      FROM reviews r JOIN listings l ON r.listing_id = l.id WHERE r.seller_id = ?
      ORDER BY created_at DESC LIMIT 10
    `, req.userId, req.userId, req.userId);

    // Predictive stats for sellers
    let predictions: any[] = [];
    if (user.type === 'seller' || (await db.get('SELECT COUNT(*) as c FROM listings WHERE seller_id = ?', req.userId))?.c > 0) {
      // Find which categories sell fastest
      const catStats = await db.all(`
        SELECT l.category, COUNT(o.id) as order_count,
          AVG(EXTRACT(EPOCH FROM (o.created_at - l.created_at))/86400) as avg_days_to_sell
        FROM orders o JOIN listings l ON o.listing_id = l.id
        WHERE o.status != 'cancelled'
        GROUP BY l.category ORDER BY order_count DESC
      `);
      predictions = catStats.map((c: any) => ({
        category: c.category,
        orders: parseInt(c.order_count),
        avgDaysToSell: Math.round(parseFloat(c.avg_days_to_sell) || 0),
        likelihood: Math.min(95, Math.round((parseInt(c.order_count) / Math.max(1, parseInt(c.order_count))) * 80 + 15)),
      }));
    }

    // Trust score calculation
    const completedOrders = parseInt((await db.get("SELECT COUNT(*) as c FROM orders WHERE (buyer_id = ? OR seller_id = ?) AND status = 'completed'", req.userId, req.userId))?.c || '0');
    const disputeCount = parseInt((await db.get("SELECT COUNT(*) as c FROM disputes WHERE buyer_id = ? OR seller_id = ?", req.userId, req.userId))?.c || '0');
    const reviewAvg = parseFloat((await db.get("SELECT AVG(rating) as a FROM reviews WHERE seller_id = ?", req.userId))?.a || '0');
    const trustScore = Math.min(100, Math.round(
      (user.verified ? 20 : 0) +
      Math.min(30, completedOrders * 6) +
      Math.min(25, reviewAvg * 5) +
      (disputeCount === 0 ? 15 : Math.max(0, 15 - disputeCount * 5)) +
      (user.verified_seller ? 10 : 0)
    ));

    res.json({
      user: { name: user.name, type: user.type, rating: user.rating, review_count: user.review_count, verified: user.verified, verified_seller: user.verified_seller },
      stats: { total_spent: parseInt(totalSpent?.t || '0'), total_earned: parseInt(totalEarned?.t || '0'), active_listings: parseInt(myListings?.c || '0'), completed_orders: completedOrders },
      trust_score: trustScore,
      recent_activity: recentActivity,
      recent_reviews: myReviews,
      predictions,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
