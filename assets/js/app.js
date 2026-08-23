/* ════════════════════════════════════════════════════════════
   APP — mobile first. Χάρτης και λίστα μαζί, τέσσερα tabs.
   ════════════════════════════════════════════════════════════ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const P  = id => PLACES.find(p => p.id === id);

const TABS = ['explore', 'plan', 'trips', 'info'];

const UI = {
  tab: 'explore',
  day: 0,
  q: '',
  state: 'all',                                   // all | todo | done
  openCats: new Set(['sight', 'food', 'bar']),    // ποιες κατηγορίες είναι ανοιχτές
  hiddenCats: new Set(),
  mapBig: false,
  dayFocus: null                                  // δείχνει μόνο τις στάσεις μιας μέρας
};

/* ─────────── helpers ─────────── */
const nok2eur = n => n / Store.rate;
const fmtEur  = n => '€' + Math.round(n).toLocaleString('el-GR');
const fmtNok  = n => Math.round(n).toLocaleString('el-GR') + ' NOK';
const icon = (n, c = '') => `<svg class="ic ${c}"><use href="#${n}"/></svg>`;

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

function gmapsUrl(p) {
  const q = p.approx ? encodeURIComponent(`${p.name}, Oslo`) : `${p.lat},${p.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
function gdirUrl(p, mode = 'transit') {
  // Χωρίς origin: το Google Maps ξεκινά από την ΤΡΕΧΟΥΣΑ θέση σου,
  // που είναι πάντα πιο χρήσιμο από ένα σταθερό σημείο.
  const dest = p.approx ? encodeURIComponent(`${p.name}, Oslo`) : `${p.lat},${p.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${mode}`;
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
  }, 1900);
}

/* ════════════ ΘΕΜΑ ════════════ */
function applyTheme() {
  const t = Store.theme;
  const eff = t === 'auto'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : t;
  const root = document.documentElement;

  // Πάγωσε τα transitions όσο αλλάζουν οι μεταβλητές χρώματος, αλλιώς
  // όσα στοιχεία κάνουν transition σε «all» μένουν στο παλιό χρώμα.
  root.classList.add('theme-switching');

  root.dataset.theme = eff;
  root.style.colorScheme = eff;

  void root.offsetWidth;                      // επιβάλλει επανυπολογισμό τώρα
  requestAnimationFrame(() => requestAnimationFrame(
    () => root.classList.remove('theme-switching')));
  $('meta[name=theme-color]').setAttribute('content', eff === 'light' ? '#F4F6F9' : '#0A0E14');
  $('meta[name=color-scheme]')?.setAttribute('content', eff);
  OsloMap.setBasemapForTheme(eff);
}

/* ════════════ TABS ════════════ */
function go(tab, silent) {
  if (!TABS.includes(tab)) tab = 'explore';
  UI.tab = tab;
  $$('#tabs .tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
  $$('.panel').forEach(p => p.classList.toggle('is-active', p.id === 'panel-' + tab));
  moveInd();
  if (!silent && location.hash.slice(1) !== tab) history.replaceState(null, '', '#' + tab);
  if (tab === 'explore') OsloMap.invalidate(); else scrollTo({ top: 0, behavior: 'smooth' });
}
function moveInd() {
  const ind = $('#tabInd'), act = $('#tabs .tab.is-active');
  if (!ind || !act || getComputedStyle(ind).display === 'none') return;
  ind.style.left = act.offsetLeft + 'px';
  ind.style.width = act.offsetWidth + 'px';
}
function initTabs() {
  $$('#tabs .tab').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
  moveInd();
  addEventListener('resize', moveInd);
}

/* ════════════ TOPBAR ════════════ */
function renderTop() {
  const el = $('#countdown');
  const t = new Date(todayIso() + 'T12:00:00');
  const s = new Date(TRIP.start + 'T12:00:00');
  const e = new Date(TRIP.end + 'T12:00:00');
  const days = Math.round((s - t) / 864e5);
  el.className = 'countdown';
  if (t < s)       el.textContent = days === 1 ? 'αύριο!' : `σε ${days} μέρες`;
  else if (t <= e) { el.textContent = `μέρα ${Math.round((t - s) / 864e5) + 1}/${ITINERARY.length}`; el.classList.add('live'); }
  else             { el.textContent = 'τέλος'; el.classList.add('past'); }

  $('#brandSub').textContent = Store.who === 'stavros' ? 'Σταύρος' : 'Ελένη';
  const total = PLACES.filter(p => p.cat !== 'transport').length;
  $('#progressFill').style.width = Math.round(Store.visitedCount / total * 100) + '%';
}

/* ════════════════════════════════════════════════════════════
   ΕΞΕΡΕΥΝΗΣΗ — χάρτης πάνω, λίστα κάτω, ταυτόχρονα ορατά
   ════════════════════════════════════════════════════════════ */
function dayPlaceIds(i) {
  return (Store.getPlan()[i] || []).map(s => s.p);
}

function passFilter(p) {
  if (UI.dayFocus !== null && !dayPlaceIds(UI.dayFocus).includes(p.id)) return false;
  if (UI.state === 'done' && !Store.isVisited(p.id)) return false;
  if (UI.state === 'todo' &&  Store.isVisited(p.id)) return false;
  const q = UI.q.trim().toLowerCase();
  if (!q) return true;
  return (p.nameEl || '').toLowerCase().includes(q)
      || p.name.toLowerCase().includes(q)
      || (p.desc || '').toLowerCase().includes(q);
}

function renderGroups() {
  const q = UI.q.trim();
  const groups = Object.entries(CATS)
    .map(([k, c]) => [k, c, PLACES.filter(p => p.cat === k && passFilter(p))])
    .filter(([, , list]) => list.length);

  if (!groups.length) {
    // Η αναζήτηση καλύπτει μόνο τα δικά μας μέρη. Αν δεν βρεθεί κάτι,
    // μη σε αφήνουμε σε αδιέξοδο — στείλ' το στο Google Maps.
    const gq = encodeURIComponent(q + ' Oslo');
    $('#exGroups').innerHTML = `<div class="empty">${icon('ic-search')}
      <p>Δεν το έχουμε στη λίστα.</p>
      ${q ? `<a class="btn primary" style="margin-top:12px" target="_blank" rel="noopener"
        href="https://www.google.com/maps/search/?api=1&query=${gq}">
        ${icon('ic-external','sm')} Ψάξ' το «${q}» στο Google Maps</a>
      <p style="margin-top:10px;font-size:12px">…και αν αξίζει, πρόσθεσέ το με το <b>+</b> στον χάρτη.</p>` : ''}
    </div>`;
    return;
  }

  $('#exGroups').innerHTML = groups.map(([k, c, list]) => {
    const open = q ? true : UI.openCats.has(k);          // με αναζήτηση ανοίγουν όλες
    const off  = UI.hiddenCats.has(k);
    const done = list.filter(p => Store.isVisited(p.id)).length;
    return `<section class="grp ${open ? 'open' : ''} ${off ? 'off' : ''}" data-g="${k}">
      <div class="grp-h">
        <button class="grp-main" data-toggle="${k}">
          <span class="grp-ic" style="background:${c.raw}22;color:${c.raw}">${icon(c.icon)}</span>
          <span class="grp-t">${c.label}</span>
          <span class="grp-n">${done}/${list.length}</span>
          ${icon('ic-chevron-down','chev')}
        </button>
        <button class="grp-eye" data-eye="${k}" aria-label="${off ? 'Δείξ’ τα' : 'Κρύψ’ τα'}">
          ${icon(off ? 'ic-eye-off' : 'ic-eye')}
        </button>
      </div>
      <div class="grp-items">
        ${list.map(p => rowHtml(p, c)).join('')}
      </div>
    </section>`;
  }).join('');

  wireGroups();
  offlineHint();   // μετά το innerHTML, αλλιώς σβήνεται σε κάθε ανανέωση
}

function rowHtml(p, c) {
  const dn = Store.isVisited(p.id);
  return `<div class="row ${dn ? 'done' : ''}" data-id="${p.id}">
    <button class="row-tick ${dn ? 'on' : ''}" data-tick="${p.id}" aria-label="Έγινε">${icon('ic-check')}</button>
    <button class="row-b" data-go="${p.id}">
      <span class="row-n">${p.nameEl || p.name}${p.gem ? icon('ic-star','star') : ''}</span>
      <span class="row-s">${money(p.costLabel || '')}</span>
    </button>
    <button class="row-nav" data-nav="${p.id}" aria-label="Πλοήγηση">${icon('ic-navigation')}</button>
  </div>`;
}

function wireGroups() {
  $$('#exGroups [data-toggle]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.toggle;
    UI.openCats.has(k) ? UI.openCats.delete(k) : UI.openCats.add(k);
    renderGroups();
  }));
  $$('#exGroups [data-eye]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.eye;
    UI.hiddenCats.has(k) ? UI.hiddenCats.delete(k) : UI.hiddenCats.add(k);
    renderGroups(); syncMap();
  }));
  $$('#exGroups [data-tick]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.tick;
    Store.toggleVisited(id);
    OsloMap.refreshPin(id);
    renderGroups(); renderTop(); renderDaystrip(); renderDay();
  }));
  $$('#exGroups [data-nav]').forEach(b => b.addEventListener('click', () => {
    const p = P(b.dataset.nav);
    if (p) window.open(gdirUrl(p), '_blank', 'noopener');
  }));
  $$('#exGroups [data-go]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.go;
    if (UI.hiddenCats.has(P(id).cat)) { UI.hiddenCats.delete(P(id).cat); renderGroups(); syncMap(); }
    OsloMap.flyTo(id);
    $('#explore').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }));
}

function syncMap() {
  OsloMap.buildPins(p => !UI.hiddenCats.has(p.cat) && passFilter(p));
  if (UI.dayFocus !== null) OsloMap.drawRoute(dayPlaceIds(UI.dayFocus));
  else OsloMap.clearRoute();
  renderDayBanner();
}

function renderDayBanner() {
  const el = $('#dayBanner');
  if (UI.dayFocus === null) { el.hidden = true; return; }
  const d = ITINERARY[UI.dayFocus], p = dparts(d.date);
  el.innerHTML = `<span>${icon('ic-calendar','xs')} Μέρα ${UI.dayFocus + 1} · ${p.dow} ${p.num} ${p.mon} — ${d.title}</span>
    <button id="dayBannerX" aria-label="Καθάρισε">${icon('ic-x')}</button>`;
  el.hidden = false;
  $('#dayBannerX').addEventListener('click', () => { UI.dayFocus = null; renderGroups(); syncMap(); });
}

function focusDayOnMap(i) {
  UI.dayFocus = i;
  UI.hiddenCats.clear();
  UI.q = ''; $('#exSearch').value = '';
  go('explore');
  renderGroups(); syncMap();
  setTimeout(() => OsloMap.fitDay(dayPlaceIds(i)), 300);
}

function initExplore() {
  OsloMap.init({
    onSelect: openPlace,
    onTick: () => { renderGroups(); renderTop(); renderDaystrip(); renderDay(); }
  });

  $('#exSearch').addEventListener('input', e => { UI.q = e.target.value; renderGroups(); syncMap(); });
  $$('#exState .seg').forEach(b => b.addEventListener('click', () => {
    UI.state = b.dataset.state;
    $$('#exState .seg').forEach(x => x.classList.toggle('is-on', x === b));
    renderGroups(); syncMap();
  }));

  $('#btnAddPlace').addEventListener('click', startAddPlace);
  $('#btnLocate').addEventListener('click', () => {
    toast('Εντοπισμός…');
    OsloMap.locate().then(() => toast('Σε βρήκα')).catch(() => toast('Δεν βρέθηκε η θέση σου'));
  });
  $('#btnMapGrow').addEventListener('click', () => {
    UI.mapBig = !UI.mapBig;
    $('#explore').classList.toggle('map-big', UI.mapBig);
    OsloMap.invalidate();
  });

  renderGroups();
}

/* Ο χάρτης offline είναι το πιο χρήσιμο κουμπί της εφαρμογής και το
   πιο κρυμμένο. Μία υπενθύμιση, μία φορά, με δυνατότητα απόρριψης. */
function offlineHint() {
  if (!location.protocol.startsWith('http')) return;
  if (localStorage.getItem('oslo-hint-offline')) return;
  const el = document.createElement('div');
  el.className = 'hint';
  el.innerHTML = `${icon('ic-download')}
    <span><b>Κατέβασε τον χάρτη</b> για να δουλεύει χωρίς σήμα στο Όσλο.
      Ρυθμίσεις ${icon('ic-sliders','xs')} → Χάρτης χωρίς σήμα.</span>
    <button aria-label="Εντάξει">${icon('ic-x')}</button>`;
  $('#exGroups').prepend(el);
  el.querySelector('button').addEventListener('click', () => {
    localStorage.setItem('oslo-hint-offline', '1');
    el.remove();
  });
}

/* ════════════ ΠΡΟΓΡΑΜΜΑ ════════════ */
function renderDaystrip() {
  const plan = Store.getPlan();
  const today = todayIso();
  $('#daystrip').innerHTML = ITINERARY.map((d, i) => {
    const p = dparts(d.date);
    const real = (plan[i] || []).filter(s => P(s.p));
    const done = real.filter(s => Store.isVisited(s.p)).length;
    const pct = real.length ? done / real.length * 100 : 0;
    return `<button class="daychip ${i === UI.day ? 'is-on' : ''} ${d.date === today ? 'is-today' : ''}" data-day="${i}">
      <div class="dc-dow">${p.dow}</div><div class="dc-num">${p.num}</div><div class="dc-mon">${p.mon}</div>
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
  if (!d) return;
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
        <svg viewBox="0 0 54 54"><circle class="bgc" cx="27" cy="27" r="24"/>
          <circle class="fgc" cx="27" cy="27" r="24" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct)}"/></svg>
        <b>${done}/${real.length}</b>
      </div>
    </div>
    <div class="dh-sub">${d.sub}</div>
    <div class="dh-meta">
      <span class="pill accent">${icon('ic-pin','xs')} ${real.length} στάσεις</span>
      ${costs > 0
        ? `<span class="pill gold">${icon('ic-ticket','xs')} εισιτήρια ~${fmtNok(costs)} · ${fmtEur(nok2eur(costs))}</span>`
        : `<span class="pill ok">${icon('ic-check','xs')} Χωρίς εισιτήρια</span>`}
      ${d.daytrip ? `<span class="pill warn">${icon('ic-mountain','xs')} Εκδρομή</span>` : ''}
    </div>
  </div>`;

  const list = stops.length
    ? `<div class="stops">${stops.map((s, i) => stopHtml(s, i)).join('')}</div>`
    : `<div class="day-empty">Δεν έμεινε καμία στάση σε αυτή τη μέρα.</div>`;

  const nav = `<div class="daynav">
    <button class="btn ghost" id="dPrev" ${UI.day === 0 ? 'disabled' : ''}>${icon('ic-chevron-left','sm')} Προηγ.</button>
    <button class="btn" id="dMap">${icon('ic-map','sm')} Δες τη στον χάρτη</button>
    <button class="btn ghost" id="dNext" ${UI.day === ITINERARY.length-1 ? 'disabled' : ''}>Επόμ. ${icon('ic-chevron-right','sm')}</button>
  </div>`;

  $('#dayDetail').innerHTML = hero + `<div>${list}${nav}</div>`;
  wireStops();
  $('#dPrev')?.addEventListener('click', () => { UI.day--; renderDaystrip(); renderDay(); });
  $('#dNext')?.addEventListener('click', () => { UI.day++; renderDaystrip(); renderDay(); });
  $('#dMap')?.addEventListener('click', () => focusDayOnMap(UI.day));
}

function stopHtml(s, i) {
  if (s.p === 'HOME' || s.p === 'DAYTRIP') {
    const home = s.p === 'HOME';
    return `<div class="stop-wrap" data-i="${i}"><div class="stop">
      <div class="stop-drag">${icon('ic-grip')}</div>
      <div class="st-ico" style="background:${home ? 'rgba(255,77,109,.14)' : 'rgba(78,216,160,.14)'};
        color:${home ? '#FF4D6D' : 'var(--c-nature)'}">${icon(home ? 'ic-home' : 'ic-mountain')}</div>
      <div class="st-body">
        <div class="st-time">${s.t}</div>
        ${home ? '<div class="st-name">Το σπίτι μας</div>' : ''}
        <div class="st-note">${s.note || ''}</div>
      </div>
      <div class="st-actions"><button class="icon-btn sm plain" data-menu="${i}">${icon('ic-dots')}</button></div>
    </div></div>`;
  }
  const pl = P(s.p);
  if (!pl) return '';
  const c = CATS[pl.cat];
  const dn = Store.isVisited(pl.id);
  // Το transit ταξιδεύει ΜΕΣΑ στο ίδιο περίβλημα με τη στάση, ώστε να
  // μετακινείται μαζί της όταν αλλάζεις σειρά.
  return `<div class="stop-wrap" data-i="${i}">
  ${s.transit ? `<div class="transit">${icon('ic-navigation','xs')} ${s.transit}</div>` : ''}
  <div class="stop ${dn ? 'done' : ''}" data-place="${pl.id}">
    <div class="stop-drag">${icon('ic-grip')}</div>
    <div class="st-ico" style="background:${c.raw}22;color:${c.raw};border-color:${c.raw}44">${icon(c.icon)}</div>
    <div class="st-body" data-open="${pl.id}">
      <div class="st-time">${s.t} · ${c.label}</div>
      <div class="st-name">${pl.nameEl || pl.name}</div>
      <div class="st-note">${s.note || pl.desc.slice(0, 90) + '…'}</div>
      <div class="st-tags">
        ${pl.costLabel && pl.costLabel !== '—'
          ? `<span class="tag ${pl.cost === 0 ? 'free' : 'cost'}">${money(pl.costLabel)}</span>` : ''}
        ${pl.gem ? '<span class="tag">★ Διαμάντι</span>' : ''}
      </div>
    </div>
    <div class="st-actions">
      <button class="tick ${dn ? 'on' : ''}" data-tick="${pl.id}" aria-label="Έγινε">${icon('ic-check')}</button>
      <button class="icon-btn sm plain" data-menu="${i}">${icon('ic-dots')}</button>
    </div>
  </div></div>`;
}

function wireStops() {
  $$('#dayDetail [data-tick]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    Store.toggleVisited(b.dataset.tick);
    OsloMap.refreshPin(b.dataset.tick);
    renderDaystrip(); renderDay(); renderTop(); renderGroups();
  }));
  $$('#dayDetail [data-open]').forEach(b => b.addEventListener('click', () => openPlace(b.dataset.open)));
  $$('#dayDetail [data-menu]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); openStopMenu(+b.dataset.menu);
  }));

  const list = $('#dayDetail .stops');
  if (list) makeSortable(list, order => {
    const plan = Store.getPlan();
    const arr = plan[UI.day];
    plan[UI.day] = order.map(i => arr[i]);
    Store.setPlan(plan);
    renderDay();
    toast('Αναδιατάχθηκε');
  });
}

/* ── Αναδιάταξη με σύρσιμο ──────────────────────────────────
   Pointer Events, όχι HTML5 drag-and-drop: το δεύτερο ΔΕΝ
   ενεργοποιείται καθόλου με αφή, οπότε στο κινητό ήταν νεκρό.
   Εδώ δουλεύει το ίδιο με δάχτυλο και με ποντίκι.
   ─────────────────────────────────────────────────────────── */
function makeSortable(container, onReorder) {
  let el = null, id = null;

  container.querySelectorAll('.stop-wrap').forEach(wrap => {
    const handle = wrap.querySelector('.stop-drag');
    if (!handle) return;

    handle.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      e.preventDefault();
      el = wrap; id = e.pointerId;
      wrap.classList.add('dragging');
      wrap.style.height = wrap.getBoundingClientRect().height + 'px';
      document.body.classList.add('is-sorting');
      handle.setPointerCapture(id);
    });

    handle.addEventListener('pointermove', e => {
      if (!el) return;
      e.preventDefault();
      const y = e.clientY;

      // βρες το πρώτο αδέρφι του οποίου το μέσο είναι κάτω από το δάχτυλο
      const sibs = [...container.querySelectorAll('.stop-wrap:not(.dragging)')];
      const before = sibs.find(s => {
        const r = s.getBoundingClientRect();
        return y < r.top + r.height / 2;
      });
      before ? container.insertBefore(el, before) : container.appendChild(el);

      // αυτόματο κύλισμα κοντά στις άκρες, αλλιώς δεν φτάνεις μακρινή θέση
      const edge = 100;
      if (y < edge) scrollBy(0, -14);
      else if (y > innerHeight - edge) scrollBy(0, 14);
    });

    const finish = () => {
      if (!el) return;
      el.classList.remove('dragging');
      el.style.height = '';
      document.body.classList.remove('is-sorting');
      const order = [...container.querySelectorAll('.stop-wrap')].map(w => +w.dataset.i);
      el = null; id = null;
      onReorder(order);
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  });
}

function openStopMenu(i) {
  const plan = Store.getPlan(), arr = plan[UI.day], s = arr[i], pl = P(s.p);
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
      <button class="btn" data-shift="1" ${i === arr.length-1 ? 'disabled' : ''}>Πιο κάτω ${icon('ic-chevron-right','sm')}</button>
    </div>
    <h3 class="sheet-title sm">${icon('ic-calendar')} Μετακίνηση σε άλλη μέρα</h3>
    ${dayOpts}
    <hr>
    <button class="btn danger full" data-remove="1">${icon('ic-trash','sm')} Αφαίρεση</button>`);

  $$('#placeSheet [data-shift]').forEach(b => b.addEventListener('click', () => {
    const j = i + (+b.dataset.shift);
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    Store.setPlan(plan); closeSheets(); renderDay(); toast('Μετακινήθηκε');
  }));
  $$('#placeSheet [data-move]').forEach(b => b.addEventListener('click', () => {
    const k = +b.dataset.move;
    arr.splice(i, 1); plan[k].push(s);
    plan[k].sort((a, b2) => (a.t || '').localeCompare(b2.t || ''));
    Store.setPlan(plan); closeSheets(); renderDaystrip(); renderDay(); toast(`Πήγε στη μέρα ${k+1}`);
  }));
  $('#placeSheet [data-remove]')?.addEventListener('click', () => {
    arr.splice(i, 1);
    Store.setPlan(plan); closeSheets(); renderDaystrip(); renderDay(); toast('Αφαιρέθηκε');
  });
}

