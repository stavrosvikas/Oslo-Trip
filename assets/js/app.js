/* ════════════════════════════════════════════════════════════
   OSLO — δύο οθόνες: Μέρη (χάρτης + λίστα) και Πρόγραμμα.
   Χωρίς ρυθμίσεις, χωρίς χρήστες, χωρίς τίποτα άλλο.
   ════════════════════════════════════════════════════════════ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const P  = id => PLACES.find(p => p.id === id);
const ic = (n, c = '') => `<svg class="ic ${c}"><use href="#${n}"/></svg>`;

const UI = {
  tab: 'places',
  q: '',
  open: new Set(['sight', 'food', 'bar']),
  hidden: new Set(),
  day: 0,
  big: false
};

/* ── ημερομηνίες ── */
const DOW = ['ΚΥΡ','ΔΕΥ','ΤΡΙ','ΤΕΤ','ΠΕΜ','ΠΑΡ','ΣΑΒ'];
const MON = ['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];
const DOWF = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
const MONF = ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου',
              'Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου'];

const DAYS = (() => {
  const out = [];
  const a = new Date(TRIP.start + 'T12:00:00'), b = new Date(TRIP.end + 'T12:00:00');
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    out.push({ dow: DOW[d.getDay()], dowF: DOWF[d.getDay()], num: d.getDate(),
               mon: MON[d.getMonth()], monF: MONF[d.getMonth()],
               iso: d.toISOString().slice(0, 10) });
  }
  return out;
})();

/* ── σύνδεσμοι Google Maps: χωρίς αφετηρία, ξεκινά από εκεί που είσαι ── */
const gq = p => p.approx ? encodeURIComponent(`${p.name}, Oslo`) : `${p.lat},${p.lng}`;
const gmap = p => `https://www.google.com/maps/search/?api=1&query=${gq(p)}`;
const gnav = p => `https://www.google.com/maps/dir/?api=1&destination=${gq(p)}&travelmode=transit`;

let tT = null;
function toast(m) {
  const el = $('#toast');
  el.textContent = m; el.hidden = false; el.classList.remove('out');
  clearTimeout(tT);
  tT = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.hidden = true, 260); }, 1800);
}

/* ════════════ TABS ════════════ */
function go(t) {
  UI.tab = t;
  $$('#tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + t));
  if (t === 'places') OsloMap.invalidate(); else scrollTo({ top: 0 });
  if (t === 'plan') { renderDays(); renderDay(); }
}

/* ════════════ ΜΕΡΗ ════════════ */
function match(p) {
  const q = UI.q.trim().toLowerCase();
  if (!q) return true;
  return (p.nameEl || '').toLowerCase().includes(q)
      || p.name.toLowerCase().includes(q)
      || (p.desc || '').toLowerCase().includes(q);
}

function renderGroups() {
  const q = UI.q.trim();
  const gs = Object.entries(CATS)
    .map(([k, c]) => [k, c, PLACES.filter(p => p.cat === k && match(p))])
    .filter(([, , l]) => l.length);

  const box = $('#groups');

  if (!gs.length) {
    box.innerHTML = `<div class="none">${ic('ic-search')}
      <p>Δεν το έχουμε στη λίστα.</p>
      ${q ? `<a class="btn pri" style="margin-top:14px" target="_blank" rel="noopener"
        href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q + ' Oslo')}">
        ${ic('ic-external','s')} Ψάξ' το στο Google Maps</a>` : ''}</div>`;
    return;
  }

  box.innerHTML = gs.map(([k, c, l]) => {
    const open = q ? true : UI.open.has(k);
    const off = UI.hidden.has(k);
    const done = l.filter(p => Store.isVisited(p.id)).length;
    return `<section class="grp ${open ? 'open' : ''} ${off ? 'off' : ''}">
      <div class="gh">
        <button class="gmain" data-g="${k}">
          <span class="gic" style="background:${c.raw}22;color:${c.raw}">${ic(c.icon)}</span>
          <span class="gt">${c.label}</span>
          <span class="gn">${done}/${l.length}</span>
          ${ic('ic-chevron-down','chev')}
        </button>
        <button class="geye" data-e="${k}" aria-label="${off ? 'Δείξ’ τα' : 'Κρύψ’ τα'}">
          ${ic(off ? 'ic-eye-off' : 'ic-eye')}
        </button>
      </div>
      <div class="gitems">${l.map(row).join('')}</div>
    </section>`;
  }).join('');

  wire();
}

