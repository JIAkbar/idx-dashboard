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

## 2c · Uji fungsi NON-PREMIUM satu per satu (23 Agu 2026)

Johan: *"tolong demi apapun fungsi-fungsinya yang non premium dicoba semua"*.
Dijalankan sebagai tamu (tanpa login) di `/app/layout/k6xwggvgr/BUMI`, tiap
masukan diberi jeda dan hasilnya diverifikasi dari layar/API — bukan ditebak.

| Fungsi | Hasil sebagai tamu | Bukti |
|---|---|---|
| Timeframe **1H · 4H** | **BEKERJA** | grafik footprint terisi penuh di kedua TF |
| Timeframe **1m · 5m · 15m** | **TERKUNCI** — klik langsung melempar ke layar login Google | API menjawab `Only 1H and 4H timeframes are available on guest and regular plans` (jadi akun gratis pun tak dapat) |
| Rentang tanggal | **3 hari terakhir saja** | `GET /api/market/dates/BUMI` → `["2026-08-21","2026-08-20","2026-08-19"]` |
| **Area breakdown** (drag persegi) | **BEKERJA PENUH — ini yang paling berharga** | lihat rincian di bawah |
| **Replay** | **BEKERJA di 1H**, mati di 4H | tombol berlabel `Replay is not supported on 4H timeframe` saat TF 4H, aktif setelah pindah ke 1H |
| **Workspace layouts** | **BEKERJA** — SINGLE · SPLIT-V · SPLIT-H · QUAD, jumlah pane ±, Saved Layouts (New/duplikat/rename/hapus) | panel terbuka & dapat diubah |
| **Indicators** (7) | panel terbuka; sebagian tampilan lanjutan memunculkan gembok **UNLOCK PREMIUM** di kanvas | Market profile (Volume/Delta/TPO × Visible/Daily/Weekly/Monthly + Advanced tuning), Broker volume bubbles, Aggression bubbles, Volume imbalance, Volume, CVD, VWAP |
| **Broker Insight** (MAKER/TAKER) | tampil, tapi kosong sampai bubble aktif — "BUMI · 0 bubble signals" | dengan bubbles aktif terisi (mis. "27 bubble signals", daftar nilai per broker) |
| Alat gambar (9) | **BEKERJA** | Crosshair · Trend line · Fib · Long/Short Position · Rectangle · Text · Market Profile · Measure · Delete |
| Cari ticker, favorit, sidebar, Discord | **BEKERJA** | — |

### Area breakdown — isi sebenarnya (BUMI, rentang harga 190–199)

Satu tarikan persegi menghasilkan **empat kuadran maker/taker per broker**,
lengkap dengan bendera `[D]`omestik / `[F]`oreign:

| Kuadran | Contoh baris |
|---|---|
| **AGG BUYERS** +2,99m | `CC [F] +719.401` · `XL [D] +475.110` · `AK [F] +200.000` · `XC [D] +172.363` (+40 broker lain) |
| **PASSIVE SELLERS** | `XC [D] −409.649` · `YU [D] −311.688` · `XL [D] −264.864` · `GR [D] −253.040` (+41 lain) |
| **PASSIVE BUYERS** | `MG [D] +262.133` · `XL [D] +210.461` · `CP [D] +184.461` (+33 lain) |
| **AGG SELLERS** +1,29m | `CC [F] −847.462` · `AZ [D] −172.594` · `ZP [D] −100.650` (+19 lain) |
| **NET BROKER** | Buy `XL [D] +336.374`, Sell `YU [D] −264.394` |

Inilah pembeda whales dari semua sumber lain yang kita punya: broker summary
EOD kita hanya tahu **beli** dan **jual** per broker; whales memisahkan
**siapa yang menyerang (taker)** dari **siapa yang menampung (maker)** di tiap
sisi. Satu broker bisa muncul di dua kuadran sekaligus — `XL [D]` di atas
tercatat sebagai agresif-beli, pasif-jual, **dan** pasif-beli dalam rentang
yang sama, sesuatu yang mustahil terbaca dari data harian.

Dan semuanya **gratis** — batasnya bukan fitur, melainkan **3 hari terakhir**.

### Konsekuensi untuk kita

Kalau data ini ingin dimiliki, satu-satunya jalan adalah **memanennya setiap
hari** — tidak ada arsip yang bisa ditarik mundur. Tiga hari ke belakang itu
seluruh sejarah yang tersedia, kapan pun kita mulai. Menunda sebulan berarti
kehilangan sebulan secara permanen, berbeda dengan broker EOD Stockbit yang
bisa di-backfill sampai 2017.

---

## 6 · Pembaruan 28 Agu 2026 — footprint-as-candle, tooltip agresor per broker, dan penyedotan Stockbit (audit Fable atas 5 screenshot Johan)

