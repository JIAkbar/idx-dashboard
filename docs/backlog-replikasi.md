# Backlog Replikasi — hasil audit tradersaham · whales · gedanggoreng

Johan 23 Agu 2026: *"jadikan backlog temuan audit dari tradersaham, whales, dan
gedang goreng tadi, jadikan 3 web itu tabel apa saja isinya, menu, sub menu,
fitur, yang perlu di replikasi atau PAPAN sudah punya tapi perlu di improve
lagi, lokasi menu nya dimana, karena contoh kasus tradersaham itu bnyk sekali
menu-menu nya"*

Sumber tiap baris: `docs/riset/tradersaham-bongkar.md` ·
`docs/riset/whales-bongkar.md` · `docs/riset/gedanggoreng-bongkar.md`.
Kolom **Lokasi** memakai rute nyata dari `PETA_MENU_KUNCI`
(`app/src/lib/aksesHalaman.ts`), kolom **Bahan** dari `docs/status-panen.md`.

**Status**: `BELUM ADA` · `ADA — IMPROVE` · `SETARA` · `TIDAK PERLU`
**Prioritas**: `P1` bahan sudah di cakram · `P2` perlu panen baru ·
`P3` sedang · `P4` nanti

> **Dua koreksi terhadap laporan lisan sebelumnya** (dicatat supaya tak
> terulang): halaman **Broker Summary** dan **Peta Investor** SUDAH ADA di
> PAPAN. Kesimpulan "belum dirender" lahir dari tidak memeriksa
> `PETA_MENU_KUNCI` lebih dulu — kesalahan yang sudah mahal di proyek ini.

---

## 1 · tradersaham.com (15 menu)

### Stock Screener — 7 mode

| Submenu / Fitur | Apa yang dilakukan | Status | Lokasi | Bahan | Prio |
|---|---|---|---|---|---|
| **Gems** (`?tab=gems`) | Skor komposit 963 emiten; 7 preset bullish + 2 risiko; tier Bronze→Diamond | ADA — IMPROVE | `/screener` + `/kartu` | OHLC + broker EOD, ada | **P1** — skor komposit kita (Kartu Analisa) belum punya preset & tier |
| ↳ Silent Accumulation | Akumulasi tanpa kenaikan harga | BELUM ADA | `/screener` (preset baru) | broker EOD per emiten | **P1** |
| ↳ Associate Broker | Emiten yang di-top-buy broker tertentu | BELUM ADA | `/screener` | broker EOD per emiten | P2 — butuh panen 300+ emiten |
| ↳ Regime Flip · Dual Confirmation · Block Absorption · Oversold Reversal | Preset sinyal turunan | BELUM ADA | `/screener` | OHLC + broker | P3 |
| ↳ Distribution Watch · Overbought+Dist | Preset risiko | BELUM ADA | `/screener` | OHLC + broker | P3 |
| **Accumulation — Positioning 6mo** | Floor & PnL per broker per emiten, badge "5/5 TRAPPED" | BELUM ADA | `/broker-summary` (tab baru) | broker EOD, **BUMI ada, sisanya sedang dipanen** | **P1** — `floorPriceBroker()` sudah ditulis |
| ↳ 6 quick preset (Solid Accum · Trapped · Deep Loss · Early Bird · The Wall · Conviction) | Pintasan kombinasi filter | BELUM ADA | `/broker-summary` | broker EOD | P3 |
| **Daily Flow** (`?tab=flow_score`) | Matriks skor D-9…D0 per emiten | BELUM ADA | `/screener` | broker EOD | P2 |
| **Smart Money — Nampung Retail** | SM akumulasi saat ritel distribusi | BELUM ADA | `/broker-summary` | broker EOD + klasifikasi broker | **P1** |
| ↳ Smart Money P&L | Floating P/L posisi smart money | BELUM ADA | `/broker-summary` | broker EOD | P2 |
| **Foreign** (`?tab=foreign`) | Skor · Intensitas · Float% · Konsisten · Akselerasi · Net | ADA — IMPROVE | `/aliran-asing` | aliran asing 2020→, ada | **P1** — kita punya Net; belum punya konsistensi & akselerasi |
| ↳ **Kolom konfirmasi KSEI** | Silang aliran asing harian × KSEI bulanan (✓/⚠/≈) | BELUM ADA | `/aliran-asing` | aliran asing + **KSEI 79 bulan, ada** | **P1** — gagasan terkuat mereka, bahan lengkap |
| ↳ Preset Senyap (Small/Mid) · Big Money · Divergen | Pintasan | BELUM ADA | `/aliran-asing` | sama | P3 |
| **Ownership** (`?tab=composition`) | KSEI 36 tipe / 8 kategori + asing, Outstanding vs Holdings | BELUM ADA | `/peta-investor` atau `/stock-detail` | **KSEI 79 bulan, ada** | **P1** |
| **MSCI** (`?tab=msci`) | Full MCap · Free Float MCap · ATVR 3M/12M · Trading Days · FOT · Score | BELUM ADA | `/screener` (mode baru) | OHLC + shares ada; **free float 1% belum** | P2 |
| **vs IHSG** (`?tab=relative_strength`) | Beta · Korelasi · R² · Alpha · Rel Strength, 1W–1Y | BELUM ADA | `/screener` atau `/grafik` | **OHLC, ada** | **P1** — murni hitungan, nol panen |

