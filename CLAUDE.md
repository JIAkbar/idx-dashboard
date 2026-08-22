Bertindaklah sebagai Analis Pasar Keuangan Senior dan Pakar Ekuitas (Saham) dengan pengalaman lebih dari 10 tahun di bursa saham global dan domestik.

Tujuan: Memberikan analisis pasar, evaluasi saham, wawasan ekonomi makro, dan proyeksi tren yang objektif, akurat, serta berbasis data.

Panduan Analisis:

Pendekatan Holistik: Selalu pertimbangkan tiga pilar utama dalam setiap analisis:

Fundamental: Laporan keuangan, valuasi (PER, PBV, EPS), model bisnis, dan keunggulan kompetitif.

Teknikal: Tren harga, volume transaksi, momentum, serta level kunci (Support, Resistance, Moving Average).

Sentimen & Makroekonomi: Dampak suku bunga, inflasi, kebijakan bank sentral, geopolitik, dan berita sektoral terkini.

Struktur Penyajian: Sajikan informasi secara sistematis agar mudah dipahami. Gunakan heading, poin-poin (bullet points), dan buatkan tabel ringkasan metrik keuangan jika Anda menganalisis saham spesifik.

Objektivitas & Rasionalitas: Hindari bias emosional atau spekulasi tak berdasar. Selalu paparkan dua sisi koin: potensi pertumbuhan (katalis positif) dan potensi penurunan (risiko/katalis negatif).

Gaya Bahasa: Profesional, lugas, ringkas, namun tetap dapat dipahami oleh investor ritel yang serius.

Manajemen Risiko: Selalu ingatkan tentang pentingnya manajemen risiko dan diversifikasi portofolio.

Disclaimer Keuangan: Sertakan disclaimer singkat di akhir setiap analisis bahwa informasi ini bersifat edukatif/informasional dan bukan merupakan rekomendasi atau saran investasi mutlak (Not Financial Advice).

Format Output Standar:

Ringkasan Eksekutif (Kesimpulan singkat)

Tinjauan Makro/Sektoral (Kondisi pasar secara umum)

Analisis Spesifik (Fundamental & Teknikal aset yang ditanyakan)

Katalis & Risiko (Pro dan Kontra)

Kesimpulan Analis (Pandangan akhir yang merangkum data)

Jika Anda mengerti dan siap menerima peran ini, balas dengan: "Saya siap bertindak sebagai Analis Pasar Keuangan Anda. Saham, sektor, atau kondisi makroekonomi apa yang ingin kita bedah hari ini?"
<!-- ai-kemampuan-pointer -->
## Basis Pengetahuan
Baca dulu (efisiensi + navigasi): `C:\1-Johan\10. Pengembangan\AI Skill\03 - AI Kemampuan (Basis Pengetahuan)\hemat.md` lalu `kemampuan-index.md`.
<!-- /ai-kemampuan-pointer -->

---

## PAPAN — aturan kerja teknis

Catatan hidup ada di `docs/rencana-berjalan.md` (progres, antrean, keputusan
yang sudah diambil). **Baca itu dulu sebelum menyentuh apa pun** — di sana ada
tabel keputusan yang mencegah perdebatan ulang.

### Sumber data — jangan tertukar perannya
| Sumber | Untuk apa | Jebakannya |
|---|---|---|
| **IDX** `GetStockSummary` | Hari berjalan **dan riwayat per tanggal sejak awal 2020**. 32 ruas: volume, frekuensi, asing | `OpenPrice` praktis kosong sebelum 2025 (5-8%), hari ini pun 74%. Nol di ruas itu ≠ tak diperdagangkan |
| **Yahoo Finance** | Riwayat sebelum 2020 + **harga BUKA riwayat** | `range=max` diam-diam menurunkan resolusi jadi BULANAN walau `interval=1d`. **WAJIB** `period1`/`period2` — sudah dua kali menjebak |

Data broker per emiten tidak ada di `GetStockSummary`. `ForeignBuy`/
`ForeignSell` itu aliran asing, bukan identitas broker.

**Sudah diuji 16 Agu 2026 dari IP rumahan** (`docs/sumber-fundamental-idx.md`):
seluruh endpoint IDX menjawab 200 di sini, padahal dasbor lain kena `IDX API
403` lewat Netlify — blokirnya per-IP, bukan per-endpoint. `GetBrokerSummary`
bekerja tapi **mengabaikan `stockCode`**, jadi hasilnya selalu level pasar.
Broker **per emiten** tetap belum ketemu di endpoint publik mana pun.

Sekalian ketemu yang lebih besar: **laporan keuangan resmi XLSX ber-XBRL per
emiten per kuartal** lewat `GetFinancialReport` — 777 dari 778 emiten TW2 2026,
berisi sektor IDX-IC resmi dan pemegang saham pengendali. Runbook lengkapnya di
`docs/sumber-fundamental-idx.md`, rencana pakainya di
`docs/workflow-fundamental.md`.

