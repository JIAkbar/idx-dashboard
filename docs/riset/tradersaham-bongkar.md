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

# AUDIT PREMIUM ULANG — tiap klik diberi jeda (23 Agu 2026)

Johan: *"coba audit lagi karena saya bayar kmu janji harus teliti lagi, coba
beri waktu jeda untuk setiap inputan dan lihat hasilnya"*. Bagian ini
**menggantikan** audit premium pertama, yang cacat metode.

## ⚠️ Dua kesalahan metode yang membatalkan audit sebelumnya

1. **Klik lewat `ref` hanya menyorot tab, tidak memindahkannya.** Tab tampak
   aktif di tangkapan layar tapi URL tak berubah dan isinya tetap tab lama —
   jadi enam mode screener terbaca "isinya sama semua". Yang benar: klik
   dengan **koordinat**. Buktinya URL: tiap mode punya `?tab=` sendiri.
2. **Overlay "Scanning Stocks / CALCULATING SIGNALS…" menahan isi 20+ detik.**
   Pembacaan cepat menangkap DOM lama.

Tanpa dua koreksi itu lahir kesimpulan negatif yang salah — persis yang
dilarang SOP ("tidak dilihat" ≠ "tidak ada").

## Stock Screener — 7 mode, tiap mode halaman berbeda

| Mode | URL | Isi terverifikasi |
|---|---|---|
| **Gems** | `?tab=gems&preset=top` | 963 hasil. Bullish: Top Gems · Silent Accumulation (2) · Associate Broker (55) · Regime Flip (10) · Dual Confirmation (32) · Block Absorption (5) · Oversold Reversal (12). Risiko: Distribution Watch (14) · Overbought + Dist (22). Tier Any/Bronze+(35)/Silver+(50)/Gold+(65)/Diamond(80); Liquidity All/High/Mid/Low/Excl Low; Today/−1D/−2D/−3D. Kolom Gem Score · 3D Trend · Price · RSI-14 · Stoch %K · Regime · Evidence (chip ACC 90% · 5D · FOREIGN BUY · 1 NEW) |
| **Accumulation** | `?tab=accumulation` | Positioning 6mo: kartu emiten (Current · Floor · Net) + tabel broker (Floor · PnL · Net Lot · Net Val · Recent Trend · Days) + badge "5/5 TRAPPED". Preset Solid Accum · Trapped · Deep Loss · Early Bird · The Wall · Conviction; Top 3/5/10; Accum/Dist; Reg/All; Min losing top brokers; Min avg loss %; Max days since trough; Min net val/broker; Accum vs Dist ratio; Associate Accumulating; Must include brokers |
| **Daily Flow** | `?tab=flow_score` | Matriks skor D-9…D0 per emiten (207 saham). Chip Accumulating · Distributing · Regime Change · Accum+Vol≥2x · Breakout ≥5%. Slider Score −100…100, Vol ≥0x, Val ≥5B |
| **Smart Money** | `?tab=smartmoney` | Nampung Retail: 50 saham — Smart Money Net vs Retail Net + Avg & P/L tiap sisi |
| ↳ P&L | `?tab=smartmoney_pl` | 47 saham: SM Net · Avg · Float P/L% |
| **Foreign** | `?tab=foreign` | 338 saham. Akumulasi/Distribusi; preset Semua · Senyap (Small/Mid) · **Terkonfirmasi KSEI** · Akselerasi · Big Money · Divergen; 1D/7D/30D/60D. Kolom Skor · Intensitas · Float% · Konsisten ("12 hari beruntun") · Akselerasi · **KSEI** (✓+0,17 / ⚠−0,75 / ≈+0,02) · Net · Harga% |
| **Ownership** | `?tab=composition` | KSEI bulanan. Dua mode: Klasifikasi Investor (36 type) dan Klasifikasi (8 category + Foreign). Outstanding vs Holdings, sakelar %/# |
| **MSCI** | `?tab=msci` | Standard (9 kandidat) · Small Cap · Near Standard · Near Small Cap · All. Full MCap · Free Float MCap (1% holders) · Free Float % · ATVR 3M · ATVR 12M · Trading Days · FOT 12M · Score · Potential Upside |
| **vs IHSG** | `?tab=relative_strength` | 380 hasil. Stock Ret% · IHSG Ret% · Rel Strength% · Beta · Correlation · R² · Alpha% · Days; 1W/1M/3M/6M/YTD/1Y + Sector Distribution |

