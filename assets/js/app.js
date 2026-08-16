/* ════════════════════════════════════════════════════════════
   APP — render + events
   ════════════════════════════════════════════════════════════ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const P  = id => PLACES.find(p => p.id === id);

const UI = {
  tab: 'plan',
  day: 0,
  listCat: 'all',
  listState: 'all',
  listQ: '',
  mapDay: 'all',
  hiddenCats: new Set(),
  hideVisited: false,
  exCur: 'NOK'
};

/* ─────────── helpers ─────────── */
const nok2eur = n => n / Store.rate;
const fmtEur  = n => '€' + Math.round(n).toLocaleString('el-GR');
const fmtNok  = n => Math.round(n).toLocaleString('el-GR') + ' NOK';

function icon(name, cls = '') { return `<svg class="ic ${cls}"><use href="#${name}"/></svg>`; }

const GR_DOW = ['ΚΥΡ','ΔΕΥ','ΤΡΙ','ΤΕΤ','ΠΕΜ','ΠΑΡ','ΣΑΒ'];
const GR_MON = ['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];
const GR_MON_FULL = ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου',
                     'Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου'];
const GR_DOW_FULL = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];

function dparts(iso) {
  const d = new Date(iso + 'T12:00:00');
  return { d, dow: GR_DOW[d.getDay()], dowFull: GR_DOW_FULL[d.getDay()],
           num: d.getDate(), mon: GR_MON[d.getMonth()], monFull: GR_MON_FULL[d.getMonth()] };
}
function todayIso() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

/* Για μέρη με approx:true το pin είναι κατά προσέγγιση, οπότε στέλνουμε
   το Google Maps να ψάξει το ΟΝΟΜΑ — βρίσκει πάντα το σωστό σημείο. */