### Yang berulang kali jadi sumber bug
- **Grid pembungkus halaman wajib `minmax(0, 1fr)`**, bukan `auto`. Kolom `auto` melebar mengikuti anak terlebar; `.dasbor-main` memotong (bukan menggulung), jadi kelebihannya tak terjangkau di ponsel.
- **`display:flex` jangan dipasang ke `<td>`** — sel berhenti berperilaku sebagai sel tabel, tingginya menyusut, garis bawahnya jadi tak sejajar. Bungkus isinya.
- **Tanggal setoran wajib lewat `lib/tanggalBursa.ts`** — jangan tulis ulang `new Date()`. Fungsi itu pernah disalin di 4 berkas dan keempatnya salah bersamaan.
- **Mengganti NILAI status/enum wajib disertai sapuan pembacanya.** Migrasi #142 mengganti `'ditolak'` → `'dihapus'` tanpa memeriksa siapa yang membaca nilai itu; enam objek SQL tertinggal menyaring nilai yang tak pernah ada lagi dan semuanya gagal senyap (kuota termakan, emiten terkunci, akurasi selalu 100%). Sapuannya: `select proname from pg_proc where prosrc like '%nilai%'` + `pg_policies` (`qual` DAN `with_check`) + grep kode termasuk berkas uji.
- **Harga yang ditampilkan wajib lewat `keFraksi()`** (`lib/fraksiHarga.ts`). Kecuali rata-rata biaya hasil hitungan, yang memang tak wajib jatuh di tick.
- **Batang gulir sudah punya aturan bawaan — jangan tulis ulang per komponen.** `.lantai ::-webkit-scrollbar` sudah menetapkan gutter tipis **2px** untuk semua yang menggulung di dalamnya (`lantai.css`). Dulu tiap panel menyalin bloknya sendiri dan yang lupa menyalin kebagian batang tebal bawaan sistem (panel Tanya PAPAN, 16 Agu). **Jangan menyetel `scrollbar-width`/`scrollbar-color`**: sejak Chrome 121, menyetel salah satunya membuat SELURUH aturan `::-webkit-scrollbar` diabaikan dan yang menang "thin" 11px.
- **Hapus baris DULU, berkas belakangan — dan periksa hasilnya.** `hapusScreenshot()` versi pertama menghapus berkas lebih dulu lalu menelan galat hapus baris; RLS menolak baris yang sudah dikurasi, berkasnya telanjur hilang, tersisa kartu bergambar rusak selamanya tanpa satu pun galat (bukti: `2026-08-14/INDY-orderbook.jpg`). Ingat juga **RLS yang menolak DELETE tidak melempar galat** — ia menyaring baris dan hasilnya "sukses" tanpa ada yang terhapus, jadi keberhasilannya wajib diperiksa ulang, bukan dipercaya.
- **Selagi ada agen berjalan, sebut berkasnya di `git commit`, BUKAN cuma di `git add`.** Aturan lama ("jangan `git add -A`, sebut satu per satu") terbukti **tidak cukup** pada 18 Agu: `git add` saya menyebut tiga berkas, lalu agen lain men-*stage* miliknya, dan `git commit` mengambil **seluruh index** — 13 berkas halaman Kartu Analisa terbawa ke commit berjudul "buang Playwright mati dari update.yml". Isinya utuh, pesannya berbohong. Bentuk yang benar mengunci berkasnya di saat commit:
  ```bash
  git commit -- path/satu path/dua        # hanya path ini, apa pun isi index
  ```
  `git add -A <direktori>` tetap terlarang. Dan jangan meng-`amend` untuk membetulkannya — menimpa riwayat lebih mahal daripada satu commit berjudul salah yang dicatat jujur. Terjadi 16 Agu: pekerjaan tab Bedah tersapu ke dalam commit berjudul "tanya-papan" dan ikut terdorong ke produksi dengan pesan yang salah. Isinya utuh, pesannya berbohong — dan riwayat yang berbohong lebih mahal daripada beberapa detik yang dihemat.
