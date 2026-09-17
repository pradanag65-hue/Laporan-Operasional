/**
 * ============================================================
 *  BACKEND API — Dashboard Operasional TransJogja
 *  Google Apps Script (Web App) + Google Sheets sebagai database
 * ============================================================
 *
 * CARA PASANG (ringkas — detail lengkap ada di PANDUAN-SETUP.md):
 * 1. Buat Google Sheet baru, kasih nama bebas (mis. "DB Dashboard TransJogja").
 * 2. Buka Extensions > Apps Script.
 * 3. Hapus isi default Code.gs, ganti dengan seluruh isi file ini.
 * 4. Klik Deploy > New deployment > pilih tipe "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. Copy URL yang muncul (formatnya https://script.google.com/macros/s/XXXX/exec)
 * 6. Tempel URL itu ke konstanta APPS_SCRIPT_URL di file dashboard (index.html).
 *
 * Sheet "InputData" dan "LogAktivitas" akan dibuat otomatis saat data pertama disimpan.
 */

const SHEET_NAME = 'InputData';
const HEADERS = ['timestamp','trayek','bulanIndex','bulanLabel','penumpang','ritase','headway','kecepatan','rtt','kmTempuh','loadFactor'];

const LOG_SHEET_NAME = 'LogAktivitas';
const LOG_HEADERS = ['timestamp','aksi','role','trayek','bulanLabel'];
const LOG_MAX_ROWS = 500; // biar sheet log tidak membengkak tanpa batas

/* ---------- entry point: baca semua data (dipanggil via GET) ---------- */
function doGet(e) {
  try {
    const sheet = getOrCreateSheet_();
    const rows = readAllRows_(sheet);
    const logSheet = getOrCreateLogSheet_();
    const logs = readLogRows_(logSheet);
    return jsonResponse_({ ok: true, data: rows, logs: logs });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

/* ---------- entry point: simpan / hapus data (dipanggil via POST) ---------- */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet_();
    const role = body.role || 'unknown';

    if (body.action === 'save') {
      saveEntry_(sheet, body.entry);
      logActivity_('simpan', role, body.entry.trayek, body.entry.bulanLabel);
      return jsonResponse_({ ok: true });
    }
    if (body.action === 'delete') {
      deleteEntry_(sheet, body.trayek, body.bulanIndex);
      logActivity_('hapus', role, body.trayek, monthLabelFromIndex_(body.bulanIndex));
      return jsonResponse_({ ok: true });
    }
    return jsonResponse_({ ok: false, error: 'Aksi tidak dikenal: ' + body.action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

/* ================= helper: data operasional ================= */

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readAllRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[1]) continue; // lewati baris kosong (kolom 'trayek' kosong)
    const obj = {};
    headers.forEach((h, idx) => {
      let v = row[idx];
      // Kalau sel ini kebetulan diformat Sheets sebagai jam/waktu (misalnya
      // diketik langsung "2:09"), getValues() mengembalikannya sebagai objek
      // Date, bukan angka. Ubah jadi total menit supaya konsisten dan tidak
      // bikin data di dashboard jadi kosong/aneh.
      if (v instanceof Date) {
        v = v.getHours() * 60 + v.getMinutes() + v.getSeconds() / 60;
      }
      obj[h] = v;
    });
    rows.push(obj);
  }
  return rows;
}

function findRowIndex_(sheet, trayek, bulanIndex) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]) === String(trayek) && Number(values[i][2]) === Number(bulanIndex)) {
      return i + 1; // nomor baris sheet (1-indexed)
    }
  }
  return -1;
}

function saveEntry_(sheet, entry) {
  const rowValues = [
    new Date(),
    entry.trayek,
    entry.bulanIndex,
    entry.bulanLabel || '',
    numOrEmpty_(entry.penumpang),
    numOrEmpty_(entry.ritase),
    numOrEmpty_(entry.headway),
    numOrEmpty_(entry.kecepatan),
    numOrEmpty_(entry.rtt),
    numOrEmpty_(entry.kmTempuh),
    numOrEmpty_(entry.loadFactor),
  ];
  const existingRow = findRowIndex_(sheet, entry.trayek, entry.bulanIndex);
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function deleteEntry_(sheet, trayek, bulanIndex) {
  const rowIndex = findRowIndex_(sheet, trayek, bulanIndex);
  if (rowIndex > 0) sheet.deleteRow(rowIndex);
}

function numOrEmpty_(v) {
  return (v === null || v === undefined || v === '') ? '' : Number(v);
}

/* ================= helper: log aktivitas ================= */

function getOrCreateLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    sheet.appendRow(LOG_HEADERS);
    sheet.setFrozenRows(1);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(LOG_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function logActivity_(aksi, role, trayek, bulanLabel) {
  try {
    const sheet = getOrCreateLogSheet_();
    sheet.appendRow([new Date(), aksi, role, trayek || '', bulanLabel || '']);
    // Buang baris paling lama kalau sudah kepanjangan, biar sheet tetap ringan.
    const lastRow = sheet.getLastRow();
    if (lastRow - 1 > LOG_MAX_ROWS) {
      sheet.deleteRows(2, lastRow - 1 - LOG_MAX_ROWS);
    }
  } catch (err) {
    // Jangan sampai gagal mencatat log bikin aksi simpan/hapus utama ikut gagal.
  }
}

// Ambil 100 baris log paling baru saja (biar respons API tetap ringan).
function readLogRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    rows.push(obj);
  }
  return rows.slice(-100).reverse(); // terbaru duluan
}

function monthLabelFromIndex_(idx) {
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return months[idx] || '';
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
