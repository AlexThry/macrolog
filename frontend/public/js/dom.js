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

let untrackKeyboard = null;

export function openSheet(innerHtml) {
  closeSheet();
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  back.innerHTML = `<div class="sheet"><div class="sheet-handle"></div>${innerHtml}</div>`;
  back.onclick = (e) => { if (e.target === back) closeSheet(); };
  document.body.appendChild(back);
  untrackKeyboard = trackKeyboard(back.querySelector('.sheet'));
}
export function closeSheet() {
  untrackKeyboard?.();
  untrackKeyboard = null;
  document.querySelector('.sheet-backdrop')?.remove();
}

// `dvh` doesn't reliably shrink for the on-screen keyboard across browsers
// (Safari lags, Chrome needs the interactive-widget meta), so a tall sheet
// (e.g. a search list) can end up partly hidden behind the keyboard. The
// visualViewport API reports the real visible area, keyboard included —
// use it to cap the sheet's height directly while it's open.
function trackKeyboard(sheet) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const update = () => {
    sheet.style.maxHeight = Math.round(vv.height * 0.9) + 'px';
    document.activeElement?.scrollIntoView?.({ block: 'nearest' });
  };
  update();
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  return () => {
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
  };
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function escapeAttr(s) { return escapeHtml(s); }