- **Jangan membuang berkas mentah hasil panen — yang mahal MENGAMBILNYA, bukan menyimpannya.** Versi pertama `panen_keuangan_idx.py` memeras XLSX jadi 15 ruas lalu membuang berkasnya. Begitu muncul kebutuhan ruas lain (sheet neraca saja 238 baris), satu-satunya jalan adalah mengunduh ulang 900-an emiten — padahal endpointnya sering menolak 403 dan panen penuh makan berjam-jam. Johan 17 Agu 2026: *"jangan asal maen buang data yang sudah di panen, gini ini jadi masalah kan harus unduh lagi, simpan backup saja sewaktu perlu kita gunakan gini"*. Mentahnya sekarang diarsipkan ke `_arsip-mentah/` (di luar git lewat `.gitignore`, tetap ada di cakram), dan pemanen membaca dari sana lebih dulu — menambah ruas jadi tak berbiaya jaringan sama sekali. Berlaku untuk SEMUA pemanen, bukan cuma yang ini.
- **Dua sumber dengan kunci periode SAMA belum tentu menghitung rentang yang sama.** `keuangan/` (yfinance) berisi kuartal DISKRET, `keuangan_idx/` (XBRL IDX) berisi interim KUMULATIF — keduanya berkunci `2026-06-30`. Terukur: revenue TLKM 1,96×, ASII 1,99×, ICBP 2,08×. Menggabungkan per-ruas dengan aturan "yang tidak null menang" memberi angka hampir dua kali lipat tanpa satu pun galat. Neraca aman (posisi pada satu tanggal); yang berbahaya ruas ARUS — revenue, laba, dan arus kas. `fundamentalGabungan.ts` belum menyambung keduanya; jangan disambung sebelum bentuknya diputuskan (`docs/sumber-fundamental-idx.md`).
- **Sumber kebenaran ada di BASIS DATA, bukan di cakram — periksa Supabase dulu, selalu.** 19 Agu: ditanya edisi harian 18 Agustus, saya memeriksa `arus-pasar/masuk/` dan `arus-pasar/edisi/`, tak menemukan apa-apa, lalu melapor "tak ada setoran" dan menjelaskan panjang lebar apa yang perlu Johan siapkan. Satu agen ikut menyimpulkan hal yang sama. Kenyataannya **10 setoran sudah disetujui dan terunggah** — lengkap dengan katalis tulisan kontributor. Johan: *"waaaah kmu jadi bnyk salah ini kan konsep nya sistem ini ada di database datanya"*. Folder `masuk/` cuma singgahan hasil unduhan URL bertanda tangan yang kedaluwarsa 1 jam; kosongnya berarti "belum ditarik", **bukan** "tak ada". Sapuan yang benar: `select ... from setoran where tanggal = ...` lewat Supabase MCP (project `ogwjbkezpcifdqydvmia`), bukan `ls`. Berlaku untuk seluruh alur kontributor — setoran, kurasi, jenjang, akses halaman. Tabel `edisi` ada tapi kosong; edisi sendiri masih berupa berkas, dan campuran itulah yang membuat kesalahan ini gampang terulang.
- **`Volume` IDX itu pasar REGULER saja — pasangannya `NonRegularVolume`, dan selama ini kita cuma memakai satu.** `GetStockSummary` melaporkan dua pasar di baris yang sama: `Volume`/`Value`/`Frequency` (reguler) dan `NonRegularVolume`/`NonRegularValue`/`NonRegularFrequency` (negosiasi + tunai). Seluruh berkas turunan kita — `ohlc/`, `asing/` — menyimpan yang reguler saja. Itu **benar** untuk analisis teknikal (harga negosiasi bisa jauh di luar pasar; GOTO 20 Agu 2026 menyilangkan 41,4 miliar lembar di harga rata-rata Rp 21,9 sementara fraksinya sendiri Rp 50), tapi menjadikannya **salah** untuk apa pun yang mengaku "volume pasar": agregat kita 34,95 miliar lembar sementara statistik resmi IDX menyebut 77,09 miliar, dan **seluruh** selisihnya non-reguler. Gejalanya menipu — frekuensi tetap cocok 99,9% tiap hari (negosiasi = sedikit transaksi, volume raksasa), jadi berkasnya terlihat lengkap. Sebelum membandingkan angka apa pun ke statistik harian IDX, pastikan dulu kedua pasar ikut dijumlah (`scripts/bangun_aliran_investor.py`).
- **Galat taksiran yang MIRING tak bisa dinilai dari satu hari.** Taksiran rupiah aliran asing (lembar × harga rata-rata) meleset 8,4% pada 20 Agu 2026 — angka yang terdengar bisa diterima, dan sempat tercetak di layar sebagai klaim umum. Diukur atas 138 hari: arah cocok 91%, median harian 0,94×, **tapi kumulatifnya 1,33×**. Galatnya searah, jadi ia menumpuk alih-alih saling meniadakan, dan periode setahun jadi meleset sepertiga. Aturannya: taksiran yang akan dijumlahkan wajib diuji pada JUMLAHNYA, bukan pada satu titik; dan kalau ada angka resmi untuk totalnya (`nf_today_idr`), pakai itu untuk total dan sisakan taksiran hanya untuk bagian yang memang tak pernah dilaporkan.
- **Kunci dedup jangan cuma tautan.** Pengumuman resmi IDX tanpa lampiran semuanya menunjuk ke satu URL generik (halaman keterbukaan informasi), jadi dedup ber-tautan meringkas belasan pengumuman berbeda jadi SATU baris — tanpa galat, cuma daftar yang menyusut diam-diam dan dari layar terbaca sebagai "beritanya tidak ada". Pakai tautan + judul + waktu (`gabungKabar()` di `lib/dasbor/kabar.ts`, sudah ada tesnya).
- **Menambah CSS/JS ke `template.html` WAJIB di dalam blok yang benar — jangan menempel di ujung berkas.** 18 Agu 2026 dua aturan CSS mendarat SESUDAH `</html>` (baris 510+, sementara `</style>` di baris 414). Peramban memperlakukan teks liar sesudah `</html>` sebagai isi body, jadi kerusakannya ganda dan keduanya senyap: aturannya **tak pernah berlaku** (lencana jenjang tak bergaya, narasi tak rata kiri-kanan) DAN teks CSS-nya **tercetak sebagai paragraf** di halaman terakhir tiap edisi — menambah satu halaman penuh. Build sukses, PDF jadi, nol galat; ketahuan hanya karena Johan membacanya. Sesudah menyunting template, periksa `template.html` berakhir tepat di `</html>` dan pindai PDF hasilnya: `PdfReader(f).pages[-1].extract_text()` tak boleh memuat `{`, `var(--`, atau `px;`.
- **Kendali baru WAJIB pakai komponen kanonis #170, jangan bikin kelas sendiri.** `LangkahTanggal` (panah langkah), `TombolIkon` (tombol ikon kecil), `PemilihRentang` (pil rentang waktu), `TombolLayarPenuh`, `Dropdown`, `DatePicker`; kelas `.af-cari`, `.chip-t`, `.bilah-rentang`, `.ti-grup`, `.th-sort`, `.dd-btn`, `.inp`. Sebelum #170, satu jenis kendali punya sembilan bentuk dan tombol ikon punya sembilan ukuran — semuanya lahir dari "sekali ini saja bikin kelas sendiri". Kelas ber-awalan halaman (`.sea-*`, `.blt-*`, `.pi-*`, `.aa-*`) hanya boleh menyimpan **penempatan dan lebar**, tak pernah bentuk. Yang khas satu halaman ditulis sebagai penimpa, bukan sebagai definisi baru — dan kalau ternyata dipakai halaman kedua, namanya diganti jadi umum saat itu juga.
- **Target sentuh panah/langkah 44px; tombol ikon boleh 32px visual asal area kliknya 44px.** Area klik dilebarkan lewat `::after{inset:-6px}` — dan karena itu, **dua tombol ikon bersebelahan wajib berjarak ≥12px** (`.ti-grup`). Tanpa jarak, area kliknya saling tindih dan klik di celah jatuh ke tombol yang menang tumpukan; di pasangan ubah/hapus, yang satu itu menghapus.
- **Aturan mobile yang menimpa aturan dasar harus disamakan panjang selectornya.** `.lantai .bilah-rentang .dpk-wrap` di media query kalah dari aturan dasar bernama sama yang letaknya lebih bawah di `lantai.css` — hasilnya kedua pemilih tanggal menyusut sampai lebar nol, terlihat sebagai bilah kosong. Media query TIDAK menambah spesifisitas; yang menentukan tetap urutan berkas.
- **Kata rentang waktu cuma dieja di `LABEL_RENTANG` (`lib/dasbor/periode.ts`).** Sebelum #170 ada tiga ejaan untuk hal yang sama ("1 Tahun" · "1T" · "1 thn") karena tiap halaman mengeja sendiri. Menambah pilihan = menambah kunci di sana, bukan menulis label di halaman.

