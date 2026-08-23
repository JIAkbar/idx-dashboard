# Referensi Sumber — IDX Statistik (PAPAN)

Dibuat: 23 Agustus 2026 · sesi: AI Skill (Fable, atas perintah Johan — *"perlu fable coba kerjakan soal sesi Papan Trading bentuk referensi nya mengingat akan berkembang besar luas dan yang dikhawatirkan semkian tidak terstruktur datanya"*) · aturan: `~/.claude/CLAUDE.md` section "Papan Pekerjaan, Referensi Sumber, Kejujuran Inventaris" · alasan & cara kerja: `kemampuan-workflow.md` §WF-206
Bangun HTML (tiap berkas ini berubah): `python "C:\1-Johan\10. Pengembangan\AI Skill\00 - Dokumentasi\build_html.py" --proyek "C:\1-Johan\10. Pengembangan\IDX Statistik\docs\referensi_idx-statistik.md"`

Berkas ini menjawab tiga pertanyaan yang selama ini tidak punya satu rumah: **dari sumber mana saja data PAPAN berasal, apa yang tersedia di tiap sumber versus yang benar-benar diambil, dan halaman mana memakai apa — termasuk mana yang hasil jahitan**. Rincian teknis per sumber tetap di dokumen lamanya (`sumber-data-harga.md`, `sumber-fundamental-idx.md`, `panen-kabar.md`, `panen-seasonality.md`, `workflow-panen-rombak.md`); status "isi terakhir sampai kapan" tetap di `status-panen.md`. Berkas ini peta dan keputusannya.

Semua bukti `file:baris` dibaca langsung dari kode pada 23 Agustus 2026 (`scripts/*.py`, `app/src/**`), bukan dari ingatan. Berkas ini tidak ikut terbit: `vercel.json` hanya menyalin `app/dist`, `data-idx/json`, `data-idx/radar`, `arus-pasar/keluaran` — folder `docs/` tidak pernah sampai ke pengguna, jadi nama endpoint boleh ditulis di sini (aturan "endpoint tidak boleh tayang" berlaku untuk antarmuka, bukan dokumen internal).

Tanda di kolom "Diambil?": ✅ diambil · ❌ tidak diambil · ⚙️ turunan (dihitung dari yang diambil, dengan bukti angka) · ❓ belum diuji/belum dipastikan.

## Ringkasan

| Sumber | Jenis | Akses | Diambil / tersedia | Berkas lokal | Dipakai untuk | Diverifikasi |
|---|---|---|---|---|---|---|
| IDX `TradingSummary/GetStockSummary` | API tidak resmi (JSON situs idx.co.id) | User-Agent peramban + sesi; **IP datacenter diblokir** (Actions/Netlify 403), IP rumahan 200 | 6 ruas dari ±32 (aliran asing) + `ListedShares` (daftar emiten) | `data-idx/json/asing/<KODE>.json` (989), `daftar_emiten.json`, mentah `_arsip-mentah/asing/` (1.729 gz) | Stock Detail, Aliran Asing, Broker Summary (Flow/Nego/AsingEmiten), Grafik Emiten, `aliran_investor.json` | panen 18–21 Agu 2026; batas riwayat 2020-01-02 diuji 18 Agu |
| IDX statistik PDF harian / mingguan / bulanan (`Statistic/GetStatistic` + unduhan PDF) | dataset unduhan (PDF resmi) | rumahan; mingguan ikut `update.yml` | ruas yang diparse `parse_idx_pdf.py` / `parse_idx_weekly.py` / `parse_idx_monthly.py` | `index.json`, `ds_*.json` (146), `index_weekly.json`/`ws_*` (33), `index_monthly.json`/`ms_*` (11) | Beranda, Indeks Dunia, Top Stocks, Top Broker, Sektor & Indeks, Statistik Berkala, Radar, Bulletin | 21 Agu 2026 (harian), 14 Agu (mingguan), Jul 2026 (bulanan) |
| IDX `TradingSummary/GetBrokerSummary` | API tidak resmi | rumahan 200; parameter `code`/`stockCode` **diabaikan** → selalu level pasar | 88 broker/hari × 5 ruas | `data-idx/json/broker/` (756) | Broker Summary (brokerHarian), Top Broker | 22 Agu 2026 |
| IDX `ListedCompany/GetFinancialReport` + XLSX ber-XBRL | API + unduhan XLSX (~300 KB/emiten) | rumahan; UA peramban; tidak terenkripsi | 47 sheet tersedia; diambil ruas utama neraca/laba-rugi/arus kas + kolom pembanding + pengendali (sheet `1000000`); kuartal diskret diturunkan | `keuangan_idx/` (949), `pengendali.json`, mentah `_arsip-mentah/` | Stock Detail (PanelLaporanKeuangan, fundamentalGabungan), `valuasi_historis.json`, `lengkapi_fundamental.py` | 19 Agu 2026 (interim 2024 TW1/TW2), 2019–2025 |
| IDX `ListedCompany/GetCompanyProfiles` / `GetCompanyProfilesDetail` | API tidak resmi | rumahan; jeda 1,5 dtk (`idx_net.get`) | 962 emiten: alamat, BAE, industri, subindustri, email, situs, jenis efek | `profil/` (962), `emiten_sektor.json` | sektorIdx → Stock Detail, Kartu Analisa; **`profil/` belum dipakai halaman mana pun** | 22 Agu 2026 |
| IDX `StockData/GetSecuritiesStock` | API tidak resmi | rumahan 200 (132 KB) | dipakai `fetch_fundamental.py` untuk daftar saham — ruas lain ❓ belum diinventaris | via `daftar_emiten.json` | kamusEmiten | ❓ isi ruas belum dicatat |
| IDX berita & pengumuman (`NewsAnnouncement/GetNewsSearch`, `ListedCompany/GetAnnouncement`, `NewsAnnouncement/GetAllAnnouncement`) | API tidak resmi | rumahan (datacenter 403 → `panen-kabar-rumah.yml`) | judul, tautan, waktu | `kabar.json` (bagian IDX) | Beranda, Kabar Pasar; `GetAllAnnouncement` dipakai `fetch_investor_map.py` | 18 Agu 2026 21:56 WIB |
| Stockbit `exodus.stockbit.com/chartbit/<KODE>` | API tidak resmi, **token login akun** (`stockbit_token.py`) | token + refresh; 963/963 emiten | o/h/l/c/v sejak 2004 + `foreignbuy`/`foreignsell` (rupiah); **foreignbuy/sell belum dipakai halaman mana pun** | `ohlcv_stockbit/` (963) → digabung ke `ohlc/` | Broker Summary v2 (langsung); Grafik Emiten, Tanya PAPAN, Kartu Analisa, Screener, Watchlist, Seasonality Harian (lewat `ohlc/`) | bar terakhir 21 Agu 2026; panen penuh 23 Agu |
| Stockbit `exodus.stockbit.com/marketdetectors/<KODE>` | API tidak resmi, token | token; beban 12 varian × 1.309 hari × 961 emiten ≈ 31 hari paralel 12 | 12 varian (3 papan × ALL/FOREIGN × GROSS/NET); DOMESTIC ⚙️ turunan | `broker_harian/` (145.834 berkas, 22 emiten gelombang 1), `broker_tahunan/` | Broker Summary v2 | 23 Agu 2026 siang |
| Stockbit `exodus.stockbit.com/keystats/<KODE>` | API tidak resmi, token | token; 963/963 | ±94 rasio — dipanen semua, **belum dibaca halaman mana pun** (grep `app/src` nol) | `keystats_stockbit/` | belum dipakai | 23 Agu 2026 |
| Stockbit `exodus.stockbit.com/emitten/<KODE>` (profil & info) | API tidak resmi, token | token; 963/963 | profil: pemegang saham, anak usaha; info: keanggotaan indeks, notasi khusus, UMA | `profil_stockbit/`, `info_stockbit/` | Shareholders (Broker Summary v2) memakai `profil_stockbit/`; **`info_stockbit/` belum dipakai** | 23 Agu 2026 |
| Stockbit Snips (`snips.stockbit.com` sitemap + `?format=json`) | situs (scrape) | bebas | judul, tautan, waktu | `snips.json` (238) | Beranda, Kabar Pasar | 14 Agu 2026 — langkah CI ditambahkan 18 Agu, **belum pernah jalan** |
| Stockbit endpoint lain (Top Broker pasar, laporan keuangan per periode, aksi korporasi, intraday, orderbook — paywall Pro, fundachart) | ❓ | ❓ parameter belum terpecahkan | ❓ belum diuji | — | — | catatan 23 Agu (`workflow-panen-rombak.md` §4) |
| Yahoo Finance `query1.finance.yahoo.com/v8/finance/chart/` | API tidak resmi | bebas, jeda sopan; **`range=max`+`interval=1d` diturunkan diam-diam ke bulanan** → wajib `period1`/`period2` | OHLC harian (pengisi `ohlc/` untuk tanggal tanpa Stockbit), IHSG 1990–1999, `^JKSE` cadangan statistik harian, penutupan bulanan seasonality | `ohlc/` (bagian Yahoo), `_arsip-mentah/ohlc-yahoo-sebelum-ganti-volume/`, `ihsg_harian.json` (cadangan), `seasonality/harga_bulanan.json` | Indeks Dunia, Seasonality, dan semua pemakai `ohlc/` | 20–21 Agu 2026 |
| Yahoo Finance lewat pustaka `yfinance` (`info` + laporan) | pustaka → API Yahoo | bebas; 646 emiten punya laporan | 15 ruas fundamental + rasio turunan (PER, PBV, ROE, Altman Z, F-Score, beta, target analis, median sektor); laporan tahunan/kuartalan | `fundamental/` (965), `keuangan/` (646) | Stock Detail, Sektor & Indeks, Aliran Asing, Watchlist, Kalkulator, Screener, PanelLaporanKeuangan | 17–18 Agu 2026; `update-fundamental.yml` akhir bulan |
| KSEI Balancepos (`web.ksei.co.id/Download/BalanceposEfek<YYYYMMDD>.zip`) | dataset unduhan bulanan, pipe-delimited | bebas (diuji rumahan) | lokal & asing × 9 tipe investor, Jan 2020 → Jul 2026 (79 bulan) | `kepemilikan/` (1.035 emiten) | Shareholders (Broker Summary v2) via `brokerProfilKsei.ts:27` — **`status-panen.md` masih menulis "belum dipakai halaman mana pun": basi** | 23 Agu 2026 |
| KSEI holding composition (`web.ksei.co.id/archive_download/holding_composition/`) | dataset unduhan | bebas | komposisi kepemilikan per emiten | `investor_map.json`, `investor_map.meta.json` | Peta Investor, graphRender, seasonality_bakrie | tak diperbarui rutin |
| IPOT News (`indopremier.com/ipotnews/…`, ajax `ajax_generalNewsPagesMore.php`) | situs (scrape) | bebas; endpoint mengabaikan parameter `halaman` (berhenti kalau halaman kembar persis) | berita saham + arsip | `kabar.json` (bagian IPOT), `ipot_arsip.json` | Kabar Pasar, Beranda | 20 Agu 2026 08:26 WIB |
| Kontan RSS (`investasi.kontan.co.id/rss`) | RSS | lewat runner rumahan | judul, tautan | `kabar.json` | Kabar Pasar | 18 Agu 2026 |
| Google News RSS (`news.google.com/rss/search`, 3 kueri) | RSS publik tanpa kunci | **belum terbukti tembus dari IP datacenter GitHub** | judul, tautan, waktu | `kabar.json` | Kabar Pasar | 20 Agu 2026 08:41 WIB |
| indexalpha (`api.indexalpha.id`, `INDEXALPHA_TOKEN`) | API pihak ketiga, token dari dasbor | ❓ | opsi `--sumber indexalpha` di `panen_broker_emiten.py` — ❓ apakah pernah dipakai nyata | — | ❓ | ❓ belum dipastikan |
| Setoran kontributor (tangkapan layar broker per emiten) + Supabase | unggahan manusia + basis data eksternal | akun admin | gambar + hasil kurasi admin | Supabase (`supabaseSetoran.ts`), `arus-pasar/keluaran/` | Deep Dive, Bulletin, Kartu Analisa (broker per emiten setoran), Admin Kurasi | berjalan |
| Radar (unggahan admin `r_YYMMDD.json`) | unggahan manusia | admin | — | `data-idx/radar/` | Radar Watchlist | berjalan |

Referensi desain (DESIGN.md, situs acuan) tidak ditelusuri dalam audit ini — fokusnya data. Kalau ada, tambahkan sebagai section sendiri.

## Peta halaman → sumber

Satu baris per halaman di `app/src/lib/dasbor/menu.ts` + komponen data di Beranda. "Berkas" = yang benar-benar dibaca kode (`app/src/views/**`, `app/src/lib/**`, grep `data-idx/` 23 Agu 2026). **Jahitan** = deret yang digabung dari lebih dari satu sumber, atau ruas yang ditimpa dari sumber lain — status keputusannya ada di bagian "Jahitan".

