import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

// Get conversations
router.get('/conversations', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const msgs = await db.all(`
      SELECT m.*, s.name as sender_name, r.name as receiver_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      WHERE m.sender_id = ? OR m.receiver_id = ?
      ORDER BY m.created_at ASC
    `, req.userId, req.userId);
    // Group into conversations
    const convos: Record<string, any> = {};
    for (const m of msgs) {
      const otherId = m.sender_id === req.userId ? m.receiver_id : m.sender_id;
      const otherName = m.sender_id === req.userId ? m.receiver_name : m.sender_name;
      const key = m.order_id ? `${otherId}-${m.order_id}` : `${otherId}`;
      if (!convos[key]) convos[key] = { otherId, otherName, orderId: m.order_id, messages: [] };
      convos[key].messages.push(m);
    }
    res.json(Object.values(convos));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Send message
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { receiver_id, order_id, listing_id, body } = req.body;
    if (!receiver_id || !body) return res.status(400).json({ error: 'Receiver and body required' });
    await db.run('INSERT INTO messages (sender_id, receiver_id, order_id, listing_id, body) VALUES (?,?,?,?,?)',
      req.userId, receiver_id, order_id || null, listing_id || null, body);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Mark read
router.put('/read/:otherId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await db.run('UPDATE messages SET is_read = true WHERE receiver_id = ? AND sender_id = ?', req.userId, req.params.otherId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Unread count
router.get('/unread', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const row = await db.get('SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = false', req.userId);
    res.json({ count: row?.count || 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