Kolom **KSEI** di mode Foreign adalah gagasan terkuat mereka: menyilangkan
aliran asing **harian** dengan perubahan kepemilikan asing **bulanan** KSEI.
✓ = dua sumber sepakat, ⚠ = bertentangan (ERAA: net asing +163,9 M, KSEI −0,75).

## Stock Profiler — 9 tab (`?tab=`)

`(Overview)` · `inventory` · `quadrant` · `broker-position` · `nego` ·
vs IHSG · `major-holders` · `technical` · `flow`. Kendali global Investor ·
Market · Periode; kepala membawa chip sinyal ("Regime Flip → Jual +3") + gem
score.

- **Overview** — Foreign Flow 3M · Kepemilikan Ritel KSEI · Jumlah Investor
  (SID) · Perubahan Holder >1% · Aksi Pemegang ≥5% · Perubahan Kategori KSEI;
  panel kanan Broker Summary (Net/Gross, Val/Lot/Avg) + Market Flow.
- **Inventory** — kumulatif net per broker (4 beli + 4 jual + Add Broker),
  overlay harga, Val/Vol, layar penuh, **6 Month Floor Price**.
- **Quadrant** — X = avg broker vs **VWAP**, Y = Net Value, gelembung = broker;
  kuadran Smart Accum · Aggressive Buy · Panic Selling · Distribution.
- **Broker Intel** — **treemap** per klasifikasi perilaku: Smart Accumulator ·
  Accumulation · Distribution Phase · Large Player/Institution · Profit Taker.
- **NEGO** — All/Opposite/Same Dir; kartu Total Brokers · NEGO Vol · NEGO Value
  · **Opp. Patterns**; per broker: nama, Domestic/Foreign, hari aktif, dan
  **pola silang** `Neg Buy → Reg Sell` + net nego vs net reguler.
- **Shareholders** — sub-tab **1% · Komposisi Kepemilikan · Perubahan Kategori
  · Timeline Foreign · Holder…**; kartu Total Holder >1%, Kepemilikan 1%+,
  FF di luar 1%, IDX Freefloat (Reported) + tautan MSCI; rincian kategori
  (CORPORATE-L 59,2% · INDIVIDUAL-L 14,9% · PRIVATE BANK-L 4,4% ·
  FINANCIAL INSTITUTIONAL-A 1,3%).
- **Teknikal (NEW)** — grafik **TradingView tersemat** + TA + FLOW CONFLUENCE
  (skor gabungan teknikal × broker flow), Indikator Teknikal, Multi-Timeframe,
  Pivot/CPR, Bandarmology.
- **More** → Flow Analysis · Disclosure · MSCI Criteria · Peta Investor ·
  Tur Interaktif.