### 6a · Footprint tampil sebagai KOLOM KEDUA di slot waktu yang sama (bukan overlay)
Terkonfirmasi dari zoom in vs zoom out: tiap slot waktu memuat DUA kolom bersebelahan — candle harga (kiri) + kolom footprint heatmap (kanan) yang sel-selnya berwarna imbalance dan berlabel `volBeli volJual` per tingkat harga. Saat `barSpacing` sempit, kolom footprint menyusut/hilang dan hanya candle tampil; saat diperlebar, kolom footprint muncul. **Ini teknik render yang BISA kita tiru untuk footprint HARIAN** (satu hari = candle + kolom sel broker-per-harga), tanpa butuh feed intraday — tepat yang sudah dibangun di Whales Papan W7, tinggal disempurnakan jadi kolom-kedua bukan overlay.

### 6b · Tooltip "GROSS BROKER BREAKDOWN" = broker per bar DENGAN SISI AGRESOR + tag F/D
Hover satu bar memunculkan empat kuadran: **Aggressive Buyers · Passive Sellers · Passive Buyers · Aggressive Sellers**, tiap baris = kode broker + tag `[F]`/`[D]` (Foreign/Domestic) + nilai net. "Aggressive" = HAKA (hit the ask), "Passive" = antre di bid/offer. **Ini konfirmasi telak**: hulunya feed transaksi tick-level yang membawa (a) kode broker, (b) sisi agresor, (c) klasifikasi F/D — persis yang audit §4 sebut "tak ada di endpoint EOD". Data broker EOD kita (marketdetectors GROSS) punya (a) dan (c) tapi TIDAK (b) — kita tak pernah tahu siapa yang menyerang harga. Batas ini NYATA dan tetap: footprint harian kita jujur menyebut "bukan HAKA/HAKI" (sudah tertulis di metodologi Whales Papan).

### 6c · ⚠️ KEAMANAN — whales.id menyedot data real-time Stockbit penuh (jawaban "ngeri"-nya Johan)
Symbol Search whales.id menampilkan kolom **Value · Volume · Vol MA20 · Strong Bid · Strong Offer** untuk ~900 emiten, plus tab **"Stockbit Lev"** dan **"Support Screener"** — dan tag `[F]`/`[D]` per broker. Ini BUKAN data yang bisa dirakit dari IDX EOD publik; "Stockbit Lev" (margin/leverage Stockbit) dan Strong Bid/Offer real-time hanya ada di balik **akun Stockbit**. Kesimpulan: whales.id kemungkinan besar **memakai kredensial/token Stockbit** (satu akun layanan, atau menumpang sesi) untuk menyedot feed real-time + broker tick, lalu menyajikannya ulang ke pelanggannya. Ini pola yang SAMA dengan temuan gedanggoreng (P10): pihak ketiga membangun produk di atas token Stockbit orang.

**Implikasi untuk PAPAN — tiga garis tegas:**
1. **Yang mereka bisa, kita TIDAK bisa tiru dari EOD** — sisi agresor (HAKA/HAKI) mustahil tanpa feed tick. Jangan pernah mengarang kolom "agresif/pasif"; footprint harian kita tetap GROSS (sudah benar).
2. **Cara mereka mendapatkannya = risiko yang kita tolak** — menyedot feed real-time Stockbit untuk melayani publik = menaruh akun Stockbit sebagai umpan blokir. Proxy live akun-kedua kita (B48) SENGAJA dibatasi: cuma harga penutupan berjalan (chartbit daily), cache CDN, degradasi ke arsip — BUKAN feed tick/broker/orderbook. Batas ini disengaja, jangan diperlebar meniru whales tanpa keputusan Johan eksplisit + akun yang memang direlakan.
3. **Nilai audit ini bukan "tiru mereka" tapi "tahu batas kita"** — replikasi 100% mustahil dari bahan baku kita; yang layak sudah dibangun (footprint harian, kategori perilaku broker, quadrant, konsensus). Yang membedakan PAPAN: angka kita bisa ditelusuri ke sumber resmi, mereka ke feed pihak ketiga yang bisa mati/diblokir kapan saja.

### 6d · Canvas "100% TradingView" — bukan misteri
whales.id memakai **lightweight-charts** (pustaka open-source TradingView yang SAMA dengan yang PAPAN pakai) + custom pane primitives untuk footprint/heatmap. "100% mirip TradingView" karena memang library TradingView. Kita sudah di jalur yang sama (Whales Papan, Grafik Emiten pakai lightweight-charts + primitives). Tak ada teknologi rahasia; pembedanya cuma feed hulu (mereka tick real-time, kita EOD).

---

## 7 · Audit LANGSUNG 28 Agu 2026 (buka situsnya, baca jaringannya) — MENGOREKSI §6

