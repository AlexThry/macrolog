import { state } from '../state.js';
import { toast } from '../dom.js';
import { api } from '../api.js';
import { loadTargets } from '../loaders.js';
import { logout } from './login.js';

export function renderSettings(view) {
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
