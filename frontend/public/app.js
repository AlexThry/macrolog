// ---------- MacroLog frontend (vanilla JS SPA) ----------
const API = '/api';
const app = document.getElementById('app');

const state = {
  user: null,
  tab: 'day',
  date: isoDate(new Date()),
  log: { entries: [], totals: z() },
  targets: { kcal: 2000, protein: 175, carbs: 200, fat: 60 },
  foods: [],
  recipes: [],
};

function z() { return { kcal: 0, protein: 0, carbs: 0, fat: 0 }; }
const r0 = (n) => Math.round(n);
const r1 = (n) => Math.round(n * 10) / 10;

// ---------- API helper ----------
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { state.user = null; renderLogin(); throw new Error('unauth'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
}

// ---------- Toast ----------
let toastTimer;
function toast(msg, isErr = false) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2600);
}

// ---------- Date helpers ----------
// Local YYYY-MM-DD. Don't use toISOString(): it converts to UTC, which shifts
// the day for non-UTC timezones (e.g. France UTC+2 -> off by one).
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function shiftDate(days) {
  const d = new Date(state.date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  state.date = isoDate(d);
  loadDay();
}
function prettyDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === -1) return 'Hier';
  if (diff === 1) return 'Demain';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ---------- Boot ----------
async function boot() {
  try {
    const me = await api('/me');
    state.user = me.username;
    await Promise.all([loadTargets(), loadFoods(), loadRecipes()]);
    await loadDay();
  } catch {
    renderLogin();
  }
}

// ---------- Loaders ----------
async function loadDay() {
  state.log = await api('/log?date=' + state.date);
  render();
}
async function loadTargets() { state.targets = await api('/targets'); }
async function loadFoods() { state.foods = await api('/foods'); }
async function loadRecipes() { state.recipes = await api('/recipes'); }

// ============================================================
//  LOGIN
// ============================================================
function renderLogin() {
  app.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="brand">Macro<span class="dot">·</span>Log</div>
        <div class="tag">suivi macros &amp; calories</div>
        <div class="field">
          <label>Identifiant</label>
          <input id="lg-user" autocomplete="username" autocapitalize="off" />
        </div>
        <div class="field">
          <label>Mot de passe</label>
          <input id="lg-pass" type="password" autocomplete="current-password" />
        </div>
        <button class="btn" id="lg-btn">Se connecter</button>
      </div>
    </div>`;
  const submit = async () => {
    const username = document.getElementById('lg-user').value.trim();
    const password = document.getElementById('lg-pass').value;
    try {
      const r = await api('/login', { method: 'POST', body: { username, password } });
      state.user = r.username;
      await Promise.all([loadTargets(), loadFoods(), loadRecipes()]);
      await loadDay();
    } catch (e) { toast(e.message, true); }
  };
  document.getElementById('lg-btn').onclick = submit;
  document.getElementById('lg-pass').onkeydown = (e) => { if (e.key === 'Enter') submit(); };
}

async function logout() {
  await api('/logout', { method: 'POST' });
  state.user = null;
  renderLogin();
}

// ============================================================
//  SHELL
// ============================================================
function render() {
  if (!state.user) return renderLogin();
  app.innerHTML = `
    <header class="topbar"><div class="topbar-inner">
      <div class="brand">Macro<span class="dot">·</span>Log <small>/${state.user}</small></div>
      <button class="logout-btn" id="btn-logout">quitter</button>
    </div></header>
    <main class="wrap" id="view"></main>
    <nav class="tabs">
      ${tabBtn('day', '◉', 'Journée')}
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
  else if (state.tab === 'foods') renderFoods(view);
  else if (state.tab === 'recipes') renderRecipes(view);
  else if (state.tab === 'settings') renderSettings(view);
}
function tabBtn(id, ic, label) {
  return `<button data-tab="${id}" class="${state.tab === id ? 'active' : ''}">
    <span class="ic">${ic}</span>${label}</button>`;
}

