import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database';
import { generateToken, authMiddleware, AuthRequest } from '../auth';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, city, type } = req.body;
    if (!name || !email || !password || !city || !type) return res.status(400).json({ error: 'All fields required' });
    const existing = await db.get('SELECT id FROM users WHERE email = ?', email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const result = await db.run('INSERT INTO users (name, email, password, phone, city, type) VALUES (?, ?, ?, ?, ?, ?)',
      name, email.toLowerCase(), hash, phone || '', city, type);
    const token = generateToken(result.id);
    res.json({ token, user: { id: result.id, name, email: email.toLowerCase(), phone, city, type } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await db.get('SELECT * FROM users WHERE email = ?', email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Account not found' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });
    const token = generateToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, city: user.city, type: user.type, bio: user.bio, avatar: user.avatar, rating: user.rating, review_count: user.review_count } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await db.get('SELECT id, name, email, phone, city, type, bio, avatar, rating, review_count, created_at FROM users WHERE id = ?', req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Update profile
router.put('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, phone, city, bio, avatar } = req.body;
    await db.run('UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone), city=COALESCE(?,city), bio=COALESCE(?,bio), avatar=COALESCE(?,avatar) WHERE id=?',
      name || null, phone || null, city || null, bio || null, avatar || null, req.userId);
    const user = await db.get('SELECT id, name, email, phone, city, type, bio, avatar, rating, review_count FROM users WHERE id = ?', req.userId);
    res.json(user);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get public profile
router.get('/:id', async (req, res) => {
  try {
    const user = await db.get('SELECT id, name, city, type, bio, avatar, rating, review_count, created_at FROM users WHERE id = ?', req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