function gmapsUrl(p) {
  const q = p.approx ? encodeURIComponent(`${p.name}, Oslo`) : `${p.lat},${p.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
function gdirUrl(p, mode = 'transit') {
  const h = Store.home;
  const dest = p.approx ? encodeURIComponent(`${p.name}, Oslo`) : `${p.lat},${p.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${h.lat},${h.lng}` +
         `&destination=${dest}&travelmode=${mode}`;
}

let toastT = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  el.classList.remove('out');
  clearTimeout(toastT);
  toastT = setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => { el.hidden = true; }, 320);
  }, 2000);
}

/* ════════════ ΘΕΜΑ ════════════ */
function applyTheme() {
  const t = Store.theme;
  const eff = t === 'auto'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : t;
  document.documentElement.dataset.theme = eff;
  $('meta[name=theme-color]').setAttribute('content', eff === 'light' ? '#F4F6F9' : '#0A0E14');
  OsloMap.setBasemapForTheme(eff);
}

/* ════════════ TABS ════════════ */
function initTabs() {
  $$('#tabs .tab').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
  moveInd();
  addEventListener('resize', moveInd);
}
const TABS = ['plan','map','list','trips','budget','info'];

function go(tab, silent) {
  if (!TABS.includes(tab)) tab = 'plan';
  UI.tab = tab;
  $$('#tabs .tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
  $$('.panel').forEach(p => p.classList.toggle('is-active', p.id === 'panel-' + tab));
  moveInd();
  if (!silent && location.hash.slice(1) !== tab) {
    history.replaceState(null, '', '#' + tab);
  }
  scrollTo({ top: 0, behavior: 'smooth' });
  if (tab === 'map') { OsloMap.invalidate(); syncMap(); }
}
function moveInd() {
  const ind = $('#tabInd'), act = $('#tabs .tab.is-active');
  if (!ind || !act || getComputedStyle(ind).display === 'none') return;
  ind.style.left = act.offsetLeft + 'px';
  ind.style.width = act.offsetWidth + 'px';
}

/* ════════════ COUNTDOWN + PROGRESS ════════════ */
function renderTop() {
  const el = $('#countdown');
  const t = new Date(todayIso() + 'T12:00:00');
  const s = new Date(TRIP.start + 'T12:00:00');
  const e = new Date(TRIP.end + 'T12:00:00');
  const days = Math.round((s - t) / 864e5);

  el.className = 'countdown';
  if (t < s)       { el.textContent = days === 1 ? 'αύριο!' : `σε ${days} μέρες`; }
  else if (t <= e) { el.textContent = `μέρα ${Math.round((t - s) / 864e5) + 1}/${ITINERARY.length}`; el.classList.add('live'); }
  else             { el.textContent = 'τέλος'; el.classList.add('past'); }

  $('#brandSub').textContent = Store.who === 'stavros' ? 'Σταύρος' : 'Ελένη';

  const total = PLACES.filter(p => p.cat !== 'transport').length;
  $('#progressFill').style.width = Math.round(Store.visitedCount / total * 100) + '%';
}

/* ════════════ ΠΡΟΓΡΑΜΜΑ ════════════ */
function renderDaystrip() {
  const plan = Store.getPlan();
  const today = todayIso();
  $('#daystrip').innerHTML = ITINERARY.map((d, i) => {
    const p = dparts(d.date);
    const stops = plan[i] || [];
    const real = stops.filter(s => P(s.p));
    const done = real.filter(s => Store.isVisited(s.p)).length;
    const pct = real.length ? done / real.length * 100 : 0;
    return `<button class="daychip ${i === UI.day ? 'is-on' : ''} ${d.date === today ? 'is-today' : ''}" data-day="${i}">
      <div class="dc-dow">${p.dow}</div>
      <div class="dc-num">${p.num}</div>
      <div class="dc-mon">${p.mon}</div>
      <div class="dc-bar"><i style="width:${pct}%"></i></div>
    </button>`;
  }).join('');
  $$('#daystrip .daychip').forEach(b => b.addEventListener('click', () => {
    UI.day = +b.dataset.day;
    renderDaystrip(); renderDay();
    b.scrollIntoView({ inline:'center', block:'nearest', behavior:'smooth' });
  }));
}

function renderDay() {
  const d = ITINERARY[UI.day];
  const plan = Store.getPlan();
  const stops = plan[UI.day] || [];
  const p = dparts(d.date);

  const real = stops.filter(s => P(s.p));
  const done = real.filter(s => Store.isVisited(s.p)).length;
  const pct = real.length ? done / real.length : 0;
  const C = 2 * Math.PI * 24;

  const costs = real.map(s => P(s.p)).filter(x => x && x.cost > 0).reduce((a, b) => a + b.cost, 0);

  const hero = `<div class="day-hero">
    <div class="dh-top">
      <div>
        <div class="dh-eyebrow">Μέρα ${UI.day + 1} · ${p.dowFull} ${p.num} ${p.monFull}</div>
        <div class="dh-title">${d.title}</div>
      </div>
      <div class="dh-ring">
        <svg viewBox="0 0 54 54">
          <circle class="bgc" cx="27" cy="27" r="24"/>
          <circle class="fgc" cx="27" cy="27" r="24"
            stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/>
        </svg>
        <b>${done}/${real.length}</b>
      </div>
    </div>
    <div class="dh-sub">${d.sub}</div>
    <div class="dh-meta">
      <span class="pill accent">${icon('ic-pin','xs')} ${real.length} στάσεις</span>
      ${costs > 0 ? `<span class="pill gold">${icon('ic-ticket','xs')} ~${costs} NOK εισιτήρια</span>`
                  : `<span class="pill ok">${icon('ic-check','xs')} Χωρίς εισιτήρια</span>`}
      ${d.daytrip ? `<span class="pill warn">${icon('ic-mountain','xs')} Εκδρομή</span>` : ''}
    </div>
  </div>`;

  const list = stops.length ? `<div class="stops">${stops.map((s, i) => stopHtml(s, i)).join('')}</div>`
    : `<div class="day-empty">Δεν έμεινε καμία στάση σε αυτή τη μέρα.</div>`;

  const nav = `<div class="daynav">
    <button class="btn ghost" id="dPrev" ${UI.day === 0 ? 'disabled' : ''}>${icon('ic-chevron-left','sm')} Προηγούμενη</button>
    <button class="btn ghost" id="dMap">${icon('ic-map','sm')} Δες τη στον χάρτη</button>
    <button class="btn ghost" id="dNext" ${UI.day === ITINERARY.length - 1 ? 'disabled' : ''}>Επόμενη ${icon('ic-chevron-right','sm')}</button>
  </div>`;

  $('#dayDetail').innerHTML = hero + `<div>${list}${nav}</div>`;
  wireStops();

  $('#dPrev')?.addEventListener('click', () => { UI.day--; renderDaystrip(); renderDay(); });
  $('#dNext')?.addEventListener('click', () => { UI.day++; renderDaystrip(); renderDay(); });
  $('#dMap')?.addEventListener('click', () => { UI.mapDay = String(UI.day); go('map'); });
}

function stopHtml(s, i) {
  if (s.p === 'HOME') {
    return `<div class="stop" data-i="${i}">
      <div class="stop-drag" draggable="true">${icon('ic-grip')}</div>
      <div class="st-ico" style="background:rgba(255,77,109,.14);color:#FF4D6D;border-color:rgba(255,77,109,.3)">${icon('ic-home')}</div>
      <div class="st-body">
        <div class="st-time">${s.t}</div>
        <div class="st-name">Το σπίτι μας</div>
        <div class="st-note">${s.note || ''}</div>
      </div>
      <div class="st-actions"><button class="icon-btn sm plain" data-menu="${i}">${icon('ic-dots')}</button></div>
    </div>`;
  }
  if (s.p === 'DAYTRIP') {
    return `<div class="stop" data-i="${i}">
      <div class="stop-drag" draggable="true">${icon('ic-grip')}</div>
      <div class="st-ico" style="background:rgba(78,216,160,.14);color:var(--c-nature);border-color:rgba(78,216,160,.3)">${icon('ic-mountain')}</div>
      <div class="st-body">
        <div class="st-time">${s.t}</div>
        <div class="st-note">${s.note || ''}</div>
      </div>
      <div class="st-actions"><button class="icon-btn sm plain" data-menu="${i}">${icon('ic-dots')}</button></div>
    </div>`;
  }

  const pl = P(s.p);
  if (!pl) return '';
  const c = CATS[pl.cat];
  const done = Store.isVisited(pl.id);
  const fav = Store.isFav(pl.id);

  return `${s.transit ? `<div class="transit">${icon('ic-navigation','xs')} ${s.transit}</div>` : ''}
  <div class="stop ${done ? 'done' : ''}" data-i="${i}" data-place="${pl.id}">
    <div class="stop-drag" draggable="true">${icon('ic-grip')}</div>
    <div class="st-ico" style="background:${c.raw}22;color:${c.raw};border-color:${c.raw}44">${icon(c.icon)}</div>
    <div class="st-body" data-open="${pl.id}">
      <div class="st-time">${s.t} · ${c.label}</div>
      <div class="st-name">${pl.nameEl || pl.name}
        ${fav ? `<span class="star">${icon('ic-star')}</span>` : ''}</div>
      <div class="st-note">${s.note || pl.desc.slice(0, 90) + '…'}</div>
      <div class="st-tags">
        ${pl.costLabel && pl.costLabel !== '—'
          ? `<span class="tag ${pl.cost === 0 ? 'free' : 'cost'}">${pl.costLabel}</span>` : ''}
        ${pl.gem ? `<span class="tag">★ Διαμάντι</span>` : ''}
      </div>
    </div>
    <div class="st-actions">
      <button class="tick ${done ? 'on' : ''}" data-tick="${pl.id}" aria-label="Έγινε">${icon('ic-check')}</button>
      <button class="icon-btn sm plain" data-menu="${i}">${icon('ic-dots')}</button>
    </div>
  </div>`;
}

function wireStops() {
  $$('#dayDetail [data-tick]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const id = b.dataset.tick;
    const on = Store.toggleVisited(id);
    toast(on ? 'Τσεκαρίστηκε ✓' : 'Ξε-τσεκαρίστηκε');
    OsloMap.refreshPin(id);
    renderDaystrip(); renderDay(); renderTop();
  }));

  $$('#dayDetail [data-open]').forEach(b => b.addEventListener('click', () => openPlace(b.dataset.open)));
  $$('#dayDetail [data-menu]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); openStopMenu(+b.dataset.menu);
  }));

  /* drag & drop */
  let dragI = null;
  $$('#dayDetail .stop').forEach(el => {
    const handle = el.querySelector('.stop-drag');
    handle.addEventListener('dragstart', e => {
      dragI = +el.dataset.i;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(dragI)); } catch (_) {}
    });
    handle.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      $$('#dayDetail .stop').forEach(x => x.classList.remove('dragover'));
    });
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('dragover');
      const to = +el.dataset.i;
      if (dragI === null || dragI === to) return;
      const plan = Store.getPlan();
      const arr = plan[UI.day];
      const [m] = arr.splice(dragI, 1);
      arr.splice(to, 0, m);
      Store.setPlan(plan);
      renderDay(); syncMap();
      toast('Αναδιατάχθηκε');
    });
  });
}

function openStopMenu(i) {
  const plan = Store.getPlan();
  const arr = plan[UI.day];
  const s = arr[i];
  const pl = P(s.p);
  const name = pl ? (pl.nameEl || pl.name) : (s.p === 'HOME' ? 'Το σπίτι μας' : 'Στάση');

  const dayOpts = ITINERARY.map((d, k) => {
    if (k === UI.day) return '';
    const dp = dparts(d.date);
    return `<button class="btn ghost full" data-move="${k}">${icon('ic-chevron-right','sm')} ${dp.dow} ${dp.num} ${dp.mon} — ${d.title}</button>`;
  }).join('');

  sheet('#placeSheet', `
    <h2 class="sheet-title">${icon('ic-dots')} ${name}</h2>
    <div class="btnrow" style="margin-bottom:14px">
      <button class="btn" data-shift="-1" ${i === 0 ? 'disabled' : ''}>${icon('ic-chevron-left','sm')} Πιο πάνω</button>
      <button class="btn" data-shift="1" ${i === arr.length - 1 ? 'disabled' : ''}>Πιο κάτω ${icon('ic-chevron-right','sm')}</button>
    </div>
    <h3 class="sheet-title sm">${icon('ic-calendar')} Μετακίνηση σε άλλη μέρα</h3>
    ${dayOpts}
    <hr>
    <button class="btn danger full" data-remove="1">${icon('ic-trash','sm')} Αφαίρεση από το πρόγραμμα</button>
  `);

  $$('#placeSheet [data-shift]').forEach(b => b.addEventListener('click', () => {
    const j = i + (+b.dataset.shift);
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    Store.setPlan(plan); closeSheets(); renderDay(); syncMap(); toast('Μετακινήθηκε');
  }));
  $$('#placeSheet [data-move]').forEach(b => b.addEventListener('click', () => {
    const k = +b.dataset.move;
    arr.splice(i, 1);
    plan[k].push(s);
    plan[k].sort((a, b2) => (a.t || '').localeCompare(b2.t || ''));
    Store.setPlan(plan); closeSheets(); renderDaystrip(); renderDay(); syncMap();
    toast(`Πήγε στη μέρα ${k + 1}`);
  }));
  $('#placeSheet [data-remove]')?.addEventListener('click', () => {
    arr.splice(i, 1);
    Store.setPlan(plan); closeSheets(); renderDaystrip(); renderDay(); syncMap();
    toast('Αφαιρέθηκε');
  });
}

/* ════════════ ΧΑΡΤΗΣ ════════════ */
function renderMapDayFilter() {
  const el = $('#mapDayFilter');
  el.innerHTML = `<button class="mdf ${UI.mapDay === 'all' ? 'is-on' : ''}" data-md="all">Όλα</button>` +
    ITINERARY.map((d, i) => {
      const p = dparts(d.date);
      return `<button class="mdf ${UI.mapDay === String(i) ? 'is-on' : ''}" data-md="${i}">${p.dow} ${p.num}</button>`;
    }).join('');
  $$('#mapDayFilter .mdf').forEach(b => b.addEventListener('click', () => {
    UI.mapDay = b.dataset.md; renderMapDayFilter(); syncMap();
  }));
}

function renderLayerCats() {
  $('#layerCats').innerHTML = Object.entries(CATS).map(([k, c]) => {
    const n = PLACES.filter(p => p.cat === k).length;
    const off = UI.hiddenCats.has(k);
    return `<div class="lp-cat ${off ? 'off' : ''}" data-cat="${k}">
      <div class="sw" style="background:${c.raw}22;color:${c.raw}">${icon(c.icon)}</div>
      <span>${c.label}</span><b>${n}</b>
    </div>`;
  }).join('');
  $$('#layerCats .lp-cat').forEach(el => el.addEventListener('click', () => {
    const k = el.dataset.cat;
    UI.hiddenCats.has(k) ? UI.hiddenCats.delete(k) : UI.hiddenCats.add(k);
    renderLayerCats(); syncMap();
  }));
}

function syncMap() {
  const dayIds = UI.mapDay === 'all' ? null
    : new Set((Store.getPlan()[+UI.mapDay] || []).map(s => s.p));

  OsloMap.buildPins(p => {
    if (UI.hiddenCats.has(p.cat)) return false;
    if (UI.hideVisited && Store.isVisited(p.id)) return false;
    if (dayIds && !dayIds.has(p.id)) return false;
    return true;
  });

  if (UI.mapDay !== 'all' && $('#tglRoute').checked) {
    OsloMap.drawRoute((Store.getPlan()[+UI.mapDay] || []).map(s => s.p));
  } else {
    OsloMap.clearRoute();
  }
}

function initMapUI() {
  OsloMap.init({
    onSelect: openPlace,
    onTick: () => { renderDaystrip(); renderDay(); renderList(); renderTop(); },
    onHomeMoved: () => { toast('Το σπίτι μετακινήθηκε ✓'); }
  });
  renderMapDayFilter();
  renderLayerCats();

  $('#btnLayers').addEventListener('click', () => {
    const p = $('#layersPanel');
    p.hidden = !p.hidden;
    $('#btnLayers').classList.toggle('is-on', !p.hidden);
  });
  $('#btnLayersClose').addEventListener('click', () => {
    $('#layersPanel').hidden = true; $('#btnLayers').classList.remove('is-on');
  });
  $('#btnHome').addEventListener('click', () => OsloMap.goHome());
  $('#btnBasemap').addEventListener('click', () => toast('Στυλ χάρτη: ' + OsloMap.cycleBasemap()));
  $('#btnLocate').addEventListener('click', () => {
    toast('Εντοπισμός…');
    OsloMap.locate().then(() => toast('Σε βρήκα')).catch(() => toast('Δεν βρέθηκε η θέση σου'));
  });
  $('#tglDanger').addEventListener('change', e => OsloMap.toggleDanger(e.target.checked));
  $('#tglRoute').addEventListener('change', () => syncMap());
  $('#tglHideVisited').addEventListener('change', e => { UI.hideVisited = e.target.checked; syncMap(); });
  $('#btnResetFilters').addEventListener('click', () => {
    UI.hiddenCats.clear(); UI.hideVisited = false; UI.mapDay = 'all';
    $('#tglHideVisited').checked = false; $('#tglDanger').checked = true; $('#tglRoute').checked = true;
    OsloMap.toggleDanger(true);
    renderLayerCats(); renderMapDayFilter(); syncMap(); OsloMap.fitAll();
    toast('Φίλτρα καθαρά');
  });

  /* αναζήτηση */
  const si = $('#mapSearch'), sr = $('#mapSearchResults');
  si.addEventListener('input', () => {
    const q = si.value.trim().toLowerCase();
    $('#mapSearchClear').hidden = !q;
    if (!q) { sr.hidden = true; return; }
    const hits = PLACES.filter(p =>
      (p.nameEl || '').toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.desc || '').toLowerCase().includes(q)).slice(0, 8);
    if (!hits.length) { sr.hidden = true; return; }
    sr.innerHTML = hits.map(p => {
      const c = CATS[p.cat];
      return `<div class="msr-item" data-go="${p.id}">
        <div class="msr-ico" style="background:${c.raw}22;color:${c.raw}">${icon(c.icon)}</div>
        <div><div class="msr-t">${p.nameEl || p.name}</div><div class="msr-s">${c.label} · ${p.costLabel}</div></div>
      </div>`;
    }).join('');
    sr.hidden = false;
    $$('.msr-item', sr).forEach(el => el.addEventListener('click', () => {
      OsloMap.flyTo(el.dataset.go);
      sr.hidden = true; si.value = ''; $('#mapSearchClear').hidden = true;
    }));
  });
  $('#mapSearchClear').addEventListener('click', () => {
    si.value = ''; sr.hidden = true; $('#mapSearchClear').hidden = true;
  });
}

/* ════════════ ΛΙΣΤΑ ════════════ */
function renderListChips() {
  const cats = Object.entries(CATS).filter(([k]) => k !== 'transport');
  $('#listChips').innerHTML =
    `<button class="chip ${UI.listCat === 'all' ? 'is-on' : ''}" data-c="all">Όλα <span class="n">${PLACES.length}</span></button>` +
    `<button class="chip ${UI.listCat === 'gem' ? 'is-on' : ''}" data-c="gem">${icon('ic-star','xs')} Διαμάντια <span class="n">${PLACES.filter(p=>p.gem).length}</span></button>` +
    `<button class="chip ${UI.listCat === 'from' ? 'is-on' : ''}" data-c="from">${icon('ic-user','xs')} Συνάδελφος <span class="n">${PLACES.filter(p=>p.from).length}</span></button>` +
    cats.map(([k, c]) => `<button class="chip ${UI.listCat === k ? 'is-on' : ''}" data-c="${k}">
      <span class="dot" style="background:${c.raw}"></span>${c.label}
      <span class="n">${PLACES.filter(p => p.cat === k).length}</span></button>`).join('');
  $$('#listChips .chip').forEach(b => b.addEventListener('click', () => {
    UI.listCat = b.dataset.c; renderListChips(); renderList();
  }));
}

function filteredPlaces() {
  const q = UI.listQ.toLowerCase();
  return PLACES.filter(p => {
    if (UI.listCat === 'gem')       { if (!p.gem) return false; }
    else if (UI.listCat === 'from') { if (!p.from) return false; }
    else if (UI.listCat !== 'all' && p.cat !== UI.listCat) return false;

    if (UI.listState === 'done' && !Store.isVisited(p.id)) return false;
    if (UI.listState === 'todo' && Store.isVisited(p.id)) return false;
    if (UI.listState === 'fav'  && !Store.isFav(p.id)) return false;

    if (q && !((p.nameEl || '').toLowerCase().includes(q) ||
               p.name.toLowerCase().includes(q) ||
               (p.desc || '').toLowerCase().includes(q))) return false;
    return true;
  });
}

function renderList() {
  const all = PLACES.filter(p => p.cat !== 'transport');
  const done = all.filter(p => Store.isVisited(p.id)).length;
  $('#listStats').innerHTML = `
    <div class="stat"><b>${all.length}</b><span>Μέρη</span></div>
    <div class="stat"><b style="color:var(--ok)">${done}</b><span>Έγιναν</span></div>
    <div class="stat"><b style="color:var(--gold)">${all.filter(p=>p.gem).length}</b><span>Διαμάντια</span></div>
    <div class="stat"><b style="color:var(--accent)">${all.filter(p=>p.cost===0).length}</b><span>Δωρεάν</span></div>`;

  const items = filteredPlaces();
  const box = $('#listItems');
  if (!items.length) {
    box.innerHTML = `<div class="empty">${icon('ic-search')}<p>Δεν βρέθηκε τίποτα με αυτά τα φίλτρα.</p></div>`;
    return;
  }
  box.innerHTML = items.map(p => {
    const c = CATS[p.cat];
    const dn = Store.isVisited(p.id), fv = Store.isFav(p.id);
    return `<div class="pcard ${dn ? 'done' : ''}" data-open="${p.id}">
      <div class="pc-ico" style="background:${c.raw}22;color:${c.raw}">${icon(c.icon)}</div>
      <div class="pc-body">
        <div class="pc-name">${p.nameEl || p.name}${p.gem ? icon('ic-star') : ''}</div>
        <div class="pc-desc">${p.desc}</div>
        <div class="pc-meta">
          <span class="tag ${p.cost === 0 ? 'free' : 'cost'}">${p.costLabel}</span>
          <span class="tag">${c.label}</span>
          ${p.from ? `<span class="tag tip">${icon('ic-user','xs')} ${p.from}</span>` : ''}
          ${p.approx ? `<span class="tag warn">${icon('ic-pin','xs')} pin κατά προσέγγιση</span>` : ''}
        </div>
      </div>
      <div class="pc-side">
        <button class="tick ${dn ? 'on' : ''}" data-tick="${p.id}">${icon('ic-check')}</button>
        <button class="icon-btn sm plain" data-fav="${p.id}" style="${fv ? 'color:var(--gold)' : ''}">${icon('ic-star')}</button>
      </div>
    </div>`;
  }).join('');

  $$('#listItems [data-tick]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    Store.toggleVisited(b.dataset.tick);
    OsloMap.refreshPin(b.dataset.tick);
    renderList(); renderDaystrip(); renderDay(); renderTop();
  }));
  $$('#listItems [data-fav]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    Store.toggleFav(b.dataset.fav);
    renderList(); renderDay();
  }));
  $$('#listItems .pcard').forEach(el => el.addEventListener('click', () => openPlace(el.dataset.open)));
}

function initList() {
  renderListChips();
  $('#listSearch').addEventListener('input', e => { UI.listQ = e.target.value; renderList(); });
  $$('#listState .seg').forEach(b => b.addEventListener('click', () => {
    UI.listState = b.dataset.state;
    $$('#listState .seg').forEach(x => x.classList.toggle('is-on', x === b));
    renderList();
  }));
  renderList();
}

/* ════════════ ΕΚΔΡΟΜΕΣ ════════════ */
function renderTrips() {
  $('#tripsList').innerHTML = DAYTRIPS.map(t => `
    <article class="trip" data-trip="${t.id}">
      <div class="trip-head">
        <div class="trip-ico" style="background:color-mix(in srgb, ${t.color} 15%, transparent);color:${t.color}">${icon(t.icon)}</div>
        <div class="trip-h">
          <div class="trip-rank">${t.rank}</div>
          <div class="trip-t">${t.title}</div>
          <div class="trip-s">${t.sub}</div>
        </div>
      </div>
      <div class="trip-meta">${t.meta.map(m => `<span class="pill">${icon(m.i,'xs')} ${m.t}</span>`).join('')}</div>
      <div class="trip-body">
        <h4>Πώς γίνεται</h4>
        <ul class="steps">${t.steps.map(s => `<li><b>${s.b}</b>${s.t}</li>`).join('')}</ul>
        ${t.notes.map(n => `<div class="note ${n.type}">${n.txt}</div>`).join('')}
        ${t.book ? `<a class="btn full" href="${t.book}" target="_blank" rel="noopener">${icon('ic-external','sm')} Κράτηση</a>` : ''}
      </div>
      <button class="trip-toggle">Δες αναλυτικά ${icon('ic-chevron-down')}</button>
    </article>`).join('');

  $$('#tripsList .trip-toggle').forEach(b => b.addEventListener('click', () => {
    const t = b.closest('.trip');
    t.classList.toggle('open');
    b.firstChild.textContent = t.classList.contains('open') ? 'Λιγότερα ' : 'Δες αναλυτικά ';
  }));
}

/* ════════════ BUDGET ════════════ */
function renderBudget() {
  const spentN = Store.spentNok;
  const spentE = nok2eur(spentN);
  const target = Store.budget;
  const left = target - spentE;

  const start = new Date(TRIP.start + 'T12:00:00');
  const today = new Date(todayIso() + 'T12:00:00');
  const total = ITINERARY.length;
  const elapsed = Math.min(total, Math.max(1, Math.round((today - start) / 864e5) + 1));
  const inTrip = today >= start;

  $('#bTargetLbl').textContent = fmtEur(target);
  $('#bSpent').textContent = fmtEur(spentE);
  $('#bLeft').textContent = fmtEur(left);
  $('#bLeft').style.color = left < 0 ? 'var(--bad)' : '';
  $('#bPace').textContent = fmtEur(inTrip ? spentE / elapsed : 0);

  const pct = target > 0 ? Math.min(100, spentE / target * 100) : 0;
  const fill = $('#bFill');
  fill.style.width = pct + '%';
  fill.classList.toggle('over', spentE > target);
  $('#bIdeal').style.left = (inTrip ? Math.min(100, elapsed / total * 100) : 0) + '%';

  const perDay = target / total;
  const v = $('#bVerdict');
  if (!inTrip) {
    v.className = 'verdict';
    v.innerHTML = `Στόχος <b>${fmtEur(perDay)}</b> τη μέρα για ${total} μέρες, δύο άτομα. Ισοτιμία <b>${Store.rate}</b> NOK/€.`;
  } else {
    const ideal = perDay * elapsed;
    const diff = spentE - ideal;
    if (diff <= 0) { v.className = 'verdict good'; v.innerHTML = `Είσαι <b>${fmtEur(-diff)} κάτω</b> από τον ρυθμό. Άνετα.`; }
    else           { v.className = 'verdict bad';  v.innerHTML = `Είσαι <b>${fmtEur(diff)} πάνω</b> από τον ρυθμό. Μία μέρα σπίτι το ισοφαρίζει.`; }
  }

  /* πρόβλεψη vs πραγματικά */
  const byCat = {};
  Store.expenses.forEach(e => { byCat[e.cat] = (byCat[e.cat] || 0) + e.nok; });
  const maxPlan = Math.max(...BUDGET_PLAN.map(b => b.eur));
  $('#budgetBreakdown').innerHTML = BUDGET_PLAN.map(b => {
    const act = nok2eur(byCat[b.cat] || 0);
    const over = act > b.eur;
    return `<div class="bkrow">
      <div class="bk-ico" style="background:color-mix(in srgb, ${b.color} 15%, transparent);color:${b.color}">${icon(b.icon)}</div>
      <div class="bk-n"><b>${b.label}</b><span>${b.detail}</span></div>
      <div class="bk-bar"><i style="width:${Math.min(100, b.eur / maxPlan * 100)}%;background:${b.color}"></i></div>
      <div class="bk-v">${fmtEur(act)}<span style="color:var(--tx-3);font-weight:500"> / ${fmtEur(b.eur)}</span></div>
    </div>`;
  }).join('') + `<div class="note ${nok2eur(spentN) > BUDGET_PLAN.reduce((a,b)=>a+b.eur,0) ? 'warn' : ''}">
    Σύνολο πρόβλεψης: <b>${fmtEur(BUDGET_PLAN.reduce((a, b) => a + b.eur, 0))}</b> έναντι στόχου <b>${fmtEur(target)}</b>.
    ${BUDGET_PLAN.reduce((a,b)=>a+b.eur,0) > target
      ? `Η πρόβλεψη ξεπερνά τον στόχο κατά <b>${fmtEur(BUDGET_PLAN.reduce((a,b)=>a+b.eur,0) - target)}</b> — και ο λόγος είναι το Flåm. Χωρίς αυτό, πέφτεις στα ${fmtEur(BUDGET_PLAN.reduce((a,b)=>a+b.eur,0) - 380)}.`
      : 'Είσαι εντός.'}
  </div>`;

  renderPassCalc();
  renderExpenseLog();
}

function renderPassCalc() {
  $('#passCalc').innerHTML = PASS_ITEMS.map(it => `
    <div class="pc-row">
      <label><input type="checkbox" data-pass="${it.id}" ${Store.isPass(it.id) ? 'checked' : ''}> ${it.label}</label>
      <b>${it.nok} NOK</b>
    </div>`).join('');
  $$('#passCalc [data-pass]').forEach(cb => cb.addEventListener('change', () => {
    Store.togglePass(cb.dataset.pass); renderPassCalc();
  }));

  const sum = PASS_ITEMS.filter(i => Store.isPass(i.id)).reduce((a, b) => a + b.nok, 0);
  const diff = sum - PASS_PRICE;
  const v = $('#passVerdict');
  if (sum === 0) {
    v.className = 'verdict';
    v.innerHTML = `Το 72ωρο Oslo Pass κοστίζει <b>${PASS_PRICE} NOK</b>. Τσέκαρε τι θα δεις.`;
  } else if (diff > 0) {
    v.className = 'verdict good';
    v.innerHTML = `Σύνολο <b>${sum} NOK</b> έναντι <b>${PASS_PRICE} NOK</b> του Pass → <b>γλιτώνεις ${diff} NOK</b> (${fmtEur(nok2eur(diff))}) ανά άτομο. Πάρ' το.`;
  } else {
    v.className = 'verdict bad';
    v.innerHTML = `Σύνολο <b>${sum} NOK</b> έναντι <b>${PASS_PRICE} NOK</b> → <b>χάνεις ${-diff} NOK</b>. Πλήρωσε ξεχωριστά.`;
  }
}

