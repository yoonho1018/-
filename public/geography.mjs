export const MAP_CENTER = [36.3504, 127.3845];
export const MAP_BOUNDS = [[36.10, 127.10], [36.60, 127.65]];
export const DISTRICT_CENTERS = {
  '유성구': [36.3622, 127.3561], '서구': [36.3555, 127.3838],
  '중구': [36.325, 127.421], '동구': [36.312, 127.454], '대덕구': [36.375, 127.421]
};
export function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= MAP_BOUNDS[0][0] && latitude <= MAP_BOUNDS[1][0]
    && longitude >= MAP_BOUNDS[0][1] && longitude <= MAP_BOUNDS[1][1];
}
export function validateLocation(report) {
  if (report.place_text != null && (typeof report.place_text !== 'string' || report.place_text.trim().length > 160)) return '상세 장소는 160자 이내로 입력해 주세요.';
  if (report.latitude == null && report.longitude == null) return '';
  return validCoordinates(report.latitude, report.longitude) ? '' : '대전 주변 지도 범위 안에서 위치를 선택해 주세요.';
}
// Mirrors the DB RPC for the offline demo; missing coordinates never become (0, 0).
export function mapSummary(items, categories, selection = {}) {
  const matching = items.filter(r => {
    const c = categories.find(c => c.id === r.category_id);
    return c && (!selection.main || c.main === selection.main)
      && (!selection.category || r.category_id === selection.category)
      && (!selection.status || r.status === selection.status);
  });
  const districts = new Map(), bins = new Map();
  let located = 0;
  for (const r of matching) {
    const d = districts.get(r.district) || { district: r.district, count: 0, located: 0 };
    d.count++;
    if (validCoordinates(r.latitude, r.longitude)) {
      located++; d.located++;
      const lat = Math.round(r.latitude * 1000) / 1000, lng = Math.round(r.longitude * 1000) / 1000;
      const key = `${lat},${lng}`, point = bins.get(key) || [lat, lng, 0];
      point[2]++; bins.set(key, point);
    }
    districts.set(r.district, d);
  }
  const heat = [...bins.values()].sort((a,b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]).slice(0, 5000);
  return { total: matching.length, located, districts: [...districts.values()], heat, truncated: bins.size > 5000 };
}
