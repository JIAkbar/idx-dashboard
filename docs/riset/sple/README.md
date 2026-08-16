# Riset SPLE — dua dasbor IDX milik "Oppa Praz"

Audit teknis dua situs yang diminta Johan (16 Agustus 2026), dikerjakan dengan
Chrome DevTools: telusur tiap tab & section, rekam lalu lintas jaringan, bedah
data yang tertanam di halaman, dan uji langsung endpoint AI-nya.

| | sple-info | sple-mf |
|---|---|---|
| URL | https://sple-info.netlify.app/ | https://sple-mf.netlify.app/ |
| Nama | **SPLE·Insight** — IDX Signal & Screener | **SPLE — Follow d'Money Flow** |
| Versi terlihat | v.315 | v21 |
| Sudut pandang | **Pasar** — sinyal harian & screener 963 emiten | **Emiten** — fundamental & laporan keuangan 978 emiten |
| Tema | Terang, serif editorial | Gelap, monospace terminal |
| Ukuran halaman | **6,0 MB** (satu berkas, data ditanam) | 1,4 MB |
| Passcode | Hanya untuk ASK SPLE | Hanya untuk ASK-SPLE |
| Data per | 2026-08-14 (snapshot harian) | 2026-08-14 |

Keduanya **satu berkas HTML statis di Netlify** — tak ada framework, tak ada
basis data. Seluruh data hari itu ditanam sebagai objek JavaScript di dalam
halaman; yang dinamis hanya dipanggil lewat Netlify Functions.

Screenshot ada di folder yang sama (`info-*.png`, `mf-*.png`).

---

## 1. Jawaban singkat atas tiga pertanyaan Johan

**"Ada 2 sumber, dari IDX dan TradingView?"** — Benar, tapi ada lima sumber,
dan pembagiannya tegas. Lihat §4.

