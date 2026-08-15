# Rencana berjalan PAPAN

Catatan hidup — diperbarui tiap ada keputusan. Ditulis ke berkas supaya tidak
bergantung pada ingatan percakapan (yang bisa diringkas dan kehilangan detail).

Terakhir diperbarui: 15 Agustus 2026.

## Sedang dikerjakan

### Kalkulator · tab Pemulihan
Sudah ada: cermin posisi (harga beli + harga sekarang), tabel 5–95%, kolom
lama pulih pada asumsi imbal tahunan, gradasi baris, harga di tiap titik.

Belum:
- **Kolom rupiah** — kerugian dan kebutuhan pemulihan dalam nominal, bukan cuma persen
- **Input emiten + harga average manual** (pola `PosisiBar` di `RiskReward.tsx`)
- **Angka risk/reward** di dalam cermin posisi
- **Harga sasaran dibulatkan ke fraksi BEI** lewat `keFraksi()` — sekarang masih angka mentah yang bisa jadi harga tak sah
- **Kolom hari ARA** lewat `hariAraMinimal()` — dulu ditunda karena aturannya belum ada; sekarang sudah ada

### Halaman Seasonality
Sudah ada: pencarian sampai 5 emiten, matriks 12 bulan (peluang tersusut),
laci detail per bulan (selang Wilson, mengalahkan IHSG, bar per tahun), uji
permutasi, filter tahun, gating login.

Belum:
- **Chart komparasi** — garis 12 titik per emiten dalam satu grafik
- **Verifikasi mobile** (baru diuji di laptop)
- Ruang emiten forum & Stock Detail belum saling menaut ke halaman ini

### Sistem pengumuman fitur baru
Konsep disepakati, belum dibangun:
- Tabel `pengumuman`: judul, ringkasan, tautan, `tayang_sejak`, `untuk_jenjang`
- Satu kolom `pengumuman_dibaca_pada` di `profil` — bukan tabel silang
- Badge muncul kalau ada pengumuman < 7 hari yang belum dibaca; padam sendiri
- Titik kecil di rail + panel ringkas, **bukan modal**
- Tanpa UI admin — barisnya ditulis langsung ke DB saat Johan minta

## Backlog lama

| # | Tugas |
|---|---|
| 99 | Stock Detail: laporan keuangan kuartalan ala Yahoo Financials |
| 107 | Dasbor: badge % per emiten, bar indeks tembus, klik indeks dunia ke TradingView (ripple IHSG sudah selesai) |
| 108 | Panen OHLC harian — harga **buka**; menyelesaikan aproksimasi lilin & membuka lilin mini di kalender |
| 109 | Peta Investor: pindah tombol Tampilkan + hapus ekspor "Seluruh dataset" |

## Utang kecil

- **GOTOM** tak ada di Yahoo — satu-satunya emiten gagal panen
- **PDF bulletin masih berhuruf lama** — `arus-pasar/cetak.css` sengaja dilewati saat pasang Red Hat; menyeragamkan berarti mendaftarkan font ke pipeline Python
- **Chart IHSG** masih berjudul "Tahun Berjalan" dan belum punya pemilih rentang, padahal `ihsg_harian.json` (1990–2026) sudah ada
- **Lilin mini di kalender bursa** terhalang `cal_index.json` yang tak menyimpan tinggi/rendah
- **Angka fraksi harga** perlu dicocokkan ke dokumen resmi IDX (press release menolak pengambil otomatis)
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
