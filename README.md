# Dashboard Operasional TransJogja

Dashboard operasional armada Trans Jogja — ringkasan KPI, data per trayek,
import data bulanan (Excel/CSV), dan laporan.

**Arsitektur:** Google Sheet (database) → Google Apps Script (API) → GitHub → Vercel.
Semuanya pakai layanan gratis, tanpa batas masa aktif.

```
[Browser: HTML/CSS/JS]  ──fetch──►  [Apps Script Web App]  ──►  [Google Sheet]
        ▲                                                            │
        └──────────── data JSON ─────────────────────────────────────┘
```

---

## Struktur folder

```
.
├── index.html              # kerangka halaman
├── css/
│   └── style.css           # seluruh styling
├── js/
│   ├── libs.js             # pemuat Chart.js & SheetJS (CDN cadangan)
│   ├── config.js           # pemuat config/config.json
│   ├── utils.js            # format angka, normalisasi data, toast, unduh file
│   ├── api.js              # komunikasi ke Apps Script
│   ├── auth.js             # login & pembatasan role
│   ├── dashboard.js        # KPI + grafik ringkasan
│   ├── compare.js          # tabel perbandingan antar trayek
│   ├── routes.js           # halaman data per trayek
│   ├── import.js           # import Excel/CSV + validasi
│   ├── manual-input.js     # form input manual + tabel data + backup
│   ├── features.js         # target SPM, glosarium, log, anomali, PDF, pencarian
│   └── main.js             # entry point / urutan startup
├── config/
│   └── config.json         # SEMUA pengaturan ada di sini
├── apps-script/
│   └── Code.gs             # backend, dipasang di Google Apps Script
├── vercel.json             # konfigurasi hosting
└── .gitignore
```

Library eksternal (Chart.js & SheetJS) dimuat dari CDN lewat `js/libs.js`,
jadi repo ini tetap ringan. Loader-nya punya **3 CDN cadangan berantai**
(jsDelivr → cdnjs → unpkg) dan berjalan di latar belakang, sehingga halaman
tetap muncul cepat. Kalau semua CDN gagal, aplikasi tetap jalan — tabel dan
data tetap bisa dipakai, hanya grafik & fitur Excel yang nonaktif, disertai
pemberitahuan.

---

## Cara pasang

### 1. Siapkan backend (Google Sheet + Apps Script)

1. Buat Google Sheet baru, beri nama bebas.
2. Buka **Extensions → Apps Script**, hapus isi default.
3. Copy-paste seluruh isi `apps-script/Code.gs` ke sana, lalu Save.
4. Klik **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Authorize saat diminta (klik **Advanced → Go to … (unsafe) → Allow** kalau
   muncul peringatan — ini normal untuk script buatan sendiri).
6. Copy **Web app URL** yang muncul.

> Kalau nanti `Code.gs` diubah, wajib deploy versi baru:
> **Deploy → Manage deployments → Edit (pensil) → New version → Deploy**.
> URL-nya tidak berubah.

### 2. Isi konfigurasi

Buka `config/config.json`, isi minimal dua hal:

```json
{
  "appsScriptUrl": "https://script.google.com/macros/s/XXXXX/exec",
  "auth": {
    "pins": { "admin": "GANTI_INI", "input": "GANTI_INI_JUGA" }
  }
}
```

### 3. Jalankan lokal (opsional, untuk uji coba)

Harus lewat server — **tidak bisa** dibuka langsung dengan double-click,
karena `config.json` diblokir oleh browser kalau protokolnya `file://`.

```bash
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

### 4. Deploy ke Vercel lewat GitHub

1. Push repo ini ke GitHub.
2. Buka [vercel.com](https://vercel.com) → **Add New → Project** → pilih repo.
3. Framework Preset: **Other**. Build Command & Output Directory: kosongkan.
4. Klik **Deploy**. Selesai — tiap `git push` berikutnya otomatis ter-deploy.

---

## Role pengguna

| Role | PIN | Bisa apa |
|---|---|---|
| **Admin** | dari `config.json` | Semua: tambah, timpa, hapus data |
| **Input** | dari `config.json` | Hanya menambah data baru — tidak bisa menimpa data lama |
| **Guest** | tanpa PIN | Hanya melihat; tab Import Data disembunyikan |

> ⚠️ **Catatan keamanan yang penting.**
> Sistem role ini proteksi ringan di sisi browser saja. PIN ada di
> `config/config.json` yang bisa diunduh siapa pun yang tahu URL-nya
> (`namasitus.vercel.app/config/config.json`). Ini cukup untuk mencegah
> salah-klik dan membatasi akses tim internal secara informal, **tapi bukan
> pengaman terhadap orang yang sengaja membobol.** Kalau datanya benar-benar
> sensitif, pindahkan autentikasi ke sisi server — misalnya cek
> `Session.getActiveUser().getEmail()` di Apps Script, atau pakai Supabase Auth.

---

## Format import data

Header wajib (urutan kolom bebas, nama harus sama). Berlaku untuk `.xlsx`,
`.xls`, maupun `.csv`:

```
Bulan,Trayek,Penumpang,Ritase,Headway,Kecepatan,RTT,KmTempuh,LoadFactor
```

| Kolom | Wajib | Contoh | Catatan |
|---|---|---|---|
| Bulan | ✅ | `Januari` | nama bulan lengkap Bahasa Indonesia |
| Trayek | ✅ | `1A`, `Listrik` | sesuai daftar di `config.json` |
| Penumpang | — | `84210` | |
| Ritase | — | `1980` | |
| Headway | — | `12` atau `0.21` | menit, atau notasi jam.menit |
| Kecepatan | — | `23.1` | km/jam |
| RTT | — | `124` atau `2.09` | menit, atau notasi jam.menit |
| KmTempuh | — | `83200.5` | |
| LoadFactor | — | `0.52` atau `52` | desimal atau persen — dideteksi otomatis |

Template siap isi bisa diunduh lewat tombol di tab **Import Data**.

**Konversi otomatis** yang dilakukan sistem:
- `LoadFactor` > 1.5 dianggap format persen → dibagi 100 (`52` → `0.52`)
- `Headway`/`RTT` bertitik dengan nilai tak masuk akal sebagai menit dianggap
  notasi jam.menit (`2.09` → 129 menit)
- Baris dengan bulan/trayek tak dikenali dilewati tanpa error
- Import ulang trayek+bulan yang sama akan **menimpa** data lama

---

## Batasan

- **Kuota Apps Script**: 20.000 panggilan/hari (import 1 bulan = 20 panggilan).
- **Import dikirim satu per satu**, bukan sekali kirim — 20 baris butuh
  beberapa detik, progresnya kelihatan di layar.
- **Bukan multi-user real-time** — kalau dua orang menyimpan trayek+bulan yang
  sama bersamaan, yang terakhir menang.
- **Target SPM tersimpan per browser** (localStorage), tidak ikut tersinkron
  antar perangkat.