- **Pemanen berhenti kalau halaman KEMBAR PERSIS, bukan kalau "tak ada item baru".** Endpoint IPOT mengabaikan parameter `halaman` (halaman 0/1/5/50 membalas 200 `news_id` yang sama), dan panen ulang yang wajar juga menghasilkan nol item baru — syarat itu tak bisa membedakan "arsipnya habis" dari "sumbernya jalan di tempat". Tanpa pemeriksaan sidik halaman, skripnya menembak 1.000 permintaan selama 20 menit untuk nol hasil.
- **Ruas yang kelihatannya kita hitung sering cuma SALINAN dari sumber — periksa siapa yang mengisinya sebelum menyimpulkan "sumbernya tak punya data".** `eps`/`pe`/`der`/`roe`/`dividend_yield` di `fundamental/*.json` terbaca seperti rasio hasil olahan, padahal semuanya `sg(info,"trailingEps")` dkk. langsung dari yfinance. Akibatnya `eps` kosong di 154 emiten yang `ttm_net_income` dan `shares`-nya ADA di berkas yang sama — lubangnya "tak pernah dihitung", bukan "tak ada datanya", dan selama diagnosisnya salah pekerjaannya jadi panen ulang (mahal, bisa kena blokir) alih-alih satu pembagian (gratis). Sapuannya: untuk tiap ruas kosong, cek dulu apakah pembilang & penyebutnya terisi. Sudah ditutup `scripts/lengkapi_fundamental.py` (lihat `docs/workflow-fundamental.md` A0b) — dan **skrip penambal wajib jalan SESUDAH pemanennya di CI**, karena pemanen menulis ulang berkas dari nol dan menghapus tambalan sebelumnya.
- **Jumlah saham diambil dari BURSA, bukan dari agregator — dan `market_cap ÷ harga` bukan wasitnya.** `sharesOutstanding` yfinance ketinggalan aksi korporasi di 51 emiten (BBNI tersimpan 578,7 juta, resmi 36,92 MILIAR; MSKY justru 5× KEBESARAN karena reverse split), dan SETIAP ruas per-saham membaginya — `q_eps`, `hist_eps`, `hist_bv`, `rev_ps`, `cash_ps`, `fcf_ps`, `ps` — semuanya meleset dengan faktor yang sama tanpa satu pun galat. Sumbernya `ListedShares` di `GetStockSummary`, sudah ikut di payload yang `sinkron_emiten.py` ambil tiap hari (disimpan sebagai `saham` di `daftar_emiten.json`; pembacanya `saham_idx()` di `fetch_fundamental.py`). Yang **tidak** boleh jadi sumber: `market_cap ÷ last_price` — `marketCap` Yahoo dihitung dari `sharesOutstanding` Yahoo juga, jadi ikut basi di emiten yang sama (AISA, LPPF, ZBRA, MSKY). Ia detektor, bukan kebenaran.
- **Membetulkan ruas HULU wajib disertai sapuan regresi atas SELURUH berkas, bukan cuma yang diperiksa tangan.** Memperbaiki `shares` membuat `float_pct` BBNI terbaca 0,61% (dulu 38,84%) dan `market_cap` AISA tinggal 41% — dua regresi yang lahir dari perbaikannya sendiri dan tak terlihat sama sekali dari emiten yang sedang dilihat. Sapuannya: untuk tiap ruas yang membagi/mengalikan ruas yang diubah, hitung batas masuk akalnya di 965 berkas dan hitung berapa yang melanggar — sebelum DAN sesudah.
- **Skala rasio wajib diperiksa ke sumbernya, jangan dicocokkan dari nama.** `der` itu PERSEN (`debtToEquity` yfinance), `der_q` RASIO — terukur `der/der_q` median 99,4× di 514 emiten. `roe` rasio (0,218), `dividend_yield` persen (5,61). Menurunkan salah satu dari yang lain tanpa mengukur rasionya lebih dulu memberi angka 100× meleset tanpa satu pun galat.
- **Larik dengan satu nama ruas bisa berisi DUA peringkat yang digabung tanpa penanda — periksa dulu apakah baris tengahnya melompat skala.** `top_saham.value`/`.volume` dan `top_broker.value`/`.volume` di `ms_*.json` (statistik bulanan IDX) masing-masing 30 baris yang kelihatan satu peringkat, padahal baris 0-14 dan 15-29 itu DUA peringkat berbeda (`value` = Nilai bulan lalu Nilai YTD, `volume` = Volume lalu **Frekuensi** — bukan volume YTD). Terukur: bagi `bulan_ini` tiap baris dengan `persen_total`-nya, baris 0-14 balik jadi total bulanan di `ringkasan_pasar`, baris 15-29 balik jadi total lain (YTD atau frekuensi). Merender larik ini apa adanya memajang React "duplicate key" (kode saham/broker yang sama muncul di kedua babak) DAN dua skala angka tercampur di bawah satu judul tabel — gagal senyap sampai ada yang membaca angkanya dekat-dekat. `belahDua()` di `app/src/lib/dasbor/statistikBerkala.ts` memisahkannya untuk layar; berkas mentahnya sendiri TETAP tergabung, jadi penambal lain yang menyentuh `ms_*.json` wajib sadar ini sebelum menganggap `value`/`volume` itu satu peringkat rata.
- **Penambal yang MENIMPA sumbernya sendiri tidak bisa dibatalkan — berjangkarlah pada mentahnya, selalu.** `perbaiki_skala_keuangan.py` menebak pembagi dari periode tetangga lalu menulis hasilnya ke berkas yang jadi bahan tebakan jalan berikutnya. Begitu ZBRA 2019 telanjur dinaikkan 1000×, jalan berikutnya berjangkar pada angka yang sudah rusak: membetulkannya tangan pun percuma, dan cacatnya jadi permanen tanpa satu pun galat. Dua akibat yang berbeda dan dua-duanya mahal — tebakannya bisa salah, DAN kesalahannya tak bisa dicabut. Bentuk yang benar: nilai acuan dihitung ulang dari arsip mentah tiap kali (`dasar_arsip.py`, nol jaringan, hasilnya disinggahkan), keluarannya `dasar × pengali`, dan pengali 1 (tak dikoreksi) jadi bawaannya. Penambal jadi idempoten dan jalan yang salah bisa dibatalkan jalan berikutnya. Berlaku untuk SEMUA penambal, bukan cuma yang ini.
- **"Tak ada yang menyanggah" bukan "sepakat", dan jangkar yang berbeda sifat tak boleh bersuara sama rata.** `len(set(suara)) == 1` lolos walau `suara` cuma berisi SATU elemen — satu jangkar menuduh, satu diam, dan kodenya membaca itu sebagai kesepakatan. Tapi memaksa semua jangkar ikut bersuara juga salah: `equity` berayun jauh lebih liar daripada `total_assets` (dividen, restatement, melintasi nol), jadi mewajibkannya menuduh membuang koreksi yang benar (LPPF/PKPK/PURE). Yang benar: satu jangkar MEMUTUSKAN, yang lain MENYANGGAH — dan pilih perannya dari sifat ruasnya, terukur, bukan dari kelihatannya setara.
- **Sebelum melarang satu arah koreksi, ukur dulu apakah arah itu nyata.** Tambalan skala sempat melarang koreksi ke ATAS dengan alasan yang terdengar kokoh ("label satuan yang basi selalu kebesaran"), dan swauji lama bahkan menyebut satu contoh arah naik yang "nyata" (ALMI 2019) — yang ternyata pergantian mata uang IDR→USD, nilainya sama persis dengan arsipnya. Sapuan 6.574 periode menjatuhkan larangan itu dalam satu langkah: IMJS 2024 dan TINS 2025-TW1 dua-duanya menyatakan "Satuan penuh" padahal isinya JUTAAN (IMJS `total_assets` tercatat 29.410.622 untuk perusahaan beraset Rp 29,4 T). Larangannya akan mengembalikan keduanya ke angka mustahil. Yang benar bukan melarang, tapi menaikkan ambang bukti untuk arah yang lebih jarang.

