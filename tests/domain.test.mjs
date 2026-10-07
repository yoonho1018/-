import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, classify, validateReport, aggregate } from '../public/domain.mjs';
import { normalizeText, cosineSimilarity, jaccardSimilarity } from '../public/similarity.mjs';
import { configuration } from '../scripts/config.mjs';
test('road keywords produce the expected hierarchy', () => {
  const result = classify('집 앞 도로에 큰 구멍이 생겼어요.');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].category.id, 'road');
  assert.equal(result.candidates[0].category.main, '교통·도로');
});
test('ambiguous cases offer a short relevant list, unknown text offers none', () => {
  assert.deepEqual(new Set(classify('하수구에서 악취가 올라와요').candidates.map(r => r.category.id)), new Set(['odor','drain']));
  assert.equal(classify('도움이 필요해요').candidates.length, 0);
});
test('repetition cannot count as hundreds of separate keyword matches', () => {
  assert.deepEqual(classify('포트홀 포트홀 포트홀').candidates[0].matches, ['포트홀']);
  assert.equal(classify('차가운 날씨').best, 0);
});
test('12 categories each contain 100 distinct normalized terms', () => {
  assert.equal(CATEGORIES.length, 12);
  for (const category of CATEGORIES) {
    assert.equal(category.keywords.length, 100, category.id);
    assert.equal(new Set(category.keywords.map(normalizeText)).size, 100, category.id);
    assert.ok(category.keywords.every(term => normalizeText(term).length >= 2));
  }
});
test('similarity formula reference cases and empty sets', () => {
  assert.equal(jaccardSimilarity(new Set(['a','b']), new Set(['b','c'])), 1/3);
  assert.equal(jaccardSimilarity(new Set(), new Set()), 0);
  assert.equal(cosineSimilarity(new Map([['a',1]]), new Map([['b',1]])), 0);
  assert.equal(cosineSimilarity(new Map([['a',2]]), new Map([['a',5]])), 1);
  assert.ok(Math.abs(cosineSimilarity(new Map([['a',1],['b',1]]), new Map([['a',1]])) - 1/Math.sqrt(2)) < 1e-12);
});
const cases = [
  ['road', '집 앞 도로에 큰 구멍이 생겨서 차가 덜컹거려요.'],
  ['road', '아스팔트가 벗겨지고 바닥이 움푹 파였어요.'],
  ['road', '차도가 내려앉아서 바퀴가 빠질 것 같아요.'],
  ['parking', '횡단보도 위에 주차된 차량 때문에 건너기 힘들어요.'],
  ['parking', '차를 대놓고 가서 출차를 못 하고 있어요.'],
  ['parking', '장애인 주차구역을 차가 무단으로 점유했어요.'],
  ['signal', '교차로 신호등이 하루 종일 꺼져 있어요.'],
  ['signal', '빨간불과 초록불이 동시에 들어옵니다.'],
  ['signal', '보행자 신호등 잔여시간 표시가 안 나와요.'],
  ['sidewalk', '보도블럭이 들떠서 걷다가 넘어질 뻔했어요.'],
  ['sidewalk', '점자블록이 빠져 있어 보행에 불편합니다.'],
  ['sidewalk', '인도가 내려앉아 유모차 바퀴가 걸려요.'],
  ['waste', '골목에 쓰레기를 계속 버리고 가요.'],
  ['waste', '공원 옆에 폐소파와 폐매트리스가 방치됐어요.'],
  ['waste', '종량제봉투를 며칠째 수거하지 않았습니다.'],
  ['odor', '밤마다 썩은 달걀 냄새가 들어와 창문을 못 열어요.'],
  ['odor', '산업단지에서 악취가 계속 퍼집니다.'],
  ['odor', '정화조 쪽에서 코를 찌르는 냄새가 납니다.'],
  ['drain', '비가 오면 하수구에서 물이 역류합니다.'],
  ['drain', '빗물받이에 낙엽이 끼어서 물이 빠지지 않아요.'],
  ['drain', '맨홀 뚜껑이 빠져 있어서 위험해요.'],
  ['light', '공원 옆 가로등이 며칠째 켜지지 않아요.'],
  ['light', '보안등 불빛이 계속 깜빡거려요.'],
  ['light', '골목이 어두워서 밤에 다니기 무서워요.'],
  ['park', '놀이터 미끄럼틀에 금이 가서 위험합니다.'],
  ['park', '공원 벤치 판자가 부러져 못이 나와 있어요.'],
  ['park', '야외 운동기구가 흔들리고 제대로 작동하지 않아요.'],
  ['facility', '정류장 지붕에서 비가 새고 유리가 깨졌어요.'],
  ['facility', '육교 난간이 흔들려서 붙잡기 위험해요.'],
  ['facility', '도로반사경이 반대 방향으로 돌아가 있어요.'],
  ['noise', '밤마다 윗집에서 쿵쿵 소리가 나서 잠을 못 자요.'],
  ['noise', '새벽부터 공사장 굉음 때문에 잠에서 깹니다.'],
  ['noise', '확성기로 광고 방송을 해서 너무 시끄러워요.'],
  ['ad', '횡단보도 현수막이 보행자 시야를 가려요.'],
  ['ad', '전봇대에 불법 벽보와 광고 스티커를 붙여 놨어요.'],
  ['ad', '가게 앞 풍선간판 때문에 걷기가 불편해요.']
];
for (const [id, text] of cases) test(`top recommendation ${id}: ${text}`, () => {
  const result = classify(text);
  assert.equal(result.candidates[0]?.category.id, id, JSON.stringify(result.candidates.map(c => [c.category.id, c.score])));
  assert.ok(result.candidates.length <= 3);
  assert.ok(result.candidates.every(c => c.score > 0 && c.score <= 1));
});
test('generic, empty, numerical and unrelated descriptions do not get arbitrary choices', () => {
  for (const text of ['', '1234567890', '오늘 학교에서 수학을 공부했어요', '고장나서 위험하고 불편해요', '도와주세요 어떻게 해야 할까요']) assert.equal(classify(text).candidates.length, 0, text);
});
test('spacing variants and mixed problems', () => {
  assert.equal(classify('보 도 블 록 이 깨져 있어요').candidates[0].category.id, 'sidewalk');
  assert.equal(classify('도로 위에 쓰레기가 많이 쌓였어요').candidates[0].category.id, 'waste');
  assert.ok(classify('하수구가 막히고 악취도 나요').candidates.some(c => c.category.id === 'drain'));
  assert.equal(classify('anything', []).candidates.length, 0);
});
test('validation rejects missing area, short text and forged category', () => {
  const valid = { content: '집 앞 도로에 구멍이 크게 생겼어요.', district: '유성구', dong: '신성동', category_id: 'road' };
  assert.equal(validateReport(valid), '');
  for (const patch of [{ district: '' }, { dong: ' ' }, { content: '짧음' }, { category_id: 'fake' }]) assert.ok(validateReport({ ...valid, ...patch }));
});
test('counts reflect both new records and resolved status', () => {
  const base = { district: '유성구', dong: '신성동', category_id: 'waste', status: 'open' };
  const result = aggregate([base, { ...base, status: 'resolved' }]);
  assert.deepEqual(result, [{ district: '유성구', dong: '신성동', main: '환경', count: 2, resolved: 1 }]);
});
test('production config requires public keys and rejects secrets', () => {
  assert.throws(() => configuration({}, true));
  assert.throws(() => configuration({ SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fake' }, true));
  assert.equal(configuration({ SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }, true).url, 'https://demo.supabase.co');
});