function row(p) {
  const d = Store.isVisited(p.id);
  const day = Store.dayOf(p.id);
  return `<div class="row ${d ? 'done' : ''}">
    <button class="rtick ${d ? 'on' : ''}" data-k="${p.id}" aria-label="Έγινε">${ic('ic-check')}</button>
    <button class="rb" data-p="${p.id}">
      <span class="rn">${p.nameEl || p.name}${p.gem ? ic('ic-star','st') : ''}</span>
      <span class="rs">${money(p.costLabel || '')}</span>
    </button>
    ${day !== null ? `<span class="rday">${DAYS[day].dow} ${DAYS[day].num}</span>` : ''}
    <button class="rnav" data-n="${p.id}" aria-label="Πλοήγηση">${ic('ic-navigation')}</button>
  </div>`;
}

function wire() {
  $$('#groups [data-g]').forEach(b => b.onclick = () => {
    const k = b.dataset.g;
    UI.open.has(k) ? UI.open.delete(k) : UI.open.add(k);
    renderGroups();
  });
  $$('#groups [data-e]').forEach(b => b.onclick = () => {
    const k = b.dataset.e;
    UI.hidden.has(k) ? UI.hidden.delete(k) : UI.hidden.add(k);
    renderGroups(); sync();
  });
  $$('#groups [data-k]').forEach(b => b.onclick = () => {
    Store.toggleVisited(b.dataset.k);
    OsloMap.refresh(b.dataset.k);
    renderGroups(); head();
  });
  $$('#groups [data-n]').forEach(b => b.onclick = () => {
    const p = P(b.dataset.n);
    if (p) open(gnav(p));
  });
  $$('#groups [data-p]').forEach(b => b.onclick = () => {
    const id = b.dataset.p;
    if (UI.hidden.has(P(id).cat)) { UI.hidden.delete(P(id).cat); renderGroups(); sync(); }
    OsloMap.flyTo(id);
    setTimeout(() => card(id), 700);
  });
}

const open = u => window.open(u, '_blank', 'noopener');
const sync = () => OsloMap.build(p => !UI.hidden.has(p.cat) && match(p));

function head() {
  $('#count').textContent = `${Store.visitedCount}/${PLACES.length} · ${Store.planCount} στο πρόγραμμα`;
}

/* ════════════ ΚΑΡΤΑ ════════════ */
function sheet(html) {
  const c = $('#card');
  $('#cardin').innerHTML = html;
  c.style.transform = '';
  c.hidden = false;
  $('#veil').hidden = false;
  document.body.classList.add('locked');
  c.scrollTop = 0;
}

function shut() {
  const c = $('#card');
  c.hidden = true;
  c.style.transform = '';
  c.classList.remove('dragging');
  $('#veil').hidden = true;
  document.body.classList.remove('locked');
}

/* Σύρσιμο της κάρτας προς τα κάτω για κλείσιμο.
   Η λαβή έχει touch-action:none, οπότε η κίνηση ΔΕΝ φεύγει στον browser
   και δεν γίνεται pull-to-refresh — αυτό ήταν το πρόβλημα. */
function cardDrag() {
  const c = $('#card'), z = $('#grabzone');
  let y0 = 0, dy = 0, t0 = 0, on = false;

  z.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    on = true; y0 = e.clientY; dy = 0; t0 = Date.now();
    c.classList.add('dragging');
    try { z.setPointerCapture(e.pointerId); } catch (_) {}
  });

  z.addEventListener('pointermove', e => {
    if (!on) return;
    e.preventDefault();
    dy = Math.max(0, e.clientY - y0);          // μόνο προς τα κάτω
    c.style.transform = `translateY(${dy}px)`;
  });

  const end = () => {
    if (!on) return;
    on = false;
    c.classList.remove('dragging');
    const fast = dy > 40 && (Date.now() - t0) < 300;
    if (dy > c.getBoundingClientRect().height * 0.3 || fast) {
      c.style.transform = `translateY(100%)`;
      setTimeout(shut, 180);
    } else {
      c.style.transform = '';                  // επιστροφή στη θέση της
    }
  };
  z.addEventListener('pointerup', end);
  z.addEventListener('pointercancel', end);
}