| Halaman / fitur | Berkas data yang dibaca | Sumber asal | Jahitan? | Diverifikasi |
|---|---|---|---|---|
| Beranda `/` | `index.json` + `ds_*` (dataHarian), `ihsg_ohlc_ringkas.json` (ihsgOhlc), `kabar.json`, `snips.json`, `arus-pasar/keluaran/index.json` (bulletin) | IDX PDF harian; **IHSG jahitan Yahoo+Stockbit**; IDX berita/pengumuman + IPOT + Kontan + Google News; Stockbit Snips; setoran kontributor | **ya** (grafik IHSG) | 23 Agu 2026 |
| Tanya PAPAN (komponen Beranda, `TanyaPapan.tsx`, `tanyaPapan.ts:35`) | `ohlc/<KODE>.json` | **jahitan Stockbit chartbit + Yahoo** | **ya** | 23 Agu 2026 |
| Panel Aliran Asing (Beranda, `PanelAliranAsing.tsx:13`) | `asing/<KODE>.json` | IDX GetStockSummary | tidak | 23 Agu 2026 |
| Panel Diary (Beranda, `PanelDiary.tsx:91`) | `ihsg_harian.json` | IDX PDF harian, **cadangan sementara Yahoo `^JKSE`** bila PDF belum terbit (ditimpa PDF saat terbit) | sementara | 23 Agu 2026 |
| Grup Konglomerat (Beranda, `GrupKonglomerat.tsx:42`) | `grup_konglomerat.json` | ⚙️ turunan `petakan_grup.py` dari profil/pengendali IDX + KSEI | turunan | 23 Agu 2026 |
| Indeks Dunia `/indeks` | `index.json` (dataHarian), `ihsg_harian.json`, `ihsg_ohlc_ringkas.json` | IDX PDF harian; **IHSG jahitan Yahoo 1990–1999 + Stockbit 2000→** | **ya** | 23 Agu 2026 |
| Sektor & Indeks `/sector` | `index.json`/`ds_*`, `fundamental/` (stockDetailData), `emiten_sektor.json` | IDX PDF; **fundamental campuran yfinance + IDX** (lihat Jahitan); IDX profil | **ya** (fundamental) | 23 Agu 2026 |
| Top Stocks `/stocks` | `index.json`/`ds_*` | IDX PDF harian | tidak | 23 Agu 2026 |
| Statistik Berkala `/statistik` | `index_weekly.json`, `index_monthly.json`, `ws_*`, `ms_*` | IDX PDF mingguan/bulanan | tidak | 23 Agu 2026 |
| Top Broker `/broker` | `index.json`/`ds_*` (dataHarian) | IDX PDF harian (broker level pasar dari PDF) | tidak | 23 Agu 2026 |
| Stock Detail `/stock-detail` | `fundamental/<KODE>.json` + `fundamental/index.json`, `keuangan/<KODE>.json`, `keuangan_idx/<KODE>.json`, `asing/<KODE>.json`, `pengendali.json`, `emiten_sektor.json`, `valuasi_historis.json` | **fundamental: yfinance + `ListedShares` IDX + tambalan dari XBRL IDX**; `keuangan`: yfinance; `keuangan_idx`: IDX XBRL; asing: IDX; pengendali: IDX XBRL sheet 1000000; valuasi: ⚙️ turunan keuangan_idx + `ohlc/` | **ya** — `fundamentalGabungan.ts:198-199` menggabung `keuangan_idx` + `keuangan` saat dibaca; `fundamental/` campuran 3 sumber per ruas | 23 Agu 2026 |
| Grafik Emiten `/grafik` (`GrafikEmiten.tsx:774,794,1693`) | `ohlc/<KODE>.json`, `asing/<KODE>.json` | **jahitan Stockbit + Yahoo**; IDX | **ya** | 23 Agu 2026 |
| Chart `/chart` (`ChartIndeks.tsx`) | ❓ tidak ada jalur `data-idx/` langsung di berkasnya | ❓ belum ditelusuri (kemungkinan widget/komponen lain) | ❓ | belum |
| Peta Investor `/peta-investor` | `investor_map.json`, `investor_map.meta.json` | KSEI holding composition | tidak | 23 Agu 2026 |
| Broker Summary `/broker-summary` | `broker/index.json` + `broker/<tgl>.json` (brokerHarian), `asing/<KODE>.json` (flowNego, AsingEmiten), `aliran_investor.json` | IDX GetBrokerSummary (+PDF); IDX GetStockSummary; ⚙️ turunan `bangun_aliran_investor.py` dari asing | tidak (turunan ditandai) | 23 Agu 2026 |
| Aliran Asing `/aliran-asing` | `asing/<KODE>.json`, `fundamental/`, `screener.json` | IDX GetStockSummary; fundamental campuran; ⚙️ screener turunan | **ya** (lewat fundamental) | 23 Agu 2026 |
| Broker Summary v2 `/broker-summary-v2` (Overview, Inventory, FlowNetGross, Nego, TimelineForeign, VsIhsg, Shareholders) | `ohlcv_stockbit/<KODE>.json` (`brokerEmitenV2.ts:6,50`), `broker_tahunan/` (`:147`), `broker/`, `kepemilikan/<KODE>.json` (`brokerProfilKsei.ts:27`), `profil_stockbit/<KODE>.json` (`:136`) | Stockbit chartbit **murni** (bukan `ohlc/`); ⚙️ `bangun_broker_tahunan.py` dari Stockbit marketdetectors; IDX GetBrokerSummary; KSEI Balancepos; Stockbit profil | tidak — satu-satunya halaman harga yang memakai Stockbit tanpa jahitan Yahoo | 23 Agu 2026 |
| Seasonality `/seasonality` (+ Harian, Komparasi) | `seasonality/harga_bulanan.json`, `ihsg_harian.json`, `ohlc/<KODE>.json` (SeasonalityHarian) | Yahoo bulanan (**bukan sejak IPO** — titik tertua Agu 2000); IDX PDF; **`ohlc/` jahitan** | **ya** (Harian) | 23 Agu 2026 |
| Radar Watchlist `/radar` | `data-idx/radar/*.json`, `index.json` | unggahan admin; IDX PDF | tidak | 23 Agu 2026 |
| Watchlist `/watchlist` | `ohlc/<KODE>.json`, `fundamental/`, `harga_terakhir.json`, `daftar_emiten.json` | **`ohlc/` jahitan**; fundamental campuran; `harga_terakhir` ⚙️ (produsen: dirujuk `petakan_grup.py` — ❓ penulis aslinya belum ditelusuri) | **ya** | 23 Agu 2026 |
| Kalkulator `/kalkulator` (AvgDown, Pemulihan, PosisiBar, …) | `harga_terakhir.json`, `fundamental/` | ⚙️ turunan; fundamental campuran | **ya** (lewat fundamental) | 23 Agu 2026 |
| Kartu Analisa `/kartu` | `kartu/<KODE>.json`, `kartu/index.json`, `kartu/ringkas.json`, `kartu/arsip/`, `seasonality/`, `emiten_sektor.json`, `ihsg_harian.json` | ⚙️ `scripts/riset/kartu_analisa.py` dari `ohlc/` (**jahitan**) + asing + seasonality; IDX profil; IDX PDF | **ya** (lewat `ohlc/`) | 23 Agu 2026 |
| Screener `/screener` | `screener.json`, `pola_screener.json`, `kandidat_deepdive.json` | ⚙️ `app/scripts/bangun-screener.mjs` & `pola-screener.ts` dari `ohlc/` (**jahitan**) + fundamental; `kandidat_deepdive.json` ❓ produsen belum ditemukan di `scripts/` maupun `app/scripts/` | **ya** | 23 Agu 2026 |
| Kabar Pasar `/kabar` | `kabar.json`, `snips.json`, `ipot_arsip.json` | IDX berita/pengumuman + IPOT + Kontan + Google News (dedup 2 lapis); Stockbit Snips; IPOT arsip | tidak (sumber berdampingan, tidak ditimpa) | 23 Agu 2026 |
| Bulletin Arus Pasar `/bulletin` | `arus-pasar/keluaran/index.json` + edisi, `index.json` | setoran kontributor + `arus-pasar/build.py`; IDX PDF | tidak | 23 Agu 2026 |
| Deep Dive (bagian Bulletin/Kartu) | setoran broker per emiten (Supabase), `kartu/` | kontributor + kurasi admin; ⚙️ kartu | lewat kartu | 23 Agu 2026 |
| Metodologi `/metodologi`, Kritik & Saran `/feedback`, Forum | tidak membaca `data-idx/` (Forum/Feedback → Supabase) | Supabase (konten pengguna) | tidak | 23 Agu 2026 |
| Admin: Unggah Harian, Radar Unggah, Kurasi Setoran, Bedah Unggah, Rak Terbitan | unggahan manusia → `data-idx/radar/`, Supabase, `arus-pasar/keluaran/` | manusia | tidak | 23 Agu 2026 |

Tiga hal yang terlihat dari peta ini dan belum pernah tertulis di satu tempat: (1) **hampir semua halaman harga emiten memakai `ohlc/` yang adalah jahitan**, kecuali Broker Summary v2 yang membaca Stockbit murni; (2) **`fundamental/` adalah campuran tiga sumber per ruas** dan halaman Stock Detail menggabungkannya lagi dengan `keuangan` yfinance saat dibaca; (3) tiga dataset dipanen penuh tapi tidak dibaca halaman mana pun — `keystats_stockbit/`, `info_stockbit/`, `profil/` IDX — plus `foreignbuy`/`foreignsell` rupiah chartbit yang sudah ada di berkas tapi belum dipakai, sementara halaman masih menampilkan taksiran rupiah yang meleset 1,33×.

## Jahitan yang ada sekarang — semuanya perlu keputusan ulang Johan

Johan 23 Agu 2026: *"data yang sempurna pasti itu yang digunakan bukan data jahit menjahit yang belum tentu uji nya betul"*. Aturan lama proyek (`sumber-data-harga.md`): *"mencampur dua sumber tanpa memberitahu adalah cara paling halus kehilangan kepercayaan"*. Daftar ini tidak menyatakan jahitan mana yang salah — ia menyatakan **siapa yang memutuskan dan apa buktinya**, supaya Johan bisa memutuskan ulang dengan dasar yang sama.

| # | Jahitan | Cara | Bukti/uji yang ada | Siapa memutuskan | Status |
|---|---|---|---|---|---|
| J1 | `ohlc/<KODE>.json` = Stockbit chartbit ∪ Yahoo per tanggal | `gabung_ohlc_stockbit.py`: tanggal ada di Stockbit → Stockbit (o/h/l/c/v); tanggal hanya di Yahoo → Yahoo apa adanya | harga Yahoo vs Stockbit terukur 0,00% beda; volume Yahoo 2,66% bar salah vs Stockbit = IDX 100,00%; 30.245 bar hanya-Yahoo "diselamatkan"; satuan volume emiten sama (rasio median 1,0000 atas 345.454 bar) | **tafsir agen** atas kutipan Johan di docstring skrip — *"kalau mau saya yang lengkap saja dari sumber yang lengkap juga"* — yang bisa dibaca sebagai "pakai satu sumber yang lengkap", bukan "gabungkan" | **perlu keputusan ulang**: (a) tetap union tapi tiap bar diberi penanda sumber di berkas dan disebut di antarmuka, atau (b) Stockbit saja (kehilangan bar hanya-Yahoo: pra-2004 dan 38 hari IHSG) |
| J2 | IHSG `ihsg_ohlc_ringkas.json` / `ihsg_harian` = Yahoo 1990–1999 + Stockbit 2000→ | `jahit_ihsg.py` (commit `d217d247`); Yahoo melapor volume dalam **lot**, Stockbit **lembar** (rasio median tepat 100,00) → disamakan | 8.861 bar; volume 0 tinggal 1.261 (semua pra-2000) | agen, dilaporkan ke Johan | **perlu konfirmasi**: Stockbit tidak punya pra-2000, jadi pra-2000 hanya bisa Yahoo — keputusannya "tampilkan dengan penanda sumber per periode" atau "potong di 2000" |
| J3 | Volume `ohlc/` Yahoo ditimpa Stockbit (langkah sebelum J1) | `ganti_volume_ohlc.py` | Yahoo 2,66% bar bervolume salah; cadangan asli di `_arsip-mentah/ohlc-yahoo-sebelum-ganti-volume/` | agen (23 Agu) | sudah tercakup J1 |
| J4 | `fundamental/<KODE>.json` = yfinance `info` + `ListedShares` IDX + tambalan ruas kosong dari `keuangan_idx` (mis. `eps` = net income ÷ shares) | `fetch_fundamental.py` → `sinkron_emiten.py` → `lengkapi_fundamental.py` → `segarkan_harga_fundamental.py` (urutan wajib: penambal SESUDAH pemanen, karena pemanen menulis ulang dari nol) | 154 emiten `eps` kosong ditambal dari pembilang/penyebut yang ada | agen (17–18 Agu) | **perlu keputusan**: sumber fundamental resmi PAPAN = yfinance / IDX XBRL / Stockbit keystats (±94 rasio, sudah dipanen, belum dipakai)? Johan: *"dulu dapat data fundamental dari yahoo finance, sekarang pakai API Stockbit, tapi dia bingung dan diam2 memutuskan sendiri, jahit sendiri"* — tabel pembanding tiga sumber (sampel emiten × rasio × nilai) belum pernah dibuat |
| J5 | Stock Detail menggabung `keuangan_idx` (IDX XBRL) + `keuangan` (yfinance) saat dibaca | `app/src/lib/dasbor/fundamentalGabungan.ts:198-199` | tidak ada tabel pembanding yang tercatat | agen | **perlu keputusan** — bagian dari J4 |
| J6 | `ihsg_harian.json`: cadangan Yahoo `^JKSE` sementara bila PDF IDX belum terbit, ditimpa saat PDF terbit | `panen_ihsg.py` | tercatat di `status-panen.md` 21 Agu | tercatat, Johan tahu | sah sebagai cadangan sementara **asalkan** antarmuka menandai "sementara (Yahoo)" sampai PDF masuk — belum dicek apakah ditandai |
| J7 | Open riwayat: IDX `GetStockSummary` Open bolong (5–8% terisi pra-2025) → Open dari Yahoo, High/Low/Close/Volume dari IDX | aturan lama `sumber-data-harga.md` "Aturan pakai" | terukur Jan 2020–Agu 2026 | agen (15 Agu), aturannya "wajib disebut di antarmuka" | ❓ apakah masih berlaku setelah `ohlc/` beralih ke Stockbit (Stockbit punya Open penuh sejak 2004) — perlu ditelusuri di `panen_ohlc.py` |
| J8 | Aliran asing rupiah di halaman = **taksiran** lembar × (value ÷ volume), meleset 1,33× kumulatif | `panen_asing.py` sengaja tidak menyimpan rupiah; halaman menaksir | angka resmi rupiah sudah ada di `ohlcv_stockbit/` (`foreignbuy`/`foreignsell` chartbit) tapi belum dipakai | agen | **perlu keputusan**: ganti taksiran dengan angka chartbit (butuh tabel pembanding lembar-IDX vs rupiah-Stockbit per emiten × tanggal dulu) |

### Keputusan arah — Johan, 23 Agu 2026 (sesi AI Skill)

Kutipan: *"kalau ada yang lengkap kenapa tidak di pakai dan harus seperti ini tidak buang saja tapi di update ke lebih baru lagi dan ditulis di referensi html juga"* · *"Fundamental … harus nya juga berpikir untuk di ganti ke data stockbit atau gabungan atau jahit itu yang lengkap pasang, sisanya dari cadangan misal dari yahoo finance atau IDX"* · *"jika data lebih lengkap dari API Stockbit kenapa gak diubah dari sumber API saja, yahoo jadi cadangan atau cuman jahitan jika memang data lampau tidak ada"*.

Prinsip yang mengikat ke depan (Johan 23 Agu, menyetujui matriks kanonik): *"namanya pengembangan terus menerus dan dapat data lebih baru artinya merotasi data yang lebih fresh, lengkap, update dijadikan utama kemudian data yahoo misal jadi cadangan dengan jelas diuji terlebih dahulu"* — rotasi sumber adalah proses berulang, bukan sekali. Arah sudah diputuskan; angkanya belum — aturan 3b tetap berlaku: sebelum data/halaman diubah, sesi Papan Trading membuat tabel pembanding dan menunggu "ya" Johan di sesi itu.

| Jahitan | Arah yang diputuskan | Yang harus ada sebelum diubah | Status |
|---|---|---|---|
| J1 `ohlc/` emiten | Stockbit chartbit = sumber utama harga & volume; Yahoo hanya cadangan/jahitan untuk tanggal yang memang tidak ada di Stockbit (pra-2004, hari yang hilang) — bukan union setara; bar dari cadangan ditandai di berkas dan disebut di antarmuka; Yahoo asli tetap disimpan di `_arsip-mentah/ohlc-yahoo-sebelum-ganti-volume/` | tabel per emiten: jumlah & rentang bar hanya-Yahoo; cara menandai sumber per bar; dampak ke Kartu/Screener/Watchlist | arah diputuskan 23 Agu; eksekusi sesi Papan Trading |
| J2 `ohlc/IHSG` | Stockbit 2000→ utama; Yahoo hanya 1990–1999 (riwayat yang tidak dimiliki Stockbit), ditandai per periode | verifikasi sambungan lot→lembar ×100; penandaan periode di Indeks Dunia/Beranda | arah diputuskan |
| J4/J5 fundamental Stock Detail | keystats Stockbit (94 rasio, per kuartal Q1–Q4 + TTM) = utama rasio/valuasi; IDX XBRL = utama angka laporan resmi; yfinance = cadangan untuk ruas yang kosong di keduanya; tidak ada yang dibuang | tabel pembanding 3 sumber (sampel emiten × rasio × nilai × tanggal); pemetaan 94 rasio → 25 ruas yang dipakai halaman; satuan (B = miliar, %, ×100) | arah diputuskan |
| J8 aliran asing rupiah | `foreignbuy/foreignsell` chartbit (resmi, rupiah) menggantikan taksiran lembar × harga; lembar IDX tetap cadangan/pembanding | tabel taksiran vs chartbit per emiten × tanggal | arah diputuskan |
| keystats / `info_stockbit` / `profil` IDX menganggur | dipakai atau diusulkan pemakaiannya — tidak dibiarkan | rencana halaman pemakai | diputuskan: tidak boleh menganggur |
| J9 laporan keuangan per periode | IDX XBRL (parsing resmi) = utama; Stockbit = tambalan periode/ruas kosong; yfinance terakhir. Johan: *"seperti ini baru di jahit kan data dari XBRL resmi di parsing, lalu di tambal dari Stockbit itu pun jika stockbit menyediakan 2 tahun saja, belum di uji jika ternyata menyediakan sejak 2019 juga"* | uji kedalaman: keystats terbukti 3 ruas × 2024–2026 (5 emiten); pecahkan parameter `/findata-view/company/financial` (`report_type`/`period_type`/`data_type` dari Network DevTools) — kalau 2019→ tersedia, tabel pembanding XBRL vs Stockbit per periode | arah diputuskan 23 Agu; uji endpoint belum |
| J10 statistik pasar | IDX PDF resmi = utama; dilengkapi turunan chartbit se-pasar (breadth, Σ nilai/volume/frekuensi, top stocks) untuk riwayat pra-2026-01-07 dan ruas yang PDF tak punya. Johan: *"ini wajar memang hasil dari parsing data tapi bisa di lengkapi datanya dengan OHLC dari Stockbit"* | cocokkan definisi tiap statistik PDF vs turunan chartbit pada hari yang sama (selisih harus 0 untuk nilai/volume/frekuensi pasar) | arah diputuskan |
| J11 seasonality | Stockbit penuh — `/seasonality/{kode}?year=N` atau turunan chartbit 2000→; Yahoo bulanan jadi cadangan. Johan: *"seasonality jika melihat ruas-ruas itu mestinya lengkap dari stockbit jadi data nya"* | bandingkan tabel musiman Stockbit vs hitungan sendiri dari chartbit vs Yahoo (sampel emiten × tahun); catat `year≤3` kosong | arah diputuskan |
| Broker level pasar | IDX hanya daftar broker + agregat vol/val/frek (tanpa isi per emiten); isi broker = Stockbit marketdetectors. Johan: *"broker level pasar memang tidak ada tapi IDX menyediakan data broker SAJA tanpa isi"* | — | dicatat |

Aturan umumnya masuk ke `~/.claude/CLAUDE.md` klausul 3c dan `kemampuan-workflow.md` §WF-206 (cara kerja 3b, kasus 7): sumber terlengkap jadi utama, sumber lama jadi cadangan, tidak dibuang, ditulis di referensi.

### Estimasi panen penuh dari Stockbit — terukur 23 Agu 2026 (bukan taksiran)

Asal: Johan — *"cek API Stockbit, jika semua emiten di tarik datanya dalam tahun 2026 estimasi berapa lama? … untuk membuktikan percakapan kita di atas di inject ke PAPAN … hingga semua emiten sejak IPO dapat datanya dari stockbit"*.

