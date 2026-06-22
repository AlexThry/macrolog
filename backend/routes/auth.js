import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signToken, authRequired, cookieOptions } from '../auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  const token = signToken(user);
  res.cookie('token', token, cookieOptions);
  res.json({ username: user.username });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', cookieOptions);
  res.json({ ok: true });
});

router.get('/me', authRequired, (req, res) => {
  res.json({ username: req.user.username });
});

export default router;
