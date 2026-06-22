import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();

router.get('/targets', authRequired, (req, res) => {
  let t = db.prepare('SELECT kcal, protein, carbs, fat FROM targets WHERE user_id = ?').get(req.user.id);
  if (!t) {
    db.prepare('INSERT INTO targets (user_id) VALUES (?)').run(req.user.id);
    t = db.prepare('SELECT kcal, protein, carbs, fat FROM targets WHERE user_id = ?').get(req.user.id);
  }
  res.json(t);
});

router.put('/targets', authRequired, (req, res) => {
  const { kcal, protein, carbs, fat } = req.body || {};
  db.prepare(
    `INSERT INTO targets (user_id, kcal, protein, carbs, fat) VALUES (@uid, @kcal, @protein, @carbs, @fat)
     ON CONFLICT(user_id) DO UPDATE SET kcal=@kcal, protein=@protein, carbs=@carbs, fat=@fat`
  ).run({ uid: req.user.id, kcal: +kcal || 0, protein: +protein || 0, carbs: +carbs || 0, fat: +fat || 0 });
  res.json({ ok: true });
});

export default router;
