/* ════════════════════════════════════════════════════════════
   STORE — μνήμη στη συσκευή (localStorage), ανά χρήστη
   ════════════════════════════════════════════════════════════ */

const Store = (() => {
  const KEY = 'oslo2026';
  const DEFAULTS = {
    who: 'stavros',
    theme: 'dark',
    rate: TRIP.defaultRate,
    budget: TRIP.defaultBudget,
    home: { lat: TRIP.home.lat, lng: TRIP.home.lng },
    // Ιδιωτικά — μόνο σε αυτή τη συσκευή, ποτέ στο repo
    personal: { addr: '', conf: '' },
    users: {
      stavros: userDefaults(),
      eleni:   userDefaults()
    }
  };

  function userDefaults() {
    return {
      visited: {},     // placeId -> true
      favs: {},        // placeId -> true
      notes: {},       // placeId -> string
      plan: null,      // null = αρχικό πρόγραμμα· αλλιώς [[stop,...], ...]
      expenses: [],    // {id, day, cat, note, nok}
      pass: {}         // passItemId -> true
    };
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const parsed = JSON.parse(raw);
      // merge ώστε νέα πεδία να μην σπάνε παλιά αποθηκευμένα δεδομένα
      const merged = { ...structuredClone(DEFAULTS), ...parsed };
      merged.users = merged.users || {};
      for (const u of ['stavros', 'eleni']) {
        merged.users[u] = { ...userDefaults(), ...(merged.users[u] || {}) };
      }
      merged.home = { ...DEFAULTS.home, ...(merged.home || {}) };
      merged.personal = { ...DEFAULTS.personal, ...(merged.personal || {}) };
      return merged;
    } catch (e) {
      console.warn('Store: corrupt data, resetting', e);
      return structuredClone(DEFAULTS);
    }
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { console.warn('Store: save failed', e); }
    }, 120);
  }

  const me = () => state.users[state.who];

  return {
    /* ── γενικά ── */
    get raw() { return state; },
    get who() { return state.who; },
    setWho(w) { if (state.users[w]) { state.who = w; save(); } },

    get theme() { return state.theme; },
    setTheme(t) { state.theme = t; save(); },

    get rate() { return state.rate; },
    setRate(r) { state.rate = Math.max(1, +r || TRIP.defaultRate); save(); },

    get budget() { return state.budget; },
    setBudget(b) { state.budget = Math.max(0, +b || 0); save(); },

    get home() { return state.home; },
    setHome(lat, lng) { state.home = { lat, lng }; save(); },

    /* ── ιδιωτικά, μόνο στη συσκευή ── */
    get addr() { return state.personal.addr || TRIP.home.addr; },
    get addrRaw() { return state.personal.addr || ''; },
    setAddr(v) { state.personal.addr = (v || '').trim(); save(); },
    get conf() { return state.personal.conf || ''; },
    setConf(v) { state.personal.conf = (v || '').trim().toUpperCase(); save(); },

    /* ── επισκέψεις ── */
    isVisited: id => !!me().visited[id],
    toggleVisited(id) {
      const v = me().visited;
      if (v[id]) delete v[id]; else v[id] = true;
      save();
      return !!v[id];
    },
    get visitedCount() { return Object.keys(me().visited).length; },

    /* ── αγαπημένα ── */
    isFav: id => !!me().favs[id],
    toggleFav(id) {
      const f = me().favs;
      if (f[id]) delete f[id]; else f[id] = true;
      save();
      return !!f[id];
    },

    /* ── σημειώσεις ── */
    getNote: id => me().notes[id] || '',
    setNote(id, txt) {
      if (txt && txt.trim()) me().notes[id] = txt.trim();
      else delete me().notes[id];
      save();
    },

    /* ── πρόγραμμα (επεξεργάσιμο) ── */
    getPlan() {
      if (!me().plan) return ITINERARY.map(d => d.stops.map(s => ({ ...s })));
      return me().plan;
    },
    setPlan(plan) { me().plan = plan; save(); },
    resetPlan() { me().plan = null; save(); },
    get planEdited() { return !!me().plan; },

    /* ── δαπάνες ── */
    get expenses() { return me().expenses; },
    addExpense(e) {
      me().expenses.push({ id: 'e' + Date.now() + Math.random().toString(36).slice(2, 7), ...e });
      save();
    },
    removeExpense(id) {
      const arr = me().expenses;
      const i = arr.findIndex(x => x.id === id);
      if (i > -1) arr.splice(i, 1);
      save();
    },
    get spentNok() { return me().expenses.reduce((s, e) => s + (+e.nok || 0), 0); },

    /* ── Oslo Pass calculator ── */
    isPass: id => !!me().pass[id],
    togglePass(id) {
      const p = me().pass;
      if (p[id]) delete p[id]; else p[id] = true;
      save();
      return !!p[id];
    },

    /* ── συγχρονισμός ── */
    export() {
      return btoa(unescape(encodeURIComponent(JSON.stringify({
        v: 1, who: state.who, data: me()
      }))));
    },
    import(code) {
      try {
        const obj = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
        if (!obj || !obj.data) throw new Error('bad payload');
        state.users[state.who] = { ...userDefaults(), ...obj.data };
        save();
        return true;
      } catch (e) {
        console.warn('Store: import failed', e);
        return false;
      }
    },

    wipe() {
      state.users[state.who] = userDefaults();
      save();
    }
  };
})();
