import { state, r1 } from '../state.js';
import { toast, escapeHtml } from '../dom.js';
import { api } from '../api.js';
import { render } from '../ui.js';
import { loadTracker } from '../loaders.js';
import { isoDate, addDays, monthLabel, prettyDate } from '../dates.js';
import { weightSeries, weightChart, habitsChart } from '../charts.js';

export function renderTracker(view) {
  const tr = state.tracker;
  const month = state.trackerDate.slice(0, 7);
  const series = weightSeries(tr, month);
  const cur = tr.todayWeight;
  const lastAvg = [...series].reverse().find((s) => s.avg != null);
  const avg7 = lastAvg ? lastAvg.avg : null;
  let deltaTxt = '—', deltaCls = '';
  if (cur != null && tr.goal != null) {
    const d = cur - tr.goal;
    deltaTxt = (d > 0 ? '+' : '') + r1(d);
    deltaCls = d <= 0 ? 'good' : 'warn';
  }
  view.innerHTML = `
    <div class="day-head">
      <div class="date-nav">
        <button id="tk-prev">‹</button>
        <span class="date-label">${prettyDate(state.trackerDate)}</span>
        <button id="tk-next">›</button>
      </div>
      <button class="btn small ghost" id="tk-today">auj.</button>
    </div>

    <div class="card">
      <h2>Poids</h2>
      <div class="grid-2">
        <div class="field"><label>Objectif (kg)</label><input id="tk-goal" type="number" inputmode="decimal" step="0.1" value="${tr.goal ?? ''}" placeholder="—" /></div>
        <div class="field"><label>Poids du jour (kg)</label><input id="tk-weight" type="number" inputmode="decimal" step="0.1" value="${cur ?? ''}" placeholder="—" /></div>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="stat-num">${cur != null ? r1(cur) : '—'}</div><div class="stat-lbl">du jour</div></div>
        <div class="stat"><div class="stat-num">${avg7 != null ? r1(avg7) : '—'}</div><div class="stat-lbl">moy. 7 j</div></div>
        <div class="stat"><div class="stat-num ${deltaCls}">${deltaTxt}</div><div class="stat-lbl">vs objectif</div></div>
      </div>
      ${weightChart(series, tr.goal)}
    </div>

    <div class="card">
      <h2>Habitudes</h2>
      <div id="tk-habits"></div>
      <div class="add-inline">
        <input id="tk-habit-name" placeholder="Nouvelle habitude…" autocomplete="off" />
        <button class="btn small" id="tk-habit-add">Ajouter</button>
      </div>
      <div class="chart-cap">Habitudes remplies · ${monthLabel(month)}</div>
      ${habitsChart(tr, month, state.trackerDate)}
    </div>

    <div class="card">
      <h2>Journal</h2>
      <div class="journal-date">${prettyDate(state.trackerDate)}</div>
      <textarea id="tk-journal" rows="6" class="journal-area" placeholder="Tes pensées du jour…">${escapeHtml(tr.journal || '')}</textarea>
      <button class="btn" id="tk-journal-save">Enregistrer le journal</button>
    </div>`;

  document.getElementById('tk-prev').onclick = () => shiftTracker(-1);
  document.getElementById('tk-next').onclick = () => shiftTracker(1);
  document.getElementById('tk-today').onclick = () => { state.trackerDate = isoDate(new Date()); loadTracker().then(render); };

  document.getElementById('tk-goal').onchange = async (e) => {
    try { await api('/tracker/goal', { method: 'PUT', body: { weight: e.target.value } }); await loadTracker(); render(); }
    catch (err) { toast(err.message, true); }
  };
  document.getElementById('tk-weight').onchange = async (e) => {
    try { await api('/weight', { method: 'PUT', body: { date: state.trackerDate, weight: e.target.value } }); await loadTracker(); render(); toast('Poids enregistré'); }
    catch (err) { toast(err.message, true); }
  };

  drawHabits();
  document.getElementById('tk-habit-add').onclick = addHabit;
  document.getElementById('tk-habit-name').onkeydown = (e) => { if (e.key === 'Enter') addHabit(); };

  document.getElementById('tk-journal-save').onclick = async () => {
    try { await api('/journal', { method: 'PUT', body: { date: state.trackerDate, content: document.getElementById('tk-journal').value } }); toast('Journal enregistré'); }
    catch (err) { toast(err.message, true); }
  };
}

function shiftTracker(days) {
  state.trackerDate = addDays(state.trackerDate, days);
  loadTracker().then(render);
}

function drawHabits() {
  const tr = state.tracker;
  const el = document.getElementById('tk-habits');
  const date = state.trackerDate;
  if (!tr.habits.length) { el.innerHTML = '<div class="empty" style="padding:14px">Aucune habitude. Ajoute-en une ci-dessous.</div>'; return; }
  const checked = new Set(tr.checks[date] || []);
  el.innerHTML = tr.habits.map((h) => `
    <div class="habit-row">
      <button class="hcheck ${checked.has(h.id) ? 'on' : ''}" data-hc="${h.id}">${checked.has(h.id) ? '✓' : ''}</button>
      <span class="habit-name">${escapeHtml(h.name)}</span>
      <button class="icon-btn danger" data-hd="${h.id}">×</button>
    </div>`).join('');
  el.querySelectorAll('[data-hc]').forEach((b) => b.onclick = async () => {
    const id = +b.dataset.hc;
    try { await api('/habits/' + id + '/check', { method: 'PUT', body: { date, checked: !checked.has(id) } }); await loadTracker(); render(); }
    catch (err) { toast(err.message, true); }
  });
  el.querySelectorAll('[data-hd]').forEach((b) => b.onclick = async () => {
    if (!confirm('Supprimer cette habitude ?')) return;
    try { await api('/habits/' + b.dataset.hd, { method: 'DELETE' }); await loadTracker(); render(); }
    catch (err) { toast(err.message, true); }
  });
}

async function addHabit() {
  const inp = document.getElementById('tk-habit-name');
  const name = inp.value.trim();
  if (!name) return;
  try { await api('/habits', { method: 'POST', body: { name } }); inp.value = ''; await loadTracker(); render(); }
  catch (err) { toast(err.message, true); }
}
