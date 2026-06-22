import { state, r0, r1 } from '../state.js';
import { toast, openSheet, closeSheet, escapeHtml } from '../dom.js';
import { api } from '../api.js';
import { isoDate, prettyDate } from '../dates.js';
import { loadDay } from '../loaders.js';

function shiftDate(days) {
  const d = new Date(state.date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  state.date = isoDate(d);
  loadDay();
}

export function renderDay(view) {
  const t = state.log.totals;
  const tg = state.targets;
  const over = t.kcal > tg.kcal;
  const R = 56, C = 2 * Math.PI * R;
  const frac = tg.kcal > 0 ? Math.min(1, t.kcal / tg.kcal) : 0;
  const offset = C * (1 - frac);
  view.innerHTML = `
    <div class="day-head">
      <div class="date-nav">
        <button id="d-prev">‹</button>
        <span class="date-label">${prettyDate(state.date)}</span>
        <button id="d-next">›</button>
      </div>
      <button class="btn small ghost" id="d-today">auj.</button>
    </div>

    <div class="card">
      <div class="hero-ring">
        <div class="ring-wrap">
          <svg viewBox="0 0 132 132">
            <circle class="ring-track-c" cx="66" cy="66" r="${R}"></circle>
            <circle class="ring-arc ${over ? 'over' : ''}" cx="66" cy="66" r="${R}"
              stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"></circle>
          </svg>
          <div class="ring-center">
            <div class="ring-num ${over ? 'over' : ''}">${r0(t.kcal)}</div>
            <div class="ring-cap">/ ${r0(tg.kcal)} kcal</div>
          </div>
        </div>
        <div class="hero-side">
          <div class="hero-rem ${over ? 'over' : ''}">${over
            ? `<b>+${r0(t.kcal - tg.kcal)}</b> kcal au-delà de la cible`
            : `<b>${r0(tg.kcal - t.kcal)}</b> kcal restantes aujourd'hui`}</div>
          ${barRow('Protéines', t.protein, tg.protein, 'prot')}
          ${barRow('Glucides', t.carbs, tg.carbs, 'carbs')}
          ${barRow('Lipides', t.fat, tg.fat, 'fat')}
        </div>
      </div>
    </div>

    <div class="section-title">Entrées du jour</div>
    <div class="card" style="margin-top:8px">
      ${state.log.entries.length ? state.log.entries.map(entryRow).join('') :
        '<div class="empty">Rien encore. Ajoute un aliment ou une recette.</div>'}
    </div>

    <button class="add-fab" id="fab-add" title="Ajouter">+</button>`;

  document.getElementById('d-prev').onclick = () => shiftDate(-1);
  document.getElementById('d-next').onclick = () => shiftDate(1);
  document.getElementById('d-today').onclick = () => { state.date = isoDate(new Date()); loadDay(); };
  document.getElementById('fab-add').onclick = openAddToDay;
  view.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      await api('/log/' + b.dataset.del, { method: 'DELETE' });
      loadDay();
    };
  });
}

function barRow(name, val, tgt, cls) {
  const pct = tgt > 0 ? Math.min(100, (val / tgt) * 100) : 0;
  const over = val > tgt;
  return `<div class="bar-row ${cls}">
    <div class="bar-label">
      <span class="name">${name}</span>
      <span class="val">${r1(val)}<span class="tgt"> / ${r0(tgt)} g</span></span>
    </div>
    <div class="bar-track"><div class="bar-fill ${cls} ${over ? 'over' : ''}" style="width:${pct}%"></div></div>
  </div>`;
}

function entryRow(e) {
  return `<div class="entry">
    <div class="e-main">
      <div class="e-name">${escapeHtml(e.label)}</div>
      <div class="e-macros">P ${r1(e.protein)} · G ${r1(e.carbs)} · L ${r1(e.fat)}</div>
    </div>
    <div class="e-kcal">${r0(e.kcal)}</div>
    <button class="e-del" data-del="${e.id}" title="Retirer">×</button>
  </div>`;
}

export function openAddToDay() {
  openSheet(`
    <h3>Ajouter au journal</h3>
    <div class="sub">${prettyDate(state.date)}</div>
    <div class="search-bar" style="margin-top:14px">
      <input id="add-search" placeholder="Rechercher aliment ou recette…" autocomplete="off" />
    </div>
    <div id="add-results" style="margin-top:8px"></div>
  `);
  const searchEl = document.getElementById('add-search');
  const resultsEl = document.getElementById('add-results');
  const draw = () => {
    const q = searchEl.value.trim().toLowerCase();
    const foods = state.foods.filter((f) => f.name.toLowerCase().includes(q));
    const recipes = state.recipes.filter((r) => r.name.toLowerCase().includes(q));
    let html = '';
    if (recipes.length) {
      html += `<div class="section-title">Recettes</div>`;
      html += recipes.map((rc) => pickRow('recipe', rc.id, rc.name,
        `${r0(rc.perServing.kcal)} kcal/part · P${r0(rc.perServing.protein)}`)).join('');
    }
    if (foods.length) {
      html += `<div class="section-title">Aliments</div>`;
      html += foods.map((f) => pickRow('food', f.id, f.name,
        `${r0(f.kcal)} kcal /100${f.unit} · P${r0(f.protein)}`)).join('');
    }
    if (!foods.length && !recipes.length) html = '<div class="empty">Aucun résultat.</div>';
    resultsEl.innerHTML = html;
    resultsEl.querySelectorAll('[data-pick]').forEach((el) => {
      el.onclick = () => openQtyStep(el.dataset.type, +el.dataset.pick);
    });
  };
  searchEl.oninput = draw;
  draw();
  searchEl.focus();
}

function pickRow(type, id, name, sub) {
  return `<div class="list-item" data-pick="${id}" data-type="${type}" style="cursor:pointer">
    <div class="li-main">
      <div class="li-name">${escapeHtml(name)}</div>
      <div class="li-sub">${sub}</div>
    </div>
    <div class="icon-btn add">+</div>
  </div>`;
}

function openQtyStep(type, id) {
  const isFood = type === 'food';
  const item = isFood ? state.foods.find((f) => f.id === id) : state.recipes.find((r) => r.id === id);
  const unit = isFood ? item.unit : 'part(s)';
  const defQty = isFood ? 100 : 1;
  openSheet(`
    <h3>${escapeHtml(item.name)}</h3>
    <div class="sub">${isFood
      ? `${r0(item.kcal)} kcal /100${item.unit}`
      : `${r0(item.perServing.kcal)} kcal /portion`}</div>
    <div class="field">
      <label>Quantité (${unit})</label>
      <input id="q-input" type="number" inputmode="decimal" step="${isFood ? 1 : 0.5}" value="${defQty}" />
    </div>
    <div class="ri-macros" id="q-preview"></div>
    <button class="btn" id="q-add">Ajouter au journal</button>
    <button class="btn ghost" id="q-back" style="margin-top:8px">Retour</button>
  `);
  const input = document.getElementById('q-input');
  const preview = document.getElementById('q-preview');
  const calc = () => {
    const qty = +input.value || 0;
    let m;
    if (isFood) {
      const f = qty / 100;
      m = { kcal: item.kcal * f, protein: item.protein * f, carbs: item.carbs * f, fat: item.fat * f };
    } else {
      m = { kcal: item.perServing.kcal * qty, protein: item.perServing.protein * qty,
            carbs: item.perServing.carbs * qty, fat: item.perServing.fat * qty };
    }
    preview.innerHTML = `<span><b>${r0(m.kcal)}</b> kcal</span>
      <span>P <b>${r1(m.protein)}</b></span>
      <span>G <b>${r1(m.carbs)}</b></span>
      <span>L <b>${r1(m.fat)}</b></span>`;
  };
  input.oninput = calc; calc();
  document.getElementById('q-back').onclick = openAddToDay;
  document.getElementById('q-add').onclick = async () => {
    try {
      await api('/log', { method: 'POST', body: { date: state.date, type, id, quantity: +input.value || 0 } });
      closeSheet();
      toast('Ajouté au journal');
      loadDay();
    } catch (e) { toast(e.message, true); }
  };
  input.focus(); input.select();
}
