# Ceklist banding fitur — PAPAN vs SPLE (info + mf)

Disusun 16 Agustus 2026. Sisi SPLE dari bedah statis dua berkas HTML
(`peta-section.md`); sisi PAPAN diverifikasi dengan menelusuri rute di
`App.tsx` dan mencari tiap istilah indikator di `app/src` — bukan dari ingatan.

Tanda: ✅ ada · 🟡 ada tapi terbatas · ❌ belum ada · — tak relevan

---

## A. Data & cakupan

| Hal | PAPAN | SPLE | Catatan |
|---|---|---|---|
| Universe emiten | ✅ 963 | ✅ 963 (info) / 978 (mf) | Setara |
| Harga harian OHLCV | ✅ **5 tahun, 962 emiten** | 🟡 ~144 hari | Keunggulan PAPAN paling besar |
| Riwayat IHSG | ✅ **sejak 1990** (8.849 hari) | 🟡 sebatas snapshot | |
| Harga buka (open) | ✅ | ✅ | PAPAN baru sejak #108 |
| Laporan keuangan | ✅ 646 emiten (Yahoo) | ✅ 978 emiten (**RDFE berbayar**, 10 thn) | Mereka lebih dalam, kita gratis & bisa disegarkan kapan saja |
| Kepemilikan KSEI ≥1% | ✅ 956 emiten | ❌ | Hanya PAPAN |
| Data broker per emiten | ❌ | 🟡 IDX API (403 dari datacenter) | Lihat #151 |
| Aktivitas broker pasar | ✅ dari PDF IDX harian | 🟡 IDX API live | Punya kita justru lebih andal |
| Pasar NEGO (non-reguler) | ❌ | ✅ "Bandar Flow" | Ruasnya sudah ada di panen kita — #152 |
| Foreign net 1D/5D/10D | 🟡 1D saja | ✅ 1/5/10 hari + buy & sell terpisah | |
| Cara data sampai ke klien | ✅ per berkas (40 KB) | ❌ satu berkas 6 MB | |

## B. Halaman & section

| Section | PAPAN | SPLE | Catatan |
|---|---|---|---|
| Dasbor pasar harian | ✅ Indeks Dunia | ✅ Overview | Setara |
| Ringkasan naratif harian | ❌ | ✅ Coffee Morning | Belum ada di PAPAN |
| **Berita / Live News** | ❌ | ✅ 12 sumber RSS + scraping | **Betul, PAPAN belum punya** |
| Konteks global & komoditas | ✅ chart IHSG + Indeks Dunia 33 negara | ✅ 13 ticker sparkline + widget TV | PAPAN unggul di cakupan negara |
| Heatmap | ❌ | ✅ TradingView + custom | |
| Market breadth | ❌ | ✅ | |
| Top gainers/losers/value | ✅ Top Stocks | ✅ Top Today | Setara |
| Top broker | ✅ | ✅ | Setara |
| Performa sektor | ✅ Sektor & Indeks | ✅ | PAPAN lebih lengkap (indeks tematik) |
| **Screener seluruh emiten** | ❌ | ✅ 963 baris, 17 kolom, 13 filter, 4 preset | Lubang terbesar PAPAN |
| Detail per emiten | ✅ Stock Detail | ✅ Modal + sple-mf | |
| Laporan keuangan lengkap | ✅ 5 tab (kuartal/tahunan) | ✅ 5 tab (2021–2025) | Setara |
| Valuasi fair value | 🟡 rasio mentah | ✅ PBV & PER + verdict + ambang | |
| Grup konglomerat | ✅ **diturunkan dari KSEI** | 🟡 daftar manual, 11 grup | PAPAN auditable, mereka lebih lengkap |
| Peta jaringan kepemilikan | ✅ | ❌ | Hanya PAPAN |
| Seasonality bulanan | ✅ **diuji lawan 2.000 pengacakan** | ❌ | Hanya PAPAN |
| Seasonality hari-dalam-pekan | ✅ IHSG + per emiten | ❌ | Hanya PAPAN |
| Radar WDWL | ✅ | ❌ | Hanya PAPAN |
| Bulletin PDF terbitan | ✅ harian/mingguan/bulanan/bedah | ❌ | Hanya PAPAN |
| Forum | ✅ | ❌ | Hanya PAPAN |
| Kalkulator | ✅ Profit/ARA/Dividen/Pemulihan/AvgDown | ✅ position sizing | Berbeda fokus |
| Simulasi portofolio | ❌ | ✅ | |
| Watchlist | ❌ | ✅ (localStorage) | |

## C. Indikator teknikal

| Indikator | PAPAN | SPLE | Catatan |
|---|---|---|---|
| MA 5/10/20/50/100 | 🟡 hanya di Radar | ✅ tampil per emiten | |
| EMA 5…200 | ❌ | ✅ 8 periode | Kita justru punya data untuk menghitungnya benar |
| RSI 14 | 🟡 hanya di Radar | ✅ | |
| MACD | 🟡 hanya di Radar | ✅ | |
| Stochastic / StochRSI | ❌ | ✅ | |
| Williams %R | ❌ | ✅ | |
| Bollinger Band | ❌ | ✅ %B + bandwidth | |
| ATR | ❌ | ✅ basis SL | |
| Fibonacci | ❌ | ✅ 7 level, 2 versi | |
| Ichimoku | ❌ | ✅ 5 tingkat sinyal | |
| VWAP 5D/10D | ❌ | ✅ | |
| Heikin Ashi | ❌ | ✅ vs EMA20 | |
| Wyckoff phase | ❌ | ✅ 6 fase | |
| Harmonic pattern | ❌ | ✅ 4 pola | Dokumentasi mereka sendiri tak konsisten soal Butterfly |
| Pola candlestick | ❌ | ✅ hanya di ±2% S/R | Aturan konfluensinya layak ditiru |
| RS Rating / Minervini | ❌ | ✅ proxy | |
| Monte Carlo / GBM | ❌ | ✅ kerucut proyeksi | |
| **Fraksi harga & ARA/ARB BEI** | ✅ | ❌ | Level mereka tak jatuh di tick |
| **Uji signifikansi statistik** | ✅ 2.000 pengacakan | ❌ backtest saja | |

