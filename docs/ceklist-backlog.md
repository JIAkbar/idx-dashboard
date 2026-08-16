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
| ☐ | 145 | "Bar tembus" maksudnya apa — bar kapitalisasi yang melewati kotak, atau bar dua arah dari sumbu nol? |
| ☐ | 146 | "Divergensi tiga lapis" — lapis mana: harga vs volume, volume vs frekuensi, asing vs domestik? Urutannya menentukan seluruh perhitungan |

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
