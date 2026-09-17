/* =========================================================
   config.js — memuat config/config.json
   ---------------------------------------------------------
   Semua pengaturan (URL Apps Script, PIN, daftar trayek, target SPM,
   warna) ada di config/config.json supaya bisa diubah tanpa menyentuh
   kode. File ini yang membacanya dan menyebarkannya ke modul lain.
   ========================================================= */

const CONFIG_FALLBACK = {
  appsScriptUrl: 'PASTE_URL_APPS_SCRIPT_DI_SINI',
  app: { nama:'Ops TransJogja', subJudul:'PT AMI · Unit Transportasi', tagline:'TransJogja\nMelayani dengan Hati', tahunData:2026 },
  auth: { pins:{ admin:'2026', input:'1234' }, labels:{ admin:'Admin', input:'Input', guest:'Guest' } },
  trayek: { urutan:['1A','1B','2A','2B','3A','3B','4A','4B','5A','5B','6','8','9','10','11','12','13','14','15','EV'], aliasTampilan:{ EV:'Listrik' } },
  target: { loadFactor:0.5, headway:15, kecepatan:15 },
  anomali: { ambangPenurunanPersen:-15 },
  validasi: { headwayMaksMenit:120, rttMaksMenit:300, kecepatanMaksKmJam:80 },
  warna: { teal:'#1d5b3d', orange:'#c9962c', pink:'#ef6f8e', purple:'#8b6fd8', blue:'#3d78ad', lime:'#7bc67e', gold:'#e0b23e', coral:'#e8735c', line:'#e7ddc2', inkSoft:'#6b7566' },
};

// Objek global yang dipakai modul lain. Diisi oleh loadConfig() saat startup.
window.CFG = { ...CONFIG_FALLBACK };

async function loadConfig(){
  try{
    const res = await fetch('config/config.json', { cache:'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    // gabung dangkal per-bagian, supaya kunci yang tidak diisi tetap pakai fallback
    window.CFG = {
      ...CONFIG_FALLBACK,
      ...json,
      app: { ...CONFIG_FALLBACK.app, ...(json.app||{}) },
      auth: {
        pins: { ...CONFIG_FALLBACK.auth.pins, ...((json.auth||{}).pins||{}) },
        labels: { ...CONFIG_FALLBACK.auth.labels, ...((json.auth||{}).labels||{}) },
      },
      trayek: { ...CONFIG_FALLBACK.trayek, ...(json.trayek||{}) },
      target: { ...CONFIG_FALLBACK.target, ...(json.target||{}) },
      anomali: { ...CONFIG_FALLBACK.anomali, ...(json.anomali||{}) },
      validasi: { ...CONFIG_FALLBACK.validasi, ...(json.validasi||{}) },
      warna: { ...CONFIG_FALLBACK.warna, ...(json.warna||{}) },
    };
  }catch(e){
    // Kalau config.json gagal dimuat (mis. dibuka langsung via file://),
    // aplikasi tetap jalan memakai nilai fallback di atas.
    window.CFG = { ...CONFIG_FALLBACK };
  }
  return window.CFG;
}

// Terapkan identitas aplikasi dari config ke elemen di halaman.
function applyBranding(){
  const c = window.CFG.app || {};
  document.querySelectorAll('[data-cfg="subJudul"]').forEach(el=>{ el.textContent = c.subJudul || ''; });
  document.querySelectorAll('[data-cfg="tagline"]').forEach(el=>{
    el.innerHTML = String(c.tagline || '').split('\n').join('<br>') + '<div class="rule"></div>';
  });
}
