import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {DONG_CENTERS} from '../public/dong-centers.mjs';
import {validCoordinates} from '../public/geography.mjs';

const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_ROOT+'/package.json');
const {chromium}=require('playwright');
for(const names of Object.values(DONG_CENTERS)) for(const point of Object.values(names)) assert.ok(validCoordinates(...point));
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(() => {
    window.locationRequests=[];
    Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(success,error){
      window.locationRequests.push({success,error});
    }}});
  });
  await page.goto(process.env.CHECK_URL || 'http://127.0.0.1:5173/#report');
  await page.locator('[name=district]').selectOption('유성구');
  await page.locator('[name=dong]').fill('신성동');
  await page.getByText('유성구 신성동 주변으로 이동했어요.',{exact:false}).waitFor();
  await page.locator('#pick-center').click();
  assert.ok((await page.locator('#location-output').innerText()).includes(DONG_CENTERS['유성구']['신성동'][0].toFixed(6)));
  await page.locator('[name=dong]').fill('궁동');
  await page.getByText('유성구 궁동 주변으로 이동했어요.',{exact:false}).waitFor();
  assert.equal(await page.locator('#location-output').innerText(),'위치 미선택');
  await page.locator('[name=district]').selectOption('서구');
  await page.locator('[name=dong]').fill('둔산1동');
  await page.getByText('서구 둔산1동 주변으로 이동했어요.',{exact:false}).waitFor();
  await page.locator('[name=dong]').fill('없는동');
  await page.getByText('해당 구에서 동을 찾지 못했어요.',{exact:false}).waitFor();
  await page.locator('#current-location').click();
  await page.evaluate(()=>window.locationRequests.at(-1).success({coords:{latitude:36.36,longitude:127.35,accuracy:20}}));
  assert.ok((await page.locator('#location-output').innerText()).includes('36.360000'));
  for(const code of [1,2,3]){
    await page.locator('#current-location').click();
    await page.evaluate(code=>window.locationRequests.at(-1).error({code}),code);
    assert.ok((await page.locator('#location-search-note').innerText()).includes(['','권한','찾지 못','초과'][code]));
  }
  await page.locator('#current-location').click();
  await page.evaluate(()=>window.locationRequests.at(-1).success({coords:{latitude:37.57,longitude:126.98,accuracy:10}}));
  assert.ok((await page.locator('#location-search-note').innerText()).includes('범위 밖'));
  assert.ok((await page.locator('#location-output').innerText()).includes('36.360000'));
  await page.locator('#current-location').click();
  await page.locator('#clear-location').click();
  await page.evaluate(()=>window.locationRequests.at(-1).success({coords:{latitude:36.36,longitude:127.35,accuracy:20}}));
  assert.equal(await page.locator('#location-output').innerText(),'위치 미선택');
  await page.locator('#current-location').click();
  await page.locator('a[data-page=board]').click();
  await page.evaluate(()=>window.locationRequests.at(-1).success({coords:{latitude:36.36,longitude:127.35,accuracy:20}}));
  assert.deepEqual(errors,[]);
  await page.locator('a[data-page=report]').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
  console.log('PASS dong centers, administrative names, current location, permission/timeouts, out-of-area and stale callbacks.');
} finally {await browser.close();}