function card(id) {
  const p = P(id);
  if (!p) return;
  const c = CATS[p.cat];
  const done = Store.isVisited(id);
  const day = Store.dayOf(id);

  sheet(`
    <div class="chero">
      <div class="cico" style="background:${c.raw}22;color:${c.raw}">${ic(c.icon)}</div>
      <div>
        <div class="ccat" style="color:${c.raw}">${c.label}${p.gem ? ' · ★ Διαμάντι' : ''}</div>
        <div class="ctitle">${p.nameEl || p.name}</div>
        ${p.nameEl && p.nameEl !== p.name ? `<div class="calt">${p.name}</div>` : ''}
      </div>
    </div>
    <p class="cdesc">${p.desc}${p.from ? `<em class="src">Πρόταση από τη συνάδελφο.</em>` : ''}</p>
    <div class="facts">
      <div class="fact">${ic('ic-wallet')}<div><b>Κόστος</b><span>${money(p.costLabel)}</span></div></div>
      ${p.hours && p.hours !== '—' ? `<div class="fact">${ic('ic-clock')}<div><b>Ωράριο</b><span>${p.hours}</span></div></div>` : ''}
      ${p.addr ? `<div class="fact">${ic('ic-pin')}<div><b>Διεύθυνση</b><span>${p.addr}</span></div></div>` : ''}
    </div>
    ${p.tip ? `<div class="tip"><b>Το κόλπο</b>${money(p.tip)}</div>` : ''}
    ${p.approx ? `<div class="warn">Το pin είναι κατά προσέγγιση. Τα κουμπιά παρακάτω ψάχνουν το όνομα στο Google Maps, οπότε σε πάνε σωστά.</div>` : ''}
    <div class="btns">
      <a class="btn pri" href="${gnav(p)}" target="_blank" rel="noopener">${ic('ic-navigation','s')} Οδηγίες</a>
      <a class="btn" href="${gmap(p)}" target="_blank" rel="noopener">${ic('ic-external','s')} Google Maps</a>
      <button class="btn wide ${done ? 'pri' : ''}" id="cTick">${ic('ic-check','s')} ${done ? 'Το είδαμε ✓' : 'Σημείωσε ως είδαμε'}</button>
      <button class="btn wide" id="cAdd">${ic('ic-calendar','s')} ${day !== null ? `Είναι στη ${DAYS[day].dow} ${DAYS[day].num} — άλλαξε μέρα` : 'Βάλ’ το στο πρόγραμμα'}</button>
      ${p.custom ? `<button class="btn del wide" id="cDel">${ic('ic-trash','s')} Διαγραφή</button>` : ''}
    </div>`);

  $('#cTick').onclick = () => {
    Store.toggleVisited(id); OsloMap.refresh(id);
    shut(); renderGroups(); head();
  };
  $('#cAdd').onclick = () => pickDay(id);
  if ($('#cDel')) $('#cDel').onclick = () => {
    if (!confirm('Διαγραφή του μέρους;')) return;
    Store.removeCustom(id);
    PLACES.splice(PLACES.findIndex(x => x.id === id), 1);
    shut(); renderGroups(); sync(); head();
    toast('Διαγράφηκε');
  };
}

