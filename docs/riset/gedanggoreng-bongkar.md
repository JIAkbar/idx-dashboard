# gedanggoreng.netlify.app — audit SOP penuh (23 Agu 2026)

Johan: *"perlu di audit setiap menu dan fungsinya"* · *"ini juga perlu di audit
penuh"*. Situs analisa/screening buatan perorangan ("IHSG Stock Deck"), versi
`01.22.17`. Diaudit tanpa login — password opsional dan
`/api/auth/check-password` menjawab `hasPassword:false`, jadi terbuka penuh.

Metode mengikuti `docs/riset/sop-audit-replikasi.md`: tiap masukan diberi jeda
≥20 detik, tiap perpindahan diverifikasi lewat URL/isi, bukan lewat sorotan tab.

## ⚠️ TEMUAN KEAMANAN (bukan untuk ditiru)

Dua kebocoran, dan yang kedua lebih dalam dari yang terlihat pada audit pertama:

1. **`GET /api/token-status` membocorkan token Stockbit (JWT) milik pemilik
   situs ke publik** — payload memuat `use: "Harisam"`,
   `ema: harismajid@outlook.com`, `uid: 412887`. Siapa pun yang membuka
   endpoint itu memegang sesi Stockbit orang tersebut sampai `exp`. Sidebar
   bahkan memajang masa berlakunya ("Expires On 23 Aug, 17…").
2. **Konfigurasi akun pribadinya ikut terpajang.** Tab *Template Screener* dan
   dropdown *Source* di ATM Harian menampilkan seluruh custom screener Stockbit
   miliknya: Big Accumulation · Big Distribution · Swing · TF 4H · BSJP Andre ·
   BSJP Stockbit · BPJS Stockbit · BSJP Mba Intan · BSJP Mba Dila KTP · Dragon
   Hunter (Tengah Market) · JK BSJP · JK ARA Hunter · Lower Volume than Usual ·
   High Volume Breakout · Bandar Bullish Reversal · RSI, plus preset Guru
   Screener & Size.

Kita **tidak memakai** keduanya (kredensial dan konfigurasi orang lain), dan
selama audit **tidak menekan Run Screener** karena itu membakar kuota RapidAPI
berbayar milik pemilik (kuotanya dipajang terbuka: 26/1000 req, reset tgl 5).

Pelajaran untuk PAPAN: token Stockbit kita hidup di berkas lokal ber-gitignore,
**tak pernah** disajikan lewat endpoint mana pun — pola gedanggoreng ini persis
yang harus dihindari. (Kalau Johan kenal pemiliknya, layak dikabari.)

## 1 · Infrastruktur

| Lapis | Temuan |
|---|---|
| Hosting | **Netlify** (`Cache-Status: "Netlify Durable"/"Netlify Edge"`), Next.js App Router (RSC `?_rsc=`) |
| Front-end | Next.js + React, chunk `_next/static`, cdnjs |
| Backend | Route handler Next.js sendiri: `/api/*` di domain yang sama |
| Data pasar | **Token Stockbit** (running stream, broker summary, keystats, chartbit) + **RapidAPI** (kuota 1.000/bulan) untuk sentimen makro & sebagian screener |
| Grafik | **TradingView tersemat**, dengan sakelar ke **Chartbit** (Stockbit) |
| AI | **Gemini 3 Flash Preview (Thinking HIGH)** untuk "Analyze Story" (terbaca di job-logs) |
| Notifikasi | **Telegram** (sinyal DSI masuk sebagai sumber, bukan hanya keluaran) |
| Sidebar tetap | jam server, Stream Ready, Jobs Idle, Token Status, Fullscreen, Light Mode, Password Settings, Visitor Stats (live/today/monthly/total) |

## 2 · Pohon menu (SOP "sampai habis") — 6 menu

### Calculator (`/`) — halaman inti

Form ANALYZE STOCK: **Emiten** + **Date Range** → tombol **Calculate Price
Target** dan **Analyze Story** (AI). Satu klik memanggil
`GET /api/analyze-story?emiten=<KODE>` dan mengisi seluruh halaman:

- **PRICE TARGET** — Top Broker (BANDAR, BARANG dalam lot, AVG HARGA + selisih
  ke harga kini). Market Data: Harga · Offer Max · Bid Min · Fraksi · Total Bid
  · Total Offer. **Calculations**: `TOTAL PAPAN` · `RATA² BID/OFFER` ·
  `A (5% AVG BANDAR)` · `P (BARANG/AVG)`. Hasil: **Target Realistis** dan
  **Target Max** berikut persentasenya, plus tombol *Copy Text*.
  (BUMI 20 Agu: bandar AK, 2.019.604 lot, avg Rp 188 → realistis **209**
  +6,63%, max **212** +8,16%.)
- **BROKER SUMMARY** — baris Top 1 / Top 3 / Top 5 / Average dengan Volume, %,
  Rp(B), dan label **ACC/DIST** (Neutral · Small Acc · Normal Acc). Ringkasan
  Buyer/Seller/#/ACC-DIST, Net Volume, Net Value, Average (Rp). Tabel dua sisi
  BY (B.VAL · B.LOT · B.AVG) vs SL (S.VAL · S.LOT · S.AVG).
- **KEY STATS** (Stockbit keystats) — Current Valuation (PE Annualised, PE,
  Forward PE, **IHSG PE TTM Median**, Earnings Yield, P/Sales), Income
  Statement (Revenue, Gross Profit, EBITDA, Net Income), Balance Sheet (Cash,
  Total Assets, Total Liabilities, Working Capital, Common Equity).
- **ADVANCED CHART** — sakelar **Trading View | Chartbit**, timeframe
  1m/30m/1h/D, Indicators, alat gambar, YTD/1Y/5Y/All.
- **BROKER FLOW** (sumber: stockbit.com) — filter **Smart · Whale · Retail ·
  Mix**, periode **1D/7D/14D/21D**; tabel broker dengan **Daily Heatmap
  D-6…D0**, **Net Value**, dan **Consistency x/7** (mis. NI SmartMoney
  +49,7 B, 6/7).

### Morning Briefing (`/briefing`)

Kepala: **RapidAPI Limit 26/1000 req (974 sisa)** + tombol *Update Latest News*.

- **Market Sentiment** (BULLISH/…), Pre-Market Pulse, narasi satu paragraf
  ("Wall Street ditutup menguat (avg 0,62%). USD/IDR di level 17.690 (−0,47%)").
- **Global Market Indices** — Dow Jones · S&P 500 · Hang Seng · NASDAQ ·
  Nikkei 225 · Straits Times.
- **Commodities & Sector Impact** — Brent Crude · Crude Oil · Gold · Copper ·
  **Coal API2 CIF ARA (ARGUS-McCloskey)** · Silver · Nickel · CPO.
- **Kurs Valuta** USD/IDR.
- **Rotasi Sektor BEI** — empat kuadran RRG: Improving · Leading · Lagging ·
  Weakening.
- **Top Market Movers** (Stockbit Stream, ditandai "Non-RapidAPI Free Hit") —
  Top Gainers/Drivers dengan harga & %.

### Screener (`/screener`)

Tiga **mode waktu**: **After Market** (18:00–09:00) · **Intraday** (09:30,
11:00, 13:30) · **BSJP** (setelah 14:00). Empat **tab**:

- **API Screener** — bar kuota Rapid API Token Usage (reset tgl 5); preset
  **Breakout · Multibagger · Insider · Daily Movers · Daily Top Stocks**;
  penghitung "0 emiten ditemukan / 0 emiten dipilih"; tombol Run Screener.
- **Template Screener** — daftar custom screener Stockbit pemilik (lihat
  temuan keamanan) + preset Guru Screener & Size; pencarian screener.
- **ATM Harian** — "After Market Harian · Broker Accumulation & Distribution
  Analysis". Kendali: **Source: N Screeners** (checkbox multi-template),
  **NET | GROSS**, **Clean | All**. Inilah "Shark Screener" yang disebut
  Manual Book: populasi datang dari custom screener Stockbit, lalu tiap emiten
  dianalisis akumulasi/distribusi brokernya.
