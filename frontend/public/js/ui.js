// App shell: top bar, bottom tabs, and view dispatch.
import { state } from './state.js';
import { app } from './dom.js';
import { renderLogin, logout } from './views/login.js';
import { renderDay } from './views/day.js';
import { renderFoods } from './views/foods.js';
import { renderRecipes } from './views/recipes.js';
import { renderTracker } from './views/tracker.js';
import { renderSettings } from './views/settings.js';
import { loadTracker } from './loaders.js';

function tabBtn(id, ic, label) {
  return `<button data-tab="${id}" class="${state.tab === id ? 'active' : ''}">
    <span class="ic">${ic}</span>${label}</button>`;
}

export function render() {
  if (!state.user) return renderLogin();
  app.innerHTML = `
    <header class="topbar"><div class="topbar-inner">
      <div class="brand">Macro<span class="dot">·</span>Log <small>/${state.user}</small></div>
      <button class="logout-btn" id="btn-logout">quitter</button>
    </div></header>
    <main class="wrap" id="view"></main>
    <nav class="tabs">
      ${tabBtn('day', '◉', 'Journée')}
      ${tabBtn('tracker', '◈', 'Suivi')}
      ${tabBtn('foods', '⬡', 'Aliments')}
      ${tabBtn('recipes', '❏', 'Recettes')}
      ${tabBtn('settings', '⚙', 'Cibles')}
    </nav>`;
  document.getElementById('btn-logout').onclick = logout;
  app.querySelectorAll('nav.tabs button').forEach((b) => {
    b.onclick = () => { state.tab = b.dataset.tab; render(); };
  });
  const view = document.getElementById('view');
  if (state.tab === 'day') renderDay(view);
  else if (state.tab === 'tracker') {
    if (!state.tracker) { view.innerHTML = '<div class="empty">Chargement…</div>'; loadTracker().then(render); }
    else renderTracker(view);
  }
  else if (state.tab === 'foods') renderFoods(view);
  else if (state.tab === 'recipes') renderRecipes(view);
  else if (state.tab === 'settings') renderSettings(view);
}
