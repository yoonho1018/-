import { MAP_CENTER, MAP_BOUNDS, DISTRICT_CENTERS, validCoordinates } from './geography.mjs';

const mapEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function baseMap(element, center = MAP_CENTER, zoom = 12) {
  if (!window.L) throw new Error('지도 라이브러리를 불러오지 못했습니다. 새로고침해 주세요.');
  const map = window.L.map(element, { scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, minZoom: 10, maxZoom: 19, maxBounds: MAP_BOUNDS, maxBoundsViscosity: 0.8, zoomControl: false }).setView(center, zoom);
  window.L.control.zoom({ zoomInTitle: '지도 확대', zoomOutTitle: '지도 축소' }).addTo(map);
  const note = document.createElement('p'); note.className = 'map-load-note'; note.role = 'status'; note.hidden = true;
  element.after(note);
  if (location.protocol === 'file:') {
    note.hidden = false; note.textContent = '지도 배경은 온라인 사이트에서 표시됩니다. 이 파일은 체험용입니다.';
  } else {
    const tiles = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    }).addTo(map);
    tiles.on('tileerror', () => { note.hidden = false; note.textContent = '지도 배경을 일부 불러오지 못했습니다. 네트워크를 확인해 주세요. 장소 설명과 통계는 계속 이용할 수 있습니다.'; });
  }
  return { map, destroy: () => { map.stop(); map.remove(); note.remove(); } };
}
export function createLocationPicker(element, output) {
  const base = baseMap(element), map = base.map;
  let point = null, marker = null;
  const choose = latlng => {
    if (!validCoordinates(latlng.lat, latlng.lng)) { output.textContent = '대전 주변 범위 안에서 선택해 주세요.'; return; }
    point = { latitude: Number(latlng.lat.toFixed(6)), longitude: Number(latlng.lng.toFixed(6)) };
    if (marker) marker.setLatLng(latlng);
    else marker = window.L.circleMarker(latlng, { radius: 9, color: '#fff', weight: 3, fillColor: '#137864', fillOpacity: 1 }).addTo(map);
    output.textContent = `선택 위치 · ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
  };
  map.on('click', e => choose(e.latlng));
  return {
    read: () => point || {latitude: null, longitude: null},
    center: () => choose(map.getCenter()),
    clear: () => { point = null; if (marker) { marker.remove(); marker = null; } output.textContent = '위치 미선택'; },
    district: name => { if (DISTRICT_CENTERS[name]) map.setView(DISTRICT_CENTERS[name], 14, {animate:false}); },
    destroy: base.destroy
  };
}
export function showLocationMap(element, report) {
  if (!validCoordinates(report.latitude, report.longitude)) return () => {};
  const base = baseMap(element, [report.latitude, report.longitude], 17);
  window.L.circleMarker([report.latitude, report.longitude], { radius: 9, color: '#fff', weight: 3, fillColor: '#137864', fillOpacity: 1 }).addTo(base.map)
    .bindPopup(mapEscape(report.place_text || `${report.district} ${report.dong}`));
  return base.destroy;
}
export function showHeatMap(element, data) {
  const base = baseMap(element), map = base.map;
  const maxCount = Math.max(1, ...data.heat.map(p => p[2]));
  // Keep intensity zoom-independent; colors are relative within the current filter.
  const heat = window.L.heatLayer(data.heat, { radius: 26, blur: 20, max: maxCount, maxZoom: 10, minOpacity: 0.35, gradient: {0.2:'#297bb5',0.45:'#39ad91',0.65:'#f2cb4e',0.85:'#ee8c37',1:'#d44242'} }).addTo(map);
  const points = window.L.layerGroup();
  for (const [lat,lng,count] of data.heat) {
    window.L.circleMarker([lat,lng], {radius: Math.min(22, 5 + Math.sqrt(count)*2),color:'#137864',fillColor:'#137864',fillOpacity:0.45,weight:1})
      .bindPopup(`약 100m 집계 지점 · ${count}건`).addTo(points);
  }
  return {
    mode: value => { if (value === 'count') { map.removeLayer(heat); points.addTo(map); } else { map.removeLayer(points); heat.addTo(map); } },
    reset: () => map.setView(MAP_CENTER, 12, {animate:false}),
    district: name => { if (DISTRICT_CENTERS[name]) map.setView(DISTRICT_CENTERS[name], 13, {animate:false}); },
    destroy: base.destroy
  };
}
