# Sumber fundamental resmi IDX — hasil uji langsung 16 Agustus 2026

Ditulis setelah menguji endpoint IDX **dari IP rumahan Johan** (bukan dari
runner/datacenter). Hasilnya mengubah beberapa anggapan lama.

## Ringkas

| Yang diuji | Hasil dari IP rumahan |
|---|---|
| `GetSecuritiesStock` | ✅ HTTP 200 · 132 KB |
| `GetStockSummary` | ✅ HTTP 200 · 643 KB |
| **`GetBrokerSummary`** | ✅ **HTTP 200 · 88 broker** |
| `GetCompanyProfiles` | ✅ HTTP 200 · **962 emiten** |
| **`GetFinancialReport`** | ✅ HTTP 200 · **778 emiten TW2 2026** |
| Unduh `FinancialStatement-*.xlsx` | ✅ 298 KB, terbaca penuh |

Bandingkan: dasbor SPLE memanggil endpoint broker yang sama lewat Netlify
Function dan menerima **`IDX API 403`** — IP datacenter diblokir. Jalur kita
lewat mesin rumahan justru terbuka. Ini pola yang sudah dikenal di proyek ini
(GitHub Actions diblokir, `JALANKAN_OTOMATIS.bat` lokal jalan).

---

## 1. Laporan keuangan resmi — XLSX ber-XBRL per emiten

Endpoint daftar:

```
https://www.idx.co.id/primary/ListedCompany/GetFinancialReport
  ?indexFrom=1&pageSize=1000&year=2026&reportType=rdf
  &EmitenType=s&periode=tw2&kodeEmiten=&SortColumn=KodeEmiten&SortOrder=asc
```

`periode`: `tw1` · `tw2` · `tw3` · `audit` (tahunan).

Tiap emiten mengembalikan `Attachments` berisi:

| Berkas | Isi |
|---|---|
| `FinancialStatement-<tahun>-<TW>-<KODE>.xlsx` | **Laporan lengkap ber-tag XBRL, dwibahasa** |
| `instance.zip` · `inlineXBRL.zip` | XBRL mentah untuk parsing terprogram |
| `FinancialStatement-…pdf` | Versi cetak |
| PDF laporan resmi emiten | Dokumen asli |

**Cakupan terukur (TW2 2026)**: 778 emiten, **777 punya .xlsx**, 774 punya XBRL.

### Isi berkas XLSX

Satu berkas = 47 sheet, tiap sheet satu kode taksonomi XBRL:

| Sheet | Isi |
|---|---|
| `1000000` | Informasi umum — nama, kode, **sektor/subsektor/industri/subindustri resmi IDX**, standar akuntansi, **informasi pemegang saham pengendali** |
| `4220000` | Laporan posisi keuangan (neraca) — 238 baris |
| `4312000` / `4322000` | Laba rugi & penghasilan komprehensif |
| `4410000` (+`PY`) | Perubahan ekuitas, dengan kolom tahun sebelumnya |
| `4510000` / `4520000` | Arus kas |
| `4611000`–`4695000` | Catatan atas laporan keuangan, per pos |
| `Context`, `hidden`, `Token` | Metadata XBRL |

Tiap baris dwibahasa: label Indonesia **dan** Inggris berdampingan.

### Kenapa ini lebih baik daripada Yahoo

| | Yahoo (sekarang) | IDX XLSX/XBRL |
|---|---|---|
| Asal angka | Agregator pihak ketiga | **Langsung dari emiten, resmi** |
| Cakupan | 646 emiten | **777 emiten** |
| Ruas per periode | 15 | **Ratusan** (seluruh pos + catatan) |
| Lubang data | `operating_cf` 80% kosong, `eps` 71% | Tidak ada — kalau emiten melaporkannya, ada |
| Sektor | Klasifikasi Yahoo | **IDX-IC resmi** (sektor→subindustri) |
| Bahasa | Inggris | Dwibahasa |
| Pemegang saham pengendali | ❌ | ✅ ada di sheet `1000000` |
| Kedalaman | 5 tahun / ~6 kuartal | Sejauh arsip IDX menyimpannya |