function pickDay(id) {
  const p = P(id);
  const cur = Store.dayOf(id);
  sheet(`
    <div class="ctitle" style="margin-bottom:4px">Σε ποια μέρα;</div>
    <p class="cdesc">${p.nameEl || p.name}</p>
    <div class="pick">
      ${DAYS.map((d, i) => `<button class="pickday ${i === cur ? 'has' : ''}" data-d="${i}">
        <b>${d.dowF} ${d.num} ${d.mon}</b>
        <s>${Store.day(i).length ? Store.day(i).length + ' μέρη' : 'άδεια'}</s>
        ${i === cur ? ic('ic-check') : ''}
      </button>`).join('')}
      ${cur !== null ? `<button class="btn del wide" id="cOut">${ic('ic-x','s')} Βγάλ’ το από το πρόγραμμα</button>` : ''}
    </div>`);

  $$('#card [data-d]').forEach(b => b.onclick = () => {
    const i = +b.dataset.d;
    if (cur !== null) Store.removeFromDay(cur, id);
    Store.addToDay(i, id);
    shut(); renderGroups(); head();
    toast(`Μπήκε στη ${DAYS[i].dowF} ${DAYS[i].num}`);
  });
  if ($('#cOut')) $('#cOut').onclick = () => {
    Store.removeFromDay(cur, id);
    shut(); renderGroups(); head();
    toast('Βγήκε από το πρόγραμμα');
  };
}

function zone(d) {
  sheet(`
    <div class="chero">
      <div class="cico" style="background:#FCF3E8;color:var(--warn)">${ic('ic-alert')}</div>
      <div>
        <div class="ccat" style="color:var(--warn)">Ζώνη προσοχής</div>
        <div class="ctitle">${d.name}</div>
      </div>
    </div>
    <p class="cdesc">${d.why}</p>
    <div class="facts">
      <div class="fact">${ic('ic-clock')}<div><b>Πότε</b><span>${d.when}</span></div></div>
    </div>
    <div class="tip"><b>Με το μάτι</b>Το Όσλο είναι από τις ασφαλέστερες πρωτεύουσες της Ευρώπης.
      Αυτό είναι «έχε τα μάτια σου ανοιχτά», όχι «μην πας».</div>`);
}

/* ════════════ ΝΕΟ ΜΕΡΟΣ ════════════ */
function addPlace() {
  go('places');
  $('#bAdd').classList.add('on');
  toast('Πάτα στον χάρτη εκεί που είναι');
  OsloMap.pickPoint(ll => {
    $('#bAdd').classList.remove('on');
    sheet(`
      <div class="ctitle" style="margin-bottom:10px">Νέο μέρος</div>
      <label class="lbl">Όνομα</label>
      <div class="fld inp"><input id="nN" class="inp" placeholder="π.χ. Καφετέρια που είπε ο Γιάννης"></div>
      <label class="lbl">Κατηγορία</label>
      <select id="nC" class="inp">${Object.entries(CATS).map(([k, c]) => `<option value="${k}">${c.label}</option>`).join('')}</select>
      <label class="lbl">Τιμή σε NOK — κενό αν είναι δωρεάν</label>
      <input id="nP" class="inp" type="number" inputmode="decimal" placeholder="0">
      <label class="lbl">Σημείωση</label>
      <textarea id="nD" class="inp" rows="3"></textarea>
      <div class="btns" style="margin-top:16px">
        <button class="btn pri wide" id="nS">${ic('ic-check','s')} Αποθήκευση</button>
      </div>`);
    $('#nN').focus();
    $('#nS').onclick = () => {
      const name = $('#nN').value.trim();
      if (!name) { toast('Βάλε ένα όνομα'); return; }
      const cost = parseFloat($('#nP').value) || 0;
      const rec = Store.addCustom({
        name, nameEl: name, cat: $('#nC').value,
        lat: ll.lat, lng: ll.lng, cost,
        costLabel: cost > 0 ? `${cost} NOK` : 'Δωρεάν',
        hours: '—', desc: $('#nD').value.trim() || 'Δικό σου μέρος.', tip: ''
      });
      PLACES.push(rec);
      shut(); renderGroups(); sync(); head();
      toast('Προστέθηκε ✓');
    };
  });
}