**"Cek pakai LLM apa?"** — **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`).
Dikonfirmasi dua kali dengan memanggil endpointnya langsung:

```
POST /.netlify/functions/ai-news   → {"model":"claude-haiku-4-5-20251001", …}   (sple-info)
POST /.netlify/functions/ask       → {"text":"Saya adalah Claude, …"}           (sple-mf)
```

Kuncinya **tidak** ada di klien: di produksi panggilan lewat Netlify Function
(kunci di server), sedangkan saat dibuka sebagai berkas lokal barulah kode
meminta API key pengguna dan menyimpannya di `localStorage`. Rapi.

Satu hal yang penting dibedakan: panel **"AI Analysis & Recommendation"** di
sple-mf **bukan** LLM. Disclaimer-nya sendiri menyebut *"dihasilkan oleh
rule-engine berbasis data Financial Report"*. LLM hanya dipakai di ASK SPLE,
Daily Briefing, dan tombol Insight per kartu sinyal.

**"Papan AI menarik, sajian datanya diperbaiki"** — lihat §6, rekomendasi
untuk PAPAN.

---

## 2. sple-info — menu, section, isi

### Kepala halaman
Judul + versi · ringkasan status: `DATA PER 2026-08-14 · UNIVERSE 965 ·
ELIGIBLE 201 · 144 DAYS` · ticker berjalan (IHSG, EIDO, DJIA, NI225, HSI,
KOSPI, USD/IDR) · kotak cari emiten.

Tiga tab: **Overview · Screener · Panduan**.

### Tab OVERVIEW — 10 section

| # | Section | Isi | Sumber |
|---|---|---|---|
| 1 | **Coffee Morning** | Headline naratif + ringkasan + 4 chip angka + 4 "Katalis Utama" berikon | Ditulis manual/AI, snapshot IDX |
| 2 | **Konteks Global** | Widget TradingView Market Overview, 3 tab (Indeks Global · Komoditas · Mata Uang), 19 simbol | TradingView |
| 3 | **Indeks Global & Komoditas — LIVE** | 13 ticker dengan sparkline mini + harga + %; badge "BARU" untuk yang baru ditambah | Yahoo Finance via `commodity-fetch` |
| 4 | **Group Konglomerat** | 87 saham dikelompokkan ke **11 grup taipan** (Bakrie, Barito, Djarum, Salim, Sinar Mas, MNC, Lippo, Happy Hapsoro, Astra, Thohir, Haji Isam); tiap saham jadi chip berwarna %1D | Kepemilikan **diverifikasi manual via web search**, bukan formula |
| 5 | **News & Konteks Pasar** | 4 butir berita bernomor + kotak cari berita + **Live News** | IDX Daily Statistics + 12 sumber RSS/scraping |
| 6 | **Chart, Heatmap & Breadth IHSG** | Advanced Chart TradingView (MA Cross + MACD) · Stock Heatmap IDX · Market Breadth (turun>2% / stabil / naik>2%) | TradingView |
| 7 | **Signal** | Inti produk — 4 kategori pick, lihat §3 | Hitungan sendiri dari CSV IDX |
| 8 | **Foreign Flow** | Akumulasi & distribusi asing per saham, tab 1/5/10 hari, dengan nilai buy & sell terpisah | IDX |
| 9 | **Top Today** | Top Gainers/Losers, dua mode: *by Mover* dan *by Stock* | IDX |
| 10 | **Aktivitas Broker** | **Top 10 broker by value** — nama broker, value, %1D, volume, frekuensi | IDX API (lihat §5) |
| 11 | **Performa Sektor** | 11 sektor IDX-IC dengan bar horizontal | IDX |

Ada juga **Kalkulator Position Sizing** + **Aturan Risk Management** dan
**Simulasi Portofolio** yang menempel di area Signal.

### Tab SCREENER
Seluruh 963 emiten, dapat disortir per kolom, klik baris → modal detail.

- **Filter cepat**: Sektor · Grup Konglomerat · Min Value · Trend
- **Chip**: M / V / T (Momentum, Volume, Trend) · HA↑ / HA20 / HA↓ (Heikin
  Ashi) · Tier1 / Tier2 / Tier3 (kapitalisasi)
- **Filter Lanjutan**: 13 kriteria tambahan
- **4 preset**: Oversold Reversal · Akumulasi Senyap · Momentum Berkelanjutan ·
  Swing Trading
- **Kolom**: Saham · Harga · %1D · Value · FNet1D · Ichimoku · Spark, lalu
  "+Detail" membuka %10D · RSI · FNet5D · PER · PBV · ROE% · FNet% · Valuasi ·
  Conf(luence)

### Tab PANDUAN — 40 sub-bagian
Metodologi lengkap, ditulis terbuka: rumus tiap indikator, riwayat perubahan
formula bertanggal, bahkan **pengakuan kesalahan sebelumnya**. Contoh yang
menonjol:

> "Doji Reversal (BARU 7 Agu 2026, formula dikoreksi 8 Agu): … 2x fix 8 Agu:
> pertama coba body/range<10% masih salah, lolos DSSA body/range=4,5%"

> "Harmonic Pattern — Fix 9 Jul 2026: field ini SEBELUMNYA selalu kosong (null)
> untuk hampir semua saham meski dokumentasi lama menyebut '40 candle' —
> ternyata belum pernah benar-benar dihitung."

Ada juga keterbatasan yang diakui sendiri: EMA150/EMA200 dihitung dari histori
144 hari, jadi ~22% dan ~32% nilainya masih "menempel" ke harga hari pertama —
dan SMA150/SMA200 **sengaja tidak dibuat** karena tak bisa didekati bertahap
seperti EMA. Daftar lengkap sub-bagian ada di `panduan-sple-info.txt`.

---

## 3. Signal — empat formula, ditulis terbuka

Ini bagian yang paling layak ditiru **caranya**, bukan angkanya.

| Kategori | Kuota | Formula |
|---|---|---|
| 🤫 **Akumulasi Senyap** | 3 pick | FNet asing positif **≥8 dari 10 hari** terakhir · nilai transaksi 5D > Rp1M |
| 🌊 **Swing Recovery Harmonic/Fibo** | maks 2 | Universe likuid (avg value 5D > Rp50M, harga Rp1.000–15.000, FNet_days_positive ≥4) → skor = `FNet_days_positive − (RSI14/10)`, ambil 2 skor tertinggi |
| ⚡ **Ultra Scalping** | maks 2 | 3 candle hijau berturut-turut + Volume ≥2× kemarin + RSI14 60–75 |
| 🕯️ **Doji Reversal** | maks 2 | body < 0,1% dari harga open + RSI14 < 30 + avg_value_5D > Rp200 juta |

Tiap kartu pick menampilkan: **SL (ATR) · Entry Zone · TP1 Fib · TP2 Fib ·
Wyckoff phase · R/R · FNet 5D · RSI · VWAP5D · MA50 · MACD · RS rating**, plus
badge tier, badge grup konglomerat, dan tombol **Insight AI per kartu**.

Dua hal jujur yang mereka tulis dan pantas ditiru:

- **Peringatan konteks**: *"Strategi ini hanya relevan saat IHSG dalam uptrend
  atau sideways. Dalam downtrend kuat atau tekanan jual institusional (MSCI
  rebalancing, capital outflow), sinyal teknikal bisa menghasilkan false
  positive."*
- **Backtest ≠ janji**: *"Baru mulai live-tracking — win rate riil dievaluasi
  via Signal Ledger, backtest belum tentu representatif kondisi pasar terkini."*

Ada tombol **"Simpan Semua Signal"** → export seluruh pick jadi satu PNG
siap-share (html2canvas).

---

## 4. Dari mana datanya — lima sumber, bukan dua

| Sumber | Dipakai untuk | Cara |
|---|---|---|
| **IDX Daily Statistics** | Harga, volume, value, frekuensi, foreign buy/sell, sektor, breadth | CSV harian diolah offline, hasilnya **ditanam** ke HTML |
| **IDX API (live)** | Aktivitas broker per emiten & top broker pasar | Netlify Function `broker-data`, `broker-market` |
| **TradingView** | 3 widget: Market Overview, Advanced Chart, Stock Heatmap | Embed `s3.tradingview.com` |
| **Yahoo Finance** | 13 ticker global & komoditas + sparkline ~30 hari | Netlify Function `commodity-fetch` |
| **12 portal berita** | Live News | Netlify Function `news-fetch` / `rss-fetch` |

Tujuh Netlify Function yang terdeteksi: `commodity-fetch`, `ai-news`,
`rss-fetch`, `broker-data`, `broker-market`, `news-fetch`, `validate-passcode`.

### Struktur data yang ditanam (sple-info)

Objek `DATA` berukuran **5,5 MB** dengan 17 kunci tingkat atas:

```
snapshot_date · latest_date · total(965) · total_eligible(201) · sectors(12)
meta · sple.picks · overview(44 ruas) · fast_picks(6) · groups_konglomerat(11)
fast_trading(3) · records(963 emiten) · daily_nf · coffee_morning · news
broker_activity · signal_history(4)
```

**Tiap emiten punya 173 ruas.** Kelompoknya:

- **Harga & transaksi**: harga, pct_change, value, freq, volume, high, low, prev, remarks, market_cap, tier
- **MA/EMA**: ma5/10/20/50/100 · ema5/9/13/21/50/100/150/200 (+ `_ema_history_days`)
- **Osilator**: rsi14, stoch_k, stoch_d, stoch_rsi, williams_r, macd/signal/hist
- **Volatilitas**: bb_upper/mid/lower/bw/pct, atr14
- **Ichimoku**: tenkan, kijun, senkou_a/b, cloud_top/bot, cloud_bullish, ichimoku_signal, tk_cross, chikou_above
- **Fibonacci**: `fib` (7 level) + `fib_taktis` + fib_zone + nearest_support/resist (dua versi: struktural & taktis)
- **Asing**: fnet 1d/5d/10d (+ buy & sell terpisah), fnet_daily[], fnet_days_positive, foreign_contrib_1d/5d, foreign_classification, fnet_impact_pct
- **Fundamental**: pbv, per, roe, der, dy, eps, bvps, fair_value, pbv_fair_remark, per_fair_remark, fair_gl_pct
- **Turunan**: wyckoff_phase, harmonic, minervini{}, rs_rating, rs_1d/10d, confluence_count, vol_surge_ratio, transaksi_type/size, block_trade
- **Level siap pakai**: fast_entry, fast_sl, fast_tp1/2/3, buy_low/high, stop_ref, target_conservative/optimistic, rr_ratio, horizon
- **Monte Carlo**: mc_mu_daily, mc_sigma_daily, mc_n_obs
- **Heikin Ashi**: ha_open, ha_close, ha_trend
- **Grup**: group_konglomerat[], group_konglomerat_codes[]

Ruas berawalan `_` menandai perkiraan yang belum tegak sepenuhnya:
`_bandarmology_approx`, `_minervini_approx`, `_fundamental_target_approx`,
`_data_asof`, `_rdfe_asof`. Kebiasaan yang bagus — ketidakpastian ikut
disimpan bersama datanya.

---

## 5. sple-mf — dasbor fundamental per emiten

Satu halaman, satu emiten (default ISAT), dipilih lewat kotak cari. Tombol
**Compare** dan **Export** di kanan atas.

**Kepala**: kode · harga · %1D · badge "Fundamental Q2 '26" · badge tier ·
sektor · sub-sektor · tahun IPO · market cap · tiga verdict berdampingan
(PER 5Y · PBV Fair · PEG).

**Sembilan section bernomor:**

| # | Section | Isi |
|---|---|---|
| 01 | **Trading Activity** | Volume (lot), nilai transaksi, frekuensi, listed shares · **Foreign Flow pasar reguler** (buy/sell/net dengan bar) · **Bandar Flow pasar NEGO** (nego volume, rasio nego vs reguler, nego value, nego freq, avg/trade) |
| 02 | **The Money Flow** | 5 langkah berurutan: Revenue (TTM) → Net Profit (Anlz) → EPS → Operating Cash (CFO) → DPS, masing-masing dengan %YoY |
| 03 | **Income Trajectory** | Lintasan pendapatan & laba |
| 04 | **Quarterly Pulse** | 16 kuartal (23Q1–26Q4) |
| 05 | **Quality of Earnings** | ROE 5Y/10Y avg, DER 5Y, DY 5Y dengan label kualitatif (excellent / high leverage / …) |
| 06 | **Valuation Verdict** | Tabel PER & PBV: Latest · 5Y Avg · Fair (rupiah) · Verdict |
| 07 | **Financial Reports** | 5 tab: Laba Rugi · Neraca · Arus Kas · Rasio Keuangan · Rasio Valuasi — grafik + tabel 5 tahun (2021–2025) |
| 08 | **AI Analysis & Recommendation** | Skor /100 + 5 pilar (Growth · Profitability · Quality · Valuation · Dividend) + Strengths + Risks & Watchouts. **Rule-engine, bukan LLM** |
| 09 | **Glossary** | ±20 istilah (PER, PBV, PEG, ROE, DER, ICR, GPM, OPM, NPM, EPS, DPS, DY, BVPS, CFO, CFI, CFF, Nego, F.Net, YoY, CAGR) |

**Datanya**: satu objek `DATA` berisi `schema` (75 kolom) + `rows`
(**978 emiten**) — bentuk kolom-dan-baris, bukan objek per emiten, jadi jauh
lebih padat daripada sple-info. Kolomnya mencakup laporan keuangan (gp, op,
ta, ca, tl, eq, csh, cfo, cfi, cff), rasio (gpm/opm/npm/roe/der/cashr/curr/icr),
valuasi (per, pbv, peg + fair target + remark), dan trading (tr_vol, tr_val,
tr_frek, tr_fbuy, tr_fsell, tr_fnet, **tr_nrvol/nrval/nrfreq** untuk pasar
nego).

---

## 6. Apa artinya untuk PAPAN

### Yang mereka punya dan kita belum

1. **Aktivitas broker langsung dari IDX API.** Ini membalik anggapan lama kita.
   Catatan proyek menyebut *"Data broker per emiten tidak ada di endpoint
   publik IDX"* — ternyata ADA, dan mereka memakainya lewat dua Netlify
   Function. Saat diuji hari ini keduanya menjawab `{"error":"IDX API 403"}`
   (Minggu, dan IP datacenter Netlify tampaknya diblokir IDX — **persis
   masalah yang kita alami dengan GitHub Actions**). Jadi jalurnya nyata tapi
   rapuh; PAPAN yang menjalankan panen dari IP rumahan justru lebih diuntungkan.
   → langsung menyentuh **#129** dan **#146**.
2. **Pasar NEGO sebagai "Bandar Flow"** — volume/value/frekuensi non-reguler,
   plus rasio nego terhadap reguler. Kita belum menyentuh ini sama sekali,
   padahal `GetStockSummary` IDX punya ruasnya.
3. **Grup konglomerat** sebagai lensa utama, bukan sekadar filter.
4. **Fair value eksplisit** dengan dua metode terpisah (PBV & PER) plus verdict
   yang menyebut konflik kalau keduanya berlawanan.
5. **Level siap pakai** (entry / SL / TP1-3 / R:R / horizon) menempel di setiap
   emiten, bukan hanya di edisi bulletin.

### Yang PAPAN sudah lebih kuat

1. **Riwayat harga.** Kita punya OHLCV 5 tahun untuk 962 emiten + IHSG sejak
   1990. Mereka jujur menyebut keterbatasannya: **144 hari**, dan karena itu
   EMA150/200 bias serta SMA150/200 tak bisa dibuat sama sekali. Dengan data
   kita, seluruh indikator jangka panjang itu sah dihitung.
2. **Data kepemilikan KSEI** (Peta Investor). Grup konglomerat mereka
   diverifikasi manual lewat web search dan bisa basi diam-diam; punya kita
   bisa diturunkan dari data.
3. **Fraksi harga & auto rejection BEI** (`lib/fraksiHarga.ts`). Level entry/SL/TP
   mereka tidak dibulatkan ke tick — angka seperti `fast_sl: 8701` tidak bisa
   dipesan di bursa (fraksi Rp 5.000+ = Rp 25).
4. **Uji statistik.** Seasonality kita menguji pola lawan 2.000 pengacakan
   sebelum menyebutnya nyata; sinyal mereka berhenti di backtest.
5. **Terbitan PDF** dan alur kontributor — mereka tak punya padanannya.

### Yang layak ditiru sebagai *cara kerja*, bukan disalin

- **Panduan sebagai bagian produk.** 40 sub-bagian berisi rumus, tanggal
  perubahan, dan pengakuan kesalahan. Ini membangun kepercayaan lebih kuat
  daripada sinyal mana pun.
- **Menyimpan ketidakpastian bersama data** (`_*_approx`, `_data_asof`).
- **Peringatan konteks pada sinyal** — kapan strategi TIDAK berlaku.
- **Export PNG siap-share** untuk tiap kartu sinyal.

### Kalau mau "lebih pro" — empat lubang di produk mereka

1. **Halaman 6 MB.** Seluruh data 963 emiten diunduh walau pembaca cuma
   melihat satu. PAPAN sudah memecah per emiten (`ohlc/<KODE>.json`, 40 KB).
2. **Snapshot, bukan seri.** Mereka menyimpan satu hari; perbandingan lintas
   waktu terbatas pada ruas yang sudah dihitung sebelumnya. Kita punya seri
   penuh.
3. **Angka tak sadar fraksi bursa** (lihat di atas).
4. **Grup konglomerat manual** — mereka sendiri menulis *"perlu diverifikasi
   ulang manual, bukan otomatis ter-update"*.

---

## 7. Berkas pendukung

| Berkas | Isi |
|---|---|
| `info-01…09-*.png` | Screenshot tiap section sple-info (laptop 1536×960) |
| `mf-01…03-*.png` | Screenshot sple-mf |
| `panduan-sple-info.txt` | Ekstraksi teks tab Panduan |

Salinan HTML kedua situs (6,0 MB + 1,4 MB) sengaja **tidak** dimasukkan ke
repo — dipakai sekali untuk analisis lokal, mudah diunduh ulang kapan saja.

---

*Riset ini deskriptif: mencatat apa yang dilakukan situs orang lain dan
membandingkannya dengan posisi PAPAN. Tak ada kode yang disalin.*
