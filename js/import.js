/* =========================================================
   IMPORT CSV
   ========================================================= */
const CSV_HEADERS = ['Bulan','Trayek','Penumpang','Ritase','Headway','Kecepatan','RTT','KmTempuh','LoadFactor'];
let csvParsedRows = [];

function buildImportPanel(){
  const monthSel = document.getElementById('templateMonth');
  monthSel.innerHTML = MONTHS12.map((m,i)=>`<option value="${i}">${m}</option>`).join('');

  document.getElementById('btnDownloadTemplateXlsx').addEventListener('click', ()=>downloadTemplate('xlsx'));
  document.getElementById('btnDownloadTemplateCsv').addEventListener('click', ()=>downloadTemplate('csv'));
  document.getElementById('btnParseCsv').addEventListener('click', parseImportFile);
  document.getElementById('btnCancelCsv').addEventListener('click', ()=>{
    csvParsedRows = [];
    document.getElementById('csvPreviewWrap').style.display = 'none';
    document.getElementById('csvFileInput').value = '';
    document.getElementById('csvMsg').textContent = '';
  });
  document.getElementById('btnSaveCsv').addEventListener('click', saveCsvRows);
}

function buildTemplateRows(){
  const monthIndex = parseInt(document.getElementById('templateMonth').value, 10);
  const monthLabel = MONTHS12[monthIndex];
  const rows = [CSV_HEADERS];
  ROUTE_ORDER.forEach(code=>{
    rows.push([monthLabel, routeLabel(code), '', '', '', '', '', '', '']);
  });
  return { rows, monthLabel };
}

function downloadTemplate(format){
  const { rows, monthLabel } = buildTemplateRows();
  if(format === 'xlsx'){
    downloadXlsxRows(`template-${monthLabel.toLowerCase()}.xlsx`, rows, 'Template');
  } else {
    downloadCsvRows(`template-${monthLabel.toLowerCase()}.csv`, rows);
  }
}

