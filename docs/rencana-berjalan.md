# Rencana berjalan PAPAN

Catatan hidup — diperbarui tiap ada keputusan. Ditulis ke berkas supaya tidak
bergantung pada ingatan percakapan (yang bisa diringkas dan kehilangan detail).

Terakhir diperbarui: 18 Agustus 2026 (setelah sesi jumlah saham resmi bursa).

## 📌 Sesi 18 Agu 2026 — Jumlah saham resmi bursa (`ListedShares`)

Lanjutan A0c. Perintah Johan: *"cari sumber `shares` yang lebih andal untuk 38
emiten ini ... Verifikasi dengan sumber independen (situs IDX resmi/RTI)
sebelum menulis"*.

**Keputusan yang sudah diambil — jangan diperdebatkan ulang:**

| Keputusan | Alasan |
|---|---|
| `shares` bersumber `ListedShares` IDX (`GetStockSummary`), disimpan sebagai `saham` di `daftar_emiten.json` | Sudah ada di payload yang `sinkron_emiten.py` ambil tiap hari — nol permintaan tambahan, sumbernya bursa sendiri |
| `market_cap ÷ last_price` **ditolak** sebagai sumber | `marketCap` Yahoo berasal dari `sharesOutstanding` Yahoo juga → ikut basi. Salah di AISA, LPPF, ZBRA, MSKY |
| `GetCompanyProfiles` **tidak dipakai** | Tak perlu — `GetStockSummary` sudah membawa angkanya, dan itu endpoint yang sudah rutin dipanggil |
| Ambang koreksi 2× | Beda di bawah itu treasury/waktu potret (101 emiten). Angka yang sama dipakai `shares_masuk_akal()` |
| `float_shares` tak diskalakan | `floatShares` Yahoo tak konsisten basisnya; `float_pct` memilih basis yang jatuh di 0–100%, sisanya `null` |

Rinciannya: `docs/workflow-fundamental.md` A0d · Papan Pekerjaan #180–183 di
`docs/jejak-permintaan.md`.

**Sisa yang sengaja dibiarkan** (bukan lupa): `market_cap` kosong di 13 emiten
disuspensi · `float_shares` aneh di 7 emiten yang `shares`-nya sudah cocok ·
CNTB/CNTX/NIPS tak ada di daftar IDX · `q_eps` MDKA & MSKY masih >20× `eps`
tahunan (akarnya `trailingEps` yang basi, bukan `shares`).

## 📌 Sesi 17 Agu 2026 — Arsip mentah untuk seluruh pemanen (`scripts/`)

Johan: *"jangan asal maen buang data yang sudah di panen, gini ini jadi
masalah kan harus unduh lagi, simpan backup saja sewaktu perlu kita gunakan
gini"* — *"tidak hanya tiap XLSX, tapi semua data yang berkaitan dengan Papan
simpan di folder itu"*.

`panen_keuangan_idx.py` sudah menerapkan pola ini (`ARSIP_MENTAH`,
`jalur_arsip`, `ambil_xlsx`). Pembantu bersamanya sekarang dipisah ke
`scripts/arsip_mentah.py` (`simpan`/`baca`/`ambil_atau_unduh`) dan dipasang ke
sepuluh pemanen yang sebelumnya tak menyimpan mentahnya sama sekali:
`panen_ohlc.py`/`panen_ihsg.py` (satu fungsi `ambil()` dipakai bersama),
`panen_kabar.py`, `panen_sektor_idx.py`, `panen_seasonality.py`,
`panen_ipot_arsip.py`, `fetch_broker_summary.py`, `fetch_investor_map.py`,
`fetch_fundamental.py`, `fetch_keuangan.py`. Semua tertulis ke
`_arsip-mentah/<sumber>/...` (sudah di `.gitignore`, terverifikasi
`git status` bersih setelah panen uji).

Untuk `yfinance` (fetch_fundamental/fetch_keuangan) tak ada respons HTTP
mentah yang bisa dicegat — yang diarsipkan adalah objek `info` (dict) dan
DataFrame/Series laporan keuangan APA ADANYA dari pustaka (lewat
`to_json()`), bukan byte HTTP asli. Ditandai jelas di komentar `_arsip_yf()`.

**Belum dipindah (sengaja):** `data-idx/daily/` (270 MB PDF harian) dan
`data-idx/weekly/` (69 MB PDF mingguan) sudah berperan sebagai arsip mentah
dan sudah di-gitignore — TAPI jalurnya masih tertanam di
`scripts/download_idx.py`, `scripts/parse_idx_pdf.py`,
`scripts/parse_idx_weekly.py`, dan `.github/workflows/update.yml`.
Memindahkannya ke `_arsip-mentah/` menyentuh CI produksi dan perlu diverifikasi
terpisah — dicatat di sini sebagai pekerjaan lanjutan, bukan dikerjakan sesi
ini. `fetch_investor_map.py` juga sudah punya arsip PDF-nya sendiri di
`data owner/` (di luar repo, sudah berfungsi) — dibiarkan di tempatnya,
cuma respons JSON pencarian pengumumannya yang baru ditambah arsipnya.

## 📌 Sesi 17 Agu 2026 — Grafik Emiten (chart PAPAN tahap 3)

**Selesai & commit `3d47eca5`** (checkout utama, belum di-push). Rute `/grafik`
baru — lilin (candlestick) + volume dari `data-idx/json/ohlc/<KODE>.json`
(tahap 1/2), digambar `lightweight-charts@5.2.1` (opsi A, keputusan
sebelumnya). **Beda dari `/chart`**: itu widget TradingView yang menggambar
data TradingView sendiri; `/grafik` kanvas milik PAPAN sendiri — perlu supaya
overlay khas PAPAN (pita musiman, akumulasi broker, penanda Radar — tahap
berikutnya) bisa dipasang di atasnya.

Isinya: lilin+volume satu emiten, zoom/geser bawaan lightweight-charts,
pemilih rentang 1/3/5 thn/Semua (`.bchip.bchip-klik`, kosakata sama halaman
lain), kotak cari emiten dipakai ulang dari pola SeasonalityHarian +
`kamusEmiten.ts`. Dijaga login — baris `akses_halaman` kunci `grafik`,
`tingkat='login'`, `min_tier=0`, `urutan=150`. Ikon rail `GRF` (kode `CHT`
sudah dipakai TradingView).

**Bug ditemukan & ditambal saat verifikasi devtools** (bukan cuma dilaporkan
"kelihatan jalan" — diukur): container chart disembunyikan lewat
`display:none` selama data belum termuat, dan `autoSize`-nya lightweight-charts
memasang `ResizeObserver` SAAT chart dibuat (mount, saat container masih
`display:none` alias lebar 0). Begitu data datang dan `display` balik ke
`block`, `fitContent()` sempat jalan dengan lebar lama sebelum `ResizeObserver`
sempat mengoreksi — lilinnya numpuk di satu sisi kanvas, sisanya kosong.
**Ditambal**: sembunyikan lewat `opacity` (kotak layout tetap ada dari awal,
`ResizeObserver` dapat lebar sungguhan sejak mount). Lihat komentar
`.grf-chart-wrap.memuat` di `GrafikEmiten.css` — pola ini relevan untuk chart
lain yang dipasang berikutnya (Bedah Emiten, dst), bukan cuma di sini.

