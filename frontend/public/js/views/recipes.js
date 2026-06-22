import { state, z, r0, r1 } from '../state.js';
import { toast, openSheet, closeSheet, escapeHtml, escapeAttr } from '../dom.js';
import { api } from '../api.js';
import { render } from '../ui.js';
import { loadRecipes } from '../loaders.js';

export function renderRecipes(view) {
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
      <div class="li-sub">${r.itemCount} ingréd. · ${r.servings} part(s) · ${r0(r.perServing.kcal)} kcal/part · P${r1(r.perServing.protein)}${r.notes ? ' · ✎ notes' : ''}</div>
    </div>
    <div class="li-actions">
      <button class="icon-btn" data-editr="${r.id}">✎</button>
      <button class="icon-btn danger" data-delr="${r.id}">×</button>
    </div>
  </div>`;
}

async function openRecipeForm(id) {
  let recipe = { name: '', servings: 1, notes: '', items: [] };
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

      <div class="section-title">Préparation</div>
      <textarea id="rf-notes" class="journal-area" rows="5" placeholder="Étapes de préparation, astuces, temps de cuisson…">${escapeHtml(recipe.notes || '')}</textarea>

      <button class="btn" id="rf-save">${id ? 'Enregistrer' : 'Créer la recette'}</button>
    `);
    document.getElementById('rf-additem').onclick = () => {
      // persist current field edits before rebuilding the sheet
      recipe.name = document.getElementById('rf-name').value;
      recipe.servings = +document.getElementById('rf-serv').value || recipe.servings;
      recipe.notes = document.getElementById('rf-notes').value;
      pickFoodForRecipe();
    };
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
      notes: document.getElementById('rf-notes').value,
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
