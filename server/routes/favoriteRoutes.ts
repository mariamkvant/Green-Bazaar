import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const favs = await db.all(`
      SELECT f.*, l.name, l.price, l.image, l.unit, l.stock, l.latin, u.name as seller_name, u.city as seller_city
      FROM favorites f JOIN listings l ON f.listing_id = l.id JOIN users u ON l.seller_id = u.id
      WHERE f.user_id = ? ORDER BY f.created_at DESC
    `, req.userId);
    res.json(favs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:listingId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await db.run('INSERT INTO favorites (user_id, listing_id) VALUES (?, ?) ON CONFLICT DO NOTHING', req.userId, req.params.listingId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:listingId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await db.run('DELETE FROM favorites WHERE user_id = ? AND listing_id = ?', req.userId, req.params.listingId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/ids', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const rows = await db.all('SELECT listing_id FROM favorites WHERE user_id = ?', req.userId);
    res.json(rows.map((r: any) => r.listing_id));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