- **Edisi Arus Pasar tinggal di BERKAS, bukan di Supabase — jangan bangun jalur kedua lagi.** Repo sempat punya dua sistem untuk hal yang sama: perakitan `arus-pasar/build*.py` → `keluaran/*.pdf` + `keluaran/index.json` (dibaca `/bulletin` & Rak Terbitan) DAN tabel Supabase `edisi`. Yang kedua tak pernah diisi — 0 baris seumur hidupnya, nol penulis, dan satu-satunya pembacanya (`/admin/edisi/:kode`) karena itu selalu menjawab "tidak ditemukan" tanpa seorang pun sadar. Yang mahal bukan tabel nganggurnya, tapi **batas kepemilikan yang tak pernah ditulis**: 20 Agu satu agen menjalankan `git checkout -- arus-pasar/keluaran/` dan menghapus keluaran agen lain karena tak jelas siapa pemilik apa. Tabelnya sudah DROP (A3, Papan Pekerjaan #221) berikut policy `ALL to authenticated using(true) with check(true)` yang diam-diam memberi hak tulis & hapus ke setiap akun login. Sekarang: manifest HANYA lahir dari `generate_index.py` (yang menghormati `edisi/_tahan.json`), pembacanya `lib/dasbor/bulletin.ts`, dan `lib/supabaseSetoran.ts` (dulu `supabaseEdisi.ts`) mengurus setoran + bucket screenshots saja. Menambah fungsi edisi ke Supabase = menghidupkan lagi ambiguitas yang baru dibayar.

### Halaman baru WAJIB terdaftar di DUA tempat — kode DAN basis data

Johan 21 Agu 2026: *"whatchlist nya kok belum update di halaman ini ya?"* ·
*"jadi aturan wajib deh, semua page baru wajib di masukkan di akses"*.

Tiap halaman baru butuh dua baris, dan satu saja tak pernah cukup:

1. `PETA_MENU_KUNCI` di `app/src/lib/aksesHalaman.ts` — rute → kunci
2. Baris di tabel Supabase `akses_halaman` — kunci, label, tingkat, urutan

**Kalau cuma nomor 1**, kuncinya tak dikenal server dan `bolehBukaKunci`
**fail-open**: halamannya terbuka untuk siapa saja DAN tak muncul di tab
Akses. Dari panel ia seolah tidak ada, jadi tak seorang pun bisa menguncinya.
Itu persis yang terjadi pada **Kartu Analisa, Statistik Berkala, Watchlist,
dan Bedah Emiten** — empat halaman hidup berminggu-minggu sebagai halaman
yang tak bisa diatur, tanpa satu pun galat yang menyebutnya. Ditutup 21 Agu
(migrasi `akses_halaman_empat_halaman_yang_tertinggal`).

**Kalau cuma nomor 2**, barisnya tak pernah terpakai — tak ada rute yang
menunjuk kunci itu.

Fail-open sendiri TETAP dipertahankan dan itu disengaja: halaman yang lupa
didaftarkan lebih baik terbuka daripada mengunci pembaca dari sesuatu yang
seharusnya publik. Ia jaring pengaman, **bukan izin melewatkan pendaftaran**.

Tingkat awalnya samakan dengan perilaku yang SEDANG berjalan (halaman yang
hari ini terbuka didaftarkan sebagai `publik`), lalu biarkan Johan yang
mengubahnya dari tab Akses. Mendaftarkannya langsung sebagai `login` berarti
mengunci halaman yang tadinya terbuka — perubahan perilaku yang tak diminta.

### Papan Pekerjaan — WAJIB tiap balasan

Konvensi lintas proyek `kemampuan-workflow.md` §174 mewajibkan **Papan
Pekerjaan** untuk tiap perintah, sekecil apa pun. Johan menegaskan 17 Agu
2026: *"saat ini dan seterusnya gunakan selalu Papan Pekerjaan (bukan papan
progress)"*.

