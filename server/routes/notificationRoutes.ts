import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const notifs = await db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', req.userId);
    res.json(notifs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/unread', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const row = await db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false', req.userId);
    res.json({ count: row?.count || 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/read', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = true WHERE user_id = ?', req.userId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;

// Helper to create notifications from other routes
export async function createNotification(userId: number, type: string, title: string, body: string, link?: string) {
  try { await db.run('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)', userId, type, title, body, link || ''); } catch {}
}
