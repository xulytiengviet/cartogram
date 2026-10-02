/** Continuous rubber-sheet area cartogram. Inspired by Dougenik et al. (1985).
 * Shared projected vertices are displaced once so shared borders stay shared.
 * Finite iterations approximate target areas; measured residual is returned.
 */
export function meshFromRings(items) {
  const points=[],lookup=new Map();
  const shapes=items.map(({id,rings,value})=>({id,value,rings:rings.map(ring=>ring.map(p=>{
    const key=p.map(v=>v.toFixed(6)).join(',');
    if(!lookup.has(key)){lookup.set(key,points.length);points.push([...p])}
    return lookup.get(key);
  }))}));
  return {points,shapes};
}
export function geometryStats(shape,points){
  let twiceArea=0,cx=0,cy=0;
  for(const ring of shape.rings)for(let i=0;i<ring.length;i++){
    const a=points[ring[i]],b=points[ring[(i+1)%ring.length]],cross=a[0]*b[1]-b[0]*a[1];
    twiceArea+=cross;cx+=(a[0]+b[0])*cross;cy+=(a[1]+b[1])*cross;
  }
  if(Math.abs(twiceArea)<1e-10){const p=points[shape.rings[0]?.[0]]||[0,0];return {area:0,centroid:[...p],signed:twiceArea}}
  return {area:Math.abs(twiceArea)/2,centroid:[cx/(3*twiceArea),cy/(3*twiceArea)],signed:twiceArea};
}
export function deform(mesh,{iterations=160,onProgress=()=>{}}={}){
  const points=mesh.points.map(p=>[...p]),shapes=mesh.shapes;
  const active=shapes.filter(s=>Number.isFinite(s.value)&&Math.abs(s.value)>0);
  const total=active.reduce((sum,s)=>sum+Math.abs(s.value),0);
  if(!total)return {points,shapes,error:null,iterations:0};
  const initial=shapes.map(s=>geometryStats(s,points));
  const validArea=active.reduce((sum,s)=>sum+geometryStats(s,points).area,0);
  // Regularize tiny targets to preserve readable, nondegenerate boundaries.
  const floor=validArea*1e-7;
  const targets=new Map(active.map(s=>[s.id,Math.max(floor,validArea*Math.abs(s.value)/total)]));
  let error=Infinity,completed=0;
  for(let iteration=0;iteration<iterations;iteration++){
    const stats=shapes.map(s=>geometryStats(s,points));
    const actual=active.reduce((sum,s)=>sum+stats[shapes.indexOf(s)].area,0);
    const areaScale=actual/validArea;
    const forces=[];
    for(let j=0;j<shapes.length;j++){
      const s=shapes[j],stat=stats[j];
      if(stat.area<1e-9)continue;
      // Missing observations have no target force; they deform passively.
      if(!Number.isFinite(s.value))continue;
      const desired=s.value===0?floor*areaScale:targets.get(s.id)*areaScale;
      const radius=Math.sqrt(stat.area/Math.PI);
      forces.push({center:stat.centroid,radius,mass:Math.sqrt(desired/Math.PI)-radius});
    }
    const deltas=points.map(([x,y])=>{
      let dx=0,dy=0;
      for(const {center,radius,mass} of forces){
        const vx=x-center[0],vy=y-center[1],distance=Math.hypot(vx,vy);
        if(distance<1e-10)continue;
        const t=distance/radius;
        const force=distance>radius?mass/t:mass*t*t*(4-3*t);
        dx+=force*vx/distance;dy+=force*vy/distance;
      }
      const damping=.22,limit=2.5,scale=Math.min(damping,limit/(Math.hypot(dx,dy)||1));
      return [dx*scale,dy*scale];
    });
    // Backtrack if an entire feature reverses orientation in this step.
    let factor=1,next,accepted=false;
    for(let attempt=0;attempt<8;attempt++){
      next=points.map((p,i)=>[p[0]+deltas[i][0]*factor,p[1]+deltas[i][1]*factor]);
      if(shapes.every((s,j)=>{const a=geometryStats(s,next);return a.area>1e-10&&a.signed*initial[j].signed>0})){accepted=true;break;}
      factor*=.5;
    }
    if(!accepted)break;
    for(let i=0;i<points.length;i++){points[i][0]=next[i][0];points[i][1]=next[i][1]}
    completed=iteration+1;
    if(iteration%10===9||iteration===iterations-1){
      const areas=active.map(s=>geometryStats(s,points).area),sum=areas.reduce((a,b)=>a+b,0);
      error=areas.reduce((e,a,i)=>e+Math.abs(a/sum-Math.abs(active[i].value)/total),0)/2;
      onProgress({iteration:completed,error});
      if(error<.015)break;
    }
  }
  // One common fit transform preserves all area ratios and shared boundaries.
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=Math.min(950/(maxX-minX||1),490/(maxY-minY||1));
  for(const p of points){p[0]=500+(p[0]-(minX+maxX)/2)*scale;p[1]=270+(p[1]-(minY+maxY)/2)*scale}
  return {points,shapes,error,iterations:completed};
}
export function shapePath(shape,points){return shape.rings.map(ring=>'M'+ring.map(i=>points[i].map(v=>v.toFixed(3)).join(',')).join('L')+'Z').join('')}

/** Gentle shared-vertex fairing for the art view; no independent polygon smoothing.
 * Movement is bounded by the shortest incident edge; area residual is remeasured.
 */
export function soften(result){
 const points=result.points.map(p=>[...p]),neighbors=points.map(()=>new Set());
 for(const shape of result.shapes)for(const ring of shape.rings)for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];if(a!==b){neighbors[a].add(b);neighbors[b].add(a)}
 }
 for(let pass=0;pass<3;pass++){
  const next=points.map((p,i)=>{
   const ids=[...neighbors[i]];if(!ids.length)return [...p];
   let x=0,y=0,shortest=Infinity;
   for(const j of ids){x+=points[j][0];y+=points[j][1];shortest=Math.min(shortest,Math.hypot(points[j][0]-p[0],points[j][1]-p[1]))}
   const dx=x/ids.length-p[0],dy=y/ids.length-p[1],factor=Math.min(.16,.1*shortest/(Math.hypot(dx,dy)||1),.7/(Math.hypot(dx,dy)||1));
   return [p[0]+dx*factor,p[1]+dy*factor];
  });
  if(!result.shapes.every(s=>geometryStats(s,next).signed*geometryStats(s,points).signed>0))break;
  for(let i=0;i<points.length;i++)points[i]=next[i];
 }
 const active=result.shapes.filter(s=>Number.isFinite(s.value)&&Math.abs(s.value)>0),total=active.reduce((t,s)=>t+Math.abs(s.value),0),areas=active.map(s=>geometryStats(s,points).area),area=areas.reduce((a,b)=>a+b,0);
 const error=total&&area?areas.reduce((e,a,i)=>e+Math.abs(a/area-Math.abs(active[i].value)/total),0)/2:null;
 return {...result,points,error};
}
