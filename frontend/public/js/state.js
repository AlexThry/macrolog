// Shared app state and tiny numeric helpers.
import { isoDate } from './dates.js';

export function z() { return { kcal: 0, protein: 0, carbs: 0, fat: 0 }; }
export const r0 = (n) => Math.round(n);
export const r1 = (n) => Math.round(n * 10) / 10;

export const state = {
  user: null,
  tab: 'day',
  date: isoDate(new Date()),
  trackerDate: isoDate(new Date()),
  log: { entries: [], totals: z() },
  targets: { kcal: 2000, protein: 175, carbs: 200, fat: 60 },
  foods: [],
  recipes: [],
  tracker: null,
};
