// DOM helpers: root element, toast, bottom-sheet modal, HTML escaping.
export const app = document.getElementById('app');

let toastTimer;
export function toast(msg, isErr = false) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2600);
}

export function openSheet(innerHtml) {
  closeSheet();
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  back.innerHTML = `<div class="sheet"><div class="sheet-handle"></div>${innerHtml}</div>`;
  back.onclick = (e) => { if (e.target === back) closeSheet(); };
  document.body.appendChild(back);
}
export function closeSheet() { document.querySelector('.sheet-backdrop')?.remove(); }

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function escapeAttr(s) { return escapeHtml(s); }
