# Ceklist backlog PAPAN

Papan status kerja borongan 16 Agustus 2026. Centang = selesai & terverifikasi
(tsc + uji + dua viewport kalau menyentuh tampilan).

Terakhir diperbarui: **16 Agu 2026, malam**. Seluruh yang tercentang di bawah
**sudah live** (48 commit, `778ec1c2..94958c5a`).

Aturan rilis tetap: `git push` hanya setelah Johan bilang "live", dan yang
menunggu push dihitung dari `origin/main` — bukan dari commit teratas saat sesi
dimulai, yang selalu melebihkan:

```bash
git rev-list --count origin/main..HEAD
```

## 🚦 Urutan kerja — dari paling RINGAN ke paling MAHAL

Disusun 17 Agu 2026 atas permintaan Johan. **Ini urutan eksekusi yang mengikat**;
tabel bertema di bawahnya cuma pengelompokan.

Membacanya: kerjakan dari atas. Tiap baris menyebut apa yang DIBUKANYA, karena
itu yang menentukan urutan — bukan besar-kecilnya saja.

### Ringan (jam-jaman, tak butuh panen data baru)

| ☐ | Urut | Fase | Tugas | Bergantung | Membuka |
|---|---|---|---|---|---|
| ☑ | 1 | **B1** | ~~Sektor IDX-IC resmi~~ — **SELESAI 17 Agu**: `scripts/panen_sektor_idx.py` → 962 emiten, 11 sektor, plus papan pencatatan. Ternyata cukup `GetCompanyProfiles`, BUKAN sheet `1000000` | — | Panen selesai; penyambungan ke layar menyusul |
| ☑ | 2 | **A0** | ~~Satukan `keuangan/` + `fundamental/`~~ — **SELESAI 17 Agu**: `operating_cf` 8,5% → **99,4%**, `eps` 29% → **99,8%**. Sel tertambal ditandai † + asal angkanya | — | `076ec76b`, 278 tes |
| ☐ | 3 | **C6** | Halaman metodologi & glosarium | — | 75 istilah sudah jadi `glosarium.json`, tinggal dipindah ke layar |
| ☐ | 4 | **C7** | Foreign flow 5D/10D | — | Agregasi `ds_*.json`, murni skrip |
| ☐ | 5 | **C8** | Watchlist | — | localStorage, tanpa server |
| ☐ | 6 | **C4** | Heatmap & market breadth | — | Dari data harian yang sudah ada |

### Sedang (sehari-dua, sebagian butuh hitungan baru)

| ☐ | Urut | Fase | Tugas | Bergantung | Membuka |
|---|---|---|---|---|---|
| ☐ | 7 | **A1** | Rata-rata 5 tahun + ambang verdict valuasi | A0 | **Kunci kedalaman AI** — tiap angka jadi punya pembanding (riset ASK SPLE) |
| ☐ | 8 | **B2** | Broker summary harian ke JSON | — | 88 broker/tanggal; sekarang masih di-parse dari PDF |
| ☐ | 9 | **B4** | Pasar NEGO / Bandar Flow | — | Ruas ada di `GetStockSummary`, belum dipanen |
| ☐ | 10 | **#173** | Tabel Akses bertingkat (induk–turunan): `probvv` di dalam `bulletin`, `seasonality-hari` di dalam `seasonality` | — | Kunci anak yang induknya tertutup = setelan yang tak pernah berlaku |
| ☐ | 10b | **#165** | Thumbnail dibuat saat unggah | — | Gambar 420–520 KB berhenti dipakai di kotak 40 px |
| ☐ | 11 | **#171** | Rule engine paham dari satu kata | — | Peta sinonim, tahan salah ketik, kata tunggal ditawari cabang |
| ☐ | 12 | **#172** | Emiten dijawab analisa + chip saran | A1 | Tanya PAPAN berhenti menjawab satu kalimat sama untuk semua pertanyaan |

### Besar (berhari-hari, halaman/mesin baru)

