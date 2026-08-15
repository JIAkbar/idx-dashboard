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

## ⏳ Belum — dari permintaan Johan

Ini utang ke Johan. Prioritas di atas apa pun yang kuusulkan sendiri.

| # | Tugas | Catatan |
|---|---|---|
| 123 | **Badge/notifikasi fitur baru** untuk kontributor | Ide Johan 15 Agu. Konsep matang: tabel `pengumuman`, kolom `dibaca_pada` di profil, tampil 7 hari lalu padam sendiri, titik di rail + panel (bukan modal), tanpa UI admin |
| 107 | Dasbor: badge % per emiten · bar indeks tembus · klik indeks dunia ke TradingView | 3 dari 4 butir |
| 108 | **[IHSG]** Panen harga BUKA harian | Kecil — yang kurang cuma `ihsg_open`. Membuka lilin sungguhan + lilin mini kalender |
| 122 | **[EMITEN]** Panen OHLC harian + chart candle | Proyek tersendiri. Belum ada data apa pun. Perlu keputusan cakupan, rentang, dan pemecahan berkas dulu |
| 109 | Peta Investor: pindah tombol Tampilkan + hapus ekspor "Seluruh dataset" | |
| 99 | Stock Detail: laporan keuangan kuartalan ala Yahoo Financials | Paling besar yang tersisa |

## ⏳ Belum — usulan yang SUDAH disetujui Johan

Disetujui 15 Agu 2026 ("ini juga jadi backlog"). Statusnya kini sama dengan
permintaan langsung — bukan lagi sekadar usulan yang menunggu jawaban.

| Tugas | Kenapa dikerjakan |
|---|---|
| **124 · Chart IHSG: pemilih rentang** + ganti judul "Tahun Berjalan" | Muncul dari pertanyaan Johan 15 Agu. Datanya (`ihsg_harian.json`, 8.849 hari) SUDAH ada tapi belum dipakai halaman mana pun — itu yang membuatnya layak dikerjakan lebih dulu di antara usulanku |
| 126 · Chart komparasi Seasonality | Matriks sudah membandingkan; grafik garis 12 titik akan lebih cepat dibaca |
| 126 · Verifikasi mobile Seasonality | Baru diuji di laptop — wajib sebelum halaman ini diumumkan ke channel |
| Lilin mini di kalender bursa | Terhalang #108 (bagian IHSG) |
| Ruang emiten forum ↔ Seasonality ↔ Stock Detail saling menaut | |

## 🔧 Utang teknis

Bukan permintaan siapa pun; muncul dari pekerjaan itu sendiri.

- **125 · Tab Avg Down** — bug proxy yang sama dengan Pemulihan; polanya tinggal disalin
- **GOTOM** tak ada di Yahoo — satu-satunya emiten gagal panen
- **127 · PDF bulletin masih berhuruf lama** — daftarkan Red Hat ke pipeline cetak Python
- **128 · Angka fraksi harga** perlu dicocokkan ke dokumen resmi IDX (press release menolak pengambil otomatis)
- Tombol hapus forum belum diverifikasi visual — perlu sesi superadmin

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
