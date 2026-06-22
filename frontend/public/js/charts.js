// Inline-SVG charts for the tracker view (no chart library).
import { r1 } from './state.js';
import { addDays, daysInMonth } from './dates.js';

// Per-day weight + 7-day moving average for a month.
export function weightSeries(tracker, month) {
  const wmap = {};
  (tracker.weights || []).forEach((w) => { wmap[w.date] = w.weight; });
  const n = daysInMonth(month);
  const series = [];
  for (let day = 1; day <= n; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    let sum = 0, cnt = 0;
    for (let k = 0; k < 7; k++) {
      const v = wmap[addDays(date, -k)];
      if (v != null) { sum += v; cnt++; }
    }
    series.push({ day, date, weight: wmap[date] ?? null, avg: cnt ? sum / cnt : null });
  }
  return series;
}

export function weightChart(series, goal) {
  const W = 320, H = 150, padL = 26, padR = 10, padT = 12, padB = 16;
  const vals = [];
  series.forEach((s) => { if (s.weight != null) vals.push(s.weight); if (s.avg != null) vals.push(s.avg); });
  if (goal != null) vals.push(goal);
  if (!vals.length) return '<div class="empty" style="padding:30px 10px">Pas encore de poids enregistré.</div>';
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const m = (max - min) * 0.12; min -= m; max += m;
  const n = series.length;
  const x = (i) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  let avgPath = '';
  let firstI = -1, lastI = -1;
  series.forEach((s, i) => { if (s.avg != null) { avgPath += (avgPath ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(s.avg).toFixed(1) + ' '; if (firstI < 0) firstI = i; lastI = i; } });
  const baseY = (H - padB).toFixed(1);
  const areaPath = avgPath
    ? `M${x(firstI).toFixed(1)} ${baseY} ${avgPath.replace(/^M/, 'L')}L${x(lastI).toFixed(1)} ${baseY} Z`
    : '';
  const dots = series.map((s, i) => s.weight != null
    ? `<circle cx="${x(i).toFixed(1)}" cy="${y(s.weight).toFixed(1)}" r="2.6" class="wt-dot"/>` : '').join('');
  const goalLine = goal != null
    ? `<line x1="${padL}" y1="${y(goal).toFixed(1)}" x2="${W - padR}" y2="${y(goal).toFixed(1)}" class="wt-goal"/>
       <text x="${W - padR}" y="${(y(goal) - 4).toFixed(1)}" text-anchor="end" class="wt-axis">objectif ${r1(goal)}</text>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">
    <defs><linearGradient id="wtfill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4f46e5" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#4f46e5" stop-opacity="0"/>
    </linearGradient></defs>
    ${areaPath ? `<path d="${areaPath}" class="wt-area"/>` : ''}
    ${goalLine}
    <path d="${avgPath}" class="wt-avg" fill="none"/>
    ${dots}
    <text x="2" y="${(y(max) + 7).toFixed(1)}" class="wt-axis">${r1(max)}</text>
    <text x="2" y="${y(min).toFixed(1)}" class="wt-axis">${r1(min)}</text>
  </svg>
  <div class="chart-legend"><span class="lg lg-avg">moyenne 7 j</span><span class="lg lg-dot">pesées</span>${goal != null ? '<span class="lg lg-goal">objectif</span>' : ''}</div>`;
}

export function habitsChart(tracker, month, todayDate) {
  const total = tracker.habits.length;
  if (!total) return '<div class="empty" style="padding:24px 10px">Ajoute des habitudes pour voir le graphique du mois.</div>';
  const n = daysInMonth(month);
  const W = 320, H = 120, padT = 6, padB = 16;
  const gap = n > 24 ? 1.5 : 2;
  const bw = (W - gap * (n - 1)) / n;
  let bars = '', ticks = '';
  for (let day = 1; day <= n; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const ratio = (tracker.checks[date] || []).length / total;
    const h = ratio * (H - padT - padB);
    const xx = (day - 1) * (bw + gap);
    const yy = (H - padB) - h;
    const cls = `hb-bar${ratio >= 1 ? ' full' : ''}${date === todayDate ? ' today' : ''}`;
    bars += `<rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.6, h).toFixed(1)}" rx="1.2" class="${cls}"/>`;
    if (day === 1 || day % 5 === 0) ticks += `<text x="${(xx + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" class="hb-axis-lbl">${day}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">
    <line x1="0" y1="${H - padB}" x2="${W}" y2="${H - padB}" class="hb-axis"/>
    ${bars}${ticks}
  </svg>`;
}
