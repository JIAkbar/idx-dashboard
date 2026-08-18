# Backlog Edisi — temuan yang menunggu satu putaran perbaikan

Dikumpulkan supaya dikerjakan **sekaligus**, bukan satu per satu. Johan 18 Agu
2026: *"buat backlog edisi supaya tidak, jadi sekalian kerja tidak
satu-persatu"*.

Tiap baris: apa yang salah · di mana · kutipan asalnya.
Centang hanya kalau sudah **dilihat di PDF**, bukan cuma kode berubah.

## A. Sampul & tata letak

| ☐ | Temuan | Berkas |
|---|---|---|
| ✅ | Baris lajur kiri-kanan tak sejajar — GTSI lawan KIJA bergeser karena tinggi baris ikut panjang label | `template.html` `.cv-list.padat` — tinggi dipatok 13,2mm, label dibatasi 2 baris |
| ☐ | **Sampul mingguan** perlu diperbaiki | belum diperiksa |
| ☐ | **Catatan kaki tembus** — skor komposit bertumpuk dengan baris hak cipta, harian dan mingguan | belum diverifikasi di PDF |

## B. Halaman sentimen

| ☐ | Temuan |
|---|---|
| ☐ | Judul **"Empat hal yang menggerakkan pasar" tapi isinya dua** — judul berbohong; jadikan jumlahnya mengikuti isi |
| ☐ | **`Rp12.43 triliun`** memakai titik desimal — seharusnya `Rp12,43 triliun`. Sama untuk `Rp22.01` |
| ☐ | **`frekuensi`** huruf kecil di tengah kalimat setelah titik |
| ☐ | Poin 1 berakhir dengan **koma menggantung** (`…investor domestik,`) |
| ☐ | **Skor sentimen dihitung dari 3 komponen** (bursa dunia, rupiah, asing). Johan: *"gunakan data kita yaa biar lebih tajam lagi"* — tambahkan komponen dari data PAPAN sendiri |

## C. Isi & data

| ☐ | Temuan |
|---|---|
| ☐ | **AADI** tak masuk edisi 14 Agu: screenshot berfilter 1 bulan. Penyetornya (Agitama) perlu diberi tahu |
| ☐ | Enam emiten harga rata-rata sisi jual bukan angka asli (screenshot terpotong), ditandai `catatan_data` — pertimbangkan menampilkan tanda itu di PDF |
| ☐ | Bedah hanya mencakup **top-10 tiap sisi**, jadi net harian lebih kecil dari net pasar. Sudah disebut di catatan, belum di badan halaman |

## D. Sudah beres, jangan diulang

- Nama berkas skrip internal (`pcd.py`) dibuang dari seluruh teks produk
- "Yahoo Finance" dihapus dari semua keterangan sumber
- Hak cipta jadi `© 2026 PAPAN — Pusat Analisa Pasar Nusantara`
- Kredit kontributor tampil di samping kode emiten
- Lencana tipe edisi berwarna di Rak Terbitan, Bulletin, dan Beranda

## Cara kerja yang disepakati

Kumpulkan dulu, kerjakan satu putaran, baru terbit. Menarik terbitan itu murah
(satu perubahan `index.json`, PDF tetap utuh) — itu yang membuat "terbit dulu,
evaluasi kemudian" aman. Yang harus dijaga justru kemurahan penarikannya.