/* ════════════ ΠΡΟΓΡΑΜΜΑ ════════════ */
function renderDays() {
  $('#days').innerHTML = DAYS.map((d, i) => {
    const n = Store.day(i).length;
    return `<button class="day ${i === UI.day ? 'on' : ''}" data-i="${i}">
      <b>${d.dow}</b><u>${d.num}</u><s>${d.mon}</s>
      <em>${n ? n + ' μέρη' : '—'}</em>
    </button>`;
  }).join('');
  $$('#days .day').forEach(b => b.onclick = () => {
    UI.day = +b.dataset.i;
    renderDays(); renderDay();
    b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });
}

function renderDay() {
  const d = DAYS[UI.day];
  const ids = Store.day(UI.day);

  const list = ids.length
    ? `<div class="stops" id="stops">${ids.map((id, k) => stop(id, k)).join('')}</div>`
    : `<div class="none">${ic('ic-calendar')}
        <p><b>Άδεια μέρα.</b></p>
        <p>Πήγαινε στα <b>Μέρη</b>, άνοιξε ό,τι σου αρέσει και πάτα<br>«Βάλ' το στο πρόγραμμα».</p>
       </div>`;

  $('#daybox').innerHTML =
    `<div class="dhead">${d.dowF} ${d.num} ${d.monF}
      <span>${ids.length ? ids.length + ' στάσεις · σύρε τη λαβή για σειρά' : 'Δεν έχεις βάλει τίποτα ακόμα'}</span>
    </div>` + list;

  $$('#daybox [data-o]').forEach(b => b.onclick = () => card(b.dataset.o));
  $$('#daybox [data-x]').forEach(b => b.onclick = () => {
    Store.removeFromDay(UI.day, b.dataset.x);
    renderDays(); renderDay(); renderGroups(); head();
    toast('Αφαιρέθηκε');
  });
  if (ids.length > 1) sortable($('#stops'));
}

function stop(id, k) {
  const p = P(id);
  if (!p) return '';
  const c = CATS[p.cat];
  return `<div class="stop" data-k="${k}">
    <div class="hnd">${ic('ic-grip')}</div>
    <div class="sic" style="background:${c.raw}22;color:${c.raw}">${ic(c.icon)}</div>
    <button class="sb" data-o="${id}">
      <div class="sn">${p.nameEl || p.name}</div>
      <div class="ss">${money(p.costLabel || '')}</div>
    </button>
    <button class="sdel" data-x="${id}" aria-label="Αφαίρεση">${ic('ic-x')}</button>
  </div>`;
}

/* Αναδιάταξη με Pointer Events — δουλεύει με δάχτυλο ΚΑΙ με ποντίκι.
   (Το HTML5 drag-and-drop δεν ενεργοποιείται καθόλου με αφή.) */
function sortable(box) {
  if (!box) return;
  let el = null;
  box.querySelectorAll('.stop').forEach(s => {
    const h = s.querySelector('.hnd');
    h.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      e.preventDefault();
      el = s;
      s.classList.add('drag');
      s.style.height = s.getBoundingClientRect().height + 'px';
      document.body.classList.add('sorting');
      try { h.setPointerCapture(e.pointerId); } catch (_) {}
    });
    h.addEventListener('pointermove', e => {
      if (!el) return;
      e.preventDefault();
      const y = e.clientY;
      const others = [...box.querySelectorAll('.stop:not(.drag)')];
      const before = others.find(o => {
        const r = o.getBoundingClientRect();
        return y < r.top + r.height / 2;
      });
      before ? box.insertBefore(el, before) : box.appendChild(el);
      if (y < 90) scrollBy(0, -12);
      else if (y > innerHeight - 90) scrollBy(0, 12);
    });
    const end = () => {
      if (!el) return;
      el.classList.remove('drag');
      el.style.height = '';
      document.body.classList.remove('sorting');
      const was = Store.day(UI.day);
      const order = [...box.querySelectorAll('.stop')].map(x => was[+x.dataset.k]);
      el = null;
      Store.setDay(UI.day, order);
      renderDay();
    };
    h.addEventListener('pointerup', end);
    h.addEventListener('pointercancel', end);
  });
}

/* ════════════ ΧΑΡΤΗΣ OFFLINE ════════════
   Ο service worker κρατάει όποιο πλακίδιο ζητηθεί. Οπότε για να
   δουλεύει ο χάρτης χωρίς σήμα, τα ζητάμε όλα μία φορά. */
