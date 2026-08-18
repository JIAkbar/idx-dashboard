# Workflow pekerjaan — fundamental, bedah emiten, dan sisa temuan riset

Disusun 16 Agustus 2026 setelah riset SPLE (`docs/riset/sple/`) dan uji
endpoint IDX (`docs/sumber-fundamental-idx.md`).

Aturan main dokumen ini:

- **Satu fase = satu commit yang bisa berdiri sendiri.** Kalau sebuah fase
  batal di tengah, yang sudah masuk tetap berguna.
- **Tiap fase punya "selesai kalau"** yang bisa diperiksa orang lain, bukan
  perasaan.
- **Verifikasi wajib**: `tsc` bersih, `npm test` lolos, dan dua viewport
  (1536×960×1.25 · 412×915×2.625) untuk apa pun yang menyentuh tampilan.
- Fase berurutan dalam satu jalur; jalur berbeda boleh paralel.

---

## Jalur A — Fundamental (menuju halaman Bedah Emiten)

### A0 · Satukan dua sumber fundamental — **kerjakan pertama**

**Masalah**: `keuangan/<KODE>.json` (Yahoo, 646 emiten) punya lubang besar —
`operating_cf` kosong **80%**, `eps` **71%**, `cogs`/`gross_profit`/
`operating_income` **22%**. Sementara `fundamental/<KODE>.json` (967 emiten,
147 ruas) justru punya `ttm_ocf`, `eps`, `q_ocf`, `hist_*`.

Dua berkas menjelaskan hal yang sama dengan lubang di tempat berbeda, dan
panel Stock Detail hanya membaca satu.

**Kerjakan**:
1. `lib/dasbor/stockDetailData.ts` — saat sebuah ruas kosong di `keuangan/`,
   ambil padanannya dari `fundamental/`.
2. Tandai asal tiap angka (`sumber: 'lapkeu' | 'turunan'`) supaya tak ada
   angka tanpa jejak.

**Selesai kalau**: panel Laporan Keuangan Stock Detail tak lagi menampilkan
"—" untuk arus kas operasi pada emiten yang `fundamental/`-nya punya angka
itu. Diperiksa pada 5 emiten sampel lintas sektor.

**Ongkos**: kecil. **Tak butuh panen apa pun.**

---

### A0b · Ruas RINGKAS fundamental yang tak pernah dihitung — ✅ **SELESAI 18 Agu**

A0 menggabung tabel **per periode**. Yang tersisa lubangnya adalah ruas
**ringkas** di kepala `fundamental/<KODE>.json` — `eps`, `pe`, `der`, `roe`,
`dividend_yield` — dan semuanya ternyata bukan hasil hitungan kita sama
sekali, melainkan SALINAN LANGSUNG `info` yfinance (`trailingEps`,
`trailingPE`, `debtToEquity`, `returnOnEquity`, `dividendYield`,
`fetch_fundamental.py:835-891`). Begitu yfinance tak punya kuncinya, ruasnya
kosong selamanya — walaupun `ttm_net_income`, `shares`, `last_price`, dan
`der_q` ada di berkas yang sama. Lubangnya **"tak pernah dihitung"**, bukan
"sumbernya tak punya".

`scripts/lengkapi_fundamental.py` (nol permintaan jaringan, dijalankan
SESUDAH `fetch_fundamental.py` di alur CI — `fetch` menulis ulang berkas dari
nol, jadi tambalannya wajib dihitung ulang tiap kali):

| ruas | sebelum | sesudah | dari |
|---|---|---|---|
| `eps` | 84% | **98%** | `ttm_net_income ÷ shares`; cadangan EPS tahunan XBRL |
| `hist_eps` | 67% | **97%** | EPS tahunan XBRL apa adanya — BUKAN `hist_net_income ÷ shares`, karena jumlah saham yang kita punya cuma yang SEKARANG sedangkan EPS 2022 harus dibagi saham 2022 |
| `f_score` | 66% | **97%** | Piotroski **parsial** 7 dari 9 komponen dari XBRL tahunan (`f_score_n` mencatat berapa yang terhitung, jadi 5/7 tak terbaca 5/9) |
| `der` | 79% | **93%** | `der_q × 100` — terukur `der/der_q` median 99,4× di 514 emiten, jadi `der` persen & `der_q` rasio; cadangan XBRL |
| `roe` | 88% | **98%** | `ttm_net_income ÷ lq_equity`, lalu `÷ (bv × shares)`, lalu XBRL tahunan |
| `pe` | 62% | **69%** | `last_price ÷ eps`, **hanya kalau EPS > 0** |
| `dividend_yield` | 41% | 42% | DPS 12 bulan terakhir dari `div_history` (satu-satunya yang punya `ex_date`) ÷ harga |

