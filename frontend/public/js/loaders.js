// Data loaders + initial boot.
import { state } from './state.js';
import { api } from './api.js';
import { render } from './ui.js';
import { renderLogin } from './views/login.js';

export async function loadDay() {
  state.log = await api('/log?date=' + state.date);
  render();
}
export async function loadTargets() { state.targets = await api('/targets'); }
export async function loadFoods() { state.foods = await api('/foods'); }
export async function loadRecipes() { state.recipes = await api('/recipes'); }
export async function loadTracker() { state.tracker = await api('/tracker?date=' + state.trackerDate); }

export async function boot() {
  try {
    const me = await api('/me');
    state.user = me.username;
    await Promise.all([loadTargets(), loadFoods(), loadRecipes()]);
    await loadDay();
  } catch {
    renderLogin();
  }
}