Ukuran yang dipakai (diukur langsung): latensi chartbit riwayat penuh **0,82 s**/panggilan (1,5–1,9 MB, 4.383–5.606 bar); latensi marketdetectors 1 hari 1 varian **0,27 s**; throughput nyata runner `backfill_broker_massal.py --paralel 12` hari ini **23.179 berkas/jam rata-rata (6,44 panggilan/detik), puncak 44.363/jam** — dari mtime 255.163 berkas arsip yang ditulis 23 Agu; berkas marketdetectors rata-rata 4,7 KB; hari bursa 2026 s/d 21 Agu = **149**; emiten = **962**.

| Lapis | Panggilan | Waktu pada throughput terukur | Disk (arsip mentah) | Catatan |
|---|---|---|---|---|
| OHLCV chartbit, riwayat penuh semua emiten + IHSG | 963 (sekali) | **sudah selesai 23 Agu** (963/963); ulang penuh ≈ 37 menit berurutan dengan jeda 1,5 s | 1,3 GB di `ohlcv_stockbit/` | "sejak IPO" = sejauh server Stockbit punya: 2000–2004 untuk emiten (diuji `to=1980`), 1997-07 untuk IHSG; lebih tua dari itu hanya Yahoo (ABDA 2001, IHSG 1990) → jahitan cadangan yang ditandai |
| OHLCV penyegaran harian (`from=hari ini`) | 962/hari | ≈ 13 menit tanpa jeda, ≈ 37 menit dengan jeda 1,5 s | kecil | cukup sekali sehari sesudah tutup bursa |
| Broker 12 varian, **2026 saja** (149 hari × 962 emiten) | 1.720.056 (27 emiten sudah: 48.276) → ≈ 1,67 jt | **≈ 72 jam rata-rata (3 hari) · ≈ 38 jam pada puncak** | ≈ 7,9 GB | di luar git (`_arsip-mentah/` di `.gitignore`); gz akan memangkas ±10× |
| Broker 12 varian, **2017–2025** (±1.160 hari × 962) | ≈ 13,4 jt | **≈ 24 hari** rata-rata (`workflow-panen-rombak.md` menaksir 31 hari untuk 1.309 hari — konsisten) | ≈ 63 GB mentah → ±6 GB gz | gelombang 300-300-sisanya urut likuiditas (keputusan Johan); server mulai 2017 — "sejak IPO" tidak mungkin untuk broker |
| Broker 12 varian, harian ke depan | 11.544/hari | ≈ 30 menit | ≈ 54 MB/hari | langkah 3d `panen-harian-rumah.yml` (masih 3 varian — naikkan ke 12) |
| keystats + profil + info, semua emiten | 2.886 | ≈ 1,8 jam berurutan dengan jeda; mingguan/bulanan cukup | ±120 MB | snapshot, jarang berubah |

Yang belum diketahui dan harus dicatat saat runner jalan: batas laju resmi Stockbit tidak terdokumentasi (puncak 12,3 panggilan/detik hari ini tanpa penolakan yang tercatat di arsip — perlu dicek log 429/403); token akses 24 jam + refresh 7 hari berputar (hanya satu runner yang boleh me-refresh); ToS Stockbit untuk penarikan massal lewat token akun.

#### Skala paralel untuk broker 12 varian 2026 (≈ 1,67 jt panggilan) — Johan: *"saat ini kan pakai 12 paralel ya? jika 24 jika 36 estimasi waktunya berapa?"*

Siklus per pekerja di `backfill_broker_massal.py` = `--jeda` 0,8 s (bawaan) + latensi 0,27 s ≈ **1,07 s** → batas teori 12 pekerja ≈ 11,2 panggilan/detik ≈ 40 rb/jam — cocok dengan puncak terukur 44 rb/jam; rata-rata terukur 23 rb/jam lebih rendah karena backoff (`jeda × 2^beruntun`, maks 60 s), jeda 30 s saat 429, dan penulisan berkas. Jadi yang membatasi adalah jeda runner sendiri, bukan server — menambah pekerja (atau memangkas `--jeda`) menaikkan laju **linear sampai Stockbit mulai membatasi** (429) — batas itu belum diketahui; puncak 12,3 panggilan/detik hari ini lolos.

| Paralel | Batas teori (1,07 s/siklus) | Pada rata-rata terukur 23 rb/jam × (n/12) | Pada puncak terukur 44 rb/jam × (n/12) | Catatan |
|---|---|---|---|---|
| 12 (sekarang) | 40 rb/jam → **41 jam** | **72 jam** (3,0 hari) | **38 jam** | terbukti berjalan tanpa 429 yang tercatat |
| 24 | 81 rb/jam → 21 jam | 36 jam | 19 jam | ❓ belum diuji: pantau 429 & latensi 1 jam pertama; tabrakan refresh token makin mungkin (catatan `:62`) |
| 36 | 121 rb/jam → 14 jam | 24 jam | 13 jam | ❓ risiko 429 naik; kalau dibatasi, waktu kembali ke angka 12 paralel + jeda 30 s per 429 |
| 12 dengan `--jeda 0,3` | 0,57 s/siklus → 76 rb/jam → 22 jam | — | — | alternatif tanpa menambah koneksi serentak |

Angka 24/36 adalah batas atas asumsi linear; yang sah adalah mengukur 1 jam pada 24 lebih dulu (hitung berkas/jam dari mtime seperti hari ini) sebelum 36.

**Urutan pembuktian konkret yang diusulkan** (masing-masing menghasilkan angka yang bisa dicek Johan): (1) `ohlc/` kanonik dari `ohlcv_stockbit` + tanda sumber per bar — bukti: jumlah bar bertanda Yahoo per emiten (seharusnya hanya pra-Stockbit + hari hilang) dan halaman menampilkan "Sumber: Stockbit" — nol jaringan, bisa selesai hari ini; (2) broker 12 varian 2026 semua emiten ≈ 3 hari — bukti: `status-panen.md` baris broker per emiten 962/962 untuk 2026 + 11 varian terolah ke JSON halaman; (3) keystats → `fundamental/` kanonik dengan pemetaan 94 → 25 ruas — bukti: tabel pembanding 3 sumber per emiten sampel; (4) backfill 2017–2025 bergelombang ≈ 24 hari — bukti: `status-panen.md` naik per gelombang. Tiap langkah: tabel pembanding dulu, "ya" Johan di sesi Papan Trading, baru ubah (aturan 3b).

## IDX — `TradingSummary/GetStockSummary`

- **URL / endpoint:** `https://www.idx.co.id/primary/TradingSummary/GetStockSummary?date=YYYYMMDD&length=9999&start=0` (parameter dari `panen_asing.py:87`, `sinkron_emiten.py:38`, `idx_net.py:126`)
- **Jenis:** API tidak resmi (JSON yang dipakai halaman idx.co.id sendiri)
- **Akses & batasan:** wajib User-Agent peramban; **IP datacenter ditolak** (GitHub Actions, Netlify → 403; diuji 16 Agu 2026), IP rumahan 200. Satu permintaan = seluruh pasar (963 emiten) untuk satu tanggal. **Arsip mulai 2020-01-02** — tanggal sebelum itu membalas 200 dengan `data: []` (diuji 18 Agu 2026: 2019-12-30, 2019-12-27, 2019-12-02, 2019-09-02, 2018, 2015, 2010 semua 0 baris). Hari libur juga 0 baris, bukan galat.
- **Berkas lokal:** `data-idx/json/asing/<KODE>.json` — 989 emiten, 2020-01-02 → 21 Agu 2026, ruas `tanggal, beli, jual, volume, value, frekuensi`, satuan lembar/lembar/lembar/rupiah/kali (diukur, bukan ditebak: se-pasar 18 Agu ForeignBuy 5,03e9 vs Volume 2,88e10 — sebagai lembar 17% volume, wajar; sebagai rupiah 0,04% nilai, mustahil). Mentah ter-gzip di `_arsip-mentah/asing/<tahun>/<YYYYMMDD>.json.gz` (1.729 berkas, 140 MB) — menambah ruas = `panen_asing.py --dari-arsip`, 29 detik, nol permintaan. `daftar_emiten.json` dari `ListedShares` (`sinkron_emiten.py`).
- **Dipakai untuk:** Stock Detail, Aliran Asing, Broker Summary (Flow, Nego, AsingEmiten), Grafik Emiten (`GrafikEmiten.tsx:1693`), Panel Aliran Asing Beranda, turunan `aliran_investor.json`
- **Bukti di kode:** `scripts/panen_asing.py:87`, `scripts/sinkron_emiten.py:38`, `scripts/idx_net.py:126`, `scripts/cek_broker_summary.py:10`

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| `ForeignBuy`, `ForeignSell` (lembar) | ✅ | inti aliran asing | Johan (panen 18 Agu) |
| `Volume`, `Value`, `Frequency` | ✅ | penyerta di `asing/`; `Frequency` tidak ada di Yahoo | Johan (panen 18 Agu) |
| `ListedShares` | ✅ | daftar emiten + jumlah saham (`sinkron_emiten.py`) | Johan (21 Agu, "Panen Lagi") |
| `OpenPrice`, `High`, `Low`, `Close`, `Previous`, `Change` | ❌ di `asing/` | Open bolong parah pra-2025 (5–8% terisi); High/Low/Close/Volume sejak 2020 pernah jadi aturan sumber riwayat (`sumber-data-harga.md`), sekarang `ohlc/` berbasis Stockbit | **belum diputuskan** — apakah IDX masih dipakai sebagai pembanding harga atau dilepas |
| `Bid`, `Offer` + volume antrean penutupan | ❌ | tidak ada di Yahoo maupun Stockbit chartbit; belum ada halaman yang butuh | **belum diputuskan** |
| `TradebleShares` | ❌ | bahan turnover = Volume ÷ TradebleShares (`sumber-data-harga.md` "Apa yang bisa dibangun") | **belum diputuskan** |
| `NonRegularVolume`/`Value`/`Frequency` (pasar nego/tunai) | ❌ | pembanding untuk varian NEGO/TUNAI Stockbit | **belum diputuskan** |
| `Remarks` (kode papan & notasi khusus) | ❌ | overlap dengan `info_stockbit/` (notasi, UMA) | **belum diputuskan** |
| `IndexIndividual`, `ListedValue`, `WeightForIndex` dan ±16 ruas lain | ❌ | belum pernah diinventaris satu per satu — total ±32 ruas ada di mentah `_arsip-mentah/asing/` | ❓ inventaris ruas demi ruas belum dibuat; bisa dibuat dari satu berkas gz tanpa jaringan |
| Tanggal < 2020-01-02 | ❌ | sumbernya memang tidak menyajikan (uji 18 Agu) | terbukti — bukan keputusan |

## IDX — statistik PDF harian, mingguan, bulanan

