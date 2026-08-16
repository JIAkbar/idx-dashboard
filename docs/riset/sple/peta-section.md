# Peta section SPLE — nama, anchor, dan sumber datanya

Hasil bedah **statis** atas kedua berkas HTML (bukan klik satu per satu):
tiap fungsi `render*`/`load*`/`fetch*` ditelusuri sampai ketahuan elemen mana
yang diisinya dan ruas data mana yang dibacanya. Diambil 16 Agustus 2026.

Pelengkap `README.md` (analisis) dan `metodologi-sple-info.md` (rumus).

---

## Teknologi — terkonfirmasi bukan React

Dugaan "full HTML, bukan React" **benar**. Dihitung dari berkasnya:

| Jejak | sple-info | sple-mf |
|---|---|---|
| React / Vue / Svelte / jQuery / Alpine | **0** | **0** |
| `<script src=…>` eksternal | **1** | **3** |
| `document.getElementById` | 225 | 128 |
| `innerHTML =` | 91 | 33 |
| `onclick=` di markup | 55 | 0 |
| `addEventListener` | 43 | 32 |

Satu-satunya pustaka luar:

- **sple-info**: `html2canvas` (export PNG)
- **sple-mf**: `Chart.js 4.4.0`, `html2canvas`, `jsPDF 2.5.1`

Jadi: satu berkas HTML raksasa, **vanilla JS**, DOM diisi lewat `innerHTML`,
tanpa build step. sple-info punya **138 fungsi**, sple-mf **69 fungsi**.

Konsekuensi yang terlihat langsung: sple-info **6,0 MB** karena seluruh data
963 emiten ditanam di dalam `<script>` — 5,5 MB di antaranya satu objek `DATA`.

---

## sple-info — peta lengkap

Halaman punya **144 elemen ber-id**. Navigasi memakai tiga "view" yang
disembunyikan/ditampilkan, bukan routing:

| View | id | Isi |
|---|---|---|
| Overview | `view-overview` | Section 1–11 di bawah |
| Screener | `view-screener` | Tabel 963 emiten + `screener-controls` |
| Panduan | `view-about` | 40 sub-bagian metodologi |
| *(tersembunyi)* | `view-sple`, `view-foreign` | Kerangka lama yang masih ada di markup |

### Section tab Overview

| # | Section | id / anchor | Fungsi render | Sumber data |
|---|---|---|---|---|
| — | Ticker berjalan atas | `header-ticker`, `header-ticker-track` | `renderHeaderTicker` | `DATA.overview` |
| 1 | **Coffee Morning** | `cm-headline`, `cm-chips`, `cm-katalis`, `cm-detail`, `cm-date` | `renderCoffeeMorning` | `DATA.coffee_morning` (ditulis manual/AI) |
| 2 | **Konteks Global** | `ov-global-tv` | *(embed)* | Widget TradingView `market-overview` |
| 3 | **Indeks & Komoditas LIVE** | `ov-sparkline-list`, `commodity-fetch-debug` | `renderSparklineList`, `fetchLiveCommodities` | Netlify `commodity-fetch` → **Yahoo Finance** |
| 4 | **Group Konglomerat** | `ov-group-konglomerat` | `renderGroupKonglomerat` | `DATA.groups_konglomerat` + `DATA.records` |
| 5 | **News & Konteks Pasar** | `ov-news-panel`, `ov-news-items`, `ov-news-meta` | `renderNews` | `DATA.news` (snapshot IDX) |
| 5b | **Live News** | `kb-live-items` | `loadLiveNews`, `fetchRSSNews` | Netlify `news-fetch` + `rss-fetch` → 12 portal |
| 6 | **Chart IHSG** | `ov-ihsg-chart` | *(embed)* | Widget TradingView `advanced-chart` |
| 6b | **Heatmap IDX** | `ov-heatmap-tv` | *(embed)* | Widget TradingView `stock-heatmap` |
| 6c | **Heatmap custom** | `ov-heatmap-custom` | `renderHeatmap` | `DATA.records` |
| 6d | **Market Breadth** | `ov-breadth`, `ov-breadth-labels` | `renderOverview` | `DATA.records` |
| 7 | **Signal** | `sple-grid`, `sple-meta` | `renderSPLE`, `renderFastPicks` | `DATA.sple.picks`, `DATA.fast_picks` |
| 7b | **Proyeksi Probabilistik (GBM)** | `prob-cone-container`, `prob-cone-tf-selector` | `renderProbCone` | `DATA.fast_picks` + `DATA.records` (`mc_mu_daily`, `mc_sigma_daily`) |
| 7c | **Divergence Radar** | `div-radar-panel` | `renderDivergenceRadar` | `DATA.records` |
| 8 | **Foreign Flow** | `foreign-accum`, `foreign-distrib` | `renderForeign` | `DATA.records` (fnet 1D/5D/10D) |
| 9 | **Top Today** | `ov-movers` | `renderOverview` | `DATA.records` |
| 10 | **Aktivitas Broker** | `ov-broker-activity` | `renderOverview` + `fetchBrokerMarket` | `DATA.broker_activity` · Netlify `broker-market` → **IDX API** |
| 11 | **Performa Sektor** | `ov-sector-perf` | `renderOverview` | `DATA.overview` |
| — | **Watchlist** | `watchlist-items` | `renderWatchlist`, `loadWatchlist` | `DATA.records` + localStorage |
| — | **Kalkulator** | `calc-overlay`, `calc-result`, `calc-stock` | `initUCalc` | `DATA.records` |
| — | **Simulasi Portofolio** | `psim-wrap`, `psim-rows`, `psim-summary`, `psim-pick-btns` | `initPSim`, `renderPSimRows` | `DATA.fast_picks` |
| — | **ASK SPLE** | `ask-sple-overlay`, `ask-sple-messages`, `ask-sple-hero`, `ask-sple-ctx`, `sple-passcode-gate` | `loadChatHistory`, `callAI` | Netlify `ai-news` → **Claude Haiku 4.5** · `validate-passcode` |
| — | **Cari global** | `global-search`, `global-results` | `initGlobalSearch` | `DATA.records`, `DATA.fast_picks` |
| — | **Meta kepala** | `meta-date`, `meta-csv`, `meta-elig`, `filter-sektor` | `init` | `DATA.meta`, `DATA.sectors`, `DATA.total` |

