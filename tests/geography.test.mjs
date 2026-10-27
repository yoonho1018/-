import test from 'node:test';
import assert from 'node:assert/strict';
import { validCoordinates, validateLocation, mapSummary } from '../public/geography.mjs';
import { CATEGORIES } from '../public/domain.mjs';

test('coordinates reject missing halves, strings, NaN, Infinity and out-of-bounds', () => {
  for (const pair of [[null,null],[undefined,127.3],['36.3',127.3],[NaN,127.3],[Infinity,127.3],[0,0],[37,127.3],[36.3,128]]) assert.equal(validCoordinates(...pair), false);
  assert.equal(validCoordinates(36.3504,127.3845), true);
  assert.equal(validateLocation({}), '');
  assert.equal(validateLocation({latitude:null,longitude:null}), '');
  assert.ok(validateLocation({latitude:36.35,longitude:null}));
  assert.ok(validateLocation({place_text:'a'.repeat(161)}));
  assert.ok(validateLocation({place_text:123}));
});
const rows = [
  {district:'유성구',category_id:'road',status:'open',latitude:36.35041,longitude:127.38451},
  {district:'유성구',category_id:'road',status:'open',latitude:36.35042,longitude:127.38452},
  {district:'서구',category_id:'waste',status:'resolved',latitude:36.36,longitude:127.38},
  {district:'동구',category_id:'road',status:'resolved'}
];
test('summary includes legacy rows only in totals; weights count colocated reports', () => {
  const s = mapSummary(rows,CATEGORIES);
  assert.equal(s.total,4); assert.equal(s.located,3); assert.equal(s.heat.length,2);
  assert.deepEqual(s.heat[0],[36.35,127.385,2]);
  assert.deepEqual(s.districts.find(d=>d.district==='동구'),{district:'동구',count:1,located:0});
});
test('main, specific category and status filters intersect', () => {
  assert.equal(mapSummary(rows,CATEGORIES,{main:'교통·도로'}).total,3);
  assert.equal(mapSummary(rows,CATEGORIES,{category:'road',status:'open'}).total,2);
  assert.equal(mapSummary(rows,CATEGORIES,{main:'환경',category:'road'}).total,0);
  assert.equal(mapSummary([],CATEGORIES).heat.length,0);
});
test('large datasets retain full totals and disclose limited map points', () => {
  const many=Array.from({length:6000},(_,i)=>({...rows[0],latitude:36.2+Math.floor(i/100)*.001,longitude:127.2+(i%100)*.001}));
  const s=mapSummary(many,CATEGORIES);
  assert.equal(s.total,6000); assert.equal(s.located,6000); assert.equal(s.heat.length,5000); assert.equal(s.truncated,true);
});