// ============================================================
//  DAY VIEW
// ============================================================
function renderDay(view) {
  const t = state.log.totals;
  const tg = state.targets;
  const over = t.kcal > tg.kcal;
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
      <div class="kcal-hero">
        <div class="kcal-num ${over ? 'over' : ''}">${r0(t.kcal)}</div>
        <div class="kcal-sub">/ ${r0(tg.kcal)} kcal · ${over ? '+' + r0(t.kcal - tg.kcal) + ' au-delà' : r0(tg.kcal - t.kcal) + ' restantes'}</div>
      </div>
      ${barRow('Protéines', t.protein, tg.protein, 'prot')}
      ${barRow('Glucides', t.carbs, tg.carbs, 'carbs')}
      ${barRow('Lipides', t.fat, tg.fat, 'fat')}
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
  return `<div class="bar-row">
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

// ---------- Add to day (picker sheet) ----------
function openAddToDay() {
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

// ============================================================
//  FOODS VIEW
// ============================================================
function renderFoods(view) {
  view.innerHTML = `
    <div class="day-head" style="margin-bottom:4px">
      <div class="section-title" style="margin:0">Mes aliments <span class="muted">(${state.foods.length})</span></div>
      <div style="display:flex;gap:6px">
        <button class="btn small ghost" id="f-import">Importer CSV</button>
        <button class="btn small" id="f-new">+ Aliment</button>
      </div>
    </div>
    <div class="search-bar" style="margin-top:14px">
      <input id="f-search" placeholder="Filtrer…" autocomplete="off" />
    </div>
    <div id="f-list" style="margin-top:6px"></div>`;
  const listEl = document.getElementById('f-list');
  const draw = () => {
    const q = (document.getElementById('f-search').value || '').toLowerCase();
    const items = state.foods.filter((f) => f.name.toLowerCase().includes(q));
    listEl.innerHTML = items.length ? items.map(foodRow).join('') :
      '<div class="empty">Aucun aliment. Crée-en un.</div>';
    listEl.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openFoodForm(+b.dataset.edit));
    listEl.querySelectorAll('[data-delf]').forEach((b) => b.onclick = async () => {
      if (!confirm('Supprimer cet aliment ?')) return;
      await api('/foods/' + b.dataset.delf, { method: 'DELETE' });
      await loadFoods(); render();
    });
  };
  document.getElementById('f-search').oninput = draw;
  document.getElementById('f-new').onclick = () => openFoodForm(null);
  document.getElementById('f-import').onclick = openFoodImport;
  draw();
}

// Column-name aliases (accent/case-insensitive) -> internal field.
const CSV_ALIASES = {
  name: ['nom', 'name', 'aliment', 'libelle', 'food', 'produit'],
  unit: ['unite', 'unit', 'u'],
  kcal: ['kcal', 'calories', 'calorie', 'energie', 'cal', 'kc'],
  protein: ['p', 'prot', 'protein', 'proteins', 'proteine', 'proteines', 'protide', 'protides'],
  carbs: ['g', 'gluc', 'glucide', 'glucides', 'carb', 'carbs', 'carbo', 'carbohydrate', 'carbohydrates'],
  fat: ['l', 'lip', 'lipide', 'lipides', 'fat', 'fats', 'gras', 'graisse', 'graisses'],
};
function normHeader(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function matchCsvField(cell) {
  const c = normHeader(cell);
  for (const [field, aliases] of Object.entries(CSV_ALIASES)) if (aliases.includes(c)) return field;
  return null;
}

// Parse CSV of foods. Columns may be in ANY order when a header row is present
// (mapped by name, FR/EN aliases). With no header, falls back to the positional
// order nom,unite,kcal,P,G,L. Delimiter , or ; (auto-detected).
function parseFoodsCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delim = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const split = (line) => line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
  const num = (s) => {
    let v = (s || '').trim();
    if (delim === ';') v = v.replace(',', '.'); // French decimal comma when ; separates
    return parseFloat(v) || 0;
  };

  // Header detection: first row maps >=2 cells to known fields.
  const firstCols = split(lines[0]);
  const colOf = {};
  firstCols.forEach((cell, idx) => {
    const f = matchCsvField(cell);
    if (f && colOf[f] === undefined) colOf[f] = idx;
  });
  const hasHeader = Object.keys(colOf).length >= 2;
  const map = hasHeader ? colOf : { name: 0, unit: 1, kcal: 2, protein: 3, carbs: 4, fat: 5 };
  if (map.name === undefined) map.name = 0; // header without a name column -> first col

  const out = [];
  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    const cols = split(lines[i]);
    const cell = (field) => (map[field] === undefined ? '' : cols[map[field]] || '');
    const name = cell('name').trim();
    if (!name) continue;
    out.push({
      name,
      unit: cell('unit').trim() || 'g',
      kcal: num(cell('kcal')),
      protein: num(cell('protein')),
      carbs: num(cell('carbs')),
      fat: num(cell('fat')),
    });
  }
  return out;
}

function openFoodImport() {
  openSheet(`
    <h3>Importer des aliments (CSV)</h3>
    <div class="sub">Colonnes : <code>nom, unite, kcal, P, G, L</code> — une ligne par aliment. Avec une ligne d'en-tête, l'ordre est libre (noms FR/EN reconnus). Sans en-tête, ordre ci-dessus. Séparateur <code>,</code> ou <code>;</code></div>
    <div class="field"><label>Fichier CSV</label><input id="imp-file" type="file" accept=".csv,text/csv,text/plain" /></div>
    <div class="field"><label>… ou colle le contenu</label>
      <textarea id="imp-text" rows="6" style="width:100%;resize:vertical" placeholder="Tofu ferme,g,144,15.7,2.7,8.7&#10;Poulet,g,165,31,0,3.6"></textarea>
    </div>
    <div id="imp-preview" class="li-sub" style="margin:6px 0">0 aliment détecté.</div>
    <button class="btn" id="imp-go" disabled>Importer</button>
  `);
  const textEl = document.getElementById('imp-text');
  const previewEl = document.getElementById('imp-preview');
  const goBtn = document.getElementById('imp-go');
  let parsed = [];
  const refresh = () => {
    parsed = parseFoodsCsv(textEl.value);
    goBtn.disabled = parsed.length === 0;
    if (!parsed.length) { previewEl.textContent = '0 aliment détecté.'; return; }
    const sample = parsed.slice(0, 3)
      .map((f) => `${escapeHtml(f.name)} (${r0(f.kcal)} kcal /100${escapeHtml(f.unit)})`)
      .join(', ');
    previewEl.innerHTML = `${parsed.length} aliment(s) détecté(s) : ${sample}${parsed.length > 3 ? '…' : ''}`;
  };
  textEl.oninput = refresh;
  document.getElementById('imp-file').onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { textEl.value = reader.result; refresh(); };
    reader.readAsText(file);
  };
  goBtn.onclick = async () => {
    if (!parsed.length) return;
    try {
      const r = await api('/foods/import', { method: 'POST', body: { foods: parsed } });
      closeSheet(); await loadFoods(); render();
      toast(`${r.inserted} aliment(s) importé(s)${r.skipped ? ` · ${r.skipped} ignoré(s)` : ''}`);
    } catch (e) { toast(e.message, true); }
  };
}

function foodRow(f) {
  return `<div class="list-item">
    <div class="li-main">
      <div class="li-name">${escapeHtml(f.name)}</div>
      <div class="li-sub">${r0(f.kcal)} kcal · P${r1(f.protein)} G${r1(f.carbs)} L${r1(f.fat)} /100${f.unit}</div>
    </div>
    <div class="li-actions">
      <button class="icon-btn" data-edit="${f.id}">✎</button>
      <button class="icon-btn danger" data-delf="${f.id}">×</button>
    </div>
  </div>`;
}

function openFoodForm(id) {
  const f = id ? state.foods.find((x) => x.id === id) : null;
  openSheet(`
    <h3>${f ? 'Modifier' : 'Nouvel'} aliment</h3>
    <div class="sub">Valeurs pour 100 g / 100 ml</div>
    <div class="field"><label>Nom</label><input id="ff-name" value="${f ? escapeAttr(f.name) : ''}" placeholder="ex: Tofu ferme" /></div>
    <div class="field"><label>Unité de base</label>
      <select id="ff-unit">
        <option value="g" ${!f || f.unit === 'g' ? 'selected' : ''}>grammes (g)</option>
        <option value="ml" ${f && f.unit === 'ml' ? 'selected' : ''}>millilitres (ml)</option>
        <option value="unit" ${f && f.unit === 'unit' ? 'selected' : ''}>par unité</option>
      </select>
    </div>
    <div class="field"><label>Macros pour 100</label>
      <div class="grid-4">
        <div><input id="ff-kcal" type="number" inputmode="decimal" placeholder="kcal" value="${f ? f.kcal : ''}" /></div>
        <div><input id="ff-prot" type="number" inputmode="decimal" placeholder="P" value="${f ? f.protein : ''}" /></div>
        <div><input id="ff-carb" type="number" inputmode="decimal" placeholder="G" value="${f ? f.carbs : ''}" /></div>
        <div><input id="ff-fat" type="number" inputmode="decimal" placeholder="L" value="${f ? f.fat : ''}" /></div>
      </div>
      <div class="li-sub" style="margin-top:6px">kcal · protéines · glucides · lipides</div>
    </div>
    <button class="btn" id="ff-save">${f ? 'Enregistrer' : 'Créer'}</button>
  `);
  document.getElementById('ff-save').onclick = async () => {
    const body = {
      name: document.getElementById('ff-name').value.trim(),
      unit: document.getElementById('ff-unit').value,
      kcal: +document.getElementById('ff-kcal').value || 0,
      protein: +document.getElementById('ff-prot').value || 0,
      carbs: +document.getElementById('ff-carb').value || 0,
      fat: +document.getElementById('ff-fat').value || 0,
    };
    if (!body.name) return toast('Donne un nom', true);
    try {
      if (f) await api('/foods/' + f.id, { method: 'PUT', body });
      else await api('/foods', { method: 'POST', body });
      closeSheet(); await loadFoods(); render();
      toast('Aliment enregistré');
    } catch (e) { toast(e.message, true); }
  };
  document.getElementById('ff-name').focus();
}

// ============================================================
//  RECIPES VIEW
// ============================================================
function renderRecipes(view) {
  view.innerHTML = `
    <div class="day-head" style="margin-bottom:4px">
      <div class="section-title" style="margin:0">Mes recettes <span class="muted">(${state.recipes.length})</span></div>
      <button class="btn small" id="r-new">+ Recette</button>
    </div>
    <div id="r-list" style="margin-top:14px"></div>`;
  const listEl = document.getElementById('r-list');
  listEl.innerHTML = state.recipes.length ? state.recipes.map(recipeRow).join('') :
    '<div class="empty">Aucune recette. Compose-en une à partir de tes aliments.</div>';
  listEl.querySelectorAll('[data-editr]').forEach((b) => b.onclick = () => openRecipeForm(+b.dataset.editr));
  listEl.querySelectorAll('[data-delr]').forEach((b) => b.onclick = async () => {
    if (!confirm('Supprimer cette recette ?')) return;
    await api('/recipes/' + b.dataset.delr, { method: 'DELETE' });
    await loadRecipes(); render();
  });
  document.getElementById('r-new').onclick = () => openRecipeForm(null);
}

function recipeRow(r) {
  return `<div class="list-item">
    <div class="li-main">
      <div class="li-name">${escapeHtml(r.name)}</div>
      <div class="li-sub">${r.itemCount} ingréd. · ${r.servings} part(s) · ${r0(r.perServing.kcal)} kcal/part · P${r1(r.perServing.protein)}</div>
    </div>
    <div class="li-actions">
      <button class="icon-btn" data-editr="${r.id}">✎</button>
      <button class="icon-btn danger" data-delr="${r.id}">×</button>
    </div>
  </div>`;
}

async function openRecipeForm(id) {
  let recipe = { name: '', servings: 1, items: [] };
  if (id) recipe = await api('/recipes/' + id);
  // working copy of items: [{food_id, quantity, name, ...macros per100}]
  let working = recipe.items.map((it) => ({
    food_id: it.id, quantity: it.quantity, name: it.name, unit: it.unit,
    kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat,
  }));

  const renderSheet = () => {
    openSheet(`
      <h3>${id ? 'Modifier' : 'Nouvelle'} recette</h3>
      <div class="field"><label>Nom</label><input id="rf-name" value="${escapeAttr(recipe.name)}" placeholder="ex: Chili PST" /></div>
      <div class="field"><label>Nombre de portions</label>
        <input id="rf-serv" type="number" inputmode="decimal" step="0.5" min="0.5" value="${recipe.servings}" /></div>

      <div class="section-title">Ingrédients</div>
      <div id="rf-items"></div>
      <button class="btn ghost" id="rf-additem" style="margin-top:10px">+ Ajouter un aliment</button>

      <div class="ri-macros" id="rf-totals"></div>
      <button class="btn" id="rf-save">${id ? 'Enregistrer' : 'Créer la recette'}</button>
    `);
    document.getElementById('rf-additem').onclick = () => pickFoodForRecipe();
    document.getElementById('rf-serv').oninput = drawTotals;
    document.getElementById('rf-save').onclick = saveRecipe;
    drawItems();
  };

  const drawItems = () => {
    const el = document.getElementById('rf-items');
    if (!working.length) { el.innerHTML = '<div class="empty" style="padding:14px">Aucun ingrédient.</div>'; drawTotals(); return; }
    el.innerHTML = working.map((it, i) => `
      <div class="ri-row">
        <span class="ri-name">${escapeHtml(it.name)}</span>
        <input type="number" inputmode="decimal" data-qi="${i}" value="${it.quantity}" /> 
        <span class="li-sub">${it.unit}</span>
        <button class="ri-del" data-rmi="${i}">×</button>
      </div>`).join('');
    el.querySelectorAll('[data-qi]').forEach((inp) => inp.oninput = () => {
      working[+inp.dataset.qi].quantity = +inp.value || 0; drawTotals();
    });
    el.querySelectorAll('[data-rmi]').forEach((b) => b.onclick = () => {
      working.splice(+b.dataset.rmi, 1); drawItems();
    });
    drawTotals();
  };

  const drawTotals = () => {
    const serv = +document.getElementById('rf-serv')?.value || 1;
    const tot = working.reduce((a, it) => {
      const f = it.quantity / 100;
      a.kcal += it.kcal * f; a.protein += it.protein * f; a.carbs += it.carbs * f; a.fat += it.fat * f;
      return a;
    }, z());
    const ps = { kcal: tot.kcal / serv, protein: tot.protein / serv, carbs: tot.carbs / serv, fat: tot.fat / serv };
    const el = document.getElementById('rf-totals');
    if (el) el.innerHTML = `<span style="width:100%;color:var(--ink-faint)">Par portion :</span>
      <span><b>${r0(ps.kcal)}</b> kcal</span>
      <span>P <b>${r1(ps.protein)}</b></span>
      <span>G <b>${r1(ps.carbs)}</b></span>
      <span>L <b>${r1(ps.fat)}</b></span>`;
  };

  const pickFoodForRecipe = () => {
    openSheet(`
      <h3>Choisir un aliment</h3>
      <div class="search-bar" style="margin-top:12px"><input id="pf-search" placeholder="Rechercher…" autocomplete="off" /></div>
      <div id="pf-list" style="margin-top:8px"></div>
      <button class="btn ghost" id="pf-back" style="margin-top:10px">Retour à la recette</button>
    `);
    const drawList = () => {
      const q = (document.getElementById('pf-search').value || '').toLowerCase();
      const items = state.foods.filter((f) => f.name.toLowerCase().includes(q));
      const el = document.getElementById('pf-list');
      el.innerHTML = items.length ? items.map((f) =>
        `<div class="list-item" data-pf="${f.id}" style="cursor:pointer">
          <div class="li-main"><div class="li-name">${escapeHtml(f.name)}</div>
          <div class="li-sub">${r0(f.kcal)} kcal /100${f.unit}</div></div>
          <div class="icon-btn add">+</div></div>`).join('') :
        "<div class=\"empty\">Aucun aliment. Crée-en d'abord dans l'onglet Aliments.</div>";
      el.querySelectorAll('[data-pf]').forEach((row) => row.onclick = () => {
        const f = state.foods.find((x) => x.id === +row.dataset.pf);
        working.push({ food_id: f.id, quantity: 100, name: f.name, unit: f.unit,
          kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat });
        renderSheet();
      });
    };
    document.getElementById('pf-search').oninput = drawList;
    document.getElementById('pf-back').onclick = renderSheet;
    drawList();
  };

  const saveRecipe = async () => {
    const body = {
      name: document.getElementById('rf-name').value.trim(),
      servings: +document.getElementById('rf-serv').value || 1,
      items: working.map((it) => ({ food_id: it.food_id, quantity: it.quantity })),
    };
    if (!body.name) return toast('Donne un nom à la recette', true);
    if (!body.items.length) return toast('Ajoute au moins un ingrédient', true);
    try {
      if (id) await api('/recipes/' + id, { method: 'PUT', body });
      else await api('/recipes', { method: 'POST', body });
      closeSheet(); await loadRecipes(); render();
      toast('Recette enregistrée');
    } catch (e) { toast(e.message, true); }
  };

  renderSheet();
}

// ============================================================
//  SETTINGS / TARGETS
// ============================================================
function renderSettings(view) {
  const t = state.targets;
  view.innerHTML = `
    <div class="card">
      <h2>Cibles quotidiennes</h2>
      <div class="field"><label>Calories (kcal)</label><input id="t-kcal" type="number" inputmode="decimal" value="${t.kcal}" /></div>
      <div class="field"><label>Protéines (g)</label><input id="t-prot" type="number" inputmode="decimal" value="${t.protein}" /></div>
      <div class="grid-2">
        <div class="field"><label>Glucides (g)</label><input id="t-carb" type="number" inputmode="decimal" value="${t.carbs}" /></div>
        <div class="field"><label>Lipides (g)</label><input id="t-fat" type="number" inputmode="decimal" value="${t.fat}" /></div>
      </div>
      <button class="btn" id="t-save">Enregistrer les cibles</button>
    </div>
    <div class="card">
      <h2>Compte</h2>
      <div class="li-sub" style="margin-bottom:12px">Connecté en tant que <b style="color:var(--ink)">${state.user}</b></div>
      <button class="btn ghost" id="t-logout">Se déconnecter</button>
    </div>
    <div class="empty" style="margin-top:20px">MacroLog · données stockées sur ton serveur</div>`;
  document.getElementById('t-save').onclick = async () => {
    try {
      await api('/targets', { method: 'PUT', body: {
        kcal: +document.getElementById('t-kcal').value || 0,
        protein: +document.getElementById('t-prot').value || 0,
        carbs: +document.getElementById('t-carb').value || 0,
        fat: +document.getElementById('t-fat').value || 0,
      }});
      await loadTargets();
      toast('Cibles mises à jour');
    } catch (e) { toast(e.message, true); }
  };
  document.getElementById('t-logout').onclick = logout;
}

// ============================================================
//  SHEET (modal) helpers
// ============================================================
function openSheet(innerHtml) {
  closeSheet();
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  back.innerHTML = `<div class="sheet"><div class="sheet-handle"></div>${innerHtml}</div>`;
  back.onclick = (e) => { if (e.target === back) closeSheet(); };
  document.body.appendChild(back);
}
function closeSheet() { document.querySelector('.sheet-backdrop')?.remove(); }

// ---------- utils ----------
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }

boot();