Yang Yahoo tetap unggul: rasio & metrik turunan siap pakai (PER, PBV, ROE,
Altman Z, F-Score, beta, target analis, median sektor) — itu tetap layak
dipertahankan. Rencananya bukan mengganti Yahoo, tapi **menambahkan IDX
sebagai sumber angka mentah** dan memakai Yahoo untuk turunannya.

---

## 2. Broker summary — sebagian mitos terbantah

`GetBrokerSummary?date=YYYYMMDD` mengembalikan **88 broker** dengan `IDFirm`,
`FirmName`, `Volume`, `Value`, `Frequency` untuk tanggal itu.

**Tapi**: parameter `stockCode`/`kodeEmiten` **diabaikan** — hasilnya selalu
level pasar, bukan per emiten. Jadi:

- Broker per **pasar** → tersedia lewat API (kita sudah punya juga dari PDF harian).
- Broker per **emiten** → tetap belum ketemu di endpoint publik. Dasbor SPLE
  memanggil `broker-data?kode=` dan hasilnya `rows: []` dengan error 403, jadi
  belum terbukti mereka benar-benar mendapatkannya.

Artinya #129 (bandarmologi) masih terhalang, tapi #151 berkurang cakupannya:
yang perlu dicari tinggal broker **per emiten**.

---

## 3. Profil perusahaan

`GetCompanyProfiles?start=0&length=1000&emitenType=s` → **962 emiten** dengan
alamat, BAE, industri, subindustri, email, situs, jenis efek yang diterbitkan.
Berguna untuk melengkapi metadata emiten yang sekarang diambil dari Yahoo.

---

## 4. Yang perlu diperhatikan sebelum memanen

- **Jangan dari runner/datacenter.** Terbukti diblokir. Panen wajib dari
  `JALANKAN_OTOMATIS.bat` di mesin rumahan.
- **Sopan santun sama seperti Yahoo**: satu permintaan pada satu waktu, jeda
  acak, backoff yang menghormati penolakan. 777 berkas × ~300 KB ≈ 230 MB
  sekali panen penuh — hanya perlu diulang saat ada rilis kuartalan baru,
  bukan harian.
- **Simpan hasil parse, bukan berkas mentahnya.** 230 MB XLSX tak perlu masuk
  repo; yang disimpan JSON hasil ekstraksi seperti `keuangan/<KODE>.json`
  sekarang.
- **`msoffcrypto-tool` tidak diperlukan** — XLSX IDX tidak terenkripsi.

## 5. Backlog yang lahir dari sini

