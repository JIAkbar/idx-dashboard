# tradersaham.com — bongkar pasif (22 Agu 2026)

Johan: *"coba bongkar dia arsitektur apa, domain apa, dll"*. Semua dari luar:
DNS, header HTTP, HTML, dan bundle JS publik. Tak ada login, tak ada
permintaan ke endpoint berbayar.

## Infrastruktur

| Lapis | Temuan |
|---|---|
| Domain & CDN | `tradersaham.com` / `www` → **Cloudflare** (104.21.94.144, `CF-Cache-Status: HIT`, `Server: cloudflare`) |
| Front-end | SPA **Vue 3 + Vite** (`/assets/index-*.js` 813 KB, `vendor-*.js`, `firebase-*.js`; pola `setup()`, `ref()`, `useRouter`) — 52 chunk halaman |
| Grafik | **ApexCharts** (747 rujukan) |
| Auth | **Firebase** (project `tradersaham`, `authDomain tradersaham.firebaseapp.com`), login Google; Firestore ikut dimuat |
| Backend | `https://apiv2.tradersaham.com/api` → CNAME ke **Render** (`gcp-us-west1-1.origin.onrender.com`, `x-render-origin-server: Render`), Node/Express (etag `W/"…"`). `/api/health` menjawab `"service":"IDX Static Backend (Read-Only)"`, `"database":"connected"` |
| Analitik | Google Tag Manager, Cloudflare Insights |
| Monetisasi | Sistem kredit "Rp 1.000 = 1 poin", tier `free`/`Premium`, `/credits/*`, tautan Saweria & Discord |
| robots.txt | Memblokir AhrefsBot, SemrushBot, Bytespider, MJ12bot |

## Endpoint data (dari chunk halaman)

`/one-percent/{holders,history,float-analysis,monthly-changes,network,
investor-portfolio,investor-snapshots,search-*}` · `/shareholders/{changes,
counts/:kode}` · `/balancepos/stock/:kode` · `/stock-analysis/:kode/{vs-index,
foreign-trend}` · `/analytics/{latest-prices,market-rs-trends,screener/gems,
screener/msci-candidates}` · `/ipo/{listings,stats,underwriters}` ·
`/user/broker-categories/*` · `/accumulation/:kode` · `/disclosures` ·
`/stocks/sectors` · `/network/{analyze,details}`.

## KOREKSI (22 Agu malam, dari tangkapan layar Johan yang sudah login)

Kesimpulan awal "broker summary di situ masih teaser" **SALAH**. Bongkar
pasif hanya melihat bundle untuk pengguna tanpa login; halaman **Stock
Profiler** (BETA, Premium) memuat persis tiga layar yang dicatat di
`docs/desain-broker-summary.md`: tabel Broker Summary Net/Gross, Market Flow
(Foreign/Regular/Nego/UW/5%), Broker Flow (Smart Money/Whale/Smart
Retail/Retail), grafik kumulatif per broker vs harga, 6 Month Floor Price, dan
strip Group Score. Yang terbaca dari luar cuma pintu masuknya.

Jadi situs ini punya DUA lapis data: **kepemilikan** (KSEI bulanan, pemegang
≥1%/≥5%, SID & scripless) dan **arus broker harian** — yang kedua tak
kelihatan dari bundle publik, endpoint-nya baru bisa dipetakan dari sesi
login (Network tab, seperti yang dilakukan untuk Stockbit).

## Peta fitur dari menu (tangkapan layar, 22 Agu 2026)

| Grup | Fitur |
|---|---|
| Special Feature | Market Overview · Watchlist · Stock Screener · **Stock Profiler** · Broker Profiler · Holder > 1% |
| Insights | Foreign Flow · IPO Analysis · Informasi Harian |
| Owner | Peta Investor · Holder > 5% · SID & Scripless · Sector Trends |
| Tools & Help | Calculators · What's New |

