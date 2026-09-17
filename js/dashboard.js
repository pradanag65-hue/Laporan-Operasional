/* =========================================================
   RING (donut) KPI helper
   ========================================================= */
let ringCharts = {};
function renderRing(canvasId, pctFill, color){
  if(ringCharts[canvasId]) ringCharts[canvasId].destroy();
  const ctx = document.getElementById(canvasId);
  if(!chartReady() || !ctx) return;
  ringCharts[canvasId] = new Chart(ctx, {
    type:'doughnut',
    data:{ datasets:[{ data:[pctFill, 100-pctFill], backgroundColor:[color, COL_LINE], borderWidth:0 }] },
    options:{
      cutout:'72%', responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{display:false}, tooltip:{enabled:false} },
      animation:{ duration:500 },
    }
  });
}

function kpiCardHtml(id, label, value, unit, ringText, deltaHtml, accentColor){
  return `
  <div class="kpi" style="--kpi-accent:${accentColor || 'var(--brand-500)'}">
    <div class="ring-wrap">
      <canvas id="ring-${id}"></canvas>
      <div class="ring-value">${ringText}</div>
    </div>
    <div class="kpi-body">
      <div class="label">${label}</div>
      <div class="value">${value}<span> ${unit}</span></div>
      ${deltaHtml || ''}
    </div>
  </div>`;
}

function deltaHtml(current, previous, higherIsBetter=true, prevMonthShort=null, prevValueText=null){
  if(current==null || previous==null || previous===0 || !prevMonthShort) return '';
  const diff = current - previous;
  const pct = (diff/Math.abs(previous))*100;
  const isUp = diff >= 0;
  const good = higherIsBetter ? isUp : !isUp;
  const cls = diff===0 ? 'neutral' : (good ? 'up' : 'down');
  const arrow = diff===0 ? '' : (isUp ? '&#8593; ' : '&#8595; ');
  const titleAttr = prevValueText ? ` title="${prevMonthShort}: ${prevValueText}"` : '';
  return `<span class="delta ${cls}"${titleAttr}>${arrow}${Math.abs(pct).toFixed(1)}% vs ${prevMonthShort}</span>`;
}

/* =========================================================
   RINGKASAN
   ========================================================= */
function monthsPresent(){
  const set = new Set(entries.map(e=>e.monthIndex));
  return [...set].sort((a,b)=>a-b);
}

function buildRingkasan(){
  const empty = document.getElementById('ringkasanEmpty');
  const content = document.getElementById('ringkasanContent');
  if(entries.length === 0){
    empty.style.display = 'block';
    content.style.display = 'none';
    document.getElementById('kpiRow').innerHTML = '';
    document.getElementById('ringkasanPeriodLabel').textContent = 'Belum ada data';
    return;
  }
  empty.style.display = 'none';
  content.style.display = 'block';

  const months = monthsPresent();
  const lastMonth = months[months.length-1];
  const prevMonth = months.length>1 ? months[months.length-2] : null;
  document.getElementById('ringkasanPeriodLabel').textContent =
    months.length===1 ? MONTHS12[lastMonth]+' 2026' : `${MONTHS12[months[0]]}\u2013${MONTHS12[lastMonth]} 2026`;

  const forMonth = (m, field)=> entries.filter(e=>e.monthIndex===m && typeof e[field]==='number').map(e=>e[field]);

  const totalPnpLast = sum(forMonth(lastMonth,'penumpang'));
  const totalPnpPrev = prevMonth!=null ? sum(forMonth(prevMonth,'penumpang')) : null;

  const avgLfLast = avg(forMonth(lastMonth,'loadfactor'));
  const avgLfPrev = prevMonth!=null ? avg(forMonth(prevMonth,'loadfactor')) : null;

  const totalRitLast = sum(forMonth(lastMonth,'ritase'));
  const totalRitPrev = prevMonth!=null ? sum(forMonth(prevMonth,'ritase')) : null;

  const avgKecLast = avg(forMonth(lastMonth,'kecepatan'));
  const avgKecPrev = prevMonth!=null ? avg(forMonth(prevMonth,'kecepatan')) : null;

  const kpiRow = document.getElementById('kpiRow');
  const lastLabel = MONTHS12_SHORT[lastMonth];
  const prevLabel = prevMonth!=null ? MONTHS12_SHORT[prevMonth] : null;

  kpiRow.innerHTML =
    kpiCardHtml('pnp', `Total Penumpang &middot; ${lastLabel}`, fmtInt(totalPnpLast), 'org', '&#128101;',
      deltaHtml(totalPnpLast, totalPnpPrev, true, prevLabel, fmtInt(totalPnpPrev)+' org'), COL_TEAL) +
    kpiCardHtml('lf', `Rata-rata Load Factor &middot; ${lastLabel}`, avgLfLast==null?'-':(avgLfLast*100).toFixed(1), '%', avgLfLast==null?'-':(avgLfLast*100).toFixed(0)+'%',
      deltaHtml(avgLfLast, avgLfPrev, true, prevLabel, avgLfPrev==null?null:(avgLfPrev*100).toFixed(1)+'%'), COL_GOLD) +
    kpiCardHtml('rit', `Total Ritase &middot; ${lastLabel}`, fmtInt(totalRitLast), 'rit', '&#128257;',
      deltaHtml(totalRitLast, totalRitPrev, true, prevLabel, fmtInt(totalRitPrev)+' rit'), COL_BLUE) +
    kpiCardHtml('kec', `Kecepatan Rata-rata &middot; ${lastLabel}`, avgKecLast==null?'-':avgKecLast.toFixed(1), 'km/j', '&#9889;',
      deltaHtml(avgKecLast, avgKecPrev, true, prevLabel, avgKecPrev==null?null:avgKecPrev.toFixed(1)+' km/j'), COL_PURPLE);

  renderRing('ring-pnp', 100, COL_TEAL);
  renderRing('ring-lf', avgLfLast==null?0:Math.min(100,avgLfLast*100), COL_GOLD);
  renderRing('ring-rit', 100, COL_BLUE);
  renderRing('ring-kec', 100, COL_PURPLE);

  buildRingkasanCharts(months);
  buildCompareTable();
  renderWatchlist();
  renderLastUpdated();
}