| # | Tugas |
|---|---|
| 156 | Panen laporan keuangan resmi IDX (XLSX/XBRL) sebagai sumber utama, Yahoo tetap untuk rasio turunan |
| 157 | Ambil sektor/subsektor/industri/subindustri IDX-IC resmi dari sheet `1000000` — menggantikan klasifikasi Yahoo |
| 158 | Tarik "informasi pemegang saham pengendali" dari laporan resmi — pelengkap grup konglomerat (#155) yang sekarang hanya dari KSEI |
| 159 | Panen `GetBrokerSummary` harian ke JSON (88 broker) — pelengkap yang sekarang diparse dari PDF |

---

## 6. Runbook — cara memanggilnya

Semua contoh sudah **diuji dari mesin rumahan** 16 Agustus 2026. Wajib pakai
User-Agent peramban; tanpa itu IDX menolak.

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
```

### 6.1 Daftar laporan keuangan satu periode

```bash
curl -s -A "$UA"   "https://www.idx.co.id/primary/ListedCompany/GetFinancialReport?indexFrom=1&pageSize=1000&year=2026&reportType=rdf&EmitenType=s&periode=tw2&kodeEmiten=&SortColumn=KodeEmiten&SortOrder=asc"
```

| Parameter | Nilai | Catatan |
|---|---|---|
| `year` | `2026` | Tahun buku |
| `periode` | `tw1` `tw2` `tw3` `audit` | `audit` = laporan tahunan |
| `EmitenType` | `s` | Saham |
| `reportType` | `rdf` | |
| `kodeEmiten` | `BBCA` atau kosong | Kosong = semua |
| `pageSize` | `1000` | Cukup untuk seluruh emiten |

Balasan: `ResultCount` + `Results[]`, tiap entri punya `KodeEmiten`,
`Report_Period`, `Report_Year`, `File_Modified`, dan `Attachments[]`.

### 6.2 Unduh berkas lampiran

`Attachments[].File_Path` sudah berisi jalur relatif. Tempelkan ke host,
**spasi harus di-encode jadi `%20`**:

```bash
BASE="https://www.idx.co.id"
PATH_XLSX="/Portals/0/StaticData/ListedCompanies/Corporate_Actions/New_Info_JSX/Jenis_Informasi/01_Laporan_Keuangan/02_Soft_Copy_Laporan_Keuangan//Laporan%20Keuangan%20Tahun%202026/TW2/BBCA/FinancialStatement-2026-II-BBCA.xlsx"
curl -s -A "$UA" -o BBCA-TW2-2026.xlsx "$BASE$PATH_XLSX"
```

Perhatikan `//` ganda di tengah jalur — itu memang apa adanya dari API, jangan
dirapikan. Berkasnya **tidak terenkripsi**, langsung terbaca `openpyxl`.

### 6.3 Sheet yang penting di XLSX

| Sheet | Isi | Yang diambil |
|---|---|---|
| `1000000` | Informasi umum | Nama, kode, **sektor/subsektor/industri/subindustri**, standar akuntansi, **pemegang saham pengendali** |
| `4220000` | Posisi keuangan | Aset, liabilitas, ekuitas (238 baris) |
| `4312000` / `4322000` | Laba rugi komprehensif | Pendapatan sampai laba bersih |
| `4410000` (+`PY`) | Perubahan ekuitas | Dengan kolom tahun sebelumnya |
| `4510000` / `4520000` | Arus kas | CFO/CFI/CFF — **ruas yang 80% kosong di Yahoo** |

Tiap baris dwibahasa: kolom label Indonesia dan Inggris berdampingan, jadi
pencocokan pos sebaiknya lewat label Inggris yang lebih stabil.

### 6.4 Broker summary harian

```bash
curl -s -A "$UA"   "https://www.idx.co.id/primary/TradingSummary/GetBrokerSummary?length=100&start=0&date=20260814"
```

88 broker: `IDFirm`, `FirmName`, `Volume`, `Value`, `Frequency`.
`stockCode` **diabaikan** — tidak ada rincian per emiten lewat endpoint ini.

### 6.5 Profil perusahaan

```bash
curl -s -A "$UA"   "https://www.idx.co.id/primary/ListedCompany/GetCompanyProfiles?start=0&length=1000&emitenType=s"
```

962 emiten: alamat, BAE, industri, subindustri, email, situs, jenis efek.

### 6.6 Yang TIDAK berhasil

| Dicoba | Hasil |
|---|---|
| Halaman **Financial Data and Ratio** (digital statistic) | Tombol "Terapkan" tak memicu satu pun permintaan XHR; unduhan PDF/Excel tampaknya dirakit di server per permintaan manual. Endpoint API-nya belum ketemu |
| `StatisticData/GetFinancialDataRatio` dan tiga variasi tebakan | 404 |
| `GetBrokerSummary` + `stockCode` | Parameter diabaikan |
| `GetFinancialStatement` | 404 — nama yang benar `GetFinancialReport` |

### 6.7 Sopan santun & jadwal

- **Hanya dari IP rumahan.** Dari runner/datacenter → 403.
- Satu permintaan pada satu waktu, jeda acak, backoff menghormati penolakan —
  pola yang sudah dipakai `panen_ohlc.py`.
- Laporan keuangan **berubah per kuartal**, bukan harian. Panen penuh cukup
  saat musim rilis (akhir Apr / Jul / Okt / Mar). 777 berkas × ~300 KB ≈ 230 MB
  sekali jalan.
- **Simpan hasil parse, bukan berkas mentahnya.** Pola yang sama dengan
  `keuangan/<KODE>.json` sekarang.
- Broker summary & profil: harian/mingguan, ringan.

---

## 7. Rencana implementasi — apa masuk ke halaman mana

| Data baru | Halaman PAPAN | Bagian | Berkas yang disentuh |
|---|---|---|---|
| **Laporan keuangan resmi** (#156) | **Stock Detail** | Panel "Laporan Keuangan" yang sudah ada — sumbernya diganti/digabung | `scripts/panen_lapkeu_idx.py` (baru) → `data-idx/json/keuangan/<KODE>.json` · `lib/dasbor/stockDetailData.ts` |
| **Sektor IDX-IC resmi** (#157) | **Sektor & Indeks**, **Screener** (nanti), **Stock Detail** | Ganti klasifikasi Yahoo; jadi dasar filter sektor | `data-idx/json/emiten_sektor.json` (baru) · `lib/dasbor/*` |
| **Pemegang saham pengendali** (#158) | **Peta Investor** → tab **Grup Konglomerat** | Pelengkap pencocokan KSEI; menutup celah SPV bernama netral | `scripts/petakan_grup.py` (`TAMBAHAN_MANUAL` diganti sumber resmi) |
| **Broker summary harian** (#159) | **Top Broker** | Sumber kedua di samping parse PDF — saling periksa | `scripts/panen_broker_idx.py` (baru) → `data-idx/json/broker_harian.json` |
| **Profil perusahaan** | **Stock Detail** | Kepala emiten: alamat, situs, BAE, jenis efek | `data-idx/json/profil_emiten.json` (baru) |

### Urutan yang masuk akal

1. **#157 sektor IDX-IC** — paling murah (satu sheet, satu berkas kecil), tapi
   dipakai banyak halaman. Sekalian memperbaiki dasar filter untuk screener.
2. **#159 broker harian** — ringan, dan langsung memberi pembanding untuk
   angka yang sekarang diparse dari PDF.
3. **#156 laporan keuangan** — paling berat, tapi menutup lubang `operating_cf`
   80% dan `eps` 71% yang sekarang membuat panel Stock Detail bolong.
4. **#158 pemegang saham pengendali** — setelah #156, karena datanya ikut di
   berkas yang sama (sheet `1000000`).

### Yang TIDAK berubah

Rasio dan metrik turunan (Altman Z, F-Score, ROIC, beta, target analis, median
sektor) **tetap dari Yahoo** — IDX tidak menyediakannya, dan itu justru
keunggulan `fundamental/` kita yang 147 ruas.


---

## Hasil panen pertama — 17 Agu 2026

`scripts/panen_keuangan_idx.py` dijalankan penuh untuk TW2 2026. Keluarannya
`data-idx/json/keuangan_idx/`, berskema identik dengan `keuangan/` (15 ruas per
periode) plus ruas `"sumber": "idx-xbrl"`.

| | Berkas |
|---|---|
| yfinance (`keuangan/`) | 646 |
| XBRL IDX (`keuangan_idx/`) | **774** |
| **Gabungan** | **873** dari 959 |

**Yang paling penting, dan tak terduga dari dua arah:**

- **227 emiten hanya ada di XBRL** — yfinance tak punya apa pun untuk mereka.
  Ini terbukti bukan soal rate limit: panen ulang `fetch_keuangan.py` untuk 313
  emiten yang kurang menghasilkan `0 berhasil, 313 kosong, 0 gagal`.
- **99 emiten justru hanya ada di yfinance.** Jadi XBRL **tidak boleh
  menggantikan** sumber lama — mengganti berarti kehilangan 99 emiten.

Untuk 546 emiten yang ada di kedua sumber, dibandingkan pada periode terakhir
masing-masing:

| | Rata-rata ruas terisi (dari 15) |
|---|---|
| yfinance | 12,8 |
| XBRL IDX | **13,1** |

- XBRL lebih lengkap: **288** emiten
- yfinance lebih lengkap: **95** emiten
- Imbang: 163 emiten

Kesimpulannya menguatkan rancangan `fundamentalGabungan.ts` yang sudah ada:
**dua sumber yang saling menambal**, bukan satu yang menang mutlak. Yang perlu
diputuskan berikutnya adalah urutan menangnya per-ruas, bukan per-sumber.

Sisa **86 emiten** tak punya data di sumber mana pun — kemungkinan besar emiten
yang memang belum menyampaikan laporan TW2 2026, dan itu keadaan yang harus
ditampilkan apa adanya, bukan ditutup dengan angka nol.

**Panen ini baru TW2 2026 (satu periode).** Cara menambah periodenya ada di
docstring skripnya.


---

## ⚠️ JEBAKAN: kunci periodenya sama, artinya TIDAK

Ini yang paling mudah merusak dan paling sulit terlihat. Kedua sumber memakai
kunci periode `2026-06-30`, tapi angkanya menghitung rentang yang berbeda:

| Sumber | Yang dihitung |
|---|---|
| `keuangan/` (yfinance) | Kuartal **diskret** — hanya Apr–Jun |
| `keuangan_idx/` (XBRL IDX) | Laporan interim **kumulatif** — Jan–Jun |

Terukur 17 Agu 2026, ruas `revenue` periode `2026-06-30`:

| Emiten | yfinance | XBRL IDX | Rasio |
|---|---|---|---|
| TLKM | 38.689.000.000.000 | 75.878.000.000.000 | **1,96×** |
| ASII | 79.245.000.000.000 | 157.913.000.000.000 | **1,99×** |
| ICBP | 20.147.664.000.000 | 41.863.388.000.000 | **2,08×** |

**Menggabungkan keduanya per-ruas dengan aturan "yang tidak null menang" akan
menghasilkan angka yang salah hampir dua kali lipat, tanpa satu pun galat.**
Neraca (`total_assets`, `total_liabilities`, `cash`) aman karena posisi pada
satu tanggal — yang berbahaya khusus ruas ARUS: `revenue`, `cogs`,
`gross_profit`, `operating_income`, `net_income`, dan ketiga ruas arus kas.

**Sudah disambung sejak #67** (`bde4b97e`, 17 Agu 2026) — paragraf di bawah ini
dulu berbunyi "`fundamentalGabungan.ts` **belum** membaca `keuangan_idx/`, jangan
disambung dulu", dan kalimat itu tertinggal berhari-hari sesudah penyambungannya
selesai. Akibatnya nyata: 18 Agu 2026 halaman Metodologi publik ikut menyatakan
kedua sumber "belum digabungkan", karena penulisnya mengutip berkas ini dengan
patuh. Peringatan yang sudah dijalankan wajib ditutup di tempat ia ditulis —
kalau tidak, ia terus dipatuhi.

Yang akhirnya diputuskan dan sudah berjalan: angka XBRL **dikonversi ke kuartal
diskret** (kumulatif TW2 dikurangi kumulatif TW1) sebelum dipakai, laporan resmi
bursa menang bila ada, dan tiap sel membawa lencana asalnya di
`PanelLaporanKeuangan.tsx` (`B` = laporan bursa, `B·YTD` = interim kumulatif).
Berkasnya tetap disimpan terpisah supaya asal angkanya tak pernah hilang;
penggabungannya terjadi saat ditampilkan, bukan saat dipanen.

### Batas riwayat: IDX berhenti di tahun buku 2019

Diukur 18 Agustus 2026, lewat peramban (supaya 403 di klien HTTP tak mengaburkan
hasilnya) dengan `periode=audit`:

| Tahun buku | `ResultCount` di IDX | Sudah dipanen |
|---|---|---|
| 2025 | — | 882 |
| 2024 | — | 847 |
| 2023 | — | 846 |
| **2022** | **808** | **562** ← masih kurang 246, layak dipanen ulang |
| 2021 | — | 745 |
| 2020 | — | 699 |
| **2019** | **664** | **664** ← dipanen 18 Agu, tuntas |
| **2018** | **0** | — |
| 2017 dan lebih tua | 0 | — |

**2018 ke belakang bukan gagal panen — IDX memang tak menyajikannya.** Panen
2018 melaporkan "0 berhasil, 959 kosong, 0 gagal", dan itu jawaban jujur dari
daftar yang memang kosong. Diperiksa ulang lewat peramban: `ResultCount: 0`,
`Results: []`.

Artinya **kedalaman maksimum laporan keuangan resmi dari sumber ini 2019–2025
(tujuh tahun buku)**, bukan sepuluh. Permintaan "fundamental 10 tahun ke
belakang" tidak bisa dipenuhi dari IDX; yfinance pun mentok 4 tahun. Kalau 10
tahun benar-benar diperlukan, sumbernya harus dicari di luar keduanya — dan itu
keputusan tersendiri, bukan soal menjalankan pemanen lebih lama.

Jangan menjadwalkan panen ulang untuk 2018 dan sebelumnya: hasilnya akan selalu
nol, dan tiap percobaan tetap menembak endpoint yang gampang menolak.

### Kenapa ruas bank kosong di XBRL

Bukan kegagalan panen: taksonomi "Financial and Sharia Industry" memang tak
punya baris "Revenue" tunggal — pendapatan bunga, premi, dan komisi terpisah.
Jadi `revenue`/`cogs`/`gross_profit` null untuk bank di XBRL adalah keadaan
yang benar, dan justru di situ yfinance menambal.

### Catatan lain dari panen pertama

- **Bucket `tahunan` kosong untuk SEMUA emiten** — TW2 tak memuat angka tahun
  penuh teraudit. Perlu dijalankan lagi dengan `--periode audit`.
- **Skala pelaporan berbeda antar emiten.** TLKM melapor dalam **miliaran**,
  sementara BBCA/ASII/ACST dalam **jutaan**. Versi pertama parser hanya
  mengenal juta/ribu dan diam-diam memakai skala 1 untuk TLKM — seluruh
  angkanya 1.000× terlalu kecil tanpa galat. Sekarang ruas "Level of rounding"
  dibaca per berkas.
- **Satuan EPS tidak konsisten di berkas sumbernya sendiri**: BBCA/BMRI/ICBP
  menandai rupiah penuh, TLKM/ASII/ACST menandainya ikut skala jutaan.
  Diatasi dengan ambang kewajaran (0,001–1.000.000 rupiah/lembar) — diuji pada
  10 emiten rintisan, **belum** pada seluruh 774. Kalau ada EPS yang terlihat
  aneh di layar, ini titik periksa pertama.
- **ANTM dan AADI tidak ada** di daftar 778 laporan TW2 2026 dari API IDX
  sendiri — diverifikasi langsung, bukan bug skrip. ANTM emiten besar; layak
  ditanyakan kenapa absen.
- Sheet dikenali lewat **judulnya**, bukan nomor sheet: penomoran berbeda per
  industri (1xxx Umum, 3xxx Infrastruktur, 4xxx Keuangan & Syariah).
