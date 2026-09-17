/* =========================================================
   INPUT MANUAL (satu trayek/bulan)
   ========================================================= */
function buildInputForm(){
  document.getElementById('inRoute').innerHTML = ROUTE_ORDER.map(c=>`<option value="${c}">Trayek ${routeLabel(c)}</option>`).join('');
  document.getElementById('inMonth').innerHTML = MONTHS12.map((m,i)=>`<option value="${i}">${m}</option>`).join('');
  document.getElementById('btnSaveInput').addEventListener('click', saveInputEntry);
  document.getElementById('btnClearForm').addEventListener('click', clearForm);
  document.getElementById('btnBackup').addEventListener('click', exportBackupCsv);
  document.getElementById('btnBackupXlsx').addEventListener('click', exportBackupXlsx);
}

function clearForm(){
  ['inPenumpang','inRitase','inHeadway','inKecepatan','inRtt','inKm','inLf'].forEach(id=>{ document.getElementById(id).value=''; });
  document.getElementById('formMsg').textContent = '';
}
function numOrNull(id){
  const v = document.getElementById(id).value;
  if(v==='' || v===null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

async function saveInputEntry(){
  const route = document.getElementById('inRoute').value;
  const monthIndex = parseInt(document.getElementById('inMonth').value, 10);
  const msg = document.getElementById('formMsg');

  if(!canWriteEntry(route, monthIndex)){
    if(currentRole === 'guest'){
      msg.textContent = 'Role Guest hanya bisa melihat data, tidak bisa menyimpan.';
    } else {
      msg.textContent = 'Data trayek & bulan ini sudah ada — role Input hanya boleh menambah data baru, bukan menimpa. Hubungi Admin untuk mengubahnya.';
    }
    msg.style.color = '#c94861';
    return;
  }

  const entry = {
    route, monthIndex, monthLabel: MONTHS12[monthIndex],
    penumpang: numOrNull('inPenumpang'), ritase: numOrNull('inRitase'), headway: normalizeHeadway(numOrNull('inHeadway')),
    kecepatan: numOrNull('inKecepatan'), rtt: normalizeRtt(numOrNull('inRtt')), km: numOrNull('inKm'), loadfactor: normalizeLoadFactor(numOrNull('inLf')),
  };
  const hasAny = ['penumpang','ritase','headway','kecepatan','rtt','km','loadfactor'].some(f=>entry[f]!==null);
  if(!hasAny){ msg.textContent='Isi minimal satu kolom data.'; msg.style.color='#c94861'; return; }
  if(!apiConfigured()){ msg.textContent='APPS_SCRIPT_URL belum diisi — lihat PANDUAN-SETUP.md.'; msg.style.color='#c94861'; return; }

  msg.textContent = 'Menyimpan...'; msg.style.color = '';
  try{
    const resp = await callApi({ action:'save', entry:{
      trayek:route, bulanIndex:monthIndex, bulanLabel:entry.monthLabel,
      penumpang:entry.penumpang, ritase:entry.ritase, headway:entry.headway,
      kecepatan:entry.kecepatan, rtt:entry.rtt, kmTempuh:entry.km, loadFactor:entry.loadfactor,
    }});
    if(!resp.ok) throw new Error(resp.error || 'Unknown error');
    msg.textContent = 'Tersimpan ke Google Sheet.'; msg.style.color = '#158a76';
    showToast(`Data ${routeLabel(route)} &middot; ${entry.monthLabel} tersimpan.`, 'ok');
  }catch(e){
    msg.textContent = 'Gagal menyimpan: ' + e.message; msg.style.color = '#c94861';
    showToast('Gagal menyimpan data.', 'err');
    return;
  }

  upsertLocalEntry(entry);
  clearForm();
  renderInputTable();
  buildRingkasan();
  const currentRoute = document.getElementById('routeSelect').value;
  renderRoute(currentRoute);
}

async function deleteInputEntry(route, monthIndex){
  if(currentRole !== 'admin') return; // hanya Admin yang boleh menghapus
  const monthLabel = MONTHS12[monthIndex];
  entries = entries.filter(e=>!(e.route===route && e.monthIndex===monthIndex));
  renderInputTable();
  buildRingkasan();
  renderRoute(document.getElementById('routeSelect').value);
  showToast(`Data ${routeLabel(route)} &middot; ${monthLabel} dihapus.`, 'ok');
  if(apiConfigured()){
    try{ await callApi({ action:'delete', trayek: route, bulanIndex: monthIndex }); }catch(e){ /* diamkan */ }
  }
}

function renderInputTable(){
  const table = document.getElementById('inputTable');
  const empty = document.getElementById('inputEmpty');
  if(entries.length === 0){ table.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';
  const sorted = [...entries].sort((a,b)=>
    a.monthIndex - b.monthIndex || ROUTE_ORDER.indexOf(a.route) - ROUTE_ORDER.indexOf(b.route)
  );
  let html = '<thead><tr><th>Bulan</th><th>Trayek</th><th>Penumpang</th><th>Ritase</th><th>Headway</th><th>Kecepatan</th><th>RTT</th><th>Km Tempuh</th><th>Load Factor</th>' + (currentRole==='admin' ? '<th></th>' : '') + '</tr></thead><tbody>';
  sorted.forEach(e=>{
    html += `<tr>
      <td>${e.monthLabel}</td><td><span class="route-dot" style="background:${routeColor(e.route)}"></span>${routeLabel(e.route)}</td>
      <td>${e.penumpang==null?'-':fmtInt(e.penumpang)}</td>
      <td>${e.ritase==null?'-':fmtInt(e.ritase)}</td>
      <td>${e.headway==null?'-':e.headway}</td>
      <td>${e.kecepatan==null?'-':e.kecepatan}</td>
      <td>${e.rtt==null?'-':e.rtt}</td>
      <td>${e.km==null?'-':fmtInt(e.km)}</td>
      <td>${e.loadfactor==null?'-':fmtPct(e.loadfactor)}</td>
      ${currentRole==='admin' ? `<td><button class="icon-btn" data-route="${e.route}" data-month="${e.monthIndex}">Hapus</button></td>` : ''}
    </tr>`;
  });
  html += '</tbody>';
  table.innerHTML = html;
  table.querySelectorAll('.icon-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>deleteInputEntry(btn.dataset.route, parseInt(btn.dataset.month,10)));
  });
}

function buildBackupRows(){
  const rows = [['Bulan','BulanIndex','Trayek','Penumpang','Ritase','Headway','Kecepatan','RTT','KmTempuh','LoadFactor']];
  [...entries].sort((a,b)=> a.monthIndex - b.monthIndex || ROUTE_ORDER.indexOf(a.route) - ROUTE_ORDER.indexOf(b.route)).forEach(e=>{
    rows.push([e.monthLabel, e.monthIndex, routeLabel(e.route), e.penumpang??'', e.ritase??'', e.headway??'', e.kecepatan??'', e.rtt??'', e.km??'', e.loadfactor??'']);
  });
  return rows;
}
function exportBackupCsv(){
  downloadCsvRows(`backup-transjogja-${new Date().toISOString().slice(0,10)}.csv`, buildBackupRows());
}
function exportBackupXlsx(){
  downloadXlsxRows(`backup-transjogja-${new Date().toISOString().slice(0,10)}.xlsx`, buildBackupRows(), 'Backup');
}

