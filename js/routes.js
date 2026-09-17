/* =========================================================
   DATA TRAYEK
   ========================================================= */
let routeCharts = {};
function destroyRouteCharts(){ Object.values(routeCharts).forEach(c=>c.destroy()); routeCharts = {}; }

function buildRouteSelect(){
  const sel = document.getElementById('routeSelect');
  sel.innerHTML = ROUTE_ORDER.map(c=>`<option value="${c}">Trayek ${routeLabel(c)}</option>`).join('');
  sel.addEventListener('change', ()=>renderRoute(sel.value));
}

function routeSeries12(code, field){
  const v = [];
  for(let m=0;m<12;m++){
    const e = entries.find(x=>x.route===code && x.monthIndex===m);
    v.push(e && typeof e[field]==='number' ? e[field] : null);
  }
  return v;
}

function renderRoute(code){
  document.getElementById('routeBadge').textContent = routeLabel(code);
  document.getElementById('routeBadge').style.background = routeColor(code);
  const hasData = entries.some(e=>e.route===code);
  const empty = document.getElementById('trayekEmpty');
  const content = document.getElementById('trayekContent');
  if(!hasData){
    empty.style.display = 'block';
    content.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  content.style.display = 'block';
  destroyRouteCharts();

  const present = monthsPresent();
  const labels = present.map(m=>MONTHS12_SHORT[m]);
  const pick = (field)=> present.map(m=>{ const e = entries.find(x=>x.route===code && x.monthIndex===m); return e && typeof e[field]==='number' ? e[field] : null; });

  const pnp = pick('penumpang'), rit = pick('ritase'), lf = pick('loadfactor'), hw = pick('headway'), rtt = pick('rtt'), kec = pick('kecepatan'), km = pick('km');

  if(!chartReady()){ renderRouteTable(labels, {pnp, rit, lf, hw, rtt, kec, km}); return; }
  routeCharts.pnp = new Chart(document.getElementById('chartRoutePenumpang'), lineCfg(labels, pnp, COL_TEAL, fmtInt));
  routeCharts.rit = new Chart(document.getElementById('chartRouteRitase'), lineCfg(labels, rit, COL_ORANGE, fmtInt));
  routeCharts.lf  = new Chart(document.getElementById('chartRouteLF'), lineCfg(labels, lf, COL_PINK, fmtPct));
  routeCharts.hw  = new Chart(document.getElementById('chartRouteHeadway'), lineCfg(labels, hw, COL_PURPLE, fmtJamMenit));
  routeCharts.rtt = new Chart(document.getElementById('chartRouteRtt'), lineCfg(labels, rtt, COL_GOLD, fmtJamMenit));
  routeCharts.kec = new Chart(document.getElementById('chartRouteKecepatan'), lineCfg(labels, kec, COL_BLUE, (v)=>v==null?'-':v.toFixed(1)+' km/j'));
  routeCharts.km  = new Chart(document.getElementById('chartRouteKm'), lineCfg(labels, km, COL_CORAL, (v)=>v==null?'-':fmtInt(v)+' km'));

  renderRouteTable(labels, {pnp, rit, lf, hw, rtt, kec, km});
}

function renderRouteTable(labels, series){
  const rows = [
    ['Jumlah Penumpang', series.pnp, fmtInt],
    ['Ritase', series.rit, fmtInt],
    ['Load Factor', series.lf, fmtPct],
    ['Headway', series.hw, fmtJamMenit],
    ['RTT', series.rtt, fmtJamMenit],
    ['Kecepatan (km/jam)', series.kec, (v)=>v==null?'-':v.toFixed(1)],
    ['Km Tempuh', series.km, (v)=>v==null?'-':fmtInt(v)],
  ];
  let html = '<thead><tr><th>Metrik</th>' + labels.map(m=>`<th>${m}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach(([label, arr, fmt])=>{
    html += `<tr><td>${label}</td>` + arr.map(v=>`<td>${fmt(v)}</td>`).join('') + '</tr>';
  });
  html += '</tbody>';
  document.getElementById('routeTable').innerHTML = html;
}

