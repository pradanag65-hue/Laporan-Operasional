/* =========================================================
   TARGET KINERJA (SPM) — tersimpan di localStorage
   ========================================================= */
// Nilai default diambil dari config/config.json (bagian "target").
function targetDefaults(){ return { ...window.CFG.target }; }
let TARGETS = { loadFactor:0.5, headway:15, kecepatan:15 };

function loadTargets(){
  try{
    const saved = JSON.parse(localStorage.getItem('tj-targets') || 'null');
    TARGETS = saved ? { ...targetDefaults(), ...saved } : targetDefaults();
  }catch(e){ TARGETS = targetDefaults(); }
}

function buildTargetSettings(){
  document.getElementById('targetLoadFactor').value = (TARGETS.loadFactor*100).toFixed(0);
  document.getElementById('targetHeadway').value = TARGETS.headway;
  document.getElementById('targetKecepatan').value = TARGETS.kecepatan;
  document.getElementById('btnSaveTarget').addEventListener('click', ()=>{
    const lf = parseFloat(document.getElementById('targetLoadFactor').value);
    const hw = parseFloat(document.getElementById('targetHeadway').value);
    const kec = parseFloat(document.getElementById('targetKecepatan').value);
    TARGETS = {
      loadFactor: isNaN(lf) ? targetDefaults().loadFactor : lf/100,
      headway: isNaN(hw) ? targetDefaults().headway : hw,
      kecepatan: isNaN(kec) ? targetDefaults().kecepatan : kec,
    };
    localStorage.setItem('tj-targets', JSON.stringify(TARGETS));
    document.getElementById('targetMsg').textContent = 'Tersimpan.';
    showToast('Target kinerja diperbarui.', 'ok');
    renderCompareTable();
  });
}

/* =========================================================
   GLOSARIUM
   ========================================================= */
const GLOSSARY_ITEMS = [
  ['Load Factor', 'Persentase keterisian penumpang dibanding kapasitas bus. Semakin tinggi, semakin efisien trayek tersebut secara okupansi.'],
  ['Headway', 'Jarak waktu antar kedatangan bus berikutnya di titik yang sama. Semakin kecil, semakin sering bus datang (layanan lebih sering).'],
  ['RTT (Round Trip Time)', 'Waktu tempuh satu putaran penuh trayek, dari titik awal kembali ke titik awal lagi.'],
  ['Ritase', 'Jumlah perjalanan (trip) yang diselesaikan armada dalam satu bulan.'],
  ['Km Tempuh', 'Total jarak yang ditempuh seluruh armada trayek tersebut dalam satu bulan (produksi kilometer).'],
  ['Kecepatan Rata-rata', 'Rata-rata kecepatan operasional bus di jalan, dalam km/jam.'],
  ['Triwulan / Semester / Tahunan', 'Pengelompokan data bulanan menjadi periode 3 bulan (triwulan), 6 bulan (semester), atau 12 bulan (tahunan) berdasarkan kalender Januari\u2013Desember.'],
];
function buildGlossary(){
  const body = document.getElementById('glossaryBody');
  body.innerHTML = GLOSSARY_ITEMS.map(([term, desc])=>`
    <div class="watch-item" style="align-items:flex-start;">
      <div><strong>${term}</strong><div class="wi-metric" style="margin-top:3px;">${desc}</div></div>
    </div>`).join('');
}

/* =========================================================
   LOG AKTIVITAS
   ========================================================= */