/* Στενά γύρω από τα μέρη που θα περπατήσεις: 1.813 πλακίδια, ~39 MB.
   Το πλατύ τετράγωνο έβγαζε 4.562 πλακίδια και 98 MB για την ίδια χρησιμότητα. */
const BBOX = { s: 59.860, w: 10.646, n: 59.993, e: 10.793 };
const ZOOMS = [12, 13, 14, 15, 16];
const x2 = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const y2 = (lat, z) => Math.floor(
  (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z);

function tiles() {
  const out = [], sub = ['a', 'b', 'c', 'd'];
  ZOOMS.forEach(z => {
    for (let x = x2(BBOX.w, z); x <= x2(BBOX.e, z); x++)
      for (let y = y2(BBOX.n, z); y <= y2(BBOX.s, z); y++)
        out.push(`https://${sub[(x + y) % 4]}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`);
  });
  return out;
}

function offline() {
  if (!location.protocol.startsWith('http')) { toast('Δουλεύει μόνο από το διαδίκτυο'); return; }
  const list = tiles();
  sheet(`
    <div class="ctitle" style="margin-bottom:6px">Χάρτης χωρίς σήμα</div>
    <p class="cdesc">Κατεβάζει όλο το Όσλο στη συσκευή, ώστε ο χάρτης να δουλεύει
      και χωρίς ίντερνετ. <b>${list.length.toLocaleString('el-GR')} πλακίδια, ~${Math.round(list.length * 22 / 1024)} MB.</b>
      Κάν' το με Wi-Fi.</p>
    <div class="prog" id="pg" hidden><i></i></div>
    <p class="cdesc" id="pgt"></p>
    <div class="btns"><button class="btn pri wide" id="pgo">${ic('ic-download','s')} Ξεκίνα</button></div>`);

  $('#pgo').onclick = async () => {
    const btn = $('#pgo'), bar = $('#pg'), txt = $('#pgt');
    btn.disabled = true; bar.hidden = false;
    let done = 0, bad = 0;
    const work = async () => {
      while (list.length) {
        const u = list.pop();
        try { await fetch(u, { mode: 'cors', cache: 'force-cache' }); } catch { bad++; }
        done++;
        if (done % 20 === 0 || !list.length) {
          bar.firstElementChild.style.width = (done / (done + list.length) * 100) + '%';
          txt.textContent = done.toLocaleString('el-GR') + ' πλακίδια…';
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, work));
    bar.firstElementChild.style.width = '100%';
    txt.innerHTML = bad
      ? `Έτοιμο, με <b>${bad}</b> αποτυχίες. Ξανατρέξ' το με καλύτερο σήμα.`
      : `<b>Έτοιμο.</b> Ο χάρτης δουλεύει τώρα χωρίς ίντερνετ.`;
    btn.disabled = false; btn.textContent = 'Κλείσιμο';
    btn.onclick = shut;
  };
}

/* ════════════ BOOT ════════════ */
function boot() {
  Store.custom.forEach(c => { if (!P(c.id)) PLACES.push(c); });

  OsloMap.init({ onSelect: card, onZone: zone });

  $$('#tabs .tab').forEach(b => b.onclick = () => go(b.dataset.t));
  $('#q').oninput = e => { UI.q = e.target.value; renderGroups(); sync(); };
  $('#bAdd').onclick = addPlace;
  $('#bOff').onclick = offline;
  $('#bMe').onclick = () => {
    toast('Εντοπισμός…');
    OsloMap.locate().then(() => toast('Σε βρήκα')).catch(() => toast('Δεν βρέθηκε η θέση σου'));
  };
  $('#bGrow').onclick = () => {
    UI.big = !UI.big;
    $('#split').classList.toggle('big', UI.big);
    OsloMap.invalidate();
  };
  $('#veil').onclick = shut;
  $('#cardx').onclick = shut;
  cardDrag();
  addEventListener('keydown', e => { if (e.key === 'Escape') shut(); });

  renderGroups();
  renderDays();
  renderDay();
  head();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', boot);
