/* ════════════════════════════════════════════════════════════
   MAP — Leaflet, custom pins, ζώνες προσοχής, διαδρομή ημέρας
   ════════════════════════════════════════════════════════════ */

const OsloMap = (() => {
  let map = null;
  let layerPins = null, layerDanger = null, layerRoute = null;
  let meMarker = null;
  const markers = {};                 // placeId -> marker
  let basemapIdx = 0;
  let tileLayer = null;
  let onSelect = () => {};
  let onDanger = () => {};

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

  /* ── init ── */
  function init(handlers = {}) {
    if (map) return map;
    onSelect = handlers.onSelect || onSelect;
    onDanger = handlers.onDanger || onDanger;

    map = L.map('map', {
      center: [TRIP.center.lat, TRIP.center.lng],
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

    map.on('click', e => {
      if (pickCb) {
        const cb = pickCb;
        cancelPick();
        cb(e.latlng);
        return;
      }
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
      m.on('click', () => onSelect(p.id));   // κάρτα από κάτω, όχι μπαλονάκι που δεν χωράει
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
      }).on('click', () => onDanger(d)).addTo(layerDanger);

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
      }).on('click', () => onDanger(d)).addTo(layerDanger);
    });
  }


  /* Διάλεξε ένα σημείο με κλικ — για την προσθήκη νέου μέρους */
  let pickCb = null;
  function pickPoint(cb) {
    pickCb = cb;
    document.getElementById('map').style.cursor = 'crosshair';
  }
  function cancelPick() {
    pickCb = null;
    document.getElementById('map').style.cursor = '';
  }

  /* ── διαδρομή ημέρας ── */
  function drawRoute(stopIds) {
    layerRoute.clearLayers();
    if (!stopIds || stopIds.length < 2) return;
    const pts = stopIds
      .map(id => PLACES.find(p => p.id === id) || null)
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

  function setBasemapForTheme(theme) {
    basemapIdx = theme === 'light' ? 1 : 0;
    if (tileLayer) tileLayer.setUrl(BASEMAPS[basemapIdx].url);
  }

  function flyTo(id) {
    const p = PLACES.find(x => x.id === id);
    if (!p || !map) return;
    map.flyTo([p.lat, p.lng], 16, { duration: .8 });
    const m = markers[id];
    if (m && layerPins.zoomToShowLayer) setTimeout(() => layerPins.zoomToShowLayer(m, () => pulse(m)), 850);
    else if (m) setTimeout(() => pulse(m), 850);
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

  /* Σύντομο τόνισμα ώστε να ξεχωρίζει ποιο pin εννοούμε */
  function pulse(m) {
    const el = m.getElement && m.getElement();
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 1600);
  }

  function invalidate() { map && setTimeout(() => map.invalidateSize(), 120); }

  /* Χωράει στην οθόνη όλες τις στάσεις μιας μέρας */
  function fitDay(ids) {
    const pts = (ids || [])
      .map(id => PLACES.find(p => p.id === id))
      .map(x => Array.isArray(x) ? x : (x ? [x.lat, x.lng] : null))
      .filter(Boolean);
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(.18));
    else if (pts.length === 1) map.flyTo(pts[0], 15, { duration: .7 });
  }

  return { init, buildPins, refreshPin, refreshAllPins, drawRoute, clearRoute,
           setBasemapForTheme, flyTo, locate, invalidate, fitDay,
           pickPoint, cancelPick };
})();