### Stock Profiler — 9 tab

| Submenu / Fitur | Apa yang dilakukan | Status | Lokasi | Bahan | Prio |
|---|---|---|---|---|---|
| Overview | Gabungan asing 3M + KSEI ritel + SID + holder + broker summary | ADA — IMPROVE | `/stock-detail` | sebagian ada; **SID belum** | P2 |
| **Inventory** | Kumulatif net per broker + overlay harga + 6M Floor Price | BELUM ADA | `/broker-summary` | broker EOD | **P1** — `kumulatifBroker()`, `floorPriceBroker()` sudah ada |
| **Quadrant** | Avg broker vs VWAP × Net Value, 4 kuadran | BELUM ADA | `/broker-summary` | broker EOD + OHLC | **P1** |
| **Broker Intel** (treemap perilaku) | Smart Accumulator · Accumulation · Distribution · Large Player · Profit Taker | BELUM ADA | `/broker-summary` | broker EOD | P2 |
| **NEGO** | Pola silang `Neg Buy → Reg Sell`, Opp. Patterns | BELUM ADA | `/broker-summary` (tab NEGO) | **nego BUMI ada**, sisanya dipanen | **P1** — inilah gunanya panen varian nego |
| vs IHSG | sama dengan mode screener | BELUM ADA | `/grafik` | OHLC | P1 |
| **Shareholders** (5 sub-tab) | 1% · Komposisi · Perubahan Kategori · Timeline Foreign | BELUM ADA | `/stock-detail` | KSEI ada; **holder >1% belum** | P2 |
| Teknikal (TradingView tersemat) | Chart pihak ketiga + skor confluence | TIDAK PERLU | — | chart kita sendiri | — |
| ↳ **TA + Flow Confluence** | Skor gabungan teknikal × broker flow | BELUM ADA | `/kartu` | OHLC + broker | P2 |
| **Flow Analysis — %Net** | `Net ÷ Gross` per broker: penampung vs churn | BELUM ADA | `/broker-summary` | broker EOD gross | **P1** — sepele dihitung, tajam hasilnya |
| Disclosure | Corporate action, rights issue, keterbukaan | ADA — IMPROVE | `/dasbor` (Kabar) | kabar.json ada | P3 |

### Broker Profiler — 5 mode + Broker Intel

