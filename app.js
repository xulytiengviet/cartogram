import {shapePath} from './cartogram-engine.js';
import {selectObservations,tradeBalance,csvText} from './core.js';
const $=id=>document.getElementById(id), d3=window.d3;
const state={mode:'map',metric:'population',code:'SP.POP.TOTL',year:'latest',region:'all',selected:'VNM',palette:'spectral'};
const cartogramCache=new Map();let cartogramWorker=null,renderVersion=0;
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
 ++renderVersion;if(cartogramWorker){cartogramWorker.terminate();cartogramWorker=null}
 const id=++requestId;$('loading').hidden=false;$('loading').textContent='Đang tải số liệu…';$('export').disabled=true;$('svg-export').disabled=true;
 try{
 const data=await getData(state.code);if(id!==requestId)return;dataset=data;rows=data.rows;observations=selectObservations(rows,state.year);render();saveURL();
 }catch(error){if(id!==requestId)return;rows=[];dataset=null;observations=new Map();render();$('loading').hidden=false;$('loading').textContent=error.message+' · Chọn lại chỉ tiêu để thử lại.'}
 finally{if(id===requestId){$('export').disabled=!dataset;$('svg-export').disabled=!dataset||!!cartogramWorker}}
}
function saveURL(){const p=new URLSearchParams(state);history.replaceState(null,'','#'+p.toString())}
function validFeatures(){return visible.filter(f=>observations.has(f.id))}
function render(){
 visible=features.filter(f=>state.region==='all'||f.properties.continent===state.region);
 const values=validFeatures().map(f=>observations.get(f.id).value),extent=d3.extent(values);const lo=extent[0]??0,hi=extent[1]??0;const bound=Math.max(Math.abs(lo),Math.abs(hi));
 const palette=state.palette==='turbo'?d3.interpolateTurbo:state.palette==='viridis'?d3.interpolateViridis:t=>d3.interpolateSpectral(1-t);
 const colors=d3.range(7).map(i=>palette(.08+.84*i/6));
 color=d3.scaleQuantile().domain(values).range(colors);
 const edges=[lo,...color.quantiles(),hi];
 $('legend-gradient').style.background='none';$('legend-gradient').replaceChildren();
 colors.forEach((c,i)=>{const swatch=document.createElement('span');swatch.style.background=c;swatch.title=`${fmt(edges[i])} – ${fmt(edges[i+1])} ${series()[2]}`;$('legend-gradient').append(swatch)});
 $('min').textContent=short(lo);$('max').textContent=short(hi);$('legend-title').textContent=series()[2]+' · 7 lớp phân vị';
 $('mode-label').textContent=state.mode==='map'?'BẢN ĐỒ ĐỊA LÝ':'AREA CARTOGRAM';
 $('encoding').textContent=state.mode==='map'?'Màu từ giá trị thấp → cao, chia 7 lớp phân vị. Cùng bảng màu ở cả hai chế độ.':'Đang tính biến dạng đa giác theo diện tích…';
 const version=++renderVersion;if(cartogramWorker){cartogramWorker.terminate();cartogramWorker=null}
 $('tooltip').hidden=true;$('loading').hidden=true;
 layer.selectAll('*').remove();
 layer.append('path').datum({type:'Sphere'}).attr('d',path).attr('fill','#f4f8f8').attr('stroke','#e5eeec').attr('stroke-width',.7);
 if(state.mode==='map')layer.append('path').datum(d3.geoGraticule10()).attr('d',path).attr('fill','none').attr('stroke','#e5edeb').attr('stroke-width',.4);
 if(state.mode==='map'){
   const shapes=layer.append('g').selectAll('path').data(visible).join('path').attr('d',path).attr('fill',f=>observations.has(f.id)?color(observations.get(f.id).value):'#e4e9e7');wire(shapes);
 }else{
   const key=[state.code,state.year,state.region].join(':');
   const draw=result=>{
     if(version!==renderVersion)return;
     const lookup=new Map(result.shapes.map(s=>[s.id,s]));
     const shapes=layer.append('g').selectAll('path').data(visible).join('path')
       .attr('d',f=>shapePath(lookup.get(f.id),result.points))
       .attr('fill',f=>observations.has(f.id)?color(observations.get(f.id).value):'#dfe5e9');
     wire(shapes);
     shapes.attr('data-cartogram','area').attr('data-iso',f=>f.id);
     const error=result.error==null?'không có giá trị khác 0':`sai lệch phân bổ diện tích ${(result.error*100).toFixed(1)}%`;
     $('encoding').textContent=`Đa giác biến dạng theo |giá trị| · ${error}. Màu: 7 lớp phân vị.`;
     $('loading').hidden=true;$('svg-export').disabled=!dataset;
   };
   if(cartogramCache.has(key))draw(cartogramCache.get(key));
   else{
     $('loading').hidden=false;$('loading').textContent='Đang biến dạng ranh giới quốc gia…';$('svg-export').disabled=true;
     // Use the projection stream to clip the antimeridian before deforming.
     const items=visible.map(f=>{const rings=[];let ring;
       const stream=projection.stream({polygonStart(){},polygonEnd(){},lineStart(){ring=[];rings.push(ring)},lineEnd(){},point(x,y){ring.push([x,y])},sphere(){}});
       d3.geoStream(f,stream);
       return {id:f.id,rings:rings.filter(r=>r.length>=3),value:observations.get(f.id)?.value??null};
     });
     cartogramWorker=new Worker(new URL('./cartogram-worker.js',import.meta.url),{type:'module'});
     const worker=cartogramWorker;
     const fail=message=>{if(version!==renderVersion)return;worker.terminate();cartogramWorker=null;$('loading').textContent='Không tạo được cartogram: '+message;$('svg-export').disabled=true};
     worker.onerror=e=>fail(e.message);
     worker.onmessage=({data})=>{
       if(version!==renderVersion)return;
       if(data.type==='progress')$('loading').textContent=`Đang biến dạng ranh giới · vòng ${data.iteration}/180…`;
       if(data.type==='error')fail(data.message);
       if(data.type==='result'){worker.terminate();cartogramWorker=null;if(cartogramCache.size>=12)cartogramCache.delete(cartogramCache.keys().next().value);cartogramCache.set(key,data.result);draw(data.result)}
     };
     worker.postMessage({items});
   }
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
 const copy=$('map').cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('viewBox','0 -65 1000 710');copy.querySelectorAll('.country').forEach(el=>{el.setAttribute('stroke','white');el.setAttribute('stroke-width','.55')});
 const add=(text,y,size)=>{const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.textContent=text;t.setAttribute('x','20');t.setAttribute('y',y);t.setAttribute('font-size',size);t.setAttribute('font-family','sans-serif');t.setAttribute('fill','#193537');copy.append(t)};
 add(`${current().name} — ${series()[1]} (${series()[2]})`,-35,18);add(`${state.mode==='map'?'Cartographic':'Area cartogram | diện tích xấp xỉ tỷ lệ trị tuyệt đối'} · Năm: ${$('period').textContent} · ${state.year==='latest'?'mới nhất từng quốc gia':state.year}`,-12,11);
 add(`Nguồn: ${dataset.source} · ${dataset.retrieved} · Natural Earth · Long Ngo`,560,10);add(`Thang màu: ${$('min').textContent} → ${$('max').textContent}; 7 lớp phân vị thấp → cao; xám thiếu dữ liệu.`,579,10);
 $('legend-gradient').querySelectorAll('span').forEach((swatch,i)=>{const r=document.createElementNS('http://www.w3.org/2000/svg','rect');r.setAttribute('x',20+i*135);r.setAttribute('y',591);r.setAttribute('width',132);r.setAttribute('height',10);r.setAttribute('fill',swatch.style.background);const t=document.createElementNS('http://www.w3.org/2000/svg','title');t.textContent=swatch.title;r.append(t);copy.append(r)});
 add($('encoding').textContent,625,10);
 download(new XMLSerializer().serializeToString(copy),'image/svg+xml',`worldatlas-${state.mode}-${state.code}.svg`);
};
$('palette').onchange=e=>{state.palette=e.target.value;render();saveURL()};
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
 if(['spectral','turbo','viridis'].includes(p.get('palette')))state.palette=p.get('palette');$('palette').value=state.palette;
 $('region').value=state.region;for(const btn of document.querySelectorAll('[data-mode]')){const active=btn.dataset.mode===state.mode;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',active)}
 $('year').replaceChildren(new Option('Mới nhất','latest'),...d3.range(2025,2009,-1).map(y=>new Option(y,y)));$('year').value=state.year;
 projection=d3.geoEqualEarth().fitExtent([[22,15],[978,515]],{type:'Sphere'});path=d3.geoPath(projection);layer=svg.append('g');zoom=d3.zoom().scaleExtent([1,8]).translateExtent([[-100,-100],[1100,640]]).on('zoom',e=>layer.attr('transform',e.transform));svg.call(zoom);
 renderCatalog();renderSeries();await load();
 }catch(e){$('loading').hidden=false;$('loading').textContent='Không thể khởi tạo: '+e.message}
}
init();