| ☐ | Urut | Fase | Tugas | Bergantung | Membuka |
|---|---|---|---|---|---|
| ☐ | 13 | **C2** | Indikator per emiten — **spek lengkap: `docs/spek-indikator.md`** (4 grup; termasuk SMA/EMA 150-200 yang di sisi SPLE mustahil, plus OBV & VWAP) | — | Prasyarat screener DAN #130. Data OHLCV 5 tahun sudah lengkap |
| ☐ | 14 | **Chart 3** | Chart dasar: lilin + volume + zoom (opsi A, `lightweight-charts`) | C2 | **Rilis yang bisa diumumkan.** Sekarang `/chart` masih widget TradingView |
| ☐ | 15 | **C3** | Screener seluruh emiten | C2 + B1 | 967×147 ruas akhirnya punya layar penyaring |
| ☐ | 16 | **A2** | Bedah Emiten — 12 section, satu commit per section | A0 + A1 | Padanan sple-mf, plus Altman Z & F-Score yang tak mereka punya |
| ☐ | 17 | **#130** | Divergensi tiga lapis (harga + stochastic + volume) | C2 + Chart 3 | Definisi sudah beres dari Johan 17 Agu |
| ☐ | 18 | **A3** | Panen laporan keuangan resmi IDX (XLSX ber-XBRL) | A2 | 777/778 emiten TW2 2026; menutup kedalaman 9 tahun/16 kuartal |
| ☐ | 19 | **B3** | Pemegang saham pengendali | A3 | Menutup celah kepemilikan lewat perusahaan perantara |
| ☐ | 20 | **#166** | Rakit ulang mesin Mingguan & Bulanan | — | Sekarang 21 dari 24 halaman identik dengan edisi harian |
| ☑ | ~~21~~ **NAIK** | **#170** | **Selesai 18 Agu** (K1/K2/K3/K5/K8/K10 + seluruh temuan audit); K4/K6/K7 menunggu keputusan Johan. Penyeragaman kendali — **spek: `docs/spek-kendali.md`** (10 keluhan verbatim). Tahap: audit → komponen kanonis → terapkan per halaman | — | **Diangkat jadi pekerjaan utama 17 Agu** atas perintah Johan; alasan "sengaja terakhir" dibatalkan |

### Menunggu pembahasan, bukan menunggu giliran

| ☐ | # | Tugas | Yang menghalangi |
|---|---|---|---|
| 🅿️ | #167 | Penyetelan lanjutan lapis Gemini | **DIPARKIR** atas keputusan Johan 17 Agu 2026 — "tetap jadikan backlog sampai saya panggil kmu lagi". Jangan diangkat sendiri ke antrean kerja |
| ☐ | #168 | Cara scraping arsip berita yang benar | Perlu dibahas dulu — jangan menembak `news_id` satu per satu |
| 🅿️ | #129 | Chart bandarmologi | **DIPARKIR** atas keputusan Johan 17 Agu 2026, alasan yang sama. Tetap terhalang data juga: broker per emiten tak ada di endpoint publik mana pun |

> 🅿️ = **diparkir**, bukan antre. Bedanya penting: yang antre boleh naik sendiri
> begitu penghalangnya hilang; yang diparkir **hanya boleh diangkat kalau Johan
> memanggilnya**. Menawarkannya berulang kali sama saja mengabaikan keputusan
> yang sudah diambil.

### Kenapa urutannya begini

- **Enam pertama tak bergantung apa pun** — laju terasa sejak hari pertama, dan
  A0 memperbaiki halaman yang sudah dipakai, bukan menambah halaman baru.
- **A1 naik lebih tinggi dari besarnya** karena riset ASK SPLE membuktikan
  kedalaman jawaban datang dari angka yang punya pembanding, bukan dari model.
- **C2 mendahului C3 dan #130** — screener tanpa kolom indikator cuma tabel
  harga, dan divergensi butuh Stochastic yang lahir di C2.
- **#170 sengaja paling akhir.** Menyeragamkan kendali sebelum halaman barunya
  ada berarti menyeragamkan dua kali.

## Antrean berikutnya — **halaman & fitur baru dari riset SPLE**