| Submenu / Fitur | Apa yang dilakukan | Status | Lokasi | Bahan | Prio |
|---|---|---|---|---|---|
| Activity | Arus 1 broker ke semua emiten | BELUM ADA | `/broker` (topbroker) | butuh broker EOD **semua** emiten | P2 |
| **Stats — Directionality** | `\|net\|/gross` → Scalper vs Akumulator | BELUM ADA | `/broker` | broker level pasar, **ada** | **P1** |
| **Pulse — Share of IHSG + Ranking** | Kontribusi turnover, rank gross/net dari 88 | ADA — IMPROVE | `/broker` | **broker level pasar, ada** | **P1** |
| **Composition** — 2 sumbu label | BEHAVIOR (terhitung) × KATEGORI (ukuran) untuk 88 broker | BELUM ADA | `/broker` | broker level pasar | **P1** |
| Compare | Metrik berdampingan ≤5 broker | BELUM ADA | `/broker` | broker level pasar | P3 |
| Broker Intel — **Consistency x/7** | Berapa hari searah dari 7 | BELUM ADA | `/broker-summary` | broker EOD | **P1** |

### Insights · Owner · Tools

| Menu | Submenu / Fitur | Apa yang dilakukan | Status | Lokasi | Bahan | Prio |
|---|---|---|---|---|---|---|
| Foreign Flow | Radar (HEAT D-4…D0, streak) | BELUM ADA | `/aliran-asing` | aliran asing ada | P1 |
| | Top (akumulasi/distribusi harian) | SETARA | `/aliran-asing` | ada | — |
| | Sector Rotation | BELUM ADA | `/sector` | aliran asing + sektor ada | P1 |
| IPO Analysis | IPO Stocks (success 1D/1W/1M/now) | BELUM ADA | halaman baru `/ipo` | OHLC + listing ada; **harga IPO belum** | P2 |
| | Underwriters | BELUM ADA | `/ipo` | **belum ada** | P3 |
| Informasi Harian | 4 tab (Lainnya · Kepemilikan · Dividen · RUPS) + ringkasan naratif | ADA — IMPROVE | `/dasbor` | kabar.json ada | P3 |
| **Peta Investor** | Graf 6.123 investor × 962 emiten, UBO, Associate Broker | **ADA — IMPROVE** | **`/peta-investor`** | `investor_map.json` (952 emiten, 6.728 holder) + **profil IDX 962 (flag Pengendali/Afiliasi + anak usaha)** | **P1** — perkaya dari profil IDX |
| **Holder >5%** | Perubahan harian ≥5% **berikut kolom BROKER** | BELUM ADA | `/peta-investor` | **belum dipanen — sumber IDX** | **P2 tertinggi** — satu-satunya yang menyambung nama pemilik ke kode broker |
| Holder >1% | Daftar bulanan dari PDF IDX, klasifikasi perubahan | BELUM ADA | `/peta-investor` | **belum dipanen** | P2 |
| SID & Scripless | SID Changes · Scripless · Composition | BELUM ADA | `/stock-detail` | **jumlah SID belum dipanen** | P2 |
| | **Divergence Analysis** (SM vs Retail berlawanan) | BELUM ADA | `/aliran-asing` atau `/screener` | **KSEI 79 bulan, ada** | **P1** |
| Sector Trends | Rotasi sektor SM vs Retail dari KSEI | BELUM ADA | `/sector` | **KSEI + sektor, ada** | **P1** |
| Market Overview | Advance/Decline, pita indeks global, net flow asing | ADA — IMPROVE | `/dasbor` | GetStockSummary ada; indeks global via yfinance | P3 |
| Watchlist | Daftar + kolom broker/asing | ADA — IMPROVE | `/watchlist` | ada | P3 |
| | **Titan Matrix** (indeks grup konglomerat) | BELUM ADA | `/peta-investor` atau `/sector` | **profil IDX (Pengendali) + OHLC, ADA** | **P1** — fitur paling menjual mereka, bahan kita lengkap |
| Calculators | Average Price (Position Blender, cut loss ber-tick) | ADA — IMPROVE | `/kalkulator` | `keFraksi()` ada | P3 |
| | Profit ARA/ARB · Pyramid · Position Sizing · R:R · Margin · Dividend · Compounding · Rights Issue | BELUM ADA | `/kalkulator` | nol data | P3 — murah, tinggal rumus |

