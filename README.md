# 동네기록

대전 생활불편 제보를 키워드로 분류하고 게시판, 지역 통계, 민원 안내를 제공하는 정보과학 프로젝트입니다.

## 먼저 보기

프로젝트 최상위의 `index.html`을 더블클릭하면 체험판이 열립니다. 인터넷 없이도 작동하며, 예시 데이터 8건과 브라우저에 저장한 체험 제보를 사용합니다. 이 파일은 항상 체험 모드이며 Supabase에 연결되지 않습니다.

기능: 제보 분류/수정/등록, 지역·분야 검색, 페이지 이동, 지역 통계, 메인·세부 분류별 민원 안내, 내 제보와 해결 여부 변경.

분류는 12개 세부 분야별 100개씩의 표현 사전(총 1,200개)과 TF-IDF 코사인·자카드 유사도를 사용합니다. 관련 후보만 최대 3개 추천하고 그중 하나를 선택합니다. 근거가 부족하면 내용을 보완하도록 표시합니다. 조사 출처, 계산식, 검증 범위는 `docs/classification.md`에 있습니다. 기존 Supabase DB의 사전만 갱신하려면 `supabase/update-keywords.sql`을 SQL Editor에서 실행합니다.

운영 소스는 `public/`에 있습니다. 운영 버전의 회원가입·로그인은 Supabase Auth를 사용합니다. 실제 DB 연결과 배포 확인은 아직 필요합니다. 사진 첨부와 동 이름 자동완성은 이번 버전에 포함하지 않았습니다.

## 1. Supabase 준비

1. https://supabase.com/dashboard 에서 GitHub 계정으로 로그인합니다.
2. 새 조직을 만들 경우 Personal / Free를 선택하고 새 프로젝트를 만듭니다. 이름은 `dongne-record` 등으로 정하고 DB 비밀번호는 개인적으로 보관합니다.
3. 프로젝트가 준비되면 SQL Editor의 새 쿼리에 `supabase/schema.sql` 내용을 넣고 Run을 누릅니다. 새 프로젝트에서 한 번만 실행합니다.
4. 새 쿼리에 `supabase/seed.sql` 내용을 넣고 Run을 누릅니다.
5. Table Editor에서 `main_guides` 4개, `categories` 12개, `reports` 0개가 보이는지 확인합니다. 운영 DB에는 예시 제보를 넣지 않습니다.
6. Connect 또는 Settings > API Keys에서 Project URL과 `sb_publishable_`로 시작하는 Publishable key를 찾습니다. Secret key와 DB 비밀번호는 앱 연결용으로 사용하지 않습니다.

## 2. 내 컴퓨터에서 실제 DB 연결

`.env.example`을 참고해 프로젝트 폴더의 `.env.local`에 아래 두 값을 설정합니다. `.env.local`은 GitHub에 올리지 않습니다.

```text
SUPABASE_URL=https://프로젝트주소.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_공개키
```

터미널에서 `node scripts/dev.mjs`를 실행하고 출력된 주소로 접속합니다. 두 값이 없으면 체험 모드, 값이 있으면 운영 연결을 사용합니다. 연결 오류를 체험 모드로 숨기지 않습니다.

이 프로젝트는 Next.js가 아니므로 수업 자료의 `NEXT_PUBLIC_` 접두사 없이 위 이름을 사용합니다. Publishable key는 브라우저에 전달되는 공개키이며 실제 데이터 권한은 SQL에 설정한 RLS로 제어합니다.

## 3. Vercel 배포

Supabase 연결 전 체험판부터 배포할 때는 Vercel Environment Variables에 `DEMO_MODE=true`를 추가합니다. 화면에 체험 모드가 표시되고 제보는 방문자의 브라우저에만 저장됩니다. 실제 DB 연동으로 전환할 때는 이 변수를 삭제하고 아래 두 Supabase 변수를 설정한 뒤 재배포합니다. DB 연결 없이 배포해도 Supabase 사용 과제 조건을 충족하는 것은 아닙니다.

1. 개발 코드를 GitHub에 commit/push합니다. 오늘 작성한 코드는 아직 자동으로 push하지 않았습니다.
2. Vercel의 Add New > Project에서 해당 GitHub 저장소를 Import합니다.
3. 프로젝트 이름은 `dongne-record` 같은 영문 이름을 사용합니다. Framework Preset은 Other, Root Directory는 저장소 최상위입니다.
4. Environment Variables에 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 위와 똑같이 등록합니다.
5. 저장소의 `vercel.json`이 Build Command `node scripts/build.mjs`, Output Directory `dist`를 지정합니다. 다른 값으로 설정돼 있다면 일치시키고 Deploy를 누릅니다.
6. Ready 상태와 실제 배포 주소를 확인합니다. 키가 없으면 빌드가 실패하도록 되어 있어 체험판을 운영판으로 착각하지 않게 합니다.
7. Supabase > Authentication > URL Configuration에서 Site URL을 Vercel 운영 주소로 설정합니다. 로컬 테스트가 필요하면 Redirect URLs에 실제 로컬 주소도 추가합니다.
8. 배포 사이트에서 회원가입하고 이메일 인증 후 로그인합니다. 인증 메일이 오지 않으면 스팸함 및 Supabase 메일 전송 제한을 확인합니다. 운영 메일 설정은 Supabase의 SMTP 설정에서 관리합니다.
9. 제보 등록 후 Supabase Table Editor의 `reports`에 한 행이 생겼는지 확인하고, 새로고침한 게시판과 통계를 확인합니다. 다른 계정이 내 제보 상태를 수정할 수 없는지도 확인합니다.

