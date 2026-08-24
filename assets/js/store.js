/* ════════════════════════════════════════════════════════════
   STORE — ό,τι κρατάει η συσκευή. Τίποτα άλλο, πουθενά αλλού.
     visited : ποια μέρη τσεκάραμε
     plan    : τι έβαλες σε κάθε μέρα (ξεκινά ΑΔΕΙΟ)
     custom  : μέρη που πρόσθεσες μόνος σου
   ════════════════════════════════════════════════════════════ */

const Store = (() => {
  const KEY = 'oslo';

  const blank = () => ({ visited: {}, plan: {}, custom: [] });

  let s = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...blank(), ...JSON.parse(raw) } : blank();
    } catch (e) {
      console.warn('Store: χαλασμένα δεδομένα, ξεκινάμε από την αρχή', e);
      return blank();
    }
  }

  let t = null;
  function save() {
    clearTimeout(t);
    t = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(s)); }
      catch (e) { console.warn('Store: αποτυχία αποθήκευσης', e); }
    }, 120);
  }

  return {
    /* ── τικ ── */
    isVisited: id => !!s.visited[id],
    toggleVisited(id) {
      if (s.visited[id]) delete s.visited[id]; else s.visited[id] = true;
      save();
      return !!s.visited[id];
    },
    get visitedCount() { return Object.keys(s.visited).length; },

    /* ── πρόγραμμα: μέρα (0-8) -> [placeId, ...] ── */
    day(i) { return s.plan[i] || []; },
    get planCount() { return Object.values(s.plan).reduce((n, a) => n + a.length, 0); },
    addToDay(i, id) {
      const a = s.plan[i] || (s.plan[i] = []);
      if (!a.includes(id)) { a.push(id); save(); return true; }
      return false;                       // υπάρχει ήδη σε αυτή τη μέρα
    },
    removeFromDay(i, id) {
      const a = s.plan[i];
      if (!a) return;
      const k = a.indexOf(id);
      if (k > -1) { a.splice(k, 1); save(); }
    },
    setDay(i, ids) { s.plan[i] = ids; save(); },
    dayOf(id) {                            // σε ποια μέρα είναι ένα μέρος
      for (const k in s.plan) if (s.plan[k].includes(id)) return +k;
      return null;
    },

    /* ── δικά σου μέρη ── */
    get custom() { return s.custom; },
    addCustom(p) {
      const rec = { ...p, id: 'my-' + Date.now().toString(36), custom: true };
      s.custom.push(rec);
      save();
      return rec;
    },
    removeCustom(id) {
      const k = s.custom.findIndex(x => x.id === id);
      if (k > -1) { s.custom.splice(k, 1); save(); }
      delete s.visited[id];
      for (const d in s.plan) s.plan[d] = s.plan[d].filter(x => x !== id);
      save();
    }
  };
})();

/* ── Κάθε τιμή και στα δύο νομίσματα ──────────────────────────
   Σαρώνει ένα κείμενο και προσθέτει το ισοδύναμο δίπλα σε κάθε ποσό.
   Το ποσό πρέπει να ΤΕΛΕΙΩΝΕΙ σε ψηφίο, αλλιώς η τελεία της πρότασης
   καταπίνεται στο νούμερο και η μετατροπή μπαίνει μετά την τελεία.
   ─────────────────────────────────────────────────────────── */
const NUM = '\\d(?:[\\d.,]*\\d)?';
const MONEY_RE = new RegExp(
  `(${NUM})(?:\\s*[–—-]\\s*(${NUM}))?\\s*NOK` +
  `|€\\s?(${NUM})(?:\\s*[–—-]\\s*€?\\s?(${NUM}))?`, 'g');

const _amt = v => parseFloat(String(v).replace(/[.\s]/g, '').replace(',', '.'));
const _gr  = n => Math.round(n).toLocaleString('el-GR');

function money(str) {
  if (!str) return str;
  const r = TRIP.rate;
  return String(str).replace(MONEY_RE, (m, nokA, nokB, eurA, eurB) => {
    if (nokA != null) {
      const a = _amt(nokA); if (!isFinite(a) || !a) return m;
      const b = _amt(nokB);
      return isFinite(b) ? `${m} · €${_gr(a / r)}–${_gr(b / r)}` : `${m} · €${_gr(a / r)}`;
    }
    if (eurA != null) {
      const a = _amt(eurA); if (!isFinite(a) || !a) return m;
      const b = _amt(eurB);
      return isFinite(b) ? `${m} · ${_gr(a * r)}–${_gr(b * r)} NOK` : `${m} · ${_gr(a * r)} NOK`;
    }
    return m;
  });
}