**Stock Profiler** (contoh AADI, preview; Premium untuk semua saham):
lencana sinyal "Regime Flip → Jual +3" dan "18.5 NONE"; tab **Overview ·
Inventory · Quadrant · Broker Intel · NEGO · vs IHSG · Shareholders ·
Teknikal (NEW) · More**; saringan **Investor** (All/…) · **Market** (All/…) ·
**Periode** (rentang tanggal, bawaan ±1 bulan); kanan: Broker Summary,
Market Flow, Broker Flow (Manage/Details); bawah: 6 Month Floor Price
(Category/Statistics/Reg-All/20-30) dan strip **Group Score** ("+0 Mixed ·
daily Net% strip" dengan kotak skor per kategori +1/−1/+4/+3…).

Backlog replikasi: `docs/antrean.md` **P7**.

## Yang bisa dipetik untuk PAPAN

- Arus broker harian mereka setara dengan yang kini kita panen dari Stockbit
  (langkah 3d) — bahan bakunya sudah ada; yang perlu dibangun tampilannya
  dan klasifikasi brokernya.
- Lapis kepemilikan (KSEI bulanan, pemegang ≥1%/≥5%, SID & scripless) belum
  kita punya dan tak ada di Stockbit `marketdetectors`; sumbernya laporan
  bulanan KSEI/IDX.
- Klasifikasi broker yang bisa diubah pengguna (default + kustom,
  `/user/broker-categories/customize-default`) — pola yang cocok untuk Smart
  Money/Whale/Retail di desain kita.
- "Static Backend (Read-Only)" = data dipra-hitung, bukan dihitung saat
  diminta — sama dengan pola JSON statis PAPAN.

## Pohon Stock Profiler (sesi login Johan, 23 Agu 2026 — preview AADI)

Semua tab dibuka lewat Chrome Johan; halaman lain masih "top highlights"
terkunci (Market Overview: 7D–1Y *lock*) sampai langganan Premium aktif.

- **Kepala**: lencana sinyal ("Regime Flip → Jual +3"), "gem breakdown"
  (💎 18.5), Bantuan, pencarian ticker, saringan **Investor** All/Dom/For,
  **Market** All/Reg/Nego, **Periode** (rentang tanggal; URL `?start&end&tab`).
- **Overview** — kartu: Foreign Flow 3M (net 3 bln, net 20D, mini-chart) ·
  Kepemilikan Ritel (KSEI) % MoM · Jumlah Investor (SID) trend 12 bln ·
  Perubahan Holder >1% bulan ini (naik/baru/keluar, nama) · Aksi pemegang
  ≥5% terakhir (tanggal, nama, lembar) · Perubahan Kategori KSEI (Δ porsi per
  tipe investor, L/A) · **Floor Top Akumulator** (broker, hari akumulasi,
  floor, % vs harga) · Flow Net vs Gross (3 beli/3 jual, %net) · **Broker
  terafiliasi** (UW = underwriter, SH = pemegang KSEI) · NEGO terakhir
  (vol, pola opposite, absorb/distribusi) · Disclosure terakhir · vs IHSG
  3M (RS, β, α) · lalu Broker Summary + Market Flow + Broker Flow.
- **Inventory** — grafik kumulatif broker vs harga (pilih buyers/sellers,
  Val/Vol, garis/lilin) · **6 Month Floor Price by Broker** (tanggal,
  Category, Statistics, Reg/All, 20/30) · **Group Score** strip harian ·
  tabel 50 broker: status (ACCUM ACCUMULATING / ACCUM REDUCING / DIST
  RE-ACCUMULATING / DIST DISTRIBUTING), tanggal mulai & lama akumulasi,
  Avg/Floor, P&L%, Net Lot, Net Val, strip net harian D-10…D0.
- **Quadrant** — "Loading quadrant data…" (tak selesai dimuat di preview).
- **Broker Intel** — klasifikasi: Smart Accumulator · Trapped Buyer · Profit
  Taker · Panic Seller · Accumulation Flip · Distribution Phase · Market
  Maker · Large Player/Institution; tabel per broker: mkt share, avg, net,
  P&L, net 5D, buy%, pola harian 22d, label (AKUMULASI / DISTRIBUSI / AMBIL
  UNTUNG / BALIK BELI / LARGE_PLAYER), nama sekuritas, bendera Asing.
- **NEGO** — NEGO Analytics: total broker/vol/value, pola opposite
  ("Neg Buy → Reg Sell"), per broker: nego vs reguler, hari aktif, rentang.
- **vs IHSG** — rebased, RS trend, beta/korelasi/R²/alpha, return, vol, win
  rate (dari tangkapan layar 22 Agu).
- **Shareholders** — sub-tab: 1% · Komposisi Kepemilikan · Perubahan
  Kategori · Timeline Foreign · Holders & UBO. Total holder >1%, total
  kepemilikan 1%+, **FF di luar 1%**, IDX freefloat reported, MSCI; komposisi
  lokal/asing/unknown; rincian kategori (Corporate-L, Individual-L, Private
  Bank-L, Financial Institutional-A); tabel holder bulanan (Juli→Feb 2026)
  dengan scripless/scrip, est value, perubahan (keluar/baru/naik/turun).
- **Teknikal** — "TradingView powered": R:R setup (target R1, stop S1), pola
  candlestick, volume surge vs 20 hari, return 1D/1W/1M/3M, jarak ke
  R1/S1/TC/BC, **TA + Flow Confluence** skor 0–100 (broker flow × momentum),
  indikator (EMA20/200, RSI, ATR, Stochastic), **Pivot & CPR** (R1–R3,
  TC/P/BC, S1–S3, lebar band, posisi harga, relasi vs sesi lalu), Daily/
  Weekly, multi-timeframe (butuh ≥11 minggu data).
- **More** — tidak membuka apa-apa di preview.

Endpoint yang tertangkap: `apiv2.tradersaham.com/api/market-insight/
broker-profiler/summary?stock_code=AADI&start_date&end_date&investor_type=all&board=R&limit=20`.

**Lanjutan menunggu langganan Johan** — sesudah itu tiap halaman utama
(Market Overview, Watchlist, Screener, Broker Profiler, Holder >1%, Foreign
Flow, IPO, Informasi Harian, Peta Investor, Holder >5%, SID & Scripless,
Sector Trends, Calculators) diturunkan dengan cara yang sama.

# AUDIT PREMIUM — menu per menu (23 Agu 2026, langganan Johan aktif)

Dijalankan lewat Chrome Johan (sesi login berbayar), SOP langkah 2 aturan
"turunkan sampai habis". Semua gembok 7D–1Y hilang; rentang penuh terbuka.

## 1 · Market Overview

- **Market Advance/Decline** — 7D/14D/30D/90D/6M/1Y, vonis (CAUTIOUS),
  advancing vs declining + rata-rata 30D.
- **Net Flow Foreign** 7D…1Y, dengan **catatan jujur**: *"Estimasi saja: net
  flow dihitung dari harga penutupan, bukan transaksi aktual"* — persis
  keterbatasan yang kita catat sendiri (taksiran lembar × harga).
- **Composition Total Value** 7D…1Y.
- **Broker Net Position Heatmap** (pasar reguler) 1D/7D/14D/30D — 20 broker
  teratas dengan penanda FGN, net value periode.
- **7-Day Flow Pattern** — batang beli/jual per hari per broker (20 broker).
- **Relative Strength Trend vs IHSG** — sakelar **Konglo / Sector**,
  7D/14D/30D/90D. Garis per grup konglomerasi: Anthony Salim, Prajogo
  Pangestu, Hartono, Thohir, Widjaja, Astra, Dato Sri Tahir, Bakrie,
  Aguan & Tomy Winata, James Riady. Klik ganda legenda = isolasi vs IHSG.
- **Sector Performance** — ALL / FOREIGN FLOW, TODAY/1W/1M, 11 sektor.
- **Top Movers** — GAINERS/LOSERS/FOREIGN BUY/FOREIGN SELL/MOST ACTIVE.
- **Market Heatmap** + **US Market Heatmap**.

## 2 · Stock Screener (7 mode)

Tab: **Gems** (daily signals) · **Accumulation** (6-month broker
positioning) · **Smart Money** (nampung retail & P&L) · **Foreign** (flow
intensity) · **Ownership** (KSEI monthly) · **MSCI** (index candidates) ·
**vs IHSG** (relative strength). VIEW: Positioning 6mo / Daily Flow 10d.

Baris hasil (910 saham): harga sekarang, **Floor** + jarak %, Net value,
rasio broker naik/turun (mis. "38↑ / 12↓ (3.2x)"), penanda **n/5 TRAPPED**,
lalu 5 broker teratas: FLOOR · PNL · NET LOT · NET VAL · RECENT TREND
(ACCUMULATING/REDUCING) · DAYS.

Filter: **Quick preset** (Solid Accum · Trapped · Deep Loss · Early Bird ·
The Wall · Conviction) · Top 3/5/10 · tren 6 bulan Accum/Dist · pasar
Reg/All · min losing top brokers · min avg loss % · max days since trough ·
min net val/broker · **rasio accum vs dist** (≥1x…≥5x) · Associate
Accumulating · **must include brokers**. Sort: Net Value · Net Lot · Losing
Count · Avg PnL % · Days Since Trough · Accum Dominance.

## 3 · Stock Profiler (9 tab — lihat pohon di bagian sebelumnya)

Tambahan dari sesi premium: lencana "Regime Flip → Jual **+4**" berubah
mengikuti rentang; **Quadrant tetap "Loading quadrant data…"** walau premium
(gagal muat, bukan terkunci). Parameter URL untuk ticker adalah **`?stock=`** (bukan `code=`), bersama
`start`, `end`, `tab` — jadi seluruh keadaan halaman bisa ditautkan.

## 4 · Broker Profiler (7 tab)

**Broker · Broker Intel · Activity · Stats · Pulse · Composition ·
Compare**. Pilih hingga **5 broker**, saringan Investor (All/Domestic/
Foreign) × Market (All/Regular/Nego) × Periode. Isi: **Broker Portfolio
Flow** — Top Buys & Top Sells per emiten (VOL, VAL, AVG, RET %), heatmap,
tombol sticky, load more. Artinya: melihat dari sisi **broker**, bukan
emiten — "MG hari ini menampung BUMI 47,8 M dan melepas DSSA 47,4 M".

## 5 · Holder >1%

Cari emiten · filter **tipe** (Individual/Corporate/Investment Bank/
Securities/Pension Fund/Other) · **asal** (Lokal/Asing) · urut (jumlah
perubahan, persentase, market value Δ, konsentrasi Δ, FF 1%, jumlah holder)
· rentang MIN/MAX % (dua pasang) · Refresh Data.

## 6 · Foreign Flow

Tab **Foreign Radar · Foreign Top · Sector Rotation**, sakelar Value/Volume,
pemilih tanggal, tautan ke Market Overview.

## 7 · Peta Investor

Grafik jaringan: cari **investor, emiten, direksi, anak usaha, UBO**;
zoom in/out, fit, reset. URL berpusat pada simpul (`?center=co_BUMI`).

## 8 · Holder >5% · 9 · Shareholder Data · 10 · Sector Trends

- **Holder >5%**: cari emiten + cari nama pemegang.
- **Shareholder Data**: tab **SID Changes · Scripless Changes · Investor
  Composition · Divergence Analysis**; pilih bulan (Juli/Juni 2026 …),
  cari saham, configure columns.
- **Sector Trends**: 3M/6M/1Y × 11 sektor.

## 11 · IPO Analysis · 12 · Pengumuman · 13 · Watchlist · 14 · Calculators

- **IPO**: tab **IPO Stocks · Underwriters**, cari ticker/penjamin.
- **Pengumuman**: filter **Perubahan Kepemilikan · Dividen · RUPS ·
  Lainnya**, tiap baris menautkan **PDF asli IDX** (`idx.co.id/StaticData/
  NewsAndAnnouncement/…`) — sumbernya IDX, bukan olahan.
- **Watchlist**: tab **Portfolio · Konglo Watchlist**, tambah saham, visible
  columns, **Titan Matrix Analytics**.
- **Calculators**: pencarian tools, **Position Blender** & **Target Price**,
  simpan skenario, salin ringkasan, reset.

## Endpoint tambahan yang tertangkap

`apiv2.tradersaham.com/api/auth/login` (POST) · `/api/market-insight/
broker-profiler/summary?stock_code&start_date&end_date&investor_type&board&limit`.
Sisanya dipanggil dari server (RSC) sehingga tak muncul di tab Network klien.

## Peta ke PAPAN — sesudah audit premium

| Fitur mereka | Bahan baku kita | Catatan |
|---|---|---|
| Heatmap net posisi broker pasar | **ada** (broker harian, tapi baru BUMI; butuh panen semua emiten) | langkah 3d harian menutupnya |
| RS vs IHSG per **grup konglomerasi** | **belum** — butuh pemetaan emiten→konglomerat | Johan pernah menyebut akan memberi data konglomerat (A4, ditutup sementara) |
| Screener Accumulation/Trapped/Floor/PnL per broker | **ada** — floor & PnL bisa diturunkan dari broker harian | definisi floor & "trapped" perlu ditetapkan sendiri |
| Broker Profiler (sisi broker) | **ada** kalau panen harian sudah lintas emiten | belum ada halamannya |
| Holder >1% & SID & scripless | **belum** — LBRPE & SID | KSEI Balancepos kita menutup komposisi, bukan nama holder |
| Peta Investor (jaringan) | **sebagian** — profil IDX punya pemegang, anak usaha, direksi | jaringan/UBO perlu dibangun |
| Pengumuman + PDF IDX | **ada** (panen kabar IDX pengumuman) | tinggal tautan PDF |
| IPO & underwriter | **belum** | ada di profil IDX sebagian (obligasi/KAP), IPO belum |
| Calculators | **ada** (Kalkulator PAPAN) | Position Blender belum |

## VERIFIKASI SILANG — angka tradersaham vs data PAPAN (BUMI, 23 Agu 2026)

Rentang BUMI 3–21 Agu dan 21 Agu kebetulan sudah kita panen sendiri, jadi
angkanya bisa diadu langsung (bukan sekadar "mirip"):

**3–21 Agu (19 hari bursa), net:** LG 118,1 B / 6,6 jt lot / 182 · PD 98,4 B ·
RF 93,9 B · SS 92,8 B · AK 70,9 B; jual CC 206,0 B / 11,3 jt · ZP 145,3 B ·
XL 139,6 B — **identik** dengan mockup `docs/desain/broker-summary-mockup`.

**21 Agu (satu hari), 18 broker teratas dua sisi diukur:**

| Ruas | Median | Min | Maks |
|---|---|---|---|
| Nilai net | **1,0010** | 0,9960 | 1,0067 |
| Lot net | **1,0000** | 0,9859 | 1,0062 |

Selisih yang tersisa murni pembulatan tampilan mereka (TP "1.4M" vs
1.380.272; CC "3.2M" vs 3.167.012).

Artinya rantai sumbernya kini terverifikasi **empat kali**: setoran
kontributor (1.063 baris) ↔ API Stockbit ↔ layar Stockbit ↔ tradersaham
Premium — semuanya bertemu di angka yang sama. Tak ada lagi keraguan soal
kebenaran lapis broker kita; yang membedakan produk tinggal **tampilan dan
turunan analisisnya**, bukan datanya.

Catatan tambahan dari rentang 1 hari: lencana kepala berubah jadi
**"⚡ Block Trade Terdeteksi (3×)"** (di rentang 19 hari: "Regime Flip →
Jual +3"), dan skor 💎 turun 18.5 → 6 — jadi kedua lencana itu dihitung
per rentang, bukan per emiten.
