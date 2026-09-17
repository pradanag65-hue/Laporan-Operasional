/* =========================================================
   libs.js — memuat Chart.js & SheetJS dengan CDN cadangan
   ---------------------------------------------------------
   Library dimuat berurutan: kalau CDN pertama gagal (diblokir jaringan
   kantor, lagi down, atau versinya tidak ada), otomatis coba CDN
   berikutnya. Kalau semua gagal, aplikasi tetap jalan — hanya grafik /
   fitur Excel yang nonaktif, dan pengguna diberi tahu.
   ========================================================= */

const LIB_SOURCES = {
  chart: [
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js',
    'https://unpkg.com/chart.js@4.4.4/dist/chart.umd.min.js',
  ],
  xlsx: [
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
  ],
};

function loadScript(src, timeoutMs){
  return new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    let done = false;
    const timer = setTimeout(()=>{
      if(!done){ done = true; s.remove(); reject(new Error('timeout')); }
    }, timeoutMs || 4000);
    s.src = src;
    s.async = false;
    s.onload = ()=>{ if(!done){ done = true; clearTimeout(timer); resolve(src); } };
    s.onerror = ()=>{ if(!done){ done = true; clearTimeout(timer); s.remove(); reject(new Error('gagal: '+src)); } };
    document.head.appendChild(s);
  });
}

// Coba tiap CDN sampai salah satu berhasil; isReady() memastikan library
// benar-benar terpasang (bukan cuma file-nya termuat).
async function loadWithFallback(urls, isReady){
  if(isReady()) return true;
  for(const url of urls){
    try{
      await loadScript(url);
      if(isReady()) return true;
    }catch(e){ /* lanjut ke CDN berikutnya */ }
  }
  return false;
}

async function loadLibraries(){
  const [chartOk, xlsxOk] = await Promise.all([
    loadWithFallback(LIB_SOURCES.chart, ()=> typeof Chart !== 'undefined'),
    loadWithFallback(LIB_SOURCES.xlsx,  ()=> typeof XLSX  !== 'undefined'),
  ]);
  return { chartOk, xlsxOk };
}