function renderExpenseLog() {
  const list = [...Store.expenses].reverse();
  const box = $('#expenseLog');
  if (!list.length) {
    box.innerHTML = `<div class="empty">${icon('ic-wallet')}<p>Καμία δαπάνη ακόμα.</p></div>`;
    return;
  }
  const CATICO = { food:['ic-fork','var(--c-food)'], groceries:['ic-cart','var(--c-shop)'],
    drinks:['ic-beer','var(--c-bar)'], tickets:['ic-ticket','var(--c-museum)'],
    transport:['ic-train','var(--c-transport)'], trip:['ic-mountain','var(--c-nature)'],
    other:['ic-tag','var(--tx-3)'] };
  box.innerHTML = list.map(e => {
    const [ic, col] = CATICO[e.cat] || CATICO.other;
    const dp = e.day != null && ITINERARY[e.day] ? dparts(ITINERARY[e.day].date) : null;
    return `<div class="exlog">
      <div class="bk-ico" style="background:color-mix(in srgb, ${col} 15%, transparent);color:${col}">${icon(ic)}</div>
      <div class="el-n"><b>${e.note || '—'}</b><span>${dp ? `${dp.dow} ${dp.num} ${dp.mon}` : ''}</span></div>
      <div class="el-v">${fmtNok(e.nok)}<br><span style="font-size:10.5px;color:var(--tx-3)">${fmtEur(nok2eur(e.nok))}</span></div>
      <button class="icon-btn sm plain" data-del="${e.id}">${icon('ic-x')}</button>
    </div>`;
  }).join('');
  $$('#expenseLog [data-del]').forEach(b => b.addEventListener('click', () => {
    Store.removeExpense(b.dataset.del); renderBudget();
  }));
}