> Jejak permintaan (**apa yang diminta Johan · sebelum · sesudah**) ada di
> `docs/jejak-permintaan.md` — itu yang menjawab "kenapa baris ini ada",
> yang tak terjawab papan centang mana pun.
>
> Rencana kerjanya **sudah tertulis lengkap** di `docs/workflow-fundamental.md`
> (jalur A/B/C), risetnya di `docs/riset/sple/`. Jangan menyusun ulang — tabel
> di bawah cuma papan centangnya.

**Empat ini dulu — semuanya kecil dan tak bergantung panen apa pun:**

| ☐ | Fase | Tugas | Kenapa duluan |
|---|---|---|---|
| ☐ | **B1** | Sektor IDX-IC resmi (#157) | Dipakai hampir semua halaman lain — screener, bedah, banding sektor |
| ☐ | **A0** | Satukan dua sumber fundamental | Menambal `operating_cf` kosong **80%** di panel Stock Detail yang **sudah ada**. Murni kode, tanpa panen |
| ☐ | **A1** | Rata-rata 5 tahun + ambang verdict valuasi | Verdict kita **dua sumbu**: riwayat emiten sendiri **dan** median sektornya (`pe_vs_sector_pct` sudah ada). Konflik antar-sumbu wajib disebut |
| ☐ | **B2** | Broker summary harian ke JSON (#159) | 88 broker per tanggal; sekarang masih di-parse dari PDF |

**Halaman & fitur BARU:**

| ☐ | Fase | Halaman/fitur baru | Bahan | Syarat |
|---|---|---|---|---|
| ☐ | **C2** | **Indikator per emiten** — RSI, MACD, Bollinger, ATR, Fibonacci, Ichimoku, VWAP, Heikin Ashi | OHLCV 5 tahun; rumus sudah ada di `lib/radar/` | **wajib sebelum C3** |
| ☐ | **C3** | **Screener seluruh emiten — halaman baru** | `fundamental/` 967×147 + `ohlc/` 962 + B1 | butuh C2, kalau tidak cuma jadi tabel harga |
| ☐ | **A2** | **Bedah Emiten — halaman baru, 12 section** (padanan sple-mf) | Tujuh dari sebelas section bahannya sudah ada | A0 + A1 |
| ☐ | **C6** | Halaman metodologi/glosarium di web | 75 istilah sudah jadi `glosarium.json` | — |
| ☐ | **C4** | Heatmap & market breadth | data harian | — |
| ☐ | **C7** | Foreign flow 5D/10D | agregasi `ds_*.json` | — |
| ☐ | **C8** | Watchlist | localStorage | — |
| ☐ | **B4** | Pasar NEGO / Bandar Flow (#152) | ruas ada di `GetStockSummary`, belum dipanen | — |
| ☐ | **A3** | Panen laporan keuangan resmi IDX (#156) | 777/778 emiten TW2 2026, XLSX ber-XBRL | sesudah A2, supaya datanya punya tempat |
| ☐ | **B3** | Pemegang saham pengendali (#158) | laporan resmi IDX | butuh A3 |

**Sisanya:**

| ☐ | # | Tugas | Catatan |
|---|---|---|---|
| ☐ | 172 | **Emiten dijawab analisa + saran pertanyaan** | PENTING. Sekarang `DSSA`, `analisa DSSA`, dan `DSSA diakumulasi broker apa` dijawab kalimat yang sama persis, tautannya selalu Stock Detail. Perlu: jawaban dirakit dari semua sudut, tautan mengikuti aspek yang ditanya, chip saran lanjutan yang diturunkan dari data yang benar-benar ada, dan sambungan kata ganti ("keenam itu") |
| ☐ | 171 | **Rule engine paham dari satu kata** | Peta sinonim terpusat, tahan salah ketik ringan, kata tunggal dijawab ringkas + menawarkan cabang |
| ☐ | 170 | **Penyeragaman kendali** | Tombol kalender, kotak cari, pemilih rentang waktu tak senada: campur `<select>` bawaan, `Dropdown` proyek, `DatePicker`. Menyeragamkan + mencabut duplikat. **Sesudah halaman baru jadi** supaya tak dikerjakan dua kali |
| ☐ | 168 | Cara scraping arsip berita yang benar | Endpoint IPOT mengabaikan `halaman` → mentok ±200 berita/kanal. Menelusuri `news_id` mundur **tidak dilakukan tanpa pembahasan** |
| ☐ | 167 | Lapis Gemini Flash di Tanya PAPAN (C9) | Lapis aturannya sudah jalan. LLM ditunda sampai halaman baru jadi — datanya bertambah, cakupan rule-engine harus lengkap dulu |
| ☐ | 166 | Rakit ulang mesin Mingguan & Bulanan | Mingguan 21 dari 24 halaman identik karakter-per-karakter dengan edisi harian |
| ☐ | 165 | Thumbnail dibuat saat unggah | Gambar penuh 420–520 KB dikecilkan ke 40px di peramban |
| ☐ | 162 | Sebab penolakan MBMA | Bergantung #161 |
| ☐ | 161 | Pesan galat unggah masih generik | Menyebut empat kemungkinan sekaligus, bukan sebab sebenarnya |
| ☐ | 154 | Peringatan konteks + tanggal metodologi di tiap halaman analitik | Yang membuat SPLE dipercaya bukan sinyalnya, tapi panduannya |
| ☐ | 151 | Broker per emiten — sumbernya belum ketemu | `GetBrokerSummary` **mengabaikan** `stockCode`, hasilnya selalu level pasar |

**Menunggu keputusan Johan** (tak bisa dikerjakan tanpa jawabannya):

| ☐ | # | Pertanyaan |
|---|---|---|
| ☑ | 145 | **DILEWATI** (Johan, 17 Agu) — istilahnya tak pernah punya rujukan di kode |
| ☑ | 146 | **DIDEFINISIKAN** (Johan, 17 Agu) — harga + stochastic + volume sebagai pengesah. Spesifikasi lengkap di `rencana-berjalan.md`; #130 tinggal menunggu C2 |

## Selesai — gelombang ketiga (16 Agu, siang–malam)

| ☑ | # | Tugas | Catatan |
|---|---|---|---|
| ☑ | — | **Beranda baru** | Halaman utama bukan lagi dasbor: PAPAN + IHSG lilin YTD, ringkasan pasar, terbit terakhir, kabar 4 kolom, kartu menu |
| ☑ | — | **Ringkasan pasar dari aturan** | Ambangnya **dikalibrasi dari 2.409 hari bursa** (`scripts/kalibrasi_ambang.py`), bukan ditebak. Bukan LLM |
| ☑ | — | **Kabar Pasar** (`/kabar`) | 1.028 kabar, 5 sumber. Tab & daftar bulan **diturunkan dari data**, jadi ikut tumbuh/menyusut sendiri |
| ☑ | — | Arsip IPOT | 737 item, 13 Jul–16 Agu. **Temuan: endpoint mengabaikan `halaman`** — YTD tak terjangkau, sisanya jadi #168 |
| ☑ | — | Arsip Stockbit Snips | 238 item setahun lewat `?format=json` Squarespace |
| ☑ | — | CNBC & detikFinance dicabut | CNBC isinya bukan pasar murni; detik timeout berulang. Item lamanya dibuang dari `kabar.json` |
| ☑ | — | Tautan per pengumuman IDX | `attachments[]` yang `IsAttachment:false` = PDF dokumennya. Sebelumnya semua baris menunjuk satu halaman pencarian |
| ☑ | — | **Tanya PAPAN** | Tombol mengambang + panel. Menjawab data harian, lintas waktu, per emiten, KSEI, grup, kalender + 32 entri pengetahuan + **75 istilah glosarium** yang ditambang dari terbitan PAPAN sendiri |
| ☑ | — | Panen otomatis | GitHub Actions tiap 2 jam untuk sumber tanpa batasan IP |
| ☑ | 160 | **Sisa migrasi `'ditolak'` dituntaskan** | 3 objek SQL diperbaiki + 7 berkas klien. Akurasi berhenti selalu 100%: superadmin kini 96% (22/23) |
| ☑ | 163 | Baris yatim INDY | Dihapus atas persetujuan Johan. **Nol baris yatim, nol berkas yatim**, 24 setoran |
| ☑ | — | Keterangan aturan kurasi di superadmin | Panel lipat: apa yang hilang & apa yang tetap ada, diturunkan dari kode + fungsi SQL yang berjalan |
| ☑ | — | Urutan hapus berkas dibalik | Baris dulu, berkas belakangan + periksa hasilnya. **RLS yang menolak DELETE tidak melempar galat** — itu yang dulu melahirkan baris yatim |
| ☑ | — | Batang gulir 2px jadi aturan bawaan | Dulu disalin per komponen, jadi panel baru kebagian batang tebal sistem. Terukur 15px → 1px |
| ☑ | — | `CLAUDE.md` di-track | Dikeluarkan dari `.gitignore` supaya aturannya terbawa ke tiap worktree baru |

## Selesai

| ☑ | # | Tugas | Catatan |
|---|---|---|---|
| ☑ | 139 | Verifikasi sisi kontributor | Diuji dengan akun Pemula di konteks browser terpisah. Tiga cacat ditemukan & diperbaiki |
| ☑ | 144 | Sweep istilah orderbook → broker summary (lapis teks) | 9 berkas. Lapis data (enum DB, path storage, tabel `contoh_orderbook`) menunggu #142 |
| ☑ | 109b | Peta Investor: mode ekspor "Seluruh dataset" | Sudah bersih — menu tinggal dua mode, tak ada fungsi menganggur |
| ☑ | 143 | Jalur transkripsi kalau produksi pindah ke CI | Diputus sebelumnya: tetap manual (opsi A) |
| ☑ | 108 | Panen harga BUKA harian IHSG | `scripts/panen_ihsg.py`; 8.849 hari OHLCV 1990–2026. Lilin harian berhenti jadi aproksimasi |
| ☑ | 124 | Chart IHSG: pemilih rentang + judul | Chip YTD/1T/5T/10T/Semua; riwayat 36 tahun diunduh hanya saat diminta |
| ☑ | 128 | Cocokkan fraksi harga ke dokumen IDX | Fraksi lima jenjang BENAR. **ARB 15% ternyata usang** — diperbaiki jadi simetris |
| ☑ | 127 | PDF bulletin: daftarkan Red Hat | Font ditanam data URI + render menunggu `document.fonts` |
| ☑ | 122 | Panen OHLC harian 5 tahun seluruh emiten | 962 dari 963 emiten, 37,3 MB. Hanya GOTOM gagal (tak ada di Yahoo) |
| ☑ | 132 | Chart komparasi Seasonality antar-emiten | Garis per emiten, sumbu dikunci 0–100%, bulan tanpa data digambar putus |
| ☑ | 131b | Seasonality tab 2 — bagian emiten | Pemilih sumber IHSG ↔ satu emiten, memakai OHLC hasil #122 |
| ☑ | 99 | Stock Detail: laporan keuangan kuartalan | Panelnya sudah lengkap (kuartal/tahunan × laba rugi/neraca/arus kas); yang kurang cuma cakupan data — panen seluruh emiten dijalankan |
| ☑ | 107 | Dasbor: badge % + klik ke TradingView | Badge persen dipasang di baris kapitalisasi. Klik-ke-chart ternyata sudah ada di seluruh tabel. **"Bar tembus" dipisah jadi #145** |

## Selesai — gelombang kedua (setelah izin migrasi DB dibuka)

| ☑ | # | Tugas | Catatan |
|---|---|---|---|
| ☑ | 142 | Ganti "Tolak" → "Hapus + notice" | Migrasi mengonversi status `ditolak` → `dihapus` (1 baris), constraint diperbarui, dan seluruh UI ikut: tab, label, tombol, modal, hitungan akurasi |
| ☑ | 137 | Notifikasi hasil kurasi | Tabel `notifikasi` + RLS + trigger `kabari_hasil_kurasi`. Pesan berbentuk apresiasi: pengakuan di depan, keterangan teknis di belakang |
| ☑ | 123 | Badge/notifikasi fitur baru | Satu tabel dengan #137 (`jenis='fitur'`, `untuk=NULL` untuk semua). Lonceng + lencana di kepala admin |
| ☑ | 138 | Pilih emiten masuk produksi | Kolom `setoran.dimuat` (default TRUE), tombol "Di edisi / Di luar edisi" per kartu kurasi, dan `build.py --kecuali=TICKER,…` |

## Masih terhalang

| # | Tugas | Penghalang |
|---|---|---|
| 129 | Chart bandarmologi | **Terhalang data**: broker per emiten tak ada di endpoint publik IDX |
| 130 | Divergensi tiga lapis | Butuh definisi analitik dulu — lihat #146 |

## Temuan #139 — tiga cacat, semuanya diperbaiki

1. **Tautan CTA halaman terkunci berwarna biru bawaan peramban.** Akarnya bukan
   di tombolnya: seluruh token tema (`--amber`, `--bg1`, `--line`, `--r`)
   didefinisikan pada `.lantai`, bukan `:root` (alasannya di lantai.css baris
   606), sedangkan kerangka terkunci dirender langsung di `.dasbor-main`. Di
   luar `.lantai` semua variabel kosong. Diperbaiki dengan membungkus kerangka
   itu `.lantai` — satu pembungkus memperbaiki warna, latar kartu, garis, dan
   radius sekaligus.
2. **`.pgh-kartu` dan `.pgh-lambang` ditulis di CSS tapi tak pernah dipakai
   JSX.** Kartu ajakan karena itu tak punya badan: gembok telanjang dan teks
   mengambang di atas blur — persis yang dihindari komentar CSS-nya sendiri.
3. **Radar tak menampilkan jarak setoran**, sedangkan tab Seasonality
   menampilkannya. Logikanya diangkat ke `lib/jarakJenjang.ts` +
   `PenunjukJarak.tsx` supaya satu sumber, lalu dipasang di kedua tempat.

## Temuan #128 — ARB yang sudah kedaluwarsa

`BATAS_ARB = 15` adalah aturan **tahap I** (5 Juni 2023). BEI mengembalikan ARB
**simetris** dengan ARA pada **4 September 2023** (Kep-00055/BEI/03-2023,
Peraturan II-A): 35% / 25% / 20% menurut jenjang harga. Angka 15% membuat
proyeksi ARB kalkulator terlalu dangkal untuk saham di bawah Rp 200 dan terlalu
dalam untuk saham di atas Rp 5.000.

Sekalian: `ProfitAra.tsx` menyalin ulang tabel fraksi dan ARA dengan batas
**eksklusif** (`p < 200`), padahal aturan BEI inklusif — harga tepat Rp 200
masih fraksi Rp 1. Salinan itu dibuang; keduanya kini memanggil
`lib/fraksiHarga.ts`.

## Temuan #127 — kenapa font PDF tak berganti walau CSS-nya benar

Tiga jebakan berturut-turut, semuanya gagal tanpa pesan galat:

1. **Font file:// diblokir.** Chromium membuka `keluaran/*.html` lewat `file://`
   dan memperlakukan tiap berkas sebagai asal berbeda, jadi `url('../../app/...')`
   ditolak diam-diam. Font akhirnya ditanam sebagai data URI — efek sampingnya
   menguntungkan: HTML terbitan jadi berdiri sendiri.
2. **`url()` tanpa tanda kutip menolak base64.** Data URI memuat `=` dan `/`,
   yang tidak sah di `url()` telanjang.
3. **Chromium mencetak sebelum font selesai dimuat.** `page.pdf()` tidak
   menunggu `document.fonts`; halaman yang sama di layar sudah memakai Red Hat,
   tapi PDF-nya keluar dengan Segoe UI. `render_pdf` sekarang menunggu
   `document.fonts.status === 'loaded'`.


## Catatan #137 — trigger belum diuji ujung-ke-ujung

Tabel, RLS, trigger, dan loncengnya sudah terpasang dan lonceng terbukti
merender (kosong, karena memang belum ada kabar). Yang SENGAJA tidak dilakukan:
memicu trigger dengan mengubah status setoran nyata milik kontributor —
itu akan mengirim kabar palsu ke orang sungguhan. Buktinya akan muncul sendiri
pada kurasi berikutnya; kalau tidak muncul, periksa trigger
`setoran_kabari_kurasi` di tabel `setoran`.

## Catatan #138 — kenapa `--kecuali` lewat argumen, bukan baca DB

`build.py` dijalankan lokal saat perakitan dan TIDAK punya kredensial Supabase.
Membaca kolom `dimuat` langsung dari sana berarti menambah kredensial ke jalur
yang selama ini bersih. Sebagai gantinya layar Kurasi punya tombol **"Salin
daftar masuk edisi"** — daftar itu yang dipakai saat transkripsi, dan emiten
yang dikeluarkan dipangkas dengan `--kecuali=TICKER,…` saat merakit.


---

## #175 — Rel navigasi: batasnya 2 ikon lagi, dan luapannya senyap

Dicatat 17 Agu 2026 atas permintaan Johan: *"untuk menu rail untuk sementara
dibiarkan gini dulu kan bisa scrolling ya, jadi dipikirkan kemudian jadikan
backlog"*.

**Koreksi terhadap dasar keputusannya: relnya TIDAK bisa digulung.** Terukur di
1536×960 dari `.dasbor-rail`:

| Yang diukur | Nilai |
|---|---|
| `overflow-y` | `visible` — bukan `auto`, jadi tak ada gulir |
| `scrollHeight` vs `clientHeight` | 960 vs 960 — tak ada yang tersembunyi untuk digulung |
| `.dasbor-rail-list` (15 ikon) | 784px |
| `.dasbor-rail-foot` (status, tema, Admin) | 110px |
| Ruang kosong antara ikon terakhir dan kaki | **96px** |
| Tinggi satu ikon | 44px |

Jadi **muat 2 ikon lagi**, bukan tak terbatas. Ikon ke-18 dan seterusnya akan
meluber ke area kaki tanpa gulir dan tanpa galat — persis kelas cacat yang
berulang di proyek ini: bukan rusak, cuma tak terlihat.

Angka itu juga untuk layar 960px. Jendela yang lebih pendek (bilah bookmark,
laptop 768px) punya ruang lebih sedikit — ambangnya bisa 1 ikon atau nol.

**Empat halaman yang direncanakan** (chart PAPAN, penyaring fundamental,
backtesting, bandarmologi) berarti kelebihan ±2 ikon.

> **Update 17 Agu 2026** — Grafik Emiten (ikon `GRF`) sudah ditambahkan (chart
> PAPAN tahap 3). Terukur ulang di 1536×960 lewat posisi ikon terakhir
> sungguhan (bukan tinggi kotak `.dasbor-rail-list`, yang ternyata kotak flex
> tetap — tidak tumbuh mengikuti isi): sisa ruang sesudah ikon ke-16 **≈52,6px**,
> muat **1 ikon lagi**, bukan 2. Tiga sisa (penyaring fundamental, backtesting,
> bandarmologi) tetap kelebihan ±2 — jalan keluarnya (`overflow-y:auto` atau
> submenu) masih backlog, belum dikerjakan sesi ini.

Dua jalan, keputusan Johan:

1. **Asuransi murah, sekarang**: `overflow-y: auto` pada `.dasbor-rail-list`
   (gutter 2px sudah jadi aturan bawaan `.lantai`, jangan tulis ulang — dan
   **jangan menyetel `scrollbar-width`/`scrollbar-color`**, sejak Chrome 121
   itu membatalkan seluruh aturan `::-webkit-scrollbar`). Satu baris, membeli
   waktu, tak mengubah tampilan selama ikonnya masih muat.
2. **Kelompokkan**: chart PAPAN + penyaring + backtesting satu keluarga —
   "alat analisa lawan data PAPAN sendiri" — satu pintu di rel, tiga tab di
   dalamnya. Rel tumbuh 1, bukan 3.

Yang belum diputuskan juga: `CHT` sudah dipakai widget TradingView, jadi chart
PAPAN belum punya singkatan. Tiga huruf berhenti membedakan di jumlah segini.


---

## Audit 18 item lama — 17 Agu 2026

Johan meminta review dari awal: mana yang sudah selesai. Tiap baris diperiksa
langsung ke kode dan (untuk yang menyangkut skema) ke basis data live, **bukan
ke berkas ceklist ini** — berkas ceklist bukan bukti bahwa kodenya ada.

**Hasil: 12 SELESAI · 5 SEBAGIAN · 1 BELUM · 1 DIPARKIR.**

### Selesai, terbukti

| # | Bukti |
|---|---|
| 108 | `ihsg_harian.json` n=8.849, ruas `buka` 8.849/8.849 terisi, 1990-04-06 → 2026-08-14 |
| 109b | `exportPeta.ts` cuma `exportEmiten()` + `exportInvestor()`; mode "seluruh dataset" tak ada lagi |
| 128 | `fraksiHarga.ts:14` merujuk Kep-00055/BEI/03-2023, ada berkas ujinya |
| 139 | `PenjagaHalaman.tsx` — `children` tak pernah di-mount kalau ditolak (bukan ditutup CSS) |
| 143 | `rencana-berjalan.md:624` keputusan opsi A |
| 137 | Trigger `setoran_kabari_kurasi` → `kabari_hasil_kurasi()`, diperiksa lewat `pg_get_functiondef` |
| 142 | `setoran_status_check` = `menunggu/revisi/disetujui/dihapus` — `ditolak` sudah tak ada |
| 127 | `palet.py:145` `@font-face` data URI + `build.py:801` menunggu `document.fonts.status` |
| 124 | `IndeksDunia.tsx:41` array RENTANG + judul dinamis |
| 132 | `SeasonalityKomparasi.tsx` 101 baris, terpasang di `Seasonality.tsx:271` |
| 138 | Kolom `setoran.dimuat` + tombol "Di edisi" + `build.py:837` benar-benar memfilter |
| 122 | `ohlc/` 963 berkas (962 sukses + `_gagal.json`), 37,3 MB, BBCA 2021-08-09 → 2026-08-14 |
| 131b | `SeasonalityHarian.tsx:57` mendukung satu emiten, bukan cuma IHSG |

### Sebagian — dan apa persisnya yang tersisa

| # | Sudah | Belum |
|---|---|---|
| 144 | Lapis TEKS: label "Broker Summary" di UI, entri glosarium menjelaskan istilah keliru | Lapis DATA masih `orderbook`: constraint `setoran_jenis_check`, tipe `JenisSetoran`, tabel `contoh_orderbook`, pola path storage `{TICKER}-orderbook.ext` |
| 99 | Panel lengkap: kuartal/tahunan × laba rugi/neraca/arus kas | Cakupan data 646/959. Kodenya sendiri mengakui di `stockDetailData.ts:348` |
| 123 | Skema siap: `umumkanFitur()`, RLS `untuk IS NULL`, lonceng merender generik | `umumkanFitur(` **tak dipanggil di mana pun** — tak ada pemicu, tabel `notifikasi` 0 baris |
| 107 | Badge % (`TopStocks.tsx:218`), klik ke chart (`:141`) | "Bar tembus" tak ada — tapi memang sudah dipisah jadi #145, bukan utang #107 |
| — | — | Skrip panen XBRL resmi IDX **belum ada**. `sumber-fundamental-idx.md:231` menyebut `scripts/panen_lapkeu_idx.py` sebagai rencana; berkasnya tidak ada |

### Belum & diparkir

- **#130** divergensi tiga lapis — **tak ada jejak sama sekali** di `app/src`
  (grep `divergensi`/`stochastic` kosong; satu-satunya kecocokan "divergensi
  asing" itu konsep lain). `docs/spek-indikator.md` baru spek. Butuh indikator
  (termasuk Stochastic) lebih dulu.
- **#129** bandarmologi — diparkir atas keputusan Johan. Penghalangnya tetap
  sama: `GetBrokerSummary` mengabaikan `stockCode`, hasilnya selalu level pasar.

### Temuan yang mengubah rencana

Panen ulang `fetch_keuangan.py` untuk 313 emiten yang kurang **mengembalikan
"kosong" untuk semuanya** — bukan "gagal (rate limit)", melainkan yfinance
memang tak punya laporan keuangan untuk emiten-emiten itu. Artinya celah
646→959 **tidak bisa ditutup lewat yfinance sama sekali**, dan XBRL resmi IDX
bukan sekadar sumber yang lebih baik — ia satu-satunya jalan untuk 313 emiten
itu.