### Ruas `DATA` dan seberapa sering dipakai

| Ruas | Dipakai | Isi |
|---|---|---|
| `records` | 25× | **963 emiten × 173 ruas** — tulang punggung seluruh halaman |
| `latest_date` | 23× | Tanggal snapshot |
| `overview` | 18× | 44 ruas ringkasan pasar |
| `fast_picks` | 18× | 6 pick cepat |
| `news` | 10× | Butir berita snapshot |
| `broker_activity` | 5× | Top broker + `latest_date` |
| `meta` | 5× | total, eligible, `csv_count`, `code_version`, `float_blacklist` (34 kode) |
| `sple` | 5× | `picks` — kartu Signal |
| `coffee_morning` | 3× | headline, summary, chips, katalis |
| `picks` | 3× | sisa fitur lama |
| `groups_konglomerat` | 1× | 11 grup |
| `sectors`, `total`, `total_eligible` | 1× | Meta |

Tidak dipakai sama sekali di klien: `daily_nf`, `fast_trading`,
`signal_history`, `snapshot_date` — ikut ter-*ship* tapi menganggur.

### Lima widget TradingView

`market-overview` · `advanced-chart` · `stock-heatmap` · **`financials`** ·
**`technical-analysis`** — dua terakhir dipakai di modal detail saham.

### localStorage

`sple_claude_key` (API key, hanya mode lokal) · `sple_chat_ver` ·
`sple_news_cache`.

---

## sple-mf — peta lengkap

Satu emiten per tampilan, dipilih lewat `search` → `results`. Semua id
memakai awalan yang menandai bagiannya:

| # | Section | Awalan id | Fungsi render | Sumber |
|---|---|---|---|---|
| — | Kepala emiten | `h_code`, `h_price`, `h_chg`, `h_name`, `h_sector`, `h_subsector`, `h_ipo`, `h_mc`, `h_tier`, `h_vq` | `loadStock` | `DATA.rows` |
| — | Verdict valuasi kepala | `v_per`, `v_pbv`, `v_peg` | `loadStock` | kolom `per_frem`, `pbv_frem`, `peg_frem` |
| 01 | **Trading Activity** | `tr_vol`, `tr_val`, `tr_frek`, `tr_listed` | `renderTrading` | `tr_*` |
| 01b | **Foreign Flow reguler** | `tr_fbuy`, `tr_fsell`, `tr_fnet`, `tr_foreign_tag` + `_bar` | `renderTrading` | `tr_fbuy`, `tr_fsell`, `tr_fnet` |
| 01c | **Bandar Flow — pasar NEGO** | `tr_nvol`, `tr_nratio`, `tr_nval`, `tr_nfreq`, `tr_navg`, `tr_nego_tag` | `renderTrading` | `tr_nrvol`, `tr_nrval`, `tr_nrfreq` |
| 02 | **The Money Flow** (5 langkah) | `k_sa`, `k_np`, `k_eps`, `k_cfo`, `k_dps` (+ `_t`) | `loadStock` | `sa`, `np_az`, `eps_az`, `cfo`, `dps_l` |
| 03 | **Income Trajectory** | `chartAnnual` | `buildAnnualChart` | Chart.js dari kolom tahunan |
| 04 | **Quarterly Pulse** | `chartQuarter`, `qgRecent` | `buildQuarterChart`, `buildQuarterCells` | 16 kuartal `23Q1–26Q4` |
| 04b | Bar margin | `marginBars` | `buildMarginBars` | `gpm_a`, `opm_a`, `npm_a` |
| 05 | **Quality of Earnings** | `q_roe`, `q_roe10`, `q_der`, `q_dy` (+ `_meta`) | `loadStock` | `roe5y`, `roe10y`, `der5y`, `dy5y` |
| 06 | **Valuation Verdict** | `t_per`, `t_per5`, `t_perf`, `t_perv`, `t_pbv`, `t_pbv5`, `t_pbvf`, `t_pbvv` | `loadStock` | `per_l/per5y/per_ftgt/per_frem`, `pbv_*` |
| 07 | **Financial Reports** (5 tab) | `frChartIS`+`frTableIS` · `BS` · `CF` · `RK` · `RV` | `frBuildIS/BS/CF/RK/RV` | Kolom laporan 2021–2025 |
| 08 | **AI Analysis** | `ai_score`, `ai_pillars`, `ai_rec_box`, `ai_rec_tag`, `ai_rec_text`, `ai_strengths`, `ai_risks` | `renderAI` | **Rule-engine lokal**, bukan LLM |
| 09 | **Glossary** | *(statis)* | — | 20 istilah |
| — | **Compare** | `comparePanel`, `compareTable`, `cmpPickA/B`, `winnerBanner`, `winnerTag` | `renderCompare`, `pickCompareStock` | `DATA.rows` |
| — | **Export** | `capture`, `__export_override__` | `exportPDF`, `exportPNG`, `shareImage` | html2canvas + jsPDF |
| — | **ASK-SPLE** | `askBtn`, `askPanel`, `askBackdrop`, `askMsgs`, `askInput`, `askLock`, `askPass`, `askUnlock`, `askCtxBar` | `openModal`, `send`, `doUnlock` | Netlify `ask` → **Claude** |
| — | Toast & tanggal | `toast`, `lu_date` | `showToast`, `marketCtx` | — |

**Data**: satu objek `DATA` = `schema` (75 kolom) + `rows` (**978 emiten**),
bentuk kolom-baris sehingga jauh lebih padat daripada sple-info.

**Fungsi Netlify**: hanya satu — `ask`. Semua data lain ditanam.

---

## Ringkasan sumber — siapa memberi apa

| Sumber | Dipakai di | Cara masuk |
|---|---|---|
| **IDX Daily Statistics** (CSV) | Hampir semua angka sple-info | Diolah luring, ditanam ke `DATA.records` |
| **IDX API** (live) | Aktivitas Broker | Netlify `broker-data`, `broker-market` — **403 dari IP datacenter** |
| **RDFE** (Excel berbayar, Jothamrin) | Seluruh fundamental sple-mf + PER/PBV/ROE sple-info | Diolah luring; jejaknya `_rdfe_asof: "… col15/367/379/450/470"` — sheet `Data` RDFE Plus memang **525 kolom** |
| **Yahoo Finance** | 13 ticker global & komoditas | Netlify `commodity-fetch` |
| **TradingView** | 5 widget | Embed langsung |
| **12 portal berita** | Live News | Netlify `news-fetch`, `rss-fetch` |
| **Anthropic Claude Haiku 4.5** | ASK SPLE, Daily Briefing, Insight per kartu | Netlify `ai-news` (info) / `ask` (mf) |

---

## Yang baru ketahuan di penelusuran ini

1. **Proyeksi Probabilistik (GBM)** — `renderProbCone` memakai `mc_mu_daily`,
   `mc_sigma_daily`, `mc_n_obs` per emiten. Simulasi Monte Carlo geometric
   Brownian motion untuk kerucut proyeksi harga. Belum tercatat sebelumnya.
2. **Divergence Radar** — `renderDivergenceRadar`, panel tersendiri dari
   `DATA.records`.
3. **Simulasi Portofolio** — `initPSim`/`renderPSimRows`, menambahkan pick ke
   portofolio maya dengan risiko per trade.
4. **Watchlist** tersimpan di peramban.
5. **Dua widget TradingView tambahan**: `financials` dan `technical-analysis`
   di modal detail — jadi lima, bukan tiga seperti catatan awal.
6. **Empat ruas data ikut dikirim tapi tak dipakai**: `daily_nf`,
   `fast_trading`, `signal_history`, `snapshot_date`.
7. **sple-mf hanya punya satu Netlify Function** (`ask`) — sisanya statis
   penuh.
