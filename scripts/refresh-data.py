"""Refresh real observations; never invent or interpolate missing values."""
import concurrent.futures, csv, io, json, pathlib, time, urllib.request, datetime
ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
def fetch(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=90) as r: return r.read().decode('utf-8-sig')
        except Exception:
            if attempt == 2: raise
            time.sleep(2)
def save(name, obj):
    path = DATA / name
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')))
    temp.replace(path)
def wb(code):
    url=f'https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&date=2010:2025&per_page=20000'
    result=json.loads(fetch(url))
    if not isinstance(result,list) or len(result)<2 or not result[1]: raise ValueError(f'No series: {code}')
    rows=[[r['countryiso3code'],int(r['date']),r['value']] for r in result[1] if r['countryiso3code'] and r['value'] is not None]
    if not rows: raise ValueError(f'No observations: {code}')
    save(code+'.json',{'source':'World Bank WDI','url':url,'retrieved':datetime.date.today().isoformat(),'rows':rows})
    return code,len(rows)
def hdi():
    url='https://ourworldindata.org/grapher/human-development-index.csv'
    reader=csv.DictReader(io.StringIO(fetch(url)))
    value_column=next(k for k in reader.fieldnames if k not in ('Entity','Code','Year'))
    rows=[[r['Code'],int(r['Year']),float(r[value_column])] for r in reader if len(r['Code'])==3 and 2010<=int(r['Year'])<=2025 and r[value_column]]
    if not rows: raise ValueError('No HDI observations')
    save('UNDP.HDI.json',{'source':'UNDP Human Development Reports, via Our World in Data','url':url,'retrieved':datetime.date.today().isoformat(),'rows':rows})
    return 'UNDP.HDI',len(rows)
if __name__=='__main__':
    catalog=json.loads((DATA/'indicators.json').read_text())
    codes=[s[0] for g in catalog for s in g['series'] if s[0] not in ('UNDP.HDI','TRADE.BALANCE')]
    failures=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        tasks=[pool.submit(wb,c) for c in codes]+[pool.submit(hdi)]
        for task in concurrent.futures.as_completed(tasks):
            try: print(task.result(),flush=True)
            except Exception as e: failures.append(str(e)); print('FAILED',e,flush=True)
    if failures: raise SystemExit('\n'.join(failures))
