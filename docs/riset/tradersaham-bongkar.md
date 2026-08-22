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
