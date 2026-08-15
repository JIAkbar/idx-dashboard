# Rencana berjalan PAPAN

Catatan hidup — diperbarui tiap ada keputusan. Ditulis ke berkas supaya tidak
bergantung pada ingatan percakapan (yang bisa diringkas dan kehilangan detail).

Terakhir diperbarui: 15 Agustus 2026 (malam — setelah verifikasi mobile Seasonality).

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
| 133 | Seasonality tak tergembok padahal keputusannya "perlu masuk" | Sangat kecil | Akses jadi sesuai keputusan | — perlu konfirmasi Johan dulu |
| 128 | Cocokkan fraksi harga ke dokumen IDX | Kecil | Angka aturan bursa jadi pasti | — perlu penilaian sumber |
| 124 | Chart IHSG: pemilih rentang + judul | Sedang | Grafik 30+ tahun langsung terpakai | — keputusan sambungan dua sumber |
| 127 | PDF bulletin: daftarkan Red Hat | Sedang | Web & PDF seragam | ✅ sonnet kalau pipeline-nya sudah dipetakan |
| 132 | Chart komparasi Seasonality antar-emiten | Sedang | Perbandingan emiten lebih cepat dibaca | — keputusan bentuk grafik |
| 109 | Peta Investor: pindah tombol + hapus ekspor | Sedang | Rapi | ✅ sonnet |
| 123 | Badge/notifikasi fitur baru | Sedang-besar | Kontributor tahu ada yang baru | — migrasi DB + RLS + desain |
| 107 | Dasbor: badge %, bar tembus, klik ke TradingView | Sedang-besar | Dasbor lebih hidup | sebagian ✅ sonnet |
| 122 | [EMITEN] Panen OHLC 5 tahun + chart candle | Besar | Chart candle per emiten | panen ✅ sonnet · chart — |
| 131b | Seasonality tab 2 — bagian emiten | Besar | Pola harian per emiten | terhalang #122 |
| 130 | Analisis volume & divergensi tiga lapis | Besar | Yang tak ada di aplikasi lain | terhalang #122/#108 |
| 99 | Stock Detail: laporan keuangan kuartalan | Paling besar | Fundamental lengkap | — perlu perancangan tabel |
| 129 | **[PALING AKHIR]** Chart bandarmologi ala @Asta_8_Free_Bot | Paling besar | Lima panel bawahnya BELUM ada datanya | — perlu sumber broker per emiten |

Tiga teratas bisa selesai dalam satu sesi pendek. Yang bertanda ✅ sonnet bisa
dikerjakan bersamaan oleh agen terpisah karena berkasnya tak bersinggungan —
#125 dan #126 tadi memang berjalan paralel tanpa bentrok.

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
| Tier turun | Hanya terpicu kalau masih ada setoran baru. Yang berhenti total tiernya membeku — tier itu rekam jejak, bukan langganan; yang hilang aksesnya, lewat pembekuan |
| Berkas terkurasi | Tak bisa dihapus/diganti penyetornya begitu status keluar dari `menunggu`; superadmin tetap bebas |
| Identitas penyetor | Tak terlihat antar-kontributor. Yang ditampilkan cuma "Sudah disetor" — cukup untuk mencegah kerja ganda |

## Aturan yang berlaku

- **Paket rilis WA** wajib tiap fitur/halaman publik baru: screenshot desktop + mobile, naskah fungsi & keunggulan. Backend tidak diumumkan.
- **Verifikasi dua viewport** sebelum melapor selesai: laptop 1536×960×1.25, telepon 412×915×2.625.
- **Harga apa pun** yang ditampilkan wajib lewat `keFraksi()` — lihat `docs/pedoman-harga-bei.md`. Kecuali rata-rata biaya (cost basis) hasil hitungan, yang memang tak wajib jatuh di tick.
- **Grid pembungkus halaman** wajib `minmax(0, 1fr)`, bukan `auto`. Kolom `auto` melebar mengikuti anak terlebar (tabel ber-min-width), dan karena `.dasbor-main` memotong bukan menggulung, kelebihannya jadi tak terjangkau di ponsel. Ditemukan pada Seasonality 15 Agu 2026.