function initBudget() {
  $('#exDay').innerHTML = ITINERARY.map((d, i) => {
    const p = dparts(d.date);
    return `<option value="${i}">${p.dow} ${p.num} ${p.mon} — ${d.title}</option>`;
  }).join('');

  const t = new Date(todayIso() + 'T12:00:00');
  const idx = ITINERARY.findIndex(d => d.date === todayIso());
  $('#exDay').value = idx > -1 ? idx : 0;

  $$('#exCur .seg').forEach(b => b.addEventListener('click', () => {
    UI.exCur = b.dataset.cur;
    $$('#exCur .seg').forEach(x => x.classList.toggle('is-on', x === b));
  }));

  $('#btnAddExpense').addEventListener('click', () => {
    const amt = parseFloat($('#exAmt').value);
    if (!amt || amt <= 0) { toast('Βάλε ποσό'); return; }
    const nok = UI.exCur === 'EUR' ? amt * Store.rate : amt;
    Store.addExpense({
      day: +$('#exDay').value,
      cat: $('#exCat').value,
      note: $('#exNote').value.trim(),
      nok
    });
    $('#exAmt').value = ''; $('#exNote').value = '';
    renderBudget();
    toast('Καταχωρήθηκε');
  });
  $('#exAmt').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnAddExpense').click(); });

  renderBudget();
}