**Sebutannya tetap "Papan Pekerjaan"** walau produknya juga bernama PAPAN —
usulan mengganti nama jadi "Lembar Kerja" ditolak Johan. Yang membedakan
cukup huruf besarnya dan konteks kalimatnya.

Bedanya dengan papan progress, dan ini inti §174: papan progress melapor apa
yang SUDAH jalan; Papan Pekerjaan mencatat **perintahnya, sebelum-sesudahnya,
alasannya, dan buktinya** — sehingga bisa dipakai MENOLAK perubahan sebelum
dikerjakan, bukan cuma membaca laporan setelahnya.

Rumahnya: **`docs/jejak-permintaan.md`**.

Sepuluh kolom bakunya (§174 — jangan ditambah, jangan dikurangi):

`# · Tugas · Asal perintah · Halaman · Komponen (file:baris) · Sebelumnya ·
Jadi · Alasan · Status & bukti · Changelog`

Yang paling sering dilanggar dan paling mahal:

- **Asal perintah dikutip VERBATIM**, bukan diparafrase. Kolom ini sumber
  kebenaran kalau nanti ada beda tafsir soal lingkup.
- **Nomor tugas tak pernah berdiri sendiri.** Menyebut "#172" di ringkasan
  wajib disertai nama tugas dan kutipan perintahnya — memaksa pembaca
  menggulir balik berarti memindahkan beban ingat ke orang yang tak sedang
  memegang konteksnya.
- **"Selesai" tanpa bukti di kolom Status tidak dihitung selesai.** Hash
  commit, `tsc bersih`, hasil uji, atau tangkapan layar.
- **Ambang penyajian**: 1–4 baris boleh langsung di obrolan; 5+ baris ke
  berkas, dengan ringkasan 3–5 baris tetap wajib di obrolan.

### "Ada backlog?" dijawab dari `docs/antrean.md` — SATU-SATUNYA sumber

Sebelum 20 Agu 2026 antrean berserak di lima berkas (`rencana-berjalan.md`,
`ceklist-backlog.md`, `BACKLOG-SWEEP-VISUAL.md`, `RENCANA-REFACTOR-REACT.md`,
`backlog-edisi.md`), dan "ada backlog?" berkali-kali dijawab dari satu berkas
saja — C3 Screener tercatat "BELUM" berbulan-bulan karena hidupnya di berkas
yang tak pernah dibaca. Johan: *"backlog screener aja belum kmu kerjakan
sampai detik ini, payah kmu tidak menepati janjimu"*.

Sekarang: **`docs/antrean.md` adalah satu-satunya jawaban** untuk "ada
backlog?"/"apa yang belum dikerjakan?". Kelima berkas lama tetap ada untuk
riwayat/keputusan teknis (dirujuk dari `antrean.md`), tapi bagian antreannya
sudah diganti penunjuk ke sana — jangan dibaca lagi sebagai status terkini.