function renderLogTable(){
  const table = document.getElementById('logTable');
  const empty = document.getElementById('logEmpty');
  if(!activityLogs || activityLogs.length === 0){
    table.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  let html = '<thead><tr><th>Waktu</th><th>Aksi</th><th>Role</th><th>Trayek</th><th>Bulan</th></tr></thead><tbody>';
  activityLogs.forEach(l=>{
    const d = l.timestamp ? new Date(l.timestamp) : null;
    const waktu = d && !isNaN(d.getTime()) ? d.toLocaleString('id-ID') : '-';
    const aksiPill = l.aksi === 'hapus' ? '<span class="pill bad">Hapus</span>' : '<span class="pill good">Simpan</span>';
    html += `<tr><td>${waktu}</td><td>${aksiPill}</td><td>${l.role||'-'}</td><td>${l.trayek?routeLabel(l.trayek):'-'}</td><td>${l.bulanLabel||'-'}</td></tr>`;
  });
  html += '</tbody>';
  table.innerHTML = html;
}

/* =========================================================
   DETEKSI ANOMALI — trayek turun signifikan MoM
   ========================================================= */
function computeWatchlist(){
  const months = monthsPresent();
  if(months.length < 2) return [];
  const last = months[months.length-1];
  const prev = months[months.length-2];
  const alerts = [];
  ROUTE_ORDER.forEach(code=>{
    [['penumpang','Penumpang'], ['loadfactor','Load Factor']].forEach(([field, label])=>{
      const eLast = entries.find(e=>e.route===code && e.monthIndex===last);
      const ePrev = entries.find(e=>e.route===code && e.monthIndex===prev);
      const vLast = eLast ? eLast[field] : null;
      const vPrev = ePrev ? ePrev[field] : null;
      if(typeof vLast==='number' && typeof vPrev==='number' && vPrev !== 0){
        const pct = ((vLast-vPrev)/Math.abs(vPrev))*100;
        if(pct <= window.CFG.anomali.ambangPenurunanPersen){
          alerts.push({ code, label, pct, vLast, vPrev, field });
        }
      }
    });
  });
  return alerts.sort((a,b)=>a.pct-b.pct);
}

function renderWatchlist(){
  const card = document.getElementById('watchlistCard');
  const body = document.getElementById('watchlistBody');
  const alerts = computeWatchlist();
  if(alerts.length === 0){ card.style.display = 'none'; return; }
  card.style.display = 'block';
  body.innerHTML = alerts.slice(0,8).map(a=>{
    const fmt = a.field==='loadfactor' ? fmtPct : fmtInt;
    return `<div class="watch-item">
      <div class="wi-left"><span class="route-dot" style="background:${routeColor(a.code)}"></span><strong>${routeLabel(a.code)}</strong><span class="wi-metric">${a.label}</span></div>
      <div><span class="pill bad">${a.pct.toFixed(1)}%</span> <span class="wi-metric">${fmt(a.vPrev)} &rarr; ${fmt(a.vLast)}</span></div>
    </div>`;
  }).join('');
}

/* =========================================================
   TERAKHIR DIPERBARUI
   ========================================================= */
function renderLastUpdated(){
  const el = document.getElementById('lastUpdatedText');
  if(!el) return;
  if(!lastUpdatedTs){ el.textContent = 'Belum ada data tersimpan.'; return; }
  el.textContent = 'Terakhir diperbarui: ' + lastUpdatedTs.toLocaleString('id-ID');
}

/* =========================================================
   EXPORT LAPORAN PDF (via print dialog browser)
   ========================================================= */
function buildExportPdf(){
  const btn = document.getElementById('btnExportPdf');
  if(!btn) return;
  btn.addEventListener('click', ()=>{
    document.body.classList.add('print-mode');
    window.print();
    setTimeout(()=>document.body.classList.remove('print-mode'), 500);
  });
}

/* =========================================================
   PENCARIAN / FILTER TABEL
   ========================================================= */
function buildTableSearch(){
  const compareInput = document.getElementById('compareSearchInput');
  if(compareInput){
    compareInput.addEventListener('input', ()=>{
      filterTableRows('loadFactorCompareTable', compareInput.value);
    });
  }
  const inputSearch = document.getElementById('inputSearchInput');
  if(inputSearch){
    inputSearch.addEventListener('input', ()=>{
      filterTableRows('inputTable', inputSearch.value);
    });
  }
}
function filterTableRows(tableId, query){
  const q = query.trim().toLowerCase();
  const table = document.getElementById(tableId);
  if(!table) return;
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(tr=>{
    if(tr.dataset.summary === '1') return; // baris rata-rata selalu tampil
    const text = tr.textContent.toLowerCase();
    tr.style.display = (q==='' || text.includes(q)) ? '' : 'none';
  });
}

function buildFloatyWidget(){
  const el = document.getElementById('floatyWidget');
  if(!el) return;
  el.addEventListener('click', ()=>{
    window.scrollTo({ top:0, behavior:'smooth' });
  });
}

(async function init(){
  // initAuth dijalankan pertama & terisolasi -- supaya form login tetap
  // berfungsi meski ada bagian lain di bawah ini yang gagal/error.
  try{ initAuth(); }catch(e){ document.getElementById('loginOverlay').style.display='flex'; }
  try{ loadTargets(); }catch(e){}
  try{ buildRouteSelect(); }catch(e){}
  try{ buildImportPanel(); }catch(e){}
  try{ buildInputForm(); }catch(e){}
  try{ buildFloatyWidget(); }catch(e){}
  try{ buildTargetSettings(); }catch(e){}
  try{ buildGlossary(); }catch(e){}
  try{ buildTableSearch(); }catch(e){}
  try{ buildExportPdf(); }catch(e){}
  try{ await loadEntries(); }catch(e){}
  try{ buildRingkasan(); }catch(e){}
  try{ renderInputTable(); }catch(e){}
  try{ renderLogTable(); }catch(e){}
  try{ renderRoute(ROUTE_ORDER[0]); }catch(e){}
})();
