import { state } from '../state.js';
import { app, toast } from '../dom.js';
import { api } from '../api.js';
import { loadTargets, loadFoods, loadRecipes, loadDay } from '../loaders.js';

export function renderLogin() {
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

export async function logout() {
  await api('/logout', { method: 'POST' });
  state.user = null;
  renderLogin();
}
