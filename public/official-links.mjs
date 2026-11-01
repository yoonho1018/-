// Official navigation and page content reviewed on 2026-11-01.
// Descriptions are routing suggestions, not a determination of legal jurisdiction.
export const OFFICIAL_LINKS_CHECKED = '2026-11-01';
const cityRequest = { title: '대전시에 바란다 · 국민신문고', url: 'https://www.daejeon.go.kr/drh/DrhContentsHtmlView.do?menuSeq=4769', kind: '민원 창구', description: '대전시 공식 민원 창구입니다. 신청 시 발생 지역과 처리기관을 확인하세요.' };
const safetyGuide = { title: '대전시 안전신문고 안내', url: 'https://www.daejeon.go.kr/drh/DrhContentsHtmlView.do?menuSeq=4741', kind: '신고 안내', description: '도로·시설물·보행 안전과 생활불편의 신고 경로를 확인하세요.' };
const environmentGuide = { title: '대전시 환경신문고 안내', url: 'https://www.daejeon.go.kr/drh/DrhContentsHtmlView.do?menuSeq=4775', kind: '신고 안내', description: '악취, 소음·진동, 폐기물 등 환경오염 신고 대상과 방법을 확인하세요.' };
const localRequest = {
  '유성구': { title: '유성구 온라인민원상담', url: 'https://www.yuseong.go.kr/kor/sub01_02_01_01.do', kind: '민원 창구', description: '유성구청 민원 메뉴에서 연결되는 온라인 상담 창구입니다.' },
  '중구': { title: '중구에 바란다', url: 'https://www.djjunggu.go.kr/kr/sub02_03_01.do', kind: '민원 창구', description: '중구청 민원신고센터의 상담 창구입니다.' },
  '대덕구': { title: '대덕구 1:1 민원상담', url: 'https://www.daedeok.go.kr/dpt/dpt01/DPT0101_cmmMinwonWrite.do?type=0', kind: '민원 창구', description: '대덕구청의 온라인 민원상담 창구입니다.' }
};
export function officialLinks(report) {
  const id = report.category_id, links = [];
  if (id === 'bicycle') links.push({title:'타슈 공식 자주 묻는 질문',url:'https://www.tashu.or.kr/faqList.do',kind:'운영기관 안내',description:'타슈인 경우 이용·반납 안내와 공식 고객센터를 확인하세요. 다른 공유자전거는 해당 운영사에 확인해야 합니다.'});
  if (report.district === '유성구' && ['odor','noise'].includes(id)) links.push({title:'유성구 기후환경과 업무 안내',url:'https://www.yuseong.go.kr/kor/sub06_03_19_01.do',kind:'관련 부서 안내',description:'생활소음·환경 관리 업무와 직원 안내를 확인할 수 있습니다. 개별 사례의 담당 여부는 기관에 확인하세요.'});
  if (report.district === '유성구' && id === 'waste') links.push({title:'유성구 폐기물·청소 업무 안내',url:'https://www.yuseong.go.kr/kor/sub06_03_20_01.do',kind:'관련 부서 안내',description:'생활폐기물 처리와 무단배출 관련 업무를 확인할 수 있습니다.'});
  if (report.district === '중구' && id === 'parking') links.push({title:'중구 불법주정차 스마트폰 신고 안내',url:'https://www.djjunggu.go.kr/kr/sub02_03_13.do',kind:'신고 안내',description:'주정차 주민신고 대상과 제출 요건은 공식 안내에서 확인하세요.'});
  if (report.district === '대덕구' && ['odor','noise','waste'].includes(id)) links.push({title:'대덕구 환경신문고',url:'https://www.daedeok.go.kr/dpt/dpt01/DPT0101_cmmMinwonWrite.do?type=5',kind:'민원 창구',description:'환경오염 관련 상담·신고 창구입니다. 접수 대상은 해당 페이지에서 확인하세요.'});
  links.push(['odor','noise','waste'].includes(id) ? environmentGuide : safetyGuide);
  if (localRequest[report.district]) links.push(localRequest[report.district]);
  links.push(cityRequest);
  return links;
}
