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
