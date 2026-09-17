/* =========================================================
   TABEL PERBANDINGAN (multi metrik, periode kalender asli)
   ========================================================= */
const METRICS_CONFIG = {
  loadfactor: { label:'Load Factor', unit:'%', fmt:(v)=>v==null?'-':fmtPct(v), num:(v)=>v==null?null:v*100 },
  headway:    { label:'Headway', unit:'menit', fmt:(v)=>fmtJamMenit(v), num:(v)=>v },
  kecepatan:  { label:'Kecepatan Rata-rata', unit:'km/jam', fmt:(v)=>v==null?'-':v.toFixed(1), num:(v)=>v },
  rtt:        { label:'RTT', unit:'menit', fmt:(v)=>fmtJamMenit(v), num:(v)=>v },
  km:         { label:'Km Tempuh', unit:'km', fmt:(v)=>v==null?'-':fmtInt(v), num:(v)=>v },
  ritase:     { label:'Ritase', unit:'rit', fmt:(v)=>v==null?'-':fmtInt(v), num:(v)=>v },
  penumpang:  { label:'Jumlah Penumpang', unit:'orang', fmt:(v)=>v==null?'-':fmtInt(v), num:(v)=>v },
};

let compareMetricKey = 'loadfactor';
let comparePeriodMode = 'bulanan';
let compareRowsCache = [];
let compareBound = false;

function buildCompareTable(){
  if(!compareBound){
    document.getElementById('compareMetricSelect').addEventListener('change', (e)=>{
      compareMetricKey = e.target.value;
      rebuildCompareRows();
      renderCompareTable();
    });
    document.getElementById('lfPeriodToggle').addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-period]');
      if(!btn) return;
      comparePeriodMode = btn.dataset.period;
      document.querySelectorAll('#lfPeriodToggle button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      renderCompareTable();
    });
    document.getElementById('btnExportLf').addEventListener('click', exportCompareCsv);
    document.getElementById('btnExportLfXlsx').addEventListener('click', exportCompareXlsx);
    compareBound = true;
  }
  rebuildCompareRows();
  renderCompareTable();
}

// Susun array 12 bulan kalender (Jan..Des) per trayek untuk metrik terpilih.
function rebuildCompareRows(){
  const field = compareMetricKey;
  compareRowsCache = ROUTE_ORDER.map(code=>{
    const v = [];
    for(let m=0;m<12;m++){
      const e = entries.find(x=>x.route===code && x.monthIndex===m);
      v.push(e && typeof e[field]==='number' ? e[field] : null);
    }
    return {
      code, v,
      tw1: avg(v.slice(0,3)), tw2: avg(v.slice(3,6)), tw3: avg(v.slice(6,9)), tw4: avg(v.slice(9,12)),
      sem1: avg(v.slice(0,6)), sem2: avg(v.slice(6,12)),
      tahunan: avg(v),
    };
  });
}

function getCompareColumnsForMode(mode){
  if(mode === 'bulanan'){
    const present = monthsPresent();
    if(present.length === 0) return { columns: [], hint: 'Belum ada data.' };
    return {
      columns: present.map(m=>({ label:MONTHS12_SHORT[m], get:(r)=>r.v[m] })),
      hint: `Data bulan: ${present.map(m=>MONTHS12_SHORT[m]).join(', ')}.`,
    };
  }
  if(mode === 'triwulan'){
    return {
      columns: [
        { label:'Triwulan I (Jan\u2013Mar)', get:(r)=>r.tw1 },
        { label:'Triwulan II (Apr\u2013Jun)', get:(r)=>r.tw2 },
        { label:'Triwulan III (Jul\u2013Sep)', get:(r)=>r.tw3 },
        { label:'Triwulan IV (Okt\u2013Des)', get:(r)=>r.tw4 },
      ],
      hint: 'Rata-rata per triwulan kalender. Kolom tanpa data ditampilkan "-".',
    };
  }
  if(mode === 'semester'){
    return {
      columns: [
        { label:'Semester I (Jan\u2013Jun)', get:(r)=>r.sem1 },
        { label:'Semester II (Jul\u2013Des)', get:(r)=>r.sem2 },
      ],
      hint: 'Rata-rata per semester kalender. Kolom tanpa data ditampilkan "-".',
    };
  }
  return {
    columns: [ { label:'Tahunan (Jan\u2013Des)', get:(r)=>r.tahunan } ],
    hint: 'Rata-rata seluruh bulan yang sudah diimpor tahun ini.',
  };
}

