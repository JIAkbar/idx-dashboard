# Status Panen — satu tabel untuk seluruh sumber data PAPAN

> **Aturan wajib (Johan, 18 Agustus 2026):** tiap kali ditanya "sudah panen?"
> atau melapor soal data, jawabannya **tabel ini**, bukan kalimat lepas.
> Kolomnya tetap: sumber · halaman pemakai · asal data · isi terakhir ·
> otomatis atau manual · pemicunya.
| **Intraday 1 MENIT — per emiten** | *(mode Intraday Whales Papan — spek §1B, UI belum dibangun; pola RBS/Gap intraday; BT intraday setelah ≥60 hari)* | **Stockbit `chartbit/<kode>/price/intraday`** — bar 1 menit, 12 ruas (OHLC, volume, lot, value, frequency, foreign_buy/sell; asing hari berjalan BASI). Server hanya simpan **±90 hari** — hari yang tak dipanen hilang permanen. KETETAPAN Johan 26 Agu: *"jadikan kewajib panen endpoint dari 1 menit sampai 4H ini"* | **2026-05-29 .. 2026-08-24** (perdana 26 Agu 2026): 962/962 emiten, **6.386.455 bar**, 111 MB gz; 874 emiten berisi, sisanya nol transaksi di jendela. Hari berjalan SENGAJA tak diarsipkan | ±3.000 berkas `_arsip-mentah/intraday/<KODE>/<YYYY-MM>.json.gz` (di luar git) | ❌ manual — **WAJIB rutin tiap sore ≥16:30** sampai masuk rantai otomatis | `python scripts/panen_intraday_stockbit.py` (bawaan `--hari 7` tumpang-tindih; resumable; 401 = berhenti bersih TANPA refresh) — ikut **"Panen Lagi"** |
>
> Kata pemicu untuk panen manual lewat Claude Code: **"Panen Lagi"**.

Diperbarui: **19 Agustus 2026** (sore — kolom pembanding masuk); baris **Kabar**
diperbarui lagi **20 Agustus 2026** (Google News RSS ditambah, jalur hibrida
rumah/awan); baris **OHLC**, **Aliran asing**, **Valuasi historis** diperbarui
lagi **20 Agustus 2026 malam** (panen 20 Agu dituntaskan lewat Claude Code);
baris **Statistik harian**, **OHLC harian**, **Aliran asing**, **Daftar emiten
+ jumlah saham** diperbarui lagi **21 Agustus 2026 sore** ("Panen Lagi");
baris **Kartu Analisa** ditambahkan **21 Agustus 2026 malam** (semua emiten
ber-OHLC dapat kartu + arsip kalender 20 hari bursa) — baris lain di tabel
ini belum diaudit ulang pada tanggal itu.
**23 Agustus 2026** — perombakan terbesar sejauh ini, rinciannya di
`docs/workflow-panen-rombak.md`:

- **OHLC harian** berganti sumber utama ke Stockbit; riwayat 1,71 → **3,02 juta
  bar**, volume diganti dari sumber yang terbukti = IDX 100,00%.
- **IHSG dijahit** (Yahoo 1990–1997 + Stockbit 1997→), 8.861 bar.
- **Broker per emiten** naik dari 3 ke **12 varian**; gelombang 1 (300 emiten
  teratas urut likuiditas) sedang berjalan — 27 emiten tersentuh per 23 Agu
  siang. Lubang datanya sudah dipetakan dan sebabnya terukur, bukan ditebak:
  **nol** karena hari libur (hari libur tak punya bar harga sama sekali, jadi
  tak pernah diminta), **99,7%** karena hari itu memang tak diperdagangkan
  (bar ada, volume 0, keempat harga sama), sisanya hari bertransaksi yang
  sumbernya sendiri tak punya rinciannya. Sejak commit `a547b2f4` hari yang
  tak diperdagangkan diarsipkan supaya berhenti diminta ulang tiap jalan —
  sebelumnya 542 hari mati DSSA menembak jaringan di setiap jalan.
- Empat lapis Stockbit baru selesai dipanen penuh 963/963: **OHLCV**,
  **keystats**, **profil**, **info**.

Diperbarui **23 Agustus 2026 siang** — dua keputusan Johan dijalankan:

- **CI harian broker naik ke 12 varian** (commit `72432b3a`). Koreksi yang ikut
  terbawa: catatan di atas menulis CI memanen "3 varian" — yang benar **satu**.
  Langkah 3d memanggil skripnya tanpa `--varian` dan bawaannya `reguler` saja.
- **Panen Stockbit masuk git**: `ohlcv_stockbit/`, `keystats_stockbit/`,
  `profil_stockbit/`, `info_stockbit/` (3.855 berkas). `.git` 289 MB → 414 MB.
  Batasnya bukan ukuran sekali unggah melainkan **churn** — penyegaran harian
  akan menambah ±101 MB/hari, jadi direktori ini disegarkan **berkala**,
  sementara penyegaran harian tetap lewat `ohlc/`.

Yang BELUM: mirror produksi (`app/public/data-idx/json/ohlc/`) belum
disinkronkan sehingga perbaikan volume belum terlihat pengguna, dan build
Vercel dengan `data-idx/json` yang kini **670 MB / 13.378 berkas** belum
pernah diuji. (Aliran asing rupiah **sudah** dipakai sejak 24 Agu 2026 — lihat
baris **Aliran asing — rupiah** di atas.)

Angka "isi terakhir" dibaca dari DALAM berkas,
bukan dari waktu berkasnya ditulis — berkas bisa ditulis ulang tanpa membawa
data baru, dan membaca mtime membuat data basi terlihat segar.

**24 Agustus 2026** — baris **Keystats Stockbit** dan **Profil Stockbit**
ditambahkan (sebelumnya cuma disebut di catatan "panen masuk git", tanpa
baris tabel sendiri — pelanggaran aturan "halaman pemakai wajib jujur").
Keystats sekarang dibaca Stock Detail (rasio bank/multifinance + peringkat
peer, murni tambahan). Profil Stockbit dibaca dua tempat: Broker Summary v2
(shareholder/anak usaha/direksi, agen lain) dan Stock Detail (alamat/latar
belakang/sekretaris/IPO, sesi ini). Papan Pekerjaan #315.

