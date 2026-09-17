/* =========================================================
   utils.js — konstanta, format angka, dan normalisasi data
   ========================================================= */

const MONTHS12 = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const MONTHS12_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// Diisi dari config saat startup (lihat initConstantsFromConfig()).
let ROUTE_ORDER = [];
let PALETTE = [];
let COL_TEAL, COL_ORANGE, COL_PINK, COL_PURPLE, COL_BLUE, COL_LIME, COL_GOLD, COL_CORAL, COL_LINE, COL_INK_SOFT;

function initConstantsFromConfig(){
  const c = window.CFG;
  ROUTE_ORDER = c.trayek.urutan.slice();
  const w = c.warna;
  COL_TEAL = w.teal; COL_ORANGE = w.orange; COL_PINK = w.pink; COL_PURPLE = w.purple;
  COL_BLUE = w.blue; COL_LIME = w.lime; COL_GOLD = w.gold; COL_CORAL = w.coral;
  COL_LINE = w.line; COL_INK_SOFT = w.inkSoft;
  // Palet warna bergilir per trayek, supaya grafik & tabel lebih hidup.
  PALETTE = [COL_PINK, COL_ORANGE, COL_TEAL, COL_PURPLE, COL_BLUE, COL_LIME, COL_GOLD, COL_CORAL];

  // Chart.js dimuat dari CDN. Kalau gagal (jaringan lambat / diblokir),
  // jangan sampai seluruh aplikasi ikut mati — tabel & form tetap jalan,
  // hanya grafiknya yang tidak tampil.
  if(typeof Chart !== 'undefined'){
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = COL_INK_SOFT;
  }
}

// Dipakai modul lain sebelum menggambar grafik.
function chartReady(){ return typeof Chart !== 'undefined'; }
function xlsxReady(){ return typeof XLSX !== 'undefined'; }

function routeLabel(code){
  const alias = (window.CFG.trayek.aliasTampilan) || {};
  return alias[code] || code;
}
function routeCodeFromLabel(label){
  const t = String(label).trim();
  const alias = (window.CFG.trayek.aliasTampilan) || {};
  for(const code in alias){
    if(alias[code].toLowerCase() === t.toLowerCase()) return code;
  }
  return t.toUpperCase();
}
function routeColor(code){
  const i = ROUTE_ORDER.indexOf(code);
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}

/* ---------------- format ---------------- */
function fmtInt(n){ if(n===null||n===undefined||isNaN(n)) return '-'; return Math.round(n).toLocaleString('id-ID'); }
function fmtPct(n){ if(n===null||n===undefined||isNaN(n)) return '-'; return (n*100).toFixed(1)+'%'; }
// Headway & RTT disimpan internal dalam total menit, ditampilkan jam:menit
// (mis. 129 menit -> "2j 9m") biar gampang dibaca.
function fmtJamMenit(v){
  if(v===null||v===undefined||isNaN(v)) return '-';
  const total = Math.round(v);
  const h = Math.floor(total/60);
  const m = total%60;
  return h===0 ? `${m}m` : `${h}j ${m}m`;
}
function avg(arr){ const v=arr.filter(x=>typeof x==='number'); return v.length? v.reduce((a,b)=>a+b,0)/v.length : null; }
function sum(arr){ return arr.filter(x=>typeof x==='number').reduce((a,b)=>a+b,0); }

/* ---------------- normalisasi nilai ---------------- */

// Load Factor disimpan internal sebagai pecahan 0-1 (0.4523 = 45.23%).
// Orang sering mengetik angka persen langsung (45.23 / "45,23"), jadi kalau
// nilainya > 1.5 anggap sudah bentuk persen dan bagi 100 — supaya "45,23"
// tidak jadi "4523%".
function normalizeLoadFactor(v){
  if(v === null || v === undefined || isNaN(v)) return null;
  return Math.abs(v) > 1.5 ? v / 100 : v;
}

// Headway & RTT kadang ditulis dengan notasi jam.menit ala Indonesia
// (mis. "2.09" = 2 jam 9 menit, "0:21" = 21 menit) alih-alih menit polos.
function hmsToMinutes(str, sep){
  const parts = String(str).split(sep).map(p=>p.trim()).filter(p=>p!=='');
  const h = parseInt(parts[0], 10) || 0;
  let m = 0, s = 0;
  if(parts[1] !== undefined){
    let mStr = parts[1];
    // Excel biasa membuang nol di belakang koma, jadi "0.2" sebenarnya "0.20".
    if(mStr.length === 1) mStr += '0';
    m = parseInt(mStr.slice(0,2), 10) || 0;
  }
  if(parts[2] !== undefined){
    let sStr = parts[2];
    if(sStr.length === 1) sStr += '0';
    s = parseInt(sStr.slice(0,2), 10) || 0;
  }
  return h*60 + m + s/60;
}

function normalizeDurationMinutes(v, minPlausible){
  if(v === null || v === undefined) return null;
  const s = String(v).trim();
  if(s === '') return null;

  // String tanggal/waktu ISO (mis. Google Sheets mengirim sel berformat waktu
  // sebagai Date -> "1899-12-30T02:09:00.000Z"): ambil jam & menitnya.
  const isoMatch = s.match(/T(\d{1,2}):(\d{2})(?::(\d{1,2}(?:\.\d+)?))?/);
  if(isoMatch){
    const h = parseInt(isoMatch[1], 10) || 0;
    const m = parseInt(isoMatch[2], 10) || 0;
    const sec = parseFloat(isoMatch[3] || '0') || 0;
    return h*60 + m + sec/60;
  }

  if(s.includes(':')) return hmsToMinutes(s, ':');
  const n = parseFloat(s.replace(',', '.'));
  if(isNaN(n)) return null;
  // Hanya dianggap notasi "jam.menit" kalau ada titik DAN nilainya jauh di
  // bawah wajar untuk menit. Angka polos (mis. "124") tidak pernah diubah.
  if(s.includes('.') && Math.abs(n) < minPlausible) return hmsToMinutes(s, '.');
  return n;
}
function normalizeHeadway(v){ return normalizeDurationMinutes(v, 5); }
function normalizeRtt(v){ return normalizeDurationMinutes(v, 20); }

/* ---------------- unduh file ---------------- */
function downloadBlob(filename, content, mime){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function downloadCsvRows(filename, rows2D){
  const csv = rows2D.map(r=>r.map(v=>{
    const s = v===null||v===undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');
  downloadBlob(filename, csv, 'text/csv;charset=utf-8');
}
function downloadXlsxRows(filename, rows2D, sheetName){
  if(!xlsxReady()){ showToast('Library Excel belum termuat, coba muat ulang halaman.', 'err'); return; }
  const ws = XLSX.utils.aoa_to_sheet(rows2D);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Data');
  const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  downloadBlob(filename, out, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/* ---------------- toast notifikasi ---------------- */
function showToast(message, type){
  const stack = document.getElementById('toastStack');
  if(!stack) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' '+type : '');
  const ic = type==='ok' ? '&#9989;' : type==='err' ? '&#10060;' : '&#8505;&#65039;';
  el.innerHTML = `<span class="ic">${ic}</span><span>${message}</span>`;
  stack.appendChild(el);
  setTimeout(()=>{
    el.classList.add('out');
    setTimeout(()=>el.remove(), 250);
  }, 3200);
}