- **URL / endpoint:** `https://www.idx.co.id/primary/Statistic/GetStatistic` (`download_idx.py:62`) untuk daftar + unduhan PDF dari `idx.co.id/id/data-pasar/...`; parser `parse_idx_pdf.py` (harian), `parse_idx_weekly.py`, `parse_idx_monthly.py` (`MS<YYMM>-E`)
- **Jenis:** dataset unduhan (PDF resmi IDX)
- **Akses & batasan:** rumahan (`JALANKAN_OTOMATIS.bat`, `download_idx.py --hari-ini --jenis semua`); PDF harian kadang terbit sore → cadangan Yahoo `^JKSE` sementara (J6). Mingguan ikut `update.yml` (Actions).
- **Berkas lokal:** `data-idx/json/index.json` + `ds_<YYYYMMDD>.json` (146 hari, isi terakhir 21 Agu 2026), `index_weekly.json` + `ws_*` (33 pekan, 14 Agu), `index_monthly.json` + `ms_*` (11 bulan, Sep 2025–Jul 2026)
- **Dipakai untuk:** Beranda, Indeks Dunia, Top Stocks, Top Broker (broker level pasar dari PDF), Sektor & Indeks, Statistik Berkala (chip Bulanan #203), Radar, Bulletin, `tanggalBursa.ts`
- **Bukti di kode:** `scripts/download_idx.py:62`, `app/src/lib/dasbor/dataHarian.ts:4,184`, `statistikBerkala.ts:296-297`, `views/dasbor/TopBroker.tsx`

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| PDF harian: ringkasan indeks, top broker, top stocks, breadth, nilai/volume/frekuensi pasar | ✅ ruas yang diparse `parse_idx_pdf.py` | halaman pasar | Johan (18 Agu, tabel status-panen) |
| PDF mingguan / bulanan | ✅ | Statistik Berkala | Johan (20 Agu #203) |
| Tabel lain di dalam PDF yang TIDAK diparse (daftar lengkap tabel per PDF belum dicatat) | ❓ | parser hanya mengambil tabel yang dipakai halaman; tabel sisanya belum diinventaris | ❓ inventaris tabel per jenis PDF belum dibuat — bisa dibuat dari satu PDF tanpa jaringan |
| Jenis statistik lain di `GetStatistic` (tahunan, fact book, dsb.) | ❓ | belum diuji | **belum diputuskan** |

## IDX — `TradingSummary/GetBrokerSummary`

- **URL / endpoint:** `https://www.idx.co.id/primary/TradingSummary/GetBrokerSummary?date=YYYYMMDD` (`fetch_broker_summary.py:33`, `cek_broker_summary.py:9`)
- **Jenis:** API tidak resmi
- **Akses & batasan:** rumahan 200 (16 Agu 2026); **parameter `code`/`stockCode`/`kodeEmiten` DIABAIKAN** — selalu 88 broker level pasar (diuji ulang 22 Agu 2026: jawaban identik). Broker per emiten tidak tersedia dari IDX — itu yang membuat Stockbit `marketdetectors` dan setoran kontributor dibutuhkan.
- **Berkas lokal:** `data-idx/json/broker/<tgl>.json` + `broker/index.json` (756 berkas, 21 Agu 2026); CI `panen-harian-rumah.yml` langkah 3c sejak 22 Agu
- **Dipakai untuk:** Broker Summary (`brokerHarian.ts:84,104,194`), Broker Summary v2 (Nego, Overview), Top Broker (versi PDF)
- **Bukti di kode:** `scripts/fetch_broker_summary.py:33`

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| `IDFirm`, `FirmName`, `Volume`, `Value`, `Frequency` × 88 broker/hari | ✅ | satu-satunya isi endpoint | Johan (#159) |
| Broker per emiten | ❌ | endpoint tidak menyediakan (parameter diabaikan, diuji 16 & 22 Agu) | terbukti — bukan keputusan; dijawab Stockbit marketdetectors |

## IDX — `ListedCompany/GetFinancialReport` + XLSX ber-XBRL

- **URL / endpoint:** `https://www.idx.co.id/primary/ListedCompany/GetFinancialReport?indexFrom=1&pageSize=1000&year=YYYY&reportType=rdf&EmitenType=s&periode=tw1|tw2|tw3|audit&kodeEmiten=&SortColumn=KodeEmiten&SortOrder=asc` (`panen_keuangan_idx.py:192`); lampiran `Attachments[].File_Path` (spasi → `%20`)
- **Jenis:** API + unduhan XLSX (~300 KB/emiten, 47 sheet, dwibahasa, tidak terenkripsi)
- **Akses & batasan:** rumahan, UA peramban; 777 dari 778 emiten TW2 2026 punya `.xlsx`; panen penuh ≈ 230 MB, hanya perlu saat rilis kuartalan. **Mentah TIDAK dibuang** (Johan 17 Agu: *"jangan asal maen buang data yang sudah di panen"*) — diarsipkan di `_arsip-mentah/`, pemanen membaca arsip lebih dulu. **Penambal wajib jalan SESUDAH pemanen** (pemanen menulis ulang dari nol).
- **Berkas lokal:** `data-idx/json/keuangan_idx/<KODE>.json` (949; 2019–2025 + interim 2024 TW1/TW2 dari kolom pembanding XLSX 2025, 827/949 tanpa jaringan), `pengendali.json` (`panen_pengendali.py`), kuartal diskret ⚙️ (`turunkan_kuartal_diskret.py`: 10.800 periode; pengurangan DITOLAK bila mata uang dua periode beda)
- **Dipakai untuk:** Stock Detail (PanelLaporanKeuangan, KolomLaporan, fundamentalGabungan), `valuasi_historis.json`, `lengkapi_fundamental.py` (J4), `panen_sektor_idx.py`
- **Bukti di kode:** `scripts/panen_keuangan_idx.py:192`, `scripts/panen_pembanding.py`, `scripts/panen_pengendali.py`, `scripts/turunkan_kuartal_diskret.py`

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| Sheet `1000000` informasi umum (sektor/subsektor/industri IDX-IC resmi, standar akuntansi, **pemegang saham pengendali**) | ✅ pengendali (`pengendali.json`); sektor via `emiten_sektor.json` | #157, #158 | Johan (backlog 16 Agu) |
| Sheet `4220000` neraca (238 baris), `4312000`/`4322000` laba rugi, `4410000` ekuitas, `4510000`/`4520000` arus kas | ✅ ruas utama diperas ke `keuangan_idx/` | pos inti + kolom pembanding | Johan (#156) |
| Sheet `4611000`–`4695000` catatan atas laporan keuangan per pos | ❌ | tidak diperas; mentahnya ada di `_arsip-mentah/` jadi menambah ruas tanpa jaringan | **belum diputuskan** |
| `instance.zip` / `inlineXBRL.zip` (XBRL mentah) | ❌ | XLSX sudah ber-tag; parsing XBRL mentah belum dibutuhkan | **belum diputuskan** |
| PDF laporan resmi emiten | ❌ | versi cetak dari data yang sama | **belum diputuskan** |
| Kuartal diskret Q1–Q4 | ⚙️ turunan | Q2 = TW2 − TW1, dst.; neraca tidak dikurangi; mata uang beda → null; 10.800 periode | terbukti turunan (aturan tercatat di status-panen) |
| Tahun buku 2016–2019 | ❌ | IDX tidak menyajikan — panen 2016–2019 habis satu siklus penuh sebelum ketahuan (18 Agu) | terbukti — bukan keputusan |

## IDX — profil, sektor, saham tercatat, berita & pengumuman

- **URL / endpoint:** `ListedCompany/GetCompanyProfilesDetail` (`panen_profil_idx.py:10,49`), `ListedCompany/GetCompanyProfiles?start=0&length=1000&emitenType=s` (`panen_sektor_idx.py:45`, `fetch_fundamental.py:150`), `StockData/GetSecuritiesStock` (`fetch_fundamental.py:146`), `NewsAnnouncement/GetNewsSearch` (`panen_kabar.py:164`), `ListedCompany/GetAnnouncement` (`panen_kabar.py:184`), `NewsAnnouncement/GetAllAnnouncement` (`fetch_investor_map.py:41`)
- **Jenis:** API tidak resmi
- **Akses & batasan:** rumahan; `idx_net.get()` jeda 1,5 dtk (requests polos kena Cloudflare); berita/pengumuman dari datacenter 403 → `panen-kabar-rumah.yml` (PC harus menyala)
- **Berkas lokal:** `profil/` (962 emiten, 22 Agu), `emiten_sektor.json`, `daftar_emiten.json`, `kabar.json` (bagian IDX, 18 Agu 21:56 WIB)
- **Dipakai untuk:** `emiten_sektor.json` → Stock Detail, Kartu Analisa (`sektorIdx.ts:56`); `kabar.json` → Beranda, Kabar Pasar; **`profil/` belum dipakai halaman mana pun** (`status-panen.md`, dikonfirmasi grep `app/src` nol)
- **Bukti di kode:** lihat baris endpoint di atas

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| Profil detail 962 emiten (alamat, BAE, industri, subindustri, email, situs, jenis efek) | ✅ dipanen, ❌ belum dipakai | pelengkap metadata Yahoo | **belum diputuskan** halaman pemakainya |
| Sektor/subsektor IDX-IC | ✅ | menggantikan klasifikasi Yahoo (#157) | Johan |
| `GetSecuritiesStock` — ruas selain daftar saham | ❓ | dipakai `fetch_fundamental.py:146` untuk daftar; isi lain belum dicatat | ❓ inventaris ruas belum dibuat |
| Berita IDX, pengumuman IDX (judul, tautan, waktu) | ✅ | Kabar Pasar | Johan (18 Agu) |
| Isi pengumuman (lampiran PDF keterbukaan informasi, aksi korporasi) | ❌ | hanya judul/tautan yang disimpan | **belum diputuskan** |

## Stockbit — `chartbit/<KODE>` (OHLCV + aliran asing rupiah)

- **URL / endpoint:** `https://exodus.stockbit.com/chartbit/<KODE>?…` (`panen_ohlcv_stockbit.py:49`); token dari `https://exodus.stockbit.com/login/refresh` (`stockbit_token.py:8,71`)
- **Jenis:** API tidak resmi, memakai token login akun Stockbit
- **Akses & batasan:** butuh akun + refresh token; 963/963 emiten berhasil 23 Agu 2026. Riwayat sejak 2004 (BBCA 5.537 bar). Volume terbukti = IDX 100,00%. **Churn git**: berkas ditulis ulang utuh → ±101 MB/hari kalau disegarkan harian → `ohlcv_stockbit/` berkala saja, harian tetap lewat `ohlc/`.
- **Berkas lokal:** `data-idx/json/ohlcv_stockbit/<KODE>.json` (963; bar terakhir 21 Agu 2026) — digabung ke `ohlc/` oleh `gabung_ohlc_stockbit.py` (J1)
- **Dipakai untuk:** Broker Summary v2 langsung (`brokerEmitenV2.ts:6,50`); lewat `ohlc/` → Grafik Emiten, Tanya PAPAN, Watchlist, Kartu Analisa, Screener, Seasonality Harian
- **Bukti di kode:** `scripts/panen_ohlcv_stockbit.py:49`, `scripts/gabung_ohlc_stockbit.py`, `scripts/ganti_volume_ohlc.py`

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| `o h l c v` harian sejak 2004 | ✅ | sumber harga utama sejak 23 Agu | Johan (*"ayolah ambil semua data itu"*) — cara penggabungannya (J1) belum |
| `foreignbuy`, `foreignsell` (rupiah, resmi) | ✅ dipanen, ❌ belum dipakai halaman | menggantikan taksiran 1,33× (J8) | **belum diputuskan** |
| Resolusi selain harian (intraday, mingguan) | ❓ | parameter belum terpecahkan (`workflow-panen-rombak.md` §4) | **belum diputuskan** |
| Ruas lain di balasan chartbit (kalau ada) | ❓ | belum diinventaris ruas demi ruas dari satu balasan mentah | ❓ |

## Stockbit — `marketdetectors/<KODE>` (broker per emiten, 12 varian)

- **URL / endpoint:** `https://exodus.stockbit.com/marketdetectors/<KODE>` dengan parameter papan (`REGULER`/`NEGO`/`TUNAI`), tipe investor (`ALL`/`FOREIGN`/`DOMESTIC`), transaksi (`GROSS`/`NET`), rentang tanggal (`panen_broker_harian.py:66`)
- **Jenis:** API tidak resmi, token akun
- **Akses & batasan:** beban 12 varian × 1.309 hari × 961 emiten ≈ 31 hari paralel 12 → **keputusan Johan: 300 — 300 — sisanya** urut likuiditas (`backfill_broker_massal.py --paralel 12`, resume otomatis dari arsip). CI harian masih 3 varian — belum dinaikkan ke 12.
- **Berkas lokal:** `data-idx/json/broker_harian/` (145.834 berkas, 22 emiten per 23 Agu siang), `broker_tahunan/` (⚙️ `bangun_broker_tahunan.py`)
- **Dipakai untuk:** Broker Summary v2 (Overview, Inventory, FlowNetGross, Nego, TimelineForeign, VsIhsg)
- **Bukti di kode:** `scripts/panen_broker_harian.py:66`, `scripts/backfill_broker_massal.py`, `scripts/bangun_broker_tahunan.py`

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| REGULER × ALL × GROSS/NET, REGULER × FOREIGN × GROSS/NET | ✅ | inti | Johan (23 Agu) |
| NEGO × (ALL/FOREIGN) × (GROSS/NET) | ✅ | transaksi nego nyata | Johan (23 Agu) |
| TUNAI × (ALL/FOREIGN) × (GROSS/NET) | ✅ | **hampir dilewatkan** — "kelihatan kosong"; uji 4 emiten × 3 tanggal: 3 dari 12 berisi (BUMI 15 Jul 2 broker, TPIA 21 Agu 3, TPIA 15 Jul 2) | Johan (23 Agu) |
| DOMESTIC (× papan × transaksi) | ⚙️ turunan | BUMI 21 Agu 2026: ALL − FOREIGN = DOMESTIC cocok persis, beli (997.576.688.400) dan jual (48.185.368); diulang lewat API langsung 23 Agu 2026: ANTM & TLKM pada 21 Agu dan 14 Agu 2026 — 406 baris broker (beli + jual), **0 beda**, Σ lot dan Σ rupiah ALL − FOREIGN = DOMESTIC persis di keempat kasus | terbukti turunan (3 emiten × 2 tanggal) — hemat sepertiga beban |
| NET diturunkan dari GROSS | ❌ (NET dipanen) | dua percobaan gagal: `padatkan()` khusus GROSS; memakai `bvalv`/`svalv` cocok sebagian (BUMI 9/80, BBCA 19/69, TPIA 19/74) | dipanen sampai aturannya terbaca — bukan ditebak |
| Emiten 301–963 | ❌ sementara | gelombang 2–3 | Johan (300-300-sisanya) |
| Riwayat sebelum 2017 | ❓ | endpoint mulai 2017 menurut `workflow-panen-rombak.md` — batas sumber, belum diuji ulang | ❓ |

## Stockbit — `keystats`, `emitten` (profil & info), Snips, dan endpoint yang belum terpecahkan

- **URL / endpoint:** `https://exodus.stockbit.com/keystats/<KODE>` (`panen_keystats_stockbit.py:49`); `https://exodus.stockbit.com/emitten/<KODE>` (`panen_profil_stockbit.py:45`, `panen_info_stockbit.py:52`); `https://snips.stockbit.com/sitemap.xml`, `/snips-terbaru`, `?format=json` (`panen_snips.py:13,44,116`)
- **Jenis:** API tidak resmi (token) · Snips: situs publik (Squarespace JSON)
- **Akses & batasan:** token akun; keystats/profil/info snapshot → cukup mingguan/bulanan. Snips ikut `panen-kabar.yml` yang **belum pernah jalan sekalipun** sejak langkahnya ditambahkan 18 Agu.
- **Berkas lokal:** `keystats_stockbit/` (963), `profil_stockbit/` (963), `info_stockbit/` (963), `snips.json` (238, 14 Agu)
- **Dipakai untuk:** `profil_stockbit/` → Shareholders v2 (`brokerProfilKsei.ts:5,136`); `snips.json` → Beranda, Kabar Pasar; **`keystats_stockbit/` dan `info_stockbit/` belum dibaca halaman mana pun** (grep `app/src` 23 Agu nol)
- **Bukti di kode:** baris di atas; inventaris endpoint lengkap + jebakan parameter: `docs/riset/stockbit-inventaris-endpoint.md` (22 Agu) dan `docs/riset/stockbit-chartbit-ohlcv.md`

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| keystats ±94 rasio (valuasi, profitabilitas, solvabilitas, per-saham, dividen) | ✅ dipanen, ❌ belum dipakai | kandidat pengganti/pembanding rasio yfinance (J4) | **belum diputuskan** — siapa sumber rasio resmi |
| profil: pemegang saham, anak usaha | ✅ | Shareholders v2 | Johan (23 Agu) |
| info: keanggotaan indeks, notasi khusus, UMA | ✅ dipanen, ❌ belum dipakai | overlap `Remarks` IDX | **belum diputuskan** |
| Snips: judul, tautan, waktu | ✅ | Kabar Pasar | Johan (14 Agu) |
| Top Broker level pasar (Stockbit) | ❓ | parameter belum terpecahkan | **belum diputuskan** |
| Laporan keuangan per periode (Stockbit) | ❓ | parameter belum terpecahkan; tumpang tindih XBRL IDX | **belum diputuskan** |
| Aksi korporasi | ❓ | parameter belum terpecahkan | **belum diputuskan** |
| Intraday | ❓ | parameter belum terpecahkan | **belum diputuskan** |
| Orderbook | ❌ | paywall Stockbit Pro | **belum diputuskan** (berbayar) |
| Fundachart | ❓ | parameter belum terpecahkan | **belum diputuskan** |
| `GET /seasonality/{kode}?year=N` — tabel musiman per bulan per tahun (up/down, rata-rata, probabilitas) | ❌ tidak diambil | terbukti hidup (`docs/riset/stockbit-inventaris-endpoint.md` 22 Agu); `year≤3` kosong | **belum diputuskan** — kandidat pengganti Yahoo bulanan di Seasonality |
| `GET /chartbit/initial/{kode}` (nama, bursa, zona waktu), `GET /search?keyword=&type=company` | ❌ | terbukti hidup, belum dibutuhkan | **belum diputuskan** |
| Endpoint yang 404 "Unrecognized Command" | — | daftar di `docs/riset/stockbit-inventaris-endpoint.md` | terbukti tidak ada |

## Yahoo Finance — `v8/finance/chart` dan pustaka `yfinance`

- **URL / endpoint:** `https://query1.finance.yahoo.com/v8/finance/chart/<KODE>.JK` (`panen_ohlc.py:99`, `panen_seasonality.py:83`, `seasonality_bakrie.py:74`, `lonjakan_bakrie.py:77`); `yfinance` (`fetch_fundamental.py`, `fetch_keuangan.py`)
- **Jenis:** API tidak resmi (chart) · pustaka pihak ketiga (yfinance) ke API yang sama
- **Akses & batasan:** bebas, jeda sopan, satu emiten = satu permintaan (962 permintaan untuk satu hari, vs IDX satu permintaan untuk semua). **`range=max` dengan `interval=1d` diturunkan diam-diam ke bulanan** → selalu `period1`/`period2`. Riwayat IDX di Yahoo praktis mulai ±2000, awal seri tiap emiten berbeda tanpa pola (ASII Okt 2000 padahal IPO 1990; ANTM kehilangan 8 tahun) — **kalimat "sejak IPO" dilarang di antarmuka**. Volume emiten 2,66% bar salah (terukur vs IDX); volume indeks dilaporkan dalam **lot**.
- **Berkas lokal:** `ohlc/` bagian Yahoo (tanggal tanpa Stockbit; cadangan asli `_arsip-mentah/ohlc-yahoo-sebelum-ganti-volume/`), `ihsg_harian.json` cadangan `^JKSE`, `seasonality/harga_bulanan.json` (titik tertua Agu 2000), `fundamental/` (965), `keuangan/` (646)
- **Dipakai untuk:** Seasonality (bulanan), Indeks Dunia (IHSG pra-2000 lewat J2), dan semua pemakai `ohlc/` (J1), Stock Detail/Sektor/Watchlist/Kalkulator/Aliran Asing lewat `fundamental/` (J4), PanelLaporanKeuangan lewat `keuangan/` (J5)
- **Bukti di kode:** baris di atas; `app/src/lib/seasonalityData.ts:26`, `stockDetailData.ts:7,217-239`

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| OHLCV harian (chart) | ✅ sebagai pengisi `ohlc/` | dulu utama; sekarang hanya tanggal tanpa Stockbit (J1) | **perlu keputusan ulang** (J1) |
| IHSG 1990–1999 | ✅ | Stockbit tidak punya pra-2000 (J2) | **perlu konfirmasi** (J2) |
| Penutupan bulanan (seasonality) | ✅ | `panen_seasonality.py` | Johan (15 Agu) — dengan catatan "bukan sejak IPO" |
| `info`: 15 ruas fundamental + rasio turunan (PER, PBV, ROE, Altman Z, F-Score, beta, target analis, median sektor) | ✅ | `fetch_fundamental.py`; rasio turunan inilah keunggulan Yahoo vs XBRL mentah | Johan (rencana 16 Agu: IDX untuk angka mentah, Yahoo untuk turunan) — **tapi sekarang tersaingi keystats Stockbit (J4)** |
| Laporan keuangan yfinance (646 emiten; `operating_cf` 80% kosong, `eps` 71% kosong) | ✅ | `fetch_keuangan.py` | **perlu keputusan**: masih dipakai atau diganti XBRL IDX sepenuhnya (J5) |
| `range=max` harian | ❌ | diturunkan ke bulanan diam-diam | terbukti — bukan keputusan |

## KSEI — Balancepos bulanan dan holding composition

- **URL / endpoint:** `https://web.ksei.co.id/Download/BalanceposEfek<YYYYMMDD>.zip` (`panen_ksei_balancepos.py:10`); `https://web.ksei.co.id/archive_download/holding_composition/` (`panen_ksei_balancepos.py:9`, `fetch_investor_map.py`)
- **Jenis:** dataset unduhan resmi (ZIP pipe-delimited bulanan; arsip komposisi)
- **Akses & batasan:** bebas (diuji rumahan); bulanan, bukan harian
- **Berkas lokal:** `kepemilikan/` (1.035 emiten, Jan 2020 → Jul 2026, 79 bulan, lokal & asing × 9 tipe investor), `investor_map.json` + `.meta.json`
- **Dipakai untuk:** Shareholders v2 (`brokerProfilKsei.ts:3,27`), Peta Investor (`petaInvestorData.ts:7,11,63`, `PetaInvestor.tsx:56`), `graphRender.ts:669`, `seasonality_bakrie.py`, `petakan_grup.py`
- **Bukti di kode:** baris di atas

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| Balancepos: lokal & asing × 9 tipe investor per emiten per bulan | ✅ | Shareholders v2 | Johan (21 Agu "Panen Lagi") — **`status-panen.md` perlu dikoreksi**: menulis "belum dipakai halaman mana pun" padahal dibaca `brokerProfilKsei.ts:27` |
| Holding composition | ✅ | Peta Investor | Johan |
| Arsip KSEI sebelum Jan 2020 | ❓ | belum diuji apakah tersedia | **belum diputuskan** |
| Berkas KSEI lain di halaman unduhan (mis. daftar efek, statistik investor) | ❓ | belum diinventaris | ❓ |

## Kabar — IPOT, Kontan, Google News

- **URL / endpoint:** IPOT `https://www.indopremier.com/ipotnews/nw-saham.php?level4=…` (`panen_kabar.py:281`, `panen_ipot_arsip.py:84`), `https://www.indopremier.com/module/newsresearch/ajax/ajax_generalNewsPagesMore.php` (`panen_kabar.py:245`); Kontan `https://investasi.kontan.co.id/rss` (`panen_kabar.py:452`); Google News `https://news.google.com/rss/search?q=…` dengan 3 kueri `saham IHSG when:1d`, `"Bursa Efek Indonesia" when:1d`, `emiten saham when:1d` (`panen_kabar.py:414`)
- **Jenis:** situs (scrape) · RSS · RSS publik
- **Akses & batasan:** IPOT mengabaikan parameter `halaman` (halaman 0/1/5/50 membalas 200 item yang sama) → pemanen berhenti kalau halaman **kembar persis**, bukan kalau "tak ada item baru" (tanpa ini: 1.000 permintaan 20 menit untuk nol hasil). Google News: kueri longgar (`bursa when:1d`, `saham`) sengaja TIDAK dipakai — menyeret bursa kerja/kripto/saham AS; **belum terbukti tembus dari IP datacenter GitHub**. Dedup dua lapis (dalam-sumber tautan+judul+waktu; lintas-sumber judul).
- **Berkas lokal:** `kabar.json` (331 item; IPOT 20 Agu 08:26, Google News 20 Agu 08:41, IDX & Kontan 18 Agu 21:56 WIB), `ipot_arsip.json`
- **Dipakai untuk:** Kabar Pasar (`kabar.ts:94-100`), Beranda
- **Bukti di kode:** baris di atas

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| IPOT: judul, tautan, waktu, arsip lama | ✅ | Kabar Pasar | Johan |
| IPOT: isi artikel penuh | ❌ | hanya judul/tautan | **belum diputuskan** |
| Kontan RSS | ✅ | — | Johan |
| Google News 3 kueri | ✅ | 45 mentah → 40 unik (20 Agu) | Johan (20 Agu) |
| Google News per emiten (960 kueri) | ❌ | 960 permintaan/hari tak masuk akal | Johan (20 Agu, tercatat `panen-kabar.md`) |
| Sumber kabar lain (CNBC Indonesia, Bisnis, Investor Daily, emitennews) | ❓ | belum diuji | **belum diputuskan** |

## indexalpha (`api.indexalpha.id`) — ❓ belum dipastikan

- **URL / endpoint:** `https://api.indexalpha.id` (`panen_broker_emiten.py:86`), token `INDEXALPHA_TOKEN=ia_live_…` dari dasbor indexalpha.id (`panen_broker_emiten.py:50`), dipilih lewat `--sumber indexalpha` (`:63`)
- **Jenis:** API pihak ketiga (kemungkinan berbayar — belum dipastikan)
- **Akses & batasan:** ❓ — skripnya menyediakan jalur ini sebagai alternatif `stockbit` untuk broker per emiten; tidak ada berkas keluaran yang bisa dilacak ke sumber ini
- **Berkas lokal:** tidak ditemukan
- **Dipakai untuk:** ❓ tidak ada halaman yang terlacak memakainya
- **Bukti di kode:** `scripts/panen_broker_emiten.py:22,50,63,86`

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| Broker per emiten (menurut tabel di kepala skrip) | ❓ | jalur ada di kode, pemakaian nyata tidak terlacak | **belum diputuskan** — perlu Johan konfirmasi apakah akun/token pernah ada |

## Setoran kontributor, Supabase, dan unggahan admin

- **URL / endpoint:** Supabase (`app/src/lib/supabaseSetoran.ts`; URL/kunci lewat env, tidak ditulis di sini); unggahan lewat halaman `/admin`
- **Jenis:** unggahan manusia (tangkapan layar broker summary per emiten dari aplikasi sekuritas) + basis data eksternal + kurasi admin
- **Akses & batasan:** akun admin; kualitas bergantung kontributor; IDX `GetBrokerSummary` tidak bisa menggantikannya (parameter emiten diabaikan) — sejak 23 Agu sebagian tergantikan Stockbit marketdetectors untuk 22 emiten gelombang 1
- **Berkas lokal:** Supabase (tabel setoran), `arus-pasar/keluaran/` (hasil `arus-pasar/build.py`), `data-idx/radar/r_YYMMDD.json` (Radar Unggah), `data-idx/radar/rbu/`
- **Dipakai untuk:** Deep Dive, Bulletin Arus Pasar, Kartu Analisa, Radar Watchlist, Forum/Feedback (konten pengguna)
- **Bukti di kode:** `app/src/lib/supabaseSetoran.ts:9`, `views/admin/KurasiSetoran.tsx:202,621`, `views/admin/RadarUnggah.tsx:83`, `views/dasbor/Bulletin.tsx:112-115`

| Tersedia (inventaris lengkap) | Diambil? | Alasan / bukti | Keputusan |
|---|---|---|---|
| Tangkapan layar broker per emiten + hasil kurasi | ✅ | satu-satunya sumber broker per emiten sebelum 23 Agu | Johan |
| Radar harian (unggahan admin) | ✅ | — | Johan |
| Penggantian setoran oleh Stockbit marketdetectors untuk emiten yang sudah dipanen | ❓ | belum diputuskan apakah setoran masih diperlukan untuk 22 emiten gelombang 1 | **belum diputuskan** |

## Keputusan "tidak diambil" / ganti sumber / jahit

| Sumber · ruas | Jenis keputusan | Alasan | Bukti (tabel pembanding / angka) | Diputuskan oleh | Tanggal |
|---|---|---|---|---|---|
| Stockbit marketdetectors · DOMESTIC | tidak diambil (turunan) | ALL − FOREIGN | BUMI 21 Agu 2026: beli 1.227.466.284.000 − 229.889.595.600 = 997.576.688.400 = DOMESTIC; jual 62.432.794 − 14.247.426 = 48.185.368 = DOMESTIC; diulang lewat API langsung 23 Agu 2026: ANTM & TLKM pada 21 Agu dan 14 Agu 2026 — 406 baris broker (beli + jual), **0 beda**, Σ lot dan Σ rupiah ALL − FOREIGN = DOMESTIC persis di keempat kasus (Johan: *"tidak hanya di BUMI coba test 2 emiten lagi"*) | terbukti turunan | 23 Agu 2026 |
| Stockbit marketdetectors · NET | diambil (bukan diturunkan) | dua percobaan turunan gagal | BUMI 9/80, BBCA 19/69, TPIA 19/74 broker cocok | agen, dicatat | 23 Agu 2026 |
| Stockbit marketdetectors · emiten 301–963 | ditunda | beban ≈ 31 hari | 12 × 1.309 × 961 | Johan | 23 Agu 2026 |
| IDX GetStockSummary · rupiah aliran asing | tidak disimpan | IDX tidak melaporkan rupiah; taksiran bukan data | — | agen, dicatat `sumber-data-harga.md` | 18 Agu 2026 |
| IDX GetStockSummary · `net` | tidak disimpan (turunan) | `beli − jual`, +15% berat tanpa informasi baru | — | terbukti turunan | 18 Agu 2026 |
| `ohlc/` · gabung Stockbit ∪ Yahoo (J1) | jahit | "lengkap" | harga 0,00% beda; volume Yahoo 2,66% salah; 30.245 bar hanya-Yahoo | **tafsir agen** atas kutipan Johan | 23 Agu 2026 — **perlu keputusan ulang Johan** |
| IHSG · Yahoo 1990–1999 + Stockbit 2000→ (J2) | jahit | Stockbit tidak punya pra-2000 | lot vs lembar rasio 100,00; 8.861 bar | agen, dilaporkan | 23 Agu 2026 — **perlu konfirmasi Johan** |
| `ohlc/` · volume Yahoo → Stockbit (J3) | timpa | volume Yahoo salah 2,66% | = IDX 100,00% | agen | 23 Agu 2026 — tercakup J1 |
| `fundamental/` · yfinance + IDX ListedShares + tambalan XBRL (J4) | jahit per ruas | ruas kosong ditambal | 154 emiten `eps` | agen | 17–18 Agu 2026 — **perlu keputusan Johan: sumber rasio resmi** |
| Stock Detail · gabung `keuangan_idx` + `keuangan` (J5) | jahit saat baca | — | tidak ada tabel pembanding | agen | — **perlu keputusan Johan** |
| `ihsg_harian` · cadangan Yahoo sementara (J6) | timpa sementara | PDF terbit sore | — | tercatat status-panen | 21 Agu 2026 — sah kalau ditandai di antarmuka |
| Aliran asing rupiah · taksiran vs chartbit (J8) | belum diganti | angka resmi sudah ada di `ohlcv_stockbit/` | taksiran meleset 1,33× | — | **belum diputuskan** |
| Konvensi harga & volume · tersesuaikan vs apa adanya (J12) | **batas ditetapkan** | dua konvensi, dua-duanya benar; yang salah menyilangkannya | 936 emiten: 129.723/1.173.805 bar beda (11,05%), 167 emiten >5%; rasio pembeda BULAT (250·25·5·4·2); DSSA volume ×25 & harga ÷25 sampai Mar 2026 lalu 1,00 (pecah saham 1:25) | **Johan** (*"ok tulis"*) | 23 Agu 2026 |


## J12 · Dua konvensi harga & volume — tersesuaikan vs apa adanya (ketetapan Johan, 23 Agu 2026)

Asal: Johan *"artinya data yang valid pakai data marketdetector yaa ?"* → *"ok tulis"* → *"masukkan di referensi proyek juga"*.

Jawabannya **bukan** "marketdetectors yang valid". Dua endpoint memakai konvensi berbeda dan **dua-duanya benar**; yang salah adalah memakai satu untuk pertanyaan milik yang lain.

| Endpoint / berkas | Konvensi | Cocok dengan bursa? |
|---|---|---|
| Stockbit chartbit → `ohlcv_stockbit/`, `ohlc/` | **tersesuaikan** ke aksi korporasi (harga dibagi, volume dikali faktor) | tidak, di emiten ber-aksi-korporasi |
| Stockbit marketdetectors → `_arsip-mentah/broker-harian/` | **apa adanya** saat itu | ya, 1,0000 persis |
| IDX `GetStockSummary` → `asing/` | **apa adanya** saat itu | ya (ia sendiri sumbernya) |

### Terukur 23 Agu 2026

Sapuan 936 emiten, chartbit vs angka bursa: **129.723 dari 1.173.805 bar berbeda >1% (11,05%)**, **167 emiten** dengan >5% barnya berbeda. Rasio pembedanya BULAT — 250,00 · 25,00 · 5,00 · 4,00 · 2,00 — karena itu faktor pemecahan saham, bukan sebaran galat.

Bukti telak pada DSSA (rasio per bulan, chartbit ÷ bursa):

| Bulan | Volume | Harga |
|---|---|---|
| 2025-05 … 2026-03 | ×25,00 | ÷25,00 (0,0400) |
| 2026-04 … 2026-08 | 1,00 | 1,00 |

Pecah saham 1:25 efektif April 2026. Chartbit menyesuaikan **keduanya**, jadi deretnya konsisten di dalam dirinya sendiri.

### Batas yang ditetapkan

- **`ohlc/` tetap tersesuaikan.** Memaksanya jadi angka apa adanya membuat DSSA terbaca **jatuh 96% dalam sehari** padahal cuma pecah saham — dan merusak tiap hitungan return lintas tahun di 167 emiten.
- **Perhitungan broker seluruhnya dari arsip broker.** Pembilang dan penyebut satu rumah, tak pernah bersilang.
- **`asing/` tetap angka bursa, dan JANGAN dibagi dengan volume `ohlc/`.**

### Gejala kalau dilanggar

Rasio yang **seragam**, bukan sebaran acak. BNBR terbaca 0,8511 selama 1.554 hari — di sisi beli DAN jual, pada hari dengan 65 broker maupun 2 broker. Daftar broker yang terpotong akan memberi gejala berbeda: kedua sisi tak sama, dan rasionya ikut jumlah broker.

### Tiga dugaan yang sudah gugur — jangan diulang dari nol

1. **Reguler vs nego** — gugur: reguler saja sudah cocok persis di 6 emiten pada 21 Agu 2026; menambah nego malah membuat BNBR 3,03×.
2. **Volume berasal dari Yahoo** — gugur: 6.333 dari 6.389 bar BNBR sama persis dengan Stockbit, hanya 30 dengan Yahoo.
3. **Aksi korporasi di jumlah saham** — gugur: `shareoutstanding` tetap 173.416.832.509 di kedua sisi tanggal patah.

Yang akhirnya memutuskan: wasit independen. Angka bursa di `asing/` cocok **1,0000** dengan endpoint broker, tidak dengan endpoint harga.

### Belum dikerjakan

Berkas faktor penyesuaian per emiten per tanggal (bisa dihitung dari rasio chartbit ÷ bursa, **nol jaringan**) supaya kedua konvensi bisa disandingkan kalau suatu saat perlu. Belum ada keputusan Johan untuk membuatnya.

## Inventaris ruas per berkas — jawaban untuk Johan 23 Agu 2026 (Stock Detail, OHLC/OHLCV, Broker Summary, metode panen)

Asal: Johan, 23 Agu 2026 — *"Data Fundamental yang ada di page stock detail dapat darimana mana saja? … Data OHLC … OHLCV … Broker Summary dapat darimana dan isinya apa saja? … metode panen apa saja darimana mana saja"*. Dibaca langsung dari berkas (`data-idx/json/*`, `_arsip-mentah/*`) dan kode (`app/src/**`) pada 23 Agu 2026 — bukan dari dokumen. "17 ruas reguler" = 17 kolom chartbit Stockbit; "12" = 12 kelompok keystats Stockbit (atau 12 varian broker).

### Fundamental di Stock Detail — berkas yang dibaca halaman

| Berkas | Sumber asal | Isi (ruas) | Rentang waktu | Dipakai Stock Detail untuk |
|---|---|---|---|---|
| `fundamental/<KODE>.json` (967) | **Yahoo `yfinance.info`** + turunan lokal + **IDX `ListedShares`** (`sinkron_emiten.py`) + tambalan dari `keuangan_idx` (`lengkapi_fundamental.py`, ruas turunan dicatat di `asal_turunan`, mis. `der`) + harga disegarkan dari `ohlc/` | 151 ruas: identitas, harga/52w/MA, valuasi (`pe pb ps peg ev_ebitda…`), per-saham (`eps bv fcf_ps`), solvabilitas, margin, growth, dividen (`div_history`), TTM (`ttm_*`), neraca terakhir (`lq_*`), kuartal `q_*`, tahunan `hist_*`, `price_perf` 28, turunan (`altman_z f_score roic roce`), median sektor | snapshot `updated` 2026-08-17; `hist_*` 2022–2025; `q_*` 2025–2026; `div_history` 2021–2026; harga 2026-08-21 | header, KolomValuasi, PanelValuasiInteraktif — 25 ruas dipakai: `shares pe eps roe pb payout_ratio npm dividend_yield bv roic roa ps opm market_cap gpm ev_ebitda sector_pe_median peg interest_coverage free_float_pct f_score der current_ratio beta altman_z` |
| `keuangan/<KODE>.json` (646) | **Yahoo `yfinance`** laporan keuangan | 15 ruas: `revenue cogs gross_profit operating_income net_income eps operating_cf investing_cf financing_cf free_cf total_assets total_liabilities equity total_debt cash` | kuartal 2024-12-31 → 2026-06-30 (6, diskret); tahunan 2021–2025 (5); `diperbarui` 2026-08-16 | PanelLaporanKeuangan (lewat `fundamentalGabungan.ts`) |
| `keuangan_idx/<KODE>.json` (949) | **IDX `GetFinancialReport` XLSX-XBRL** (`sumber: idx-xbrl`) | 15 ruas yang sama + `mata_uang`/`kurs_laporan` per periode | tahunan 2019–2025 (7); kuartal interim 2024-03-31 → 2026-06-30 (7, **kumulatif YTD**, didiskretkan saat dibaca); `diperbarui` 2026-08-20 | PanelLaporanKeuangan, `valuasi_historis` |
| `pengendali.json` | IDX XBRL sheet `1000000` | pemegang saham pengendali per emiten | panen 19–22 Agu | blok pengendali |
| `valuasi_historis.json` | ⚙️ turunan `keuangan_idx` + `ohlc/` | P/E & P/B per tahun buku, basis jumlah saham hari ini | 2019 → | PanelValuasiHistoris |
| `asing/<KODE>.json` (989) | **IDX `GetStockSummary`** | `tanggal beli jual volume value frekuensi` (lembar/rupiah) | 2020-01-02 → 2026-08-21 | panel asing |
| `emiten_sektor.json` | IDX `GetCompanyProfiles` | sektor/subsektor IDX-IC | 22 Agu | label sektor |

Stock Detail = **Yahoo + IDX**. KSEI tidak dipakai di halaman ini. **Stockbit belum dipakai** — padahal sudah dipanen dan lebih lengkap:

| Berkas Stockbit (dipanen, belum dibaca halaman mana pun) | Isi | Rentang |
|---|---|---|
| `keystats_stockbit/<KODE>.json` (963) | **94 rasio** dalam 12 kelompok: Current Valuation, Per Share, Solvency, Management Effectiveness, Profitability, Growth, Dividend, Market Rank, Income Statement, Balance Sheet, Cash Flow Statement, Price Performance; `financial_year_groups` per tahun Q1–Q4 + annualised + TTM; `most_recent_quarter` | snapshot 23 Agu 2026, Q2 2026 (30 Jun); riwayat per tahun di `financial_year_groups` |
| `profil_stockbit/<KODE>.json` (963) | `shareholder` (13 ruas: percentage name value type nationality scripless scrip classification…), `subsidiary`, `key_executive`, `shareholder_one_percent`, `beneficiary`, `listing_information`, `history`, `background` | 23 Agu (dipakai hanya Shareholders v2) |
| `info_stockbit/<KODE>.json` (964) | `indexes` (keanggotaan indeks), `notation`, `uma`, `corp_action`, `sector/sub_sector/industry`, `trading_limit_info`, `margin_info`, `day_trade_info` | 23 Agu |
| `profil/<KODE>.json` IDX (963) | `pemegang_saham` (+ flag `pengendali`), `anak_usaha`, `direksi`, `komisaris`, `komite_audit`, `kap`, `dividen`, `obligasi`, `papan`, `tanggal_tercatat` | 22 Agu |

Cara halaman menggabung (`fundamentalGabungan.ts`, aturan tertulis di kode): `keuangan` (Yahoo) menang kalau ada → padanan periode sama dari `fundamental` → TTM hanya di periode terbaru → IDX XBRL didiskretkan dulu (interim kumulatif: TLKM 1,96×, ASII 1,99× kalau tidak) → tiap angka bertanda asal (`keuangan / fundamental-kuartal / -tahunan / -ttm / -kini / idx / idx-kumulatif / yahoo`) dengan superscript + tooltip di `KolomLaporan.tsx`. Jahitan fundamental **ditandai per angka di antarmuka** — beda dari `ohlc/` yang tidak (J1).

### OHLC dan OHLCV — emiten + IHSG dua-duanya

| Berkas | Sumber | Kolom | Cakupan | Rentang | Pemakai |
|---|---|---|---|---|---|
| `ohlc/<KODE>.json` (963 emiten) | **Stockbit chartbit utama ∪ Yahoo** untuk tanggal tanpa Stockbit (`gabung_ohlc_stockbit.py`; volume Stockbit) | 6: `tanggal o h l c v` | emiten | BBCA 2004-01-02 → 2026-08-21: 5.537 bar = 5.483 Stockbit + 54 hanya-Yahoo | Grafik Emiten, Tanya PAPAN, Watchlist, Kartu, Screener, Seasonality Harian |
| `ohlc/IHSG.json` | **Yahoo 1990–1999 + Stockbit 2000→** (`jahit_ihsg.py`) | 6 | IHSG | 1990-04-06 → 2026-08-21, 8.861 bar | lewat `ihsg_ohlc_ringkas` |
| `ihsg_ohlc_ringkas.json` | potongan 250 hari terakhir dari `ohlc/IHSG` | 6 | IHSG | 2025-08-06 → 2026-08-21 | Beranda, Indeks Dunia |
| `ihsg_harian.json` | **Yahoo `^JKSE` saja** (potongan 5 tahun, `period1/2`) | `tutup`, `buka` per tanggal | IHSG | 1990-04-06 → 2026-08-21, 8.853 | Diary, Indeks Dunia, Seasonality Harian, `tanggalBursa`, Kartu |
| `ohlcv_stockbit/<KODE>.json` (963) + `ohlcv_stockbit/IHSG.json` | **Stockbit chartbit murni** | **17**: `tanggal unixdate open high low close volume value frequency foreignbuy foreignsell foreignflow dividend shareoutstanding soxclose freq_analyzer lot` | emiten + IHSG | 2004-01-02 → 2026-08-21 (BBCA 5.483 bar), dipanen 23 Agu | hanya Broker Summary v2; bahan `ohlc/` |
| `_arsip-mentah/ohlc-yahoo-sebelum-ganti-volume/` (964) | Yahoo asli sebelum ditimpa | 6 | emiten + IHSG | cadangan untuk membatalkan jahitan | — |

`foreignbuy/foreignsell/foreignflow` rupiah di 17 kolom itu ada tetapi belum dibaca halaman — halaman masih menaksir rupiah asing dari lembar IDX (meleset 1,33×, J8).

### Broker Summary — dari mana, isinya apa

| Berkas | Sumber | Isi | Cakupan & rentang | Pemakai |
|---|---|---|---|---|
| `broker/bs_YYMMDD.json` (757) | **IDX `GetBrokerSummary`** | 88 broker × 5 ruas `kode nama vol val frek` — **level pasar** (parameter emiten diabaikan) | 2023-06-15 → 2026-08-21 | Broker Summary v1, Top Broker, v2 Nego/Overview |
| `_arsip-mentah/broker-harian/<KODE>/<tgl>.<varian>.json` | **Stockbit `marketdetectors`**, mentah | per berkas: `broker_summary.brokers_buy/brokers_sell` **10 ruas** (`blot blotv bval bvalv netbs_broker_code netbs_buy_avg_price netbs_date netbs_stock_code type freq`) + `bandar_detector` **13 ruas** (`average avg avg5 broker_accdist number_broker_buysell top1 top3 top5 top10 total_buyer total_seller value volume`) | **27 emiten, 220.923 berkas, 12 varian/hari** — akhiran: `.json` (REGULER·ALL·GROSS), `.asing`, `.nego`, `.nego-asing`, `.tunai`, `.tunai-asing`, `.net`, `.net-asing`, `.net-nego`, `.net-nego-asing`, `.net-tunai`, `.net-tunai-asing`; AMMN 2023-07-07 →, BBCA ±1.026 hari | **belum ada halaman** — baru arsip |
| `broker_harian/<KODE>.json` (27) | olahan Stockbit, **hanya varian GROSS·reguler·ALL** | 5 kolom `broker beli_lot beli_nilai jual_lot jual_nilai` + `ringkas` 10 metrik (`n_beli n_jual total_lot total_nilai avg top1_pct top3_pct top5_pct accdist cocok_volume`) | jendela 20 hari: 2026-07-24 → 08-21 | bahan `broker_tahunan` |
| `broker_tahunan/<KODE>/<tahun>.json` | olahan Stockbit (`bangun_broker_tahunan.py`) | 5 kolom yang sama per hari + `ringkas` | **hanya BUMI**, 2017 → (11 berkas) | Broker Summary v2 (`brokerEmitenV2.ts:147`) |
| `kepemilikan/<KODE>.json` (1.036) | **KSEI Balancepos** bulanan | 22 kolom: `lembar_tercatat harga` + lokal × 9 tipe (IS CP PF IB ID MF SC FD OT) + total + asing × 9 + total | 2020-01-31 → 2026-07-31 (79 bulan; emiten baru lebih pendek) | Shareholders v2 |
| `profil_stockbit` → `shareholder` | Stockbit | 13 ruas per pemegang | 23 Agu | Shareholders v2 |
| setoran kontributor (Supabase) | tangkapan layar aplikasi sekuritas | broker per emiten hasil kurasi | berjalan | Deep Dive, Kartu |
| `_arsip-mentah/broker-emiten/stockbit/` (38) | `panen_broker_emiten.py` per rentang tanggal | mentah `bandar_detector` + `broker_summary` | ARCI dkk, Agu 2026 | — |

Temuan: 11 dari 12 varian (NEGO, TUNAI, FOREIGN, NET) **baru di arsip mentah**, belum diolah ke JSON yang dibaca halaman; `broker_tahunan` baru BUMI, jadi riwayat v2 efektif satu emiten; `broker_harian` jendela 20 hari, bukan riwayat.

### Metode panen

| Metode | Sumber | Skrip | Pemicu / jadwal | Jalan di |
|---|---|---|---|---|
| API JSON situs dengan User-Agent peramban + jeda (`idx_net.get`) | IDX `GetStockSummary`, `GetBrokerSummary`, `GetFinancialReport`+XLSX, `GetCompanyProfiles(Detail)`, berita/pengumuman | `panen_asing.py`, `sinkron_emiten.py`, `fetch_broker_summary.py`, `panen_keuangan_idx.py`, `panen_profil_idx.py`, `panen_sektor_idx.py`, `panen_kabar.py` | `panen-harian-rumah.yml` (self-hosted, Sen–Jum 18:30 WIB: daftar emiten → OHLC → asing → segarkan harga → broker pasar → broker per emiten 12 varian → kartu → kandidat deep dive → valuasi → seasonality); `panen-kabar-rumah.yml` tiap 2 jam; `JALANKAN_OTOMATIS.bat` [1–8]; manual "Panen Lagi" | IP rumahan wajib — datacenter 403 |
| Unduh PDF resmi + parse | IDX statistik harian/mingguan/bulanan | `download_idx.py`, `parse_idx_pdf.py`, `parse_idx_weekly.py`, `parse_idx_monthly.py` | `update.yml` (ubuntu, 21:00/23:00/01:00 WIB, + cadangan IHSG Yahoo), `update-rumah.yml` (22:00/02:00), bat [1–3] | awan + rumahan |
| API dengan token login akun (`stockbit_token.py` refresh) | Stockbit `chartbit`, `marketdetectors`, `keystats`, `emitten` | `panen_ohlcv_stockbit.py`, `panen_broker_harian.py` / `backfill_broker_massal.py --paralel 12`, `panen_keystats_stockbit.py`, `panen_profil_stockbit.py`, `panen_info_stockbit.py` | "Panen Lagi"; langkah 3d CI rumahan (harian); ohlcv/keystats/profil/info berkala, bukan harian (churn git ±101 MB/hari) | rumahan |
| Scrape HTML / JSON situs | IPOT (HTML + ajax), Stockbit Snips (Squarespace `?format=json`, sitemap) | `panen_kabar.py`, `panen_ipot_arsip.py`, `panen_snips.py` | `panen-kabar.yml` (ubuntu, tiap 2 jam) — Snips belum pernah jalan | awan |
| RSS | Kontan, Google News (3 kueri, dedup 2 lapis) | `panen_kabar.py` | tiap 2 jam | awan/rumahan |
| API Yahoo chart (`period1/period2`, potongan 5 tahun) | OHLC emiten (pengisi), IHSG 1990–1999, `^JKSE`, bulanan | `panen_ohlc.py`, `panen_ihsg.py`, `panen_seasonality.py` | bat [5/8], `update.yml` cadangan | bebas |
| Pustaka `yfinance` | `info` + laporan keuangan | `fetch_fundamental.py`, `fetch_keuangan.py`, lalu `lengkapi_fundamental.py` | `update-fundamental.yml` (ubuntu, akhir bulan) | awan |
| Unduh ZIP bulanan | KSEI Balancepos, holding composition | `panen_ksei_balancepos.py`, `fetch_investor_map.py` | manual | bebas |
| Turunan lokal, nol jaringan | gabung/jahit/diskret/valuasi/kartu/screener | `gabung_ohlc_stockbit.py`, `ganti_volume_ohlc.py`, `jahit_ihsg.py`, `turunkan_kuartal_diskret.py`, `panen_pembanding.py --semua-arsip`, `bangun_broker_tahunan.py`, `bangun_aliran_investor.py`, `hitung_valuasi_historis.py`, `kartu_analisa.py`, `bangun-screener.mjs`, `pola-screener.ts`, `petakan_grup.py` | sesudah pemanen | lokal |
| Unggahan manusia | setoran tangkapan layar, Radar `r_YYMMDD.json`, unggah PDF harian | halaman `/admin` → Supabase / `data-idx/radar/` | kapan pun | — |
| Arsip mentah dibaca dulu | `_arsip-mentah/` 20 folder (±240 rb berkas: asing 1.732 gz, broker-harian 220.923, keuangan_idx 9.786, ksei 79 zip, ohlc-yahoo 964, …) | semua pemanen (`--dari-arsip`) | menambah ruas tanpa jaringan | lokal |


## Matriks sumber — Stockbit menang di mana, duplikasi per halaman, dan usulan kanonik (23 Agu 2026)

Asal: Johan, 23 Agu 2026 — *"menurut kmu data stockbit menang dimana saja? dibanding Yahoo Finance, IDX, dan KSEI — supaya proyek PAPAN ini jelas data-datanya tidak setiap page inject dari data yang berbeda padahal itu 1 data jadi 2 sumber"* · *"bisa jadi campur aduk yang nanti nya cuman panen data lengkap tapi tidak di inject ke halaman yang tepat"*.

Verifikasi riwayat (bar pertama, dibaca dari berkas): ASII Stockbit 2000-10-17 = Yahoo Okt 2000; AALI 2001-04-05 = Yahoo Apr 2001; ANTM Stockbit 2004-01-02 vs Yahoo Sep 2005; BBCA 2004-01-02 vs Jun 2004; **ABDA Yahoo Okt 2001 lebih tua dari Stockbit 2003-01-01**; IHSG Stockbit 1997-07-01 (7.050 bar) vs Yahoo 1990-04-06 (8.853). Arsip Yahoo harian lokal hanya 2016-08-10→ (2.471 bar). **Diuji langsung ke API Stockbit 23 Agu 2026** (token akun, `to=1980-01-01`, `limit=0`, dari sesi AI Skill): ABDA 5.744 bar pertama 2003-01-01, IHSG 7.050 bar pertama 1997-07-01, ASII 6.320 bar pertama 2000-10-17 — **identik dengan arsip**, jadi kedalaman itu batas server Stockbit, bukan sisa panen. Jebakan lama sudah ditutup: lantai `to=2000-01-01` pernah memotong IHSG 7.050 → 6.426 bar (624 bar hilang karena parameter sendiri), lantai sekarang 1980-01-01 (`panen_ohlcv_stockbit.py:50-56`). Kesimpulan: Stockbit menang karena ISI (17 kolom, volume = IDX 100,00%, rupiah asing, saham beredar per hari), bukan karena selalu lebih panjang — Yahoo tetap sah sebagai jahitan pra-Stockbit per emiten yang memang butuh.

### A. Pemenang per jenis data

| Data | Stockbit | Yahoo Finance | IDX | KSEI | Pemenang → cadangan |
|---|---|---|---|---|---|
| OHLCV emiten harian | chartbit **17 kolom** (o h l c v, value, frequency, foreignbuy/sell/flow rupiah, dividend, shareoutstanding, soxclose, lot); riwayat 2000–2004→; volume = IDX 100,00% | 6 kolom; arsip kita 2016→; volume 2,66% bar salah; sebagian emiten lebih tua (ABDA 2001) | `GetStockSummary` ±32 ruas resmi, tapi 2020→, Open bolong, satu permintaan = seluruh pasar | — | **Stockbit** → Yahoo hanya hari/periode yang tidak ada di Stockbit (ditandai); IDX untuk ruas yang Stockbit tak punya (bid/offer, nonregular, tradeable shares) + pembanding resmi |
| IHSG harian | 1997-07-01→, 7.050 bar, volume lembar | 1990-04-06→, 8.853 bar, volume lot, 0 pra-1997 | PDF harian: penutupan resmi, arsip 2026-01-07→ (146 hari) | — | **Stockbit 1997→** → Yahoo hanya 1990–Jun 1997; IDX PDF angka resmi penutupan. ⚠️ jahitan sekarang memakai Yahoo sampai 1999 padahal Stockbit mulai 1997 — alasannya perlu dicek |
| Aliran asing | `foreignbuy/foreignsell/foreignflow` **rupiah** per bar, 2004→ | — | lembar, 2020→, resmi | — | **Stockbit** → IDX lembar pembanding/porsi volume |
| Broker per emiten | `marketdetectors` **12 varian**, 10 ruas broker + 13 ruas bandar_detector, 2017→ | — | tidak ada (parameter emiten diabaikan) | — | **Stockbit satu-satunya** → setoran kontributor |
| Broker level pasar | Top Broker belum terpecahkan | — | `GetBrokerSummary`: **daftar broker + agregat saja** (88 broker × vol/val/frek, 2023-06→) — tanpa isi per emiten | — | **IDX** untuk agregat pasar; **isi broker = Stockbit** (Johan 23 Agu: *"IDX menyediakan data broker SAJA tanpa isi"*) |
| Rasio fundamental siap pakai | keystats **94 rasio** per kuartal + TTM + annualised: valuasi, per-saham, solvabilitas, **bank (NPL, CAR, LDR, CASA, NIM, cost of credit)**, efektivitas, growth, dividen, **rank pasar & median IHSG**, price returns 1W–10Y | ±60 ruas (sebagian dihitung lokal), berlubang; unik: target analis, rekomendasi, beta, insider/institusi | bukan rasio — angka mentah | — | **Stockbit** → Yahoo hanya ruas yang Stockbit tak punya |
| Laporan keuangan per periode | Income/Balance/Cash Flow per kuartal **diskret** + TTM | 2021→ tahunan, 6 kuartal, 646 emiten, berlubang | XBRL **resmi**, 2019→, 777 emiten, ratusan pos, mata uang per periode, interim kumulatif | — | **IDX XBRL** (parsing resmi) = utama → **ditambal Stockbit** untuk periode/ruas yang kosong; kedalaman Stockbit lewat keystats **hanya 3 ruas (Net Income, EPS, Revenue) × 2024–2026** (diuji 5 emiten) — 2019→ hanya mungkin lewat `/findata-view/company/financial` yang parameternya belum terpecahkan; Yahoo terakhir (Johan 23 Agu) |
| Pemegang saham & anak usaha | profil: shareholder 13 ruas, >1%, beneficiary, subsidiary, key_executive | — | profil: pengendali resmi, direksi, komisaris, komite audit, KAP, dividen, obligasi, papan, tanggal tercatat; XBRL sheet 1000000 | — | **Stockbit** detail → **IDX** status resmi & tata kelola |
| Kepemilikan per tipe investor | — | — | — | Balancepos 22 kolom, 9 tipe × lokal/asing, bulanan 2020→ | **KSEI satu-satunya** |
| Indeks, notasi, UMA, aksi korporasi | info: `indexes`, `notation`, `uma`, `corp_action`, margin/day-trade | — | `Remarks` (tidak diambil) | — | **Stockbit** → IDX Remarks |
| Saham beredar | per hari (`shareoutstanding`) 2004→ | snapshot | `ListedShares` resmi harian 2020→ | — | **IDX** hari ini → **Stockbit** riwayat harian |
| Statistik pasar (breadth, nilai/frekuensi, top stocks, mingguan/bulanan) | chartbit se-pasar bisa diturunkan: breadth (naik/turun), Σ value/volume/frequency, top stocks by value — sejak 2004 | — | PDF resmi, arsip 2026-01-07→ | — | **IDX PDF resmi** = utama → **dilengkapi turunan Stockbit** untuk riwayat pra-2026 dan ruas yang PDF tak punya (Johan 23 Agu: *"bisa di lengkapi datanya dengan OHLC dari Stockbit"*) |
| Seasonality | endpoint `/seasonality/{kode}?year=N` (tabel musiman per bulan per tahun, up/down, rata-rata, probabilitas) **atau** turunan chartbit harian 2000→ | bulanan `range=max` (mulai ±2000, jebakan resolusi) | — | — | **Stockbit penuh** (Johan 23 Agu: *"mestinya lengkap dari stockbit jadi data nya"*); Yahoo bulanan dilepas jadi cadangan |
| Dividen | `dividend` per bar + grup Dividend keystats | `div_history` 2021→ | profil `dividen` | — | ❓ belum diuji — IDX resmi, Stockbit/Yahoo pembanding |
| Kabar | Snips saja | — | berita + pengumuman resmi | — | IDX + IPOT/Kontan/Google — bukan ranah Stockbit |

### B. "Satu data, dua sumber" yang sekarang terjadi di halaman

| Data | Rumah sekarang (sumber) | Halaman yang membacanya | Akibat |
|---|---|---|---|
| Harga terakhir | `fundamental.last_price` (Yahoo, disegarkan dari ohlc) · `harga_terakhir.json` · bar terakhir `ohlc/` · `ohlcv_stockbit` · `info_stockbit.price` · `kartu.harga` | Stock Detail · Watchlist/Kalkulator · Grafik · v2 · — · Kartu | 6 rumah untuk satu angka |
| IHSG | `ihsg_harian.json` (Yahoo murni) · `ohlc/IHSG` → `ihsg_ohlc_ringkas` (jahitan) · `index.json` (IDX PDF) | Diary, Seasonality Harian, `tanggalBursa`, Kartu · Beranda, Indeks Dunia · Statistik, Radar, Bulletin | tiga IHSG berbeda di tiga halaman |
| Saham beredar | `fundamental.shares` · `daftar_emiten` (IDX) · `ohlcv.shareoutstanding` · keystats | Stock Detail · kamusEmiten · v2 · — | market cap bisa beda antar halaman |
| Sektor | `fundamental.sector` (Yahoo) · `emiten_sektor` (IDX-IC) · `info_stockbit.sector` | Stock Detail header · Stock Detail/Kartu label · — | dua taksonomi di satu halaman |
| Pemegang saham | `pengendali.json` (XBRL) · `profil_stockbit` · `profil` IDX · `kepemilikan` KSEI | Stock Detail · Shareholders v2 · — · Shareholders v2 | Stock Detail dan v2 memakai sumber berbeda |
| Aliran asing | `asing/` lembar IDX (taksiran rupiah meleset 1,33×) · chartbit rupiah | Stock Detail, Aliran Asing, Broker Summary, Grafik · — | angka resmi ada, yang tampil taksiran |
| Laporan keuangan | `keuangan` Yahoo + `keuangan_idx` XBRL digabung · keystats | Stock Detail · — | gabungan ditandai per angka (baik), sumber ketiga menganggur |
| Broker per emiten | setoran kontributor · `broker_tahunan` Stockbit (BUMI) · arsip 12 varian 27 emiten | Deep Dive/Kartu · v2 · — | v2 hanya BUMI; arsip 220.923 berkas belum diolah |

### C. Usulan matriks kanonik — satu data, satu berkas, satu sumber utama, semua halaman membaca itu

| Dataset | Berkas kanonik (usulan) | Sumber utama | Cadangan (ditandai) | Halaman yang dialihkan |
|---|---|---|---|---|
| OHLCV emiten | `ohlc/<KODE>.json` dibangun dari `ohlcv_stockbit` (6 kolom + tanda sumber per bar; ruas tambahan tetap di `ohlcv_stockbit`) | Stockbit | Yahoo hanya tanggal tanpa Stockbit | semua pemakai `ohlc/`; v2 tetap baca ohlcv |
| IHSG | `ohlc/IHSG.json` (Stockbit 1997→ + Yahoo 1990–1997) → `ihsg_harian.json` diturunkan dari sini | Stockbit | Yahoo pra-1997; IDX PDF penutupan resmi | Diary, Seasonality Harian, tanggalBursa, Kartu |
| Harga terakhir | `harga_terakhir.json` diturunkan dari bar terakhir kanonik | Stockbit (lewat ohlc) | — | Stock Detail header, Watchlist, Kalkulator, Kartu |
| Aliran asing | `asing/<KODE>.json` ditambah rupiah dari chartbit | Stockbit rupiah | IDX lembar (tetap disimpan) | Stock Detail, Aliran Asing, Broker Summary, Grafik |
| Rasio fundamental | `fundamental/<KODE>.json` dipetakan dari keystats (94 → ruas halaman) | Stockbit | Yahoo untuk target/rekomendasi/beta/insider; IDX ListedShares | Stock Detail, Sektor, Aliran Asing, Watchlist, Kalkulator, Screener, Kartu |
| Laporan keuangan | `keuangan_idx/` (XBRL resmi diparsing) | IDX | **Stockbit** menambal periode/ruas kosong (keystats: 3 ruas × 2024–2026; lebih dalam hanya kalau `/findata-view` terpecahkan); Yahoo terakhir | Stock Detail PanelLaporanKeuangan |
| Saham beredar & sektor | `daftar_emiten.json` (IDX ListedShares + sektor IDX-IC) | IDX | Stockbit riwayat harian | Stock Detail header |
| Pemegang saham | satu berkas gabungan per emiten: pengendali (IDX resmi) + daftar Stockbit + KSEI per tipe | IDX resmi + Stockbit detail | — | Stock Detail, Shareholders v2 |
| Broker per emiten | `broker_harian/<KODE>.json` diolah dari arsip **12 varian**, semua emiten yang sudah dipanen | Stockbit | setoran kontributor | Broker Summary v2, Deep Dive, Kartu |
| Broker pasar | `broker/` | IDX | PDF | Broker Summary, Top Broker |
| Statistik pasar | `index.json`, `ds_*`, `ws_*`, `ms_*` | IDX PDF | turunan Stockbit chartbit se-pasar (breadth, Σ nilai/volume/frekuensi, top stocks) untuk riwayat pra-2026 & ruas tambahan | tetap |
| Seasonality | `seasonality/` dibangun dari Stockbit (`/seasonality` atau turunan chartbit 2000→) | Stockbit | Yahoo bulanan | Seasonality, Seasonality Harian, Komparasi |
| Kepemilikan tipe investor | `kepemilikan/` | KSEI | — | Shareholders v2 (+ Stock Detail kalau diputuskan) |
| Info/notasi/UMA/indeks | `info_stockbit/` → dipakai halaman | Stockbit | IDX Remarks | Stock Detail, Screener (belum ada) |

Prinsip: satu berkas kanonik per dataset, semua halaman membaca itu; sumber utama = yang terlengkap; cadangan hanya mengisi lubang dan selalu ditandai di berkas dan di antarmuka. Ini analisa dan usulan dari sesi AI Skill — eksekusinya (tabel pembanding angka, pemetaan 94 rasio → ruas halaman, pengalihan halaman) milik sesi Papan Trading setelah Johan menyetujui di sesi itu.


## Kamus ruas — arti tiap ruas dan data apa yang dihasilkannya (23 Agu 2026)

Asal: Johan, 23 Agu 2026 — *"saya gak dapat detail nya 12 varian itu apa saja, 10 ruas apa saja, 13 ruas apa, ada yang 17 ruas apa saja? dari ruas-ruas itu menghasilkan data apa saja itu yang belum terjelaskan detil"*. Semua arti di bawah dibuktikan dari nilai di berkas mentah (`_arsip-mentah/broker-harian/BBCA/2024-08-27*.json`, `2026-08-21*.json`; `ohlcv_stockbit/BBCA.json` bar 21 Agu 2026; `keystats_stockbit/BBCA.json`; `_arsip-mentah/asing/2026/20260821.json.gz`) — yang belum terbaca ditandai ❓, bukan ditebak.

### 12 varian broker per emiten — Stockbit `marketdetectors`

Tiga parameter permintaan: papan `market_board` (REGULER / NEGO / TUNAI) × investor `investor_type` (ALL / FOREIGN; DOMESTIC tidak dipanen karena = ALL − FOREIGN, terbukti) × transaksi `transaction_type` (GROSS / NET). Tiap hari-emiten = 12 berkas di `_arsip-mentah/broker-harian/<KODE>/<tanggal><akhiran>.json`.

| # | Papan | Investor | Transaksi | Akhiran arsip | Artinya & yang dihasilkan (contoh BBCA 27 Agu 2024) |
|---|---|---|---|---|---|
| 1 | REGULER | ALL | GROSS | `.json` | pasar reguler, semua investor, beli & jual dihitung terpisah — broker bisa di dua sisi (62 beli / 40 jual, 39 di keduanya). Σ beli_lot × 100 = Volume IDX tepat (`cocok_volume` 1,0000). Satu-satunya varian yang sudah diolah ke `broker_harian/` dan halaman |
| 2 | REGULER | FOREIGN | GROSS | `.asing.json` | transaksi investor asing saja → aliran asing per broker |
| 3 | NEGO | ALL | GROSS | `.nego.json` | pasar negosiasi (blok/crossing; 7 beli / 7 jual, `freq` 1) → transaksi besar di luar antrean |
| 4 | NEGO | FOREIGN | GROSS | `.nego-asing.json` | negosiasi oleh asing |
| 5 | TUNAI | ALL | GROSS | `.tunai.json` | pasar tunai (T+0); sering kosong (BBCA 27 Agu 2024: 0 baris) tapi TPIA/BUMI kadang berisi — alasan tetap dipanen |
| 6 | TUNAI | FOREIGN | GROSS | `.tunai-asing.json` | tunai oleh asing |
| 7 | REGULER | ALL | NET | `.net.json` | beli dikurangi jual per broker; broker hanya di satu sisi (55 net buyer / 8 net seller, 0 di keduanya) → daftar akumulator/distributor |
| 8 | REGULER | FOREIGN | NET | `.net-asing.json` | net asing per broker |
| 9 | NEGO | ALL | NET | `.net-nego.json` | net di pasar negosiasi |
| 10 | NEGO | FOREIGN | NET | `.net-nego-asing.json` | net asing di negosiasi |
| 11 | TUNAI | ALL | NET | `.net-tunai.json` | net di pasar tunai |
| 12 | TUNAI | FOREIGN | NET | `.net-tunai-asing.json` | net asing di tunai |
| ⚙️ | semua | DOMESTIC | semua | tidak dipanen | = ALL − FOREIGN, cocok persis — BUMI 21 Agu 2026, diulang lewat API langsung 23 Agu 2026: ANTM & TLKM pada 21 Agu dan 14 Agu 2026 — 406 baris broker (beli + jual), **0 beda**, Σ lot dan Σ rupiah ALL − FOREIGN = DOMESTIC persis di keempat kasus |

NET belum bisa diturunkan dari GROSS (dua percobaan gagal: BUMI 9/80, BBCA 19/69, TPIA 19/74 broker cocok) — karena itu NET dipanen sendiri.

### 10 ruas per broker — `broker_summary.brokers_buy` (sisi jual `brokers_sell` cermin: `slot slotv sval svalv netbs_sell_avg_price`)

| Ruas | Arti (terbukti dari nilai) | Data yang dihasilkan |
|---|---|---|
| `netbs_broker_code` | kode broker 2 huruf (CC, RX, KZ, BB, …) | identitas broker |
| `type` | golongan broker: **Lokal / Asing / Pemerintah** (BBCA 21 Agu 2026: 58 / 36 / 8 entri) | komposisi lokal vs asing vs BUMN per hari |
| `blot` | beli dalam **lot** | kolom `beli_lot` |
| `blotv` | = `blot` × 100 → **lembar** (213.569 → 21.356.900) | volume lembar, cek silang ke Volume IDX |
| `bval` | nilai beli **rupiah** | kolom `beli_nilai` |
| `bvalv` | = `bval` di GROSS; **berbeda di NET** — definisi belum terbaca ❓ (`workflow-panen-rombak.md` §2) | — |
| `netbs_buy_avg_price` | harga rata-rata beli broker itu | avg beli per broker vs harga pasar |
| `freq` | jumlah transaksi broker itu | ukuran order rata-rata = lot ÷ freq |
| `netbs_date` | tanggal `YYYYMMDD` | kunci |
| `netbs_stock_code` | kode emiten | kunci |

Olahan lokal (`panen_broker_harian.py`): satu baris per broker 7 kolom (`broker beli_lot beli_nilai avg_beli jual_lot jual_nilai avg_jual`; tanda negatif sisi jual dibuang), disimpan 5 kolom `broker beli_lot beli_nilai jual_lot jual_nilai`, diurutkan net nilai (`bval − sval`). Dari sini: net per broker, peringkat, top-N, "bandar" (broker dominan), komposisi Lokal/Asing/Pemerintah, avg broker vs rata-rata pasar.

### 13 ruas `bandar_detector`

| Ruas | Arti (uji silang) | Data yang dihasilkan |
|---|---|---|
| `average` | harga rata-rata hari itu = value ÷ volume (6.444,61 — sama persis dengan chartbit) | `avg` di ringkas |
| `avg` | {`accdist`, `amount` rupiah net, `percent`, `vol` lot} — versi harian | label **Big Acc / Acc / Normal / Dist / Big Dist** |
| `avg5` | sama, versi 5 hari | label 5 hari |
| `broker_accdist` | label akumulasi/distribusi keseluruhan (Acc / Dist) | `accdist` di ringkas |
| `number_broker_buysell` | = `total_buyer` − `total_seller` (56 − 63 = −7 ✓) | lebar partisipasi |
| `top1`, `top3`, `top5`, `top10` | {`accdist`, `amount`, `percent`, `vol`} net beli broker teratas N; `percent` top1 = 414.372 ÷ 1.006.843 = 41,16% ✓ terhadap volume hari itu — tapi top5 132,7% (>100%), jadi pembagi pastinya belum terbaca ❓ | konsentrasi `top1_pct top3_pct top5_pct` |
| `total_buyer` | jumlah broker sisi beli | `n_beli` |
| `total_seller` | jumlah broker sisi jual | `n_jual` |
| `value` | nilai transaksi rupiah hari itu | cek silang ke chartbit `value` |
| `volume` | volume lot hari itu (1.006.843 = chartbit `lot` ✓) | `cocok_volume` |

Ringkas turunan lokal (10): `n_beli n_jual total_lot total_nilai avg top1_pct top3_pct top5_pct accdist cocok_volume` — `cocok_volume` = Σ beli_lot × 100 ÷ Volume OHLC tanggal itu, wajib 1,0000 ± 1%.

### 17 kolom chartbit — OHLCV Stockbit (`ohlcv_stockbit/<KODE>.json` → `kolom`)

| Kolom | Arti | Bukti (BBCA 21 Agu 2026) | Data yang dihasilkan |
|---|---|---|---|
| `tanggal` | tanggal bursa | — | kunci |
| `unixdate` | epoch detik | 1787245200 | — |
| `open`, `high`, `low`, `close` | harga; deret sudah disesuaikan pemecahan saham (catatan `valuasi_historis.json`) | 6.400 / 6.475 / 6.400 / 6.450 | candle, MA20/50/200, RSI, ATR, support/resistance (Kartu Analisa), pola chart |
| `volume` | lembar | 100.684.300; `lot` = volume ÷ 100 ✓ | turnover, lonjakan volume |
| `value` | rupiah | value ÷ volume = 6.444,61 = `average` bandar ✓ | harga rata-rata; nilai per transaksi = value ÷ frequency (27,8 jt) |
| `frequency` | jumlah transaksi | 23.357 | ukuran order rata-rata = lot ÷ frequency (43,1 lot) |
| `foreignbuy`, `foreignsell` | rupiah asing beli / jual | 515,0 M / 246,0 M | net asing rupiah harian; porsi asing = (fb + fs) ÷ value |
| `foreignflow` | **kumulatif** (fb − fs) sejak awal deret | selisih harian = fb − fs = 269.093.402.500 ✓ | akumulasi asing n-hari tanpa menjumlah ulang |
| `dividend` | rupiah per saham pada tanggal ex-date; 0 di hari lain | 38 bar ≠ 0 di BBCA; 30 Mar 2026 = 281, 17 Jun 2026 = 20 | dividend yield historis, penyesuaian return |
| `shareoutstanding` | saham beredar **per hari** (lembar) | 123.275.050.000 | turnover = volume ÷ SO; PE/PB historis pada saham hari itu |
| `soxclose` | = `shareoutstanding` × `close` = **kapitalisasi pasar** ✓ | 795.124.072.500.000 | market cap harian |
| `freq_analyzer` | ❓ 7,90 — bukan value ÷ freq (27,8 jt), bukan lot ÷ freq (43,1); definisi belum terbaca | — | — |
| `lot` | volume ÷ 100 | 1.006.843 ✓ | tampilan lot |

### 94 rasio keystats Stockbit — 12 kelompok (`closure_fin_items_results`)

| Kelompok | Jumlah | Isi |
|---|---|---|
| Current Valuation | 14 | PE (annualised, TTM, forward), IHSG PE TTM median, earnings yield, P/S, P/BV, P/Cashflow, P/FCF, EV/EBIT, EV/EBITDA, PEG, PEG 3yr, PEG forward |
| Per Share | 6 | EPS TTM & annualised, revenue/share, cash/share (kuartal), book value/share, FCF/share |
| Solvency | 14 | **NPL gross, NPL coverage, CAR, LDR** (bank), current & quick ratio, DER, LT debt/equity, liabilities/equity, debt/assets, financial leverage, interest coverage, FCF kuartal, Altman Z (modified) |
| Management Effectiveness | 13 | ROA, ROE, ROCE, ROIC, **CASA, cost of credit**, DSO, days inventory, DPO, cash conversion cycle, receivables/asset/inventory turnover |
| Profitability | 4 | **NIM**, GPM, OPM, NPM (kuartal) |
| Growth | 3 | revenue / gross profit / net income YoY kuartal |
| Dividend | 5 | dividen, dividen TTM, payout ratio, yield, ex-date terakhir |
| Market Rank | 9 | Piotroski F-Score, EPS rating, relative strength rating, rank market cap / PE TTM / earnings yield / P/S / P/B / dekat 52w high |
| Income Statement | 4 | revenue, gross profit, EBITDA, net income (TTM) |
| Balance Sheet | 6 | cash, total assets, total liabilities, working capital (kuartal), common equity, total equity |
| Cash Flow Statement | 5 | CFO, CFI, CFF, capex, FCF (TTM) |
| Price Performance | 11 | return 1W, 1M, 3M, 6M, 1Y, 3Y, 5Y, 10Y, YTD; 52w high/low |

Ditambah `financial_year_groups` (revenue dkk per tahun, Q1–Q4 **diskret** + annualised + TTM) dan `most_recent_quarter` (tanggal kuartal, saham beredar, market cap, EV, free float). Dihasilkan: Stock Detail bagian valuasi/solvabilitas/efektivitas tanpa menghitung sendiri; rasio khusus bank yang tidak ada di yfinance; peringkat relatif terhadap pasar.

### 32 ruas IDX `GetStockSummary` (diambil 6 + `ListedShares`)

`No IDStockSummary Date StockCode StockName Remarks Previous OpenPrice FirstTrade High Low Close Change Volume Value Frequency IndexIndividual Offer OfferVolume Bid BidVolume ListedShares TradebleShares WeightForIndex ForeignSell ForeignBuy DelistingDate NonRegularVolume NonRegularValue NonRegularFrequency persen percentage`.

| Ruas / kelompok | Arti | Dipakai? | Data yang bisa dihasilkan |
|---|---|---|---|
| `Date`, `ForeignBuy`, `ForeignSell`, `Volume`, `Value`, `Frequency` | aliran asing (lembar), volume, nilai, frekuensi | ✅ `asing/` | net asing lembar, porsi asing, nilai per transaksi |
| `ListedShares` | saham tercatat | ✅ `daftar_emiten` | market cap, sinkron emiten baru |
| `Remarks` | kode papan + notasi khusus (mis. `CDMO1UQNCNU600G111`) | ❌ | notasi khusus IDX resmi (pembanding `info_stockbit.notation`) |
| `Bid`, `BidVolume`, `Offer`, `OfferVolume` | antrean penutupan | ❌ | tekanan beli/jual penutupan |
| `NonRegularVolume`, `NonRegularValue`, `NonRegularFrequency` | pasar nego + tunai agregat resmi | ❌ | pembanding varian NEGO/TUNAI Stockbit |
| `TradebleShares`, `WeightForIndex`, `IndexIndividual` | free float, bobot indeks, indeks individual | ❌ | turnover free float, bobot IHSG |
| `Previous`, `OpenPrice`, `FirstTrade`, `High`, `Low`, `Close`, `Change` | harga resmi hari itu (Open bolong pra-2025) | ❌ (ohlc dari Stockbit) | pembanding resmi harga |
| `No`, `IDStockSummary`, `StockName`, `DelistingDate`, `persen`, `percentage` | administratif / kosong | ❌ | — |

### 5 ruas IDX `GetBrokerSummary` (level pasar) — `broker/bs_YYMMDD.json`

| Ruas | Arti | Bukti (21 Agu 2026) | Data yang dihasilkan | Dipakai di halaman |
|---|---|---|---|---|
| `kode` (`IDFirm`) | kode broker 2 huruf | 88 broker | identitas; sama dengan `netbs_broker_code` Stockbit → bisa digabung | Broker Summary, Top Broker |
| `nama` (`FirmName`) | nama sekuritas | — | label | idem |
| `vol` | volume transaksi broker se-pasar | Σ 88 broker = 118.240.721.142 lembar; Σ 88 broker ÷ (volume reguler + non-reguler pasar 21 Agu, dari GetStockSummary) = 2,046; nilai = 2,003; frekuensi = 2,019 → **lembar/rupiah/kali, beli + jual dihitung dua kali, mencakup semua papan (reguler + nego + tunai)** ✓ — bandingkan ke setengahnya | peringkat volume, pangsa pasar broker | idem |
| `val` | nilai transaksi rupiah (dua sisi, semua papan) | Σ = 34.941.563.959.134 = 2,003 × nilai pasar (reguler + non-reguler) ✓ | peringkat nilai, pangsa nilai = val ÷ Σ val | idem |
| `frek` | jumlah transaksi (dua sisi) | Σ = 4.513.420 = 2,019 × frekuensi pasar reguler ✓ | ukuran order rata-rata per broker = vol ÷ frek | idem |

Tidak ada ruas emiten — parameter `code`/`stockCode` diabaikan server (diuji 16 & 22 Agu 2026).

### 22 kolom KSEI Balancepos (`kepemilikan/<KODE>.json`, bulanan, satuan lembar)

| Kolom | Arti | Bukti (BBCA 2026-07-31) | Data yang dihasilkan | Dipakai di halaman |
|---|---|---|---|---|
| `lembar_tercatat` | saham tercatat di KSEI akhir bulan | (lokal + asing) ÷ tercatat = 0.4255 | pembagi % kepemilikan | Shareholders v2 |
| `harga` | harga penutupan akhir bulan | — | nilai kepemilikan = lembar × harga | idem |
| `lokal_IS` | lokal — asuransi | — | % per tipe, perubahan bulanan | idem |
| `lokal_CP` | lokal — korporasi | — | idem | idem |
| `lokal_PF` | lokal — dana pensiun | — | idem | idem |
| `lokal_IB` | lokal — bank | — | idem | idem |
| `lokal_ID` | lokal — perorangan (ritel) | — | ritel vs institusi | idem |
| `lokal_MF` | lokal — reksa dana | — | siapa akumulasi: reksa dana vs perorangan | idem |
| `lokal_SC` | lokal — sekuritas | — | idem | idem |
| `lokal_FD` | lokal — yayasan | — | idem | idem |
| `lokal_OT` | lokal — lainnya | — | idem | idem |
| `lokal_total` | Σ 9 tipe lokal | = Σ lokal_* ✓ | porsi lokal | idem |
| `asing_IS` … `asing_OT` (9 kolom) | investor asing per tipe yang sama | — | tipe asing mana yang masuk/keluar | idem |
| `asing_total` | Σ 9 tipe asing | = Σ asing_* ✓; porsi asing BBCA = 68.88% | porsi asing bulanan, pembanding aliran asing harian | idem |

Dari kolom-kolom ini: komposisi pemegang per tipe (deret 79 bulan), porsi asing vs lokal, perubahan bulanan per tipe (siapa yang akumulasi/distribusi), nilai kepemilikan rupiah.

> ⚠️ **Cakupan Balancepos ≠ seluruh saham tercatat.** BBCA Jul 2026: lokal + asing = 42,55% dari `lembar_tercatat` — Balancepos hanya memuat saham scripless di C-BEST; sisanya (kemungkinan pemegang pengendali 54,9% Dwimuria dalam bentuk lain) tidak tercakup. Jadi "porsi asing 68,88%" adalah porsi dari saham yang tercatat di KSEI, bukan dari seluruh saham beredar — wajib disebut di antarmuka; ❓ konfirmasi definisi cakupan ke dokumentasi KSEI belum dilakukan.

### Yahoo chart (6 kolom) — cadangan `ohlc/`

| Kolom | Arti | Catatan uji | Data yang dihasilkan |
|---|---|---|---|
| `tanggal` | tanggal bursa | Yahoo memuat hari yang tidak ada di Stockbit (IHSG 38 hari) | jahitan hari hilang |
| `open high low close` | harga | harga vs Stockbit terukur 0,00% beda | candle (hanya bila Stockbit kosong) |
| `volume` | lembar (emiten); **lot** untuk indeks | 2,66% bar emiten salah vs IDX; indeks harus × 100 | cadangan saja, ditandai |

### yfinance laporan keuangan (15 ruas) — `keuangan/<KODE>.json`, nama ruas identik dengan `keuangan_idx/` (XBRL) sehingga sebanding per periode

| Ruas | Arti | Data yang dihasilkan |
|---|---|---|
| `revenue` | pendapatan | pertumbuhan, margin, P/S |
| `cogs` | beban pokok | `gross_profit` = revenue − cogs, GPM |
| `gross_profit` | laba kotor | GPM |
| `operating_income` | laba usaha | OPM, EV/EBIT |
| `net_income` | laba bersih | NPM, ROE, ROA, EPS |
| `eps` | laba per saham | PE, PEG (71% kosong di yfinance → ditambal dari net_income ÷ shares) |
| `operating_cf` | arus kas operasi | P/CF, kualitas laba (80–91% kosong di yfinance) |
| `investing_cf` | arus kas investasi | capex, FCF |
| `financing_cf` | arus kas pendanaan | dividen + utang |
| `free_cf` | arus kas bebas | P/FCF, FCF/share |
| `total_assets` | total aset | ROA, asset turnover, debt/assets |
| `total_liabilities` | total liabilitas | liabilities/equity |
| `equity` | ekuitas | ROE, PBV, DER |
| `total_debt` | utang berbunga | DER, net debt, interest coverage |
| `cash` | kas | net debt, cash/share, quick ratio |

## Riwayat

- 23 Agustus 2026 — dibuat (Fable, sesi AI Skill) dari kode dan dokumen yang ada; sumber dicatat: 23 (4 di antaranya ❓ belum dipastikan: GetSecuritiesStock, Stockbit endpoint belum terpecahkan, indexalpha, halaman Chart); halaman dipetakan: 28; baris inventaris "belum diputuskan": 31; jahitan ditandai: 8 (semua perlu keputusan Johan). Koreksi yang ditemukan untuk dokumen lain: `status-panen.md` baris Kepemilikan KSEI ("belum dipakai") basi — dibaca `brokerProfilKsei.ts:27`. Produsen `kandidat_deepdive.json` dan penulis asli `harga_terakhir.json` belum ditemukan. Tabel pembanding angka untuk J1/J2/J4/J5/J8 belum pernah dibuat — itu prasyarat sebelum Johan memutuskan, dan pekerjaan pertama yang disarankan untuk sesi Papan Trading.
- 23 Agustus 2026 (sore) — section "Inventaris ruas per berkas" ditambahkan dari pertanyaan Johan (Stock Detail, OHLC/OHLCV, Broker Summary, metode panen); temuan baru: 11 dari 12 varian broker Stockbit baru ada di `_arsip-mentah/broker-harian/` (27 emiten, 220.923 berkas), belum diolah ke JSON halaman; `broker_tahunan/` baru BUMI; `broker_harian/` jendela 20 hari; `ihsg_harian.json` murni Yahoo; keystats Stockbit 94 rasio/12 kelompok dipanen 963/963 tapi nol pemakai; jahitan fundamental ditandai per angka di `KolomLaporan.tsx` (superscript+tooltip), jahitan `ohlc/` tidak.
- 23 Agustus 2026 (sore) — "Keputusan arah" Johan untuk J1/J2/J4/J5/J8 dan dataset menganggur dicatat (kutipan verbatim); eksekusi diserahkan ke sesi Papan Trading lewat pesan dari sesi AI Skill, dengan syarat tabel pembanding dulu.
- 23 Agustus 2026 (sore) — section "Matriks sumber" ditambahkan: pemenang per jenis data (Stockbit menang karena isi, bukan selalu riwayat — ABDA & IHSG Yahoo lebih tua), 8 duplikasi "satu data dua sumber" antar halaman, usulan 13 berkas kanonik. Eksekusi milik sesi Papan Trading.
- 23 Agustus 2026 (sore) — uji API Stockbit langsung (ABDA/IHSG/ASII, `to=1980`) mengonfirmasi arsip = kedalaman server; baris endpoint `/seasonality`, `/chartbit/initial`, `/search` ditambahkan dari `docs/riset/stockbit-inventaris-endpoint.md`.
- 23 Agustus 2026 (sore) — section "Kamus ruas" ditambahkan: 12 varian marketdetectors (akhiran arsip + arti + contoh angka), 10 ruas broker, 13 ruas bandar_detector, 10 metrik ringkas, 17 kolom chartbit dengan uji silang (lot = volume/100, soxclose = SO × close, foreignflow kumulatif, average = value/volume), 94 keystats per 12 kelompok, 32 ruas GetStockSummary, 22 kolom KSEI; 3 ruas ditandai ❓ (`bvalv` di NET, `freq_analyzer`, pembagi `percent` top-N >100%).
- 23 Agustus 2026 (sore) — empat koreksi Johan atas matriks: broker level pasar (IDX = daftar + agregat saja), laporan keuangan (XBRL utama, Stockbit tambalan — keystats terbukti 3 ruas × 2024–2026, 2019→ butuh `/findata-view`), statistik pasar (PDF + turunan chartbit), seasonality (Stockbit penuh). Masuk ke Matriks A/C dan Keputusan arah J9–J11.
- 23 Agustus 2026 (sore) — atas permintaan Johan, DOMESTIC = ALL − FOREIGN diuji ulang lewat API untuk ANTM dan TLKM (21 & 14 Agu): 406 baris broker, 0 beda. Bukti diperbarui di 3 tempat.
- 23 Agustus 2026 (malam) — tiga sub-bagian Kamus ruas yang masih prosa (GetBrokerSummary, KSEI 22 kolom, Yahoo/yfinance) dijadikan tabel ruas · arti · bukti · dihasilkan · halaman; KSEI total diuji silang; kamus ruas kini wajib di template dan klausul 2 global.
- 23 Agustus 2026 (malam) — satuan `GetBrokerSummary` terpecahkan dengan uji silang ke total pasar GetStockSummary 21 Agu: vol/val/frek = lembar/rupiah/kali, dua sisi (beli + jual), semua papan — rasio 2,046 / 2,003 / 2,019.
- 23 Agustus 2026 (malam) — "Estimasi panen penuh dari Stockbit" ditambahkan dari pengukuran langsung (latensi API, throughput runner dari mtime arsip, 149 hari bursa 2026, 962 emiten): broker 12 varian 2026 ≈ 3 hari, 2017–2025 ≈ 24 hari; OHLCV riwayat penuh sudah selesai.
- 23 Agustus 2026 (malam) — tabel skala paralel 12/24/36 untuk broker 2026 ditambahkan (siklus pekerja ≈ 1,07 s; linear sampai 429; 24/36 belum diuji).
