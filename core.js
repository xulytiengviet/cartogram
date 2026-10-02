export function selectObservations(rows, year) {
  const selected = new Map();
  for (const [code, date, value] of rows) {
    if (!Number.isFinite(value) || (year !== 'latest' && date !== Number(year))) continue;
    if (!selected.has(code) || date > selected.get(code).year) selected.set(code, {year:date, value});
  }
  return selected;
}
export function tradeBalance(exports, imports) {
  const lookup = new Map(imports.map(([c,y,v])=>[`${c}:${y}`,v]));
  return exports.flatMap(([c,y,v])=>lookup.has(`${c}:${y}`)?[[c,y,v-lookup.get(`${c}:${y}`)]]:[]);
}
export function radius(value, max, maxRadius=55) {
  return max > 0 && Number.isFinite(value) ? maxRadius*Math.sqrt(Math.abs(value)/max) : 0;
}
export function csvText(rows) {
  return '\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
}
