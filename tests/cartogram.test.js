import test from 'node:test';
import assert from 'node:assert/strict';
import {meshFromRings,deform,geometryStats,shapePath,soften} from '../cartogram-engine.js';
const square=(x,value,id)=>({id,value,rings:[[[x,0],[x+10,0],[x+10,10],[x,10],[x,0]]]});
test('continuous deformation keeps common border vertices and improves target areas',()=>{
 const mesh=meshFromRings([square(0,1,'a'),square(10,3,'b')]);
 assert.equal(mesh.points.length,6);
 const result=deform(mesh,{iterations:180});
 const areas=result.shapes.map(s=>geometryStats(s,result.points).area);
 assert.ok(Math.abs(areas[1]/areas[0]-3)<.2,areas.join(','));
 assert.ok(result.error<.02);
 assert.equal(result.shapes[0].rings[0][1],result.shapes[1].rings[0][0]);
 assert.ok(result.points.every(p=>p.every(Number.isFinite)));
 assert.ok(!/NaN|Infinity/.test(shapePath(result.shapes[0],result.points)));
});
test('negative values use magnitude, missing is not converted to zero',()=>{
 const a=deform(meshFromRings([square(0,-1,'a'),square(10,3,'b')]),{iterations:20});
 const b=deform(meshFromRings([square(0,1,'a'),square(10,3,'b')]),{iterations:20});
 assert.deepEqual(a.points,b.points);
 const c=deform(meshFromRings([square(0,null,'a'),square(10,0,'b')]));
 assert.equal(c.error,null);assert.equal(c.shapes[0].value,null);
});

test('art fairing preserves shared indices and reports residual for displayed geometry',()=>{
 const raw=deform(meshFromRings([square(0,1,'a'),square(10,3,'b')]),{iterations:60});
 const before=JSON.stringify(raw.points),art=soften(raw);
 assert.equal(JSON.stringify(raw.points),before);
 assert.deepEqual(art.shapes,raw.shapes);
 const a=art.shapes.map(s=>geometryStats(s,art.points).area),total=a[0]+a[1];
 assert.ok(Math.abs(art.error-(Math.abs(a[0]/total-.25)+Math.abs(a[1]/total-.75))/2)<1e-12);
 assert.ok(art.points.every(p=>p.every(Number.isFinite)));
});