- **Alert DSI** — "Signal Telegram Alert DSI Bandarmologi Screener", **898
  emiten**. Kolom: Jam Alert · Ticker · **Alert Type** ("BAKOH GASS POLL FOR
  BSJB", "15 % presisi", "OTW AKUM") · Alert Count · Alert Price · %Chg ·
  Last Status · RSI · MFI, lalu dua blok berdampingan **Bandarmologi 1D** dan
  **Bandarmologi 7D**, masing-masing: Bandar (kode broker + Acc/Dist) · Avg ·
  Barang · Target Realistis · Target Max. Tombol: *Refresh Alert DSI*,
  **Enrich Stockbit**, **Push ke Tracer**.

### Trading Plan (`/trading-plan`)

Tombol **Generate Trading Plan Hari Ini**; pencarian emiten/sumber screener;
rentang **1D · 1W · 1M** + kalender. Legenda **BROKER INDEX** (Smartmoney ·
Whale · Retail · Mix) dipakai untuk mewarnai chip bandar.

Kolom: Tgl Screener · Emiten · Screened Price · **Mode Screener** (Rapid API –
Market Mover / Stockbit – Swing / Rapid API – Breakout Alerts / Rapid API –
Multibagger) · **Timing** (After Market/Intraday) · **Confidence %** · MFI ·
RSI · **Bandar** · Avg Bandar · **Barang (Lot)** · **Target Realistis** ·
**Target Max**.

Manual Book menambahkan: Auto Risk-Reward Ratio (Entry/TP1/TP2/SL),
**Approval & Status Track** (`ON HOLD` · `SUCCESS` · `MISS`), dan **Database
Syncing** ke Supabase untuk analisis akurasi historis.

### Tracer (`/accuracy`)

"Lacak keberhasilan target price dan pantau live Telegram DSI alert secara
otomatis." Enam tab: **Watchlist · ATM Harian · BSJP Screener · Alert DSI ·
API Screener · Template Screener**.

Watchlist: tambah/cari kode, **NET | GROSS**, **Clean | All**, *Pilih Kolom*,
*Sync*; grafik **IHSG 30 hari**; tabel Ticker · Open · High · Low · Close ·
Price · %Chg, lalu tiga blok broker berdampingan — **Top Broker Akum 31D** ·
**Top Broker Akum 1D** · **Top Broker Dist 1D**, masing-masing Broker · Lot ·
Avg · Val, dengan filter sendiri per blok.

Manual Book menambahkan: **Win Rate %** (SUCCESS vs total sinyal selesai),
**Broker Accuracy Breakdown** (akurasi per sekuritas bandar yang memimpin), dan
**Historical Signal Logs**.

### Manual Book — 6 bagian

Calculator · Morning Briefing · Screener · Trading Plan · Tracer ·
**Glosarium Broker Index**, dengan pencarian fitur.

## 3 · Glosarium Broker Index — klasifikasi manual per identitas

| Kelas | Warna | Broker |
|---|---|---|
| **Foreign / Smartmoney** | ungu/sian | `BK` JP Morgan · `ZP` Maybank · `AK` UBS · `KZ` CLSA · `RX` Macquarie |
| **Institutional / Whale** | hijau | `NI` BNI Sekuritas · `OD` BRI Danareksa · `DR` RHB · `HD` KGI |
| **Retail / Ritel** | merah | `YP` Mirae · `PD` Indo Premier · `XC` Ajaib · `CC` Mandiri Sekuritas Ritel |
| **Mix / Campuran** | oranye | `DH` Sinarmas · `GR` Panin · `LG` Trimegah · `MG` Semesta Indovest |

Ini sumbu **identitas** — berbeda dari tradersaham yang mengklasifikasi broker
dari **perilaku terhitung** (Accumulating/Distributing/Scalper) dan **ukuran**
(Retail/Smart Retail/Whale/Smart Money). Daftarnya pendek: 17 broker dari 88+
yang aktif, dan tak ada kelas BUMN maupun afiliasi emiten.

## 4 · Endpoint nyata (tab Network)

`GET /api/analyze-story?emiten=<KODE>` (mengisi seluruh halaman Calculator) ·
`/api/trading-plan?startDate&endDate` · `/api/trading-plan/generate` ·
`/api/token-status` (BOCOR) · `/api/job-logs?limit=` (riwayat job AI) ·
`/api/job-retry` · `/api/visitors` (GET & POST) ·
`/api/auth/{check,verify,set}-password`. Screener & briefing menembak RapidAPI
dari sisi server.

## 5 · Cacat yang terlihat saat diuji

Dicatat karena tiap satunya pelajaran desain, bukan untuk mengecilkan:

- **Tombol Calculate Price Target gagal senyap.** Menekannya tanpa mengubah
  kolom emiten lewat event input tidak memicu satu pun permintaan jaringan dan
  tidak menampilkan pesan apa pun — layar tetap kosong. Baru bekerja setelah
  nilai kolom benar-benar berubah.
- **Rotasi Sektor RRG tidak berfungsi.** Seluruh 11 sektor jatuh ke kuadran
  *Weakening* sementara Improving/Leading/Lagging kosong — padahal empat dari
  lima sektor yang tercantum persentasenya positif (Perindustrian +0,66%,
  Barang Konsumen Primer +0,18%). Label bertentangan dengan angkanya sendiri.
- **Kolom RSI mati.** Di Trading Plan seluruh baris menampilkan `-`.
- **Metrik tidak dihitung ulang per tanggal.** Baris 23 Jul dan 24 Jul untuk
  emiten yang sama membawa MFI, Avg Bandar, Barang, dan Target identik (COCO
  53,02/136/1.016.293/151/159 di kedua tanggal; sama untuk DSSA, CBUT, BDKR,
  PSKT, ADHI). Tanggalnya berbeda, isinya salinan.
- **OHLC bolong.** Di Tracer, sebagian emiten (JARR, LABA) menampilkan Open/
  High/Low sebagai `-` sementara Close dan Price terisi.
- **Kuota dan status internal dipajang publik** — sisa RapidAPI, masa berlaku
  token, jumlah pengunjung. Berguna untuk pemilik, tapi ini halaman publik.

## 6 · Peta ke PAPAN

| Fitur mereka | Bahan | Padanan kita |
|---|---|---|
| Price Target dari bandar (avg, barang, total papan) | broker EOD + orderbook | **rumusnya terbuka** — bahan broker ada, orderbook (bid/offer) tidak |
| Broker Summary Top1/3/5 + label Acc/Dist | broker EOD | **ada** — `tabelDuaSisi()`, label perlu ditulis |
| Broker Flow heatmap + **Consistency x/7** | broker EOD multi-hari | **ada** — `arusHarian()`, konsistensi sepele dihitung |
| Klasifikasi broker Smartmoney/Whale/Retail/Mix | daftar manual | **ada bahannya** (nama broker resmi + bendera asing), tinggal disusun |
| Key Stats valuasi & laporan keuangan | Stockbit keystats | **ada** — `fundamental/*.json` + XBRL IDX |
| Morning Briefing makro global | RapidAPI berbayar | **belum** — indeks & komoditas bisa lewat yfinance |
| Rotasi sektor RRG | OHLC per sektor | **ada bahannya**, dan versi kita bisa benar |
| Screener preset (breakout/multibagger/movers) | OHLC + volume | ada, preset beda |
| Alert DSI (sinyal Telegram pihak ketiga) | grup eksternal | tidak — sinyal kita lahir sendiri (kandidat Deep Dive) |
| Trading Plan + R:R + status | — | **ada** konsepnya di Analisa PAPAN v1 |
| Tracer akurasi (Win Rate, Broker Accuracy) | riwayat sinyal | **ada** — `tinjau_deepdive.py` (tinjauan H+5), lebih terukur |
| Analyze Story (Gemini) | LLM | Tanya PAPAN (dimatikan sementara) |

## Kesimpulan

gedanggoreng = perkakas satu orang di atas token Stockbit pribadi + RapidAPI +
Gemini + Telegram, dengan **rantai kerja yang rapi**: sinyal masuk → diperkaya
data bandar → dihitung target → dilacak akurasinya. Rantai itulah yang layak
dipetik, bukan datanya — tiap simpulnya bisa kita isi dari sumber sendiri.

Tiga hal konkret yang bisa langsung dipakai:

1. **Glosarium Broker Index** — titik awal daftar klasifikasi broker per
   identitas untuk PAPAN (perlu diperluas: 17 dari 88+ broker, belum ada kelas
   BUMN maupun afiliasi emiten).
2. **Consistency x/7** dan **Daily Heatmap** — dua metrik murah yang membuat
   arus broker terbaca sekilas; bahan kita sudah lengkap.
3. **Rumus Price Target berbasis bandar** yang mereka pajang terbuka — bagian
   broker bisa kita hitung; bagian orderbook (Total Bid/Offer, Offer Max, Bid
   Min) tidak, karena kita tak punya kedalaman antrean.

Pelajaran terkuat tetap negatif: **jangan pernah menyajikan token atau
konfigurasi akun lewat endpoint publik** — kesalahan yang gedanggoreng buat dan
kita sudah hindari sejak awal.
