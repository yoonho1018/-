import { DISTRICTS, GROUPS, GUIDES, CATEGORIES, classify, validateReport, aggregate } from './domain.mjs';

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = name => `<i data-lucide="${name}"></i>`;
const icons = () => window.lucide?.createIcons();
const STORAGE = 'dongne-reports-v1';
let categories = CATEGORIES, guides = GUIDES, client = null, user = null, connected = false;
let reports = [], page = 0, viewToken = 0, candidate = null;
let recommendations = [];
let filters = { district: '', dong: '', category: '' };
const demo = !window.APP_CONFIG?.url;
const PAGE_SIZE = 10;
let memory = null;
const cat = id => categories.find(c => c.id === id);
const date = value => new Date(value).toLocaleDateString('ko-KR');
function toast(message) {
  $('#toast').textContent = message; $('#toast').style.display = 'block';
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').style.display = 'none', 4500);
}
function examples() {
  const items = [
    ['유성구', '신성동', 'road', '집 앞 도로에 큰 구멍이 생겨 차량이 지나갈 때 위험해요.'],
    ['유성구', '신성동', 'waste', '골목 입구에 쓰레기를 반복해서 버리고 가요.'],
    ['유성구', '궁동', 'light', '공원 옆 가로등이 며칠째 켜지지 않아요.'],
    ['서구', '둔산동', 'parking', '횡단보도 앞 불법주차 때문에 길을 건너기 어려워요.'],
    ['중구', '은행동', 'noise', '저녁마다 확성기 소음이 오랫동안 계속돼요.'],
    ['동구', '가양동', 'park', '공원 벤치의 나무 부분이 부서져 있어요.'],
    ['대덕구', '송촌동', 'drain', '비가 오면 하수구에서 물이 역류해요.'],
    ['유성구', '신성동', 'light', '산책로 가로등 불빛이 계속 깜빡거려요.']
  ];
  return items.map(([district, dong, category_id, content], i) => ({ id: `sample-${i}`, district, dong, category_id, content, user_id: 'sample', status: i % 3 === 0 ? 'resolved' : 'open', created_at: new Date(Date.now() - (i + 1) * 86400000).toISOString() }));
}
function localReports() {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(r => r && typeof r.content === 'string' && cat(r.category_id))) return parsed;
    }
  } catch { /* File previews can restrict local storage. */ }
  return examples();
}
function saveLocal(items) {
  memory = items;
  try { localStorage.setItem(STORAGE, JSON.stringify(items)); }
  catch { toast('브라우저 저장이 제한되어 이번에 연 화면에서만 기록을 유지합니다.'); }
}
function pageName() { return ['report', 'board', 'stats', 'mine'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'report'; }
const options = (items, selected, empty = '') => `${empty ? `<option value="">${empty}</option>` : ''}${items.map(v => `<option value="${escapeHTML(v)}" ${v === selected ? 'selected' : ''}>${escapeHTML(v)}</option>`).join('')}`;
function updateAccount() {
  $('#account').innerHTML = `${icon(user ? 'log-out' : 'user-round')}<span>${user ? '로그아웃' : demo ? '체험 사용자' : '로그인'}</span>`;
  icons();
}
async function init() {
  if (demo) {
    $('#mode').textContent = '체험 모드 · 예시 데이터 포함 · 이 브라우저에만 저장되며 실제 DB에는 등록되지 않습니다.';
  } else {
    $('#mode').textContent = '데이터 연결 확인 중…';
    try {
      if (!window.supabase) throw new Error('연결 라이브러리를 불러오지 못했습니다. 새로고침해 주세요.');
      client = window.supabase.createClient(window.APP_CONFIG.url, window.APP_CONFIG.key);
      const [sessionResult, categoryResult, guideResult] = await Promise.all([
        client.auth.getSession(), client.from('categories').select('*').order('sort_order'), client.from('main_guides').select('*')
      ]);
      for (const result of [sessionResult, categoryResult, guideResult]) if (result.error) throw result.error;
      if (!categoryResult.data?.length || !guideResult.data?.length) throw new Error('분류 데이터가 없습니다. Supabase에서 schema.sql과 seed.sql을 실행해 주세요.');
      user = sessionResult.data.session?.user || null;
      categories = categoryResult.data; guides = guideResult.data; connected = true;
      $('#mode').textContent = '온라인 · 제보와 통계가 실시간 DB에 저장됩니다.'; $('#mode').className = 'mode live';
      client.auth.onAuthStateChange((_event, session) => { user = session?.user || null; updateAccount(); });
    } catch (error) { $('#mode').textContent = `연결 실패 · ${error.message}`; $('#mode').className = 'mode error'; }
  }
  updateAccount(); await render();
}
function requireConnection() { if (!demo && !connected) throw new Error('DB 연결을 확인해 주세요. 현재 서버에 저장할 수 없습니다.'); }
function filterMarkup(includeCategory = true) {
  return `<form class="filters" id="filters"><label>지역<select name="district">${options(DISTRICTS, filters.district, '대전 전체')}</select></label><label>동<input name="dong" maxlength="30" placeholder="전체 동" value="${escapeHTML(filters.dong)}"></label>${includeCategory ? `<label>분야<select name="category">${options(GROUPS, filters.category, '모든 분야')}</select></label>` : ''}<button class="secondary" type="submit">${icon('search')}조회</button></form>`;
}
function bindFilters() {
  $('#filters')?.addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(event.target);
    filters = { district: data.get('district'), dong: data.get('dong').trim(), category: data.get('category') || '' }; page = 0; render();
  });
}
function applyFilters(items, mine = false) {
  return items.filter(r => (!filters.district || r.district === filters.district) && (!filters.dong || r.dong === filters.dong) && (!filters.category || cat(r.category_id)?.main === filters.category) && (!mine || r.user_id === (demo ? 'demo-user' : user?.id))).sort((a,b) => b.created_at.localeCompare(a.created_at));
}
async function listReports(mine) {
  requireConnection();
  if (demo) { const items = applyFilters(localReports(), mine); return { data: items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), count: items.length }; }
  let query = client.from('reports').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (mine) query = query.eq('user_id', user.id);
  if (filters.district) query = query.eq('district', filters.district);
  if (filters.dong) query = query.eq('dong', filters.dong);
  if (filters.category) query = query.in('category_id', categories.filter(c => c.main === filters.category).map(c => c.id));
  const result = await query; if (result.error) throw result.error; return result;
}
function intro(title, description) { return `<p class="eyebrow">DAEJEON · COMMUNITY RECORD</p><h1>${title}</h1><p class="lead">${description}</p>`; }
async function render() {
  const token = ++viewToken, current = pageName();
  document.querySelectorAll('nav a').forEach(a => { a.classList.toggle('active', a.dataset.page === current); a.setAttribute('aria-current', a.dataset.page === current ? 'page' : 'false'); });
  candidate = null;
  if (current === 'report') { renderForm(); return; }
  const mine = current === 'mine';
  $('#main').innerHTML = intro(current === 'stats' ? '우리 동네, 어떤 일이 있나요?' : mine ? '내가 남긴 동네기록' : '우리 동네 게시판', current === 'stats' ? '등록된 제보를 지역과 분야별로 살펴보세요. 공식 민원 통계가 아닙니다.' : mine ? '내 제보를 확인하고 해결 여부를 기록하세요.' : '이웃들이 발견한 생활 속 불편을 함께 확인하세요.') + filterMarkup(current !== 'stats') + '<div id="results" class="loading">기록을 불러오는 중…</div>';
  bindFilters(); icons();
  if (mine && !demo && !user) { $('#results').innerHTML = '<div class="empty">로그인하면 내가 작성한 제보를 볼 수 있습니다.<div class="actions"><button class="primary" id="login-here">로그인</button></div></div>'; $('#login-here').onclick = () => $('#auth').showModal(); return; }
  try {
    if (current === 'stats') { await renderStats(token); return; }
    const result = await listReports(mine);
    if (token !== viewToken) return;
    reports = result.data;
    $('#results').className = '';
    $('#results').innerHTML = `<p class="count-label">${demo ? '체험 기록' : '전체'} ${result.count}건</p><div class="list">${reports.length ? reports.map(r => rowMarkup(r, mine)).join('') : `<div class="empty">${icon('inbox')}<p>아직 등록된 제보가 없습니다.</p><a href="#report">첫 제보 남기기</a></div>`}</div><div class="pager"><button class="secondary" id="prev" ${page === 0 ? 'disabled' : ''} aria-label="이전 페이지">${icon('chevron-left')}</button><span>${page + 1} / ${Math.max(1, Math.ceil(result.count / PAGE_SIZE))}</span><button class="secondary" id="next" ${(page + 1) * PAGE_SIZE >= result.count ? 'disabled' : ''} aria-label="다음 페이지">${icon('chevron-right')}</button></div>`;
    $('#prev').onclick = () => { page--; render(); }; $('#next').onclick = () => { page++; render(); };
    document.querySelectorAll('[data-detail]').forEach(button => button.onclick = () => showDetail(reports.find(r => r.id === button.dataset.detail)));
    document.querySelectorAll('[data-status]').forEach(button => button.onclick = () => changeStatus(reports.find(r => r.id === button.dataset.status), button));
    icons();
  } catch (error) { if (token === viewToken) { $('#results').className = 'error-box'; $('#results').textContent = `불러오지 못했습니다. ${error.message}`; } }
}
function rowMarkup(r, mine) {
  const category = cat(r.category_id);
  return `<article class="report-row"><div><div class="meta"><span>${escapeHTML(r.district)} · ${escapeHTML(r.dong)}</span><span>${date(r.created_at)}</span></div><p>${escapeHTML(r.content.length > 100 ? r.content.slice(0,100) + '…' : r.content)}</p><div class="meta"><span>${escapeHTML(category?.main)} / ${escapeHTML(category?.name)}</span><span class="tag ${r.status === 'resolved' ? 'resolved' : ''}">${r.status === 'resolved' ? '작성자 해결 확인' : '등록됨'}</span></div></div><div class="row-actions"><button class="secondary" data-detail="${escapeHTML(r.id)}">상세·민원 안내${icon('arrow-up-right')}</button>${mine ? `<button class="icon secondary" data-status="${escapeHTML(r.id)}" title="${r.status === 'resolved' ? '미해결로 변경' : '해결 완료로 변경'}" aria-label="${r.status === 'resolved' ? '미해결로 변경' : '해결 완료로 변경'}">${icon(r.status === 'resolved' ? 'rotate-ccw' : 'check')}</button>` : ''}</div></article>`;
}
function renderForm() {
  candidate = null; recommendations = [];
  $('#main').innerHTML = intro('작은 불편, 함께 남기는 변화', '우리 동네에서 발견한 문제를 기록해 주세요.') + `<div class="report-layout"><form id="report-form"><section class="section"><div class="section-title"><span class="step">1</span><h2>어디에서 발생했나요?</h2></div><p class="meta">대전광역시</p><div class="fields"><label>구<select name="district" required>${options(DISTRICTS, '', '구 선택')}</select></label><label>동<input name="dong" required maxlength="30" placeholder="예: 신성동"></label></div></section><section class="section"><div class="section-title"><span class="step">2</span><h2>어떤 불편을 발견했나요?</h2></div><label>문제 내용<textarea name="content" minlength="10" maxlength="1000" required placeholder="예: 집 앞 도로에 큰 구멍이 생겼어요. 차량이 지나갈 때 위험해 보여요."></textarea></label><div class="field-foot"><span>이름·연락처 등 개인정보는 적지 마세요.</span><span id="length">0 / 1,000</span></div><button type="button" id="analyze" class="secondary wide">${icon('scan-text')}분류 확인하기</button><div id="classification"></div><p id="form-error" class="form-error" role="alert"></p><button type="submit" id="submit-report" class="primary wide" disabled>${icon('send')}제보 등록하기</button></section></form><section class="support"><img src="/assets/street.jpg" alt="건물과 보행로가 있는 도시 거리" width="600" height="400"><p class="photo-credit">도시 거리 · Unsplash</p><h3>오늘의 동네를 기록해요</h3><ul class="support-list"><li>${icon('route')}<div>교통·도로<small>도로 파손, 불법주차, 보행로</small></div></li><li>${icon('leaf')}<div>환경<small>쓰레기, 악취, 하수구</small></div></li><li>${icon('lamp-street')}<div>공공시설<small>가로등, 공원, 시설물</small></div></li><li>${icon('volume-2')}<div>생활<small>소음, 불법 광고물</small></div></li></ul><p class="notice">제보는 게시판에 공개됩니다. 공식 신고는 등록 후 민원 안내에서 별도로 진행해 주세요.</p></section></div>`;
  const form = $('#report-form');
  form.content.oninput = () => { $('#length').textContent = `${form.content.value.length} / 1,000`; candidate = null; recommendations = []; $('#classification').innerHTML = ''; $('#submit-report').disabled = true; };
  $('#analyze').onclick = () => {
    if (!form.reportValidity()) return;
    const result = classify(form.content.value, categories);
    recommendations = result.candidates.map(item => item.category.id);
    candidate = null; $('#submit-report').disabled = true; $('#form-error').textContent = '';
    $('#classification').innerHTML = recommendations.length
      ? `<fieldset class="recommendations"><legend>내 상황에 맞는 분류</legend>${result.candidates.map((item, i) => `<label class="recommendation"><input type="radio" name="recommended-category" value="${escapeHTML(item.category.id)}"><span class="recommendation-body"><span class="recommendation-top"><strong>${escapeHTML(item.category.name)}</strong><span class="rank">${i + 1}순위</span></span><span class="meta">${escapeHTML(item.category.main)}</span><span class="evidence">${item.matches.length ? '일치 표현' : '비슷한 표현'}: ${escapeHTML(item.evidence.join(', '))}</span></span></label>`).join('')}</fieldset>`
      : '<div class="classification"><strong>관련 분류를 찾기 어려워요</strong><p>문제가 생긴 대상과 상태를 조금 더 적어 주세요.</p><button type="button" class="secondary" id="refine-content">내용 보완하기</button></div>';
    document.querySelectorAll('input[name="recommended-category"]').forEach(input => input.onchange = () => { candidate = input.value; $('#submit-report').disabled = !recommendations.includes(candidate); });
    $('#refine-content')?.addEventListener('click', () => form.content.focus());
  };
  form.onsubmit = async event => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(form));
    if (!recommendations.includes(candidate)) { $('#form-error').textContent = '추천된 분류 중 하나를 선택해 주세요.'; return; }
    const payload = { content: data.content.trim(), district: data.district, dong: data.dong.trim().replace(/\s+/g, ' '), category_id: candidate };
    const error = validateReport(payload, categories); if (error) { $('#form-error').textContent = error; return; }
    if (!demo && !user) { $('#auth').showModal(); return; }
    const submit = $('#submit-report'); submit.disabled = true; $('#form-error').textContent = '';
    try {
      requireConnection(); let report;
      if (demo) { report = { ...payload, id: crypto.randomUUID(), user_id: 'demo-user', created_at: new Date().toISOString(), status: 'open' }; saveLocal([report, ...localReports()]); }
      else { const result = await client.from('reports').insert({ ...payload, user_id: user.id }).select().single(); if (result.error) throw result.error; report = result.data; }
      showSuccess(report);
    } catch (error) { $('#form-error').textContent = `등록하지 못했습니다. ${error.message}`; submit.disabled = false; }
  }; icons();
}
function showSuccess(report) {
  const category = cat(report.category_id);
  $('#main').innerHTML = `<div class="section"><h1 class="success-title">${icon('circle-check')}${demo ? '체험 제보를 저장했습니다' : '제보가 등록되었습니다'}</h1><p class="lead">${demo ? '이 브라우저의 체험 게시판과 통계에 반영되었습니다.' : '게시판과 지역 통계에 반영되었습니다.'}</p><div class="classification"><p class="eyebrow">${escapeHTML(report.district)} · ${escapeHTML(report.dong)}</p><strong>${escapeHTML(category.main)} / ${escapeHTML(category.name)}</strong></div><div class="detail-body">${escapeHTML(report.content)}</div><div class="actions"><button class="primary" id="success-guide">${icon('book-open')}민원 안내 보기</button><button class="secondary" id="success-stats">${icon('chart-no-axes-combined')}우리 동네 현황</button><button class="secondary" id="again">${icon('plus')}새 제보</button></div><p class="notice">이 사이트에 등록한 제보는 행정기관에 자동으로 전달되지 않습니다.</p></div>`;
  $('#success-guide').onclick = () => showDetail(report, true);
  $('#success-stats').onclick = () => { filters = { district: report.district, dong: report.dong, category: '' }; location.hash = 'stats'; };
  $('#again').onclick = renderForm; icons();
}
function guideMarkup(category) {
  const guide = guides.find(g => g.name === category.main);
  return `<section class="guide"><h3>${escapeHTML(category.main)} 민원 안내</h3><p>${escapeHTML(guide?.body || '')}</p><ul>${(guide?.checklist || []).map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul><h3>${escapeHTML(category.name)} 추가 안내</h3><p>${escapeHTML(category.extra)}</p><a href="https://www.safetyreport.go.kr/" target="_blank" rel="noopener noreferrer">안전신문고${icon('external-link')}</a><a href="https://www.epeople.go.kr/" target="_blank" rel="noopener noreferrer">국민신문고${icon('external-link')}</a><p class="notice">일반적인 신고 준비 안내입니다. 실제 접수 대상과 제출 요건은 공식 사이트에서 확인해 주세요. 이 버튼은 신고를 자동으로 접수하지 않습니다.</p></section>`;
}
function showDetail(report, showGuide = false) {
  const category = cat(report.category_id);
  $('#detail-content').innerHTML = `<div class="dialog-head"><h2>${escapeHTML(category.name)}</h2><button class="icon" data-close="detail" aria-label="닫기">${icon('x')}</button></div><div class="meta"><span>${escapeHTML(report.district)} · ${escapeHTML(report.dong)}</span><span>${date(report.created_at)}</span></div><div class="detail-body">${escapeHTML(report.content)}</div><button class="secondary" id="toggle-guide" aria-expanded="${showGuide}">${icon('book-open')}민원 안내 ${showGuide ? '접기' : '보기'}</button><div id="guide-content" ${showGuide ? '' : 'hidden'}>${guideMarkup(category)}</div>`;
  $('#toggle-guide').onclick = event => { const show = $('#guide-content').hidden; $('#guide-content').hidden = !show; event.currentTarget.setAttribute('aria-expanded', String(show)); event.currentTarget.innerHTML = `${icon('book-open')}민원 안내 ${show ? '접기' : '보기'}`; icons(); };
  if (!$('#detail').open) $('#detail').showModal(); icons();
}
async function changeStatus(report, button) {
  button.disabled = true;
  const status = report.status === 'resolved' ? 'open' : 'resolved';
  try {
    if (demo) saveLocal(localReports().map(r => r.id === report.id && r.user_id === 'demo-user' ? { ...r, status } : r));
    else { requireConnection(); const result = await client.from('reports').update({ status }).eq('id', report.id).eq('user_id', user.id).select('id').single(); if (result.error) throw result.error; }
    toast('해결 여부를 변경했습니다.'); await render();
  } catch (error) { toast(error.message); button.disabled = false; }
}
function bars(entries) {
  const max = Math.max(1, ...entries.map(e => e.value));
  return entries.map((e,i) => `<div class="bar-row"><div class="bar-label"><span>${escapeHTML(e.name)}</span><strong>${e.value}건</strong></div><div class="track" role="img" aria-label="${escapeHTML(e.name)} ${e.value}건"><div class="bar c${i % 4}" style="width:${100 * e.value / max}%"></div></div></div>`).join('');
}
async function renderStats(token) {
  requireConnection(); let all;
  if (demo) all = aggregate(localReports(), categories);
  else { const result = await client.rpc('report_statistics'); if (result.error) throw result.error; all = result.data; }
  if (token !== viewToken) return;
  const selected = all.filter(r => (!filters.district || r.district === filters.district) && (!filters.dong || r.dong === filters.dong));
  const total = selected.reduce((sum,r) => sum + Number(r.count), 0), resolved = selected.reduce((sum,r) => sum + Number(r.resolved), 0);
  $('#results').className = '';
  $('#results').innerHTML = `<div class="metric-strip"><div><small>${escapeHTML([filters.district, filters.dong].filter(Boolean).join(' ') || '대전 전체')} 제보</small><strong>${total}</strong><span>건</span></div><div><small>작성자 해결 확인</small><strong>${resolved}</strong><span>건</span></div><div><small>미해결 기록</small><strong>${total - resolved}</strong><span>건</span></div></div>${!total ? '<p class="notice">선택한 지역에는 아직 제보가 없습니다.</p>' : ''}<div class="charts"><section><h2>선택 지역 · 분야별 현황</h2>${bars(GROUPS.map(name => ({ name, value: selected.filter(r => r.main === name).reduce((sum,r) => sum + Number(r.count), 0) })))}</section><section><h2>대전 전체 · 구별 비교</h2><p class="meta">구별 비교는 위 지역 필터와 관계없이 전체 기록입니다.</p>${bars(DISTRICTS.map(name => ({ name, value: all.filter(r => r.district === name).reduce((sum,r) => sum + Number(r.count), 0) })))}</section></div><p class="notice">${demo ? '체험용 예시 데이터와 이 브라우저에서 작성한 제보입니다.' : '이 서비스에 등록된 제보만 집계합니다. 실제 지역 문제 전체를 대표하지 않습니다.'}</p>`;
}
$('#account').onclick = async () => {
  if (demo) { toast('체험 모드에서는 회원가입 없이 내 제보를 기록할 수 있어요.'); return; }
  if (!user) { $('#auth').showModal(); return; }
  const result = await client.auth.signOut(); if (result.error) toast(result.error.message); else { user = null; updateAccount(); render(); }
};
async function authenticate(signup) {
  const form = $('#auth-form'); if (!form.reportValidity()) return;
  $('#auth-message').textContent = ''; const buttons = form.querySelectorAll('button'); buttons.forEach(b => b.disabled = true);
  try {
    requireConnection();
    const credentials = { email: form.email.value.trim(), password: form.password.value };
    const result = signup ? await client.auth.signUp({ ...credentials, options: { emailRedirectTo: location.origin } }) : await client.auth.signInWithPassword(credentials);
    if (result.error) throw result.error;
    if (signup && !result.data.session) { $('#auth-message').textContent = '확인 메일을 보냈습니다. 메일의 인증 링크를 누른 뒤 로그인해 주세요.'; form.password.value = ''; return; }
    user = result.data.user; form.reset(); $('#auth').close(); updateAccount(); toast('로그인했습니다.'); if (pageName() === 'mine') render();
  } catch (error) { $('#auth-message').textContent = `로그인/가입 실패: ${error.message}`; }
  finally { buttons.forEach(b => b.disabled = false); }
}
$('#auth-form').onsubmit = event => { event.preventDefault(); authenticate(false); };
$('#signup').onclick = () => authenticate(true);
document.addEventListener('click', event => { const close = event.target.closest('[data-close]'); if (close) document.getElementById(close.dataset.close).close(); });
window.addEventListener('hashchange', () => { page = 0; render(); });
init();
