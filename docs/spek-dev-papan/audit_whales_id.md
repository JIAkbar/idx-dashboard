Dari sesi AI Skill (Fable), 26 Agu 2026 — **AUDIT LENGKAP whales.id** (web #1 dari 3 yang diminta Johan). Metode: chrome-devtools langsung oleh Fable di main loop (bukan agent — kerja ambigu), klik/urai semua fitur + bongkar API network + decode payload. Akun: TANPA login (gratis anonim). Yang tidak bisa diaudit ditandai jujur. Pelengkap: 6 tangkapan layar Johan (25 Agu) untuk fitur yang butuh input asli (drag).

# Identitas

- **URL**: `whales.id` — "Bid Offer History and Footprint Analysis". App chart footprint + bandarmology intraday IDX, gaya Bookmap/exocharts.
- **Konsep inti**: chart candle per jam yang tiap candle-nya dibedah per LEVEL HARGA per BROKER (agresif/pasif), di atas latar **heatmap likuiditas orderbook** historis.
- Login Google (Supabase OAuth `jhmdjenpxhzxczcciuhv.supabase.co`). Tiga tier: **anonim/gratis**, **regular** (login), **premium**.

# Arsitektur data (dibongkar dari network + decode)

| Endpoint | Isi |
|---|---|
| `GET /api/market/dates/<KODE>` | daftar tanggal tersedia — **anonim hanya 3 hari bursa terakhir** (2026-08-20/21/24) |
| `GET /api/market/history/<KODE>?date=YYYY-MM-DD&interval=1H` | `{rtData, obData}` per hari |
| `GET /api/market/market-screener` | 979 emiten `{t, v(value), vm, rvm, rv(rel vol), p(price), d(1D%), w(1W%)}` — isi pencarian ticker |
| `GET /api/market/tickers` | daftar ticker |
| `GET /api/market/stockbit-leveraged-stocks` · `ajaib-leveraged-stocks` | daftar saham margin (badge di UI) |
| `GET /api/market/public/server-outages` | jendela outage `{start_time, end_time, message}` → penanda ⚠ di sumbu waktu chart |
| `GET /api/market/public/system-announcement` | pengumuman |

**`rtData.candles[]`** (per bar 1H): `{ts, o, h, l, c, v, cells[]}`. **`cells[]`** = per level harga dalam bar: `[harga, totalJual, totalBeli, brokerRows[]]`; tiap brokerRow **9 angka**: `[idxBroker, aggBuy, passBuy, aggSell, passSell, fAggBuy, fPassBuy, fAggSell, fPassSell]` (4 volume + 4 frekuensi; pemetaan pasangan diinferensi dari contoh `[1, 87,0,0,500, 2,0,0,1]` = beli agresif 87 lawan jual pasif 500 — konsisten dengan popup 4 kuadran). `rtData.brokerCodes[]` = 92 kode `"XX [D|F]"` (indeks brokerRow menunjuk ke sini).

**`obData[]`** = snapshot orderbook per jam: `{ts, s, sts, data}` — `data` = **zlib/deflate base64**; hasil decode = baris `harga;frek;volume` per level (mis. `198;92;8726900|197;836;69995600|…`). Inilah sumber: (a) heatmap latar (likuiditas antrian per level per waktu), (b) ladder kanan (kolom frek · volume · harga), (c) fitur Replay premium ("step through orderbook activity").

**Asal data mentah** (inferensi): running trade + orderbook IDX dengan identitas broker per transaksi — kelas data yang TIDAK tersedia publik gratis; whales.id merekamnya live lalu menjualnya sebagai riwayat.

# Anatomi UI

**Header**: cari ticker (dropdown dari screener, badge saham margin) · favorit ⭐ · TF `1m 5m 15m 1H 4H` · Indicators (badge jumlah aktif) · Area breakdown · Replay · Discord · layouts workspace · settings workspace · toggle sidebar · Sign in.

**Toolbar kiri (drawing)**: Crosshair · Trend line (+varian) · Fib Retracement · Long Position (+varian risk) · Rectangle (+varian) · Text · Market Profile (drawing) · Measure · Delete drawings (+menu).

**Kanvas utama**: candlestick + footprint text per sel (jual|beli per level) + heatmap orderbook di latar + overlay indikator. **Ladder kanan**: frek · volume · harga per level, baris harga terakhir disorot. **Pane bawah**: volume bar + MA20 + penanda ⚠ outage. Sumbu waktu: label tanggal/jam, crosshair memunculkan label waktu.

**Sidebar kanan** (muncul saat aktif): BROKER INSIGHT (jumlah "bubble signals", tab MAKER/TAKER, daftar broker ber-rank dengan chip sinyal ±lot yang **bisa diklik → chart lompat ke bubble-nya** — diverifikasi jalan), panel AREA BREAKDOWN (hasil drag).

# Fitur per fitur (semua toggle diklik nyata)

**7 indikator** (panel per-pane, tiap indikator punya switch + panel setting + ADVANCED TUNING):

| Indikator | Deskripsi resmi | Setting |
|---|---|---|
| Market profile | "Visible or daily market profile from volume, delta, or TPO by price level" | MODE: Volume / Delta ("HAKA − HAKI pressure") / TPO · RANGE: Visible / Daily / Weekly / Monthly |
| Broker volume bubbles | "Broker-specific large volume bubbles with broker average lines" | OUTLIER THRESHOLD slider **1–4 z** (default 2.5) · search broker · daftar **108 broker** `XX [D/F]` multi-select (urut aktivitas) · STYLE Outline/Fill · warna Buy `#a3d94a` / Sell `#ff8a3d` |
| Aggression bubbles | "Diagonal HAKA/HAKI net aggression bubbles, filtered by z-score" | AGG BUBBLE FILTER slider (z, default 1.00) |
| Volume imbalance (default ON) | "Highlights footprint bid/ask text when diagonal volume is at least the configured multiple" | MINIMUM RATIO (default 3.00×) · toggle "Stacked imbalance zones — extend 3+ consecutive imbalances to the right until price revisits the stack" |
| Volume | bar volume di bawah, warna ikut candle | MA PERIOD (default 20) |
| CVD | "Cumulative volume delta panel" | ANCHOR: Bar / 1D / 1W / 1M / All |
| VWAP | "Anchored VWAP from running-trade footprint volume" | ANCHOR: 1D / 1W / 1M / All · toggle standard-deviation bands |

**Bubble broker di chart** (klik → popup **GROSS BROKER BREAKDOWN**, diverifikasi live): 4 kuadran — Aggressive Buyers (+total) · Passive Sellers · Passive Buyers · Aggressive Sellers (−total), per broker ±lot, "+N OTHER BROKERS", footer `21 AUG 2026, 09:00 · TF 1H`. Bubble juga menggambar **garis rata-rata broker** (dashed) berlabel `XC [D] AVG BUY 54%` / `AVG SELL 46%` — level harga rata-rata beli/jual broker terpilih + porsi sisi.

**Area breakdown** (tombol → tooltip "Drag a rectangle on the active chart to inspect broker volume"; hasil dari tangkapan layar Johan — drag butuh input asli yang tidak bisa disintesis): panel sidebar dengan rentang harga terpilih (mis. `192–194`), GROSS breakdown 4 kuadran per broker, **NET BROKER** (net buy / net sell per broker, `@harga` + `Rp`), setting panel: Display **Lot / Rp** · Broker rows **Significant / Full** · Average price **Show / Hide**. Di TF 4H sel menampilkan nilai Rp per sel.

**Workspace settings** (4 tab):
- Appearance: tema **Dark/Light** · heatmap palette Default/Custom · **liquidity threshold 5%** (ambang heat).
- Orderbook: frequency color · floating order queue **Show / %Top15 / Hide** ("only while market open").
- Footprint: Show/Hide · type **HAKI|HAKA / Volume / Delta / Delta|Vol** · numbers Show/Hide · advanced tuning.
- Tooltip: detail mode **Price level / Candle summary** · broker rows **Significant / Full list** · broker sections **GROSS / NET**.

**Workspace layouts**: multi-layout tersimpan (URL `/app/layout/<id>/<KODE>`; layout id orang lain di-redirect ke layout milik sendiri).

**Replay**: 🔒 premium — "step through orderbook activity from any selected point"; **tidak didukung di 4H** (tooltip disabled).

# Gerbang tier (diverifikasi)

| Fitur | Anonim | Regular (login) | Premium |
|---|---|---|---|
| TF 1H, 4H | ✅ | ✅ | ✅ |
| TF 1m/5m/15m | ❌ redirect Google login | ? (tak teruji — tanpa akun) | ✅ |
| Riwayat tanggal | **3 hari bursa** | ? | lebih panjang (jumlah tak teruji) |
| Replay | ❌ | ❌ ("locked for guest and regular") | ✅ |
| Indikator, bubble, area breakdown, settings | ✅ semua | ✅ | ✅ |
| Harga premium | tak terlihat tanpa login (landing SPA tanpa teks statis) | | |

# Bisa/tidaknya PAPAN mereplikasi (kejujuran data)

| Fitur whales.id | Data kita | Verdict |
|---|---|---|
| Footprint per jam per level per broker (agresif/pasif) | ❌ TIDAK ADA — marketdetectors Stockbit = harian, tanpa level harga, tanpa agresif/pasif | **Tidak bisa direplikasi.** Ini nilai jual inti whales.id |
| Heatmap orderbook historis + ladder + replay | ❌ orderbook penuh tidak dipanen (hanya antrean penutupan IDX 1 titik) | Tidak bisa |
| Candle intraday 1H/4H | ✅ agregasi bar 1 menit chartbit (±90 hari server) | Bisa |
| VWAP/CVD/volume-delta intraday | ⚠️ sebagian — bar 1m punya o/h/l/c/vol/freq tapi TANPA sisi beli/jual per transaksi → CVD/delta sejati tidak bisa; VWAP bisa | Sebagian |
| Bubble broker + AVG line + breakdown 4 kuadran | ⚠️ versi HARIAN bisa (broker summary 6 varian GROSS: per broker per hari, `average` per broker ada) — per jam tidak | Versi harian bisa |
| Area breakdown per rentang harga | ❌ butuh data per level harga | Tidak bisa (per rentang TANGGAL bisa) |
| Market screener sidebar (value, RVol, 1D, 1W) | ✅ sudah dispek di Harian Papan | Bisa |
| Outage marker, saham margin badge, favorit, multi-layout | ✅ trivial | Bisa |

**Kesimpulan audit**: whales.id unggul karena SUMBER DATANYA (rekaman running-trade+orderbook per broker), bukan karena UI-nya. Fitur yang layak DITIRU polanya di PAPAN dengan data kita: bubble broker outlier z-score versi harian, garis avg price broker (sudah ada di broksum), 4 kuadran GROSS/NET (kita punya GROSS harian + NET turunan), tooltip Significant/Full, sidebar insight ber-chip yang melompat ke chart, penanda outage/beku. Yang JANGAN dijanjikan: footprint intraday per broker, heatmap orderbook, replay — datanya tidak kita miliki (konsisten batas jujur di `analisa_bidoffer_bandar.md`).

# Batas audit (jujur)

- Tanpa login: fitur regular/premium (1m/5m/15m, riwayat panjang, replay, harga paket) tidak teruji dalam.
- Drag area breakdown tidak bisa disintesis (butuh trusted input); struktur hasilnya diambil dari 6 tangkapan layar Johan + konsistensi API.
- Floating order queue hanya saat pasar buka (audit malam hari).
- Pemetaan 9 angka brokerRow = inferensi kuat dari sampel, belum konfirmasi resmi.