/* ════════════ ΟΔΗΓΟΣ ════════════ */
function renderInfo() {
  $('#infoContent').innerHTML = INFO.map((s, i) => `
    <section class="acc ${s.open ? 'open' : ''}">
      <button class="acc-h">${icon(s.icon)}<strong>${s.title}</strong>${icon('ic-chevron-down','chev')}</button>
      <div class="acc-b">${s.html}</div>
    </section>`).join('');
  $$('#infoContent .acc-h').forEach(b => b.addEventListener('click', () =>
    b.closest('.acc').classList.toggle('open')));

  // ο κωδικός κράτησης ζει μόνο στη συσκευή — μπαίνει εδώ τη στιγμή της προβολής
  const slot = $('#confSlot');
  if (slot) slot.textContent = Store.conf || '—';
}

/* ════════════ SHEETS ════════════ */
function sheet(sel, html) {
  closeSheets();
  const s = $(sel);
  if (html !== undefined) $(sel + ' .sheet-body').innerHTML = html;
  s.hidden = false;
  $('#backdrop').hidden = false;
}
function closeSheets() {
  $$('.sheet').forEach(s => s.hidden = true);
  $('#backdrop').hidden = true;
}

function openPlace(id) {
  const p = P(id);
  if (!p) return;
  const c = CATS[p.cat];
  const dn = Store.isVisited(id), fv = Store.isFav(id);

  sheet('#placeSheet', `
    <div class="ps-hero">
      <div class="ps-ico" style="background:${c.raw}22;color:${c.raw}">${icon(c.icon)}</div>
      <div class="ps-h">
        <div class="ps-cat" style="color:${c.raw}">${c.label}${p.gem ? ' · ★ Διαμάντι' : ''}${p.from ? ' · από τη συνάδελφο' : ''}</div>
        <div class="ps-t">${p.nameEl || p.name}</div>
        ${p.nameEl && p.nameEl !== p.name ? `<div class="ps-no">${p.name}</div>` : ''}
      </div>
    </div>

    <p class="ps-desc">${p.desc}</p>

    <div class="ps-facts">
      <div class="ps-fact">${icon('ic-wallet')}<div><b>Κόστος</b><span>${p.costLabel}</span></div></div>
      ${p.hours && p.hours !== '—' ? `<div class="ps-fact">${icon('ic-clock')}<div><b>Ωράριο</b><span>${p.hours}</span></div></div>` : ''}
      <div class="ps-fact">${icon('ic-pin')}<div><b>Θέση</b><span>${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}${
        p.approx ? '<br><em style="color:var(--warn);font-size:12px">Κατά προσέγγιση — τα κουμπιά παρακάτω ψάχνουν το όνομα στο Google Maps, οπότε σε πάνε σωστά.</em>' : ''
      }</span></div></div>
    </div>

    ${p.tip ? `<div class="ps-tip"><b>Το κόλπο</b>${p.tip}</div>` : ''}

    <div class="setting">
      <label>Η σημείωσή σου</label>
      <textarea id="psNote" rows="2" placeholder="Κράτα μια σημείωση…" style="font-family:inherit;font-size:13.5px">${Store.getNote(id)}</textarea>
    </div>

    <div class="ps-actions">
      <a class="btn primary" href="${gdirUrl(p)}" target="_blank" rel="noopener">${icon('ic-navigation','sm')} Οδηγίες</a>
      <a class="btn" href="${gmapsUrl(p)}" target="_blank" rel="noopener">${icon('ic-external','sm')} Google Maps</a>
      <button class="btn ${dn ? 'primary' : ''}" id="psTick">${icon('ic-check','sm')} ${dn ? 'Έγινε ✓' : 'Σημείωσε ως έγινε'}</button>
      <button class="btn" id="psFav" style="${fv ? 'color:var(--gold);border-color:rgba(245,184,65,.4)' : ''}">${icon('ic-star','sm')} ${fv ? 'Αγαπημένο' : 'Αγαπημένο'}</button>
      <button class="btn ghost wide" id="psMap">${icon('ic-map','sm')} Δείξ' το στον χάρτη</button>
    </div>
  `);

  $('#psTick').addEventListener('click', () => {
    Store.toggleVisited(id); OsloMap.refreshPin(id);
    closeSheets(); renderList(); renderDaystrip(); renderDay(); renderTop();
    toast(Store.isVisited(id) ? 'Τσεκαρίστηκε ✓' : 'Ξε-τσεκαρίστηκε');
  });
  $('#psFav').addEventListener('click', () => {
    Store.toggleFav(id); closeSheets(); renderList(); renderDay();
    toast(Store.isFav(id) ? 'Στα αγαπημένα ★' : 'Αφαιρέθηκε');
  });
  $('#psMap').addEventListener('click', () => { closeSheets(); go('map'); setTimeout(() => OsloMap.flyTo(id), 260); });
  $('#psNote').addEventListener('input', e => Store.setNote(id, e.target.value));
}

