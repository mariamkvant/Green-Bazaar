import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

// Get all active listings
router.get('/', async (_req, res) => {
  try {
    const listings = await db.all(`
      SELECT l.*, u.name as seller_name, u.city as seller_city, u.phone as seller_phone, u.rating as seller_rating, u.review_count as seller_review_count
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
      SELECT l.*, u.name as seller_name, u.city as seller_city, u.phone as seller_phone, u.rating as seller_rating, u.review_count as seller_review_count
      FROM listings l JOIN users u ON l.seller_id = u.id WHERE l.id = ?
    `, req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    const reviews = await db.all(`
      SELECT r.*, u.name as buyer_name FROM reviews r JOIN users u ON r.buyer_id = u.id WHERE r.listing_id = ? ORDER BY r.created_at DESC
    `, req.params.id);
    res.json({ ...listing, reviews });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Create listing (seller only)
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await db.get('SELECT type FROM users WHERE id = ?', req.userId);
    if (!user || user.type !== 'seller') return res.status(403).json({ error: 'Only sellers can create listings' });
    const { name, latin, category, price, unit, height, age, stock, description, image } = req.body;
    if (!name || !category || !price || !description) return res.status(400).json({ error: 'Required fields missing' });
    const result = await db.run(
      'INSERT INTO listings (seller_id, name, latin, category, price, unit, height, age, stock, description, image) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      req.userId, name, latin || '', category, price, unit || 'per plant', height || '', age || '', stock || 'available', description, image || ''
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