/* ════════════ ΕΚΔΡΟΜΕΣ ════════════ */
function renderTrips() {
  $('#tripsList').innerHTML = DAYTRIPS.map(t => `
    <article class="trip">
      <div class="trip-head">
        <div class="trip-ico" style="background:color-mix(in srgb, ${t.color} 15%, transparent);color:${t.color}">${icon(t.icon)}</div>
        <div class="trip-h">
          <div class="trip-rank">${t.rank}</div>
          <div class="trip-t">${t.title}</div>
          <div class="trip-s">${t.sub}</div>
        </div>
      </div>
      <div class="trip-meta">${t.meta.map(m => `<span class="pill">${icon(m.i,'xs')} ${money(m.t)}</span>`).join('')}</div>
      <div class="trip-body">
        <h4>Πώς γίνεται</h4>
        <ul class="steps">${t.steps.map(s => `<li><b>${money(s.b)}</b>${money(s.t)}</li>`).join('')}</ul>
        ${t.notes.map(n => `<div class="note ${n.type}">${money(n.txt)}</div>`).join('')}
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

/* ════════════ ΟΔΗΓΟΣ ════════════ */
function renderInfo() {
  $('#infoContent').innerHTML = INFO.map(s => `
    <section class="acc ${s.open ? 'open' : ''}">
      <button class="acc-h">${icon(s.icon)}<strong>${s.title}</strong>${icon('ic-chevron-down','chev')}</button>
      <div class="acc-b">${money(s.html)}</div>
    </section>`).join('');
  $$('#infoContent .acc-h').forEach(b => b.addEventListener('click', () =>
    b.closest('.acc').classList.toggle('open')));
  const slot = $('#confSlot');
  if (slot) slot.textContent = Store.conf || '—';
}

/* ════════════ SHEETS ════════════ */
function sheet(sel, html) {
  closeSheets();
  if (html !== undefined) $(sel + ' .sheet-body').innerHTML = html;
  $(sel).hidden = false;
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
        <div class="ps-cat" style="color:${c.raw}">${c.label}${p.gem ? ' · ★ Διαμάντι' : ''}${p.custom ? ' · δικό σου' : ''}</div>
        <div class="ps-t">${p.nameEl || p.name}</div>
        ${p.nameEl && p.nameEl !== p.name ? `<div class="ps-no">${p.name}</div>` : ''}
      </div>
    </div>
    <p class="ps-desc">${p.desc}${p.from ? ` <em class="src">Πρόταση από τη συνάδελφο.</em>` : ''}</p>
    <div class="ps-facts">
      <div class="ps-fact">${icon('ic-wallet')}<div><b>Κόστος</b><span>${money(p.costLabel)}</span></div></div>
      ${p.hours && p.hours !== '—' ? `<div class="ps-fact">${icon('ic-clock')}<div><b>Ωράριο</b><span>${p.hours}</span></div></div>` : ''}
      ${p.addr ? `<div class="ps-fact">${icon('ic-pin')}<div><b>Διεύθυνση</b><span>${p.addr}</span></div></div>` : ''}
      ${p.approx ? `<div class="ps-fact">${icon('ic-alert')}<div><b>Το pin</b><span style="color:var(--warn)">Είναι κατά προσέγγιση. Τα κουμπιά παρακάτω ψάχνουν το όνομα στο Google Maps, οπότε σε πάνε σωστά.</span></div></div>` : ''}
    </div>
    ${p.tip ? `<div class="ps-tip"><b>Το κόλπο</b>${money(p.tip)}</div>` : ''}
    <div class="setting">
      <label>Η σημείωσή σου</label>
      <textarea id="psNote" rows="2" placeholder="Κράτα μια σημείωση…" style="font-family:inherit;font-size:13.5px">${Store.getNote(id)}</textarea>
    </div>
    <div class="ps-actions">
      <a class="btn primary" href="${gdirUrl(p)}" target="_blank" rel="noopener">${icon('ic-navigation','sm')} Οδηγίες</a>
      <a class="btn" href="${gmapsUrl(p)}" target="_blank" rel="noopener">${icon('ic-external','sm')} Google Maps</a>
      <button class="btn ${dn ? 'primary' : ''}" id="psTick">${icon('ic-check','sm')} ${dn ? 'Έγινε ✓' : 'Τικ'}</button>
      <button class="btn" id="psFav" style="${fv ? 'color:var(--gold);border-color:rgba(245,184,65,.4)' : ''}">${icon('ic-star','sm')} Αγαπημένο</button>
      ${p.custom ? `<button class="btn ghost wide" id="psEdit">${icon('ic-sliders','sm')} Επεξεργασία / Διαγραφή</button>` : ''}
    </div>`);

  $('#psTick').addEventListener('click', () => {
    Store.toggleVisited(id); OsloMap.refreshPin(id);
    closeSheets(); renderGroups(); renderDaystrip(); renderDay(); renderTop();
  });
  $('#psFav').addEventListener('click', () => {
    Store.toggleFav(id); closeSheets(); renderGroups();
    toast(Store.isFav(id) ? 'Στα αγαπημένα ★' : 'Αφαιρέθηκε');
  });
  $('#psEdit')?.addEventListener('click', () => openAddSheet(p.lat, p.lng, p));
  $('#psNote').addEventListener('input', e => Store.setNote(id, e.target.value));
}