`vertTouchDrag: false` sengaja dimatikan di opsi chart — bawaan lightweight-
charts menelan gestur geser VERTIKAL di kanvas (dipakai buat pan harga),
padahal di halaman biasa (bukan widget layar-penuh) itu seharusnya tetap
menggulung halaman. Sama alasannya dengan `touch-action: pan-y` di hit-rect
SVG SeasonalityHarian (#172).

Angka terukur (BBCA, viewport 1536×960×1.25, rentang default "1 thn"): 244
lilin terpasang, cocok dengan hitungan manual dari `BBCA.json` (potong ke
`akhir - 1 tahun` = 2025-08-14 → 2026-08-14, juga 244 baris). Tinggi kanvas
460px (desktop) / 340px (telepon, breakpoint 700px). Rail nav: sisa ruang
sesudah ikon ke-16 (GRF) **≈52,6px** — cukup untuk **1 ikon lagi**, bukan 2
seperti tercatat #175 sebelum sesi ini (itu dihitung sebelum GRF ditambahkan).

7 tes baru di `lib/dasbor/grafikEmiten.test.ts` (murni: potong rentang, pisah
lilin/volume) — total 291 (dari 284).

## 📌 Sesi 16 Agu 2026 (siang–malam) — Beranda, Kabar, Tanya PAPAN

**Sudah live 16 Agu 2026 malam** — 48 commit didorong ke `main`
(`778ec1c2..94958c5a`, 73 berkas, +17.054/−374) atas aba-aba Johan.

> **Cara menghitung yang menunggu push — patokannya `origin/main`, titik.**
> ```bash
> git rev-list --count origin/main..HEAD
> ```
> Sesi ini sempat salah lapor: dihitung dari commit teratas saat sesi dimulai,
> hasilnya 55 lalu 61, padahal yang benar-benar belum live cuma 48 — selisih 15
> commit sudah ter-push di sesi sebelumnya. Patokan awal-sesi tak tahu apa-apa
> soal apa yang sudah ada di produksi, jadi angkanya **selalu melebihkan**.

### Yang selesai

| Bagian | Hasil |
|---|---|
| **Beranda baru** | Halaman utama bukan lagi dasbor: PAPAN + IHSG (lilin YTD), ringkasan pasar, terbit terakhir, kabar 4 kolom, kartu menu |
| **Ringkasan pasar** | Naratif dari aturan, bukan LLM — ambangnya **dikalibrasi dari 2.409 hari bursa** (`scripts/kalibrasi_ambang.py`), bukan ditebak |
| **Kabar Pasar** (`/kabar`) | 1.028 kabar, 5 sumber, tab & daftar bulan diturunkan dari data |
| **Arsip IPOT** | 737 item, 13 Jul–16 Agu (`scripts/panen_ipot_arsip.py`) |
| **Arsip Snips** | 238 item setahun (`scripts/panen_snips.py`) |
| **Tanya PAPAN** | Tombol mengambang + panel; menjawab dari data harian, lintas waktu, per emiten, KSEI, grup, kalender — plus 32 entri pengetahuan platform & **75 istilah glosarium** yang ditambang dari terbitan PAPAN sendiri |
| **Panen otomatis** | GitHub Actions tiap 2 jam untuk sumber tanpa batasan IP |

### Temuan yang mengubah rencana

- **Endpoint IPOT mengabaikan parameter `halaman`.** Halaman 0, 1, 5, dan 50
  membalas 200 `news_id` yang sama persis. Kedalaman maksimal ~200 berita per
  kanal (±1 bulan) — **YTD tidak bisa dicapai dari endpoint ini.** Arsipnya
  tumbuh dengan cara lain: skripnya menggabung, jadi panen berkala membentuk
  arsip panjang dari jendela satu bulan yang bergeser.
- **CNBC & detikFinance dicabut** (alasan di bagian jalur panen di bawah).
- **Pengumuman IDX punya tautan per pengumuman** — `attachments[]` yang
  `IsAttachment: false` adalah PDF dokumennya. Sebelumnya semua baris
  menunjuk ke satu halaman pencarian.

### Keputusan Johan, 16 Agu 2026 (malam)

| Hal | Putusan |
|---|---|
| **#160** | ✅ **Dijalankan.** Migrasi `bersihkan_sisa_status_ditolak` sudah diterapkan; nol sisa `'ditolak'` di seluruh objek DB, dan penamaannya ikut dirapikan di klien |
| **Gemini Flash** | ⏸ **Setelah SPLE.** Halaman baru dari SPLE akan menambah data yang juga harus dijangkau — lebih hemat menyetel LLM sekali setelah cakupan rule-engine lengkap |
| **Arsip IPOT** | ⏸ **Biarkan tumbuh sendiri**, dan jadikan backlog: bahas dulu cara scraping yang tepat, jangan menembak `news_id` satu per satu |
| **CLAUDE.md** | ✅ **Di-track.** Sudah dikeluarkan dari `.gitignore` supaya aturannya terbawa ke tiap worktree baru |
| **Baris yatim INDY** | ✅ **Dihapus** atas persetujuan Johan. Nol baris yatim & nol berkas yatim tersisa (24 setoran) |

Urutan kerja berikutnya yang disepakati: **#169 (halaman baru dari SPLE)**
lalu **#170 (penyeragaman kendali)**.

### #169 — Lanjutkan jalur SPLE → `docs/workflow-fundamental.md`

⚠️ **Bukan rencana baru.** Riset SPLE sudah selesai dan rencananya sudah
tertulis lengkap sejak 16 Agu pagi — jangan menyusunnya ulang:

| Berkas | Isi |
|---|---|
| `docs/riset/sple/peta-section.md` | Tiap section kedua situs: anchor → fungsi render → sumber data. 138 fungsi, 144 elemen ber-id, ditelusuri dari kode |
| `docs/riset/sple/metodologi-sple-info.md` | Rumus mereka: entry/SL/TP, screener M/V/T, harmonic (BC/AB 0,382–0,886), 4 preset + angka backtest |
| `docs/riset/sple/banding-fitur.md` | PAPAN vs SPLE + kolom ketersediaan data kita |
| `docs/riset/sple/*.png` | 12 tangkapan layar tiap section |
| `docs/workflow-fundamental.md` | **Rencana kerjanya**: jalur A (fundamental → Bedah Emiten 12 section), B (metadata IDX), C (lubang lain) |

**Rekonsiliasi 16 Agu malam — tiga fase ternyata sudah selesai** tanpa
dokumennya diperbarui: **C1 berita** (`/kabar`), **C5 ringkasan naratif**
(kalibrasi 2.409 hari bursa), dan **C9 chat AI** (Tanya PAPAN lapis aturan).
Nyaris direncanakan ulang dari nol. Statusnya kini tercatat di jalur C.

Empat pekerjaan berikutnya menurut urutan dokumen itu — semuanya kecil dan
**tak bergantung panen apa pun**:

1. **B1** sektor IDX-IC resmi (dipakai semua halaman lain)
2. **A0** satukan dua sumber fundamental — menambal `operating_cf` kosong 80%
   di panel Stock Detail yang **sudah ada**
3. **A1** rata-rata 5 tahun + ambang verdict valuasi
4. **B2** broker summary harian ke JSON

Lalu **A2 Bedah Emiten** (halaman baru, 12 section, satu commit per section),
dan di jalur terpisah **C2 indikator → C3 screener** (halaman baru juga —
C2 wajib duluan, screener tanpa kolom indikator cuma jadi tabel harga).

### Data — panen 18 Agustus 2026

**OHLCV diperdalam 5 → 10 tahun** (`ce0b03e`). Median 2.256 baris/emiten (dari
1.208), 472 emiten kini mulai 2016. `panen_ohlc.py` punya `--lewati-cukup`
sehingga panen yang putus bisa dilanjutkan; patokannya ruas `th_full`
(kedalaman yang PERNAH diminta), bukan tanggal `mulai` — emiten IPO baru tak
akan pernah memenuhi patokan tanggal dan akan ditarik ulang selamanya.

**Ruas fundamental ringkas ditambal** (`b6717c0f`, `78ec759d`). `eps` 84→98%,
`hist_eps` 67→97%, `f_score` 66→97%, `roe` 88→98%, `der` 79→93%. Akarnya:
ruas-ruas itu **salinan mentah `info` yfinance**, jadi kosong begitu yfinance
tak punya kuncinya — padahal `ttm_net_income`/`shares`/`last_price` ada di
berkas yang sama. `scripts/lengkapi_fundamental.py` menurunkannya tanpa satu
pun permintaan jaringan, dijalankan sesudah `fetch_fundamental.py`.

`q_eps` dan `altman_z` **sengaja tidak diisi**: XBRL cuma punya satu periode
kuartal dan itu kumulatif (mengisinya = menyebut EPS setengah tahun sebagai
EPS satu kuartal), dan Altman butuh modal kerja + saldo laba yang belum
dipanen. Jalan naiknya di `docs/workflow-fundamental.md` A0b.

**Yang belum ditutup dan perlu diputuskan:** OHLC kini punya data sampai
**2026-08-18**, sementara `data-idx/json/index.json` (indeks harian dasbor)
berhenti di **2026-08-14**. Halaman yang membaca lilin harian sudah tahu dua
hari bursa yang belum diketahui sisa dasbor. Perlu panen harian menyusul, atau
`/grafik` dibatasi mengikuti `index.json` — pilih satu, jangan dibiarkan.

### #170 — Refactor kendali: tombol & kontrol belum seragam

> **SELESAI 18 Agustus 2026** untuk K1, K2, K3, K5, K8, K10 dan seluruh temuan
> audit yang tak butuh keputusan baru. Hasil lengkap + apa yang sengaja tidak
> dikerjakan: `docs/spek-kendali.md` bagian "Hasil gelombang #170".
>
> **Masih menunggu Johan:** K4 (rentang Grup Konglomerat menghitung apa?),
> K6 (kartu broksum — apa yang salah dari kartunya?), K7 (jalur data Radar,
> bukan pekerjaan tampilan).
>
> Komponen kanonis yang lahir dari gelombang ini dan wajib dipakai kendali
> baru: `LangkahTanggal`, `TombolIkon`, `PemilihRentang`, `TombolLayarPenuh`,
> plus kelas `.af-cari`, `.chip-t`, `.bilah-rentang`, `.ti-grup`, `.th-sort`.


Dikeluhkan Johan 16 Agu 2026: tombol kalender, kotak pencarian, pemilih
rentang waktu, dan kawan-kawannya **tidak senada antar halaman** — beberapa
`<select>` bawaan, beberapa `Dropdown` proyek, beberapa `DatePicker`, dengan
ukuran dan bingkai yang tak sama.

Bahan yang sudah ada dan seharusnya jadi acuan: `components/dasbor/Dropdown.tsx`,
`DatePicker.tsx`, kelas `.af-cari`, `.tabs/.tab`, `.dd-btn`, `.inp`. Jadi ini
bukan bikin baru, melainkan **menyeragamkan yang sudah ada lalu mencabut
duplikatnya**.

Prinsip yang sudah terbukti di sesi ini dan berlaku di sini: gaya bersama
ditulis sebagai **aturan bawaan**, bukan disalin per komponen — begitu harus
disalin supaya bekerja, ia akan berhenti bekerja (kasus batang gulir 2px,
kemampuan §188).

Dikerjakan **setelah** #169, karena halaman baru dari SPLE akan menambah
kendali baru; menyeragamkan sekarang berarti menyeragamkan dua kali.

### #171 — Rule engine paham dari SATU KATA

Diminta Johan 16 Agu 2026 setelah menguji sendiri: *"perlu kembangin rule
engine yang lebih luas lagi supaya dengan 1 kata saja sudah paham"*.

Yang dia ketik dan gagal: `kontributor`, `tier`, `level`, `model ai`. Tiga
pertama sudah ditambal hari itu juga (kata tunggal didaftarkan sebagai kunci)
dan entri `model-ai` dibuat, tapi cara menambalnya masih satu per satu — dan
itu tak akan mengejar cara orang bertanya.

Yang perlu dikerjakan, bukan sekadar menambah kunci lagi:

- **Peta sinonim terpusat** (`tier` = `level` = `jenjang` = `tingkat`;
  `benefit` = `manfaat` = `keuntungan`), supaya satu istilah baru cukup
  didaftarkan sekali, bukan di tiap entri yang menyinggungnya.
- **Tahan salah ketik ringan** — Johan mengetik `benegit`, dan itu jatuh ke
  lapis AI padahal jawabannya pasti ada. Jarak Levenshtein ≤1 untuk kata ≥6
  huruf sudah menutup sebagian besar kasus tanpa melahirkan kecocokan palsu.
- **Kata tunggal = niat luas**, jadi jawabannya sebaiknya ringkas + menawarkan
  cabang ("mau yang mana: syarat naik jenjang, kuota, atau daftar jenjangnya?")
  alih-alih menebak satu entri.
- **Ukur, jangan rasakan.** Baterai di `pengetahuan.test.ts` sudah jadi alat
  ukurnya; tambahkan gelombang pertanyaan satu-kata ke situ lebih dulu, baru
  perbaiki sampai hijau.

Prinsip yang sudah terbukti dua ronde: **entrinya biasanya sudah ada, yang
kurang cara menemukannya.** Ronde 1 sembilan lubang, sembilan-sembilanya
karena pencocokan frasa terlalu kaku; ronde 2 dua puluh lima lubang, sebagian
besar karena kunci terlalu sempit.

### ⚠️ Catatan git 16 Agu malam — commit tercampur

`94133bdc` berjudul "feat(tanya-papan): kata tunggal dikenali…" tapi isinya
JUGA memuat seluruh pekerjaan tab Bedah (`BedahUnggah.tsx`,
`PanduanScreenshot.tsx`, `supabaseEdisi.ts`). Sebabnya saya menjalankan
`git add -A app/src` selagi agen lain sedang menyunting berkas di pohon kerja
yang sama.

Isinya tetap utuh dan sudah teruji (265 lalu 266 tes hijau) — yang salah cuma
pesannya. Aturan yang diambil dari ini: **selagi ada agen berjalan, jangan
`git add` seluruh direktori.** Sebut berkasnya satu per satu, atau tunggu
agennya selesai. Pesan commit yang berbohong lebih mahal daripada beberapa
detik yang dihemat.

### #172 — Emiten dijawab ANALISA + saran pertanyaan lanjutan (penting)

Diminta Johan 16 Agu 2026 malam, setelah menguji sendiri dan menyimpulkan
"masih belum nyambung".

**Yang terjadi sekarang.** Semua pertanyaan tentang satu emiten jatuh ke satu
kalimat yang sama, apa pun yang ditanyakan:

| Diketik | Dijawab |
|---|---|
| `DSSA` | "DSSA: peringkat 4 nilai transaksi terbesar; dibahas di 2 edisi" |
| `analisa DSSA` | **kalimat yang sama persis** |
| `DSSA di akumulasi oleh broker apa?` | **kalimat yang sama persis** |

Jadi mesin mengenali KODENYA tapi mengabaikan APA YANG DITANYAKAN. Tautannya
pun selalu ke Stock Detail, padahal pertanyaan broker mestinya ke Broker
Summary, pertanyaan pola musiman ke Seasonality, kepemilikan ke Peta Investor.

**Yang perlu dikerjakan:**

1. **Jawaban per emiten dirakit dari SEMUA sudut yang kita punya**, bukan satu
   baris peringkat: posisi harian, fundamental (147 ruas), kepemilikan KSEI,
   grup konglomerat, pola musiman, status Radar, edisi yang membahasnya, kabar
   yang menyebutnya. Sebagian sudah ada di `jawab()`, tapi kalah dulu oleh
   blok peringkat.
2. **Aspek pertanyaan menentukan isi DAN tautannya.** "broker" → Broker
   Summary, "musiman/bulan apa" → Seasonality, "siapa pemilik" → Peta
   Investor, "murah/mahal" → Stock Detail valuasi. Satu emiten bisa punya
   banyak pintu; sekarang cuma satu yang dipakai.
3. **Saran pertanyaan lanjutan di bawah jawaban** (yang Johan sebut "tooltips
   atau ramalan teks"): 3-4 chip yang bisa diklik, **diturunkan dari data yang
   memang ada untuk emiten itu** — jangan menawarkan "arus broker DSSA" kalau
   broker summary-nya tak pernah disetor. Chip yang menjanjikan sesuatu yang
   tak ada lebih buruk daripada tak ada chip.
4. **Jawaban yang mengaku tak tahu WAJIB menyebut apa yang ada.** "Belum ada
   data broker untuk DSSA — yang ada: peringkat harian, valuasi, kepemilikan
   KSEI." Itu yang membuat panel terasa nyambung, bukan panjangnya kalimat.

**Sepupunya, kerjakan sekalian:** sambungan berkata ganti masih putus.
"apa manfaatnya dari keenam itu?" sesudah jawaban daftar jenjang tak dikenali
(jatuh ke lapis AI, dan AI-nya menjawab bahwa rujukannya tak jelas), padahal
"keenam itu" jelas menunjuk jawaban sebelumnya. `topik` sekarang cuma menyimpan
JENIS jawaban, bukan isinya — perlu menyimpan juga entitas terakhir yang
disebut (kode emiten, daftar yang baru ditampilkan) supaya rujukan seperti
"itu", "yang tadi", "keenam itu" punya sandaran.

Berhubungan dengan [[#171]] (paham dari satu kata) — keduanya soal yang sama:
mesin sudah punya datanya, yang kurang cara menghubungkan pertanyaan ke data
itu.

### 🎯 #130 — Divergensi tiga lapis (definisi Johan, 17 Agu 2026)

Bunyi keputusannya: *"lebih kepada teknikal analisis dimana kamu harus bisa
tentukan chart itu membentuk pola bearish divergent atau bullish divergen,
kolaborasi dengan indikator stochastic, mungkin volume lebih baik dibanding
umumnya."*

Jadi tiga lapisnya **bukan** harga/volume/frekuensi seperti dugaan awal
melainkan:

| Lapis | Isi | Perannya |
|---|---|---|
| 1 | **Harga** — puncak & lembah (swing pivot) | menentukan ADA-tidaknya pola |
| 2 | **Stochastic** — momentum | pembanding yang menyatakan divergensi |
| 3 | **Volume** | **pengesah**, bukan sekadar pelengkap |

Pilihan Stochastic (bukan RSI/MACD) disengaja Johan: "dibanding umumnya".
RSI & MACD sudah ada di `lib/radar/`, Stochastic belum — jadi ia lahir bareng
C2 indikator.

**Definisi polanya** (regular divergence, yang klasik):

- **Bearish** — harga membentuk puncak LEBIH TINGGI, stochastic membentuk
  puncak LEBIH RENDAH. Naiknya kehilangan tenaga.
- **Bullish** — harga membentuk lembah LEBIH RENDAH, stochastic membentuk
  lembah LEBIH TINGGI. Turunnya kehilangan tenaga.

**Lapis volume sebagai pengesah** — ini yang membedakan dari kebanyakan
indikator divergensi:

- Bearish sah kalau puncak kedua terjadi dengan **volume lebih rendah**
  daripada puncak pertama (naik tanpa dukungan = distribusi).
- Bullish sah kalau lembah kedua terjadi dengan **volume lebih rendah**
  daripada lembah pertama (jual mengering).
- Volume yang bergerak berlawanan **tidak membatalkan** polanya, tapi
  menurunkan derajatnya — dan derajat itu WAJIB terlihat pembaca.

**Derajat keyakinan**, ditampilkan apa adanya:

| Derajat | Syarat |
|---|---|
| Kuat | harga + stochastic + volume ketiganya sejalan |
| Sedang | harga + stochastic sejalan, volume tak mendukung |
| Lemah | jarak antar-pivot terlalu jauh/dekat, atau salah satu pivot ragu |

**Yang harus diputuskan saat mengerjakan, JANGAN ditebak sendiri** — semuanya
menentukan hasil dan wajib bisa diaudit:

1. Deteksi pivot: pakai zigzag ambang persen (riset SPLE memakai swing minimal
   3% dari 108 hari — angka itu titik awal yang masuk akal, bukan kebenaran).
2. Parameter Stochastic: %K, %D, perataan. Bawaan 14/3/3 kecuali ada alasan.
3. Jarak sah antar-pivot: dua pivot yang terlalu berdekatan bukan divergensi,
   yang terlalu berjauhan tak lagi berhubungan.
4. Volume dibandingkan sebagai rata-rata di sekitar pivot, bukan satu batang —
   satu batang terlalu berisik.

**Aturan PAPAN yang tetap berlaku di sini:** ini penyajian pola, BUKAN
rekomendasi beli/jual. Ambangnya **dikalibrasi dari data**, bukan diambil dari
buku — persis seperti ambang narasi harian yang dihitung dari 2.409 hari bursa.
Dan kalau polanya tak ada, jawabannya "tak ada divergensi" — bukan mencari-cari
sampai ketemu.

**Bergantung pada C2** (indikator per emiten). Datanya sudah lengkap: OHLCV 5
tahun untuk 962 emiten.

### #173 — Tabel Akses perlu hierarki induk–turunan

Diminta Johan 17 Agu 2026: *"perlu dibuat turunan nya misal Bulletin Arus
Pasar (bulletin) - tombol Probabilitas & VolVal (probvv)"* — supaya kejadiannya
tak terlupa.

**Masalahnya.** Tabel Akses menyajikan sebelas kunci sebagai daftar RATA,
padahal isinya tiga jenis yang berbeda sifat:

| Kunci | Sebenarnya apa | Bukti di kode |
|---|---|---|
| `bulletin` | **halaman** | rute `/bulletin` |
| `probvv` | **kolom/tombol DI DALAM** halaman Bulletin | `Bulletin.tsx:136` — `boleh('probvv')` mengunci satu kolom di tabel Bulletin |
| `seasonality` | **halaman** | rute `/seasonality` |
| `seasonality-hari` | **tab DI DALAM** halaman Seasonality | `Seasonality.tsx:43` — `boleh('seasonality-hari')` mengunci satu tab |

Karena disajikan rata, superadmin tak bisa melihat bahwa mengunci `bulletin`
otomatis membuat `probvv` tak terjangkau — kunci anak jadi tak berarti kalau
induknya sudah tertutup. Sekarang hubungan itu **hanya ada di kepala**, dan
itu persis yang diminta Johan supaya tak terlupa.

**Yang perlu dikerjakan:**

1. Kolom `induk` di `akses_halaman` (nullable, menunjuk `kunci` lain).
   Isi awal: `probvv` → `bulletin`, `seasonality-hari` → `seasonality`.
2. Tabel Akses menampilkannya **bertingkat** — anak menjorok di bawah
   induknya, dengan label jenisnya ("tombol", "tab", "kolom"), bukan daftar
   rata yang diurutkan angka.
3. **Peringatan saat induk lebih ketat dari anaknya.** Kalau `bulletin` diset
   Diamond sementara `probvv` Pemula, angka Pemula itu bohong — anak tak
   pernah terjangkau. Cukup peringatan yang terlihat, jangan dipaksa otomatis:
   memaksa berarti mengubah setelan yang tak diminta.
4. Urutan tampil ikut hierarki, bukan kolom `urutan` yang sekarang diisi
   manual (70, 80, 90…). Kolom itu boleh tetap ada untuk mengurutkan
   sesama-saudara.

**Bukan cuma kerapian.** Kunci anak yang induknya tertutup adalah setelan yang
tak pernah berlaku — dan setelan yang tak berlaku tapi terlihat aktif adalah
bentuk lain dari angka yang berbohong, sekeluarga dengan akurasi 100% palsu
(#160) dan kuota yang tak sesuai server.

### #168 — Cara scraping arsip berita yang benar (belum dibahas)

Batasnya sudah diketahui: endpoint IPOT mengabaikan `halaman`, jadi mentok
±200 berita per kanal. Yang **tidak** akan dilakukan tanpa pembahasan:
menelusuri `news_id` mundur satu per satu (ribuan permintaan ke server orang,
dan yang diambil halaman artikel bukan daftar).

Yang perlu dibahas lebih dulu: apakah ada endpoint arsip resmi yang belum
ketemu, apakah sumber lain (Snips sudah terbukti punya arsip setahun lewat
`?format=json` Squarespace) punya pola serupa, dan berapa laju permintaan yang
pantas kalau memang harus menelusuri. Prinsipnya sama dengan yang sudah
dipakai: metadata saja, tak menyalin isi, dan tak membebani sumbernya.


## ✅ Sudah selesai — dari permintaan Johan

| # | Tugas | Selesai |
|---|---|---|
| 118 | Tema PAPAN Lilin + font Red Hat + radius Samudra | 15 Agu 2026 |
| 120 | verify_jwt Edge Function — selesai tanpa dashboard Supabase | 15 Agu 2026 |
| 121 | Pesan galat Supabase tertelan "Gagal menyimpan" | 15 Agu 2026 |
| 110-117, 119 | Sembilan tugas admin, forum, jenjang, modal | 15 Agu 2026 |
| — | Halaman **Seasonality** (menggantikan rencana halaman Bakrie) | 15 Agu 2026 |
| — | Kalkulator tab **Pemulihan** lengkap: rupiah, hari ARA, harga otomatis | 15 Agu 2026 |
| — | Forum jadi satu halaman + moderasi + tag `$` | 15 Agu 2026 |
| — | Panen 962 emiten + IHSG harian 1990-2026 | 15 Agu 2026 |
| — | Pedoman fraksi harga & auto rejection BEI | 15 Agu 2026 |
| — | Sebagian #107: ripple angka IHSG | 15 Agu 2026 |
| 131a | **Seasonality tab 2** — pola hari dalam seminggu, grafik balapan | 15 Agu 2026 |
| 125 | Avg Down: cadangan harga lokal (fungsi bersama `lib/hargaTerakhir.ts`) | 15 Agu 2026 |
| 126 | Verifikasi dua viewport Seasonality + tiga perbaikan yang ditemukan | 15 Agu 2026 |
| — | Tab Akses: toast sebut setelan baru, lebar kolom Urutan, dropdown ≥10 opsi bisa dicari | 16 Agu 2026 |
| — | Form akun: domain `@papan.id` tempelan, tombol salin, sandi pakai kata pertama | 16 Agu 2026 |
| — | Tabel Akun: cari email/alias + 7 pilihan urutan (awal: jenjang tertinggi) | 16 Agu 2026 |
| — | **Pembekuan diukur dari kehadiran**, bukan setoran yang lolos kurasi | 16 Agu 2026 |
| — | **Ambang beku berjenjang** 5/7/10/20/60/120 hari kerja (kolom `jenjang.hari_beku`) | 16 Agu 2026 |
| — | **Status `revisi`** — penolakan yang tak menghukum akurasi, berkas boleh diganti | 16 Agu 2026 |
| — | Berkas setoran terkurasi tak bisa dihapus/diganti penyetornya | 16 Agu 2026 |
| — | Tabel unggahan: thumbnail berkas + tandai baris milik kontributor lain | 16 Agu 2026 |
| — | Tab Seasonality **berjenjang** (`seasonality-hari`, Perak) + penunjuk jarak setoran | 16 Agu 2026 |
| — | Kolom "Yang terbuka" diturunkan dari tabel Akses, bukan teks manual | 16 Agu 2026 |
| — | Peta Investor: enam kontrol satu baris, kotak cari 300px, tombol Reset dibuang | 16 Agu 2026 |
| — | Judul panel Top Stocks & Stock Detail sebut TANGGAL, bukan "Hari Ini" | 16 Agu 2026 |
| — | Tanggal setoran mundur ke hari bursa (`lib/tanggalBursa.ts`, 4 salinan disatukan) | 16 Agu 2026 |
| 141 | Setoran ditolak berhenti dihukum tiga kali (kuota, kunci emiten, hapus) | 16 Agu 2026 |

## 📋 Status borongan 16 Agu 2026 → `docs/ceklist-backlog.md`

Sesi borongan menutup **17 item**: #139, #144, #109b, #143, #108, #124, #128,
#127, #122, #132, #131b, #99, #107 (sebagian), lalu — setelah izin migrasi DB
dibuka — #142, #137, #123, #138.

Yang tersisa tinggal tiga, semuanya menunggu keputusan atau data:

- **#145** — arti "bar tembus" di dasbor belum punya rujukan di kode.
- **#146** — definisi "divergensi tiga lapis" (#130) menentukan seluruh
  perhitungan, jadi harus ditetapkan lebih dulu.
- **#129** — bandarmologi tetap terhalang sumber: broker per emiten tak ada di
  endpoint publik IDX.

Empat migrasi yang diterapkan: `setoran_status_dihapus_gantikan_ditolak`,
`buat_tabel_notifikasi`, `notifikasi_policy_rls`, `trigger_notifikasi_kurasi`,
`kunci_fungsi_trigger_kurasi`, `setoran_kolom_dimuat`.

## 🚦 Aturan rilis — berlaku sejak 16 Agu 2026

**Semua dikerjakan di localhost. `git push` hanya setelah Johan menyatakan live.**
Commit lokal boleh dan dianjurkan; mendorong ke `origin/main` memicu build Vercel, jadi
tiap push adalah rilis produksi. Lihat `CLAUDE.md` bagian "Cara kerja & rilis".

Sekalian: tiap tugas habis, tutup sesi dengan memperbarui **empat** tempat — CLAUDE.md,
berkas ini, memori proyek, dan `kemampuan-*.md` lintas proyek.

## 🗺️ Workflow pekerjaan → `docs/workflow-fundamental.md`

Temuan riset SPLE + uji endpoint IDX sudah disusun jadi rencana kerja
bertahap: jalur A (fundamental → halaman Bedah Emiten), jalur B (metadata
resmi IDX), jalur C (lubang lain dari banding fitur). Tiap fase punya
"selesai kalau" yang bisa diperiksa, dan empat pekerjaan pertama semuanya
kecil serta tak bergantung panen apa pun.

## 🆕 Antrean baru — dibuka 16 Agu 2026

Tiga yang menunggu KEPUTUSAN (tak bisa ditebak tanpa salah sasaran):

| # | Tugas | Yang perlu diputuskan |
|---|---|---|
| ~~145~~ ⏭️ | ~~"Bar tembus" di dasbor~~ — **DILEWATI** atas keputusan Johan 17 Agu 2026. Istilahnya tak pernah punya rujukan di kode dan tak ada yang menunggunya; ditutup daripada menggantung selamanya
| ~~146~~ ✅ | ~~Definisi "divergensi tiga lapis"~~ — **SUDAH DIDEFINISIKAN** Johan 17 Agu 2026. Spesifikasinya di bawah; #130 tak lagi terhalang, tinggal menunggu C2 (indikator per emiten)
| 129 | Chart bandarmologi | Bukan keputusan desain — **sumber datanya belum ada**. Broker per emiten tak tersedia di endpoint publik IDX; butuh sumber lain sebelum bisa dimulai |

Empat dari riset SPLE 16 Agu 2026 (`docs/riset/sple/README.md`):

| # | Tugas | Kenapa |
|---|---|---|
| 151 | **Selidiki jalur IDX API untuk broker summary per emiten** (cakupan menyempit — lihat `docs/sumber-fundamental-idx.md`: level PASAR sudah terbukti bisa, per EMITEN belum ketemu) | Dasbor SPLE memakainya lewat dua Netlify Function (`broker-data`, `broker-market`) — jadi jalurnya ADA, berlawanan dengan catatan lama kita. Saat diuji balasannya `IDX API 403` (IP datacenter diblokir, persis masalah GitHub Actions kita). Panen kita jalan dari IP rumahan, jadi justru lebih mungkin berhasil. **Ini membuka #129** |
| 152 | **Panen ruas pasar NEGO** (non-reguler) | SPLE menampilkannya sebagai "Bandar Flow": volume/value/frekuensi nego + rasio nego vs reguler. Ruasnya sudah ada di `GetStockSummary` yang kita panen tiap hari — tinggal dipakai |
| 153 | Halaman bedah fundamental per emiten | Padanan sple-mf: Money Flow 5 langkah, Quality of Earnings, Valuation Verdict (PER & PBV terpisah + fair value), laporan keuangan 5 tahun. Data keuangan kita sudah 646 emiten |
| ~~155~~ | ~~Grup Konglomerat di web kita~~ | ✅ Selesai 16 Agu — tab baru di Peta Investor, 11 grup / 82 emiten, **diturunkan dari nama pemegang saham KSEI** (`scripts/petakan_grup.py`), tiap chip menyimpan buktinya |
| 154 | Peringatan konteks + tanggal metodologi di tiap halaman analitik | Yang membuat SPLE dipercaya bukan sinyalnya, tapi panduannya: rumus terbuka, perubahan bertanggal, keterbatasan diakui sendiri |

Empat dari uji endpoint IDX 16 Agu 2026 (`docs/sumber-fundamental-idx.md`) —
**belum satu pun dipanen**, baru diuji bahwa endpointnya terbuka:

| # | Tugas | Kenapa |
|---|---|---|
| 156 | **Panen laporan keuangan resmi IDX** (XLSX ber-XBRL) | Diuji langsung: 778 emiten TW2 2026, 777 punya .xlsx, terbuka dari IP rumahan. Ratusan ruas per periode vs 15 dari Yahoo, dan tanpa lubang `operating_cf` 80% / `eps` 71% yang kita alami sekarang |
| 157 | Ambil sektor IDX-IC resmi dari sheet `1000000` | Klasifikasi Yahoo bukan IDX-IC; sheet itu memuat sektor→subsektor→industri→subindustri resmi |
| 158 | Tarik "pemegang saham pengendali" dari laporan resmi | Pelengkap #155 yang sekarang hanya dari KSEI — menutup celah kepemilikan lewat perusahaan bernama netral |
| 159 | Panen `GetBrokerSummary` harian ke JSON | 88 broker per tanggal, sekarang kita parse dari PDF |

Tiga yang operasional:

| # | Tugas | Keterangan |
|---|---|---|
| 148 | Daftarkan `JALANKAN_OTOMATIS.bat` ke Task Scheduler | Langkah panen harga (IHSG + OHLC emiten) sudah disisipkan sebagai langkah 5/7, tapi **berkas .bat masuk `.gitignore`** — perubahannya cuma ada di mesin ini. Sampai terdaftar, panen harian tetap manual |
| 149 | Buktikan trigger notifikasi kurasi jalan | Tabel/RLS/trigger/lonceng sudah terpasang, tapi sengaja TIDAK dipicu di sesi ini: memicunya berarti mengirim kabar ke kontributor sungguhan. Cek lonceng setelah kurasi berikutnya; kalau kosong, periksa trigger `setoran_kabari_kurasi` |
| 150 | Perluas cakupan laporan keuangan | Panen menghasilkan 646 dari 963 emiten. Sisanya kemungkinan tak punya laporan di Yahoo — perlu dipastikan mana yang memang kosong dan mana yang gagal ambil |

### 📰 Kabar pasar — pembagian jalur panen (catatan 16 Agu)

Panen kabar **boleh dipecah dua jalur**, dan itu justru menghilangkan
ketergantungan pada mesin rumahan untuk sebagian besar sumbernya:

| Jalur | Sumber | Kenapa |
|---|---|---|
| **GitHub Actions** (awan, selalu hidup) | Kontan — dan media lain yang RSS-nya terbuka | Tak ada blokir IP; feed publik biasa. Jalan walau komputer Johan mati |
| **Mesin rumahan** (`JALANKAN_OTOMATIS.bat` / `panen_kabar.ps1`) | IDX berita, IDX pengumuman emiten, IPOT News + arsip IPOT | Endpoint IDX **403 dari IP datacenter**; ini yang tak bisa pindah ke awan |

**Keputusan 16 Agu (sore): CNBC Indonesia & detikFinance DICABUT.** Feed CNBC
beralamat `/market/rss` tapi isinya campur berita umum, dan menyaring judul
dengan kata kunci pasar cuma memindahkan tebakan ke tempat lain. detikFinance
menjawab kalau diuji satuan tapi dua panen berturut-turut kena timeout —
sumber yang cuma kadang menjawab membuat jumlah item naik-turun tanpa sebab
yang terbaca. Arsip IPOT (`scripts/panen_ipot_arsip.py`, mundur sampai 1
Januari) jauh lebih tebal dan lebih relevan daripada keduanya digabung.
Item lama keduanya sudah dibuang dari `kabar.json`; tab `/kabar` menyusut
sendiri karena daftarnya diturunkan dari data.

Ongkosnya: dua jalur menulis ke satu berkas `kabar.json`, jadi perlu aturan
gabung yang jelas (jalur awan menulis sumber miliknya saja, jalur rumahan
menulis miliknya, keduanya merge alih-alih menimpa). Retensi `--hari` yang
sudah ada membuat penggabungan itu aman.

**Feed yang sudah diuji 16 Agu** (dari mesin ini, dengan `User-Agent` peramban):

| Feed | Hasil |
|---|---|
| `investasi.kontan.co.id/rss` | ✅ 200, ±25 item — sudah dipakai |
| `cnbcindonesia.com/market/rss` | ✅ 200, 100 item — **dicabut**, isinya bukan pasar murni |
| `finance.detik.com/rss` | ✅ 200, 100 item saat diuji satuan — **dicabut**, timeout saat panen sungguhan |
| `idxchannel.com/rss` | ✅ 200, 10 item |
| `bisnis.com/index/rss` & `market.bisnis.com/index/rss` | ⚠️ 200 tapi **nol `<item>`** — halaman HTML, bukan feed. Perlu jalur lain kalau tetap mau |
| `emitennews.com/rss` · `investor.id/rss` · `idnfinancials.com/id/rss` · `pasardana.id/feed` | ❌ 404/500/308 |

Aturan tampilan yang sudah diputuskan: **Beranda hanya empat sumber inti**
(IDX, IPOT News, Stockbit Snips, Kontan) dalam empat kolom; sumber tambahan
mana pun hanya muncul di halaman `/kabar`.

### 🤖 #167 — Lapisan AI di atas ringkasan pasar (ide, belum dikerjakan)

Ringkasan naratif harian sudah jadi (`lib/dasbor/ringkasHarian.ts`,
rule-engine, 11 uji). Ide lanjutannya: **agen AI sebagai keunggulan PAPAN**,
dengan satu aturan yang tak boleh dilanggar — LLM menulis **DI ATAS** fakta
yang sudah terkunci mesin aturan, tidak pernah menggantikannya.

Bentuk yang masuk akal, diurut dari yang paling aman:

| Tahap | Isi | Risikonya |
|---|---|---|
| A | LLM menulis ulang kalimat rule-engine jadi lebih luwes; angkanya dikunci dari input | Kecil — fakta tak bisa berubah, cuma gaya bahasanya |
| B | LLM merangkai narasi lintas hari ("pekan ini asing keluar lima hari beruntun") | Sedang — perlu jendela data yang jelas |
| C | Tanya-jawab data ("emiten mana yang broker-nya akumulasi 3 hari?") | Besar — jawaban harus selalu menyertakan query/angka pendukungnya |

Yang membedakan dari dasbor lain: mereka menaruh LLM di DEPAN data, kita
menaruhnya di BELAKANG — tiap kalimat tetap punya angka yang bisa diklik.
Pertanyaan yang belum dijawab: biaya per hari, kunci API disimpan di mana
(Edge Function, bukan klien), dan bagaimana menandai kalimat mana yang
ditulis mesin. Dibahas setelah barisan bug di bawah beres.

### 🐞 Bug & utang terbuka dari kerja admin 16 Agu — **dahulukan ini**

Yang sedang berjalan sudah dipakai kontributor sungguhan, jadi barisan ini
didahulukan daripada fitur baru mana pun.

| # | Tugas | Keterangan |
|---|---|---|
| ~~160~~ ✅ | ~~Bersihkan sisa status `'ditolak'` di TIGA objek SQL terakhir~~ — **SELESAI 16 Agu malam** (migrasi `bersihkan_sisa_status_ditolak`; nol sisa di seluruh objek DB, akurasi superadmin kini 96%) | `berkas_masih_menunggu()` (berkas milik setoran `dihapus` tak bisa dihapus penyetornya), `hitung_jenjang()` dan `ringkasan_keaktifan()` (penyebut akurasi kehilangan setoran yang ditolak → **akurasi selalu 100%**, kolom "Ditolak" di tab Aktivitas **selalu 0**). Sisi klien (`lib/jenjang.ts`) sudah memakai `'dihapus'`; SQL-nya yang tertinggal. Migrasinya sudah ditulis tapi **ditolak classifier izin** — perlu dijalankan ulang dengan persetujuan Johan |
| 161 | Pesan galat unggah masih generik | `terjemahkanGalatUnggah()` di `UnggahHarian.tsx` mengubah SEMUA galat RLS jadi satu kalimat yang menyebut empat kemungkinan sekaligus. Saat penolakan MBMA 14 Agu diselidiki, tak satu pun dari empat itu benar — dan sebab aslinya jadi tak bisa dilacak. Sertakan detail teknis server (boleh dilipat) alih-alih menelannya. Kelas bug yang sama dengan #121 |
| 162 | Penyebab penolakan unggah MBMA belum terbukti | Semua syarat lolos saat diuji ulang (kuota 12, emiten belum disetor, tanggal sah), tapi percobaan gagal tak meninggalkan jejak — barisnya dihapus otomatis saat upload gagal. Bergantung #161: tanpa pesan galat yang jujur, kejadian berikutnya juga tak akan terlacak |
| ~~163~~ ✅ | ~~Baris `setoran` INDY 14 Agu tanpa berkas~~ — **SELESAI**: barisnya dihapus atas persetujuan Johan; nol baris yatim & nol berkas yatim tersisa (24 setoran). Akar bugnya (`hapusScreenshot` menghapus berkas duluan lalu menelan galat) juga sudah dibalik urutannya | Status `dihapus`, berkasnya sudah lenyap dari bucket. Sisa dari bug policy `setoran_hapus` yang baru diperbaiki hari ini (`hapusScreenshot` menelan galat hapus baris). Tinggal diputuskan: dibiarkan sebagai catatan penolakan, atau dibersihkan |
| 165 | Buat thumbnail kecil saat unggah | Akar delay tab Unggah: screenshot broker summary 420–520 KB ditampilkan di kotak 40px. Lazy-load (16 Agu) memangkas JUMLAH yang diunduh, tapi tiap yang diunduh tetap setengah megabita. Supabase Image Transformation tak tersedia di paket **free**, jadi perkecil di klien saat unggah (`canvas` → WebP ±10 KB) dan simpan sebagai berkas kedua. Perlu penyesuaian kebijakan storage + `rangkumBerkas()` |
| 166 | **Rakit ulang mesin mingguan & bulanan** (hasil review 16 Agu) | Empat perbaikan yang diminta: **(a) pakai desain HARIAN** — `build_weekly.py` memakai palet `weekly` dan `build_monthly.py` palet `monthly` (krem), harusnya `daily` seperti terbitan induknya; **(b) buang tumpang tindih** — mingguan sekarang mencetak ulang halaman per-emiten dari edisi harian: terbukti **21 dari 24 halaman identik karakter-per-karakter** dengan AP-130826-E01 (`build_weekly.py` baris 223-235 memanggil `halaman_emiten` build.py untuk tiap emiten). Mingguan harus berisi agregat, bukan cetak ulang; **(c) data mingguan = data sepekan** — broker summary sudah tertranskripsi jadi JSON (`edisi/<tgl>.json`: `beli`/`jual` top-10 + `peran_broker`), jadi akumulasi/distribusi bersih per broker sepekan, emiten yang broker-nya konsisten menyerap, dan pergerakan harga Senin→Jumat semuanya bisa dihitung; **(d) bulanan = satu bulan penuh**, bukan potongan awal bulan, dan halaman ranking-nya jangan mengulang ranking mingguan |
| 164 | ~~Edisi Mingguan & Bulanan menunggu review~~ → **sudah dicabut 16 Agu** | Hasil review: `AP-W140826-E01` (29 hal, 72% cetak ulang) dan `AP-M0826-E01` (23 dari 24 pick "TANPA DATA", hit rate dari 1 sampel) **dicabut dari manifest**. Caranya: sidecar `<kode>.meta.json` diganti nama jadi `.meta.json.tahan` lalu `generate_index.py` dijalankan ulang — PDF-nya tetap tersimpan, tinggal dikembalikan namanya kalau mau terbit lagi. Terbit ulang setelah #166 selesai DAN syarat datanya terpenuhi. Kunci Bulletin di Diamond tetap sebagaimana dipasang Johan | `AP-W140826-E01` dan `AP-M0826-E01` sudah live, dirakit dari **dua hari bursa saja** (10 & 13 Agu) dengan 24 emiten yang sama persis — edisi berjudul "Bulanan · Agustus 2026" yang isinya dua hari, dan banyak isinya tumpang tindih dengan yang mingguan. Muncul tiba-tiba karena dibuat tanpa diminta. Johan akan mereview PDF-nya sendiri; **jangan dicabut, diperbaiki, atau dirakit ulang sebelum hasil reviewnya keluar.** Kunci Bulletin di Diamond adalah penahan sengaja selama masa review — jangan diubah |

### 🧭 Jalur fundamental (replikasi SPLE) — belum dimulai satu pun

Rencana lengkapnya di `docs/workflow-fundamental.md` (jalur A fundamental →
halaman Bedah Emiten 12 section, B metadata resmi IDX, C lubang lain).
Riset sumbernya di `docs/riset/sple/`. Dicatat di sini supaya tak hilang
jejaknya selagi kita menambal admin:

| Fase | Isi | Butuh panen? |
|---|---|---|
| B1 | Sektor IDX-IC resmi (#157) — menggantikan klasifikasi Yahoo di Sektor, Stock Detail, Screener | Tidak |
| A0 | Satukan `keuangan/` + `fundamental/` — menambal `operating_cf` yang kosong 80% di panel yang SUDAH ada | Tidak |
| A1 | Rata-rata 5 tahun + ambang verdict valuasi (dua sumbu: riwayat sendiri & median sektor) | Tidak |
| B2 | Broker summary harian dari `GetBrokerSummary` sebagai sumber kedua Top Broker | Tidak |
| A2 | Halaman **Bedah Emiten**, 12 section, satu commit per section | Tidak (pakai A0/A1) |
| A3 · B3 | Panen laporan keuangan XLSX ber-XBRL (#156) lalu pemegang saham pengendali (#158) | Ya |
| C1–C8 | Berita/RSS, indikator per emiten, screener, heatmap, watchlist, dst | Sebagian |

Empat yang pertama (B1 · A0 · A1 · B2) semuanya murah dan tak menunggu panen
apa pun — itu titik mulai yang disarankan **setelah** barisan bug di atas.

Tabel di bawah ini tetap dipertahankan sebagai rujukan ongkos-vs-hasil.

## ⏳ Antrean kerja — diurutkan dari yang paling murah

Urutannya bukan menurut siapa yang minta, tapi menurut **ongkos dibanding
hasil yang terlihat**. Yang murah dan langsung kelihatan didahulukan: tiap
satu selesai, ada sesuatu yang bisa dilihat atau diumumkan, dan itu menjaga
laju kerja tetap terasa.

Kolom **Agen** menandai mana yang bisa diserahkan ke model lebih ringan
(sonnet) karena speknya sudah tak ambigu — tinggal dieksekusi. Yang bertanda
"—" menuntut keputusan desain atau diagnosa, jadi tetap dikerjakan model
utama. Aturannya: makin tajam speknya, makin rendah tier yang aman.

| # | Tugas | Ongkos | Hasil terlihat | Agen |
|---|---|---|---|---|
| 108 | [IHSG] Panen harga BUKA harian | Kecil | Lilin berhenti jadi aproksimasi | ✅ sonnet — satu ruas ditambah ke skrip yang sudah jalan |
| 137 | Notifikasi hasil kurasi ke penyetor (setuju/revisi/hapus) | Sedang | Status `revisi` baru berguna kalau sampai ke orangnya | — migrasi DB + RLS; satukan dgn #123 |
| 142 | Ganti aksi "Tolak" dengan "Hapus + notice" | Sedang | Tiga aksi, tiga makna jelas; berkas mati berhenti menumpuk | — butuh #137 lebih dulu |
| 144 | **Koreksi istilah**: "orderbook" sebenarnya BROKER SUMMARY — sweep teks UI dulu | Kecil (lapis teks) | Berhenti mengajari pengguna istilah yang salah | ✅ sonnet utk lapis teks; lapis data tunggu #142 |
| 143 | **Keputusan** jalur transkripsi orderbook kalau produksi pindah ke CI | Kecil (memutuskan) | Menentukan apakah tombol "Terbitkan" bisa berdiri sendiri | — HARUS dijawab sebelum #138 |
| 138 | Pilih emiten MASUK PRODUKSI (layar "Susun Edisi" belum ada sama sekali) | Sedang-besar | Berhenti menolak data benar demi memangkas isi edisi | — UI **dan** skrip Python build_*.py ikut diubah |
| 128 | Cocokkan fraksi harga ke dokumen IDX | Kecil | Angka aturan bursa jadi pasti | — perlu penilaian sumber |
| 124 | Chart IHSG: pemilih rentang + judul | Sedang | Grafik 30+ tahun langsung terpakai | — keputusan sambungan dua sumber |
| 127 | PDF bulletin: daftarkan Red Hat | Sedang | Web & PDF seragam | ✅ sonnet kalau pipeline-nya sudah dipetakan |
| 132 | Chart komparasi Seasonality antar-emiten | Sedang | Perbandingan emiten lebih cepat dibaca | — keputusan bentuk grafik |
| 139 | Verifikasi tampilan sisi KONTRIBUTOR (tab tergembok, "Kontributor lain") | Kecil | Menutup dua fitur yang belum pernah terlihat | — butuh Johan login akun < Perak |
| 109b | Peta Investor: hapus mode ekspor "Seluruh dataset" (tombol sudah beres) | Kecil | Rapi | ✅ sonnet |
| 123 | Badge/notifikasi fitur baru | Sedang-besar | Kontributor tahu ada yang baru | — migrasi DB + RLS + desain |
| 107 | Dasbor: badge %, bar tembus, klik ke TradingView | Sedang-besar | Dasbor lebih hidup | sebagian ✅ sonnet |
| 122 | **[EMITEN] Panen OHLC harian 5 tahun** — Yahoo utk riwayat, IDX utk hari berjalan | Besar | Chart candle per emiten | panen ✅ sonnet · chart — |
| 131b | Seasonality tab 2 — bagian emiten | Besar | Pola harian per emiten | terhalang #122 |
| 130 | Analisis volume & divergensi tiga lapis | Besar | Yang tak ada di aplikasi lain | terhalang #122/#108 |
| 99 | Stock Detail: laporan keuangan kuartalan | Paling besar | Fundamental lengkap | — perlu perancangan tabel |
| 129 | **[PALING AKHIR]** Chart bandarmologi ala @Asta_8_Free_Bot | Paling besar | Lima panel bawahnya BELUM ada datanya | — perlu sumber broker per emiten |

#139 paling murah dan menutup dua fitur yang sudah dibangun tapi belum pernah
terlihat. #137 mendesak bukan karena besar, tapi karena memblokir kegunaan
status `revisi` yang baru dipasang: permintaan perbaikan yang tak sampai ke
orangnya sama saja dengan penolakan diam-diam.

Yang bertanda ✅ sonnet bisa dikerjakan bersamaan oleh agen terpisah karena
berkasnya tak bersinggungan — #125/#126 dan status `revisi` memang berjalan
paralel tanpa bentrok.

### Panen data harian — dua sumber, dua peran

Sudah terbukti dan tak perlu diperdebatkan lagi tiap kali menyentuh #122/#108:

| Sumber | Dipakai untuk | Batasnya |
|---|---|---|
| **Yahoo Finance** | Riwayat SEBELUM 2020, dan **harga BUKA riwayat** (di sana `open` terisi penuh) | `range=max` diam-diam menurunkan resolusi jadi bulanan walau `interval=1d` — WAJIB `period1`/`period2` |
| **IDX GetStockSummary** | Hari berjalan DAN riwayat per tanggal sejak awal 2020 — 32 ruas (volume, frekuensi, asing, dll) | `OpenPrice` praktis kosong sebelum 2025 (5-8%), hari ini pun cuma 74%. Ruas lain 100% terisi |

**Koreksi yang perlu diingat** (16 Agu 2026): IDX BISA ditarik mundur per
tanggal sampai awal 2020 — yang tak bisa mundur cuma `OpenPrice`-nya. Dan nol
di ruas Open bukan berarti emitennya tak diperdagangkan: 14 Nov 2024, 900
emiten ber-Open nol padahal 785 di antaranya punya volume. Dipakai apa adanya,
candle-nya akan menggambar buka di harga 0.

Panen 963 emiten sekali jalan terbukti aman: 0 penolakan, permintaan berurutan
dengan jeda acak. Jadwal harian 16:45 WIB — bursa tutup 16:15, Yahoo delay
±15 menit, penutupan resmi final sekitar 30 menit sesudahnya.

## 🏁 Milestone: chart PAPAN sendiri

Disebut Johan 15 Agu 2026: panen data harian untuk membangun **chart versi
kita sendiri**, dengan banyak indikator bergaya PAPAN — alasannya, kalau kode
sumbernya milik sendiri, improvisasinya tak dibatasi siapa pun.

Ini bukan satu tugas. Ini payung yang menaungi #122, #124, #129, #130, dan
menentukan urutan pengerjaannya.

### Kenapa ini masuk akal sekarang

Pondasinya sudah berdiri, dan itu bagian yang biasanya paling sering gagal:
panen 963 emiten berjalan dengan 0 penolakan, dan `panen_ohlc.py` sudah
menyimpan OHLCV harian penuh per emiten. Yang tersisa memang bagian yang
bisa dikerjakan, bukan bagian yang bergantung pada izin pihak lain.

### Yang membuatnya layak dibanding menempelkan TradingView

Menempelkan chart orang lain berarti berhenti di apa yang mereka sediakan.
Chart sendiri membuka lapisan yang tak mungkin ada di sana, karena datanya
memang cuma PAPAN yang punya:

| Lapisan | Sumber datanya | Ada di TradingView? |
|---|---|---|
| Akumulasi broker per emiten | Panen broker summary harian | Tidak |
| Pita musiman (bulan & hari kuat/lemah) | Mesin Seasonality yang sudah jalan | Tidak |
| Penanda WDWL / Radar | Produk PAPAN sendiri | Tidak |
| Level S/R yang sadar fraksi BEI | `lib/fraksiHarga.ts` | Tidak — fraksi IDX tak dikenali |
| Divergensi tiga lapis (#130) | Ruas volume IDX | Tidak |
| Indikator baku (MA, RSI, MACD, BB) | OHLCV harian | Ya |

Baris terakhir yang paling penting dipahami: indikator baku **bukan** alasan
membangun ini. Semuanya sudah ada di mana-mana dan masing-masing cuma
belasan baris. Yang membenarkan ongkosnya adalah lima baris di atasnya.

### ✅ Keputusan: opsi A (Johan, 16 Agu 2026)

"Kode sumber kita sendiri" bisa berarti dua hal yang ongkosnya jauh berbeda:

**A. Mesin gambar pakai `lightweight-charts`, lapisan indikator milik kita.**
Pustaka Apache-2.0 dari TradingView, dipasang di aplikasi kita, tanpa iframe
dan tanpa panggilan ke server mereka. Semua indikator, overlay, dan
perhitungan tetap kode kita — yang dipinjam cuma penggambar sumbu, lilin,
zoom, dan crosshair. Ongkos: sedang. Bisa jalan minggu ini.

**B. Penggambar sendiri dari nol (Canvas/WebGL).**
Termasuk menulis ulang sumbu waktu yang melompati hari libur, zoom-pan yang
mulus di ponsel, penjajaran multi-panel, dan crosshair. Ongkos: besar, dan
sebagian besarnya habis di pekerjaan yang tak terlihat sebagai fitur.

**Johan memilih A (16 Agu 2026).** Yang Johan sebut — "bisa improvisasi lebih detail" —
seluruhnya ada di lapisan indikator dan overlay, dan lapisan itu 100% milik
kita di opsi A. Opsi B menambah kendali atas bagian yang justru tak ada
bedanya bagi pembaca. Kalau nanti penggambarnya terasa membatasi, menukar
mesin gambar jauh lebih murah daripada menulisnya di awal.

### Urutan kerja setelah keputusan diambil

| Tahap | Isi | Bergantung pada |
|---|---|---|
| 1 | #122 — panen OHLC 5 tahun seluruh emiten | — (skrip sudah siap) |
| 2 | #108 — harga BUKA harian IHSG | — |
| 3 | Chart dasar: lilin + volume + zoom, satu emiten | Tahap 1 |
| 4 | Indikator baku: MA, EMA, RSI, MACD, Bollinger | Tahap 3 |
| 5 | #130 — divergensi tiga lapis | Tahap 4 |
| 6 | Overlay khas PAPAN: pita musiman, akumulasi broker, penanda Radar | Tahap 5 |
| 7 | #129 — bandarmologi multi-panel | Tahap 6 + sumber broker per emiten |

Tahap 1-3 sudah cukup jadi rilis yang bisa diumumkan. Tahap 6 yang membuat
chart ini tak punya pembanding.

### Rantai produksi PDF — dua bagian, sifatnya beda

Sering terlupa dan sempat membuat rencana #138 keliru:

```
screenshot orderbook  →[TRANSKRIPSI: Vision]→  edisi/<tgl>.json  →[build.py]→  PDF
```

`build.py` **tak menyentuh gambar sama sekali** — dia membaca JSON yang isinya
sudah berupa angka. Perakitan bisa jalan di CI tanpa AI; transkripsi tidak.
Lihat #143 untuk pilihan jalurnya.

## Keputusan yang sudah diambil

| Hal | Keputusan |
|---|---|
| Akses Seasonality | Perlu masuk, lewat kunci `seasonality` di tab Akses |
| Rentang tahun | Semua data, dengan filter 2010/2015/2020 |
| Cakupan data | Panen sekali semua emiten, penyegaran **harian** inkremental |
| Tema | Lilin + Red Hat + radius 12px/8px. Bentuk pil **ditolak** |
| Animasi papan | Riak saja; flip dibuang |
| Toggle tema | Satu ikon di rail; mode "sistem" tetap hidup di kode |
| Pengumuman | Tanpa UI admin, ditulis ke DB saat diminta |
| Transkripsi orderbook | **Tetap manual** (opsi A, #143) — dilakukan Claude di sesi, tidak dipindah ke API berbayar dan tidak dibebankan ke kontributor. Konsekuensinya tiap edisi butuh satu sesi |
| Prosedur produksi | Runbook lengkap per jenis edisi: `docs/produksi-edisi.md` |
| Pembekuan otomatis | Diukur dari **kehadiran** (`max(dibuat_pada)` setoran apa pun statusnya), bukan dari setoran yang lolos kurasi. Mutu dihukum di jalur jenjang, bukan di sini |
| Ambang beku | Ikut jenjang: Pemula 5, Perunggu 7, Perak 10, Emas 20, Platinum 60, Diamond 120 hari kerja (≈5,5 bulan). Kolom `jenjang.hari_beku` |
| Status `revisi` | Penolakan yang tak menghukum — berkas boleh diganti, TIDAK ikut membagi akurasi. Untuk penyetor beritikad baik yang datanya perlu diperbaiki |
| Aksi kurasi | Tiga saja: **Setujui · Revisi · Hapus**. "Tolak" dibuang (#142) — dia tak menjawab apa pun: berkasnya tinggal, penyetor tak bisa memperbaiki, akurasinya turun. Baris `ditolak` yang ada DIKONVERSI ke `dihapus`, bukan dibiarkan — dua status yang artinya sama akan menempel di tiap query akurasi selamanya |
| Setoran ditolak | TIDAK memakan kuota, TIDAK mengunci emitennya, dan boleh dihapus penyetornya. Penolakan sudah dihukum di akurasi — menghukumnya lagi dengan kehilangan giliran hari itu adalah hukuman kedua untuk kesalahan yang sama |
| Tier turun | Hanya terpicu kalau masih ada setoran baru. Yang berhenti total tiernya membeku — tier itu rekam jejak, bukan langganan; yang hilang aksesnya, lewat pembekuan |
| Berkas terkurasi | Tak bisa dihapus/diganti penyetornya begitu status keluar dari `menunggu`; superadmin tetap bebas |
| Identitas penyetor | Tak terlihat antar-kontributor. Yang ditampilkan cuma "Sudah disetor" — cukup untuk mencegah kerja ganda |
| Kredit & jenjang | Ikut setoran **disetujui**, BUKAN yang dimuat di edisi. Kerjanya sudah dilakukan; dimuat atau tidak itu keputusan redaksi, bukan ukuran kerjanya |
| Notifikasi | Satu tabel `notifikasi` untuk hasil kurasi DAN kabar fitur — bentuknya sama (pesan pendek, status dibaca, satu lonceng). `untuk=NULL` berarti pengumuman untuk semua, bukan satu baris per orang |
| Isi edisi | Kolom `setoran.dimuat` (default TRUE), terpisah dari status kurasi. Perakitan memangkas lewat `build.py --kecuali=TICKER,…` — bukan membaca DB, supaya jalur rakit tetap tanpa kredensial |
| Isi PDF | Ikut filter superadmin (`dimuat`), terpisah dari kurasi. Menolak setoran yang benar demi memangkas isi edisi bukan lagi satu-satunya cara |
| Kolom & unggahan Chart | **Dibuang** dari tab Unggah (16 Agu). Chart TradingView tak pernah jadi bahan transkripsi — grafiknya sudah kita punya sendiri dari OHLC hasil panen. Berkas chart lama tetap di storage dan ikut terhapus bersama barisnya; yang hilang cuma kolom tabel dan kolom isian |
| Tanggal setoran | Wajib **hari bursa**. Dijaga di tiga lapis: DatePicker cuma menampilkan Senin–Jumat, `hariBursa()` menolak saat submit (tanggal panggung bisa datang dari Kotak Masuk), dan aturannya ditulis sebagai butir pertama panduan. Libur nasional belum tersambung — akhir pekan menutup sebagian besar kasusnya |
| Panduan sebelum setoran pertama | Akun yang belum pernah menyetor melihat modal **"Baca dulu"** saat menekan Tambah Emiten, bukan langsung kolom isian. Sekali per sesi, dengan jalan keluar "Nanti dulu" — form kosong tak memberi tahu apa pun soal layar penuh, baris broker terpotong, atau tanggal bursa, dan kekeliruan itu baru ketahuan setelah diminta revisi |
| Mengubah setoran | Tombol pensil di kolom Aksi. Gambar boleh tidak diganti (yang berubah cuma alasan). Kalau diganti: berkas lama **dihapus dulu, baru** yang baru diunggah — kebijakan storage menolak kontributor menimpa emiten yang sudah punya setoran hari itu, dan ekstensi berkas ikut masuk nama path. Risikonya disebut terus terang di modal |

## Aturan yang berlaku

- **Jangan menerbitkan artefak yang tidak diminta.** "Rakit ulang semua" berarti merakit ulang yang SUDAH ada, bukan menambah jenis terbitan baru. Edisi Mingguan & Bulanan muncul tiba-tiba di Bulletin karena aturan ini belum tertulis (#164). Artefak yang dilihat pembaca — edisi, halaman, pengumuman — hanya lahir dari permintaan eksplisit; kalau menurutmu perlu ada, tawarkan dulu.
- **Paket rilis WA** wajib tiap fitur/halaman publik baru: screenshot desktop + mobile, naskah fungsi & keunggulan. Backend tidak diumumkan.
- **Verifikasi dua viewport** sebelum melapor selesai: laptop 1536×960×1.25, telepon 412×915×2.625.
- **Istilah yang benar: BROKER SUMMARY**, bukan "orderbook". Yang TERLIHAT pengguna sudah bersih (termasuk judul contoh di galeri panduan, diperbaiki di DB 16 Agu). Yang masih memakai istilah lama adalah **kontrak teknis**: nama path storage `{TICKER}-orderbook.ext`, kolom `setoran.jenis`, tabel `contoh_orderbook`, dan fungsi SQL `hitung_orderbook_hari()` — menggantinya berarti memindahkan berkas lama dan menulis ulang kebijakan storage, jadi ditahan sampai ada alasan yang lebih besar (#144). Jangan menambah pemakaian baru di teks yang dibaca pengguna.
- **Mengubah nilai status/enum wajib disertai sapuan pembacanya.** Migrasi #142 mengganti `'ditolak'` → `'dihapus'` tanpa memeriksa siapa yang MEMBACA nilai itu; enam objek SQL tertinggal menyaring nilai yang tak pernah ada lagi, dan akibatnya diam — setoran terhapus tetap memakan kuota, mengunci emitennya, dan akurasi jenjang jadi selalu 100%. Cara memeriksanya satu perintah: `select proname from pg_proc where prosrc like '%<nilai lama>%'` ditambah `pg_policies` untuk `qual`/`with_check`.
- **Nada pesan ke kontributor** berbentuk apresiasi, bukan pemberitahuan penolakan. Setoran yang disetujui tapi tak dimuat di edisi harus terbaca sebagai terima kasih atas kerjanya — pengakuan di depan, keterangan teknis di belakang.
- **Harga apa pun** yang ditampilkan wajib lewat `keFraksi()` — lihat `docs/pedoman-harga-bei.md`. Kecuali rata-rata biaya (cost basis) hasil hitungan, yang memang tak wajib jatuh di tick.
- **Grid pembungkus halaman** wajib `minmax(0, 1fr)`, bukan `auto`. Kolom `auto` melebar mengikuti anak terlebar (tabel ber-min-width), dan karena `.dasbor-main` memotong bukan menggulung, kelebihannya jadi tak terjangkau di ponsel. Ditemukan pada Seasonality 15 Agu 2026.

## Keputusan: kuartal XBRL ditampilkan DISKRET (18 Agu 2026)

Johan, verbatim: *"diskret saja biar bisa dibandingkan antar kuartal"* —
menjawab pilihan antara menampilkan interim IDX apa adanya (kumulatif, sama
seperti terbitan resmi) atau menurunkannya jadi kuartal berdiri sendiri.

Konsekuensi yang mengikat:

- Turunannya `Q1 = TW1`, `Q2 = TW2 − TW1`, `Q3 = TW3 − TW2`,
  `Q4 = Tahunan(audit) − TW3`. Tahunan auditan sudah diarsipkan, jadi yang
  perlu dipanen tiga interim per tahun, bukan empat.
- **Hanya ruas ARUS** (pendapatan, beban, laba, arus kas) yang boleh
  dikurangkan. Ruas NERACA adalah posisi pada satu tanggal; menguranginya
  menghasilkan perubahan neraca yang terbaca sebagai neraca kuartal — salah
  tanpa terlihat salah.
- **Kumulatif aslinya tetap disimpan.** Terbitan resmi IDX kumulatif; kalau
  ada yang mencocokkan angka kita ke laporan resmi, keduanya harus bisa
  ditunjukkan.
- Kuartal yang pengurangnya hilang ditulis `null`, **tidak pernah `0`** —
  nol berarti "labanya nol", dan itu klaim. Keluhan yang memicu keputusan ini
  justru layar yang menampilkan `0` untuk ARCI yang berlaba Rp532 miliar.
- Gerbang verifikasi: jumlah 4 kuartal diskret ≈ tahunan auditan. Melenceng
  >5% pada ruas laba berarti asumsi diskret/kumulatifnya salah — berhenti,
  jangan simpan.

Prasyarat yang belum ada saat keputusan diambil: XBRL di cakram cuma
menyimpan **satu** periode interim per emiten (774 emiten 1 periode, 175
nol termasuk ARCI), karena panen sebelumnya hanya mengambil TW2 2026. Jadi
diskret belum bisa diturunkan sampai TW1/TW2/TW3 dipanen.

## Backlog: rapikan grid Kartu Analisa (tab Lengkap) — 19 Agu 2026

Johan, verbatim: *"grid nya nanti di rapikan lagi ini, seperti prototype saja
jadikan backlog"*. **Sengaja ditunda** — tab Lengkap dan Ringkas sudah benar
isinya, ini murni tata letak.

Yang terlihat di layar 1780px dan perlu dibereskan:

- **"Fundamental Ringkas" turun sendirian ke baris kedua** dan menyisakan
  ±3 kolom kosong di sebelahnya. Enam kartu di grid `auto-fit` 290px membelah
  jadi 5+1 pada lebar itu.
- **Tinggi kartu tidak seragam** dalam satu baris: "Karakter Emiten" berhenti
  jauh lebih pendek daripada "Level · N Sentuhan" di sebelahnya. Preseden
  proyek ini: kartu glosarium pernah ditolak Johan karena hal yang sama
  ("membuat kesalahan yang sama nih, tidak sama tinggi").
- **Isi kartu Aliran Asing membungkus buruk** — label "Porsi dari volume pasar
  (20h)" pecah jadi lima baris karena kolom nilainya memakan lebar.

Acuannya `docs/riset/kartu-analisa.html` Bagian 2 (purwarupa yang disetujui),
bukan menyusun tata letak baru dari nol.

Yang TIDAK boleh berubah saat merapikan: isi, urutan, jumlah observasi,
satuan "lembar" pada aliran asing, dan baris asal-usul tiap kartu. Ini
pekerjaan penempatan, bukan penyuntingan isi.

## Backlog: notifikasi & toast — 19 Agu 2026

Johan, verbatim: *"jadikan backlog juga ini kalau tandai semua error gak bisa
di pake"* dan *"Ubah font jelek ini juga, toastnya juga gak mewah banget, font
nya gak bagus juga, sweep jenis font itu di hapus ganti saja"*.

1. **Tombol "Tandai semua dibaca" error** di panel Kabar (lonceng, layar
   admin). Ditemukan Johan; belum dilacak akarnya. Gejalanya: ditekan, tak
   bisa dipakai. Panel itu memuat 9+ notifikasi setoran disetujui.

2. **Sapuan font.** Red Hat Text/Display/Mono diganti **Plus Jakarta Sans +
   IBM Plex Mono** (dipilih Johan 19 Agu; alasannya Plus Jakarta Sans dirancang
   untuk Bahasa Indonesia dan lebih berkarakter). Yang perlu disentuh:
   `app/public/fonts/` (berkas woff2 + `redhat.css`), preload di
   `app/index.html`, variabel `--mono`/`--disp` di `lantai.css:689-690`, dan 14
   sebutan "Red Hat" di `App.css`, `lantai.css`, `GrafikEmiten.tsx`.
   Sudah diuji: kedua font bisa diunduh dari jsDelivr fontsource (HTTP 200).
   **Fontnya sekarang termuat benar** — self-hosted, bukan CDN, dengan preload.
   Jadi ini soal selera wujud font, bukan kegagalan muat; jangan salah
   diagnosis jadi "font gagal dimuat".

3. **Toast dan panel notifikasi dirombak** bersamaan dengan sapuan font
   (Johan memilih dikerjakan sekalian, bukan ditunda).
