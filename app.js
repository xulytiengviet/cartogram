import {selectObservations,tradeBalance,radius,csvText} from './core.js';
const $=id=>document.getElementById(id), d3=window.d3;
const state={mode:'map',metric:'population',code:'SP.POP.TOTL',year:'latest',region:'all',selected:'VNM'};
const cache=new Map(); let catalog,features,projection,path,layer,zoom,rows=[],dataset,observations=new Map(),color,visible=[],requestId=0;
const svg=d3.select('#map');
const names=new Intl.DisplayNames(['vi'],{type:'region'});
const num=new Intl.NumberFormat('vi-VN',{maximumFractionDigits:3});
const compact=new Intl.NumberFormat('vi-VN',{notation:'compact',maximumFractionDigits:2});
const fmt=v=>v==null?'Không có dữ liệu':num.format(v);
const short=v=>v==null?'—':Math.abs(v)>=10000?compact.format(v):num.format(v);
function current(){return catalog.find(m=>m.id===state.metric)}
function series(){return current().series.find(s=>s[0]===state.code)}
function countryName(f){try{return f.properties.iso2.length===2?names.of(f.properties.iso2):f.properties.name}catch{return f.properties.name}}
function normalize(s){return s.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('đ','d')}
async function json(url){const response=await fetch(url);if(!response.ok)throw new Error(`Không tải được ${url} (${response.status})`);return response.json()}
async function getData(code){
 if(cache.has(code))return cache.get(code);
 let data;
 if(code==='TRADE.BALANCE'){
   const [a,b]=await Promise.all([getData('NE.EXP.GNFS.CD'),getData('NE.IMP.GNFS.CD')]);
   data={source:'World Bank WDI · Xuất khẩu − nhập khẩu cùng năm',url:'https://data.worldbank.org/indicator/NE.EXP.GNFS.CD',retrieved:[a.retrieved,b.retrieved].sort()[0],rows:tradeBalance(a.rows,b.rows)};
 }else data=await json(`data/${code}.json`);
 cache.set(code,data);return data;
}
function renderCatalog(){
 const term=normalize($('metric-search').value);$('indicators').replaceChildren();let category='';
 catalog.forEach((m,i)=>{
 if(!normalize(m.name+' '+m.category).includes(term))return;
 if(category!==m.category){const h=document.createElement('h3');h.className='group-title';h.textContent=m.category;$('indicators').append(h);category=m.category}
 const b=document.createElement('button');b.className='metric'+(state.metric===m.id?' active':'');b.setAttribute('aria-pressed',state.metric===m.id);
 const n=document.createElement('span');n.className='index';n.textContent=String(i+1).padStart(2,'0');const text=document.createElement('span');text.textContent=m.name;b.append(n,text);
 b.onclick=()=>{state.metric=m.id;state.code=m.series[0][0];renderCatalog();renderSeries();load()};$('indicators').append(b);
 });
}
function renderSeries(){
 $('series').replaceChildren(...current().series.map(([code,label])=>new Option(label,code)));$('series').value=state.code;
 $('category').textContent=current().category.toUpperCase();$('title').textContent=current().name;$('unit').textContent=series()[2];
 $('note').textContent=current().note||'Nguồn mở, quan sát thực tế; dữ liệu thiếu không được suy đoán hoặc thay thế bằng số 0.';
}
async function load(){
 const id=++requestId;$('loading').hidden=false;$('loading').textContent='Đang tải số liệu…';$('export').disabled=true;$('svg-export').disabled=true;
 try{
 const data=await getData(state.code);if(id!==requestId)return;dataset=data;rows=data.rows;observations=selectObservations(rows,state.year);render();$('loading').hidden=true;saveURL();
 }catch(error){if(id!==requestId)return;rows=[];dataset=null;observations=new Map();render();$('loading').hidden=false;$('loading').textContent=error.message+' · Chọn lại chỉ tiêu để thử lại.'}
 finally{if(id===requestId){$('export').disabled=!dataset;$('svg-export').disabled=!dataset}}
}
function saveURL(){const p=new URLSearchParams(state);history.replaceState(null,'','#'+p.toString())}
function validFeatures(){return visible.filter(f=>observations.has(f.id))}
function render(){
 visible=features.filter(f=>state.region==='all'||f.properties.continent===state.region);
 const values=validFeatures().map(f=>observations.get(f.id).value),extent=d3.extent(values);const lo=extent[0]??0,hi=extent[1]??0;const bound=Math.max(Math.abs(lo),Math.abs(hi));
 color=lo<0?d3.scaleDiverging([-bound,0,bound],d3.interpolatePuOr):d3.scaleSequential([lo,hi===lo?lo+1:hi],d3.interpolateRgbBasis(['#e4efe2','#a6c4a8','#5b9986','#176b60','#0d403e']));
 // Explicit colors: negative purple, positive green, neutral white.
 if(lo<0)color=d3.scaleLinear().domain([-bound,0,bound]).range(['#7860a1','#f5f5ee','#176b60']);
 $('legend-gradient').style.background=`linear-gradient(to right,${Array.from({length:11},(_,i)=>color((lo<0?-bound:lo)+i/10*(lo<0?2*bound:hi-lo))).join(',')})`;
 $('min').textContent=short(lo<0?-bound:lo);$('max').textContent=short(lo<0?bound:hi);$('legend-title').textContent=series()[2];
 $('mode-label').textContent=state.mode==='map'?'BẢN ĐỒ ĐỊA LÝ':'DORLING CARTOGRAM';
 $('encoding').textContent=state.mode==='map'?'Màu thể hiện giá trị. Cuộn để thu phóng, kéo để di chuyển.':'Diện tích ∝ |giá trị|; âm: tím, dương: xanh. Vòng tròn giữ gần vị trí địa lý.';
 layer.selectAll('*').remove();
 layer.append('path').datum({type:'Sphere'}).attr('d',path).attr('fill','#f4f8f8').attr('stroke','#e5eeec').attr('stroke-width',.7);
 layer.append('path').datum(d3.geoGraticule10()).attr('d',path).attr('fill','none').attr('stroke','#e5edeb').attr('stroke-width',.4);
 if(state.mode==='map'){
   const shapes=layer.append('g').selectAll('path').data(visible).join('path').attr('d',path).attr('fill',f=>observations.has(f.id)?color(observations.get(f.id).value):'#e4e9e7');wire(shapes);
 }else{
   layer.append('g').selectAll('path').data(visible).join('path').attr('d',path).attr('fill','#e4e9e7').attr('opacity',.45).attr('stroke','white').attr('stroke-width',.5);
   const max=d3.max(values,v=>Math.abs(v))||0;
   const normalizedTotal=max?d3.sum(values,v=>Math.abs(v)/max):0;
   const maxRadius=normalizedTotal?Math.min(55,Math.sqrt(90000/(Math.PI*normalizedTotal))):0;
   const nodes=validFeatures().filter(f=>observations.get(f.id).value!==0).map(f=>{const xy=projection(f.properties.center);return {f,anchorX:xy[0],anchorY:xy[1],x:xy[0],y:xy[1],r:radius(observations.get(f.id).value,max,maxRadius)}});
   const sim=d3.forceSimulation(nodes).randomSource(d3.randomLcg(0.42)).force('x',d3.forceX(n=>n.anchorX).strength(.13)).force('y',d3.forceY(n=>n.anchorY).strength(.13)).force('collide',d3.forceCollide(n=>n.r+1.2).iterations(5)).stop();
   for(let i=0;i<220;i++)sim.tick();
   // Resolve remaining overlaps without changing quantitative radii.
   for(let iter=0;iter<150;iter++){
     let overlaps=0;
     for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
       const a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||.001,target=a.r+b.r+1;
       if(dist<target){const correction=(target-dist)/2,ux=dx/dist||1,uy=dy/dist;a.x-=ux*correction;a.y-=uy*correction;b.x+=ux*correction;b.y+=uy*correction;overlaps++}
     }if(!overlaps)break;
   }
   if(nodes.length){
     const left=d3.min(nodes,n=>n.x-n.r),right=d3.max(nodes,n=>n.x+n.r),top=d3.min(nodes,n=>n.y-n.r),bottom=d3.max(nodes,n=>n.y+n.r);
     const fit=Math.min(1,950/(right-left),490/(bottom-top));
     const dx=left<20?20-left: right>980?980-right:0,dy=top<20?20-top:bottom>520?520-bottom:0;
     for(const n of nodes){n.x=fit<1?25+(n.x-left)*fit:n.x+dx;n.y=fit<1?25+(n.y-top)*fit:n.y+dy;n.r*=fit}
   }
   const circles=layer.append('g').selectAll('circle').data(nodes).join('circle').attr('cx',n=>n.x).attr('cy',n=>n.y).attr('r',n=>n.r).attr('fill',n=>color(observations.get(n.f.id).value)).attr('opacity',.94);
   wire(circles,n=>n.f);
   layer.append('g').attr('pointer-events','none').selectAll('text').data(nodes.filter(n=>n.r>14)).join('text').attr('x',n=>n.x).attr('y',n=>n.y+3).attr('text-anchor','middle').attr('fill',n=>d3.lab(color(observations.get(n.f.id).value)).l<55?'white':'#193537').attr('font-size',8).attr('font-family','system-ui').text(n=>n.f.id);
 }
 renderSummary();renderRanking();renderDetail();
}
function wire(selection,unwrap=d=>d){
 selection.attr('class',d=>'country'+(unwrap(d).id===state.selected?' selected':'')).attr('tabindex',0).attr('role','button').attr('aria-label',d=>{const f=unwrap(d),o=observations.get(f.id);return `${countryName(f)}: ${fmt(o?.value)}, ${o?.year??'không có năm'}`});
 selection.append('title').text(d=>{const f=unwrap(d),o=observations.get(f.id);return `${countryName(f)} · ${fmt(o?.value)} ${series()[2]} · ${o?.year??'Không có dữ liệu'}`});
 selection.on('pointermove',(event,d)=>{const f=unwrap(d),o=observations.get(f.id),box=$('map').parentElement.getBoundingClientRect();$('tooltip').hidden=false;$('tooltip').textContent=`${countryName(f)} · ${fmt(o?.value)}${o?' '+series()[2]+' · '+o.year:''}`;$('tooltip').style.left=Math.max(8,Math.min(event.clientX-box.left+14,box.width-260))+'px';$('tooltip').style.top=Math.max(0,event.clientY-box.top-55)+'px'}).on('pointerleave',()=>{$('tooltip').hidden=true}).on('click',(_,d)=>selectCountry(unwrap(d).id)).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectCountry(unwrap(d).id)}});
}
function selectCountry(id){state.selected=id;layer.selectAll('.country').classed('selected',d=>(d.f||d).id===id);renderDetail();saveURL()}
function renderSummary(){
 const valid=validFeatures(),sorted=valid.sort((a,b)=>observations.get(b.id).value-observations.get(a.id).value),top=sorted[0],vn=observations.get('VNM'),years=valid.map(f=>observations.get(f.id).year);
 $('coverage').textContent=`${valid.length} / ${visible.length}`;$('highest').textContent=top?short(observations.get(top.id).value):'—';$('highest-country').textContent=top?`${countryName(top)} · ${observations.get(top.id).year}`:'Không có dữ liệu';
 $('vietnam').textContent=short(vn?.value);$('vietnam-year').textContent=vn?`${vn.year} · ${series()[2]}`:'Không có dữ liệu';
 $('period').textContent=years.length?(d3.min(years)===d3.max(years)?String(years[0]):`${d3.min(years)}–${d3.max(years)}`):'—';$('freshness').textContent=state.year==='latest'?'Mới nhất từng quốc gia':'Cùng năm quan sát';
}
function renderRanking(){
 const term=normalize($('country-search').value);const list=visible.filter(f=>normalize(countryName(f)+' '+f.id+' '+f.properties.name).includes(term)).sort((a,b)=>(observations.get(b.id)?.value??-Infinity)-(observations.get(a.id)?.value??-Infinity));
 $('ranking').replaceChildren();
 for(const [i,f] of list.entries()){
 const o=observations.get(f.id),button=document.createElement('button');button.className='rank';const order=document.createElement('span');order.textContent=String(i+1).padStart(2,'0');const name=document.createElement('span');name.textContent=countryName(f);const value=document.createElement('strong');value.textContent=short(o?.value)+' ';const date=document.createElement('small');date.textContent=o?`(${o.year})`:'Thiếu dữ liệu';value.append(date);button.append(order,name,value);button.onclick=()=>selectCountry(f.id);$('ranking').append(button);
 }if(!list.length)$('ranking').textContent='Không tìm thấy quốc gia phù hợp.';
}
function renderDetail(){
 const f=features.find(f=>f.id===state.selected);if(!f)return;
 const o=observations.get(f.id);$('detail-name').textContent=countryName(f);$('detail-value').textContent=o?`${fmt(o.value)} ${series()[2]} · ${o.year}`:'Không có dữ liệu trong năm đã chọn';
 $('detail-note').textContent=`${series()[1]} · ${dataset?.source??'Nguồn chưa tải'}${dataset?' · Tải ngày '+dataset.retrieved:''}`;
 $('source').href=state.code==='UNDP.HDI'?'https://hdr.undp.org/data-center':state.code==='TRADE.BALANCE'?'https://data.worldbank.org/indicator/NE.EXP.GNFS.CD':`https://data.worldbank.org/indicator/${state.code}`;
 const chart=d3.select('#trend');chart.selectAll('*').remove();
 const history=new Map(rows.filter(r=>r[0]===f.id).map(r=>[r[1],r[2]]));const vals=[...history.values()];
 if(!vals.length){chart.append('text').attr('x',0).attr('y',65).attr('fill','#75858b').attr('font-size',12).text('Chưa có chuỗi thời gian.');return}
 const years=d3.extent([...history.keys()]),x=d3.scaleLinear().domain(years[0]===years[1]?[years[0]-1,years[1]+1]:years).range([50,365]),ext=d3.extent(vals),y=d3.scaleLinear().domain(ext[0]===ext[1]?[ext[0]-1,ext[1]+1]:ext).nice().range([115,15]);
 const points=d3.range(years[0],years[1]+1).map(year=>[year,history.get(year)]);
 chart.append('g').attr('transform','translate(0,115)').call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('d'))).call(g=>g.select('.domain').remove());
 chart.append('g').attr('transform','translate(50,0)').call(d3.axisLeft(y).ticks(3).tickFormat(short).tickSize(-315)).call(g=>g.select('.domain').remove()).call(g=>g.selectAll('line').attr('stroke','#e9eeeb'));
 chart.selectAll('text').attr('fill','#75858b').attr('font-size',9);
 chart.append('path').datum(points).attr('fill','none').attr('stroke','#177566').attr('stroke-width',2).attr('d',d3.line().defined(d=>Number.isFinite(d[1])).x(d=>x(d[0])).y(d=>y(d[1])));
 chart.selectAll('circle').data(points.filter(d=>Number.isFinite(d[1]))).join('circle').attr('cx',d=>x(d[0])).attr('cy',d=>y(d[1])).attr('r',3).attr('fill','#177566').append('title').text(d=>`${d[0]}: ${fmt(d[1])} ${series()[2]}`);
}
function download(content,type,name){const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
$('export').onclick=()=>{const body=[['iso3','quoc_gia','chi_tieu','don_vi','nam','gia_tri','nguon','ngay_tai']];for(const f of visible){const o=observations.get(f.id);body.push([f.id,countryName(f),series()[1],series()[2],o?.year,o?.value,dataset?.source,dataset?.retrieved])}download(csvText(body),'text/csv;charset=utf-8',`worldatlas-${state.code}-${state.year}.csv`)};
$('svg-export').onclick=()=>{
 const copy=$('map').cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('viewBox','0 -65 1000 645');copy.querySelectorAll('.country').forEach(el=>{el.setAttribute('stroke','white');el.setAttribute('stroke-width','.55')});
 const add=(text,y,size)=>{const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.textContent=text;t.setAttribute('x','20');t.setAttribute('y',y);t.setAttribute('font-size',size);t.setAttribute('font-family','sans-serif');t.setAttribute('fill','#193537');copy.append(t)};
 add(`${current().name} — ${series()[1]} (${series()[2]})`,-35,18);add(`${state.mode==='map'?'Cartographic':'Dorling cartogram | diện tích ∝ trị tuyệt đối'} · Năm: ${$('period').textContent} · ${state.year==='latest'?'mới nhất từng quốc gia':state.year}`,-12,11);
 add(`Nguồn: ${dataset.source} · ${dataset.retrieved} · Natural Earth · Long Ngo`,560,10);add(`Thang màu: ${$('min').textContent} → ${$('max').textContent}; âm tím, dương xanh; xám thiếu dữ liệu.`,579,10);
 download(new XMLSerializer().serializeToString(copy),'image/svg+xml',`worldatlas-${state.mode}-${state.code}.svg`);
};
$('metric-search').oninput=renderCatalog;$('country-search').oninput=()=>renderRanking();
$('series').onchange=e=>{state.code=e.target.value;$('unit').textContent=series()[2];load()};
$('year').onchange=e=>{state.year=e.target.value;load()};$('region').onchange=e=>{state.region=e.target.value;render();saveURL()};
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{state.mode=b.dataset.mode;for(const btn of document.querySelectorAll('[data-mode]')){btn.classList.toggle('active',btn===b);btn.setAttribute('aria-pressed',btn===b)}render();saveURL()};
$('method').onclick=()=>$('about').showModal();$('close-dialog').onclick=()=>$('about').close();
$('zoom-in').onclick=()=>svg.call(zoom.scaleBy,1.35);$('zoom-out').onclick=()=>svg.call(zoom.scaleBy,1/1.35);$('reset').onclick=()=>svg.call(zoom.transform,d3.zoomIdentity);
async function init(){
 try{
 if(!d3)throw new Error('Không tải được thư viện bản đồ.');
 [catalog,features]=await Promise.all([json('data/indicators.json'),json('data/world.geojson')]);
 features=features.features.filter(f=>f.properties.ISO_A3!=='ATA').map(f=>{const p=f.properties;return {...f,id:p.ADM0_A3==='KOS'?'XKX':p.ISO_A3!=='-99'?p.ISO_A3:p.ADM0_A3,properties:{name:p.NAME,iso2:p.ISO_A2_EH||p.ISO_A2,continent:p.CONTINENT,center:[p.LABEL_X,p.LABEL_Y]}}});
 const p=new URLSearchParams(location.hash.slice(1));if(catalog.some(m=>m.id===p.get('metric')))state.metric=p.get('metric');state.code=current().series.some(s=>s[0]===p.get('code'))?p.get('code'):current().series[0][0];if(p.get('mode')==='cartogram')state.mode='cartogram';if(p.get('year')==='latest'||/^(201\d|202[0-5])$/.test(p.get('year')))state.year=p.get('year');if([...$('region').options].some(o=>o.value===p.get('region')))state.region=p.get('region');if(features.some(f=>f.id===p.get('selected')))state.selected=p.get('selected');
 $('region').value=state.region;for(const btn of document.querySelectorAll('[data-mode]')){const active=btn.dataset.mode===state.mode;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',active)}
 $('year').replaceChildren(new Option('Mới nhất','latest'),...d3.range(2025,2009,-1).map(y=>new Option(y,y)));$('year').value=state.year;
 projection=d3.geoEqualEarth().fitExtent([[22,15],[978,515]],{type:'Sphere'});path=d3.geoPath(projection);layer=svg.append('g');zoom=d3.zoom().scaleExtent([1,8]).translateExtent([[-100,-100],[1100,640]]).on('zoom',e=>layer.attr('transform',e.transform));svg.call(zoom);
 renderCatalog();renderSeries();await load();
 }catch(e){$('loading').hidden=false;$('loading').textContent='Không thể khởi tạo: '+e.message}
}
init();