/* ════════════ ΔΙΚΑ ΣΟΥ ΜΕΡΗ ════════════ */
function syncCustomIntoPlaces() {
  for (let i = PLACES.length - 1; i >= 0; i--) if (PLACES[i].custom) PLACES.splice(i, 1);
  Store.custom.forEach(c => PLACES.push(c));
}

function startAddPlace() {
  go('explore');
  toast('Πάτα στον χάρτη εκεί που είναι το μέρος');
  $('#btnAddPlace').classList.add('is-on');
  OsloMap.pickPoint(ll => {
    $('#btnAddPlace').classList.remove('is-on');
    openAddSheet(ll.lat, ll.lng);
  });
}

function openAddSheet(lat, lng, ed) {
  const opts = Object.entries(CATS)
    .map(([k, c]) => `<option value="${k}" ${ed && ed.cat === k ? 'selected' : ''}>${c.label}</option>`).join('');
  sheet('#placeSheet', `
    <h2 class="sheet-title">${icon(ed ? 'ic-sliders' : 'ic-plus')} ${ed ? 'Επεξεργασία' : 'Νέο μέρος'}</h2>
    <div class="setting"><label>Όνομα *</label>
      <input type="text" id="npName" class="input" placeholder="π.χ. Καφετέρια που είπε ο Γιάννης"
        value="${ed ? (ed.nameEl || ed.name).replace(/"/g,'&quot;') : ''}"></div>
    <div class="setting"><label>Κατηγορία</label><select id="npCat" class="input">${opts}</select></div>
    <div class="setting"><label>Τιμή σε NOK — κενό αν είναι δωρεάν</label>
      <input type="number" id="npCost" class="input" inputmode="decimal" placeholder="0" value="${ed && ed.cost ? ed.cost : ''}"></div>
    <div class="setting"><label>Σημείωση</label>
      <textarea id="npDesc" rows="3" style="font-family:inherit;font-size:13.5px">${ed ? (ed.desc || '') : ''}</textarea></div>
    <div class="setting"><label>Θέση</label><div class="input readonly">${lat.toFixed(5)}, ${lng.toFixed(5)}</div></div>
    <div class="ps-actions">
      <button class="btn primary wide" id="npSave">${icon('ic-check','sm')} Αποθήκευση</button>
      ${ed ? `<button class="btn danger wide" id="npDel">${icon('ic-trash','sm')} Διαγραφή</button>` : ''}
    </div>`);

  $('#npName').focus();
  $('#npSave').addEventListener('click', () => {
    const name = $('#npName').value.trim();
    if (!name) { toast('Βάλε ένα όνομα'); $('#npName').focus(); return; }
    const cost = parseFloat($('#npCost').value) || 0;
    const data = { name, nameEl: name, cat: $('#npCat').value, lat, lng, cost,
      costLabel: cost > 0 ? `${cost} NOK` : 'Δωρεάν', hours: '—',
      desc: $('#npDesc').value.trim() || 'Δικό σου μέρος.', tip: '' };
    if (ed) Store.updateCustom(ed.id, data); else Store.addCustom(data);
    syncCustomIntoPlaces(); closeSheets(); renderGroups(); syncMap();
    toast(ed ? 'Ενημερώθηκε' : 'Προστέθηκε ✓');
  });
  $('#npDel')?.addEventListener('click', () => {
    if (!confirm('Διαγραφή του μέρους;')) return;
    Store.removeCustom(ed.id); syncCustomIntoPlaces();
    closeSheets(); renderGroups(); syncMap(); toast('Διαγράφηκε');
  });
}

