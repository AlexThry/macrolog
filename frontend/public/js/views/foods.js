import { state, r0, r1 } from '../state.js';
import { toast, openSheet, closeSheet, escapeHtml, escapeAttr } from '../dom.js';
import { api } from '../api.js';
import { render } from '../ui.js';
import { loadFoods } from '../loaders.js';
import { parseFoodsCsv } from '../csv.js';

export function renderFoods(view) {
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
