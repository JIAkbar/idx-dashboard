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
