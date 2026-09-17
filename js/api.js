/* =========================================================
   api.js — jembatan ke Google Apps Script / Google Sheet
   ========================================================= */

// Data operasional yang sedang dimuat di memori.
let entries = [];
let activityLogs = [];
let lastUpdatedTs = null;

function apiConfigured(){
  const url = window.CFG.appsScriptUrl;
  return url && url.indexOf('PASTE_URL') === -1;
}

async function loadEntries(){
  entries = [];
  activityLogs = [];
  lastUpdatedTs = null;
  if(!apiConfigured()) return;
  try{
    const res = await fetch(window.CFG.appsScriptUrl, { method:'GET' });
    const json = await res.json();
    if(!json.ok) return;
    entries = json.data.map(row => ({
      route: String(row.trayek),
      monthIndex: Number(row.bulanIndex),
      monthLabel: row.bulanLabel,
      penumpang: row.penumpang === '' ? null : Number(row.penumpang),
      ritase: row.ritase === '' ? null : Number(row.ritase),
      headway: row.headway === '' ? null : normalizeHeadway(row.headway),
      kecepatan: row.kecepatan === '' ? null : Number(row.kecepatan),
      rtt: row.rtt === '' ? null : normalizeRtt(row.rtt),
      km: row.kmTempuh === '' ? null : Number(row.kmTempuh),
      loadfactor: row.loadFactor === '' ? null : normalizeLoadFactor(Number(row.loadFactor)),
      timestamp: row.timestamp || null,
    }));
    activityLogs = Array.isArray(json.logs) ? json.logs : [];
    const stamps = entries.map(e=>e.timestamp).filter(Boolean)
      .map(t=>new Date(t).getTime()).filter(t=>!isNaN(t));
    if(stamps.length) lastUpdatedTs = new Date(Math.max(...stamps));
  }catch(e){ /* biarkan kosong -> tampil empty state */ }
}

// Content-Type text/plain dipakai supaya browser tidak mengirim preflight
// OPTIONS (Apps Script tidak menanganinya) saat dipanggil dari domain lain.
async function callApi(payload){
  const res = await fetch(window.CFG.appsScriptUrl, {
    method:'POST',
    headers:{ 'Content-Type':'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, role: currentRole || 'unknown' }),
  });
  return res.json();
}

function upsertLocalEntry(entry){
  entries = entries.filter(e=>!(e.route===entry.route && e.monthIndex===entry.monthIndex));
  entries.push({ ...entry, timestamp: new Date().toISOString() });
  lastUpdatedTs = new Date();
}

function monthsPresent(){
  const set = new Set(entries.map(e=>e.monthIndex));
  return [...set].sort((a,b)=>a-b);
}
