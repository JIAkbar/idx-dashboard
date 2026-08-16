# Metodologi SPLE·Insight — kutipan tab Panduan

Diambil dari DOM tab **Panduan** situs sple-info.netlify.app pada 16 Agustus
2026 (isinya dirender JavaScript, tidak ada di HTML mentah). Disimpan sebagai
rujukan riset — lihat `README.md` untuk analisis dan perbandingannya dengan
PAPAN.

Panduan aslinya punya **40 sub-bagian**. Di bawah ini bagian yang paling
menentukan cara mereka menghitung.

---

## Indikator teknikal — metode & interpretasi

| Indikator | Metode | Interpretasi |
|---|---|---|
| MA5/10/20/50/100 | SMA sederhana | Harga di atas MA = uptrend. MA50 & MA100 = tren menengah/panjang |
| RSI14 | Wilder's Smoothing | <30 oversold · >70 overbought · 30–70 netral |
| MACD (12,26,9) | EMA cross + histogram | Histogram positif = momentum naik |
| StochRSI | RSI dari RSI, Wilder | %K <0.2 oversold · >0.8 overbought · %K cross %D ke atas = sinyal beli |
| Bollinger Band (20) | MA20 ± 2σ | %B <20% dekat lower band · bandwidth sempit = konsolidasi |
| ATR(14) | Average True Range, Wilder | Basis SL: **close − 1,5×ATR** |
| Fibonacci | Swing High/Low **108 hari** | 61,8% = Golden Zone · 23,6% = zona atas |
| Ichimoku | Tenkan/Kijun/Senkou | Di atas cloud = bullish · Tenkan > Kijun = TK cross bullish |
| Wyckoff | Posisi vs MA20/MA50 + FNet | 6 fase, lihat bawah |

## Wyckoff — enam fase, tanpa "Consolidation"

Keputusan yang menarik: mereka **menghapus** fase "Consolidation" karena
ambigu, dan membedakan dua keadaan sideways memakai **arah aliran asing**:

- **Accumulation Potential** — harga antara MA20–MA50 **dan FNet 5D positif** → sideways dengan tekanan beli tersembunyi
- **Markdown Early** — harga antara MA20–MA50 **dan FNet 5D negatif** → sideways dengan tekanan jual
- **Markup Awal** — harga menembus MA20 ke atas
- **Markup** — Close > MA20 > MA50, volume di atas rata-rata
- **Markdown Awal** — harga mulai di bawah MA20/MA50
- **Markdown** — Close < MA20 < MA50

**MA100 sebagai konfirmasi, bukan komponen skor**: badge ✓ kalau harga selaras
arah fase, ⚠ kalau berlawanan (mis. fase Markup tapi harga masih di bawah
MA100 → waspada bull trap).

## RS Rating & Minervini SEPA

- **RS Rating (0–99)** = `50 + pct_1D×3 + mom_10D×0.5`. RS >70 outperform, <50 underperform.
- **Stage 2 Proxy** = Close > MA20 > MA50.
- **VCP Proxy** = ≥2 candle hijau berturut + volume mengering (<90% avg5D) + Wyckoff Accumulation/Markup.
- Aturan tegas: saham dengan Stage2 = TIDAK **dan** RS <50 tak akan direkomendasikan beli oleh AI-nya.
- Diakui sendiri: *"Ini proxy berbasis data harian, bukan analisis VCP Minervini yang sesungguhnya (butuh intraday)."*

## Valuasi — dua metode terpisah, ambang batas eksplisit

- **PBV**: `BVPS = Harga ÷ PBV`, fair target = **1,5 × BVPS**
- **PER**: `EPS = Harga ÷ PER`, fair target = **12 × EPS**

Ambang remark (baru ditetapkan terbuka 13 Jul 2026):

| Potensi G/L | Remark |
|---|---|
| > +20% | Undervalued |
| +5% … +20% | Slightly Undervalued |
| −5% … +5% | Fair Valued |
| −20% … −5% | Slightly Overvalued |
| < −20% | Overvalued |

Disertai pengakuan: *"pbv_fair_target/per_fair_target sempat basi
berbulan-bulan (tidak ikut ter-update saat BVPS/EPS berubah dari RDFE
mingguan) — sudah diperbaiki."*

## Harmonic Pattern

Gartley / Bat / Crab / Butterfly dari swing high-low **108 hari**, dihitung
server-side. Validasi rasio Fibonacci:

| Pola | AB/XA | AD/XA |
|---|---|---|
| Gartley | 61,8% | 78,6% |
| Bat | 38–50% | 88,6% |
| Crab | 38–61,8% | 161,8% |
| Butterfly | 78,6% | 127–161,8% |

Hasilnya ~1,8% saham menampilkan pola pada satu waktu — dan mereka menegaskan
itu wajar, *"pola harmonic memang formasi langka, bukan target 'selalu
ketemu'"*.

## Keterbatasan yang diakui sendiri

Bagian ini yang paling patut ditiru sikapnya:

> **EMA150/EMA200**: histori data baru ~114 hari. EMA dihitung mulai dari harga
> hari pertama lalu "meluruh" pelan. Untuk periode panjang, sisa bobot titik
> awal masih signifikan: **EMA150 ≈21,9%** dan **EMA200 ≈32,0%** dari nilainya
> saat ini masih menempel ke harga hari pertama — bukan murni cerminan 150/200
> hari terakhir.

> **SMA150/SMA200 SENGAJA TIDAK dibuat** — SMA butuh data historis genap untuk
> dirata-rata, tidak ada cara "berjalan mendekat" seperti EMA. Dipaksakan
> dengan 114 hari akan menghasilkan angka yang salah total.

> **Harmonic Pattern, fix 9 Jul 2026**: field ini SEBELUMNYA selalu kosong
> (null) untuk hampir semua saham meski dokumentasi lama menyebut "40 candle"
> — ternyata belum pernah benar-benar dihitung.

> **Doji Reversal, 8 Agu 2026**: 2× fix dalam sehari — percobaan pertama
> (`body/range<10%`) masih salah, meloloskan DSSA dengan body/range 4,5%.

**Catatan untuk PAPAN**: keterbatasan histori 114–144 hari inilah yang membuat
mereka tak bisa menghitung MA/EMA panjang dengan benar. Kita punya OHLCV **5
tahun untuk 962 emiten** dan IHSG sejak 1990 — seluruh indikator itu sah
dihitung tanpa catatan kaki.

## AI — pembagian tugas yang tegas

- **Daily Briefing** (tanpa passcode): web search ke Kontan, CNBC Indonesia, Bisnis.com, Katadata, BEI/IDX, Bloomberg, Reuters. Empat mode mengikuti jam bursa — Pre-Market 08:00–09:00, Sesi 1 09:00–12:00, Sesi 2 12:30–16:00, Penutupan 16:00–08:00.
- **ASK SPLE** (dengan passcode): data lokal + web search, output enam bagian tetap — Analisa Teknikal → Momentum → Volatilitas → Summary (S/R) → Strategi Eksekusi. Sengaja **tidak** memberi Entry/SL/TP mutlak.
- **Scan/Filter bebas**: AI membaca 169 saham likuid, pilih 3 kandidat. Tampilan Entry/TP/SL dirender dari JSON terstruktur, bukan teks bebas AI — supaya format konsisten dan angkanya hanya yang benar-benar ada di data.
- **AI Insight per kartu**: wajib tiga bagian — BULLISH, RISIKO, KESIMPULAN (tanpa kata "beli"/"jual" eksplisit).

Aturan yang paling tajam, dan pantas ditiru apa adanya:

> Kalau PBV & PER memberi sinyal berlawanan arah (satu Undervalued, satu
> Overvalued), AI **WAJIB** menyebutkan konfliknya eksplisit — tidak diam-diam
> memilih salah satu.

Dan batas yang mereka tarik sendiri antara AI dan kode:

> Untuk kriteria yang sudah baku (Oversold Reversal, Akumulasi Senyap, dll),
> tab Screener/Signal lebih presisi karena murni filter kode, bukan
> interpretasi AI.

## Live News — 12 sumber

**7 stabil**: KabarBursa, IQPlus, IDNFinancials, Bisnis.com, Kontan,
StockWatch.id, Katadata.co.id.
**5 eksperimental**: CNBC Indonesia, Emitennews, Investor.id, Investing.com ID,
Bloomberg Technoz (tanpa RSS resmi → scraping HTML).

Satu sumber gagal tidak menjatuhkan sisanya (`Promise.allSettled`).

---

## Signal — rumus level Entry/SL/TP

Semua level berbasis **harga penutupan**, pick dipilih setelah closing IDX,
dan panduannya mewajibkan validasi harga open keesokan harinya sebelum
eksekusi.