Tiap angka turunan menulis asalnya ke `asal_turunan` dan tampil berlencana
superscript `≈` (dihitung ulang) atau `B` (laporan resmi bursa) —
`components/dasbor/LencanaTurunan.tsx`, alasannya sama dengan `lencanaAsal`
di `PanelLaporanKeuangan.tsx`.

**Yang tetap kosong, dan itu jawaban yang benar:**

- `pe` 292 sisanya — **278 di antaranya EPS ≤ 0**. Emiten rugi tak punya
  P/E; yfinance pun tak memberikannya. Bukan lubang data.
- `dividend_yield` 557 sisanya — **347 tak pernah bagi dividen sama sekali**,
  **210 terakhir bagi lebih dari 12 bulan lalu**. Cuma 4 yang benar-benar
  lubang, dan keempatnya sudah terisi.
- `altman_z` — **tak diisi sama sekali.** Z" butuh modal kerja dan saldo laba.
  `lq_wc` ada di **3 dari 398** emiten yang kosong, saldo laba tak pernah
  diekspor, dan `panen_keuangan_idx.py` tak memanen keduanya. **Jalan
  naiknya** (bersama A3): tambah `Total current assets`, `Total current
  liabilities`, `Retained earnings` ke `ekstrak()` lalu panen ulang periode
  terbaru. Arsip mentah sudah ada untuk audit 2022/2023/2024 (2.548 XLSX di
  `_arsip-mentah/keuangan_idx/`, nol biaya jaringan) tapi 2025/2026 belum,
  jadi tetap perlu satu panen — dan Altman dari neraca dua tahun lalu tak
  ada gunanya.

**Ongkos**: kecil. Jangan ulangi pengukurannya — angkanya sudah di tabel atas.

---

### A0c · q_eps kuartalan — BUKAN sengaja kosong, itu bug currency — ✅ **SELESAI 18 Agu**

