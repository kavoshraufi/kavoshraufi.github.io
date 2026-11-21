/**
 * Skärmövergångar som följer rörelsetokens och prefers-reduced-motion.
 */
export function reduceradRorelse() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ensurOverlay(host = document.body) {
  let el = host.querySelector('.kvarnen-overgang');
  if (!el) {
    el = document.createElement('div');
    el.className = 'kvarnen-overgang';
    el.setAttribute('aria-hidden', 'true');
    host.appendChild(el);
  }
  return el;
}

function durMs(cssVar, fallback) {
  if (reduceradRorelse()) return 1;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  if (!raw) return fallback;
  if (raw.endsWith('ms')) return parseFloat(raw);
  if (raw.endsWith('s')) return parseFloat(raw) * 1000;
  return fallback;
}

export function fade({ host, farg = 'var(--yta-natt, #1a1410)', ms } = {}) {
  const el = ensurOverlay(host || document.body);
  const tid = ms != null ? (reduceradRorelse() ? 1 : ms) : durMs('--dur-medel', 280);
  el.style.background = farg;
  el.style.transition = `opacity ${tid}ms var(--ease-ut, cubic-bezier(0.16, 1, 0.3, 1))`;
  el.classList.add('synlig');
  el.style.opacity = '1';
  return new Promise((resolve) => {
    setTimeout(() => {
      el.style.pointerEvents = 'none';
      el.style.opacity = '0';
      setTimeout(() => {
        el.classList.remove('synlig');
        resolve();
      }, tid);
    }, tid);
  });
}

export function fadeGenom({ host, farg = '#1a1410', ms, mitt } = {}) {
  const el = ensurOverlay(host || document.body);
  const tid = ms != null ? (reduceradRorelse() ? 1 : ms) : durMs('--dur-lang', 500);
  el.style.background = farg;
  el.style.transition = `opacity ${tid}ms var(--ease-ut, cubic-bezier(0.16, 1, 0.3, 1))`;
  el.classList.add('synlig');
  el.style.opacity = '1';
  return new Promise((resolve) => {
    setTimeout(async () => {
      if (typeof mitt === 'function') await mitt();
      el.style.pointerEvents = 'none';
      el.style.opacity = '0';
      setTimeout(() => {
        el.classList.remove('synlig');
        resolve();
      }, tid);
    }, tid);
  });
}

export function svep({ host, riktning = 'vanster', farg = '#1a1410', ms } = {}) {
  const el = ensurOverlay(host || document.body);
  const tid = ms != null ? (reduceradRorelse() ? 1 : ms) : durMs('--dur-medel', 280);
  const from = riktning === 'hoger' ? '100%' : riktning === 'upp' ? '0 -100%' : riktning === 'ner' ? '0 100%' : '-100%';
  el.style.background = farg;
  el.style.transition = 'none';
  el.style.opacity = '1';
  el.style.transform = `translate(${from})`;
  el.classList.add('synlig');
  el.offsetHeight;
  el.style.transition = `transform ${tid}ms var(--ease-ut, cubic-bezier(0.16, 1, 0.3, 1))`;
  el.style.transform = 'translate(0,0)';
  return new Promise((resolve) => {
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = '';
      el.classList.remove('synlig');
      resolve();
    }, tid + 40);
  });
}

export const Skarmovergangar = { fade, fadeGenom, svep, reduceradRorelse, ensurOverlay };