| Level | Rumus |
|---|---|
| **Entry Zone** | `(Nearest Support + Close) ÷ 2` — menunggu pullback minor, bukan market order |
| **SL (ketat)** | `max(Support × 0,985, Close − 1,5 × ATR)` |
| **TP1** | Fibonacci resistance terdekat |
| **TP2** | Fibonacci swing high |

Badge gaya trading:

- **⚡ Scalp** — ATR < 2,5% harga **dan** likuiditas ≥ Rp5M/hari
- **📈 Swing** — ATR lebih besar atau likuiditas sedang → hold 2–5 hari

Dua angka pendamping: **Gap Risk ±X%** (estimasi gap opening dari ATR) dan
**VWAP5D** (posisi harga terhadap VWAP 5 hari).

**Anti-duplikasi antar kategori**: satu saham tak boleh muncul di dua
kategori. Prioritas mengikuti urutan proses — Akumulasi Senyap → Swing
Recovery → Ultra Scalping. Ranking di dalam tiap kategori pun berbeda:
Akumulasi Senyap by nilai transaksi 5D, Swing Recovery by skor FNet−RSI, Ultra
Scalping by kedalaman momentum.

Chip **M/V/T tidak masuk filter Signal** — hanya konteks tampilan.

## Screener — kolom, chip, tier

**8 kolom ringkas**: Saham · Harga · %1D · Value · FNet1D · Ichimoku (5 tingkat:
☀️ Bullish Kuat / 🟢 Bullish / 🌤 Dalam Cloud / 🔴 Bearish / ⛈️ Bearish Kuat) ·
Wyckoff · Spark.
**9 kolom "+Detail"**: %10D · RSI · FNet5D · PER · PBV · ROE% · FNet% ·
Valuasi · Conf.

**Warna baris**: hijau tipis = ≥3 candle hijau + FNet5D positif + bukan
Markdown; merah tipis = Markdown + FNet5D negatif.

**Chip M/V/T** (diperketat 30 Jul 2026, dan dropdown yang artinya sama dihapus
supaya tak ada dua jalan untuk pertanyaan yang sama):

| Chip | Formula sekarang | Formula lama |
|---|---|---|
| **M** Momentum | RSI14 50–70 | mom10D>0 & Close>MA5 (lebih longgar) |
| **V** Volume | Volume surge ≥2× avg 7D | value hari ini > avg 5D |
| **T** Trend | Harga > MA5 > MA10 > MA20 | Harga > MA5 > MA10 |

**Tier market cap** (Listed Shares × Harga): Tier1 Big Cap >Rp40T · Tier2 Mid
Cap Rp5–40T · Tier3 Small/Micro <Rp5T.

**HA vs EMA20**: Heikin Ashi close dibanding EMA20 harga biasa — 🟢 >+0,5% naik
· 🟡 ±0,5% transisi · 🔴 <−0,5% turun.

**Badge INST**: rata-rata transaksi >Rp10jt per transaksi **dan** value harian
>Rp1M.

**Papan saham** diambil dari kolom Remarks IDX (Utama / Pengembangan /
Akselerasi); saham "SUSPEND" ditandai khusus dan skor efektifnya 0.

## Pola candlestick — hanya berarti di zona kunci

Aturan yang paling patut ditiru dari bagian ini:

> Badge pola candlestick **HANYA** muncul kalau pola itu terjadi persis di
> dekat (**±2%**) nearest_support atau nearest_resist. Pola yang sama di tengah
> range TIDAK ditampilkan — standalone pola candlestick lemah sebagai sinyal,
> cuma bermakna kalau ketemu konfluensi zona teknikal.

Pola yang dideteksi: Hammer (shadow bawah ≥2× body), Shooting Star, Bullish/
Bearish Engulfing, Marubozu (body ≥2%, nyaris tanpa ekor), Doji. Satu candle
hanya dapat **satu** label — Marubozu dicek lebih dulu daripada Engulfing.

Diakui sendiri: *"deteksi pola pakai definisi geometris sederhana (rasio body
vs shadow), BUKAN machine learning atau validasi historis win-rate."*

## Preset Screener — dan kenapa dua di antaranya diganti