---

## 2 · whales.id

| Submenu / Fitur | Apa yang dilakukan | Status | Lokasi | Bahan | Prio |
|---|---|---|---|---|---|
| **Footprint chart** (sel per level harga per lilin) | Volume beli/jual per harga per lilin | TIDAK PERLU (intraday) | — | butuh tick + broker + sisi agresor — **mustahil** | — |
| ↳ **Footprint HARIAN versi kita** | Sumbu waktu = hari, sel = broker per level harga | BELUM ADA | halaman baru (grup Broker) | broker EOD + OHLC | P2 |
| **Area breakdown** — 4 kuadran maker/taker per broker | Agg Buyer · Passive Seller · Passive Buyer · Agg Seller + Net, bendera D/F | BELUM ADA | — | **mustahil dari EOD**; hanya lewat panen harian whales (3 hari saja) | **P2 mendesak** — tak bisa ditarik mundur |
| Bid/offer heatmap | Kedalaman antrean sepanjang waktu | TIDAK PERLU | — | mustahil | — |
| Market profile (Volume/Delta/TPO) | Distribusi volume per level harga | BELUM ADA | `/grafik` | OHLC harian → versi harian saja | P3 |
| CVD · VWAP · Volume imbalance | Indikator turunan | ADA — IMPROVE | `/grafik` | OHLC (CVD butuh sisi agresor — versi terbatas) | P3 |
| Replay | Putar ulang dari satu titik | BELUM ADA | `/grafik` | OHLC | P4 |
| Workspace layouts (Single/Split/Quad) | Multi-pane tersimpan | BELUM ADA | `/grafik` | Supabase ada | P4 |
| **Arsitektur chart: canvas 2D berlapis** | 6 canvas terpisah, `pointer-events-none`, tanpa library | ADA — IMPROVE | `/grafik`, `/chart` | — | **P1** — teknik, bukan data; syarat kalau footprint dibangun |

---

## 3 · gedanggoreng.netlify.app

| Menu | Submenu / Fitur | Apa yang dilakukan | Status | Lokasi | Bahan | Prio |
|---|---|---|---|---|---|---|
| **Calculator** | Price Target dari bandar (avg · barang · total papan · A=5% avg · P=barang/avg) → Target Realistis & Max | BELUM ADA | `/kartu` atau `/broker-summary` | broker EOD ada; **orderbook (Total Bid/Offer, Offer Max/Bid Min) TIDAK ada** | P3 — hanya bagian broker yang bisa |
| | Broker Summary Top1/3/5 + label Acc/Dist | BELUM ADA | `/broker-summary` | broker EOD | **P1** |
| | Key Stats (valuasi + laba rugi + neraca) | ADA — IMPROVE | `/stock-detail` | fundamental + XBRL + **keystats Stockbit (dipanen hari ini)** | P2 |
| | **Broker Flow: heatmap D-6…D0 + Consistency x/7** | BELUM ADA | `/broker-summary` | broker EOD | **P1** |
| **Morning Briefing** | Sentimen global naratif + 6 indeks + 8 komoditas + kurs | BELUM ADA | `/dasbor` | **indeks & komoditas belum** (bisa yfinance) | P3 |
| | **Rotasi Sektor 4 kuadran RRG** | BELUM ADA | `/sector` | **OHLC per sektor, ada** | **P1** — dan versi kita bisa benar (punya mereka rusak: 11 sektor semua di Weakening) |
| | Top Market Movers | SETARA | `/dasbor`, `/stocks` | ada | — |
| **Screener** | 3 mode waktu (After Market · Intraday · BSJP) | BELUM ADA | `/screener` | — | P4 |
| | ATM Harian (Shark: NET/GROSS × Clean/All) | BELUM ADA | `/broker-summary` | broker EOD | P2 |
| | Preset Breakout · Multibagger · Insider · Daily Movers | ADA — IMPROVE | `/screener` | OHLC ada; insider butuh data direksi (**profil IDX, ada**) | P2 |
| **Trading Plan** | Auto R:R, status ON HOLD/SUCCESS/MISS, sync DB | ADA — IMPROVE | Deep Dive / Analisa PAPAN v1 | ada | P3 |
| | Kolom Confidence % + Bandar + Avg Bandar + Target | BELUM ADA | `/kartu` | broker EOD | P2 |
| **Tracer** | Win Rate %, Broker Accuracy Breakdown, Historical Logs | ADA — IMPROVE | (tinjauan H+5 `tinjau_deepdive.py`) | ada | **P1** — mesin ada, tampilan belum |
| | Watchlist 3 blok (Akum 31D · Akum 1D · Dist 1D) | BELUM ADA | `/watchlist` | broker EOD | P2 |
| **Glosarium Broker Index** | Klasifikasi broker per identitas: Foreign/Smartmoney · Institutional/Whale · Retail · Mix | BELUM ADA | `/broker-summary` + `/broker` | daftar 17 broker (perlu diperluas ke 88, + kelas BUMN & afiliasi emiten) | **P1** — prasyarat semua fitur berwarna broker |

