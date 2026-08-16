# Ceklist backlog PAPAN

Papan status kerja borongan 16 Agustus 2026. Centang = selesai & terverifikasi
(tsc + uji + dua viewport kalau menyentuh tampilan).

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
