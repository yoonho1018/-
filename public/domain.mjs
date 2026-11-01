import { KEYWORDS } from './keywords.mjs';
import { rankCategories } from './similarity.mjs';

export const DISTRICTS = ['유성구', '서구', '중구', '동구', '대덕구'];
export const GROUPS = ['교통·도로', '환경', '공공시설', '생활'];
export const GUIDES = [
  { name: '교통·도로', body: '도로와 교통시설의 위치, 현재 상태, 통행에 미치는 영향을 정리해 주세요.', checklist: ['정확한 위치 또는 주변 건물', '안전한 곳에서 촬영한 현장 사진', '발견한 날짜와 통행에 미치는 영향'] },
  { name: '환경', body: '불편이 발생한 위치와 범위, 반복되는 시간대를 정리해 주세요.', checklist: ['발생 위치와 오염 범위', '발견한 날짜와 반복 여부', '현장 상태를 확인할 수 있는 사진'] },
  { name: '공공시설', body: '시설의 종류와 위치, 어떤 부분이 작동하지 않거나 파손되었는지 정리해 주세요.', checklist: ['시설 이름과 위치', '고장 또는 파손 상태', '시설 관리번호가 보이면 함께 기록'] },
  { name: '생활', body: '불편의 내용과 발생 시간, 반복되는 정도를 구체적으로 정리해 주세요.', checklist: ['발생 장소와 날짜', '발생 시간대와 지속 시간', '생활에 미치는 영향'] }
];
export const CATEGORIES = [
  { id: 'road', main: '교통·도로', name: '도로 파손', keywords: ['도로', '구멍', '포트홀', '아스팔트', '도로 파손'], extra: '파손 부분의 위치와 크기, 통행에 미치는 영향을 기록해 주세요. 촬영을 위해 차도로 들어가지 마세요.' },
  { id: 'parking', main: '교통·도로', name: '불법주차', keywords: ['불법주차', '주차', '주정차', '이중주차'], extra: '주정차 위치와 상태를 기록해 주세요. 신고 대상과 사진 촬영 기준은 공식 신고 서비스에서 확인해 주세요.' },
  { id: 'signal', main: '교통·도로', name: '신호등 고장', keywords: ['신호등', '교통신호', '신호 고장'], extra: '교차로 이름과 진행 방향, 고장 난 신호등의 상태를 기록해 주세요.' },
  { id: 'sidewalk', main: '교통·도로', name: '보도블록 파손', keywords: ['보도블록', '보행로', '인도 파손', '보도 파손'], extra: '보행로의 정확한 위치와 들뜨거나 내려앉은 부분을 기록해 주세요.' },
  { id: 'waste', main: '환경', name: '쓰레기 무단투기', keywords: ['쓰레기', '폐기물', '무단투기', '버리고'], extra: '버려진 물건의 종류와 양, 위치 및 반복 여부를 기록해 주세요.' },
  { id: 'odor', main: '환경', name: '악취', keywords: ['악취', '냄새', '썩은'], extra: '냄새가 나는 위치, 심한 시간대와 지속 시간을 기록해 주세요.' },
  { id: 'drain', main: '환경', name: '하수구 문제', keywords: ['하수구', '하수도', '배수구', '역류'], extra: '막힘이나 역류가 발생한 위치와 주변 피해 여부를 기록해 주세요.' },
  { id: 'light', main: '공공시설', name: '가로등 고장', keywords: ['가로등', '조명', '불빛', '어두'], extra: '가로등 위치와 관리번호가 있다면 함께 기록하고, 불이 꺼지거나 깜빡이는 상태를 적어 주세요.' },
  { id: 'park', main: '공공시설', name: '공원시설 파손', keywords: ['공원', '놀이터', '미끄럼틀', '그네', '벤치'], extra: '공원 이름과 파손된 시설 종류, 위치를 기록해 주세요.' },
  { id: 'facility', main: '공공시설', name: '시설물 파손', keywords: ['시설물', '공공시설', '난간', '정류장'], extra: '시설물 이름과 위치, 파손 범위를 기록해 주세요.' },
  { id: 'noise', main: '생활', name: '소음', keywords: ['소음', '시끄', '확성기', '공사 소리', '공사장'], extra: '소리가 발생하는 시간대, 지속 시간, 반복 여부를 기록해 주세요.' },
  { id: 'ad', main: '생활', name: '불법 광고물', keywords: ['광고물', '현수막', '전단지', '벽보'], extra: '광고물이 설치된 위치와 형태, 통행 방해 여부를 기록해 주세요.' }
  ,{ id: 'bicycle', main: '교통·도로', name: '공유자전거 방치·통행 방해', keywords: ['타슈', '공유자전거', '공공자전거', '대여자전거', '자전거 방치', '넘어진 자전거', '쓰러진 자전거', '엎어진 자전거', '자전거가 넘어', '자전거가 쓰러', '자전거가 엎어', '타슈가 엎어', '타슈가 넘어', '타슈가 쓰러', '자전거 통행 방해', '타슈 방치', '타슈 반납', '타슈 대여소', '자전거 무단방치', '자전거가 길을 막'], extra: '자전거 위치와 통행을 막는 상태를 기록해 주세요. 타슈 등 운영 서비스의 공식 문의 창구에서 회수·정리 요청 방법을 확인할 수 있습니다. 위험한 차도로 들어가 직접 옮기지 마세요.' },
  { id: 'scooter', main: '교통·도로', name: '전동킥보드 방치·통행 방해', keywords: ['킥보드', '전동킥보드', '공유킥보드', '전동스쿠터', '킥보드 방치', '킥보드가 넘어', '킥보드가 쓰러', '킥보드가 엎어', '쓰러진 킥보드', '넘어진 킥보드', '킥보드 통행 방해', '킥보드 무단주차', '킥보드 반납', '킥보드가 길을 막', '전동 킥보드'], extra: '기기 위치와 운영사 표시, 보행을 막는 상태를 기록해 주세요. 운영사의 공식 문의 창구에서 수거 요청 방법을 확인해 주세요.' },
  { id: 'obstruction', main: '교통·도로', name: '보행로 적치물·장애물', keywords: ['적치물', '노상적치', '보행로 적치', '인도 적치', '길을 막은 물건', '통로에 쌓인', '인도에 쌓인', '보도에 쌓인', '보행로 장애물', '통행 장애물', '입간판', '화분이 길을', '박스가 길을', '공사 자재', '쌓아둔 자재', '보행로를 막', '인도를 막', '통로를 막'], extra: '어떤 물건이 어느 통로를 얼마나 막고 있는지 기록해 주세요. 물건 소유자의 개인정보는 올리지 마세요.' },
  { id: 'accessibility', main: '교통·도로', name: '이동약자 통행 장애', keywords: ['휠체어', '유모차', '경사로', '보도 턱', '높은 턱', '턱이 높', '휠체어 진입', '장애인 통행', '시각장애인', '이동약자', '경사로가 막', '점자블록을 막', '점자블록 위', '휠체어가 못', '유모차가 못', '보행약자'], extra: '점자블록, 경사로, 보도 턱 등 어떤 시설에서 통행이 어려운지 기록해 주세요. 이용자의 얼굴이나 장애 관련 개인정보는 공개하지 마세요.' }
].map(category => ({ ...category, keywords: KEYWORDS[category.id] || category.keywords }));
export function classify(text, categories = CATEGORIES) {
  return rankCategories(text, categories);
}
export function validateReport({ content, district, dong, category_id }, categories = CATEGORIES) {
  if (!DISTRICTS.includes(district)) return '발생한 구를 선택해 주세요.';
  if (!dong?.trim() || dong.trim().length > 30) return '동 이름을 1~30자로 입력해 주세요.';
  if (!content || content.trim().length < 10 || content.trim().length > 1000) return '문제 내용을 10~1,000자로 작성해 주세요.';
  if (!categories.some(c => c.id === category_id)) return '분류를 선택해 주세요.';
  return '';
}
export function aggregate(reports, categories = CATEGORIES) {
  const result = new Map();
  for (const report of reports) {
    const category = categories.find(c => c.id === report.category_id);
    if (!category) continue;
    const key = JSON.stringify([report.district, report.dong, category.main]);
    const row = result.get(key) || { district: report.district, dong: report.dong, main: category.main, count: 0, resolved: 0 };
    row.count++; row.resolved += Number(report.status === 'resolved'); result.set(key, row);
  }
  return [...result.values()];
}
