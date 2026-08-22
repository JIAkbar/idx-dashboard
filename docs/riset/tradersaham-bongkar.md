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

## Sumber datanya — dan ini intinya

Kata kunci yang muncul di kode: **KSEI** ("Monthly KSEI Shareholders Data",
"KSEI/IDX disclosure", "Ultimate Beneficial…"), `balancepos` (posisi saldo
KSEI), `one-percent` (pemegang ≥1%), `disclosures`. Tak ada RTI, tak ada
Stockbit, tak ada broker summary per emiten: `BroksumPage` hanya berisi
`BrokerFlowTeaser` + "Learn More" — **fitur broker summary di situ masih
teaser**, dan "Broker Flow / kategori broker" adalah klasifikasi yang diatur
pengguna (`/user/broker-categories/customize-default`).

Jadi produk intinya **kepemilikan** (KSEI bulanan, pemegang ≥1%/≥5%,
jaringan investor, MSCI candidate), bukan arus broker harian. Tiga tangkapan
layar di `docs/desain-broker-summary.md` (dengan broker per hari dan Smart
Money/Whale) **bukan dari situs ini** — sumbernya aplikasi lain.

## Yang bisa dipetik untuk PAPAN

- Data KSEI bulanan + pemegang ≥1% adalah lapis yang **belum kita punya**
  dan tak ada di Stockbit `marketdetectors`. Kalau mau ditiru, sumbernya
  laporan bulanan KSEI/IDX, bukan API mereka.
- Klasifikasi broker yang bisa diubah pengguna (default + kustom) — pola
  yang cocok untuk "Smart Money / Whale / Retail" di desain broker kita.
- "Static Backend (Read-Only)" = data dipra-hitung, bukan dihitung saat
  diminta — sama dengan pola JSON statis kita.
