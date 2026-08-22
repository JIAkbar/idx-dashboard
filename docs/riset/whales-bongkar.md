# whales.id — audit SOP (23 Agu 2026)

Johan: *"whales.id itu lebih menarik untuk chart di page baru bukan di chart
grafik emiten"*. Halaman contoh: `https://whales.id/app/layout/k6xwggvgr/MBMA`
("Bid Offer History and Footprint Analysis"). Dijalankan sesuai
`docs/riset/sop-audit-replikasi.md`, langkah 1–5; langkah 2 dilakukan tanpa
login (tombol *Sign in with Google* ada, tapi grafik & API publiknya terbuka).

## 1 · Infrastruktur

| Lapis | Temuan |
|---|---|
| CDN | Cloudflare (`Server: cloudflare`, RUM aktif) |
| Front-end | **React + Vite** (`/assets/index-*.js` 52 KB, `vendor-react`, `vendor-ui`, `vendor-utils`), IBM Plex / Google Fonts |
| Auth & simpanan pengguna | **Supabase** (`jhmdjenpxhzxczcciuhv.supabase.co`) — login Google, workspace/layout tersimpan per akun |
| Data pasar | REST `https://whales.id/api/market/*` + **WebSocket `wss://ws.whales.id`** (worker real-time; di localhost `ws://localhost:3011`) |
| Komunitas | Discord |

## 2 · Peta fitur (dari UI)

- **Kanvas utama: footprint chart** — tiap lilin dipecah per tingkat harga;
  tiap sel menampilkan volume beli/jual (HAKA/HAKI) dan diwarnai **imbalance**.
  Latar belakang = **heatmap bid/offer history** (kedalaman antrean per harga
  sepanjang waktu). Kanan: orderbook hidup (frekuensi · lot · harga).
- Timeframe **1m · 5m · 15m · 1H · 4H** (intraday; "1D" ada di bundle).
- **Indicators** (per pane): Market profile (mode Volume / Delta = HAKA−HAKI /
  TPO; rentang Visible/Daily/Weekly/Monthly), Broker volume bubbles,
  Aggression bubbles, Volume imbalance (stacked imbalance, ambang), Volume,
  CVD, VWAP (+bands).
- **Area breakdown** — tarik persegi di grafik → sidebar menampilkan
  **volume per broker di dalam area itu**.
- **Replay** — putar ulang dari satu titik waktu.
- **Workspace layouts** — Single / Split-V / Split-H / Quad, hingga beberapa
  pane, simpan/duplikat/ganti nama.
- Alat gambar: crosshair, trend line, fib, long/short position, rectangle,
  text, market profile, measure.
- Pencarian ticker, favorit, sidebar "broker insight / bubble references".

## 3 · Endpoint nyata (tab Network, tanpa login)

| Endpoint | Isi |
|---|---|
| `GET /api/market/tickers` | daftar ±900 kode |
| `GET /api/market/dates/MBMA` | tanggal yang tersedia — **hanya 3 hari terakhir** (19–21 Agu) tanpa login |
| `GET /api/market/history/MBMA?date=2026-08-21&interval=1H` | **inti**: `rtData.candles[]` {ts,o,h,l,c,v,**cells[]**} + `rtData.brokerCodes[]` ("AK [F]", "CC [D]" — kode + bendera asing/domestik) + `obData[]` {ts, s(sisi), data(zlib+base64)} |
| `GET /api/market/market-screener` | ringkasan pasar: t, v, vm, rvm, rv, p, d, w (volume, rata-rata, relatif, harga, perubahan hari/minggu) — dipanggil tiap beberapa detik |
| `GET /api/market/stockbit-leveraged-stocks`, `/ajaib-leveraged-stocks` | daftar saham margin per broker |
| `GET /api/me`, `/api/market/public/{server-outages,system-announcement}` | akun & status |

Bentuk sel footprint: `[harga, volBeli, volJual, [[idxBroker, 8 angka…], …]]`
— per tingkat harga per lilin, **per broker**: lot haka/haki di dua sisi +
frekuensinya. Snapshot orderbook: `harga;frek;lot|…` per sisi, stempel
±detik. Ini **tick-by-tick dengan kode broker dan sisi agresor**.

## 4 · Sumber data hulu

Satu-satunya cara punya sel seperti itu adalah **running trade intraday
berikut kode broker dan sisi penyerang**, plus **orderbook snapshot
berkala** — data yang hanya mengalir dari feed broker/vendor real-time
(IDX langsung atau vendor seperti RTI), bukan dari endpoint EOD mana pun.
Bundle menyebut `stockbit`/`ajaib` hanya untuk daftar saham margin.

