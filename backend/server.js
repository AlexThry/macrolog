import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './db.js';
import { signToken, authRequired, cookieOptions } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

// ---------- Helpers ----------
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Compute macros for a food at a given quantity (food macros are per 100 units)
function macrosForFood(food, quantity) {
  const f = quantity / 100;
  return {
    kcal: food.kcal * f,
    protein: food.protein * f,
    carbs: food.carbs * f,
    fat: food.fat * f,
  };
}

// Compute total macros of a recipe (sum of items), and per-serving
function recipeMacros(recipeId, userId) {
  const recipe = db
    .prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?')
    .get(recipeId, userId);
  if (!recipe) return null;
  const items = db
    .prepare(
      `SELECT ri.quantity, f.* FROM recipe_items ri
       JOIN foods f ON f.id = ri.food_id
       WHERE ri.recipe_id = ?`
    )
    .all(recipeId);
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const it of items) {
    const m = macrosForFood(it, it.quantity);
    total.kcal += m.kcal;
    total.protein += m.protein;
    total.carbs += m.carbs;
    total.fat += m.fat;
  }
  const servings = recipe.servings || 1;
  const perServing = {
    kcal: total.kcal / servings,
    protein: total.protein / servings,
    carbs: total.carbs / servings,
    fat: total.fat / servings,
  };
  return { recipe, items, total, perServing };
}

// ---------- Auth routes ----------
app.post('/api/login', (req, res) => {
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

app.post('/api/logout', (req, res) => {
  res.clearCookie('token', cookieOptions);
  res.json({ ok: true });
});

app.get('/api/me', authRequired, (req, res) => {
  res.json({ username: req.user.username });
});

// ---------- Targets ----------
app.get('/api/targets', authRequired, (req, res) => {
  let t = db.prepare('SELECT kcal, protein, carbs, fat FROM targets WHERE user_id = ?').get(req.user.id);
  if (!t) {
    db.prepare('INSERT INTO targets (user_id) VALUES (?)').run(req.user.id);
    t = db.prepare('SELECT kcal, protein, carbs, fat FROM targets WHERE user_id = ?').get(req.user.id);
  }
  res.json(t);
});

app.put('/api/targets', authRequired, (req, res) => {
  const { kcal, protein, carbs, fat } = req.body || {};
  db.prepare(
    `INSERT INTO targets (user_id, kcal, protein, carbs, fat) VALUES (@uid, @kcal, @protein, @carbs, @fat)
     ON CONFLICT(user_id) DO UPDATE SET kcal=@kcal, protein=@protein, carbs=@carbs, fat=@fat`
  ).run({ uid: req.user.id, kcal: +kcal || 0, protein: +protein || 0, carbs: +carbs || 0, fat: +fat || 0 });
  res.json({ ok: true });
});

// ---------- Foods ----------
app.get('/api/foods', authRequired, (req, res) => {
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

app.post('/api/foods', authRequired, (req, res) => {
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
app.post('/api/foods/import', authRequired, (req, res) => {
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

app.put('/api/foods/:id', authRequired, (req, res) => {
  const { name, unit, kcal, protein, carbs, fat } = req.body || {};
  const food = db.prepare('SELECT * FROM foods WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!food) return res.status(404).json({ error: 'Aliment introuvable' });
  db.prepare(
    `UPDATE foods SET name=?, unit=?, kcal=?, protein=?, carbs=?, fat=? WHERE id=?`
  ).run(name?.trim() ?? food.name, unit ?? food.unit, +kcal || 0, +protein || 0, +carbs || 0, +fat || 0, food.id);
  res.json(db.prepare('SELECT * FROM foods WHERE id = ?').get(food.id));
});

app.delete('/api/foods/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM foods WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ---------- Recipes ----------
app.get('/api/recipes', authRequired, (req, res) => {
  const recipes = db.prepare('SELECT * FROM recipes WHERE user_id = ? ORDER BY name').all(req.user.id);
  const out = recipes.map((r) => {
    const m = recipeMacros(r.id, req.user.id);
    return { ...r, perServing: m.perServing, total: m.total, itemCount: m.items.length };
  });
  res.json(out);
});

app.get('/api/recipes/:id', authRequired, (req, res) => {
  const m = recipeMacros(req.params.id, req.user.id);
  if (!m) return res.status(404).json({ error: 'Recette introuvable' });
  res.json({ ...m.recipe, items: m.items, perServing: m.perServing, total: m.total });
});

app.post('/api/recipes', authRequired, (req, res) => {
  const { name, servings, items } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO recipes (user_id, name, servings) VALUES (?, ?, ?)')
      .run(req.user.id, name.trim(), +servings || 1);
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

app.put('/api/recipes/:id', authRequired, (req, res) => {
  const { name, servings, items } = req.body || {};
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!recipe) return res.status(404).json({ error: 'Recette introuvable' });
  const tx = db.transaction(() => {
    db.prepare('UPDATE recipes SET name=?, servings=? WHERE id=?').run(
      name?.trim() ?? recipe.name,
      +servings || recipe.servings,
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

app.delete('/api/recipes/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM recipes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ---------- Log ----------
app.get('/api/log', authRequired, (req, res) => {
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

app.post('/api/log', authRequired, (req, res) => {
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

app.delete('/api/log/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM log_entries WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ---------- Static frontend ----------
app.use(express.static(join(__dirname, '..', 'frontend', 'public')));
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'frontend', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MacroLog en écoute sur http://localhost:${PORT}`);
});
