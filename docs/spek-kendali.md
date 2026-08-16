# #170 — Penyeragaman kendali PAPAN

Diangkat jadi pekerjaan utama 17 Agustus 2026. Sebelumnya dijadwalkan paling
akhir (urut 21) dengan alasan "halaman baru akan menambah kendali baru" —
**alasan itu dibatalkan Johan**: *"kerjakan semua nya yaa sampai selesai dan
termasuk jika perlu page baru, menu baru, dan lain sebagainya"*.

---

## Sepuluh keluhan, dikutip verbatim

Diparafrase = kehilangan detail yang membuatnya bisa diperiksa. Ini daftar
kerjanya, bukan ringkasan.

| # | Keluhan Johan | Halaman |
|---|---|---|
| K1 | *"ada box kalender besar tapi tombol kiri kanan nya kecil gak presisi"* | Indeks Dunia — Kalender Bursa |
| K2 | *"tombol rentang itu ya jarak antar waktu dalam bentuk kalender"* | semua yang punya rentang |
| K3 | *"keliatan tombol export nya kaku sekali"* | Peta Investor |
| K4 | *"karena grup konglo ini ada artinya perlu juga tombol rentang data"* | Peta Investor — Grup Konglomerat |
| K5 | *"perlu kalender rentang data juga perlu di update"* | Broker Summary |
| K6 | *"kartu broksum juga perlu di update"* | Broker Summary |
| K7 | *"di page radar ini belum kesentuh sama sekali karena data masih di gmail"* | Radar Watchlist |
| K8 | *"terus bar nya juga perlu di rapikan"* | Radar Watchlist |
| K9 | *"page season lebih parah lagi pakai default di 1Y saja dan perlu ada kalender rentang yang seragam"* | Seasonality |
| K10 | *"teks nya juga IHSG terlalu kecil juga kenapa BUMI itu malah rounded kan aneh jadi tidak seragam"* | Seasonality — pemilih sumber |

---

## Bukti ketidakseragamannya — terlihat dari tangkapan layar Johan

Satu jenis kendali, lima bentuk berbeda:

| Halaman | Pemilih rentang | Bentuknya |
|---|---|---|
| Beranda / Indeks | `YTD · 1T · 5T · 10T · Semua` | pil kecil |
| Kalender Bursa | `1 Minggu · 1 Bulan · 3 Bulan · YTD` | pil, label beda gaya |
| Broker Summary | `1 Minggu · 1 Bulan · 3 Bulan · 6 Bulan · YTD · 1 Tahun` | pil + dua kalender terpisah |
| Seasonality | `Semua · MTD · YTD · 1 thn · 2 thn · 3 thn · 5 thn · 10 thn · 20 thn` | pil, satuan ditulis "thn" |
| Radar | `03 · 06 · 10 · 12 · 13` + panah | angka tanggal telanjang |

**Lima cara menulis hal yang sama**: "1 Tahun" vs "1T" vs "1 thn". Dan
Seasonality memakai *"20 thn"* sementara Beranda memakai *"10T"* untuk maksud
yang sama persis.

Chip pemilih sumber di Seasonality: `IHSG` bersudut kotak, `BUMI` bersudut
bulat penuh — dua chip bersebelahan, dua bentuk berbeda, tanpa alasan.

---

## Prinsip yang mengikat pekerjaan ini

1. **Satu kendali, satu komponen.** Kalau sebuah pola muncul di dua halaman,
   ia jadi komponen bersama — bukan disalin. Pelajaran yang sudah dibayar hari
   ini: gaya bersama yang harus disalin supaya bekerja **pasti** berhenti
   bekerja (kasus batang gulir 2px, kemampuan §188).
2. **Yang sudah ada dipakai ulang, bukan ditulis ulang.** `Dropdown.tsx`,
   `DatePicker.tsx`, `.tabs/.tab`, `.dd-btn`, `.inp`, `.chip` sudah ada.
   Sebelum membuat komponen baru, buktikan yang lama tak cukup.
3. **Tak ada gaya inline untuk hal yang berulang.** Gaya inline tak ikut token
   tema `.lantai`, dan itu mekanisme persis yang membuat dua tab kembar terlihat
   berbeda (kasus tombol Tambah Emiten, 17 Agu).
4. **Satu kosakata waktu.** Pilih satu bentuk — `1M · 3B · YTD · 1T · 5T · 10T ·
   Semua` — lalu pakai di semua halaman. Yang tak berlaku di suatu halaman
   dihilangkan, bukan ditulis dengan gaya lain.
5. **Target sentuh minimal 44px** untuk panah/langkah kalender (K1). Panah 24px
   di sebelah kotak kalender 300px itu bukan cuma tak seimbang — di telepon ia
   memang sulit ditekan.
6. **Verifikasi dua viewport** dan **berdampingan** dengan halaman lain yang
   memakai kendali yang sama. "Mirip" tidak cukup; yang dicari seragam.

---

## Rencana kerja

### Tahap 1 — Audit (sebelum menyentuh kode)

Inventarisasi SETIAP kendali di seluruh halaman publik + admin, dengan
`file:baris`, lalu kelompokkan mana yang sebenarnya satu jenis. Keluarannya
`docs/audit-kendali.md`. Tanpa ini, penyeragaman jadi tebak-tebakan dan pasti
ada yang tertinggal.

### Tahap 2 — Komponen kanonis

Dari hasil audit, buat/tetapkan komponen bersama. Dugaan awal (dikoreksi audit):

| Komponen | Menggantikan |
|---|---|
| `PemilihRentang` | 5 varian pil rentang di 5 halaman |
| `KalenderRentang` | dua `DatePicker` terpisah di Broker Summary; rentang bebas Kalender Bursa |
| `LangkahTanggal` | panah kiri/kanan yang sekarang beda ukuran di 4 tempat |
| `TombolEkspor` | tombol Export XLS Peta Investor (K3) |
| `Chip` | penyeragaman sudut & tinggi (K10) |

### Tahap 3 — Terapkan per halaman

Indeks Dunia → Broker Summary → Peta Investor → Seasonality → Radar →
Bulletin. Satu halaman satu commit, supaya bisa ditolak satu per satu.

### Tahap 4 — Yang butuh data, bukan cuma tampilan

- **K4** Grup Konglomerat perlu rentang data — sekarang cuma potret hari ini.
  Perlu diputuskan: rentangnya menghitung apa? (perubahan kepemilikan? kinerja
  anggota grup dalam rentang?) **Jangan ditebak** — tanyakan dulu.
- **K7** Radar: datanya masih di Gmail, belum masuk sistem. Ini bukan pekerjaan
  tampilan; jalur masuknya harus dibereskan lebih dulu.

---

## Yang TIDAK dikerjakan tanpa keputusan Johan

- Bentuk akhir kosakata waktu (prinsip 4) — saya usulkan, Johan yang memilih.
- Arti "rentang" untuk Grup Konglomerat (K4).
- Cara data Radar masuk sistem (K7).