- **Flow Analysis** — Buy Gross/Net/**%Net** vs Sell Gross per broker +
  "Market Flow Conviction (Daily Trend)". `%Net = Net ÷ Gross` memisahkan
  broker yang menampung dari yang cuma churn.

## Broker Profiler — 5 mode + tab Broker Intel

- **Activity** — Broker Portfolio Flow: arus broker terpilih (maks 5) ke tiap
  emiten, kumulatif; "Top Buys & Sells"; Sticky.
- **Stats** — Total Gross · Total Net · Avg Net Bias · **Directionality
  (|net|/gross)**; grafik Daily Gross/Net/Net Bias; label broker + kategori.
- **Pulse** — **Share of IHSG** · Ranking Gross #9 / Net #21 dari 88 · Trading
  Style · Volume Regime (Z-score harian) · Latest Net Flow; Volume vs IHSG.
- **Composition** — 88 broker, dua sumbu: **BEHAVIOR** (Accumulating ·
  Distributing · Flip→Buy · Flip→Sell · Scalper · Mixed + `conv %`) dan
  **KATEGORI** (Retail · Smart Retail · Whale · Smart Money). Kolom Share IHSG
  (+Δ) · Rank G/N · Regime · Net Bias · Net Periode · sparkline.
- **Compare** — metrik berdampingan ≤5 broker + Akumulasi Net
  kumulatif/harian dengan overlay IHSG.
- **Broker Intel** — Eksplorasi | Konsensus, Accum | Dist; pasangan
  broker×emiten: **Daily Heatmap D-4…D0** · Net Value · **CONS. (5/5)** ·
  Avg Price · Float P/L.

## Insights

- **Foreign Flow** — 3 tab. *Radar*: HEAT (peringkat harian D-4…D0), HARI
  (4/5), Net Foreign, Avg Rank, Return, kartu Streak Tertinggi. *Top*: Top
  Akumulasi/Distribusi, mode Value/Volume. *Sector Rotation*:
  All/Foreign/Local, Net Market Value per sektor. **Ketiganya ditandai "akan
  dipensiunkan"** — pindah ke Screener Foreign dan Market Overview.
- **IPO Analysis** — IPO Stocks · Underwriters. 212 IPO, Rp 121,89 T, Avg 1D
  +17%, Success 1D 80% → 1W 70% → 1M 61% → **Now 49%**.
- **Informasi Harian** — Lainnya · Perubahan Kepemilikan · Dividen · RUPS.
  Keterbukaan informasi IDX **diringkas naratif** + tautan PDF + label jenis.

## Owner

- **Peta Investor** — graf kepemilikan, **6.123 investor × 962 emiten**,
  bulanan. Node: 1% Holders · Emiten · Direksi/Koms · Anak Usaha · **UBO**,
  warna domestik/asing. Panel emiten: **Associate Broker · 5% Changes · UBO** +
  pemegang ≥1% berikut label (LOKAL · PRIVATE EQUITY · HONGKONG) dan %
  scripless. "UBO & Market Insight" = narasi AI.
- **Holder >5%** — **Perubahan Kepemilikan 5%**, laporan harian IDX. Kolom
  Saham · Pemegang Saham · **BROKER** · Freq(30H) · Total Saham · Perubahan ·
  Valuasi · Kepemilikan % (dari→jadi). Inilah asal "Associate Broker" — data
  resmi, bukan deduksi.
- **SID & Scripless** — SID Changes (jumlah pemegang per emiten per bulan +
  tren 6 bulan + CHG/% 1M & 3M, 329 saham) · Scripless Changes · Investor
  Composition · **Divergence Analysis** (Smart Money vs Retail berlawanan;
  SMART $ · RETAIL · DIV · SCRIP %; 1M/3M/6M/1Y; BUMI −18.865 M vs +418 M).
- **Sector Trends** — rotasi sektor SM vs Retail dari KSEI: Sector Net Flow,
  Cumulative Flow Trend per sektor, dua panel rotasi. 3M/6M/1Y.

## Special Feature & Tools

- **Market Overview** — pita indeks global (TradingView), **Advance/Decline**
  (332/314, rerata 30D), chart IHSG, Net Flow Foreign, Composition Total Value.
- **Watchlist** — Portfolio + watchlist bernama, termasuk **berbasis
  konglomerat** ("Prajogo Pangestu / Barito Pacific Group", label KONGLO).
  Kolom Trends 14D · %Chg · Price · 1D Volume · Vol Ratio · Foreign Inflow 1D ·
  Top Brokers. Mode Performance dan **Titan Matrix**.
- **Titan Matrix (NEW)** — "Quantum Conglomerate Matrix": indeks kinerja grup
  konglomerat. Template Djoni (Jambi Whale) · Prajogo Pangestu · Hartono
  Family · Anthony Salim · Astra Group · Thohir Family · Aburizal Bakrie ·
  Widjaja Family (6–15 sinyal). Lookback 1W/1M/3M/6M; Timeline/Race;
  Performance/Total Value/Growth; Live Sequence.
- **Calculators** ("IDX Market Suite") — *Trading Logic*: Average Price
  (Position Blender + Target Price; WAP, Break Even fee 0,4%, **Cut Loss
  Presets dibulatkan ke tick IDX**, Simpan/Salin/Skenario & Riwayat), Profit &
  ARA/ARB, Pyramid Entry. *Risk Management*: Position Sizing, Risk/Reward,
  Margin & Fees. *Value Analysis*: Dividend Calc, Compounding & Growth.
  *Corporate Actions*: Rights Issue (Dilution Simulator).
- **What's New** — catatan rilis.

## Sumber hulu vs bahan kita

| Sumber | Dipakai untuk | Status di kita |
|---|---|---|
| Broker summary EOD per emiten | Accumulation/Smart Money/Daily Flow, seluruh Stock Profiler, Broker Profiler | **ADA** — Stockbit, BUMI 2017→ reguler+asing+nego (2.318/2.221/2.221 berkas) |
| OHLC harian | vs IHSG, Teknikal, IPO return, VWAP Quadrant | **ADA** |
| KSEI Balancepos bulanan | Ownership, Divergence, Sector Trends, kolom KSEI | **ADA** — 79 bulan, 1.035 emiten |
| Profil emiten IDX | Peta Investor, Titan Matrix | **ADA** — 962 emiten |
| **Perubahan kepemilikan ≥5% harian (IDX)** | Holder >5%, Associate Broker | **BELUM** |
| **Pemegang >1% bulanan (PDF IDX)** | Holder >1%, Free Float, MSCI | **BELUM** |
| **Jumlah SID per emiten (KSEI)** | SID Changes, Jumlah Investor | **BELUM** |
| Harga IPO & underwriter | IPO Analysis | **BELUM** (e-IPO/prospektus) |
| Indeks global | pita Market Overview | bisa lewat yfinance |
| TradingView | grafik harga | pihak ketiga; kita punya chart sendiri |

Profil IDX yang sudah dipanen membawa lebih dari yang mereka tampilkan:

```
PemegangSaham : {Nama, Persentase, Jumlah, Kategori, Pengendali: bool}
AnakPerusahaan: {Nama, BidangUsaha, Lokasi, Persentase, JumlahAset,
                 MataUang, StatusOperasi, TahunKomersil}
Direktur      : {Nama, Jabatan, Afiliasi: bool}
Komisaris, KomiteAudit, Dividen, BondsAndSukuk, IssuedBond
```

Flag `Pengendali` dan `Afiliasi` adalah inti graf relasi — mereka harus
menduganya, kita menerimanya langsung dari IDX. Peta Investor **dan** Titan
Matrix karena itu bisa dibangun tanpa panen baru sama sekali.

## Batas mereka yang bukan batas kita

- **180 hari** — `Range cannot exceed 180 days` di Stock Profiler. Arsip BUMI
  kita 2017→ tanpa batas kueri.
- **Indikator terikat jendela tampilan** — muncul "23 sesi belum cukup untuk
  EMA200, Return 3M, Multi-Timeframe" karena indikator dihitung dari rentang
  tanggal terpilih. Indikator seharusnya membaca riwayat penuh; hanya
  tampilannya yang dipotong.
- **Klasifikasi broker dua sumbu** (BEHAVIOR terhitung + KATEGORI ukuran).
  Kita bisa menambah sumbu ketiga yang mereka tak punya: **identitas** —
  lokal · BUMN · asing · afiliasi emiten.

## Kesimpulan replikasi

Tak ada satu pun fitur data tradersaham yang bahannya tidak bisa kita peroleh
dari sumber gratis dan legal. Yang **sudah ada di cakram** menutup mayoritas:
seluruh Stock Profiler, Broker Profiler, mode Accumulation / Smart Money /
Daily Flow / Foreign / Ownership / vs IHSG, Divergence, Sector Trends, Peta
Investor, Titan Matrix.

Empat panen baru yang sepadan, berurut nilai:

1. **Perubahan kepemilikan ≥5% harian (IDX)** — satu-satunya sumber resmi yang
   menyambungkan **nama pemilik ke kode broker**; itu yang membuat "Associate
   Broker" mungkin dan tak ada penggantinya.
2. **Pemegang >1% bulanan (PDF IDX)** — free float sejati, bahan MSCI.
3. **Jumlah SID per emiten (KSEI)** — divergensi jumlah pemegang vs harga.
4. **Harga IPO & underwriter** — melengkapi IPO Analysis.

Yang **tidak** perlu ditiru: grafik TradingView tersemat, dan batas 180 hari.

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
