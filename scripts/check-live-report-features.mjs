import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_ROOT + '/package.json');
const {chromium} = require('playwright');
const accounts = JSON.parse(await readFile('tmp/report-test-accounts.json', 'utf8'));
const browser = await chromium.launch({channel:'msedge', headless:true});
let owner, viewer;
try {
  const contexts = await Promise.all(accounts.map(() => browser.newContext()));
  [owner, viewer] = await Promise.all(contexts.map(context => context.newPage()));
  for (const [index, page] of [owner,viewer].entries()) {
    await page.goto('https://ddd-gilt-two.vercel.app/#report');
    await page.locator('#mode.live').waitFor();
    await page.locator('#account').click();
    await page.locator('#auth-form [name=email]').fill(accounts[index].email);
    await page.locator('#auth-form [name=password]').fill(accounts[index].password);
    await page.locator('#auth-submit').click();
    await page.getByRole('button',{name:'로그아웃'}).waitFor();
    await page.evaluate(() => { window.testClient = window.supabase.createClient(window.APP_CONFIG.url,window.APP_CONFIG.key); });
  }
  await owner.locator('[name=district]').selectOption('유성구');
  await owner.locator('[name=dong]').fill('신성동');
  await owner.locator('[name=content]').fill('[기능 검증 후 삭제] 사진 열람과 알림 테스트 제보입니다.');
  await owner.locator('[name=photo]').setInputFiles('public/assets/street.jpg');
  await owner.locator('.photo-preview img').waitFor();
  await owner.locator('#analyze').click();
  await owner.locator('[value=other]').check();
  await owner.locator('#submit-report').click();
  await owner.locator('.success-title').waitFor();
  await owner.waitForFunction(() => document.querySelector('.report-photo')?.naturalWidth > 0);
  const record = await owner.evaluate(async () => {
    const {data:{user}} = await window.testClient.auth.getUser();
    const result = await window.testClient.from('reports').select('*').eq('user_id',user.id).single();
    if(result.error) throw Error(result.error.message);
    return result.data;
  });
  await viewer.goto('https://ddd-gilt-two.vercel.app/#board');
  await viewer.locator('[data-detail="'+record.id+'"]').click();
  await viewer.waitForFunction(() => document.querySelector('#detail .report-photo')?.naturalWidth > 0);
  assert.ok(await viewer.locator('#detail .report-photo').evaluate(img => img.nextElementSibling.classList.contains('detail-body')));
  console.log('PASS other member views stored photo above case text');
  await viewer.locator('[data-close=detail]').click();
  await viewer.route('**/storage/v1/object/sign/report-photos', route =>
    route.fulfill({status:503,contentType:'application/json',body:'{"message":"Test temporary failure"}'}),
    {times:1});
  await viewer.locator('[data-detail="'+record.id+'"]').click();
  await viewer.getByRole('button',{name:'사진 다시 불러오기'}).click();
  await viewer.waitForFunction(() => document.querySelector('#detail .report-photo')?.naturalWidth > 0);
  console.log('PASS photo loading recovers after temporary failure');
  await viewer.getByRole('button',{name:'상태 변경 알림 받기',exact:true}).click();
  await viewer.getByRole('button',{name:'알림 받는 중 · 해제',exact:true}).waitFor();
  const denied = await viewer.evaluate(async id => {
    const changed=await window.testClient.from('reports').update({content:'타인 수정 차단 검증용 내용입니다.'}).eq('id',id).select('id');
    const deleted=await window.testClient.from('reports').delete().eq('id',id).select('id');
    return {updated:changed.data?.length || 0,deleted:deleted.data?.length || 0};
  }, record.id);
  assert.deepEqual(denied,{updated:0,deleted:0});
  console.log('PASS other member cannot modify or delete owner report');
  await owner.locator('a[data-page=mine]').click();
  await owner.getByRole('button',{name:'수정',exact:true}).click();
  await owner.locator('[name=dong]').fill('궁동');
  await owner.locator('#submit-report').click();
  await owner.locator('[data-status]').click();
  await viewer.locator('[data-close=detail]').click();
  await viewer.locator('a[data-page=alerts]').click();
  await viewer.getByRole('button',{name:/궁동.*해결 확인/}).waitFor();
  console.log('PASS owner edit and cross-account status notification');
  await viewer.screenshot({path:'tmp/live-notifications.png'});
  owner.once('dialog',dialog => dialog.accept());
  await owner.getByRole('button',{name:'삭제',exact:true}).click();
  await owner.locator('.empty').waitFor();
  const stored = await owner.evaluate(async path => {
    const {data,error} = await window.testClient.storage.from('report-photos').list(path.split('/')[0]);
    if(error) throw Error(error.message);
    return data.length;
  },record.photo_path);
  assert.equal(stored,0);
  console.log('PASS report and stored photo deleted');
} finally {
  if(owner) {
    await owner.evaluate(async () => {
      if(!window.testClient) return;
      const {data:{user}}=await window.testClient.auth.getUser();
      if(!user) return;
      const {data}=await window.testClient.from('reports').select('id,photo_path').eq('user_id',user.id);
      if(data?.length) {
        await window.testClient.from('reports').delete().eq('user_id',user.id);
        const paths=data.map(r=>r.photo_path).filter(Boolean);
        if(paths.length) await window.testClient.storage.from('report-photos').remove(paths);
      }
    }).catch(error=>console.error('Cleanup requires attention:',error.message));
  }
  await browser.close();
}
