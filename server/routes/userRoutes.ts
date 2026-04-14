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
      'INSERT INTO users (name, email, password, phone, city, type, verified, verify_code, verify_expires) VALUES (?,?,?,?,?,?,?,?,?)',
      name, email.toLowerCase(), hash, phone || '', city, type, false, code, expires
    );
    await sendEmail(email.toLowerCase(), 'Verify your Green Bazaar account', verifyEmailHtml(code));
    const token = generateToken(result.id);
    res.json({ token, user: { id: result.id, name, email: email.toLowerCase(), phone, city, type, verified: false } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Verify email
router.post('/verify-email', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.verified) return res.json({ message: 'Already verified' });
    if (user.verify_code !== code) return res.status(400).json({ error: 'Invalid code' });
    const expires = new Date(user.verify_expires);
    if (isNaN(expires.getTime()) || expires < new Date()) {
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }
    await db.run('UPDATE users SET verified = true, verify_code = NULL, verify_expires = NULL WHERE id = ?', req.userId);
    res.json({ message: 'Email verified', verified: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Resend verification code
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

export default router;
