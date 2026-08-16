/* ════════════════════════════════════════════════════════════
   MAP — Leaflet, custom pins, ζώνες προσοχής, διαδρομή ημέρας
   ════════════════════════════════════════════════════════════ */

const OsloMap = (() => {
  let map = null;
  let layerPins = null, layerDanger = null, layerRoute = null;
  let homeMarker = null, meMarker = null;
  const markers = {};                 // placeId -> marker
  let basemapIdx = 0;
  let tileLayer = null;
  let placingHome = false;
  let onSelect = () => {};

  const BASEMAPS = [
    { name:'dark',  url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
    { name:'light', url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
    { name:'voyager', url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' },
    { name:'osm', url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }
  ];
  const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

  /* ── εικονίδιο pin ── */
  function pinIcon(place, opts = {}) {
    const c = CATS[place.cat];
    const done = Store.isVisited(place.id);
    const big = opts.big || place.gem;
    return L.divIcon({
      className: 'pin-wrap',
      html: `<div class="pin ${done ? 'done' : ''} ${big ? 'big' : ''}" style="background:${c.raw}">
               <svg class="ic"><use href="#${c.icon}"/></svg>
               ${done ? '<span class="pin-check"><svg class="ic"><use href="#ic-check"/></svg></span>' : ''}
             </div>`,
      iconSize: big ? [40, 40] : [32, 32],
      iconAnchor: big ? [20, 38] : [16, 30],
      popupAnchor: [0, big ? -34 : -28]
    });
  }

  function popupHtml(p) {
    const c = CATS[p.cat];
    const done = Store.isVisited(p.id);
    return `<div class="pop">
      <div class="pop-cat" style="color:${c.raw}">${c.label}</div>
      <div class="pop-t">${p.nameEl || p.name}</div>
      <div class="pop-d">${(p.desc || '').slice(0, 130)}${(p.desc || '').length > 130 ? '…' : ''}</div>
      <div class="pop-meta">
        <span class="pill ${p.cost === 0 ? 'ok' : 'gold'}">${money(p.costLabel || '')}</span>
      </div>
      <div class="pop-btns">
        <button class="btn sm" data-pop-detail="${p.id}">Λεπτομέρειες</button>
        <button class="btn sm ${done ? 'primary' : ''}" data-pop-tick="${p.id}">${done ? '✓ Έγινε' : 'Τικ'}</button>
      </div>
    </div>`;
  }

  /* ── init ── */
  function init(handlers = {}) {
    if (map) return map;
    onSelect = handlers.onSelect || onSelect;

    map = L.map('map', {
      center: [Store.home.lat, Store.home.lng],
      zoom: 13,
      zoomControl: false,       // έχουμε δικά μας εργαλεία πάνω δεξιά
      attributionControl: true,
      preferCanvas: false
    });

    basemapIdx = (Store.theme === 'light') ? 1 : 0;
    tileLayer = L.tileLayer(BASEMAPS[basemapIdx].url, {
      attribution: ATTR, maxZoom: 19, subdomains: 'abcd'
    }).addTo(map);

    layerDanger = L.layerGroup().addTo(map);
    layerRoute  = L.layerGroup().addTo(map);

    if (window.L && L.markerClusterGroup) {
      layerPins = L.markerClusterGroup({
        maxClusterRadius: 42,
        showCoverageOnHover: false,
        spiderfyDistanceMultiplier: 1.4,
        iconCreateFunction: cl => L.divIcon({
          html: `<div class="mcluster" style="width:38px;height:38px">${cl.getChildCount()}</div>`,
          className: 'pin-wrap', iconSize: [38, 38]
        })
      }).addTo(map);
    } else {
      layerPins = L.layerGroup().addTo(map);
    }

    buildPins();
    buildDanger();
    buildHome();

    map.on('click', e => {
      if (!placingHome) return;
      Store.setHome(e.latlng.lat, e.latlng.lng);
      placingHome = false;
      document.getElementById('map').style.cursor = '';
      buildHome();
      handlers.onHomeMoved && handlers.onHomeMoved();
    });

    map.on('popupopen', e => {
      const el = e.popup.getElement();
      if (!el) return;
      el.querySelector('[data-pop-detail]')?.addEventListener('click', ev => {
        onSelect(ev.currentTarget.dataset.popDetail);
        map.closePopup();
      });
      el.querySelector('[data-pop-tick]')?.addEventListener('click', ev => {
        const id = ev.currentTarget.dataset.popTick;
        Store.toggleVisited(id);
        refreshPin(id);
        map.closePopup();
        handlers.onTick && handlers.onTick(id);
      });
    });

    setTimeout(() => map.invalidateSize(), 220);
    return map;
  }

  /* ── pins ── */
  function buildPins(filter = null) {
    layerPins.clearLayers();
    for (const k in markers) delete markers[k];

    PLACES.forEach(p => {
      if (filter && !filter(p)) return;
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(p), title: p.nameEl || p.name });
      m.bindPopup(popupHtml(p), { maxWidth: 260, closeButton: true, autoPanPadding: [30, 60] });
      m._placeId = p.id;
      markers[p.id] = m;
      layerPins.addLayer(m);
    });
  }

  function refreshPin(id) {
    const p = PLACES.find(x => x.id === id);
    const m = markers[id];
    if (!p || !m) return;
    m.setIcon(pinIcon(p));
    m.setPopupContent(popupHtml(p));
  }

  function refreshAllPins() {
    Object.keys(markers).forEach(refreshPin);
  }

  /* ── ζώνες προσοχής ── */
  function buildDanger() {
    layerDanger.clearLayers();
    const colors = { low:'#F5B841', med:'#F59E4B', high:'#F2695E' };
    DANGER.forEach(d => {
      const col = colors[d.level] || colors.low;
      L.circle([d.lat, d.lng], {
        radius: d.r, color: col, weight: 1.5, opacity: .65,
        fillColor: col, fillOpacity: .11, dashArray: '5 5', interactive: true
      }).bindPopup(`<div class="pop">
          <div class="pop-cat" style="color:${col}">Ζώνη προσοχής</div>
          <div class="pop-t">${d.name}</div>
          <div class="pop-d">${d.why}</div>
          <div class="pop-meta"><span class="pill warn">${d.when}</span></div>
        </div>`, { maxWidth: 260 }).addTo(layerDanger);

      // Μόνο διακριτικό σήμα — το όνομα βγαίνει με κλικ, αλλιώς στοιβάζονται μεταξύ τους
      L.marker([d.lat, d.lng], {
        icon: L.divIcon({
          className: 'pin-wrap',
          html: `<div class="danger-badge" style="border-color:${col};color:${col}"
                      title="${d.name}">
                   <svg class="ic"><use href="#ic-alert"/></svg></div>`,
          iconSize: [24, 24], iconAnchor: [12, 12]
        }),
        zIndexOffset: -200
      }).bindPopup(`<div class="pop">
          <div class="pop-cat" style="color:${col}">Ζώνη προσοχής</div>
          <div class="pop-t">${d.name}</div>
          <div class="pop-d">${d.why}</div>
          <div class="pop-meta"><span class="pill warn">${d.when}</span></div>
        </div>`, { maxWidth: 260 }).addTo(layerDanger);
    });
  }

  /* ── σπίτι ── */
  function buildHome() {
    if (homeMarker) { map.removeLayer(homeMarker); homeMarker = null; }
    const h = Store.home;
    homeMarker = L.marker([h.lat, h.lng], {
      icon: L.divIcon({
        className:'pin-wrap',
        html:`<div class="pin big" style="background:#FF4D6D;border-color:#fff">
                <svg class="ic"><use href="#ic-home"/></svg></div>`,
        iconSize:[40,40], iconAnchor:[20,38], popupAnchor:[0,-34]
      }),
      zIndexOffset: 1000
    }).bindPopup(`<div class="pop">
        <div class="pop-cat" style="color:#FF4D6D">Η βάση μας</div>
        <div class="pop-t">${Store.addr}</div>
        <div class="pop-d">Από εδώ ξεκινάνε και εδώ τελειώνουν όλες οι μέρες.</div>
        <div class="pop-btns">
          <button class="btn sm" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}&travelmode=transit','_blank')">Οδηγίες</button>
        </div>
      </div>`, { maxWidth: 250 }).addTo(map);
  }

  function startPlacingHome() {
    placingHome = true;
    document.getElementById('map').style.cursor = 'crosshair';
  }

  /* ── διαδρομή ημέρας ── */
  function drawRoute(stopIds) {
    layerRoute.clearLayers();
    if (!stopIds || stopIds.length < 2) return;
    const pts = stopIds
      .map(id => id === 'HOME' ? [Store.home.lat, Store.home.lng]
                : (PLACES.find(p => p.id === id) || null))
      .map(x => Array.isArray(x) ? x : (x ? [x.lat, x.lng] : null))
      .filter(Boolean);
    if (pts.length < 2) return;

    L.polyline(pts, {
      color: '#3FBBEE', weight: 3, opacity: .55, dashArray: '1 8',
      lineCap: 'round', lineJoin: 'round'
    }).addTo(layerRoute);

    pts.forEach((pt, i) => {
      L.marker(pt, {
        icon: L.divIcon({
          className: 'pin-wrap',
          html: `<div style="width:19px;height:19px;border-radius:50%;background:#0A0E14;
                 border:2px solid #3FBBEE;color:#3FBBEE;font:700 10px/15px system-ui;
                 text-align:center">${i + 1}</div>`,
          iconSize: [19, 19], iconAnchor: [9, 9]
        }),
        interactive: false, zIndexOffset: 500
      }).addTo(layerRoute);
    });
  }
  function clearRoute() { layerRoute.clearLayers(); }

  /* ── έλεγχοι ── */
  function toggleDanger(on) { on ? layerDanger.addTo(map) : map.removeLayer(layerDanger); }
  function toggleRoute(on)  { on ? layerRoute.addTo(map)  : map.removeLayer(layerRoute); }

  function cycleBasemap() {
    basemapIdx = (basemapIdx + 1) % BASEMAPS.length;
    tileLayer.setUrl(BASEMAPS[basemapIdx].url);
    return BASEMAPS[basemapIdx].name;
  }
  function setBasemapForTheme(theme) {
    basemapIdx = theme === 'light' ? 1 : 0;
    if (tileLayer) tileLayer.setUrl(BASEMAPS[basemapIdx].url);
  }

  function flyTo(id) {
    const p = PLACES.find(x => x.id === id);
    if (!p || !map) return;
    map.flyTo([p.lat, p.lng], 16, { duration: .8 });
    const m = markers[id];
    if (m) setTimeout(() => {
      if (layerPins.zoomToShowLayer) layerPins.zoomToShowLayer(m, () => m.openPopup());
      else m.openPopup();
    }, 850);
  }

  function goHome() {
    map.flyTo([Store.home.lat, Store.home.lng], 15, { duration: .8 });
    homeMarker && homeMarker.openPopup();
  }

  function locate() {
    if (!navigator.geolocation) return Promise.reject('no-geo');
    return new Promise((res, rej) => {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (meMarker) map.removeLayer(meMarker);
        meMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'pin-wrap',
            html: `<div style="width:17px;height:17px;border-radius:50%;background:#3FBBEE;
                   border:3px solid #fff;box-shadow:0 0 0 6px rgba(63,187,238,.28)"></div>`,
            iconSize: [17, 17], iconAnchor: [8, 8]
          })
        }).addTo(map);
        map.flyTo([lat, lng], 15, { duration: .8 });
        res({ lat, lng });
      }, err => rej(err), { enableHighAccuracy: true, timeout: 9000 });
    });
  }

  function invalidate() { map && setTimeout(() => map.invalidateSize(), 120); }
  function fitAll() {
    const pts = PLACES.filter(p => p.cat !== 'transport').map(p => [p.lat, p.lng]);
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(.08));
  }

  return { init, buildPins, refreshPin, refreshAllPins, drawRoute, clearRoute,
           toggleDanger, toggleRoute, cycleBasemap, setBasemapForTheme,
           flyTo, goHome, locate, invalidate, fitAll, startPlacingHome, buildHome };
})();
