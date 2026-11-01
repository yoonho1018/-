import test from 'node:test';
import assert from 'node:assert/strict';
import { officialLinks } from '../public/official-links.mjs';
import { CATEGORIES, DISTRICTS } from '../public/domain.mjs';
test('all category/area combinations have safe official fallback links', () => {
  for (const district of DISTRICTS) for (const category of CATEGORIES) {
    const links = officialLinks({district,category_id:category.id});
    assert.ok(links.length >= 2);
    assert.equal(new Set(links.map(l=>l.url)).size,links.length);
    for (const link of links) {
      const url = new URL(link.url);
      assert.equal(url.protocol,'https:');
      assert.ok(['www.daejeon.go.kr','www.yuseong.go.kr','www.djjunggu.go.kr','www.daedeok.go.kr','www.tashu.or.kr'].includes(url.hostname));
      assert.ok(link.kind && link.description);
    }
  }
});
test('district and category routing does not suggest another district department', () => {
  assert.match(officialLinks({district:'유성구',category_id:'noise'})[0].url,/sub06_03_19/);
  assert.match(officialLinks({district:'유성구',category_id:'waste'})[0].url,/sub06_03_20/);
  assert.match(officialLinks({district:'서구',category_id:'bicycle'})[0].url,/tashu/);
  for (const district of ['서구','동구','중구','대덕구']) assert.ok(officialLinks({district,category_id:'noise'}).every(l=>!l.url.includes('yuseong')));
  assert.ok(officialLinks({district:'유성구',category_id:'scooter'}).every(l=>!l.url.includes('tashu')));
});
