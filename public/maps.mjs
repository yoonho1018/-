import { MAP_CENTER, MAP_BOUNDS, DISTRICT_CENTERS, validCoordinates } from './geography.mjs';
import { DONG_CENTERS } from './dong-centers.mjs';

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
export function createLocationPicker(element, output, controls = null) {
  const base = baseMap(element), map = base.map;
  let point = null, marker = null;
  let requestVersion = 0, moveTimer = null, destroyed = false;
  const events = new AbortController();
  const choose = latlng => {
    clearTimeout(moveTimer);
    requestVersion++;
    if (!validCoordinates(latlng.lat, latlng.lng)) { output.textContent = '대전 주변 범위 안에서 선택해 주세요.'; return; }
    point = { latitude: Number(latlng.lat.toFixed(6)), longitude: Number(latlng.lng.toFixed(6)) };
    if (marker) marker.setLatLng(latlng);
    else marker = window.L.circleMarker(latlng, { radius: 9, color: '#fff', weight: 3, fillColor: '#137864', fillOpacity: 1 }).addTo(map);
    output.textContent = `선택 위치 · ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
  };
  map.on('click', e => choose(e.latlng));
  const clear = () => {
    requestVersion++; point = null;
    if (marker) { marker.remove(); marker = null; }
    output.textContent = '위치 미선택';
  };
  if (controls) {
    const { district, dong, currentButton, notice } = controls;
    function moveToDong() {
      if (destroyed) return;
      const name = dong.value.trim().replace(/\s+/g,'');
      if (!name) { notice.textContent = '동 이름을 입력하면 지도가 이동합니다.'; return; }
      if (!district.value) { notice.textContent = '먼저 구를 선택해 주세요.'; return; }
      const center = DONG_CENTERS[district.value]?.[name];
      if (!center) { notice.textContent = '해당 구에서 동을 찾지 못했어요. 동 이름을 확인하거나 지도를 직접 이동해 주세요.'; return; }
      map.setView(center,15,{animate:false});
      notice.textContent = district.value+' '+name+' 주변으로 이동했어요. 실제 발생 지점을 지도에서 찍어 주세요.';
    }
    dong.addEventListener('input', () => {
      clear(); clearTimeout(moveTimer);
      moveTimer = setTimeout(moveToDong,450);
    }, {signal:events.signal});
    district.addEventListener('change', () => {
      clear(); clearTimeout(moveTimer);
      if (DISTRICT_CENTERS[district.value]) map.setView(DISTRICT_CENTERS[district.value],14,{animate:false});
      moveToDong();
    }, {signal:events.signal});
    currentButton.addEventListener('click', () => {
      clearTimeout(moveTimer);
      if (!navigator.geolocation) { notice.textContent = '이 브라우저에서는 현재 위치를 사용할 수 없어요. 지도에서 선택해 주세요.'; return; }
      const version = ++requestVersion;
      currentButton.disabled = true; notice.textContent = '현재 위치를 확인하고 있어요…';
      navigator.geolocation.getCurrentPosition(position => {
        if (destroyed) return;
        currentButton.disabled = false;
        if (version !== requestVersion) return;
        const {latitude,longitude,accuracy} = position.coords;
        if (!validCoordinates(latitude,longitude)) { notice.textContent = '현재 위치가 대전 주변 지도 범위 밖에 있어요. 제보할 장소를 지도에서 선택해 주세요.'; return; }
        map.setView([latitude,longitude],17,{animate:false});
        choose({lat:latitude,lng:longitude});
        notice.textContent = '현재 위치를 선택했어요'+(Number.isFinite(accuracy)?' (오차 약 '+Math.round(accuracy)+'m)':'')+'. 발생 장소가 맞는지 확인하고 구·동도 입력해 주세요.';
      }, error => {
        if (destroyed) return;
        currentButton.disabled = false;
        if (version !== requestVersion) return;
        notice.textContent = error.code === 1 ? '위치 권한이 꺼져 있어요. 브라우저에서 허용한 뒤 다시 누르거나 지도에서 선택해 주세요.'
          : error.code === 3 ? '위치 확인 시간이 초과됐어요. 다시 누르거나 지도에서 선택해 주세요.'
          : '현재 위치를 찾지 못했어요. 기기의 위치 설정을 확인하거나 지도에서 선택해 주세요.';
      }, {enableHighAccuracy:true,timeout:10000,maximumAge:0});
    }, {signal:events.signal});
  }
  return {
    read: () => point || {latitude: null, longitude: null},
    restore: (lat,lng) => { if (validCoordinates(lat,lng)) { map.setView([lat,lng],16); choose({lat,lng}); } },
    center: () => choose(map.getCenter()),
    clear,
    district: name => { if (DISTRICT_CENTERS[name]) map.setView(DISTRICT_CENTERS[name], 14, {animate:false}); },
    destroy: () => { destroyed=true; requestVersion++; clearTimeout(moveTimer); events.abort(); base.destroy(); }
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
