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
| ☐ | **Sampul mingguan** perlu diperbaiki | Di luar tugas — Johan 20 Agu: *"gak ada intruksi mingguan masih di bahas minggu an"*. Sempat diperiksa dan ditemukan bug nyata (progresi lintas hari `Sen 70 → Jum 65` lenyap diam-diam untuk emiten berlabel panjang, mis. VKTR: label 2 baris + progresi = 3 baris, `-webkit-line-clamp:2` cuma menyisakan `…`), sudah diperbaiki DAN dibatalkan lagi sesuai instruksi; `build_weekly.py` kembali ke `git HEAD`, tak ada perubahan tersisa |
| ✅ | **Catatan kaki tembus** — skor komposit bertumpuk dengan baris hak cipta (**harian saja**, sesuai lingkup) | Sudah diperbaiki 18 Agu (`.inner{overflow:hidden}`, commit bf03c4e). Diverifikasi ulang 20 Agu di edisi HARIAN: 8 halaman emiten AP-140826 dirender ke gambar (termasuk yang memuat `catatan_data`, baris terpanjang) — nol tumpang tindih di seluruhnya. Bagian mingguan TIDAK diperiksa sesi ini (di luar lingkup) |

## B. Halaman sentimen

| ☐ | Temuan | Keterangan |
|---|---|---|
| ✅ | Judul **"Empat hal yang menggerakkan pasar" tapi isinya dua** — judul berbohong; jadikan jumlahnya mengikuti isi | Sudah benar di kode sejak awal (`build.py` `halaman_sentimen()`: `judul_poin` dihitung dari `len(st["poin"])`, bukan dieja mati) — tak perlu diperbaiki. Dilihat di PDF: AP-140826 hal.3 "DUA HAL..." (2 poin), AP-130826 hal.3 "EMPAT HAL..." (4 poin), AP-180826 hal.3 "TIGA HAL..." (3 poin) — ketiganya cocok |
| ✅ | **`Rp12.43 triliun`** memakai titik desimal — seharusnya `Rp12,43 triliun`. Sama untuk `Rp22.01` | Sudah diperbaiki sesi sebelumnya (commit 2edccd04). Dilihat di PDF sesi ini: AP-140826 hal.3 mencetak "Rp12,43 triliun" dan "Rp22,01 triliun" dengan koma |
| ✅ | **`frekuensi`** huruf kecil di tengah kalimat setelah titik | Sudah diperbaiki sesi sebelumnya (commit 2edccd04). Dilihat di PDF sesi ini: AP-140826 hal.3 "Frekuensi 1.730 ribu..." dengan huruf besar |
| ✅ | Poin 1 berakhir dengan **koma menggantung** (`…investor domestik,`) | Sudah diperbaiki sesi sebelumnya (commit 2edccd04). Dilihat di PDF sesi ini: AP-140826 hal.3 "...investor domestik." berakhir titik |
| ☐ | **Skor sentimen dihitung dari 3 komponen** (bursa dunia, rupiah, asing). Johan: *"gunakan data kita yaa biar lebih tajam lagi"* — tambahkan komponen dari data PAPAN sendiri | **Ditunda 20 Agu** — belum diminta Johan sesi ini; `skor_sentimen()` TIDAK diubah. Sudah diukur (bukan ditebak) sebagai bahan usulan kalau pekerjaan ini dijalankan nanti: kandidat komponen **breadth** (partisipasi pasar) = persen saham naik dikurangi turun, SELURUH pasar (963 saham 14 Agu), dari ruas `price_movement.stocks` yang sudah dipanen dari PDF resmi IDX sendiri (`scripts/parse_idx_pdf.py`, bukan data pihak ketiga) — tersedia lengkap di 144/144 berkas `ds_*.json`, tak perlu panen baru. Formula usulan: `skor = clamp(5 + 0,1 × breadth_pp, 0, 10)`. Koefisien 0,1 diukur dari 17 hari bursa (27 Jul–19 Agu): breadth berkisar −35..+44pp, skor jadi tersebar 1,5–9,4 (jarang jenuh 0/10). Temuan menarik dari pengukuran: breadth SERING berlawanan arah dengan IHSG cap-weighted — 14 Agu breadth −8pp (lebih banyak saham turun) sementara IHSG +1,59%, sinyal "rally sempit" yang independen dari 3 komponen makro yang ada sekarang. Sempat diimplementasikan penuh (kode + PDF terverifikasi bersih di 3 edisi harian) lalu dibatalkan sesuai instruksi; `build.py` kembali ke `git HEAD`, tak ada perubahan tersisa |

## C. Isi & data

| ☐ | Temuan | Keterangan |
|---|---|---|
| ☐ | **AADI** tak masuk edisi 14 Agu: screenshot berfilter 1 bulan. Penyetornya (Agitama) perlu diberi tahu |
| ✅ | Enam emiten harga rata-rata sisi jual bukan angka asli (screenshot terpotong), ditandai `catatan_data` — pertimbangkan menampilkan tanda itu di PDF | Sudah diperbaiki sesi sebelumnya (commit 2edccd04). Dilihat di PDF sesi ini: AP-140826 hal.27 mencetak "Catatan data: Kolom S.avg terpotong di layar sempit — harga rata-rata sisi jual tak terbaca." dengan warna peringatan |
| ✅ | Bedah hanya mencakup **top-10 tiap sisi**, jadi net harian lebih kecil dari net pasar. Sudah disebut di catatan, belum di badan halaman | Sudah diperbaiki sesi sebelumnya (commit 2edccd04). Dilihat di PDF sesi ini: AP-140826 hal.9 dst. mencetak "NET di atas dari 10 broker teratas tiap sisi — bisa lebih kecil dari net seluruh pasar." di badan halaman |

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