**24 Agustus 2026** — baris **Aliran asing** dipecah jadi **lembar** (IDX,
tidak berubah) dan **rupiah** (Stockbit, baru): taksiran rupiah lama
(`net lembar × harga rata-rata`, miring +33% kumulatif) dihapus dari
`flowNego.ts`, diganti angka `foreignbuy`/`foreignsell` sebenarnya dari
`ohlcv_stockbit/` yang sudah dipanen tapi belum dibaca halaman mana pun.
Dipakai Panel Aliran Asing (Stock Detail) dan AsingEmiten (Broker Summary tab
Flow & Nego). Riwayat rupiah diperpanjang ke cakupan Stockbit (2004→,
tergantung emiten); bagian sebelum cakupan lembar IDX (2020-01-02) ditandai
jahitan di antarmuka. Detail: `docs/referensi_idx-statistik.md` §J8.


> **6 September 2026 — dua gudang yatim akhirnya punya baris.** Audit §WF-208
> menemukan `broker_emiten/` (38 berkas, 5 emiten) dan tinjauan H+5 Deep Dive
> (1 berkas) dipanen tapi TIDAK punya baris sama sekali di tabel ini — dan
> karena itu kolom "halaman pemakai", satu-satunya kolom yang menyalakan lampu
> saat data menganggur, tak pernah menyala untuk keduanya. Baris 95 yang
> menyebut "Broker summary — PER EMITEN (setoran)" itu jalur setoran
> kontributor, **bukan** gudang ini. Keduanya kini terdaftar dengan jawaban
> jujur *belum dipakai halaman mana pun*. Menyambungkannya ke halaman tetap
> keputusan Johan, bukan agen.
## Tabel utama

