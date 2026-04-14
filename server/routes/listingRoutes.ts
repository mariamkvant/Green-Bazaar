import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

// Get all active listings
router.get('/', async (_req, res) => {
  try {
    const listings = await db.all(`
      SELECT l.*, u.name as seller_name, u.city as seller_city, u.phone as seller_phone,
        u.rating as seller_rating, u.review_count as seller_review_count, u.verified_seller
      FROM listings l JOIN users u ON l.seller_id = u.id
      WHERE l.active = true ORDER BY l.created_at DESC
    `);
    res.json(listings);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get single listing
router.get('/:id', async (req, res) => {
  try {
    const listing = await db.get(`
      SELECT l.*, u.name as seller_name, u.city as seller_city, u.phone as seller_phone,
        u.rating as seller_rating, u.review_count as seller_review_count, u.verified_seller,
        u.bio as seller_bio, u.created_at as seller_joined
      FROM listings l JOIN users u ON l.seller_id = u.id WHERE l.id = ?
    `, req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    const reviews = await db.all(`
      SELECT r.*, u.name as buyer_name FROM reviews r JOIN users u ON r.buyer_id = u.id WHERE r.listing_id = ? ORDER BY r.created_at DESC
    `, req.params.id);
    res.json({ ...listing, reviews });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Seller public profile
router.get('/seller/:id/profile', async (req, res) => {
  try {
    const seller = await db.get('SELECT id, name, city, bio, avatar, rating, review_count, verified_seller, completed_orders, created_at FROM users WHERE id = ?', req.params.id);
    if (!seller) return res.status(404).json({ error: 'Seller not found' });
    const listings = await db.all('SELECT * FROM listings WHERE seller_id = ? AND active = true ORDER BY created_at DESC', req.params.id);
    const reviews = await db.all(`
      SELECT r.*, u.name as buyer_name, l.name as plant_name FROM reviews r
      JOIN users u ON r.buyer_id = u.id JOIN listings l ON r.listing_id = l.id
      WHERE r.seller_id = ? ORDER BY r.created_at DESC LIMIT 20
    `, req.params.id);
    res.json({ ...seller, listings, reviews });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Create listing (seller only)
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check email verified
    const userCheck = await db.get('SELECT type, verified FROM users WHERE id = ?', req.userId);
    if (!userCheck?.verified) return res.status(403).json({ error: 'Please verify your email before creating listings' });
    const { name, latin, category, price, unit, height, age, stock, description, image, images, watering, sunlight, soil, frost_tolerance, best_planting, delivery_fee, delivery_note } = req.body;
    if (!name || !category || !price || !description) return res.status(400).json({ error: 'Required fields missing' });
    const imagesJson = images && images.length ? JSON.stringify(images.slice(0, 5)) : null;
    const result = await db.run(
      'INSERT INTO listings (seller_id, name, latin, category, price, unit, height, age, stock, description, image, images, watering, sunlight, soil, frost_tolerance, best_planting, delivery_fee, delivery_note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      req.userId, name, latin || '', category, price, unit || 'per plant', height || '', age || '', stock || 'available', description, image || '', imagesJson, watering || '', sunlight || '', soil || '', frost_tolerance || '', best_planting || '', parseInt(delivery_fee) || 0, delivery_note || ''
    );
    const listing = await db.get('SELECT * FROM listings WHERE id = ?', result.id);
    res.json(listing);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Update listing
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const listing = await db.get('SELECT * FROM listings WHERE id = ? AND seller_id = ?', req.params.id, req.userId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    const { name, latin, category, price, unit, height, age, stock, description, image, active } = req.body;
    await db.run('UPDATE listings SET name=COALESCE(?,name), latin=COALESCE(?,latin), category=COALESCE(?,category), price=COALESCE(?,price), unit=COALESCE(?,unit), height=COALESCE(?,height), age=COALESCE(?,age), stock=COALESCE(?,stock), description=COALESCE(?,description), image=COALESCE(?,image), active=COALESCE(?,active) WHERE id=?',
      name||null, latin||null, category||null, price||null, unit||null, height||null, age||null, stock||null, description||null, image||null, active??null, req.params.id);
    const updated = await db.get('SELECT * FROM listings WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Delete listing
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const listing = await db.get('SELECT * FROM listings WHERE id = ? AND seller_id = ?', req.params.id, req.userId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    await db.run('DELETE FROM listings WHERE id = ?', req.params.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get my listings
router.get('/my/all', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const listings = await db.all('SELECT * FROM listings WHERE seller_id = ? ORDER BY created_at DESC', req.userId);
    res.json(listings);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