## 5 · Peta ke bahan baku kita

| Fitur | Butuh | Kita punya | Status |
|---|---|---|---|
| Footprint per lilin per harga per broker | tick intraday + broker + sisi | **tidak** — semua panen kita EOD | **Mustahil tanpa feed baru** |
| Bid/offer history heatmap | orderbook snapshot berkala | tidak (Stockbit `/orderbook` di balik paywall Pro, dan itu pun snapshot, bukan riwayat) | mustahil tanpa feed |
| Market profile / VWAP / CVD intraday | OHLCV intraday | Stockbit `chartbit/price/intraday` ada tapi param belum terpecahkan; tanpa sisi agresor CVD tak bisa | sebagian, kalau intraday terbuka |
| Area breakdown (volume per broker di persegi) | per broker per waktu | **per hari** kita punya (GROSS Stockbit) | **bisa versi harian**: persegi = rentang tanggal × rentang harga |
| Replay | data historis | harian: ya | bisa versi harian |
| Workspace/layout tersimpan | Supabase | Supabase kita ada | bisa |
| Market screener (vol relatif) | EOD | ya (`kandidat_deepdive`, ringkas.json) | sudah ada padanannya |

## Kesimpulan replikasi

**Replikasi total tidak mungkin** dengan data yang kita miliki — whales.id
dibangun di atas feed intraday tick+broker yang kita tak punya dan tak bisa
dipanen dari endpoint publik mana pun yang sudah kita inventarisasi.

Yang **bisa dan layak** untuk halaman baru: **"footprint harian"** — sumbu
waktu hari, sumbu harga dari OHLC harian, sel = broker GROSS per hari (kita
punya 2017→ untuk BUMI), diwarnai kelompok broker; **area breakdown** versi
rentang tanggal × rentang harga (siapa menampung di harga berapa, minggu
mana); **market profile harian** dari volume per tingkat harga (close/VWAP
harian); replay per hari. Itu bukan tiruan whales — itu alat yang whales
sendiri tak punya karena datanya cuma 3 hari.

Jalur untuk mendekati whales sungguhan: feed intraday. Kandidatnya feed
broker (Stockbit running trade lewat websocket `ws3.stockbit.com`, terlihat
di bundle mereka) — belum diuji, dan itu proyek tersendiri dengan risiko
ToS yang sama seperti token.

## 2b · Pohon kendali (turunan menu, 23 Agu — aturan SOP "sampai habis")

- **Timeframe**: 1m · 5m · 15m → API menjawab `PREMIUM_TIMEFRAME_REQUIRED`
  ("Only 1H and 4H timeframes are available on guest and regular plans");
  **1H · 4H gratis**; `1D` ditolak ("Allowed: 1m, 5m, 15m, 1H, 4H").
- **Indicators** (dialog): Market profile [Mode: Volume · Delta (HAKA−HAKI) ·
  TPO] [Range: Visible · Daily · Weekly · Monthly] [Advanced tuning] ·
  Broker volume bubbles · Aggression bubbles · Volume imbalance (stacked,
  ambang) · Volume · CVD · VWAP (+bands).
- **Area breakdown**: status "Drag a rectangle on the active chart to inspect
  broker volume" → hasil ke sidebar.
- **Replay**: "Start replay from a point" — butuh klik titik di grafik.
- **Workspace layouts**: Single · Split-V · Split-H · Quad; jumlah pane ±;
  saved layouts: New · Duplicate · Rename · Delete.
- **Settings** → *Appearance*: tema Dark/Light, palet heatmap Default/Custom,
  **liquidity threshold** slider 0–90% (bawaan 5%); *Orderbook*: warna
  frekuensi, floating order queue Show / **% Top 15** / Hide (hanya saat
  pasar buka); *Footprint*: Show/Hide, tipe **HAKI|HAKA · Volume · Delta ·
  Delta|Vol**, angka Show/Hide, advanced tuning; *Tooltip*: detail Price
  level / Candle summary, broker rows Significant / Full list, bagian
  GROSS (wajib) + NET.
- **Sidebar**: "Broker insight, bubble references, and area breakdown
  results" — kosong sampai ada aksi.
- **Alat gambar**: Crosshair · Trend line (+varian) · Fib · Long/Short
  position (+varian risiko) · Rectangle (+varian) · Text · Market Profile ·
  Measure · Delete (+menu).
- **Kepala**: cari ticker, favorit, Discord, Sign in with Google.