function parseCsvLine(line){
  // parser sederhana: dukung koma biasa, dan field yang dibungkus tanda kutip
  const out = [];
  let cur = '', inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"'){ inQuotes = !inQuotes; continue; }
    if(ch === ',' && !inQuotes){ out.push(cur.trim()); cur=''; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function readFileAsRows(file){
  const name = file.name.toLowerCase();
  const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=> reject(new Error('Gagal membaca file.'));
    if(isExcel){
      reader.onload = (e)=>{
        try{
          const data = new Uint8Array(e.target.result);
          if(!xlsxReady()) throw new Error('Library Excel belum termuat, coba muat ulang halaman.');
          const wb = XLSX.read(data, { type:'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:false, defval:'' });
          resolve(rows.map(r=> r.map(v=> v===undefined||v===null ? '' : String(v).trim())));
        }catch(err){ reject(new Error('File Excel tidak bisa dibaca (' + err.message + ').')); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e)=>{
        try{
          const text = e.target.result.replace(/\r/g,'');
          const lines = text.split('\n').filter(l=>l.trim() !== '');
          resolve(lines.map(parseCsvLine));
        }catch(err){ reject(err); }
      };
      reader.readAsText(file);
    }
  });
}

function rowsToEntries(rows){
  if(rows.length < 2) throw new Error('File kosong atau tidak ada baris data.');
  const header = rows[0].map(h=>String(h).toLowerCase().trim());
  const idx = {
    bulan: header.indexOf('bulan'),
    trayek: header.indexOf('trayek'),
    penumpang: header.indexOf('penumpang'),
    ritase: header.indexOf('ritase'),
    headway: header.indexOf('headway'),
    kecepatan: header.indexOf('kecepatan'),
    rtt: header.indexOf('rtt'),
    km: header.indexOf('kmtempuh'),
    loadfactor: header.indexOf('loadfactor'),
  };
  if(idx.bulan === -1 || idx.trayek === -1){
    throw new Error('Kolom "Bulan" dan "Trayek" wajib ada di header.');
  }
  const numOrNullAt = (cols, i)=>{
    if(i === -1) return null;
    const raw = (cols[i] !== undefined ? String(cols[i]) : '').trim();
    if(raw === '') return null;
    const n = parseFloat(raw.replace(',', '.'));
    return isNaN(n) ? null : n;
  };
  const rawAt = (cols, i)=>{
    if(i === -1) return null;
    const raw = (cols[i] !== undefined ? String(cols[i]) : '').trim();
    return raw === '' ? null : raw;
  };

  const parsed = [];
  for(let i=1;i<rows.length;i++){
    const cols = rows[i];
    if(!cols || cols.length < 2 || !cols[idx.trayek]) continue;
    const monthLabelRaw = String(cols[idx.bulan] || '').trim();
    const monthIndex = MONTHS12.findIndex(m=>m.toLowerCase() === monthLabelRaw.toLowerCase());
    if(monthIndex === -1) continue;
    const route = routeCodeFromLabel(cols[idx.trayek]);
    if(!ROUTE_ORDER.includes(route)) continue;
    parsed.push({
      route, monthIndex, monthLabel: MONTHS12[monthIndex],
      penumpang: numOrNullAt(cols, idx.penumpang),
      ritase: numOrNullAt(cols, idx.ritase),
      headway: normalizeHeadway(rawAt(cols, idx.headway)),
      kecepatan: numOrNullAt(cols, idx.kecepatan),
      rtt: normalizeRtt(rawAt(cols, idx.rtt)),
      km: numOrNullAt(cols, idx.km),
      loadfactor: normalizeLoadFactor(numOrNullAt(cols, idx.loadfactor)),
    });
  }
  if(parsed.length === 0){ throw new Error('Tidak ada baris valid yang bisa dibaca. Cek format Bulan & Trayek.'); }
  return parsed;
}

async function parseImportFile(){
  const fileInput = document.getElementById('csvFileInput');
  const msg = document.getElementById('csvMsg');
  const file = fileInput.files[0];
  if(!file){ msg.textContent = 'Pilih file dulu (.csv, .xlsx, atau .xls).'; msg.style.color = '#c94861'; return; }

  try{
    const rows = await readFileAsRows(file);
    const parsed = rowsToEntries(rows);
    csvParsedRows = parsed;
    renderCsvPreview(parsed);
    msg.textContent = `${parsed.length} baris terbaca.`;
    msg.style.color = '#158a76';
  }catch(err){
    msg.textContent = 'Gagal membaca file: ' + err.message;
    msg.style.color = '#c94861';
    document.getElementById('csvPreviewWrap').style.display = 'none';
  }
}

// Validasi sederhana untuk menandai nilai yang kemungkinan salah input,
// tapi tetap MENGIZINKAN disimpan (cuma peringatan, bukan blokir).
function validateRow(r){
  const warnings = [];
  if(r.loadfactor!=null && (r.loadfactor < 0 || r.loadfactor > 1)) warnings.push('Load Factor di luar 0-100%');
  if(r.penumpang!=null && r.penumpang < 0) warnings.push('Penumpang negatif');
  if(r.ritase!=null && r.ritase < 0) warnings.push('Ritase negatif');
  if(r.km!=null && r.km < 0) warnings.push('Km Tempuh negatif');
  if(r.headway!=null && (r.headway <= 0 || r.headway > window.CFG.validasi.headwayMaksMenit)) warnings.push('Headway janggal (' + r.headway + ' mnt)');
  if(r.rtt!=null && (r.rtt <= 0 || r.rtt > window.CFG.validasi.rttMaksMenit)) warnings.push('RTT janggal (' + r.rtt + ' mnt)');
  if(r.kecepatan!=null && (r.kecepatan <= 0 || r.kecepatan > window.CFG.validasi.kecepatanMaksKmJam)) warnings.push('Kecepatan janggal (' + r.kecepatan + ' km/j)');
  return warnings;
}

function renderCsvPreview(rows){
  let warnCount = 0;
  let html = '<thead><tr><th>Bulan</th><th>Trayek</th><th>Penumpang</th><th>Ritase</th><th>Headway</th><th>Kecepatan</th><th>RTT</th><th>Km Tempuh</th><th>Load Factor</th></tr></thead><tbody>';
  rows.forEach(r=>{
    const warnings = validateRow(r);
    if(warnings.length) warnCount++;
    const rowStyle = warnings.length ? ' style="background:var(--orange-soft);"' : '';
    const titleAttr = warnings.length ? ` title="${warnings.join('; ')}"` : '';
    html += `<tr${rowStyle}${titleAttr}>
      <td>${r.monthLabel}</td><td><span class="route-dot" style="background:${routeColor(r.route)}"></span>${routeLabel(r.route)}${warnings.length?' &#9888;&#65039;':''}</td>
      <td>${r.penumpang==null?'-':fmtInt(r.penumpang)}</td>
      <td>${r.ritase==null?'-':fmtInt(r.ritase)}</td>
      <td>${r.headway==null?'-':r.headway}</td>
      <td>${r.kecepatan==null?'-':r.kecepatan}</td>
      <td>${r.rtt==null?'-':r.rtt}</td>
      <td>${r.km==null?'-':fmtInt(r.km)}</td>
      <td>${r.loadfactor==null?'-':fmtPct(r.loadfactor)}</td>
    </tr>`;
  });
  html += '</tbody>';
  document.getElementById('csvPreviewTable').innerHTML = html;
  const warnBanner = document.getElementById('csvWarnBanner');
  if(warnBanner){
    if(warnCount>0){
      warnBanner.style.display = 'block';
      warnBanner.textContent = `&#9888;&#65039; ${warnCount} baris punya nilai yang kelihatan janggal (ditandai kuning, arahkan kursor untuk detail). Tetap bisa disimpan, tapi sebaiknya dicek dulu.`;
      warnBanner.innerHTML = warnBanner.textContent.replace('&#9888;&#65039;','⚠️');
    } else {
      warnBanner.style.display = 'none';
    }
  }
  document.getElementById('csvPreviewWrap').style.display = 'block';
}

async function saveCsvRows(){
  const saveMsg = document.getElementById('csvSaveMsg');
  if(csvParsedRows.length === 0) return;
  if(currentRole === 'guest'){
    saveMsg.textContent = 'Role Guest hanya bisa melihat data, tidak bisa import.';
    saveMsg.className = 'import-msg err';
    return;
  }
  if(!apiConfigured()){
    saveMsg.textContent = 'APPS_SCRIPT_URL belum diisi di app.js — lihat PANDUAN-SETUP.md.';
    saveMsg.className = 'import-msg err';
    return;
  }
  saveMsg.textContent = `Menyimpan 0/${csvParsedRows.length}...`;
  saveMsg.className = 'import-msg';
  let okCount = 0, skippedCount = 0;
  for(let i=0;i<csvParsedRows.length;i++){
    const r = csvParsedRows[i];
    if(!canWriteEntry(r.route, r.monthIndex)){
      skippedCount++;
      saveMsg.textContent = `Menyimpan ${i+1}/${csvParsedRows.length}... (${skippedCount} dilewati, sudah ada)`;
      continue;
    }
    try{
      const resp = await callApi({ action:'save', entry:{
        trayek:r.route, bulanIndex:r.monthIndex, bulanLabel:r.monthLabel,
        penumpang:r.penumpang, ritase:r.ritase, headway:r.headway,
        kecepatan:r.kecepatan, rtt:r.rtt, kmTempuh:r.km, loadFactor:r.loadfactor,
      }});
      if(resp.ok){
        okCount++;
        upsertLocalEntry({ route:r.route, monthIndex:r.monthIndex, monthLabel:r.monthLabel,
          penumpang:r.penumpang, ritase:r.ritase, headway:r.headway, kecepatan:r.kecepatan,
          rtt:r.rtt, km:r.km, loadfactor:r.loadfactor });
      }
    }catch(e){ /* lanjut ke baris berikutnya */ }
    saveMsg.textContent = `Menyimpan ${i+1}/${csvParsedRows.length}...`;
  }
  const skippedNote = skippedCount>0 ? ` (${skippedCount} dilewati karena role Input tidak boleh menimpa data lama)` : '';
  saveMsg.textContent = `Selesai: ${okCount}/${csvParsedRows.length} baris tersimpan ke Google Sheet.${skippedNote}`;
  saveMsg.className = (okCount + skippedCount) === csvParsedRows.length && skippedCount===0 ? 'import-msg ok' : 'import-msg err';
  showToast(`Import selesai: ${okCount} baris tersimpan.`, okCount>0 ? 'ok' : 'err');

  csvParsedRows = [];
  document.getElementById('csvPreviewWrap').style.display = 'none';
  document.getElementById('csvFileInput').value = '';

  renderInputTable();
  buildRingkasan();
  const currentRoute = document.getElementById('routeSelect').value;
  renderRoute(currentRoute);
}