function targetStatus(metricKey, value){
  if(value===null || value===undefined) return null;
  if(metricKey==='loadfactor') return value >= TARGETS.loadFactor ? 'good' : 'bad';
  if(metricKey==='headway') return value <= TARGETS.headway ? 'good' : 'bad';
  if(metricKey==='kecepatan') return value >= TARGETS.kecepatan ? 'good' : 'bad';
  return null;
}

function renderCompareTable(){
  const cfg = METRICS_CONFIG[compareMetricKey];
  const { columns, hint } = getCompareColumnsForMode(comparePeriodMode);
  document.getElementById('lfHint').textContent = hint;

  if(columns.length === 0){
    document.getElementById('loadFactorCompareTable').innerHTML = '';
    return;
  }

  let html = '<thead><tr><th>Trayek</th>' + columns.map(c=>`<th>${c.label}</th>`).join('') + '<th class="sep-left">Rata-rata</th></tr></thead><tbody>';
  compareRowsCache.forEach(r=>{
    const vals = columns.map(c=>c.get(r));
    const rowAvg = avg(vals.filter(v=>typeof v==='number'));
    const status = targetStatus(compareMetricKey, rowAvg);
    const avgCell = status ? `<span class="pill ${status}">${cfg.fmt(rowAvg)}</span>` : `<strong>${cfg.fmt(rowAvg)}</strong>`;
    html += `<tr><td><span class="route-dot" style="background:${routeColor(r.code)}"></span>${routeLabel(r.code)}</td>` + vals.map(v=>`<td>${cfg.fmt(v)}</td>`).join('') + `<td class="sep-left">${avgCell}</td></tr>`;
  });
  const colAvgs = columns.map(c=> avg(compareRowsCache.map(r=>c.get(r)).filter(v=>typeof v==='number')));
  const overallAvg = avg(colAvgs.filter(v=>typeof v==='number'));
  html += `<tr data-summary="1" style="background:rgba(255,255,255,0.5);"><td><strong>Rata-rata Semua Trayek</strong></td>` +
    colAvgs.map(v=>`<td><strong>${cfg.fmt(v)}</strong></td>`).join('') +
    `<td class="sep-left"><strong>${cfg.fmt(overallAvg)}</strong></td></tr>`;
  html += '</tbody>';
  document.getElementById('loadFactorCompareTable').innerHTML = html;
  const searchBox = document.getElementById('compareSearchInput');
  if(searchBox && searchBox.value) filterTableRows('loadFactorCompareTable', searchBox.value);
}

function buildCompareExportRows(){
  const cfg = METRICS_CONFIG[compareMetricKey];
  const { columns } = getCompareColumnsForMode(comparePeriodMode);
  if(columns.length === 0) return null;
  const numFmt = (v)=> v==null ? '' : Number(cfg.num(v).toFixed(2));

  const header = ['Trayek', ...columns.map(c=>`${c.label} (${cfg.unit})`), `Rata-rata (${cfg.unit})`];
  const rows = [header];
  compareRowsCache.forEach(r=>{
    const vals = columns.map(c=>c.get(r));
    const rowAvg = avg(vals.filter(v=>typeof v==='number'));
    rows.push([routeLabel(r.code), ...vals.map(numFmt), numFmt(rowAvg)]);
  });
  const colAvgs = columns.map(c=> avg(compareRowsCache.map(r=>c.get(r)).filter(v=>typeof v==='number')));
  const overallAvg = avg(colAvgs.filter(v=>typeof v==='number'));
  rows.push(['Rata-rata Semua Trayek', ...colAvgs.map(numFmt), numFmt(overallAvg)]);
  return rows;
}

function exportCompareCsv(){
  const rows = buildCompareExportRows();
  if(!rows) return;
  downloadCsvRows(`${compareMetricKey}-${comparePeriodMode}-${new Date().toISOString().slice(0,10)}.csv`, rows);
}
function exportCompareXlsx(){
  const rows = buildCompareExportRows();
  if(!rows) return;
  downloadXlsxRows(`${compareMetricKey}-${comparePeriodMode}-${new Date().toISOString().slice(0,10)}.xlsx`, rows, 'Perbandingan');
}