---

## Ringkasan hitungan

| Situs | BELUM ADA | ADA — IMPROVE | SETARA | TIDAK PERLU |
|---|---|---|---|---|
| tradersaham | 33 | 9 | 1 | 1 |
| whales | 6 | 2 | 3 | — |
| gedanggoreng | 11 | 5 | 1 | — |
| **Total** | **50** | **16** | **5** | **1** |

## Antrean kerja sebenarnya — P1 (bahan sudah di cakram)

Diurutkan supaya yang saling menopang dikerjakan berdekatan:

1. **Glosarium Broker Index diperluas ke 88 broker** (+ kelas BUMN & afiliasi) — prasyarat semua tampilan berwarna broker
2. **Broker Summary per emiten**: Inventory · Quadrant · %Net · Consistency x/7 · Top1/3/5 Acc-Dist · NEGO — satu halaman, enam fitur, semuanya dari arsip yang sedang dipanen
3. **Smart Money vs Retail** (butuh #1)
4. **Broker Profiler**: Directionality · Share of IHSG · Composition 2 sumbu — dari broker level pasar yang sudah ada
5. **Konfirmasi KSEI di aliran asing** (✓/⚠/≈) + **Divergence Analysis** + **Sector Trends** — tiga fitur, satu bahan (KSEI 79 bulan)
6. **vs IHSG** (Beta/Alpha/R²) — nol panen, murni hitungan
7. **Rotasi Sektor RRG 4 kuadran**
8. **Titan Matrix** (indeks grup konglomerat) + **Peta Investor diperkaya** dari profil IDX
9. **Tracer/akurasi** — mesin `tinjau_deepdive.py` sudah ada, tinggal halaman
10. **Canvas berlapis** — teknik whales, syarat sebelum footprint

## Lubang data (yang mengunci P2)

| Bahan | Mengunci | Sifat |
|---|---|---|
| **Perubahan kepemilikan ≥5% harian (IDX)** — berikut kolom broker | Holder >5%, Associate Broker, Peta Investor penuh | **harian, tak bisa ditarik mundur** |
| **Pemegang >1% bulanan (PDF IDX)** | Holder >1%, Free Float sejati, MSCI screener | bulanan |
| **Jumlah SID per emiten (KSEI)** | SID Changes, divergensi pemegang vs harga | bulanan |
| **Area breakdown whales (maker/taker per broker)** | 4 kuadran agresif/pasif | **3 hari saja, hilang permanen kalau tak dipanen tiap hari** |
| **Harga IPO & underwriter** | IPO Analysis | historis, bisa menyusul |
| **Orderbook (bid/offer depth)** | Price Target gaya gedanggoreng | tak tersedia di sumber mana pun yang kita punya |
