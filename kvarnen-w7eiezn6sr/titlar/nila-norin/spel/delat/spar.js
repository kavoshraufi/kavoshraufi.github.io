/**
 * Kvarnen sparmodul — IndexedDB med localStorage-reserv,
 * autospar, manuell Spara ("Sparat hh:mm"), Fortsätt/Nytt,
 * export/import och navigator.storage.persist().
 */
const DB_NAMN = 'kvarnen-spar';
const STORE = 'spar';

function nuKlocka(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatSparat(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `Sparat ${nuKlocka(d)}`;
}

function idbTillganglig() {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function oppnaDb(namn = DB_NAMN) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(namn, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, key, val) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(val, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDel(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export class Spar {
  constructor({
    dbNamn = DB_NAMN,
    nyckel = 'demo',
    storageKey,
    autoMs = 4000,
  } = {}) {
    this.dbNamn = dbNamn;
    this.nyckel = nyckel;
    this.lsKey = storageKey || `kvarnen.spar.${nyckel}`;
    this.autoMs = autoMs;
    this.backend = 'none';
    this.db = null;
    this.senastSparat = null;
    this.senastKalla = null;
    this.persistOk = false;
    this._autoTimer = 0;
    this._getState = null;
    this._listeners = new Set();
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) {
      try {
        fn(this);
      } catch {
        /* lyssnarfel ska inte stoppa sparandet */
      }
    }
  }

  async init() {
    if (navigator.storage && navigator.storage.persist) {
      try {
        this.persistOk = await navigator.storage.persist();
      } catch {
        this.persistOk = false;
      }
    }
    if (idbTillganglig()) {
      try {
        this.db = await oppnaDb(this.dbNamn);
        this.backend = 'indexeddb';
      } catch {
        this.db = null;
        this.backend = 'localStorage';
      }
    } else {
      this.backend = 'localStorage';
    }
    const befintlig = await this.load();
    if (befintlig && befintlig.__sparat) {
      this.senastSparat = new Date(befintlig.__sparat);
      this.senastKalla = befintlig.__kalla || null;
    }
    this._emit();
    return this;
  }

  async load() {
    if (this.backend === 'indexeddb' && this.db) {
      try {
        const val = await idbGet(this.db, this.nyckel);
        if (val != null) return val;
      } catch {
        /* fall till localStorage */
      }
    }
    try {
      const raw = localStorage.getItem(this.lsKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async save(data, { kalla = 'auto' } = {}) {
    const now = new Date();
    const paket = {
      ...data,
      __sparat: now.toISOString(),
      __kalla: kalla,
      __version: 1,
    };
    let ok = false;
    if (this.backend === 'indexeddb' && this.db) {
      try {
        await idbPut(this.db, this.nyckel, paket);
        ok = true;
      } catch {
        ok = false;
      }
    }
    try {
      localStorage.setItem(this.lsKey, JSON.stringify(paket));
      ok = true;
      if (this.backend !== 'indexeddb') this.backend = 'localStorage';
    } catch {
      if (!ok) throw new Error('Kunde inte spara');
    }
    this.senastSparat = now;
    this.senastKalla = kalla;
    this._emit();
    return paket;
  }

  async clear() {
    if (this.backend === 'indexeddb' && this.db) {
      try {
        await idbDel(this.db, this.nyckel);
      } catch {
        /* */
      }
    }
    try {
      localStorage.removeItem(this.lsKey);
    } catch {
      /* */
    }
    this.senastSparat = null;
    this.senastKalla = null;
    this._emit();
  }

  formatSparat() {
    return formatSparat(this.senastSparat);
  }

  watch(getState, { autoMs } = {}) {
    this._getState = getState;
    if (autoMs != null) this.autoMs = autoMs;
    this.stopWatch();
    if (this.autoMs > 0) {
      this._autoTimer = setInterval(() => {
        this.autosave().catch(() => {});
      }, this.autoMs);
    }
    return () => this.stopWatch();
  }

  stopWatch() {
    if (this._autoTimer) {
      clearInterval(this._autoTimer);
      this._autoTimer = 0;
    }
  }

  async autosave() {
    if (!this._getState) return null;
    return this.save(this._getState(), { kalla: 'auto' });
  }

  async sparaManuellt() {
    if (!this._getState) throw new Error('Ingen state-funktion bunden');
    return this.save(this._getState(), { kalla: 'manual' });
  }

  /**
   * Fortsätt om det finns en sparfil, annars null.
   * Nytt: bekräftelse via opts.bekrafta (fn som returnerar Promise<boolean>)
   * eller window.confirm.
   */
  async nytt({ bekrafta } = {}) {
    const finns = !!(await this.load());
    if (finns) {
      let ok;
      if (typeof bekrafta === 'function') ok = await bekrafta();
      else ok = typeof window !== 'undefined' ? window.confirm('Börja om och radera sparandet?') : false;
      if (!ok) return { avbrott: true };
    }
    await this.clear();
    return { avbrott: false, nytt: true };
  }

  async exportFil({ filnamn } = {}) {
    const data = (await this.load()) || (this._getState ? { ...this._getState(), __sparat: new Date().toISOString(), __kalla: 'export' } : null);
    if (!data) throw new Error('Inget att exportera');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const namn = filnamn || `kvarnen-spar-${this.nyckel}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = namn;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return data;
  }

  async importFil(file) {
    const text = typeof file === 'string' ? file : await file.text();
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object') throw new Error('Ogiltig sparfil');
    await this.save(data, { kalla: 'import' });
    return data;
  }
}

export function monteraBekraftelse({ titel = 'Börja om?', text = 'Det raderar det sparade läget.', okEtikett = 'Nytt', avbrytEtikett = 'Avbryt' } = {}) {
  return () =>
    new Promise((resolve) => {
      const bak = document.createElement('div');
      bak.className = 'kvarnen-dialog-bak';
      bak.innerHTML = `<div class="kvarnen-dialog" role="dialog" aria-modal="true" aria-labelledby="kvarnen-dialog-titel">
        <h2 id="kvarnen-dialog-titel">${titel}</h2>
        <p>${text}</p>
        <div class="kvarnen-dialog-knappar">
          <button type="button" data-avbryt>${avbrytEtikett}</button>
          <button type="button" class="primar" data-ok>${okEtikett}</button>
        </div>
      </div>`;
      const stang = (val) => {
        bak.remove();
        resolve(val);
      };
      bak.querySelector('[data-avbryt]').addEventListener('click', (e) => { e.stopPropagation(); stang(false); });
      bak.querySelector('[data-ok]').addEventListener('click', (e) => { e.stopPropagation(); stang(true); });
      bak.querySelector('.kvarnen-dialog').addEventListener('click', (e) => e.stopPropagation());
      bak.addEventListener('click', (e) => {
        if (e.target === bak) stang(false);
      });
      document.body.appendChild(bak);
      bak.querySelector('[data-avbryt]').focus();
    });
}
