import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../auth.js';
import { todayISO, macrosForFood, recipeMacros } from '../lib/helpers.js';

const router = Router();

router.get('/log', authRequired, (req, res) => {
  const date = req.query.date || todayISO();
  const entries = db
    .prepare('SELECT * FROM log_entries WHERE user_id = ? AND log_date = ? ORDER BY created_at')
    .all(req.user.id, date);
  const totals = entries.reduce(
    (acc, e) => {
      acc.kcal += e.kcal;
      acc.protein += e.protein;
      acc.carbs += e.carbs;
      acc.fat += e.fat;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  res.json({ date, entries, totals });
});

router.post('/log', authRequired, (req, res) => {
  const { date, type, id, quantity } = req.body || {};
  const logDate = date || todayISO();
  const qty = +quantity || 0;
  if (type === 'food') {
    const food = db.prepare('SELECT * FROM foods WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!food) return res.status(404).json({ error: 'Aliment introuvable' });
    const m = macrosForFood(food, qty);
    const info = db
      .prepare(
        `INSERT INTO log_entries (user_id, log_date, food_id, quantity, kcal, protein, carbs, fat, label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, logDate, food.id, qty, m.kcal, m.protein, m.carbs, m.fat,
        `${food.name} · ${qty}${food.unit}`);
    return res.json(db.prepare('SELECT * FROM log_entries WHERE id = ?').get(info.lastInsertRowid));
  }
  if (type === 'recipe') {
    const m = recipeMacros(id, req.user.id);
    if (!m) return res.status(404).json({ error: 'Recette introuvable' });
    const servings = qty; // quantity = number of servings
    const macros = {
      kcal: m.perServing.kcal * servings,
      protein: m.perServing.protein * servings,
      carbs: m.perServing.carbs * servings,
      fat: m.perServing.fat * servings,
    };
    const info = db
      .prepare(
        `INSERT INTO log_entries (user_id, log_date, recipe_id, quantity, kcal, protein, carbs, fat, label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, logDate, m.recipe.id, servings, macros.kcal, macros.protein, macros.carbs, macros.fat,
        `${m.recipe.name} · ${servings} part${servings > 1 ? 's' : ''}`);
    return res.json(db.prepare('SELECT * FROM log_entries WHERE id = ?').get(info.lastInsertRowid));
  }
  res.status(400).json({ error: 'Type invalide' });
});

router.delete('/log/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM log_entries WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

export default router;
