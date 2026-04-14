import { Router } from 'express';
import db from '../database';
import { optionalAuth, AuthRequest } from '../auth';

const router = Router();

// Similar plants — based on same category, similar price range, different seller
router.get('/similar/:listingId', async (req, res) => {
  try {
    const listing = await db.get('SELECT * FROM listings WHERE id = ?', req.params.listingId);
    if (!listing) return res.json([]);
    const similar = await db.all(`
      SELECT l.*, u.name as seller_name, u.city as seller_city, u.rating as seller_rating
      FROM listings l JOIN users u ON l.seller_id = u.id
      WHERE l.active = true AND l.id != ? AND (
        l.category = ? OR ABS(l.price - ?) < ? * 0.5
      )
      ORDER BY
        CASE WHEN l.category = ? THEN 0 ELSE 1 END,
        ABS(l.price - ?) ASC
      LIMIT 4
    `, listing.id, listing.category, listing.price, listing.price, listing.category, listing.price);
    res.json(similar);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Seasonal recommendations — plants best planted this month
router.get('/seasonal', async (_req, res) => {
  try {
    const months = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const currentMonth = months[now.getMonth()];
    // Match listings where best_planting contains current month name
    const seasonal = await db.all(`
      SELECT l.*, u.name as seller_name, u.city as seller_city, u.rating as seller_rating
      FROM listings l JOIN users u ON l.seller_id = u.id
      WHERE l.active = true AND l.best_planting IS NOT NULL AND l.best_planting != ''
      AND (LOWER(l.best_planting) LIKE $1 OR LOWER(l.best_planting) LIKE $2)
      ORDER BY u.rating DESC NULLS LAST
      LIMIT 6
    `, `%${currentMonth.toLowerCase()}%`, `%${currentMonth.substring(0, 3).toLowerCase()}%`);
    res.json({ month: currentMonth, plants: seasonal });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Popular / trending — most ordered or highest rated
router.get('/popular', async (_req, res) => {
  try {
    const popular = await db.all(`
      SELECT l.*, u.name as seller_name, u.city as seller_city, u.rating as seller_rating,
        COUNT(o.id) as order_count
      FROM listings l
      JOIN users u ON l.seller_id = u.id
      LEFT JOIN orders o ON o.listing_id = l.id AND o.status != 'cancelled'
      WHERE l.active = true
      GROUP BY l.id, u.name, u.city, u.rating
      ORDER BY order_count DESC, u.rating DESC NULLS LAST
      LIMIT 6
    `);
    res.json(popular);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Personalized — based on user's favorites and order history
router.get('/for-you', optionalAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.json([]);
    // Get categories the user has favorited or ordered
    const favCats = await db.all(`
      SELECT DISTINCT l.category FROM favorites f JOIN listings l ON f.listing_id = l.id WHERE f.user_id = ?
    `, req.userId);
    const orderCats = await db.all(`
      SELECT DISTINCT l.category FROM orders o JOIN listings l ON o.listing_id = l.id WHERE o.buyer_id = ?
    `, req.userId);
    const cats = [...new Set([...favCats.map((r: any) => r.category), ...orderCats.map((r: any) => r.category)])];
    if (!cats.length) return res.json([]);
    // Find listings in those categories the user hasn't bought yet
    const placeholders = cats.map((_: any, i: number) => `$${i + 2}`).join(',');
    const recs = await db.all(`
      SELECT l.*, u.name as seller_name, u.city as seller_city, u.rating as seller_rating
      FROM listings l JOIN users u ON l.seller_id = u.id
      WHERE l.active = true AND l.category IN (${placeholders})
      AND l.id NOT IN (SELECT listing_id FROM orders WHERE buyer_id = $1)
      AND l.id NOT IN (SELECT listing_id FROM favorites WHERE user_id = $1)
      ORDER BY u.rating DESC NULLS LAST
      LIMIT 6
    `, req.userId, ...cats);
    res.json(recs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