| Sumber | Halaman PAPAN | Asal data | Isi terakhir | Berkas | Otomatis? | Pemicu |
|---|---|---|---|---|---|---|
| **OHLC harian** | Grafik Emiten, Tanya PAPAN, Kartu Analisa, Screener, Pola Chart | **Stockbit chartbit (utama) + Yahoo (pengisi)** — berganti 23 Agu 2026 | **21 Agu 2026**. Riwayat memanjang: 1.711.178 → **3.022.130 bar** (BBCA 2.472 → 5.537 bar, kini sejak 2004-01-02). Volume diganti dari sumber yang terbukti = IDX 100,00% (Yahoo terukur 2,66% bar bervolume salah); harga TIDAK disentuh karena terukur 0,00% beda. 130 emiten justru dapat data lebih baru — Yahoo tertinggal di 20 Agu. 30.245 bar yang HANYA ada di Yahoo diselamatkan lewat penggabungan per tanggal. **IHSG dijahit terpisah** (`jahit_ihsg.py`): 8.861 bar 1990-04-06→2026-08-21, volume 0 tinggal 1.261 yang semuanya pra-1997 di luar jangkauan Stockbit. **24 Agu 2026**: Grafik Emiten ikut membaca `ohlcv_stockbit/<KODE>.json` LANGSUNG (bukan lewat `ohlc/`) untuk empat ruas yang tak ada di gudang 6-ruas — nilai transaksi, frekuensi, aliran asing rupiah, saham beredar — ditampilkan sebagai baris kedua yang mengikuti tanggal disorot/lilin terakhir, dengan jatuh balik jujur ("tersedia sejak …") kalau tanggalnya lebih tua dari cakupan Stockbit (±2004 emiten, 1997-07-01 IHSG) | 964 | ❌ manual | `panen_ohlcv_stockbit.py --semua` lalu `gabung_ohlc_stockbit.py` (+ `jahit_ihsg.py` untuk indeks) — **"Panen Lagi"**; turunannya (`kartu_analisa.py --semua --tulis`, `bangun-screener.mjs`, `pola-screener.ts`) disegarkan berurutan sesudahnya |
| **Aliran asing — lembar** | Stock Detail (Panel Aliran Asing), Broker Summary (tab Flow & Nego → AsingEmiten), Kartu Analisa *(UI sedang dikerjakan)*, Aliran Investor | IDX `GetStockSummary` | **2 Jan 2020 → 28 Agu 2026** (989/989 emiten, median 1.600 hari bursa) | 989 | ❌ manual | `panen_asing.py` — **"Panen Lagi"** (bawaan **inkremental** sejak 30 Agu 2026: mulai dari tanggal terakhir di berkas mundur 7 hari, 6 hari kerja — bukan 1.737). `--penuh` untuk membangun ulang seluruh riwayat, mis. saat menambah ruas. ⚠️ `--timpa` tetap HANYA untuk panen penuh. Peringatan lama soal `--mulai` yang menimpa riwayat sudah **teratasi**: `tulis()` menggabung dan menolak menulis kalau hasilnya menyusut (penjaga yang dibayar insiden 20 Agu, saat satu jalan `--mulai` memangkas riwayat 6,6 tahun jadi 3 baris). Turunan `bangun_aliran_investor.py` disegarkan sesudahnya 21 Agu |
| **Aliran asing — rupiah** *(baru 24 Agu 2026)* | Stock Detail (Panel Aliran Asing), Broker Summary (AsingEmiten) — dibaca bareng baris lembar di atas, satu panel | Stockbit chartbit (`ohlcv_stockbit/<KODE>.json`, angka rupiah langsung dari sumber, bukan taksiran) | **2004-01-02 → 21 Agu 2026** (963 emiten; sama dengan gudang OHLC harian di atas) | 963 | ❌ manual (ikut panen OHLC harian) | ikut `panen_ohlcv_stockbit.py --semua` (baris **OHLC harian** di atas) — tak ada panen terpisah. Taksiran lama (`net lembar × harga rata-rata`, miring +33% kumulatif) **dihapus** dari `flowNego.ts`; riwayat sebelum 2020-01-02 ditandai jahitan (garis putus-putus + teks) karena tak punya pembanding lembar bursa |
| **Statistik harian** | Kalender Bursa, Beranda | IDX PDF harian (+ cadangan Yahoo `^JKSE` kalau PDF belum terbit, lihat `panen_ihsg.py`) | **21 Agu 2026** (PDF resmi — sempat tertunda ke sore hari; jam 21 Agu sebelum PDF terbit sudah ditambal cadangan Yahoo lebih dulu, lalu ditimpa PDF asli begitu terbit) | 146 | ❌ manual (dicoba lewat "Panen Lagi" 21 Agu; run Actions terakhir belum diperiksa ulang sesi ini) | `download_idx.py --hari-ini --jenis semua` + `parse_idx_pdf.py --semua` — **"Panen Lagi"** |
| **Statistik mingguan** | Statistik Berkala | IDX PDF mingguan | 14 Agu 2026 | 33 | ⚙️ Actions (ikut `update.yml`) | `update.yml` |
| **Statistik bulanan** | Statistik Berkala (chip **Bulanan** — nyala sejak 20 Agu 2026, #203) | IDX PDF bulanan `MS<YYMM>-E` | Sep 2025 – Jul 2026 | 11 | ❌ manual | **"Panen Lagi"** |
| **Kabar** | Beranda, Kabar Pasar | IPOT · IDX berita · IDX pengumuman · Kontan · **Google News RSS** (baru, 20 Agu) | Terukur lokal 20 Agu 2026: IPOT 20 Agu 08:26 WIB, Google News 20 Agu 08:41 WIB, IDX & Kontan 18 Agu 21:56 WIB (dua ini kini lewat runner rumahan) | 331 | ⚠️ hibrida sejak commit `998698f7` — IDX+Kontan di `panen-kabar-rumah.yml` (self-hosted, PC harus menyala), IPOT+Snips+**Google News** di `panen-kabar.yml` (`ubuntu-latest`). **Google News belum terbukti tembus dari IP datacenter GitHub** — 200 dari mesin ini bukan bukti; tunggu run awan hijau yang mengisi `kabar-sumber-awan.json` | `panen-kabar.yml` + `panen-kabar-rumah.yml` |
| **Stockbit Snips** | Kabar Pasar (tab STOCKBIT SNIPS) | `snips.stockbit.com` (Squarespace `?format=json`) | 14 Agu 2026 | 238 | ⚠️ ikut mati bersama `panen-kabar.yml` — langkahnya ditambahkan 18 Agu tapi **belum pernah dijalankan sekalipun** | `panen-kabar.yml` |
| **Broker summary — LEVEL PASAR** | Broker Summary | IDX `GetBrokerSummary` (88 firm/hari) | **21 Agu 2026** | 756 | ⚙️ Actions langkah 3c `panen-harian-rumah.yml` (sejak 22 Agu 2026) | otomatis harian |
| **Broker summary — PER EMITEN** | *(halaman `/broker-summary-v2`; **arsip 2025-2026 belum dibaca halaman mana pun** — `broker_harian/*.json` yang dibaca halaman cuma jendela 20 hari terakhir)* | **Stockbit `marketdetectors`**, **6 varian GROSS** = 3 papan (REGULER/NEGO/TUNAI) x 2 tipe investor (ALL/FOREIGN). Varian NET **tidak dipanen** sejak 24 Agu 2026 — terbukti bisa dihitung (`bval - sval`; di mode NET `sval` sudah negatif, di GROSS positif), diuji dua kali terpisah: 5.756 dan 9.694 baris, dua-duanya NOL beda. `DOMESTIC` juga tidak dipanen — terbukti = ALL - FOREIGN | **⚠️ 2 Sep 2026 SEBAGIAN — 67/962 punya reguler, 895 varian asing/nego/tunai tersimpan KOSONG dan sudah di produksi (`64e1050c9`).** Sebab: sumber memasang batas `limit` 50 sejak ±19:50 2 Sep (di atas 50 dijawab 200 brokers kosong, pemanen memakai 100) + pembatasan laju diam-diam (200-kosong, bukan 429; kanari BBCA 24 Agu ikut kosong 3 Sep 08:5x). Perbaikan skrip `94354d5c9`; **panen ulang 2 Sep tertunda sampai sumber menjawab lagi** — jejak #359. Emiten >50 broker/sisi kini TERPOTONG oleh sumber (ditandai `terpotong`). · **2016-01-04 .. 2026-08-24 — SEBELAS TAHUN, panen mundur SELESAI** per 26 Agu 2026: 2016 **100,00%** (120.779/120.781 hari; sisa 2 hari terisolasi sisi-sumber MDKA+BBRM), 2017 99,48%, 2019 100%, 2020-2026 ~100% (rincian per tahun di jejak #349). **2015 diprobe NIHIL** — 4 emiten terlikuid era itu x 4 tanggal = 0 broker semua, sementara kontrol 2016 di panggilan yang SAMA berisi 45-76 broker; lantai sumber = 2016-01-04. IHSG **tidak** termasuk (indeks tak punya rincian broker) | ~2,2 juta berkas di `_arsip-mentah/` (di luar git) | ⚙️ hari berjalan ikut `panen-harian-rumah.yml` (sudah 12 varian, commit `72432b3a`); riwayat ❌ manual | `backfill_broker_massal.py --paralel 256 --jeda 0.4 --varian reguler,asing,nego,nego-asing,tunai,tunai-asing` — **"Panen Lagi"**. Di 256 thread muncul 36 `ConnectionResetError` (bukan 401/429); tambalnya jalan kedua di 96 thread, 0,7 menit |
| **Broker per emiten — panen PILOT (arsip 2026-08)** | **belum dipakai halaman mana pun** — digantikan gudang **Broker tahunan (olahan)** di baris bawah, yang justru dibaca `/broker-summary-v2`. Kelima tanggal yang disampel dari arsip pilot ADA di gudang tahunan (ARCI 08-14, BBCA 08-21, BUMI 08-14, CUAN 08-13, DSSA 08-21 — lima dari lima) | Stockbit per emiten. ⚠️ **LAPIS: `MARKET_BOARD_REGULER` saja di 38/38 berkas — SATU dari enam varian wajib**, jadi seandainya disambung ke halaman pun ia tak memenuhi aturan panen 6 varian. **CAKUPAN: 5 emiten** (ARCI · BBCA · BUMI · CUAN · DSSA); **IHSG tidak termasuk** — indeks tak punya rincian broker, jadi ini batas kenyataan bukan kekurangan panen. **RUAS**: per broker (kode, beli/jual lot & nilai, `avg_beli`, `avg_jual`, jenis Asing/Lokal/Pemerintah, net lot & nilai) + blok deteksi bandar (avg, avg5, top1/top3/top5/top10, accdist, jumlah pembeli & penjual). Yang **hanya** ada di sini dan tak ada di gudang tahunan: `avg_beli`/`avg_jual` per broker, avg5, top10, jumlah pembeli/penjual — hilang tanpa pernah dicatat saat pilotnya ditinggalkan. Golongan Lokal/Asing/Pemerintah BUKAN hal baru: sudah dibakukan di modul kelompok broker | **2026-08-03 .. 2026-08-21** — stempel `dipanen` DI DALAM berkas 2026-08-22 20:41→22:01 (bukan mtime) | 38 berkas / 5 emiten | ❌ manual — **yatim**: tak ada di `.github/workflows` maupun di kedua bat | `C:/Python314/python.exe scripts/panen_broker_emiten.py` — **belum** ikut "Panen Lagi". Menyambungnya ke halaman = keputusan Johan, bukan agen (lapisnya wajib naik ke 6 varian lebih dulu) |
| **Broker tahunan (olahan)** | Trader Papan, Neo Inventory/Compare/Stalker (jalur tahunan) | ⚙️ `bangun_broker_tahunan.py` dari `_arsip-mentah/broker-harian/` — nol jaringan | **2016 → 2026 per 27 Agu 2026** (keputusan Johan "gpp sampai 2016"; sebelumnya 2020→). 491 emiten punya 2016; BBCA 2016 = 246 hari, cocok persis arsip mentah (sampel PD 229.605 lot / Rp 59,49 M); index per emiten dibaca dari DISK (run parsial tak menghapus tahun lain); 61 EINVAL indeks Windows (kunci berkas transien) diperbaiki 61/61 | 10.400+ berkas, 2,1 GB | ❌ manual, nol jaringan | `C:/Python314/python.exe scripts/bangun_broker_tahunan.py` (dukung `--tahun 2016,2017` subset · `--paralel 8` · `--lanjut` resume) — ikut **"Panen Lagi"** setelah panen broker harian |
| **Rezim pasar (beta naik/turun per emiten)** | Berkas Emiten `/berkas-emiten` blok A (superadmin) | ⚙️ `bangun_rezim_pasar.py` — turunan `ohlc/` (emiten + IHSG), nol jaringan | **28 Agu 2026** (perdana, v2 beta kovarian pasca-audit 4 lensa): 962 emiten, uji luar sampel bawaan → `label_tayang=false` (label kalah dari tebakan buta 28,3% vs 33,0% — halaman merender dua angka tanpa kategori) | 1 berkas `rezim_pasar.json` ~1,3 MB | ❌ manual, nol jaringan — sudah di KEDUA bat (Otomatis + Buka Laptop) | `C:/Python314/python.exe scripts/bangun_rezim_pasar.py` — jalankan SESUDAH panen OHLC; ikut **"Panen Lagi"** |
| **Kategori broker (perilaku)** | *(dibaca halaman **Bandarmologi** sejak 3 Sep 2026 — kolom sekuritas langganan diwarnai per kategori; paket B/C spek `spek_bandarmologi_c2.md` menyusul)* | ⚙️ `bangun_kategori_broker.py` — turunan `broker_tahunan/` (REGULER saja), kalender dari `ohlc/IHSG.json` — nol jaringan | **27 Agu 2026**: jendela 2026-02-18 → 2026-08-24 (120 hari bursa), 90 broker aktif; 4 kategori (whale 12 · smart 33 · smart_ritel 34 · ritel 11) + 6 gaya, ambang dari kuartil share & median directionality/konsistensi TERUKUR (bukan dikarang) | 1 berkas, ~22 KB | ❌ manual, nol jaringan | `C:/Python314/python.exe scripts/bangun_kategori_broker.py` — jalankan SESUDAH `bangun_broker_tahunan.py`; ikut **"Panen Lagi"** |
| **Bandarmologi** | Bandarmologi (tab Aliran Dana) | Turunan lokal: rekaman harian per emiten + rincian sekuritas + antrean penutupan (nol jaringan) | **2026-09-02** | 1 berkas, 828 emiten | ❌ manual — ikut rantai turunan Buka Laptop, sesudah antrean penutupan | `python scripts/bangun_bandarmologi.py` — **"Panen Lagi"**. Fase & sekuritas langganan hanya terisi untuk emiten yang punya rincian broker hari itu (2 Sep: 70 dari 828, akibat panen broker gagal — lihat baris broker per emiten) |
| **Broker summary — PER EMITEN (setoran)** | Deep Dive, Kartu Analisa | Setoran kontributor (screenshot). IDX `GetBrokerSummary` **mengabaikan** `code`/`stockCode`/`kodeEmiten` (diuji ulang 22 Agu 2026: jawaban identik 88 baris level pasar) | ikut setoran | — | 👤 kontributor + kurasi admin | halaman `/admin` |
| **Kepemilikan KSEI (Balancepos)** | Broker Summary v2 → tab Shareholders ("Komposisi kepemilikan KSEI", 9 tipe investor lokal/asing + Δ 12 bulan). Berhenti "belum dipakai" sejak 23 Agu 2026 | KSEI `BalanceposEfek<YYYYMMDD>.zip` bulanan, pipe-delimited; lokal & asing × 9 tipe investor | **Jan 2020 → Jul 2026** (79 bulan) | 1.035 emiten | ❌ manual | `panen_ksei_balancepos.py` — **"Panen Lagi"** |
| **Profil emiten IDX** | **belum dipakai halaman mana pun** | IDX `GetCompanyProfilesDetail` lewat `idx_net.get()` (jeda 1,5 dtk; `requests` polos kena Cloudflare) | **22 Agu 2026** | 962 emiten | ❌ manual | `panen_profil_idx.py` — **"Panen Lagi"** |
| **Fundamental** | Stock Detail, Bedah Emiten | yfinance + turunan lokal + `ListedShares` IDX | **18 Agu 2026** | 965 | ⚙️ Actions akhir bulan | `update-fundamental.yml` |
| **Daftar emiten + jumlah saham** | (dipakai `fetch_fundamental.py`, bukan halaman) | IDX `GetStockSummary` (`ListedShares`) | **21 Agu 2026** — 963 emiten resmi; 1 ticker baru (GOTOM) terdeteksi tapi belum dikenal yfinance, dicatat bukan disembunyikan | 963 emiten | ❌ manual | `sinkron_emiten.py` — **"Panen Lagi"** |
| **Keuangan XBRL IDX** | Stock Detail | IDX `GetFinancialReport` | **2019–2025** (7 thn buku) + **interim 2024 TW1/TW2 sejak 19 Agu sore** (827 dari 949 berkas, diperah dari kolom pembanding XLSX 2025 yang sudah di cakram — nol jaringan); mata uang per periode (`mata_uang` · `mata_uang_laporan` · `kurs_laporan`) | 949 | ❌ manual | `panen_keuangan_idx.py` — **"Panen Lagi"**; peras ulang tanpa jaringan: `--dari-arsip`; kolom pembanding: `panen_pembanding.py --semua-arsip --tulis` |
| **Keuangan XBRL IDX — kuartal diskret** | **belum dipakai halaman mana pun** — Q4 di layar dihitung langsung dari sumbernya, bukan dari berkas ini | turunan lokal dari **Keuangan XBRL IDX** (Q1=TW1, Q2=TW2−TW1, Q3=TW3−TW2, Q4=audit−TW3; ruas neraca tak pernah dikurangi; **pengurangan DITOLAK kalau mata uang dua periodenya beda** — asal `beda-mata-uang`, nilainya null) | **2019 → 2026 TW2**, **10.800 periode** (naik dari 9.665; 2024 sendiri 1.982). Mayoritas Q4 masih cuma berisi neraca karena TW3 pembandingnya tak ada | 949 | ❌ manual, nol jaringan | `turunkan_kuartal_diskret.py` — **"Panen Lagi"** |
| **Keystats Stockbit (94 rasio)** | Stock Detail — "belum dipakai halaman mana pun" sampai 24 Agu 2026, sekarang panel Rasio Perbankan/Multifinance + Peringkat Antar Emiten IDX (murni tambahan, tak menimpa fundamental lama) | Stockbit key statistics, 12 kelompok rasio | **23 Agu 2026** | 963 | ❌ manual | **"Panen Lagi"** |
| **Profil Stockbit** | Broker Summary v2 → tab Shareholders (pemegang saham/anak usaha/direksi, agen lain); Stock Detail sejak 24 Agu 2026 (alamat, latar belakang, sekretaris, ringkasan IPO) | Stockbit company profile | **23 Agu 2026** | 963 | ❌ manual | **"Panen Lagi"** |
| **Keuangan yfinance** | Stock Detail | yfinance | 17 Agu 2026 | 646 | ⚙️ ikut `update-fundamental.yml` | — |
| **Seasonality bulanan** | Seasonality | Yahoo (penutupan bulanan) | 17 Agu 2026 | — | ❌ manual | `panen_seasonality.py` — **"Panen Lagi"** |
| **Peta investor (KSEI)** | Peta Investor | KSEI | *(tak diperbarui rutin)* | — | ❌ manual | `fetch_investor_map.py` |
| **Pemegang saham pengendali** | Stock Detail (hero) | turunan lokal dari **arsip mentah** Keuangan XBRL IDX, sheet `1000000` — **nol jaringan** | **20 Agu 2026**; laporan sumber per emiten: 847 dari 2026 TW1/TW2, 63 dari 2025, 21 dari 2022–2024, **18 masih dari laporan 2019** | 949 emiten (1 berkas) | ❌ manual, nol jaringan | `panen_pengendali.py` — **"Panen Lagi"** |
| **Valuasi historis (P/E & P/B tahunan)** | Stock Detail (panel *Valuasi vs Sejarah*) | turunan lokal: **Keuangan XBRL IDX** (tahunan) × **OHLC** × `daftar_emiten.saham` — **nol jaringan** | **20 Agu 2026**, tahun buku 2019–2025 | 814 emiten (1 berkas); **338 ≥5 tahun P/E**, 574 ≥5 tahun P/B — sisanya tampil tanpa vonis | ❌ manual, nol jaringan | `hitung_valuasi_historis.py` — **"Panen Lagi"**; **wajib diulang sesudah `panen_ohlc.py` / `panen_keuangan_idx.py`** karena berjangkar pada keduanya |
| **Radar WDWL (Watch/Penny/RBU)** | Radar Watchlist (`/radar`) | Surat Google Group Meta-noia (saptono.widhi) — lampiran `wdwl.png` + `rbu.pdf` per edisi; tanggal DATA = `yymmdd` di subjek, BUKAN tanggal kirim | **26 Agu 2026** — 11 edisi (3–26 Agu); transkrip visual diverifikasi 12 close acak vs `ohlc/` per edisi (semua salah:0) | 11 `r_*.json` + `index.json` + 61 PNG `rbu/<tgl>/`; mentah di `masuk/<tgl>/` (di cakram, luar git) | ❌ manual | dua jalur: (1) Gmail langsung (izin Johan 27 Agu) — cari subjek `wdwl`, decode RAW MIME; (2) unggah admin → `tarik_radar_masuk.py` → pemicu **"Radar Masuk"** (parse butuh visi, tak bisa skrip murni). Penjaga basi OTOMATIS tiap login: langkah [R] task buka-laptop (`cek_radar_basi.py`, ambang 3 hari bursa dari kalender IHSG) — basi = peringatan + `.radar_basi.json` |
| **Kartu Analisa (kartu per emiten + arsip kalender)** | Kartu Analisa (tab Lengkap/Ringkas/Semua) | turunan lokal: **OHLC** × ER-populasi × sektor/fundamental/asing — **nol jaringan** | **Diperiksa ulang 6 Sep 2026: 2026-09-05 13:01** (stempel `diperbarui` DI DALAM `index.json`, bukan mtime) — **832 dari 963 kartu bertanggal 2026-09-04**, hari bursa terakhir. 131 sisanya **bukan kartu basi melainkan emiten beku semua**: `beku`>0 diperiksa 131 dari 131, nol pengecualian, nol berkas hilang. Catatan lama "21 Agu 2026" salah dan sudah dicabut. SEMUA 963 emiten ber-OHLC dapat kartu (naik dari 381; ambang 250 lilin/Rp500 jt-hari sekarang cuma menandai `kualitas`, bukan menyaring — terukur 6 Sep 2026: **12 riwayat pendek, 532 likuiditas tipis**, keduanya tetap tampil). Arsip kalender `kartu/arsip/<tgl>.json` kini **29 hari bursa, 2026-07-24 → 2026-09-04** | 963 berkas kartu + `index.json` + `ringkas.json` (903 KB) + **29** berkas arsip (~453 KB/berkas) | ❌ manual, nol jaringan (Actions: `panen-harian-rumah.yml` juga menulis arsip hari itu tiap hari) | `kartu_analisa.py --semua --tulis` — **"Panen Lagi"**; run harian tanpa `--tanggal` ≈100 detik (963 emiten, first-passage penuh); `--tanggal YYYY-MM-DD --tulis` (arsip-saja, `hemat=True`, tanpa first-passage) ≈15–20 detik/hari untuk backfill tanggal lampau |
| **Tinjauan H+5 Deep Dive** | **belum dipakai halaman mana pun** — skripnya sengaja menulis ringkasan ke stdout supaya §5 `docs/analisa-papan-v1.md` (yang memuat kalimat analis) tak ditimpa mesin; berkas JSON-nya efek samping yang belum punya alamat di layar. Kunci sambung **sudah ada**: ruas `edisi` cocok verbatim dengan kode terbitan di manifest Deep Dive — 4 dari 5 terpetakan; BA-INET-180826-E01 ada di tinjauan tapi TIDAK ada di manifest terbitan | turunan lokal dari berkas bedah × OHLC — **nol jaringan**. **CAKUPAN**: 5 terbitan Deep Dive (ARCI · BUMI · CUAN · DSSA · INET), bukan emiten umum. **RUAS**: kode, tanggal, edisi, harga acuan, level bull, level invalidasi, urutan level tersentuh, harga & tertinggi H+5, gerak %, status | **6 Sep 2026 14:04 — kelimanya kini GENAP H+5.** Sebelumnya semua berhenti di 3/5 & 4/5 hari sejak 22 Agu (barnya sudah lama tersedia, skripnya saja tak pernah diulang): ARCI +17,6% terbukti · BUMI +7,2% terbukti · DSSA +7,6% **terbukti** (naik dari "sebagian") · CUAN +0,0% belum terjadi · INET +4,8% belum terjadi. Invalidasi utuh di kelimanya | 1 berkas (1,8 KB) | ❌ manual, nol jaringan — **yatim**: tak ada di `.github/workflows` maupun di kedua bat | `PYTHONIOENCODING=utf-8 C:/Python314/python.exe scripts/riset/tinjau_deepdive.py` — **belum** ikut "Panen Lagi"; wajib diulang tiap ada Deep Dive baru DAN tiap H+5 sebuah terbitan lewat. ⚠️ tanpa `PYTHONIOENCODING=utf-8` berkasnya tetap ditulis tapi cetakan tabelnya jatuh `UnicodeEncodeError` di konsol Windows (panah `→`) |

## Yang perlu diketahui, bukan sekadar dilihat

**Jalur awan vs jalur rumahan — sekarang diuji, bukan ditebak.** Sejak 18 Agu
2026 `panen-kabar.yml` **mencoba semua sumber** dan melaporkan hasilnya per
sumber ke ringkasan run; yang terbukti tembus dari IP datacenter dicatat di
`data-idx/json/kabar-sumber-awan.json`. Sebelumnya sebagian sumber ditahan di
rumah atas dugaan "IDX/Kontan 403 dari datacenter" — dugaan yang dibuat sebelum
`scripts/idx_net.py` (curl_cffi) ada dan tak pernah diuji ulang sesudahnya.
Bukti kenapa ini perlu: run `32139468436` **hijau** sambil mencatat
`IDX berita: 0 item` dan `IDX pengumuman: 0 item` (keduanya 403 lewat
`requests`) — satu sumber hidup cukup membuat panen terlihat sehat.

**Tapi sampai 19 Agu 2026 ini masih rancangan, bukan hasil terukur.** Commit
yang membawanya (`dcde09cd`) sekaligus membuat berkas workflow-nya ditolak
GitHub, jadi versi "semua sumber" belum pernah jalan satu kali pun dan
`kabar-sumber-awan.json` masih kosong. Jangan mengutip bagian ini sebagai
bukti sumber mana yang tembus dari awan sampai ada run hijau yang mengisinya.

**Kegagalan senyap kabar sudah punya alarm.** `scripts/cek_kabar.py` membaca
**isi** `kabar.json` + `snips.json` (stempel waktu item terbaru **per sumber**,
bukan mtime dan bukan ruas `dipanen`), digabung dengan hasil panen per sumber.
Job merah kalau sumber yang PERNAH tembus dari awan berhenti tembus, atau
datanya basi lewat ambang tanpa ada yang mengisinya. Ambangnya dihitung dalam
**jam kabar** (hari bursa 07:00–19:00 WIB, kalender dari `ds_*.json`) supaya
akhir pekan dan libur tak melahirkan alarm palsu.

**Interim 2024 sudah masuk, tapi gerbang yfinance TIDAK memvonisnya — dan itu
harus dikatakan apa adanya.** `keuangan/` (yfinance) hanya menyimpan
2024-12-31, sementara yang baru masuk 2024-03-31 (787 emiten) dan 2024-06-30
(348). Irisannya nol, jadi `uji_diskret_yfinance.py --tahun 2024` menjawab nol
baris — itu **tak teruji**, bukan lulus. Yang 2025/2026 tetap diuji dan tetap
rasio median 1,000 di revenue, laba bersih, dan laba kotor.

Penggantinya gerbang kewajaran terhadap audit tahunan 2024, yang memang
menangkap dua kesalahan termahal di jalur ini (operand tertukar tahun, dan
salah skala 1000×) walau ia tak membuktikan tiap angka: Q1 2024 ÷ audit 2024
bermedian **0,237** (n=665) dan Q2 **0,243** (n=250), 91–94% jatuh di rentang
0,15–0,40. Praktis seperempat tahun, seperti seharusnya.

**403 IDX hampir selalu bentuk permintaan, bukan alamat IP.** Pemanen IDX kini
memakai `curl_cffi` dengan impersonasi TLS; `requests` ditolak walau headernya
lengkap. Uji yang membedakan: buka URL yang sama di peramban — kalau peramban
200, yang salah sidik jari permintaan.

**Batas sumber yang sudah dipastikan, jangan dicoba ulang:**
- Daftar laporan XBRL IDX (`GetFinancialReport`) berhenti menyebut tahun buku **2019**; 2018 ke belakang menjawab `ResultCount 0`. Ini batas DAFTARnya, bukan batas isinya — isi yang sudah dipanen mencakup 2019–2025 plus interim 2024.
- Intraday Yahoo: 5m/15m/30m ±1 bulan, 1h ±2 tahun, **4h tak ada** (dirakit dari 1h).
- Broker summary **per emiten** tak tersedia di endpoint publik mana pun —
  `GetBrokerSummary` mengabaikan `stockCode` dan selalu menjawab level pasar.

**Aliran asing: 6,6 tahun, bukan sehari.** Selesai 18 Agu 2026 — 989 emiten,
median 1.593 hari bursa, nol tanggal gagal dari 1.729 hari kerja yang dicoba.
Batas sumbernya **2 Januari 2020**: 30 Desember 2019 hari bursa normal dan tetap
menjawab **HTTP 200 dengan `data` kosong**, bukan 403. Bedanya menentukan — 403
berarti bentuk permintaan salah dan bisa diakali; 200-kosong berarti IDX memang
tak menyimpannya, jadi jangan dijadwalkan ulang.

**Satuan aliran asing di gudang IDX LEMBAR, bukan rupiah — dan itu diukur, bukan diasumsikan.**
Se-pasar 18 Agu: ForeignBuy 5,03e9 terhadap Volume 2,88e10 dan Value 1,37e13.
Sebagai rupiah itu 0,04% nilai transaksi pasar (mustahil); sebagai lembar 17%
volume (wajar). Nol emiten punya ForeignBuy melebihi Volume-nya. Satuannya
ditulis di dalam tiap berkas (ruas `satuan`) supaya pembaca berikutnya tak
perlu menebak.

**24 Agu 2026 — rupiah tak lagi ditaksir.** Kalimat di atas masih berlaku untuk
gudang IDX itu sendiri (tetap lembar), tapi halaman tidak lagi menaksir rupiah
dari situ (`lembar × value ÷ volume`, terukur miring +33% kumulatif atas 138
hari). Rupiah sekarang angka sebenarnya dari Stockbit (`ohlcv_stockbit/`,
baris **Aliran asing — rupiah** di atas) — lembar IDX tetap dipertahankan
sebagai sumber lembar resmi dan pembanding silang, tidak dibuang. Detail
lengkap (bukti uji silang, batas jahitan pra-2020): `docs/referensi_idx-statistik.md` §J8.

**Menambah ruas dari `GetStockSummary` kelak GRATIS.** Mentahnya diarsipkan
ter-gzip (1.729 berkas, 140 MB); `--dari-arsip` membangun ulang seluruh
2020–2026 dalam 29 detik tanpa satu pun permintaan jaringan. 26 dari 32 ruas
belum dipakai dan sudah tersimpan.

## Yang terlihat hijau padahal tidak (18 Agu 2026)

Dua workflow **sukses** sambil gagal. Ini kelas kegagalan paling mahal di
proyek ini, dan tabel di atas ikut menipu selama beberapa hari.

- **`panen-kabar.yml`** — run 32139468436 hijau, commit terkirim, padahal
  log memuat `IDX berita: 0 item` dan `IDX pengumuman: 0 item` (keduanya 403).
  Satu sumber hidup (IPOT, 28 item) sudah cukup membuat panen terlihat sehat.
- **`update.yml`** — gagal sejak ≥14 Agu karena Playwright `wait_for_selector`
  timeout, dan tabel ini tetap menulis "⚙️ Actions". Skripnya sudah dibuang
  Playwright-nya (`be02bb01`) tapi belum di-push; langkah `playwright install`
  yang tersisa di workflow juga sudah dibuang hari ini.

Pelajarannya untuk kolom "Otomatis?": **status di kolom itu wajib berasal dari
run terakhir yang benar-benar diperiksa, bukan dari niat workflow-nya.**
"⚙️ Actions" tanpa memeriksa run terakhir adalah klaim, bukan fakta.

---

## Diperbarui 28 Agustus 2026 — rantai panen → halaman DISAMBUNG PENUH (audit atas keluhan Johan *"bnyk yang setelah panen data, page-page itu tidak saling terhubung"*)

> **6 Sep 2026 — bat pipa panen kini TERLACAK git** (keputusan Johan, antrean #11). Sampai hari ini `.gitignore` mengabaikan `*.bat` dengan alasan "file kerja lokal", padahal keenam `JALANKAN_*.bat` inilah yang memanggil pemanen, membangun turunan, meng-commit, dan mendorong ke repo tiap hari. Akibat nyatanya terlihat di #10: bat buka-laptop membangun sembilan keluaran lalu tak menyebut satu pun saat commit, dan cacat itu hidup berbulan-bulan justru karena berkasnya tak pernah ikut ditinjau. Sekarang keenamnya bisa dibaca, ditinjau, dan dipulihkan dari repo. Diperiksa sebelum dilacak: 6 berkas, 602 baris, **nol** nilai rahasia dan **nol** jalur pengguna; `set PYEXE` dibuat bisa ditimpa lingkungan supaya berkasnya tak mengunci satu mesin.

Dua bat lokal (`JALANKAN_PANEN_SORE.bat` 18:00 & `JALANKAN_BUKA_LAPTOP.bat` ONLOGON) kini menjalankan SEMUA turunan halaman — sekali panen, semua halaman segar. Blok [E] pembangun (28 Agu pagi) + blok [E2] hasil audit (28 Agu siang):

| Sumber/turunan | Halaman pemakai | Asal data | Isi terakhir | Berkas | Otomatis? | Pemicu |
|---|---|---|---|---|---|---|
| `harian_papan/<tgl>.json` | Harian Papan | ohlcv_stockbit + profil (nol jaringan) | **2026-08-27**, 962 emiten, 30 tanggal | 31 | ⚙️ kedua bat | `node app/scripts/bangun-harian-papan.mjs` |
| `jago_papan/terbaru.json` | Jago Papan | idem | **2026-08-27**, 962 emiten | 1 | ⚙️ kedua bat | `node app/scripts/bangun-jago-papan.mjs` |
| `ipo.json` | IPO Papan | profil_stockbit + ohlcv | 28 Agu | 1 | ⚙️ kedua bat | `node app/scripts/bangun-ipo.mjs` |
| `pola_screener.json` | Screener (kolom Pola) | ohlc penuh | 28 Agu | 1 | ⚙️ kedua bat | `npx vite-node scripts/pola-screener.ts` (dari app/) |
| `aliran_investor.json` | Broker Summary tab Flow (Aliran Investor) | arsip mentah asing (nol jaringan) | **2026-08-27** (reguler+non-reguler) | 1 | ⚙️ kedua bat [E2] | `python scripts/bangun_aliran_investor.py` |
| `bidoffer.json` | Kuli Papan | arsip mentah asing termuda BERISI | **2026-08-27**, 833 emiten | 1 | ⚙️ kedua bat [E2] | `python scripts/bangun_bidoffer.py` |
| `harga_terakhir.json` | Kalkulator (cadangan harga) | ohlc close terakhir (nol jaringan) | 28 Agu, 962 emiten | 1 | ⚙️ kedua bat [E2] | `python scripts/bangun_harga_terakhir.py` (BARU — dulu tanpa penulis) |
| `grup_konglomerat.json` | Deret Konglomerat | kurasi + ohlc (nol jaringan) | 28 Agu | 1 | ⚙️ kedua bat [E2] | `python scripts/petakan_grup.py` |
| `keystats_stockbit/` | Kuli Papan, rasio tambahan | Stockbit (token) | **23 Agu — TERTAHAN token mati 28 Agu**, panen susulan begitu token disemai | 963 | ⚙️ kedua bat [E2] (guard arsip-hari-ini) | `python scripts/panen_keystats_stockbit.py --semua --jeda 0.4` |
| `info_stockbit/` | Neo Papan (profil) | Stockbit (token) | **21 Agu — TERTAHAN token** idem | 963 | ⚙️ kedua bat [E2] (guard) | `python scripts/panen_info_stockbit.py --semua --jeda 0.4` |
| `rekomendasi/<tgl>.json` | Screener tab Riwayat & Win Rate | screener+kartu+ohlc (nol jaringan), SEKALI-TULIS anti-edit | **Diperiksa ulang 6 Sep 2026: 2026-09-04** (stempel `dibangun` DI DALAM berkas = 2026-09-05T03:11:57+00:00) — **100 baris / 5 preset**, 20 saham per preset (scalping, swing, whale-tiket, whale-akdis, whale-asing). Catatan lama "2026-08-27, 80 baris, 2 berkas" salah di ketiga angkanya | **10** (9 berkas tanggal 2026-08-24 → 2026-09-04 + `index.json`) | ⚙️ kedua bat [E] | `python scripts/riset/rekap_preset.py` |
| `bt/rbs-stat-<D\|W\|M>.json` + `rbs_kandidat.json` | Grafik Emiten (baris statistik di bawah tombol Pola RBS) · pemasok ide Deep Dive | Turunan MURNI dari `ohlc/` (nol jaringan) lewat mesin RBS yang SAMA dengan yang menggambar garisnya di chart (`scripts/riset/rbs_mesin.py` = `app/src/lib/dasbor/polaRbs.ts`) | **2026-09-07** (perdana): D 21.466 breakout / 956 emiten · W 2.980 / 951 · M 293 / 735; 86 kandidat sah 30 hari terakhir (BBCA 6.588 sah 3 Sep di antaranya) | 4 berkas `data-idx/json/bt/rbs-stat-*.json` + `data-idx/json/rbs_kandidat.json` | ⚙️ otomatis — kedua bat panen (`[E] Turunan`) + CI rumah langkah `4c` | `python scripts/riset/rbs_statistik.py --kerangka D W M --tulis` — ikut **"Panen Lagi"**. Kerangka yang berkasnya TAK ADA membuat chart DIAM soal statistik, bukan memajang angka basi |

Tetap manual sesuai sifatnya (bukan putus): kepemilikan KSEI (bulanan), pengendali (per laporan kuartalan), bt/ win-rate fitur (beku by design), ipot_arsip (parkir C3). Sapuan OHLC-Yahoo 963 kini DILEWATI dari jalur Buka Laptop (`LEWATI_OHLC_YAHOO=1` — Stockbit utama, Yahoo cadangan); jalur mandiri `JALANKAN_OTOMATIS.bat` tetap utuh sebagai cadangan.
