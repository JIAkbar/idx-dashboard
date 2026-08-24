# Status Panen — satu tabel untuk seluruh sumber data PAPAN

> **Aturan wajib (Johan, 18 Agustus 2026):** tiap kali ditanya "sudah panen?"
> atau melapor soal data, jawabannya **tabel ini**, bukan kalimat lepas.
> Kolomnya tetap: sumber · halaman pemakai · asal data · isi terakhir ·
> otomatis atau manual · pemicunya.
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
disinkronkan sehingga perbaikan volume belum terlihat pengguna, aliran asing
rupiah belum dipakai halaman mana pun, dan build Vercel dengan `data-idx/json`
yang kini **670 MB / 13.378 berkas** belum pernah diuji.

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

## Tabel utama

| Sumber | Halaman PAPAN | Asal data | Isi terakhir | Berkas | Otomatis? | Pemicu |
|---|---|---|---|---|---|---|
| **OHLC harian** | Grafik Emiten, Tanya PAPAN, Kartu Analisa, Screener, Pola Chart | **Stockbit chartbit (utama) + Yahoo (pengisi)** — berganti 23 Agu 2026 | **21 Agu 2026**. Riwayat memanjang: 1.711.178 → **3.022.130 bar** (BBCA 2.472 → 5.537 bar, kini sejak 2004-01-02). Volume diganti dari sumber yang terbukti = IDX 100,00% (Yahoo terukur 2,66% bar bervolume salah); harga TIDAK disentuh karena terukur 0,00% beda. 130 emiten justru dapat data lebih baru — Yahoo tertinggal di 20 Agu. 30.245 bar yang HANYA ada di Yahoo diselamatkan lewat penggabungan per tanggal. **IHSG dijahit terpisah** (`jahit_ihsg.py`): 8.861 bar 1990-04-06→2026-08-21, volume 0 tinggal 1.261 yang semuanya pra-1997 di luar jangkauan Stockbit. **24 Agu 2026**: Grafik Emiten ikut membaca `ohlcv_stockbit/<KODE>.json` LANGSUNG (bukan lewat `ohlc/`) untuk empat ruas yang tak ada di gudang 6-ruas — nilai transaksi, frekuensi, aliran asing rupiah, saham beredar — ditampilkan sebagai baris kedua yang mengikuti tanggal disorot/lilin terakhir, dengan jatuh balik jujur ("tersedia sejak …") kalau tanggalnya lebih tua dari cakupan Stockbit (±2004 emiten, 1997-07-01 IHSG) | 964 | ❌ manual | `panen_ohlcv_stockbit.py --semua` lalu `gabung_ohlc_stockbit.py` (+ `jahit_ihsg.py` untuk indeks) — **"Panen Lagi"**; turunannya (`kartu_analisa.py --semua --tulis`, `bangun-screener.mjs`, `pola-screener.ts`) disegarkan berurutan sesudahnya |
| **Aliran asing** | Stock Detail, Kartu Analisa *(UI sedang dikerjakan)*, Aliran Investor | IDX `GetStockSummary` | **2 Jan 2020 → 21 Agu 2026** (989/989 emiten, median 1.596 hari bursa) | 989 | ❌ manual | `panen_asing.py` — **"Panen Lagi"** (dijalankan default/gabung, BUKAN `--timpa`); ⚠️ **`--mulai` MENIMPA berkas per-emiten, bukan menggabung** — dipakai sekali 20 Agu untuk menarik 1 tanggal saja dan sempat mereduksi riwayat 6,6 tahun jadi 3 baris; pulih via `--dari-arsip` penuh (arsip mentah gz tetap utuh). Jangan pakai `--mulai` lagi sampai `tulis()` digabung dgn berkas lama. Turunan `bangun_aliran_investor.py` disegarkan sesudahnya 21 Agu |
| **Statistik harian** | Kalender Bursa, Beranda | IDX PDF harian (+ cadangan Yahoo `^JKSE` kalau PDF belum terbit, lihat `panen_ihsg.py`) | **21 Agu 2026** (PDF resmi — sempat tertunda ke sore hari; jam 21 Agu sebelum PDF terbit sudah ditambal cadangan Yahoo lebih dulu, lalu ditimpa PDF asli begitu terbit) | 146 | ❌ manual (dicoba lewat "Panen Lagi" 21 Agu; run Actions terakhir belum diperiksa ulang sesi ini) | `download_idx.py --hari-ini --jenis semua` + `parse_idx_pdf.py --semua` — **"Panen Lagi"** |
| **Statistik mingguan** | Statistik Berkala | IDX PDF mingguan | 14 Agu 2026 | 33 | ⚙️ Actions (ikut `update.yml`) | `update.yml` |
| **Statistik bulanan** | Statistik Berkala (chip **Bulanan** — nyala sejak 20 Agu 2026, #203) | IDX PDF bulanan `MS<YYMM>-E` | Sep 2025 – Jul 2026 | 11 | ❌ manual | **"Panen Lagi"** |
| **Kabar** | Beranda, Kabar Pasar | IPOT · IDX berita · IDX pengumuman · Kontan · **Google News RSS** (baru, 20 Agu) | Terukur lokal 20 Agu 2026: IPOT 20 Agu 08:26 WIB, Google News 20 Agu 08:41 WIB, IDX & Kontan 18 Agu 21:56 WIB (dua ini kini lewat runner rumahan) | 331 | ⚠️ hibrida sejak commit `998698f7` — IDX+Kontan di `panen-kabar-rumah.yml` (self-hosted, PC harus menyala), IPOT+Snips+**Google News** di `panen-kabar.yml` (`ubuntu-latest`). **Google News belum terbukti tembus dari IP datacenter GitHub** — 200 dari mesin ini bukan bukti; tunggu run awan hijau yang mengisi `kabar-sumber-awan.json` | `panen-kabar.yml` + `panen-kabar-rumah.yml` |
| **Stockbit Snips** | Kabar Pasar (tab STOCKBIT SNIPS) | `snips.stockbit.com` (Squarespace `?format=json`) | 14 Agu 2026 | 238 | ⚠️ ikut mati bersama `panen-kabar.yml` — langkahnya ditambahkan 18 Agu tapi **belum pernah dijalankan sekalipun** | `panen-kabar.yml` |
| **Broker summary — LEVEL PASAR** | Broker Summary | IDX `GetBrokerSummary` (88 firm/hari) | **21 Agu 2026** | 756 | ⚙️ Actions langkah 3c `panen-harian-rumah.yml` (sejak 22 Agu 2026) | otomatis harian |
| **Broker summary — PER EMITEN** | *(halaman `/broker-summary-v2`; **arsip 2025-2026 belum dibaca halaman mana pun** — `broker_harian/*.json` yang dibaca halaman cuma jendela 20 hari terakhir)* | **Stockbit `marketdetectors`**, **6 varian GROSS** = 3 papan (REGULER/NEGO/TUNAI) x 2 tipe investor (ALL/FOREIGN). Varian NET **tidak dipanen** sejak 24 Agu 2026 — terbukti bisa dihitung (`bval - sval`; di mode NET `sval` sudah negatif, di GROSS positif), diuji dua kali terpisah: 5.756 dan 9.694 baris, dua-duanya NOL beda. `DOMESTIC` juga tidak dipanen — terbukti = ALL - FOREIGN | **2025-01-02 .. 2026-08-21 LENGKAP** per 24 Agu 2026: 962/962 emiten 2026 (146.511 hari, 0 bolong) dan 955 emiten 2025 (223.254 hari, 0 bolong; 8 emiten tak bisa dinilai karena tak punya data harga). IHSG **tidak** termasuk | ~2,2 juta berkas di `_arsip-mentah/` (di luar git) | ⚙️ hari berjalan ikut `panen-harian-rumah.yml` (sudah 12 varian, commit `72432b3a`); riwayat ❌ manual | `backfill_broker_massal.py --paralel 256 --jeda 0.4 --varian reguler,asing,nego,nego-asing,tunai,tunai-asing` — **"Panen Lagi"**. Di 256 thread muncul 36 `ConnectionResetError` (bukan 401/429); tambalnya jalan kedua di 96 thread, 0,7 menit |
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
| **Kartu Analisa (kartu per emiten + arsip kalender)** | Kartu Analisa (tab Lengkap/Ringkas/Semua) | turunan lokal: **OHLC** × ER-populasi × sektor/fundamental/asing — **nol jaringan** | **21 Agu 2026** — SEMUA 963 emiten ber-OHLC dapat kartu (naik dari 381; ambang 250 lilin/Rp500 jt-hari sekarang cuma menandai `kualitas`, bukan menyaring — 52 riwayat pendek, 530 likuiditas tipis, keduanya tetap tampil). Arsip kalender `kartu/arsip/<tgl>.json` di-backfill 20 hari bursa (24 Jul–21 Agu 2026) | 963 berkas kartu + `index.json` + `ringkas.json` (320 KB) + 20 berkas arsip (~289 KB/berkas) | ❌ manual, nol jaringan (Actions: `panen-harian-rumah.yml` juga menulis arsip hari itu tiap hari) | `kartu_analisa.py --semua --tulis` — **"Panen Lagi"**; run harian tanpa `--tanggal` ≈100 detik (963 emiten, first-passage penuh); `--tanggal YYYY-MM-DD --tulis` (arsip-saja, `hemat=True`, tanpa first-passage) ≈15–20 detik/hari untuk backfill tanggal lampau |

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

**Satuan aliran asing LEMBAR, bukan rupiah — dan itu diukur, bukan diasumsikan.**
Se-pasar 18 Agu: ForeignBuy 5,03e9 terhadap Volume 2,88e10 dan Value 1,37e13.
Sebagai rupiah itu 0,04% nilai transaksi pasar (mustahil); sebagai lembar 17%
volume (wajar). Nol emiten punya ForeignBuy melebihi Volume-nya. Rupiah hanya
bisa **ditaksir** lewat lembar × (value ÷ volume) dan wajib berlabel taksiran.
Satuannya ditulis di dalam tiap berkas (ruas `satuan`) supaya pembaca berikutnya
tak perlu menebak.

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