Klaim A0b di atas ("q_eps tak diisi karena XBRL IDX cuma punya 1 periode
kumulatif") **salah** — itu menggambarkan jalur XBRL yang tak pernah dipakai.
`q_eps` sebenarnya SUDAH dihitung `fetch_fundamental.py` sejak awal, dari
`q_net_income` yfinance (`quarterly_financials`, dikonfirmasi **DISKRET**
per kuartal — jumlah 4 kuartal ≈ nilai tahunan di 122 sampel, bukan
kumulatif). Bug-nya: net income kuartal dibagi `shares` **SEBELUM**
disamakan ke IDR (`konversi_dict_ke_idr`), bukan sesudah — beda dari
rev_ps/cash_ps/fcf_ps/ocf_ps yang semuanya benar. Untuk 85 emiten pelapor
non-IDR (`financial_currency = USD`), hasilnya kepotong ke **0,00** (ARCI:
532 miliar IDR net income / kurs ±16.300 / 25,2 miliar saham = 0,001
USD/saham). Laporan Johan ("data-datanya kosong, katanya panen lengkap?")
persis gejala ini di tabel EPS Kuartalan Stock Detail.

**Dibetulkan di DUA tempat**:
1. `scripts/fetch_fundamental.py` — `q_eps` sekarang dihitung dari `q_ni_idr`
   (SUDAH IDR), bukan `q_ni` mentah. Root cause, mencegah bug ini muncul lagi
   di panen berikutnya.
2. `scripts/lengkapi_fundamental.py` — `q_eps_baru()` menambal 967 berkas
   LAMA (nol permintaan jaringan), **84 emiten diperbaiki**.

**Dua guard WAJIB ada di `q_eps_baru()`** — ditemukan lewat sanity-check
sum-4-kuartal vs `eps` TTM saat menjalankan patch-nya, BUKAN teori:
- `shares_masuk_akal()` — `shares` yfinance kadang ketinggalan pemecahan
  saham (BBNI: tersimpan 578,7 juta, tersirat dari `market_cap/harga` 37,26
  MILIAR — rasio 0,0155×). **38 emiten** kena ini (kebanyakan bank/API),
  q_eps-nya **TIDAK disentuh** (sudah salah sebelum sesi ini, beda root
  cause, di luar lingkup — laporan saja, belum diperbaiki).
- Sanity-check ke `eps` tahunan (>50× ditolak SELURUH berkas) — ketemu di
  RIGS: `shares`-nya justru KONSISTEN (jadi guard pertama tak menangkap),
  tapi `q_net_income`-nya sendiri korup ~11.000× (indikasi `financial_currency`
  salah dilabeli USD padahal datanya sudah IDR → konversi dobel). q_eps RIGS
  sengaja dibiarkan versi LAMA (kebetulan benar, bukan dari fix ini).

**Rendering**: `KolomKuartalan.tsx` (`fmtCell`, sekarang diekspor & diuji di
`KolomKuartalan.test.ts`) SUDAH benar sejak awal — `v == null` → `—`, `v ===
0` → `0`. Bug ARCI di layar bukan salah render, murni backend menulis `0.0`
literal (bukan `null`) untuk kuartal yang sebenarnya ada datanya.

**Belum selesai**: 38 emiten `shares`-tak-konsisten di atas — ✅ **ditutup A0d**.

**Ongkos**: kecil (patch), sedang (guard-nya butuh 2 putaran sanity-check
manual sebelum aman ditulis — jangan skip langkah itu kalau menambah ruas
turunan baru yang mirip).

---

### A0d · `shares` diambil dari bursa, bukan dari agregator — ✅ **SELESAI 18 Agu**

Lanjutan langsung A0c. Yang dicari: sumber jumlah saham yang tak ketinggalan
aksi korporasi. Yang ketemu **sudah ada di payload yang kita ambil tiap hari**:
`GetStockSummary` membawa ruas **`ListedShares`** per emiten, dan
`sinkron_emiten.py` selama ini membuangnya (hanya `StockCode`/`StockName` yang
disimpan). Nol permintaan jaringan tambahan, dan sumbernya bursa sendiri.

**Kandidat yang DITOLAK — `market_cap ÷ last_price`.** Terdengar masuk akal
(dua ruas independen dari `shares`), tapi `marketCap` Yahoo dihitung dari
`sharesOutstanding` Yahoo juga, jadi **ikut basi di emiten yang sama**.
Terukur salah di 4 dari 51: AISA tersirat 3,81 miliar saham padahal resmi
9,31 miliar; LPPF 1,17 vs 2,23 miliar; ZBRA 534 juta vs 2,51 miliar; MSKY 5×.
Pembanding independennya EPS laporan XBRL IDX (`net_income ÷ eps`) dan
ekuitas ÷ nilai buku — keduanya sepakat dengan IDX, melawan `market_cap`.
`market_cap/harga` tetap berguna sebagai **detektor** (`shares_masuk_akal()`),
tapi tak pernah sebagai **sumber**.

**51 emiten dikoreksi, bukan 38.** Angka 38 di A0c lahir dari wasit yang
sendirinya basi. Terhadap `ListedShares`: 43 emiten beda >2× (tambahan NEST,
RIMO, IIKP, PIPA, MORA, **MSKY** — yang ini 5× KEBESARAN, reverse split, arah
sebaliknya dari BBNI) + 8 emiten yang `shares`-nya kosong sama sekali
(BNGA, EMMI, PRDL, SCPI, SUGI, TRIL, TRIO, TRUK).

**Alur yang dipasang** (tiga berkas, masing-masing satu tempat):

1. `sinkron_emiten.py` — simpan `saham` (=`ListedShares`) di `daftar_emiten.json`.
2. `fetch_fundamental.py` — `saham_idx()` membaca berkas itu (lokal, nol
   jaringan); `shares` dikoreksi **sebelum satu pun turunan dihitung**, dan
   berkasnya menandai `shares_sumber: "idx" | "yahoo"`. Ambangnya 2×: di bawah
   itu bedanya treasury/waktu potret (101 emiten — wajar, tak disentuh).
3. `lengkapi_fundamental.py` — `shares_masuk_akal()` mengalah pada
   `shares_sumber == "idx"`, kalau tidak AISA/LPPF/ZBRA tetap tanpa `q_eps`
   justru sesudah dibetulkan.

**Yang ikut sembuh sendiri** karena koreksinya di hulu: `q_eps`, `hist_eps`,
`hist_bv`, `rev_ps`, `cash_ps`, `fcf_ps`, `ocf_ps`, `ps`, `price_cf`,
`price_fcf`. BBNI: `hist_eps` 2025 dari 34.631 jadi 542,75 (EPS resmi XBRL
536,9); `q_eps` Q2 2026 dari 8.804,59 jadi 137,99.

**Pelajaran yang mahal — membetulkan hulu membuat hilirnya bertengkar.**
Sesudah `shares` benar, `float_pct` BBNI terbaca **0,61%** (dulu 38,84%) dan
`market_cap` AISA tinggal 41% dari saham × harga. Keduanya regresi yang
lahir dari perbaikan itu sendiri, dan **hanya ketahuan karena sapuan regresi
dijalankan atas SELURUH 965 berkas**, bukan atas emiten yang diperiksa tangan.
Tambalannya: `market_cap` = saham tercatat × harga (definisi bursa) untuk
emiten ber-`shares_sumber = "idx"`; `float_pct` mencoba dua basis dan memakai
yang jatuh di 0–100%. Percobaan pertama — menskalakan `floatShares` dengan
rasio saham lama/baru — **memburukkan** AISA jadi 1.669%, karena `floatShares`
Yahoo ternyata **tak selalu sebasis** `sharesOutstanding`-nya sendiri.

**Cara menjalankan ulang** (urutannya mengikat):

```bash
python scripts/sinkron_emiten.py && python scripts/fetch_fundamental.py --semua && python scripts/lengkapi_fundamental.py
```

**Ongkos**: kecil. Satu permintaan IDX yang memang sudah dilakukan, ditambah
panen ulang yfinance untuk emiten yang terdampak saja.

---

### A1 · Rata-rata historis & ambang verdict valuasi

**Kerjakan**: hitung `per5y`, `pbv5y`, `roe5y`, `roe10y`, `der5y`, `dy5y` dari
`hist_*` yang sudah ada, simpan ke berkas turunan. Tetapkan ambang remark —
memakai angka SPLE sebagai titik mulai karena sudah teruji dipakai:

| Potensi G/L | Remark |
|---|---|
| > +20% | Undervalued |
| +5% … +20% | Slightly Undervalued |
| −5% … +5% | Fair Valued |
| −20% … −5% | Slightly Overvalued |
| < −20% | Overvalued |

**Beda dari mereka**: verdict kita membandingkan **dua sumbu** — terhadap
rata-rata 5 tahun emiten itu sendiri **dan** terhadap median sektornya
(`sector_pe_median`, `pe_vs_sector_pct` sudah ada). Kalau keduanya berlawanan,
konfliknya **wajib disebut**, bukan dipilih diam-diam.

**Selesai kalau**: tiap emiten punya verdict PER dan PBV dengan angka
pembanding yang bisa ditelusuri, dan ada uji unit untuk pembagian ambangnya.

**Ongkos**: kecil-sedang.

---

### A2 · Halaman **Bedah Emiten** (padanan sple-mf, lebih kuat)

Rute baru `/bedah-emiten` (atau tab di Stock Detail — putuskan saat mulai).
Dibangun **section demi section**, tiap section satu commit:

| Urutan | Section | Bahan | Catatan |
|---|---|---|---|
| 1 | Kepala emiten + 3 verdict | `fundamental/` + A1 | Kode, harga, tier, sektor IDX-IC, PER/PBV/PEG |
| 2 | Trading Activity | `ds_*.json` | Volume, nilai, frekuensi, listed shares |
| 3 | Foreign Flow | data harian | Buy/sell/net dengan bar |
| 4 | The Money Flow (5 langkah) | `ttm_*` | Revenue → Net Profit → EPS → CFO → DPS |
| 5 | Income Trajectory | `hist_*` | **5 tahun**, bisa diperpanjang setelah A3 |
| 6 | Quarterly Pulse | `quarterly`, `q_*` | |
| 7 | Quality of Earnings | A1 | ROE 5Y/10Y, DER, DY + label |
| 8 | Valuation Verdict | A1 | **Dua sumbu: riwayat sendiri + median sektor** |
| 9 | Financial Reports 5 tab | `income_ttm`, `balance_q`, `cashflow_ttm` | Laba Rugi · Neraca · Arus Kas · Rasio Keuangan · Rasio Valuasi |
| 10 | Skor & pilar (rule-engine) | semua di atas | Growth · Profitability · Quality · Valuation · Dividend + kekuatan/risiko |
| 11 | **Panel khas PAPAN** | `altman_z`, `f_score`, `roic`, `roce`, siklus kas | **Tak ada di sple-mf sama sekali** |
| 12 | Glossary | teks | |

**Aturan yang dibawa dari riset**:
- Rule-engine, bukan LLM — dan disclaimer-nya menyebut itu (mereka jujur soal
  ini, kita ikuti).
- Harga apa pun lewat `keFraksi()`.
- Tiap angka menyebut periodenya dan asalnya.

**Selesai kalau**: 12 section tampil untuk emiten mana pun yang punya data,
degradasi sopan (bukan "—" telanjang) untuk yang tidak, dua viewport lolos.

**Ongkos**: besar — karena itu dipecah 12 commit.

---

### A3 · Panen laporan keuangan resmi IDX (#156)

Baru **setelah** A0–A2 jalan, supaya halaman sudah ada tempat menampungnya.

**Kerjakan**: `scripts/panen_lapkeu_idx.py` mengikuti runbook §6
`docs/sumber-fundamental-idx.md`.

1. Ambil daftar per periode (`GetFinancialReport`, 778 emiten TW2 2026).
2. Unduh `.xlsx` tiap emiten — jeda acak, backoff, **hanya dari IP rumahan**.
3. Ekstrak sheet `4220000` (neraca), `4312000`/`4322000` (laba rugi),
   `4510000`/`4520000` (arus kas) → gabung ke `keuangan/<KODE>.json`.
4. Simpan hasil parse saja; 230 MB XLSX mentah **tidak** masuk repo.

**Selesai kalau**: cakupan naik dari 646 → ±777 emiten, dan `operating_cf`
terisi untuk emiten yang melaporkannya.

**Ongkos**: besar (parsing taksonomi XBRL dwibahasa). Jalankan bertahap:
TW2 2026 dulu, mundur per kuartal kemudian.

---

## Jalur B — Metadata resmi (murah, jangkauan luas)

### B1 · Sektor IDX-IC resmi (#157)

Dari sheet `1000000` atau `GetCompanyProfiles`. Menggantikan klasifikasi Yahoo
di Sektor & Indeks, Stock Detail, dan nanti Screener.

**Selesai kalau**: `data-idx/json/emiten_sektor.json` berisi
sektor→subsektor→industri→subindustri untuk ±962 emiten, dan halaman Sektor
memakainya.

**Ongkos**: kecil. **Dikerjakan lebih dulu dari A3** karena dipakai banyak
halaman.

### B2 · Broker summary harian (#159)

`GetBrokerSummary?date=YYYYMMDD` → 88 broker. Jadi sumber kedua di Top Broker,
saling periksa dengan hasil parse PDF.

**Selesai kalau**: angka dari dua sumber cocok untuk tanggal yang sama; kalau
tidak, selisihnya dilaporkan, bukan disembunyikan.

**Ongkos**: kecil.

### B3 · Pemegang saham pengendali (#158)

Dari sheet `1000000` — melengkapi tab Grup Konglomerat yang sekarang hanya
mencocokkan nama KSEI. Menutup celah kepemilikan lewat perusahaan bernama
netral.

**Bergantung**: A3 (berkas XLSX sudah diunduh).

### B4 · Pasar NEGO / Bandar Flow (#152)

Ruasnya sudah ada di `GetStockSummary` yang kita panen tiap hari — tinggal
disimpan dan ditampilkan.

**Selesai kalau**: Stock Detail menampilkan nego volume/value/frekuensi +
rasio nego terhadap reguler.

**Ongkos**: kecil.

---

## Jalur C — Lubang lain dari banding fitur

Diurut ongkos-vs-hasil. Tiap butir sudah punya bahannya kecuali C1.

| # | Pekerjaan | Bahan | Ongkos | Status |
|---|---|---|---|---|
| C1 | **Berita / Live News** | ~~belum ada~~ | Sedang | ✅ **SELESAI 16 Agu** — `/kabar`, 1.028 kabar, 5 sumber; `scripts/panen_kabar.py` + GitHub Actions tiap 2 jam |
| C2 | **Indikator per emiten** (RSI, MACD, BB, ATR, Fib, Ichimoku, VWAP, Heikin Ashi) | OHLCV 5 tahun; rumus sudah ada di `lib/radar/` | Sedang | ☐ **berikutnya** |
| C3 | **Screener** seluruh emiten | `fundamental/` 967×147 + `ohlc/` + B1 | Sedang-besar | ☐ **halaman BARU**, sesudah C2 |
| C4 | Heatmap & market breadth | data harian | Kecil | ☐ |
| C5 | Ringkasan naratif harian | data harian lengkap | Sedang (perumusan) | ✅ **SELESAI 16 Agu** — `lib/dasbor/ringkasHarian.ts`, ambangnya **dikalibrasi dari 2.409 hari bursa**, bukan ditebak |
| C6 | Halaman metodologi di web | sudah tertulis di `docs/` | Kecil | 🟡 sebagian — 75 istilah sudah jadi `glosarium.json` (dipakai Tanya PAPAN), **halamannya belum ada** |
| C7 | Foreign flow 5D/10D | agregasi `ds_*.json` | Kecil | ☐ |
| C8 | Watchlist | localStorage | Kecil | ☐ |
| C9 | **Chat AI ala ASK SPLE** | ~~belum diputuskan~~ | Sedang | ✅ **SELESAI 16 Agu (lapis aturan)** — Tanya PAPAN menjawab dari data, bukan model bahasa. Lapis Gemini Flash ditunda sampai halaman baru jadi (#167) |

**C2 mendahului C3**: screener tanpa kolom indikator hanya jadi tabel harga.

> **Rekonsiliasi 16 Agu (malam).** C1, C5, dan C9 dikerjakan di sesi
> Beranda/Kabar/Tanya PAPAN **tanpa dokumen ini ikut diperbarui**, jadi sempat
> terbaca seolah belum ada — dan hampir membuat pekerjaan yang sudah jadi
> direncanakan ulang dari nol. Tiap fase jalur A/B/C yang selesai **wajib**
> dicatat statusnya di sini. Rencana yang tak menyusul kenyataan bukan cuma
> basi; ia menyuruh mengerjakan ulang.

---

## Urutan yang disarankan

```
B1 sektor IDX-IC          ← murah, dipakai semua
  └─ A0 satukan sumber    ← murah, memperbaiki halaman yang sudah ada
       └─ A1 rata-rata & verdict
            └─ A2 Bedah Emiten (12 commit)
                 └─ A3 panen IDX  →  B3 pengendali
B2 broker harian          ← paralel, murah
B4 pasar NEGO             ← paralel, murah
C2 indikator  →  C3 screener
C1 berita                 ← paling mandiri, bisa kapan saja
```

Empat pekerjaan pertama (**B1 · A0 · A1 · B2**) semuanya kecil dan tak
bergantung panen apa pun — itu yang membuat laju terasa sejak hari pertama.

## Yang sengaja TIDAK masuk workflow ini

- **#129 bandarmologi** — masih terhalang sumber broker per emiten yang belum
  ketemu di endpoint publik mana pun.
- **#146 divergensi tiga lapis** — menunggu definisi dari Johan.
- **#145 "bar tembus"** — menunggu penjelasan maksudnya.
- **Chat AI ala ASK SPLE** — belum diputuskan apakah PAPAN mau ke sana; kalau
  iya, itu jalur tersendiri dengan pertanyaan biaya dan penjagaan yang belum
  dibahas.
