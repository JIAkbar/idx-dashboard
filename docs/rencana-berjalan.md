# Rencana berjalan PAPAN

Catatan hidup — diperbarui tiap ada keputusan. Ditulis ke berkas supaya tidak
bergantung pada ingatan percakapan (yang bisa diringkas dan kehilangan detail).

Terakhir diperbarui: 15 Agustus 2026.

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
| 125 | Tab Avg Down: cadangan harga lokal | Sangat kecil | Bug production hilang | ✅ sonnet — polanya tinggal disalin dari Pemulihan.tsx |
| 108 | [IHSG] Panen harga BUKA harian | Kecil | Lilin berhenti jadi aproksimasi | ✅ sonnet — satu ruas ditambah ke skrip yang sudah jalan |
| 126 | Verifikasi mobile Seasonality | Kecil | Membuka jalan pengumuman WA | ✅ sonnet — ceklist viewport sudah baku |
| 128 | Cocokkan fraksi harga ke dokumen IDX | Kecil | Angka aturan bursa jadi pasti | — perlu penilaian sumber |
| 124 | Chart IHSG: pemilih rentang + judul | Sedang | Grafik 30+ tahun langsung terpakai | — keputusan sambungan dua sumber |
| 127 | PDF bulletin: daftarkan Red Hat | Sedang | Web & PDF seragam | ✅ sonnet kalau pipeline-nya sudah dipetakan |
| 126b | Chart komparasi Seasonality | Sedang | Perbandingan emiten lebih cepat dibaca | — keputusan bentuk grafik |
| 109 | Peta Investor: pindah tombol + hapus ekspor | Sedang | Rapi | ✅ sonnet |
| 123 | Badge/notifikasi fitur baru | Sedang-besar | Kontributor tahu ada yang baru | — migrasi DB + RLS + desain |
| 107 | Dasbor: badge %, bar tembus, klik ke TradingView | Sedang-besar | Dasbor lebih hidup | sebagian ✅ sonnet |
| 122 | [EMITEN] Panen OHLC 5 tahun + chart candle | Besar | Chart candle per emiten | panen ✅ sonnet · chart — |
| 99 | Stock Detail: laporan keuangan kuartalan | Paling besar | Fundamental lengkap | — perlu perancangan tabel |

Empat teratas bisa selesai dalam satu sesi pendek, dan tiga di antaranya bisa
dikerjakan bersamaan oleh agen terpisah karena berkasnya tak bersinggungan.

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

## Aturan yang berlaku

- **Paket rilis WA** wajib tiap fitur/halaman publik baru: screenshot desktop + mobile, naskah fungsi & keunggulan. Backend tidak diumumkan.
- **Verifikasi dua viewport** sebelum melapor selesai: laptop 1536×960×1.25, telepon 412×915×2.625.
- **Harga apa pun** yang ditampilkan wajib lewat `keFraksi()` — lihat `docs/pedoman-harga-bei.md`.