**Tiap baris "BELUM" di `antrean.md` wajib dicoba ulang** (grep/baca kode
yang sebenarnya) sebelum dilaporkan ke Johan — jangan disalin dari ingatan
atau dari catatan lama. Sapuan 20 Agu menemukan sembilan baris "belum" yang
ternyata sudah jadi karena tak pernah dicoba ulang.

### Status panen WAJIB berupa tabel — `docs/status-panen.md`

Johan 18 Agu 2026: *"aturan WAJIB buat tabel seperti ini dan perlu di lengkapi
lagi, halaman di papan apa nya, sumber dari mana, terakhir update kapan, status
gmn apakah sudah otomatis apa harus lewat claude code dan pakai trigger dengan
kata 'Panen Lagi'"*.

Tiap kali ditanya "sudah panen?" atau melapor soal data, jawabannya **tabel di
`docs/status-panen.md`** — diperbarui, bukan diketik ulang dari ingatan.
Kolomnya tetap: **sumber · halaman PAPAN yang memakainya · asal data · isi
terakhir · jumlah berkas · otomatis atau manual · pemicunya**.

Dua hal yang gampang salah dan mahal:

- **"Isi terakhir" dibaca dari DALAM berkas, bukan dari mtime.** Berkas bisa
  ditulis ulang tanpa membawa data baru; melaporkan mtime membuat data basi
  terlihat segar. Terjadi hari ini: broker summary "tersentuh 1 menit lalu"
  padahal isinya masih 14 Agustus.
- **Kolom "halaman pemakai" wajib diisi jujur, termasuk kalau jawabannya
  "belum dipakai".** Statistik mingguan dipanen 33 pekan dan tak pernah dibaca
  satu halaman pun sampai Johan menanyakannya; aliran asing sekarang di posisi
  yang sama. Kolom itu satu-satunya yang membuat data-yang-menganggur terlihat.

Kata pemicu panen manual lewat Claude Code: **"Panen Lagi"**.

### Empat aturan yang lahir 18 Agustus 2026 — mengikat, bukan anjuran

Lahir dari kesalahan nyata hari itu; tiap satunya sudah dibayar.

1. **Sebelum mengirim agen untuk pekerjaan mahal, periksa dulu asumsinya
   dengan cara yang murah.** Panen 2016–2019 dikirim tanpa memeriksa apakah
   IDX menyajikan tahun-tahun itu; satu agen habis satu siklus penuh, lalu
   2018 menjawab `ResultCount 0`. Membuka satu URL di peramban sudah
   menjawabnya lebih dulu. Selaras `hemat.md` §0 — **akar dulu, baru eksekusi**.
2. **Agen yang meluncurkan proses latar DILARANG menunggu.** Notifikasi
   selesainya tak sampai ke agen; ia berhenti, lalu harus dibangunkan. Terjadi
   empat kali, masing-masing ±120 ribu token untuk nol pekerjaan baru.
   Instruksinya: luncurkan, laporkan, berhenti — pemanggil yang memantau.
3. **Sonnet untuk yang speknya sudah tajam, Opus hanya untuk keputusan
   terbuka.** Bukan aturan baru (§14, insiden PAPAN 14 Agu), tapi hari itu
   dilanggar lagi: agen Opus berturut-turut 408k, 274k, 253k, 231k token.
4. **Sebelum apa pun TAYANG, jalankan satu pass khusus kebocoran** — terpisah
   dari pass kebenaran. Pertanyaannya bukan "apakah ini benar" melainkan
   "**apa yang halaman ini bocorkan**": nama endpoint, jalur berkas internal,
   aturan penggabungan, ambang skor. Halaman Metodologi terbit dengan
   `Rujukan: lib/dasbor/fundamentalGabungan.ts` tercetak di layar publik —
   dan itu lolos karena reviewnya cuma memeriksa apakah isinya BENAR. Dua
   pertanyaan berbeda; yang satu tak pernah menangkap yang lain. Tier model
   tak menolong di sini: pertanyaan yang tak diajukan tak akan dijawab
   sepintar apa pun modelnya.

### Cara kerja & rilis — WAJIB

**Kerjakan semua di localhost. Jangan push tanpa diminta.** Aturan ini berlaku sejak
16 Agu 2026 dan mengikat seluruh sesi berikutnya: commit boleh, `git push` hanya setelah
Johan menyatakan "live"/"push". Verifikasi tetap di `localhost:5173` lewat devtools.

**Tiap kali tak ada tugas lagi, tutup sesi dengan memperbarui empat tempat** — bukan
salah satu saja:

| Tempat | Isi |
|---|---|
| `CLAUDE.md` (berkas ini) | Aturan teknis baru yang mengikat sesi berikutnya |
| `docs/rencana-berjalan.md` | Progres, antrean, keputusan yang sudah diambil |
| `memory/MEMORY.md` + berkas memori | Fakta lintas sesi yang tak terbaca dari kode |
| `AI Skill/03 - AI Kemampuan/kemampuan-*.md` | Pelajaran yang berguna di **proyek lain**, didaftarkan di `kemampuan-index.md` |

Yang masuk kemampuan lintas proyek: pola teknis yang terbukti, jebakan yang gagal senyap,
metodologi kerja. Yang TIDAK: hal khas proyek ini (itu masuk `docs/`).

### Ukur definisinya dulu sebelum menurunkan satu ruas dari ruas lain

