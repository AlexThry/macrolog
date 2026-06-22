import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();

router.get('/foods', authRequired, (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    rows = db
      .prepare('SELECT * FROM foods WHERE user_id = ? AND name LIKE ? ORDER BY name')
      .all(req.user.id, `%${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM foods WHERE user_id = ? ORDER BY name').all(req.user.id);
  }
  res.json(rows);
});

router.post('/foods', authRequired, (req, res) => {
  const { name, unit, kcal, protein, carbs, fat } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const info = db
    .prepare(
      `INSERT INTO foods (user_id, name, unit, kcal, protein, carbs, fat)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, name.trim(), unit || 'g', +kcal || 0, +protein || 0, +carbs || 0, +fat || 0);
  res.json(db.prepare('SELECT * FROM foods WHERE id = ?').get(info.lastInsertRowid));
});

// Bulk import: body = { foods: [{ name, unit, kcal, protein, carbs, fat }, ...] }
router.post('/foods/import', authRequired, (req, res) => {
  const items = Array.isArray(req.body?.foods) ? req.body.foods : [];
  if (!items.length) return res.status(400).json({ error: 'Aucun aliment à importer' });
  const stmt = db.prepare(
    `INSERT INTO foods (user_id, name, unit, kcal, protein, carbs, fat)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  let inserted = 0;
  const tx = db.transaction(() => {
    for (const it of items) {
      const name = (it?.name || '').trim();
      if (!name) continue;
      const unit = (it.unit || 'g').toString().trim() || 'g';
      stmt.run(req.user.id, name, unit, +it.kcal || 0, +it.protein || 0, +it.carbs || 0, +it.fat || 0);
      inserted++;
    }
  });
  tx();
  res.json({ inserted, skipped: items.length - inserted });
});

router.put('/foods/:id', authRequired, (req, res) => {
  const { name, unit, kcal, protein, carbs, fat } = req.body || {};
  const food = db.prepare('SELECT * FROM foods WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!food) return res.status(404).json({ error: 'Aliment introuvable' });
  db.prepare(
    `UPDATE foods SET name=?, unit=?, kcal=?, protein=?, carbs=?, fat=? WHERE id=?`
  ).run(name?.trim() ?? food.name, unit ?? food.unit, +kcal || 0, +protein || 0, +carbs || 0, +fat || 0, food.id);
  res.json(db.prepare('SELECT * FROM foods WHERE id = ?').get(food.id));
});

router.delete('/foods/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM foods WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

export default router;
