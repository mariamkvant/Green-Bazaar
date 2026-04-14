import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database';
import { generateToken, authMiddleware, AuthRequest } from '../auth';
import { sendEmail, generateCode, verifyEmailHtml, resetPasswordHtml } from '../email';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, city, type } = req.body;
    if (!name || !email || !password || !city || !type) return res.status(400).json({ error: 'All fields required' });
    const existing = await db.get('SELECT id FROM users WHERE email = ?', email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const code = generateCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const result = await db.run(
      'INSERT INTO users (name, email, password, phone, city, type, verify_code, verify_expires) VALUES (?,?,?,?,?,?,?,?)',
      name, email.toLowerCase(), hash, phone || '', city, type, code, expires
    );
    await sendEmail(email.toLowerCase(), 'Verify your Green Bazaar account', verifyEmailHtml(code));
    const token = generateToken(result.id);
    res.json({ token, user: { id: result.id, name, email: email.toLowerCase(), phone, city, type, verified: false } });
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
    res.json({ token, user: {
      id: user.id, name: user.name, email: user.email, phone: user.phone,
      city: user.city, type: user.type, bio: user.bio, avatar: user.avatar,
      rating: user.rating, review_count: user.review_count, verified: user.verified,
      verified_seller: user.verified_seller, completed_orders: user.completed_orders
    }});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get current user (full profile)
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await db.get(
      'SELECT id, name, email, phone, city, type, bio, avatar, rating, review_count, verified, verified_seller, completed_orders, created_at FROM users WHERE id = ?',
      req.userId
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Get stats
    const ordersBought = await db.get("SELECT COUNT(*) as c FROM orders WHERE buyer_id = ? AND status = 'completed'", req.userId);
    const ordersSold = await db.get("SELECT COUNT(*) as c FROM orders WHERE seller_id = ? AND status = 'completed'", req.userId);
    const listingsCount = await db.get('SELECT COUNT(*) as c FROM listings WHERE seller_id = ? AND active = true', req.userId);
    const favCount = await db.get('SELECT COUNT(*) as c FROM favorites WHERE user_id = ?', req.userId);
    res.json({
      ...user,
      stats: {
        orders_bought: parseInt(ordersBought?.c || '0'),
        orders_sold: parseInt(ordersSold?.c || '0'),
        active_listings: parseInt(listingsCount?.c || '0'),
        favorites: parseInt(favCount?.c || '0'),
      }
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Update profile
router.put('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, phone, city, bio, avatar } = req.body;
    await db.run(
      'UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone), city=COALESCE(?,city), bio=COALESCE(?,bio), avatar=COALESCE(?,avatar) WHERE id=?',
      name || null, phone || null, city || null, bio || null, avatar || null, req.userId
    );
    const user = await db.get('SELECT id, name, email, phone, city, type, bio, avatar, rating, review_count, verified, verified_seller FROM users WHERE id = ?', req.userId);
    res.json(user);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Change password
router.put('/me/password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    const user = await db.get('SELECT password FROM users WHERE id = ?', req.userId);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password = ? WHERE id = ?', hash, req.userId);
    res.json({ message: 'Password updated' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Verify email
router.post('/verify-email', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.verified) return res.json({ message: 'Already verified' });
    if (user.verify_code !== code) return res.status(400).json({ error: 'Invalid code' });
    const expires = new Date(user.verify_expires);
    if (isNaN(expires.getTime()) || expires < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
    await db.run('UPDATE users SET verified = true, verify_code = NULL, verify_expires = NULL WHERE id = ?', req.userId);
    res.json({ message: 'Email verified!' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Resend verification
router.post('/resend-verify', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.verified) return res.json({ message: 'Already verified' });
    const code = generateCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await db.run('UPDATE users SET verify_code = ?, verify_expires = ? WHERE id = ?', code, expires, req.userId);
    await sendEmail(user.email, 'Verify your Green Bazaar account', verifyEmailHtml(code));
    res.json({ message: 'Verification code sent' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email = ?', email?.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Account not found' });
    const code = generateCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await db.run('UPDATE users SET verify_code = ?, verify_expires = ? WHERE id = ?', code, expires, user.id);
    await sendEmail(user.email, 'Reset your Green Bazaar password', resetPasswordHtml(code));
    res.json({ message: 'Reset code sent to your email' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email = ?', email?.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.verify_code !== code) return res.status(400).json({ error: 'Invalid code' });
    const expires = new Date(user.verify_expires);
    if (isNaN(expires.getTime()) || expires < new Date()) return res.status(400).json({ error: 'Code expired' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password = ?, verify_code = NULL, verify_expires = NULL WHERE id = ?', hash, user.id);
    res.json({ message: 'Password reset successfully' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get public profile
router.get('/:id', async (req, res) => {
  try {
    const user = await db.get('SELECT id, name, city, type, bio, avatar, rating, review_count, verified_seller, completed_orders, created_at FROM users WHERE id = ?', req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