§6 ditulis dari screenshot = inferensi. Johan menyuruh "audit beneran". Situsnya dibuka, tab Network dibaca, endpoint dipanggil sendiri **tanpa login**. Dua klaim §6 GUGUR, dan struktur datanya terbongkar penuh.

### 7a · KOREKSI §6d — mereka pakai TradingView Charting Library ASLI, bukan lightweight-charts
Bukti: `<script src=".../charting_library.standalone.js">`, `window.TradingView` + `window.tradingview_e904a` ada, chart dirender **di dalam iframe**, dan **nol elemen `<canvas>` di dokumen induk**. Endpoint datanya pun berbentuk **UDF datafeed TradingView**: `GET /api/market/history/<KODE>?resolution=60&from=…&to=…&countBack=301`.

Artinya "100% mirip TradingView" bukan karena mereka pintar meniru — **itu memang produk TradingView** (Charting Library, gratis dengan perjanjian lisensi + atribusi). PAPAN memakai **lightweight-charts** (adik kecilnya): lebih ringan, tanpa perjanjian, tapi memang tak punya toolbar/indikator bawaan sebanyak itu. Kalau suatu hari PAPAN mau "rasa TradingView penuh", jalannya adalah mendaftar Charting Library — keputusan produk, bukan pekerjaan meniru piksel.

### 7b · KOREKSI §6c — tuduhan "menyedot feed real-time Stockbit" TIDAK TERBUKTI
Yang nyata: `GET /api/market/stockbit-leveraged-stocks` → ~120 emiten `{t, tv, v, p, m}` dengan `m` = **multiplier margin 2x–5x**. Itu **daftar saham margin Stockbit** — informasi yang Stockbit terbitkan sendiri dan bisa disalin harian; bukan feed harga real-time, bukan orderbook, bukan data akun. Badge "4x/3x" di Symbol Search itu isinya.

Kolom Value/Volume/VolMA20 di Symbol Search datang dari endpoint mereka sendiri `GET /api/market/market-screener` (`{t,v,vm,rvm,rv,p,d,w}`) — agregat harian yang setara dengan yang PAPAN hitung dari arsip sendiri. **Jadi §6c kutarik**: tak ada bukti penyedotan kredensial Stockbit. Yang tersisa hanyalah pertanyaan sah "dari mana feed tick-nya" (7c) — dan itu tak menuduh siapa pun.

### 7c · Struktur data footprint — terbongkar penuh (ini yang berharga)
`/api/market/history/<KODE>` mengembalikan `{rtData:{candles[], brokerCodes[]}, obData[]}`:
- `candles[i]` = `{ts, o, h, l, c, v, cells[]}`
- `cells[j]` = `[harga, ringkasA, ringkasB, [[idxBroker, 8 angka], …]]` — sel per TINGKAT HARGA
- `brokerCodes` = **73 entri berformat `"AK [F]"`, `"AG [D]"`** — kode broker + tag Foreign/Domestic
- **8 angka per broker terpecahkan lewat penjumlahan kolom** (uji nyata BUMI, sel harga 191): kolom 0 dan 3 sama-sama 167.808, kolom 4 dan 7 sama-sama 769 → bentuknya `[volAgresifBeli, volPasifBeli, volAgresifJual, volPasifJual, freq×4]`. Pasangan kolom 0↔3 identik karena **tiap transaksi punya dua sisi**: yang menyerang membeli, lawannya pasif menjual.
- `obData[]` = snapshot orderbook, **payload terkompres zlib** (`"eJw…"` base64).

Artinya feed hulu mereka **tick-by-tick dengan kode broker + sisi agresor + orderbook**. Kesimpulan §4/§5 audit lama BERTAHAN: mustahil dirakit dari EOD kita. Bedanya, sekarang kita tahu persis bentuknya, bukan menduga.

### 7d · Yang layak diambil untuk PAPAN (dari audit langsung, bukan tebakan)
1. **Bentuk penyajian footprint** (kolom sel per tingkat harga di samping candle) — sudah ada di Whales Papan W7; yang bisa ditiru tinggal tata letaknya (kolom kedua saat lebar cukup).
2. **Kejujuran tag [F]/[D] per broker** — kita punya bahannya (arsip broker 12 varian termasuk asing), belum dipajang sebagai tag di footprint. Ini bisa.
3. **Yang TIDAK bisa & tak boleh dikarang**: kolom agresif/pasif. Data EOD kita tak punya sisi agresor. Footprint PAPAN wajib tetap menyebut GROSS.
4. **Pelajaran metode**: audit dari screenshot menghasilkan dua klaim salah (library & tuduhan kredensial). Situs yang bisa dibuka **harus dibuka** sebelum kesimpulannya ditulis.
