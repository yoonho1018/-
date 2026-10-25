import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_ROOT + '/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('http://auth.test/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/config.js') return route.fulfill({ contentType: 'text/javascript', body: 'window.APP_CONFIG={url:"https://test.supabase.co",key:"sb_publishable_test"};' });
    if (pathname === '/vendor/supabase.js') return route.fulfill({ contentType: 'text/javascript', body: `
      window.calls = {signup:0,resend:0};
      let callback;
      const account = {id:'test-user'};
      window.supabase = {createClient: () => ({
        auth: {
          onAuthStateChange: cb => {callback=cb},
          getSession: async () => ({data:{session:null}}),
          signUp: async () => {window.calls.signup++; return {data:{session:null}}},
          signInWithPassword: async ({password}) => {
            if(password==='wrong') return {error:{code:'invalid_credentials'}};
            callback('SIGNED_IN',{user:account}); return {data:{user:account}};
          },
          signOut: async () => {callback('SIGNED_OUT',null);return {}},
          resend: async () => {window.calls.resend++; return {}}
        },
        from: () => ({select: () => {
          const result = Promise.resolve({error:{message:'Missing tables (test)'}});
          result.order = () => result; return result;
        }})
      })};
    ` });
    try {
      const file = pathname === '/' ? 'index.html' : pathname.slice(1);
      const contentType = file.endsWith('.html') ? 'text/html' : /\.(mjs|js)$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/jpeg';
      await route.fulfill({ contentType, body: await readFile(new URL('../public/' + file, import.meta.url)) });
    } catch { await route.fulfill({status:404,body:''}); }
  });
  await page.goto('http://auth.test/');
  await page.locator('#mode.error').waitFor();
  await page.locator('#account').click();
  assert.equal(await page.locator('#confirm-label').isVisible(), false);
  await page.locator('#signup').click();
  await page.locator('[name=email]').fill('student@example.com');
  await page.locator('[name=password]').fill('test-password');
  await page.locator('[name=confirm]').fill('different-password');
  await page.locator('#auth-submit').click();
  assert.match(await page.locator('#auth-message').textContent(), /서로 다릅니다/);
  assert.equal(await page.evaluate(() => window.calls.signup), 0);
  await page.locator('[name=confirm]').fill('test-password');
  await page.locator('#auth-submit').click();
  await page.getByText('가입 요청을 처리했습니다.', {exact:false}).waitFor();
  assert.equal(await page.locator('#confirm-label').isVisible(), false);
  await page.locator('#resend').click();
  await page.getByText('재전송을 요청했습니다.', {exact:false}).waitFor();
  assert.equal(await page.evaluate(() => window.calls.resend), 1);
  await page.locator('[name=password]').fill('wrong');
  await page.locator('#auth-submit').click();
  await page.getByText('이메일 또는 비밀번호를 확인해 주세요.').waitFor();
  await mkdir('tmp',{recursive:true});
  await page.screenshot({path:'tmp/auth-mobile.png'});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('[name=password]').fill('test-password');
  await page.locator('#auth-submit').click();
  await page.getByRole('button',{name:'로그아웃'}).waitFor();
  assert.equal(await page.locator('#auth').isVisible(), false);
  await page.locator('#account').click();
  await page.getByRole('button',{name:'로그인',exact:true}).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: mocked auth signup, confirmation, resend, errors, login despite missing DB tables, logout, mobile overflow. No real Supabase account was used.');
} finally { await browser.close(); }