## D. Sinyal & analitik

| Hal | PAPAN | SPLE | Catatan |
|---|---|---|---|
| Sinyal harian otomatis | ❌ | ✅ 4 kategori, kuota per hari | |
| Level Entry/SL/TP | 🟡 di PDF bedah | ✅ per kartu, rumus terbuka | |
| Skor komposit emiten | ✅ di bulletin (5 komponen) | 🟡 dibuang setelah R²=0,013 | |
| Divergensi | 🟡 rencana #130 | ✅ Divergence Radar | |
| Foreign flow ranking | ❌ | ✅ akumulasi & distribusi | |
| Klasifikasi kontribusi asing | ❌ | ✅ 4 kelas | |
| Free float / risiko manipulasi | ❌ | ✅ badge + blacklist 34 kode | |
| Tier market cap | ❌ | ✅ 3 tier | |
| Probabilitas historis | ✅ Seasonality + bulletin | ✅ backtest preset | Metode berbeda |

## E. AI

| Hal | PAPAN | SPLE | Catatan |
|---|---|---|---|
| Chat tanya-jawab | ❌ | ✅ ASK SPLE (Claude Haiku 4.5 + passcode) | |
| Briefing harian per sesi bursa | ❌ | ✅ 4 mode ikut jam bursa | |
| Insight per kartu/emiten | ❌ | ✅ struktur wajib 3 bagian | |
| Scan/filter bahasa bebas | ❌ | ✅ 169 saham likuid | |
| Rule-engine rekomendasi | 🟡 skor bulletin | ✅ 5 pilar + strengths/risks | |
| Transkripsi gambar → data | ✅ **broker summary lewat Vision** | ❌ | Hanya PAPAN |

## F. Konten, komunitas, operasional

| Hal | PAPAN | SPLE | Catatan |
|---|---|---|---|
| Terbitan PDF berkala | ✅ 4 jenis | ❌ | |
| Kontributor & kurasi setoran | ✅ jenjang, kuota, akurasi | ❌ | |
| Notifikasi hasil kurasi | ✅ | ❌ | |
| Forum diskusi | ✅ | ❌ | |
| Akses berjenjang per halaman | ✅ tabel Akses + tier | 🟡 satu passcode | |
| Export PNG/PDF | 🟡 PDF terbitan | ✅ PNG sinyal + PDF halaman | |
| Halaman panduan/metodologi | 🟡 di `docs/`, bukan di web | ✅ **40 sub-bagian di web** | Yang paling membangun kepercayaan |
| Riwayat perubahan formula | 🟡 CHANGELOG repo | ✅ bertanggal di panduan | |
| Tema terang/gelap | ✅ | 🟡 terang (info), gelap (mf) | |
| Teknologi | React + TS + Vite | HTML + vanilla JS | |

---

## Lima lubang PAPAN yang paling terasa

Diurut menurut ongkos-vs-hasil, bukan besarnya:

| # | Yang belum ada | Kenapa terasa | Bahan yang sudah kita punya |
|---|---|---|---|
| 1 | **Berita / Live News** | Dasbor pasar tanpa berita memaksa pembaca pindah tab untuk tahu *kenapa* | Belum ada; perlu RSS aggregator (server) |
| 2 | **Screener** seluruh emiten | Kita punya data 963 emiten tapi tak ada layar untuk menyaringnya | `ohlc/*.json` + keuangan 646 emiten |
| 3 | **Indikator per emiten** (RSI/MACD/BB/ATR dst) | Sudah dihitung di Radar tapi tak pernah ditampilkan per emiten | OHLCV 5 tahun — bisa hitung MA/EMA panjang yang mereka **tak bisa** |
| 4 | **Ringkasan naratif harian** | Coffee Morning membuat dasbor terasa "dibaca", bukan cuma "dilihat" | Data harian lengkap; tinggal perumusannya |
| 5 | **Panduan metodologi di web** | Rumus kita ada di `docs/`, tak terlihat pembaca | Sudah tertulis, tinggal dipindah ke halaman |

## Lima keunggulan PAPAN yang tak mereka punya

| Hal | Kenapa sulit ditiru |
|---|---|
| **OHLCV 5 tahun + IHSG 1990** | Mereka terhenti di 144 hari; EMA150/200 bias 22–32%, SMA150/200 mustahil |
| **Kepemilikan KSEI** | Peta jaringan & grup konglomerat yang auditable — daftar mereka manual |
| **Uji lawan 2.000 pengacakan** | Seasonality kita menolak menyebut pola sebelum lolos uji; mereka berhenti di backtest |
| **Fraksi harga & ARA/ARB BEI** | Level mereka tak dibulatkan ke tick — `fast_sl: 8701` tak bisa dipesan |
| **Rantai kontributor + terbitan PDF** | Produk sosial, bukan hanya dasbor |