환경 변수를 바꾼 뒤에는 Vercel에서 재배포해야 반영됩니다. 파일로 여는 `index.html`은 배포 성공 여부를 확인하는 용도가 아닙니다.

## 수업 자료 쪽수

`GitHub, Vercel, Supabase.pdf`의 PDF 뷰어 기준 전체 페이지 번호입니다. 슬라이드 아래 작은 쪽수와 다릅니다.

- 34~36쪽: Vercel GitHub App 설치와 접근 범위. 과거 대화에서는 이 설정 화면까지 확인했습니다. 저장 완료는 재확인이 필요합니다.
- 47~48쪽: GitHub push와 파일 확인. 지난 초기 페이지 커밋은 완료 기록이 있습니다.
- 50~54쪽: Vercel Import, Deploy, Ready 확인. 완료 여부 미확인.
- 56~60쪽: Supabase 가입, 프로젝트 생성. 완료 여부 미확인.
- 63~64쪽: Supabase 연결 주소와 공개키 찾기.
- 69~71쪽: Vercel에서 Supabase 연결 정보 설정 및 배포.

## 지도와 히트맵

- 기존 프로젝트는 `supabase/map-locations.sql`을 한 번 적용합니다. 새 프로젝트는 `schema.sql`, `seed.sql`, `map-locations.sql` 순서입니다.
- 제보에 상세 장소(160자 이하)와 지도 위치를 선택적으로 저장합니다. 구를 바꾸면 기존 핀을 지웁니다. 좌표는 대전 주변 사각 범위만 검증하며 행정구역 자동 판정이나 주소 검색은 하지 않습니다.
- 게시글 상세에서 작성자가 찍은 위치를 봅니다. 좌표가 없는 기존 제보에 임의의 위치를 부여하지 않습니다.
- 문제 지도는 분야, 세부 문제, 해결 상태를 함께 필터링합니다. 구별 건수는 작성자가 입력한 구 기준이며 위치 미등록 제보도 포함합니다.
- `report_map_data`는 RLS를 따르는 security-invoker 함수입니다. REST 기본 행 수 제한으로 합계가 잘리지 않도록 서버에서 JSON으로 집계합니다. 지도는 좌표를 소수 셋째 자리(약 100m 격자)로 묶고, 최대 5,000개 집계 지점을 표시합니다. 초과 시 화면에 제한을 알리며 전체 합계는 유지합니다.
- 히트맵 색은 현재 필터에서의 상대적인 공간 밀집도입니다. 위험도나 인구 대비 발생률이 아닙니다. 반복 제보도 각각 한 건으로 계산합니다.
- Leaflet 1.9.4, Leaflet.heat 0.2.0을 버전 고정하여 `public/vendor`에 포함했습니다. 라이선스 파일도 함께 보관합니다. 지도 배경은 OpenStreetMap의 표준 타일이며 API 키가 필요하지 않습니다. 출처 표기와 브라우저 캐시를 유지하며 대량 다운로드하지 않습니다. 트래픽 증가 시 [타일 이용 정책](https://operations.osmfoundation.org/policies/tiles/)에 따라 별도 제공자로 전환해야 합니다.
- 파일로 여는 독립 HTML은 Referer를 제공하지 못하므로 외부 지도 타일을 요청하지 않습니다. 실제 지도 배경은 로컬 HTTP 서버 또는 Vercel 사이트에서 확인하세요.
- `node --test tests/*.test.mjs`로 좌표·집계·분류를 검사합니다. `scripts/check-maps.mjs`는 체험 데이터로 위치 선택, 저장, 히트맵 픽셀, 필터, 모바일, 화면 전환을 검사합니다. Playwright 설치 경로를 `PLAYWRIGHT_PACKAGE_ROOT`로 전달합니다.

## 기존 검사

- `node --test tests/domain.test.mjs`: 분류, 동점, 입력 검증, 통계, 키 설정 검사.
- `node scripts/seed.mjs`: 분류 데이터로 SQL 초기 데이터 생성.
- `node scripts/preview.mjs`: 운영 소스로 독립 체험 HTML 재생성. 운영 키는 포함하지 않습니다.
- `node scripts/build.mjs`: 환경 변수로 배포 파일 생성.

DB 권한은 공개 조회, 로그인 사용자 본인 제보 생성, 본인 제보의 상태만 수정하도록 설계했습니다. 실제 Supabase 환경의 권한 검증은 연결 후 진행해야 합니다. 동 이름은 직접 입력하므로 철자 차이에 따라 통계가 나뉠 수 있습니다. 키워드 분류는 진단이나 공공기관의 공식 분류가 아닙니다.

외부 자산: Lucide 0.468.0 (ISC), Supabase JS 2.57.4 (MIT), Unsplash 도시 거리 사진. 사진은 대전 현장 사진이 아닙니다. 민원 링크는 안전신문고와 국민신문고의 공식 홈페이지이며, 개별 접수 기준은 해당 서비스에서 확인합니다.