let ringkasanCharts = {};
function destroyRingkasanCharts(){ Object.values(ringkasanCharts).forEach(c=>c.destroy()); ringkasanCharts = {}; }

function buildRingkasanCharts(months){
  destroyRingkasanCharts();
  if(!chartReady()) return; // grafik dilewati kalau Chart.js gagal dimuat
  const labels = months.map(m=>MONTHS12_SHORT[m]);
  const periodText = months.length===1 ? labels[0] : `${labels[0]}\u2013${labels[labels.length-1]}`;

  const pnpSeries = months.map(m=> sum(entries.filter(e=>e.monthIndex===m).map(e=>e.penumpang)) || null);
  ringkasanCharts.pnp = new Chart(document.getElementById('chartPenumpangBulanan'), lineCfg(labels, pnpSeries, COL_TEAL, fmtInt));
  document.getElementById('hintPenumpangBulanan').textContent = `Total seluruh trayek \u2022 ${periodText} 2026`;

  const lfSeries = months.map(m=> avg(entries.filter(e=>e.monthIndex===m).map(e=>e.loadfactor)));
  ringkasanCharts.lf = new Chart(document.getElementById('chartLoadFactorBulanan'), lineCfg(labels, lfSeries, COL_ORANGE, fmtPct));
  document.getElementById('hintLoadFactorBulanan').textContent = `Rata-rata seluruh trayek \u2022 ${periodText} 2026`;

  const lastMonth = months[months.length-1];
  const ritByRoute = ROUTE_ORDER.map(code=>{
    const e = entries.find(x=>x.route===code && x.monthIndex===lastMonth);
    return e && typeof e.ritase==='number' ? e.ritase : null;
  });
  const ritRouteCount = ritByRoute.filter(v=>typeof v==='number').length;
  ringkasanCharts.rit = new Chart(document.getElementById('chartArmada'), {
    type:'bar',
    data:{ labels: ROUTE_ORDER.map(routeLabel), datasets:[{ data: ritByRoute, backgroundColor: ROUTE_ORDER.map(routeColor), borderRadius:8, maxBarThickness:22 }] },
    options: baseBarOpts(fmtInt)
  });
  document.getElementById('hintRitaseTrayek').textContent = `Data bulan ${MONTHS12_SHORT[lastMonth]} 2026 \u2022 ${ritRouteCount}/${ROUTE_ORDER.length} trayek ada data`;

  const lfByRoute = ROUTE_ORDER.map(code=>{
    const vals = entries.filter(e=>e.route===code).map(e=>e.loadfactor);
    return avg(vals);
  });
  const lfRouteCount = lfByRoute.filter(v=>typeof v==='number').length;
  document.getElementById('hintLoadFactorTrayek').textContent = `Rata-rata ${periodText} 2026 \u2022 ${lfRouteCount}/${ROUTE_ORDER.length} trayek ada data`;
  ringkasanCharts.lfRoute = new Chart(document.getElementById('chartLoadFactor'), {
    type:'bar',
    data:{ labels: ROUTE_ORDER.map(routeLabel), datasets:[{ data: lfByRoute, backgroundColor: ROUTE_ORDER.map(routeColor), borderRadius:8, maxBarThickness:22 }] },
    options: baseBarOpts(fmtPct)
  });
}

function lineCfg(labels, data, color, yFmt){
  return {
    type:'line',
    data:{ labels, datasets:[{ data, borderColor:color, backgroundColor:color+'22', fill:true, tension:.35, pointRadius:3, pointBackgroundColor:color, spanGaps:true }] },
    options: baseLineOpts(yFmt)
  };
}
function baseLineOpts(yFmt){
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{display:false}, tooltip:{callbacks:{label:(ctx)=>yFmt(ctx.parsed.y)}} },
    scales:{ x:{ grid:{display:false} }, y:{ grid:{color:COL_LINE}, ticks:{ callback:(v)=>yFmt(v) } } }
  };
}
function baseBarOpts(yFmt){
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{display:false}, tooltip:{callbacks:{label:(ctx)=>yFmt(ctx.parsed.y)}} },
    scales:{ x:{ grid:{display:false} }, y:{ grid:{color:COL_LINE}, ticks:{ callback:(v)=>yFmt(v) } } }
  };
}

