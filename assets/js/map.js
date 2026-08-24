/* ════════════════════════════════════════════════════════════
   MAP — Leaflet. Ανοιχτός χάρτης, pins ανά κατηγορία,
   ζώνες προσοχής. Το tap σε pin ειδοποιεί την εφαρμογή, που
   ανοίγει κάρτα από κάτω — ποτέ μπαλονάκι που δεν χωράει.
   ════════════════════════════════════════════════════════════ */

const OsloMap = (() => {
  const TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
                '&copy; <a href="https://carto.com/attributions">CARTO</a>';

  let map = null, pins = null, zones = null, me = null;
  const markers = {};
  let onSelect = () => {}, onZone = () => {}, pick = null;

  function icon(p) {
    const c = CATS[p.cat];
    const done = Store.isVisited(p.id);
    const big = p.gem;
    return L.divIcon({
      className: 'pin-wrap',
      html: `<div class="pin ${done ? 'done' : ''} ${big ? 'big' : ''}" style="background:${c.raw}">
               <svg class="ic"><use href="#${c.icon}"/></svg>
               ${done ? '<i class="pin-ok"></i>' : ''}
             </div>`,
      iconSize:   big ? [38, 38] : [30, 30],
      iconAnchor: big ? [19, 36] : [15, 28]
    });
  }

  function init(h = {}) {
    if (map) return map;
    onSelect = h.onSelect || onSelect;
    onZone   = h.onZone   || onZone;

    map = L.map('map', {
      center: [TRIP.center.lat, TRIP.center.lng],
      zoom: 13,
      zoomControl: false
    });
    L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19, subdomains: 'abcd' }).addTo(map);

    zones = L.layerGroup().addTo(map);
    pins = (window.L && L.markerClusterGroup)
      ? L.markerClusterGroup({
          maxClusterRadius: 44,
          showCoverageOnHover: false,
          iconCreateFunction: c => L.divIcon({
            className: 'pin-wrap',
            html: `<div class="cluster">${c.getChildCount()}</div>`,
            iconSize: [36, 36]
          })
        }).addTo(map)
      : L.layerGroup().addTo(map);

    buildZones();
    build();

    map.on('click', e => {
      if (!pick) return;
      const cb = pick;
      pick = null;
      document.getElementById('map').style.cursor = '';
      cb(e.latlng);
    });

    setTimeout(() => map.invalidateSize(), 200);
    return map;
  }

  function build(filter) {
    pins.clearLayers();
    for (const k in markers) delete markers[k];
    PLACES.forEach(p => {
      if (filter && !filter(p)) return;
      const m = L.marker([p.lat, p.lng], { icon: icon(p), title: p.nameEl || p.name });
      m.on('click', () => onSelect(p.id));
      markers[p.id] = m;
      pins.addLayer(m);
    });
  }

  function refresh(id) {
    const p = PLACES.find(x => x.id === id);
    if (p && markers[id]) markers[id].setIcon(icon(p));
  }

  function buildZones() {
    zones.clearLayers();
    DANGER.forEach(d => {
      L.circle([d.lat, d.lng], {
        radius: d.r, color: '#E08A2E', weight: 1.4, opacity: .6,
        fillColor: '#E08A2E', fillOpacity: .10, dashArray: '5 5'
      }).on('click', () => onZone(d)).addTo(zones);

      L.marker([d.lat, d.lng], {
        icon: L.divIcon({
          className: 'pin-wrap',
          html: '<div class="zone-badge"><svg class="ic"><use href="#ic-alert"/></svg></div>',
          iconSize: [24, 24], iconAnchor: [12, 12]
        }),
        zIndexOffset: -200
      }).on('click', () => onZone(d)).addTo(zones);
    });
  }

  /* σύντομο τόνισμα, για να ξεχωρίζει ποιο pin εννοούμε */
  function pulse(m) {
    const el = m.getElement && m.getElement();
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 1500);
  }

  function flyTo(id) {
    const p = PLACES.find(x => x.id === id);
    if (!p || !map) return;
    map.flyTo([p.lat, p.lng], 16, { duration: .7 });
    const m = markers[id];
    if (!m) return;
    setTimeout(() => {
      if (pins.zoomToShowLayer) pins.zoomToShowLayer(m, () => pulse(m));
      else pulse(m);
    }, 750);
  }

  function locate() {
    if (!navigator.geolocation) return Promise.reject(new Error('no-geo'));
    return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      if (me) map.removeLayer(me);
      me = L.marker([lat, lng], {
        icon: L.divIcon({ className: 'pin-wrap', html: '<div class="me"></div>',
                          iconSize: [16, 16], iconAnchor: [8, 8] })
      }).addTo(map);
      map.flyTo([lat, lng], 15, { duration: .7 });
      res({ lat, lng });
    }, rej, { enableHighAccuracy: true, timeout: 9000 }));
  }

  const pickPoint = cb => {
    pick = cb;
    document.getElementById('map').style.cursor = 'crosshair';
  };
  const invalidate = () => map && setTimeout(() => map.invalidateSize(), 120);

  return { init, build, refresh, flyTo, locate, invalidate, pickPoint, TILES };
})();
