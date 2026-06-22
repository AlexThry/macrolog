import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../auth.js';
import { recipeMacros } from '../lib/helpers.js';

const router = Router();

router.get('/recipes', authRequired, (req, res) => {
  const recipes = db.prepare('SELECT * FROM recipes WHERE user_id = ? ORDER BY name').all(req.user.id);
  const out = recipes.map((r) => {
    const m = recipeMacros(r.id, req.user.id);
    return { ...r, perServing: m.perServing, total: m.total, itemCount: m.items.length };
  });
  res.json(out);
});

router.get('/recipes/:id', authRequired, (req, res) => {
  const m = recipeMacros(req.params.id, req.user.id);
  if (!m) return res.status(404).json({ error: 'Recette introuvable' });
  res.json({ ...m.recipe, items: m.items, perServing: m.perServing, total: m.total });
});

router.post('/recipes', authRequired, (req, res) => {
  const { name, servings, notes, items } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO recipes (user_id, name, servings, notes) VALUES (?, ?, ?, ?)')
      .run(req.user.id, name.trim(), +servings || 1, (notes ?? '').toString());
    const rid = info.lastInsertRowid;
    const stmt = db.prepare('INSERT INTO recipe_items (recipe_id, food_id, quantity) VALUES (?, ?, ?)');
    for (const it of items || []) {
      // verify food belongs to user
      const f = db.prepare('SELECT id FROM foods WHERE id = ? AND user_id = ?').get(it.food_id, req.user.id);
      if (f) stmt.run(rid, it.food_id, +it.quantity || 0);
    }
    return rid;
  });
  const rid = tx();
  const m = recipeMacros(rid, req.user.id);
  res.json({ ...m.recipe, items: m.items, perServing: m.perServing, total: m.total });
});

router.put('/recipes/:id', authRequired, (req, res) => {
  const { name, servings, notes, items } = req.body || {};
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!recipe) return res.status(404).json({ error: 'Recette introuvable' });
  const tx = db.transaction(() => {
    db.prepare('UPDATE recipes SET name=?, servings=?, notes=? WHERE id=?').run(
      name?.trim() ?? recipe.name,
      +servings || recipe.servings,
      (notes ?? recipe.notes ?? '').toString(),
      recipe.id
    );
    db.prepare('DELETE FROM recipe_items WHERE recipe_id = ?').run(recipe.id);
    const stmt = db.prepare('INSERT INTO recipe_items (recipe_id, food_id, quantity) VALUES (?, ?, ?)');
    for (const it of items || []) {
      const f = db.prepare('SELECT id FROM foods WHERE id = ? AND user_id = ?').get(it.food_id, req.user.id);
      if (f) stmt.run(recipe.id, it.food_id, +it.quantity || 0);
    }
  });
  tx();
  const m = recipeMacros(recipe.id, req.user.id);
  res.json({ ...m.recipe, items: m.items, perServing: m.perServing, total: m.total });
});

router.delete('/recipes/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM recipes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

export default router;
