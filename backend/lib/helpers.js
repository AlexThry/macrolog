// Shared helpers used across route modules.
import db from '../db.js';

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Shift an ISO date (YYYY-MM-DD) by N days, in UTC.
export function shiftISO(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Macros for a food at a given quantity (food macros are stored per 100 units).
export function macrosForFood(food, quantity) {
  const f = quantity / 100;
  return {
    kcal: food.kcal * f,
    protein: food.protein * f,
    carbs: food.carbs * f,
    fat: food.fat * f,
  };
}

// Total macros of a recipe (sum of items) plus per-serving values.
export function recipeMacros(recipeId, userId) {
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
