# Rencana berjalan PAPAN

Catatan hidup — diperbarui tiap ada keputusan. Ditulis ke berkas supaya tidak
bergantung pada ingatan percakapan (yang bisa diringkas dan kehilangan detail).

Terakhir diperbarui: 16 Agustus 2026 (dini hari — setelah sesi admin, jenjang & kurasi).

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

### ⚠️ Keputusan yang MENUNGGU Johan

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

Rekomendasi: **A**. Yang Johan sebut — "bisa improvisasi lebih detail" —
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
| Pembekuan otomatis | Diukur dari **kehadiran** (`max(dibuat_pada)` setoran apa pun statusnya), bukan dari setoran yang lolos kurasi. Mutu dihukum di jalur jenjang, bukan di sini |
| Ambang beku | Ikut jenjang: Pemula 5, Perunggu 7, Perak 10, Emas 20, Platinum 60, Diamond 120 hari kerja (≈5,5 bulan). Kolom `jenjang.hari_beku` |
| Status `revisi` | Penolakan yang tak menghukum — berkas boleh diganti, TIDAK ikut membagi akurasi. Untuk penyetor beritikad baik yang datanya perlu diperbaiki |
| Aksi kurasi | Tiga saja: **Setujui · Revisi · Hapus**. "Tolak" dibuang (#142) — dia tak menjawab apa pun: berkasnya tinggal, penyetor tak bisa memperbaiki, akurasinya turun. Baris `ditolak` yang ada DIKONVERSI ke `dihapus`, bukan dibiarkan — dua status yang artinya sama akan menempel di tiap query akurasi selamanya |
| Setoran ditolak | TIDAK memakan kuota, TIDAK mengunci emitennya, dan boleh dihapus penyetornya. Penolakan sudah dihukum di akurasi — menghukumnya lagi dengan kehilangan giliran hari itu adalah hukuman kedua untuk kesalahan yang sama |
| Tier turun | Hanya terpicu kalau masih ada setoran baru. Yang berhenti total tiernya membeku — tier itu rekam jejak, bukan langganan; yang hilang aksesnya, lewat pembekuan |
| Berkas terkurasi | Tak bisa dihapus/diganti penyetornya begitu status keluar dari `menunggu`; superadmin tetap bebas |
| Identitas penyetor | Tak terlihat antar-kontributor. Yang ditampilkan cuma "Sudah disetor" — cukup untuk mencegah kerja ganda |
| Kredit & jenjang | Ikut setoran **disetujui**, BUKAN yang dimuat di edisi. Kerjanya sudah dilakukan; dimuat atau tidak itu keputusan redaksi, bukan ukuran kerjanya |
| Isi PDF | Ikut filter superadmin (`dimuat`), terpisah dari kurasi. Menolak setoran yang benar demi memangkas isi edisi bukan lagi satu-satunya cara |

## Aturan yang berlaku

- **Paket rilis WA** wajib tiap fitur/halaman publik baru: screenshot desktop + mobile, naskah fungsi & keunggulan. Backend tidak diumumkan.
- **Verifikasi dua viewport** sebelum melapor selesai: laptop 1536×960×1.25, telepon 412×915×2.625.
- **Istilah yang benar: BROKER SUMMARY**, bukan "orderbook". Seluruh aplikasi masih memakai istilah lama (#144) — jangan menambah pemakaian baru.
- **Nada pesan ke kontributor** berbentuk apresiasi, bukan pemberitahuan penolakan. Setoran yang disetujui tapi tak dimuat di edisi harus terbaca sebagai terima kasih atas kerjanya — pengakuan di depan, keterangan teknis di belakang.
- **Harga apa pun** yang ditampilkan wajib lewat `keFraksi()` — lihat `docs/pedoman-harga-bei.md`. Kecuali rata-rata biaya (cost basis) hasil hitungan, yang memang tak wajib jatuh di tick.
- **Grid pembungkus halaman** wajib `minmax(0, 1fr)`, bukan `auto`. Kolom `auto` melebar mengikuti anak terlebar (tabel ber-min-width), dan karena `.dasbor-main` memotong bukan menggulung, kelebihannya jadi tak terjangkau di ponsel. Ditemukan pada Seasonality 15 Agu 2026.