/* ════════════ OFFLINE ΧΑΡΤΗΣ ════════════ */
const OSLO_BBOX = { s: 59.855, w: 10.585, n: 60.005, e: 10.905 };
const OFFLINE_ZOOMS = [12, 13, 14, 15, 16];
const _lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const _lat2y = (lat, z) => Math.floor(
  (1 - Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180)) / Math.PI) / 2 * 2 ** z);

function offlineTileList() {
  const urls = [], subs = ['a','b','c','d'];
  const style = document.documentElement.dataset.theme === 'light' ? 'light_all' : 'dark_all';
  OFFLINE_ZOOMS.forEach(z => {
    const x0 = _lon2x(OSLO_BBOX.w, z), x1 = _lon2x(OSLO_BBOX.e, z);
    const y0 = _lat2y(OSLO_BBOX.n, z), y1 = _lat2y(OSLO_BBOX.s, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++)
      urls.push(`https://${subs[(x+y)%4]}.basemaps.cartocdn.com/${style}/${z}/${x}/${y}.png`);
  });
  return urls;
}

async function downloadOfflineMap() {
  if (!location.protocol.startsWith('http')) { toast('Δουλεύει μόνο από το διαδίκτυο'); return; }
  const urls = offlineTileList();
  const btn = $('#btnOffline'), bar = $('#dlBar'), info = $('#dlInfo');
  if (!confirm(`Θα κατέβουν ${urls.length.toLocaleString('el-GR')} πλακίδια (~${Math.round(urls.length*22/1024)} MB).\nΚάν' το με Wi-Fi. Συνέχεια;`)) return;
  btn.disabled = true; bar.hidden = false;
  let done = 0, failed = 0;
  const worker = async () => {
    while (urls.length) {
      const u = urls.pop();
      try { await fetch(u, { mode:'cors', cache:'force-cache' }); } catch { failed++; }
      done++;
      if (done % 15 === 0 || !urls.length) {
        bar.firstElementChild.style.width = (done / (done + urls.length) * 100) + '%';
        info.textContent = `${done.toLocaleString('el-GR')} πλακίδια…`;
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  bar.firstElementChild.style.width = '100%';
  info.innerHTML = failed
    ? `Έτοιμο, με <b>${failed}</b> αποτυχίες. Ξανατρέξ' το με καλύτερο σήμα.`
    : `<b>Έτοιμο.</b> Ο χάρτης δουλεύει τώρα χωρίς ίντερνετ.`;
  btn.disabled = false;
  toast('Ο χάρτης κατέβηκε');
}

/* ════════════ ΕΞΑΓΩΓΗ ΓΙΑ MY MAPS ════════════ */
const _plain = s => String(s || '').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
function exportDesc(p) {
  const b = [_plain(p.desc)];
  if (p.addr)                             b.push('ΔΙΕΥΘΥΝΣΗ: ' + p.addr);
  if (p.costLabel && p.costLabel !== '—') b.push('ΚΟΣΤΟΣ: ' + p.costLabel);
  if (p.hours && p.hours !== '—')         b.push('ΩΡΑΡΙΟ: ' + p.hours);
  if (p.tip)                              b.push('ΚΟΛΠΟ: ' + _plain(p.tip));
  if (p.gem)                              b.push('★ Διαμάντι');
  if (p.from)                             b.push('Πρόταση από τη συνάδελφο');
  if (p.approx)                           b.push('(Το σημείο είναι κατά προσέγγιση)');
  return b.join(' — ');
}
function download(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function exportCsv() {
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  const rows = [['Όνομα','Latitude','Longitude','Κατηγορία','Κόστος','Ωράριο','Περιγραφή']]
    .concat(PLACES.map(p => [p.nameEl || p.name, p.lat, p.lng, CATS[p.cat].label,
                             p.costLabel || '', p.hours || '', exportDesc(p)]));
  download('oslo-ola-ta-meri.csv', '﻿' + rows.map(r => r.map(q).join(',')).join('\n'), 'text/csv');
  toast('Κατέβηκε το CSV');
}
function exportKml() {
  const e = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const ICON = { sight:'ylw-pushpin', museum:'purple-pushpin', food:'red-pushpin', bar:'ylw-pushpin',
    cafe:'wht-pushpin', nature:'grn-pushpin', beach:'ltblu-pushpin', sauna:'pink-pushpin',
    shop:'wht-pushpin', transport:'blu-pushpin' };
  let k = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>\n<name>Oslo 2026</name>\n`;
  Object.keys(CATS).forEach(c => {
    k += `<Style id="s-${c}"><IconStyle><Icon><href>https://maps.google.com/mapfiles/kml/pushpin/${ICON[c]}.png</href></Icon></IconStyle></Style>\n`;
  });
  Object.entries(CATS).forEach(([c, cat]) => {
    const list = PLACES.filter(p => p.cat === c);
    if (!list.length) return;
    k += `<Folder><name>${e(cat.label)}</name>\n`;
    list.forEach(p => {
      k += `<Placemark><name>${e(p.nameEl || p.name)}</name><description>${e(exportDesc(p))}</description>`
         + `<styleUrl>#s-${c}</styleUrl><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>\n`;
    });
    k += `</Folder>\n`;
  });
  k += `</Document></kml>\n`;
  download('oslo-2026.kml', k, 'application/vnd.google-earth.kml+xml');
  toast('Κατέβηκε το KML');
}

/* ════════════ ΡΥΘΜΙΣΕΙΣ ════════════ */
function initSettings() {
  $('#btnSettings').addEventListener('click', () => {
    $$('#setWho .seg').forEach(b => b.classList.toggle('is-on', b.dataset.who === Store.who));
    $$('#setTheme .seg').forEach(b => b.classList.toggle('is-on', b.dataset.theme === Store.theme));
    $('#setRate').value = Store.rate;
    $('#rateLbl').textContent = Store.rate;
    $('#setConf').value = Store.conf;
    sheet('#settingsSheet');
  });

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
    renderGroups(); renderDay(); renderTrips(); renderInfo(); OsloMap.refreshAllPins();
  });
  $('#setConf').addEventListener('input', e => { Store.setConf(e.target.value); renderInfo(); });

  $('#btnOffline').addEventListener('click', downloadOfflineMap);
  $('#btnExportKml').addEventListener('click', exportKml);
  $('#btnExportCsv').addEventListener('click', exportCsv);

  $('#btnExport').addEventListener('click', async () => {
    const code = Store.export();
    $('#syncBox').value = code;
    try { await navigator.clipboard.writeText(code); toast('Αντιγράφηκε — στείλ\' το!'); }
    catch { $('#syncBox').select(); toast('Αντίγραψέ το από το πλαίσιο'); }
  });
  $('#btnImport').addEventListener('click', () => {
    const code = $('#syncBox').value.trim();
    if (!code) { toast('Επικόλλησε πρώτα τον κωδικό'); return; }
    // Η εισαγωγή ΑΝΤΙΚΑΘΙΣΤΑ — δεν συγχωνεύει. Να το ξέρει πριν, όχι μετά.
    const mine = Store.visitedCount + Store.custom.length + Store.expenses.length;
    if (mine && !confirm(
      `Προσοχή: θα ΑΝΤΙΚΑΤΑΣΤΑΘΟΥΝ τα δικά σου δεδομένα ` +
      `(${Store.visitedCount} τικ, ${Store.custom.length} δικά σου μέρη).\n\n` +
      `Δεν συγχωνεύονται — ό,τι έχεις εσύ και δεν έχει ο άλλος, χάνεται.\n\nΣυνέχεια;`)) return;
    if (Store.import(code)) { closeSheets(); renderAll(); toast('Συγχρονίστηκε ✓'); }
    else toast('Ο κωδικός δεν είναι έγκυρος');
  });
  $('#btnResetPlan').addEventListener('click', () => {
    if (!confirm('Επαναφορά του αρχικού προγράμματος;')) return;
    Store.resetPlan(); closeSheets(); renderDaystrip(); renderDay(); toast('Επαναφέρθηκε');
  });
  $('#btnWipe').addEventListener('click', () => {
    if (!confirm('Σβήσιμο ΟΛΩΝ των δεδομένων σου; Δεν αναιρείται.')) return;
    Store.wipe(); closeSheets(); renderAll(); toast('Καθαρίστηκε');
  });

  $('#backdrop').addEventListener('click', closeSheets);
  addEventListener('keydown', e => { if (e.key === 'Escape') closeSheets(); });
}

/* ════════════ BOOT ════════════ */
function renderAll() {
  syncCustomIntoPlaces();
  applyTheme(); renderTop();
  renderDaystrip(); renderDay();
  renderGroups(); syncMap();
  renderTrips(); renderInfo();
}

function boot() {
  syncCustomIntoPlaces();
  applyTheme();
  initTabs();
  initExplore();
  renderDaystrip(); renderDay();
  renderTrips(); renderInfo();
  initSettings();
  renderTop();

  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (Store.theme === 'auto') applyTheme();
  });

  const h = location.hash.slice(1);
  if (h && TABS.includes(h)) go(h, true);
  addEventListener('hashchange', () => {
    const x = location.hash.slice(1);
    if (TABS.includes(x) && x !== UI.tab) go(x, true);
  });

  const splash = $('#splash');
  const kill = () => { splash.classList.add('gone'); setTimeout(() => splash.remove(), 700); };
  setTimeout(kill, 600);
  addEventListener('load', () => setTimeout(kill, 100));

  if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', boot);