| Preset | Formula | Backtest |
|---|---|---|
| 📉 **Oversold Reversal** | RSI14<30 + Stoch%K<20% + FNet5D positif | 126 hari, excess +0,52%/hari, win ~52% (n=3.976) |
| 🤫 **Akumulasi Senyap** | FNet asing positif ≥8/10 hari + avg value 5D >Rp1M | 126 hari, excess +0,33%/3 hari, stabil 2 periode |
| 📈 **Momentum Berkelanjutan** | ≥3 candle hijau beruntun + FNet5D positif | PF 1,35, avg +0,65%/hari, n=1.137 |
| 🎯 **Swing Trading** | Candle hijau ≥3 + FNet 1D & 5D positif + Wyckoff (Akumulasi **atau** Markup) | — |

Alasan penggantian dua preset lama layak dicatat: backtest keduanya bagus (PF
1,90 dan 1,48) **tapi kriterianya secara struktural nyaris tak pernah
terpenuhi bersamaan di pasar nyata** — jadi hasilnya kosong terus. Penggantinya
dipilih karena lolos uji stabilitas dua periode, bukan PF satu jendela.

Dua peringatan yang mereka tulis sendiri:

> PF>1 dari backtest historis TIDAK menjamin performa ke depan. 113–126 hari
> data adalah satu rezim pasar (bearish struktural, IHSG −28% YTD).

> Insight kunci dari backtest lama: arah harga hari ini saat volume surge
> adalah faktor pembeda utama — volume surge pada saham yang **turun** justru
> berkorelasi dengan distribusi lanjutan, bukan reversal.

## Fitur yang mereka BUANG — dan alasannya

Ini bagian paling jujur dari seluruh panduan, dan paling berguna sebagai
pelajaran:

> **Top 10 Fundamental DIHAPUS PERMANEN** (7 Agu 2026). Backtest
> cross-sectional 955 saham terhadap 7 metrik (ROE/DER/PBV/PER/CFO/NPM/Earnings
> Yield) tidak menemukan sinyal bersih terhadap return riil 90 hari — formula
> scoring aslinya juga tidak diketahui persis lagi (reverse-engineering regresi
> **R²=0,013**, tidak recoverable). Widget, kode render, dan datanya dibuang.

> **Kolom "Score" dihapus** dari Screener sejak v170–173 — field fundamental
> scoring itu tidak pernah tervalidasi (regresi R²=0,013). Raw ratio
> (PER/PBV/ROE) tetap tersedia.

Membuang fitur yang tak terbukti, dan menuliskan angka R² yang membuktikannya,
lebih sulit daripada menambah fitur baru.

## Harmonic Pattern — validasi struktural

Setelah dua kali diperbaiki dalam satu hari (4 Agu 2026):

- Wajib **BC/AB dalam 0,382–0,886** sebelum rasio pola dicek. Formula lama
  meloloskan BC/AB 4,8× dan 7,4× — mustahil secara matematis. Hasil turun dari
  34 "pola" jadi **17 yang valid**.
- **PRZ** dihitung dari rentang toleransi AD/XA, divalidasi ulang: titik D tiap
  saham dijamin berada di dalam rentang PRZ-nya sendiri.
- Metodologi: zigzag pivot (swing minimal 3%) dari 108 hari, scan **semua**
  kombinasi 5-pivot berurutan, ambil match valid paling baru. Refresh mingguan,
  bukan harian.
- Toleransi ±3–5% tiap rasio.

## Free float — sinyal risiko manipulasi

Badge **⚠ FF merah** = free float sangat rendah, risiko manipulasi tinggi.
Badge **FF kuning** = rendah, waspadai pergerakan tak wajar. Di `DATA.meta`
ada `float_blacklist` berisi 34 kode.

## Foreign — kontribusi dan klasifikasi

`Foreign Contrib % = (Foreign Buy + Foreign Sell) ÷ Total Value × 100` —
mengukur **dominasi** asing (gross, bukan net). Klasifikasi otomatis:

| Kelas | Syarat |
|---|---|
| `inst_akumulasi` | contrib >50% **dan** FNet5D positif |
| `inst_distribusi` | contrib >50% **dan** FNet5D negatif |
| `retail_aktif` | contrib ≤50% **dan** value ≥Rp5M |
| `retail_illiquid` | contrib ≤50% **dan** value <Rp5M |

Catatan berguna: **anomali >100%** mungkin terjadi karena counter-party asing
di kedua sisi transaksi — bukan galat data.

## Kalkulator risk management

Input: modal trading · % risiko per trade (rekomendasi 1–2%) · entry/SL/TP.
Output: jumlah lot aman · kerugian maksimal · profit target · R/R.
Prinsipnya satu kalimat: *"R/R minimal 1:2 sebelum entry."*
