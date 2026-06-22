import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../auth.js';
import { todayISO, shiftISO } from '../lib/helpers.js';

const router = Router();

// Combined read for the tracker view: goal, weights (month + 6 days back for the
// 7-day moving average), habits, habit checks for the month, and the day's journal.
router.get('/tracker', authRequired, (req, res) => {
  const date = req.query.date || todayISO();
  const month = (req.query.month || date.slice(0, 7));
  const monthStart = month + '-01';
  const monthEnd = month + '-31'; // string upper bound; lexicographically covers the month
  const winStart = shiftISO(monthStart, -6);

  let tr = db.prepare('SELECT weight_goal FROM tracker WHERE user_id = ?').get(req.user.id);
  if (!tr) {
    db.prepare('INSERT INTO tracker (user_id) VALUES (?)').run(req.user.id);
    tr = { weight_goal: null };
  }

  const weights = db
    .prepare('SELECT log_date AS date, weight FROM weight_entries WHERE user_id = ? AND log_date BETWEEN ? AND ? ORDER BY log_date')
    .all(req.user.id, winStart, monthEnd);

  const habits = db.prepare('SELECT id, name FROM habits WHERE user_id = ? ORDER BY id').all(req.user.id);

  const checkRows = db
    .prepare('SELECT habit_id, log_date FROM habit_checks WHERE user_id = ? AND log_date BETWEEN ? AND ?')
    .all(req.user.id, monthStart, monthEnd);
  const checks = {};
  for (const c of checkRows) (checks[c.log_date] ||= []).push(c.habit_id);

  const tw = db.prepare('SELECT weight FROM weight_entries WHERE user_id = ? AND log_date = ?').get(req.user.id, date);
  const jr = db.prepare('SELECT content FROM journal_entries WHERE user_id = ? AND log_date = ?').get(req.user.id, date);

  res.json({
    date, month,
    goal: tr.weight_goal ?? null,
    weights,
    todayWeight: tw ? tw.weight : null,
    habits,
    checks,
    journal: jr ? jr.content : '',
  });
});

router.put('/tracker/goal', authRequired, (req, res) => {
  const w = req.body?.weight;
  const val = (w === '' || w === null || w === undefined) ? null : +w;
  db.prepare(
    `INSERT INTO tracker (user_id, weight_goal) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET weight_goal = excluded.weight_goal`
  ).run(req.user.id, val);
  res.json({ ok: true, weight: val });
});

router.put('/weight', authRequired, (req, res) => {
  const { date, weight } = req.body || {};
  const d = date || todayISO();
  if (weight === '' || weight === null || weight === undefined) {
    db.prepare('DELETE FROM weight_entries WHERE user_id = ? AND log_date = ?').run(req.user.id, d);
    return res.json({ ok: true, date: d, weight: null });
  }
  db.prepare(
    `INSERT INTO weight_entries (user_id, log_date, weight) VALUES (?, ?, ?)
     ON CONFLICT(user_id, log_date) DO UPDATE SET weight = excluded.weight`
  ).run(req.user.id, d, +weight);
  res.json({ ok: true, date: d, weight: +weight });
});

router.post('/habits', authRequired, (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const info = db.prepare('INSERT INTO habits (user_id, name) VALUES (?, ?)').run(req.user.id, name);
  res.json(db.prepare('SELECT id, name FROM habits WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/habits/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM habits WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.put('/habits/:id/check', authRequired, (req, res) => {
  const habit = db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!habit) return res.status(404).json({ error: 'Habitude introuvable' });
  const date = req.body?.date || todayISO();
  if (req.body?.checked) {
    db.prepare(
      `INSERT INTO habit_checks (habit_id, user_id, log_date) VALUES (?, ?, ?)
       ON CONFLICT(habit_id, log_date) DO NOTHING`
    ).run(habit.id, req.user.id, date);
  } else {
    db.prepare('DELETE FROM habit_checks WHERE habit_id = ? AND log_date = ?').run(habit.id, date);
  }
  res.json({ ok: true });
});

router.put('/journal', authRequired, (req, res) => {
  const date = req.body?.date || todayISO();
  const content = (req.body?.content ?? '').toString();
  db.prepare(
    `INSERT INTO journal_entries (user_id, log_date, content) VALUES (?, ?, ?)
     ON CONFLICT(user_id, log_date) DO UPDATE SET content = excluded.content`
  ).run(req.user.id, date, content);
  res.json({ ok: true });
});

export default router;
