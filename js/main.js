/* =========================================================
   main.js — entry point aplikasi
   ---------------------------------------------------------
   Urutan startup:
   1. Muat config/config.json
   2. Siapkan konstanta (daftar trayek, warna, default Chart.js)
   3. Pasang login + seluruh panel UI
   4. Ambil data dari Google Sheet lalu render
   ========================================================= */

/* ---------------- navigasi tab ---------------- */
function initTabs(){
  const nav = document.getElementById('tabNav');
  if(!nav) return;
  nav.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-tab]');
    if(!btn) return;
    document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('panel-'+btn.dataset.tab).classList.add('active');
  });
}

/* ---------------- widget mengambang ---------------- */
function buildFloatyWidget(){
  const el = document.getElementById('floatyWidget');
  if(!el) return;
  el.addEventListener('click', ()=>{
    window.scrollTo({ top:0, behavior:'smooth' });
  });
}

/* ---------------- startup ---------------- */
(async function main(){
  await loadConfig();
  applyBranding();
  initConstantsFromConfig();
  loadTargets();

  // initAuth dijalankan lebih dulu & terisolasi supaya form login tetap
  // berfungsi meski ada bagian lain di bawahnya yang gagal.
  try{ initAuth(); }catch(e){
    const ov = document.getElementById('loginOverlay');
    if(ov) ov.style.display = 'flex';
  }

  try{ initTabs(); }catch(e){}
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

  if(!apiConfigured()){
    showToast('appsScriptUrl belum diisi di config/config.json', 'err');
  }
})();
