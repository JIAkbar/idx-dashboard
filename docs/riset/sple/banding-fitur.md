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
| **Rasio & metrik fundamental** | ✅ **967 emiten × 147 ruas** | ✅ 978 × 75 kolom (RDFE) | **PAPAN hampir 2× lebih kaya** — rincian §G |
| Laporan keuangan mentah | 🟡 646 emiten × 15 ruas, 6 kuartal + 5 tahun | ✅ 978 emiten, 16 kuartal + 9 tahun | Mereka lebih dalam & lebih rapat |
| Kepemilikan KSEI ≥1% | ✅ 956 emiten | ❌ | Hanya PAPAN |
| Data broker per emiten | ❌ | 🟡 IDX API (403 dari datacenter) | Lihat #151 |
| Aktivitas broker pasar | ✅ dari PDF IDX harian | 🟡 IDX API live | Punya kita justru lebih andal |
| Pasar NEGO (non-reguler) | ❌ | ✅ "Bandar Flow" | Ruasnya sudah ada di panen kita — #152 |
| Foreign net 1D/5D/10D | 🟡 1D saja | ✅ 1/5/10 hari + buy & sell terpisah | Bisa dihitung dari ds_*.json harian |
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
| Valuasi fair value | 🟡 rasio ada, verdict belum | ✅ PBV & PER + verdict + ambang | Datanya SUDAH ada, tinggal ambang & tampilan |
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

## G. Fundamental — dibedah kolom per kolom

Ini bagian yang paling salah saya duga sebelumnya. `data-idx/json/fundamental/`
berisi **967 emiten × 147 ruas** — bukan sekadar PER/PBV.

**Yang PAPAN punya dan RDFE/sple-mf TIDAK:**

| Ruas | Isi |
|---|---|
| `altman_z` | Skor kebangkrutan Altman Z |
| `f_score`, `f_score_n` | Piotroski F-Score |
| `roic`, `roce` | Return on invested/capital employed |
| `receivables_turnover`, `inventory_turnover`, `asset_turnover` | Perputaran |
| `days_sales_outstanding`, `days_inventory`, `days_payables`, `cash_conversion_cycle` | Siklus kas |
| `sector_pe_median`, `sector_pb_median`, `sector_npm_median`, `sector_roe_median`, `sector_ev_ebitda_median`, `sector_stock_count` | **Median sektor** |
| `pe_vs_sector_pct`, `pb_vs_sector_pct`, `ps_vs_sector_pct` | Posisi relatif terhadap sektornya |
| `target_price`, `analyst_count`, `recommendation` | Konsensus analis |
| `held_insiders_pct`, `held_institutions_pct`, `float_shares`, `free_float_pct` | Struktur kepemilikan |
| `beta`, `week52_high/low/change_pct` | Risiko & rentang tahunan |
| `ev_ebit`, `ev_ebitda`, `ev_revenue`, `enterprise_value` | Kelipatan EV |
| `div_history`, `payout_ratio`, `ex_dividend_date`, `dividend_ttm` | Riwayat dividen |
| `eps_cagr_2y`, `eps_cagr_3y` | Pertumbuhan EPS |
| `interest_coverage`, `quick_ratio`, `current_ratio` | Likuiditas & solvabilitas |
| `price_perf` | Kinerja harga multi-horizon |

**Yang RDFE punya dan kita kurang:**

| Hal | RDFE | PAPAN |
|---|---|---|
| Kedalaman tahunan | **9 tahun** (2017–2025) | 5 tahun |
| Kedalaman kuartalan | **16 kuartal** | ~6 kuartal |
| Cakupan laporan mentah | 978 emiten | 646 emiten |
| ROE 10 tahun | ✅ `roe10y` | 🟡 `hist_roe` seadanya |
| Fair value PER/PBV siap pakai | ✅ | ❌ (rasionya ada, ambangnya belum) |

**Lubang mutu di data kita** — diukur dari 200 emiten, kuartal terbaru:

| Ruas | Kosong |
|---|---|
| `operating_cf` | **80%** |
| `eps` | **71%** |
| `cogs`, `gross_profit`, `operating_income` | 22% |
| `total_debt` | 6% |

Catatan: sebagian lubang itu tertutup dari sisi lain — `fundamental/` punya
`ttm_ocf`, `q_ocf`, dan `eps` tersendiri. Jadi masalahnya bukan datanya tak
ada, tapi **dua sumber belum disatukan**.

**Kesimpulan bagian ini**: untuk *rasio dan metrik turunan* PAPAN unggul jauh
(147 vs 75 ruas, termasuk Altman Z, F-Score, dan pembanding sektor yang tak
mereka punya sama sekali). Untuk *kedalaman laporan keuangan mentah* mereka
unggul (9 tahun vs 5, 16 kuartal vs 6). Yang kita belum punya bukan datanya —
tapi **halaman yang menampilkannya**.


## Lima lubang PAPAN yang paling terasa

Diurut menurut ongkos-vs-hasil, bukan besarnya:

| # | Yang belum ada | Datanya sudah ada? | Yang kurang |
|---|---|---|---|
| 1 | **Berita / Live News** | ❌ **belum sama sekali** | Perlu pengumpul RSS di server + daftar sumber |
| 2 | **Screener** seluruh emiten | ✅ **lengkap** — `fundamental/` 967×147 + `ohlc/` 962 | Murni layar & filter |
| 3 | **Indikator per emiten** (RSI/MACD/BB/ATR/Ichimoku/Fib) | ✅ **bahan mentahnya ada** — OHLCV 5 tahun | Fungsi hitung + tampilan. Rumus di Radar bisa dipakai ulang |
| 4 | **Ringkasan naratif harian** | ✅ angka hariannya lengkap | Perumusan kalimat + siapa menulisnya |
| 5 | **Panduan metodologi di web** | ✅ sudah tertulis di `docs/` | Tinggal dipindah jadi halaman |
| 6 | **Fair value + verdict valuasi** | ✅ PER/PBV/EPS/BVPS ada di `fundamental/` | Ambang remark + tampilan |
| 7 | **Foreign flow 5D/10D** | 🟡 harian ada, agregat belum dihitung | Skrip agregasi dari `ds_*.json` |
| 8 | **Pasar NEGO / Bandar Flow** | 🟡 ruas ada di `GetStockSummary` | Belum dipanen ke JSON |
| 9 | **Heatmap & market breadth** | ✅ dari data harian | Layar saja |
| 10 | **Watchlist** | — (localStorage) | Layar saja |

## Lima keunggulan PAPAN yang tak mereka punya

| Hal | Kenapa sulit ditiru |
|---|---|
| **OHLCV 5 tahun + IHSG 1990** | Mereka terhenti di 144 hari; EMA150/200 bias 22–32%, SMA150/200 mustahil |
| **Kepemilikan KSEI** | Peta jaringan & grup konglomerat yang auditable — daftar mereka manual |
| **Uji lawan 2.000 pengacakan** | Seasonality kita menolak menyebut pola sebelum lolos uji; mereka berhenti di backtest |
| **Fraksi harga & ARA/ARB BEI** | Level mereka tak dibulatkan ke tick — `fast_sl: 8701` tak bisa dipesan |
| **Rantai kontributor + terbitan PDF** | Produk sosial, bukan hanya dasbor |