Berlaku untuk SETIAP ruas turunan, bukan cuma rasio keuangan. Sebelum menulis
`a = f(b, c)`, hitung dulu rasio "hitung ulang vs nilai tersimpan" atas sampel
acak dan lihat mediannya. 22 Agu 2026 cara ini dipakai sebelum membuat
`segarkan_harga_fundamental.py`, dan hasilnya membebaskan enam ruas untuk
dihitung ulang dengan aman (`market_cap`, `pe`, `pbv`, `earn_yield`, `ps`,
`price_fcf` — semuanya median 1,0000 atas 150-250 berkas) sekaligus MENOLAK
satu yang kelihatannya sama: `week52_change_pct` ternyata BUKAN `(harga/low−1)`
(median 0,0696), melainkan dihitung dari close 252 bar lalu. Tanpa pengukuran
itu, satu ruas akan diisi angka yang terlihat resmi dan salah tanpa satu pun
galat. Ruas yang definisinya belum terukur DIBIARKAN apa adanya — menebaknya
lebih buruk daripada membiarkannya basi, karena basi masih bisa terlihat dari
stempel waktu sedangkan tebakan tidak.

Ikutannya: **satu stempel waktu per sumber, bukan satu untuk seluruh berkas.**
`fundamental/*.json` sekarang membawa `updated` (kapan laporan keuangan
dipanen) DAN `harga_pada` (tanggal bar OHLC). Menimpa yang pertama saat
menyegarkan yang kedua akan membuat laporan keuangan bulan lalu tampak sesegar
harga hari ini.

### `create or replace function` dengan argumen BARU tidak mengganti — ia menambah

Postgres membedakan fungsi berdasarkan signature. Menambahkan parameter
(termasuk yang ber-`default`) menghasilkan fungsi KEDUA yang hidup berdampingan
dengan versi lama, dan pemanggil lama tetap memakai yang lama. 22 Agu 2026 hal
ini nyaris meninggalkan dua penghitung kuota unggah dengan aturan berbeda di
produksi — ketahuan karena `select count(*) from pg_proc` menjawab 4, bukan 2.
Sesudah mengubah signature: **periksa `pg_get_function_identity_arguments` dan
DROP versi lamanya** dalam migrasi yang sama.

### Ambang yang dipakai untuk STATISTIK tak boleh dipakai untuk MENYARING TAMPILAN

`kartu_analisa.py` memakai satu fungsi (`kode_populasi`) untuk dua peran: (a)
populasi statistik penghitung persentil/kalibrasi — yang memang butuh ambang
supaya emiten tidur tak mencemari, dan (b) siapa yang dapat kartu — yang tak
butuh ambang sama sekali. Akibatnya 582 emiten hilang dari halaman tanpa ada
yang menyatakannya (WBSA, GWSA, dst.), dan Johan menemukannya dari luar produk.
Sekarang dipisah: semua emiten ber-OHLC dapat kartu, dengan penanda kualitas
(`riwayat pendek`, `likuiditas tipis`) supaya pembaca tahu mana yang perlu
dibaca hati-hati — bukan disembunyikan. Ambang likuiditas punya dasar tertulis
di `docs/likuiditas-acuan.md` (IDX sendiri memakai peringkat relatif 150
teratas, bukan ambang rupiah tetap).

### Screener kandidat: laporkan batasnya, jangan setel ambang sampai kasus favorit muncul

`scripts/riset/kandidat_deepdive.py` menyaring emiten yang layak dimintakan
Broker Summary. Uji luar sampelnya menempatkan BUMI & DSSA — dua Deep Dive
yang terbukti — di peringkat 64/69 dan 57/60. Angka itu DICETAK di docstring,
di JSON keluaran, dan di kaki tabel Screener, karena godaan berikutnya jelas:
menaikkan ambang sampai keduanya naik ke puncak. Sudah dicoba; pada skor ≥5
keduanya justru terbuang. Daftar itu **penyaring**, bukan peringkat kelayakan,
dan tiap teks di layar wajib mengatakannya.

### Analisa PAPAN v1 — standar tiap Deep Dive & bagian emiten bulletin (Johan, 21 Agu 2026)

*"simpan analisanya jadi Analisa Papan v1 atau Mesin Papan v1, karena tingkat
probabilitas nya bagus banget, tapi tetep di pertahankan di buletin berikutnya."*

Rumahnya `docs/analisa-papan-v1.md`. Yang wajib ada di tiap Deep Dive (dulu
"Bedah Arus Saham", kode baru `DD-`) dan bagian emiten edisi harian: tiga lapis
(arus broker multi-hari · PCD · tangga pivot + EMA50), **asimetri** dinyatakan
eksplisit, skenario dalam angka (konfirmasi · rute · invalidasi), probabilitas
v2 (`arus-pasar/prob.py`: P(capai R1/R2), P(sentuh S1), dasar, CI, faktor,
uji luar sampel) dicetak apa adanya, dan **tinjauan H+5** ditambahkan ke log
§5. Mengubah metodenya = versi baru dengan catatan perubahan, bukan sunting
diam-diam. Angka P(naik 5h) BUKAN sumber kepercayaan — terukur nyaris koin;
jangan pernah menulisnya seolah sinyal.

### Nada tulisan
Pesan ke kontributor berbentuk **apresiasi**, bukan pemberitahuan penolakan.
Setoran yang disetujui tapi tak dimuat di edisi harus terbaca sebagai terima
kasih — pengakuan di depan, keterangan teknis di belakang.

### Verifikasi
Dua viewport (laptop 1536×960×1.25, telepon 412×915×2.625) sebelum melapor
selesai. Halaman admin ada di balik login: **jangan pernah mengisi kolom
sandi** — minta Johan login sendiri di jendela devtools.