/* ════════════ ΡΥΘΜΙΣΕΙΣ ════════════ */
function initSettings() {
  $('#btnSettings').addEventListener('click', () => {
    $$('#setWho .seg').forEach(b => b.classList.toggle('is-on', b.dataset.who === Store.who));
    $$('#setTheme .seg').forEach(b => b.classList.toggle('is-on', b.dataset.theme === Store.theme));
    $('#setRate').value = Store.rate;
    $('#rateLbl').textContent = Store.rate;
    $('#setBudget').value = Store.budget;
    $('#setHomeAddr').value = Store.addrRaw;
    $('#setConf').value = Store.conf;
    sheet('#settingsSheet');
  });

  $('#setHomeAddr').addEventListener('input', e => {
    Store.setAddr(e.target.value);
    OsloMap.buildHome();
  });
  $('#setConf').addEventListener('input', e => { Store.setConf(e.target.value); renderInfo(); });

  $$('#setWho .seg').forEach(b => b.addEventListener('click', () => {
    Store.setWho(b.dataset.who);
    $$('#setWho .seg').forEach(x => x.classList.toggle('is-on', x === b));
    renderAll();
    toast('Γεια σου ' + (b.dataset.who === 'stavros' ? 'Σταύρο' : 'Ελένη') + '!');
  }));

  $$('#setTheme .seg').forEach(b => b.addEventListener('click', () => {
    Store.setTheme(b.dataset.theme);
    $$('#setTheme .seg').forEach(x => x.classList.toggle('is-on', x === b));
    applyTheme();
  }));

  $('#setRate').addEventListener('input', e => {
    Store.setRate(e.target.value);
    $('#rateLbl').textContent = (+e.target.value).toFixed(1);
    renderBudget();
  });
  $('#setBudget').addEventListener('change', e => { Store.setBudget(e.target.value); renderBudget(); });

  $('#btnMoveHome').addEventListener('click', () => {
    closeSheets(); go('map'); OsloMap.startPlacingHome();
    toast('Κάνε κλικ στον χάρτη στο σωστό σημείο');
  });

  $('#btnExport').addEventListener('click', async () => {
    const code = Store.export();
    $('#syncBox').value = code;
    try { await navigator.clipboard.writeText(code); toast('Αντιγράφηκε — στείλ\' το!'); }
    catch { $('#syncBox').select(); toast('Αντίγραψέ το από το πλαίσιο'); }
  });
  $('#btnImport').addEventListener('click', () => {
    const code = $('#syncBox').value.trim();
    if (!code) { toast('Επικόλλησε πρώτα τον κωδικό'); return; }
    if (Store.import(code)) { closeSheets(); renderAll(); toast('Συγχρονίστηκε ✓'); }
    else toast('Ο κωδικός δεν είναι έγκυρος');
  });

  $('#btnResetPlan').addEventListener('click', () => {
    if (!confirm('Επαναφορά του αρχικού προγράμματος; Οι αλλαγές σου θα χαθούν.')) return;
    Store.resetPlan(); closeSheets(); renderDaystrip(); renderDay(); syncMap();
    toast('Επαναφέρθηκε');
  });
  $('#btnWipe').addEventListener('click', () => {
    if (!confirm('Σβήσιμο ΟΛΩΝ των δεδομένων σου (τικ, σημειώσεις, δαπάνες); Δεν αναιρείται.')) return;
    Store.wipe(); closeSheets(); renderAll(); toast('Καθαρίστηκε');
  });

  $('#backdrop').addEventListener('click', closeSheets);
  addEventListener('keydown', e => { if (e.key === 'Escape') closeSheets(); });
}

/* ════════════ BOOT ════════════ */
function renderAll() {
  applyTheme();
  renderTop();
  renderDaystrip();
  renderDay();
  renderListChips();
  renderList();
  renderBudget();
  syncMap();
}

function boot() {
  applyTheme();
  initTabs();
  renderDaystrip();
  renderDay();
  initMapUI();
  initList();
  renderTrips();
  initBudget();
  renderInfo();
  initSettings();
  renderTop();

  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (Store.theme === 'auto') applyTheme();
  });

  // deep-link: index.html#map, #budget, ... και κουμπί «πίσω» του κινητού
  const fromHash = location.hash.slice(1);
  if (fromHash && TABS.includes(fromHash)) go(fromHash, true);
  addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (TABS.includes(h) && h !== UI.tab) go(h, true);
  });

  const splash = $('#splash');
  const killSplash = () => {
    splash.classList.add('gone');
    setTimeout(() => splash.remove(), 700);
  };
  setTimeout(killSplash, 600);
  addEventListener('load', () => setTimeout(killSplash, 100));

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
