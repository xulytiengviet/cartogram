import test from 'node:test';
import assert from 'node:assert/strict';
import {selectObservations,tradeBalance,radius,csvText} from '../core.js';
import fs from 'node:fs';
test('latest is per country, exact year never backfills, zero and negatives survive',()=>{
 const rows=[['VNM',2020,1],['VNM',2022,0],['USA',2021,-2],['JPN',2022,null]];
 assert.deepEqual([...selectObservations(rows,'latest')],[['VNM',{year:2022,value:0}],['USA',{year:2021,value:-2}]]);
 assert.deepEqual([...selectObservations(rows,'2020')],[['VNM',{year:2020,value:1}]]);
});
test('balance only subtracts observations in the same country and year',()=>{
 assert.deepEqual(tradeBalance([['VNM',2022,10],['VNM',2023,8]],[['VNM',2022,14],['USA',2023,1]]),[['VNM',2022,-4]]);
});
test('cartogram area ratio equals absolute value ratio',()=>{
 assert.equal(radius(0,100),0);assert.equal(radius(-25,100),radius(25,100));
 assert.equal(radius(100,100)**2/radius(25,100)**2,4);
});
test('CSV quotes data and preserves Unicode',()=>assert.equal(csvText([['Việt Nam','a"b',0]]),'\uFEFF"Việt Nam","a""b","0"'));
test('30 groups, all source snapshots exist with finite observations',()=>{
 const catalog=JSON.parse(fs.readFileSync(new URL('../data/indicators.json',import.meta.url)));assert.equal(catalog.length,30);
 for(const m of catalog)for(const [code] of m.series){if(code==='TRADE.BALANCE')continue;
 const data=JSON.parse(fs.readFileSync(new URL('../data/'+code+'.json',import.meta.url)));assert.ok(data.rows.length>0,code);assert.ok(data.source&&data.url&&data.retrieved);
 for(const [iso,year,value] of data.rows){assert.equal(iso.length,3);assert.ok(year>=2010&&year<=2025);assert.ok(Number.isFinite(value))}
 }
});
