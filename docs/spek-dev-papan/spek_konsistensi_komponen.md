# SPEK KONSISTENSI KOMPONEN & TATA LETAK — semua halaman PAPAN (Fable, 26 Agu 2026)

> Johan: *"pastikan konsistensi komponen ya misal seperti rentang waktu itu atau tanggal perlu konsisten artinya menyediakan bnyk rentang waktu jika data kita memungkinkan"* · *"contoh seperti ini sepertinya saya sudah minta untuk di rapikan lagi layout nya dan grid nya tapi gak di kerjakan, aneh rasanya chart nya tinggal tapi data yang di sajikan malah memanjang kebawah, lalu toolbar nya naik turun"*.
> Dua keluhan, dua akar berbeda, dua-duanya **sudah kudiagnosa ke kode** — bukan dugaan.

---

## 1. 🔴 TATA LETAK WHALES PAPAN — akarnya ketemu, satu baris CSS

Keluhan Johan tepat dan terlihat jelas di tangkapan layarnya: chart berhenti sekitar sepertiga tinggi layar, sementara panel kanan memanjang jauh ke bawah, meninggalkan **ruang mati besar** di bawah chart.

**Akar (terukur di `views/dasbor/WhalesPapan.css`):**
```css
.wp-panggung {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  align-items: start;      /* ← tiap kolom setinggi isinya sendiri */
}
.wp-chart { height: clamp(320px, 42vw, 560px); }   /* ← chart DIPATOK maks 560px */
```
Kolom kiri (chart) dipatok maksimum **560 px**; kolom kanan (panel broker) tumbuh sesuai isi — bisa 700–900 px saat banyak broker. Karena `align-items: start`, keduanya tak pernah disamakan. Selisihnya jadi ruang kosong.

**Sekaligus menjelaskan "toolbar naik turun"**: tinggi panel kanan berubah tiap kali seleksi/emiten berganti (jumlah baris broker berbeda) → tinggi halaman berubah → posisi gulir bergeser → toolbar tampak melompat.

### Perbaikan
Samakan tinggi kedua kolom, dan biarkan panel yang **menggulir di dalam dirinya sendiri** — ini pola baku "chart + panel samping" yang dipakai whales.id dan tradersaham:
```css
.wp-panggung { align-items: stretch; }          /* dua kolom setinggi baris yang sama */
.wp-hasil {
  max-height: clamp(320px, 42vw, 560px);        /* SAMA dengan .wp-chart */
  overflow-y: auto;                              /* isi panjang menggulir di dalam */
  overscroll-behavior: contain;                  /* gulir panel tak menyeret halaman */
}
```
Lebih rapi lagi: pindahkan tinggi itu ke satu variabel supaya tak pernah lagi ada dua angka yang harus dijaga sama:
```css
.wp-panggung { --wp-tinggi: clamp(320px, 42vw, 560px); }
.wp-chart, .wp-hasil { height: var(--wp-tinggi); }
.wp-hasil { overflow-y: auto; }
```

**Kriteria terima:** (a) tak ada ruang kosong di bawah chart pada 1920 maupun 412; (b) panel dengan 20+ baris broker menggulir **di dalam panel**, halaman tidak memanjang; (c) ganti emiten/seleksi **tidak menggeser posisi toolbar**; (d) di ≤900 px (media query yang sudah ada) tata letaknya menumpuk dan `max-height` panel dilepas supaya tak ada gulir bersarang di ponsel.

**Catatan untuk pelaksana:** Johan menyebut ini "sudah diminta tapi tidak dikerjakan". Kalau permintaan sebelumnya memang pernah masuk dan terlewat, sebut apa adanya di jejak — jangan diam-diam mengerjakannya seolah baru diminta hari ini.

---

## 2. 🔴 RENTANG WAKTU — ada EMPAT kosakata berbeda di satu aplikasi

Terukur, empat sistem preset hidup berdampingan:

| Tempat | Pilihan | Terpanjang |
|---|---|---|
| **Neo Papan** (`neo-papan/bersama.tsx:57`) `RentangNp` | `2w · b1 · b3 · b6 · ytd · semua` | Semua |
| **Broker Stalker** (`StalkerTab.tsx:35-38`) | `20 hari · 60 hari · YTD · 1 tahun` | 1 tahun |
| **Stock Detail** (`stock-detail/KolomLaporan.tsx:15`) | `1D · 1W · 1M · 3M · 6M · YTD · 1Y · 3Y · 5Y` | 5Y |
| **Diary Pasar** (`lib/dasbor/diaryPasar.ts:128`) | `1D · 5D · 1M · 3M · 6M · YTD · 1Y · 3Y · 5Y` | 5Y |

Tiga masalah sekaligus:
1. **Penamaan tak seragam** — `b3` vs `3M` vs `60 hari` untuk gagasan yang mirip. Pemakai harus belajar ulang tiap pindah halaman.
2. **Kedalaman tak mencerminkan data.** Ini inti keluhan Johan. Neo Papan berhenti di "semua" tanpa langkah menengah panjang; Stalker berhenti di **1 tahun** padahal `broker_tahunan` menyimpan **2020–2026** (dan segera **2016–2026**). Stock Detail sudah benar sampai 5Y karena OHLCV memang dalam.
3. **`1D` vs `5D` vs `1W`** — dua berkas memakai satuan berbeda untuk maksud yang sama.

### Standar yang ditetapkan

**Satu kosakata untuk seluruh aplikasi**, dengan aturan: *tampilkan hanya preset yang datanya benar-benar ada untuk halaman & emiten itu*.

| ID | Label | Dipakai bila |
|---|---|---|
| `1w` | 1 Pekan | selalu |
| `1m` | 1 Bulan | selalu |
| `3m` | 3 Bulan | selalu |
| `6m` | 6 Bulan | selalu |
| `ytd` | YTD | selalu |
| `1y` | 1 Tahun | selalu |
| `3y` | 3 Tahun | data ≥3 tahun |
| `5y` | 5 Tahun | data ≥5 tahun |
| `10y` | 10 Tahun | data ≥10 tahun |
| `semua` | Semua | selalu (dengan caption rentang sebenarnya) |

**Aturan wajib (semuanya sudah punya preseden yang jalan di PAPAN):**
- **Preset yang datanya tak ada JANGAN ditampilkan** — atau ditampilkan nonaktif dengan alasan di `title`. Preseden benar: chip intraday Whales dinonaktifkan berikut alasannya.
- **Judul/caption menampilkan rentang SEBENARNYA yang terpakai**, bukan label preset. Preseden benar: Stalker menulis "2026-05-26 → 2026-08-24 (60 hari bursa)". Ini juga yang menutup keluhan lama "60d bohong".
- **Bila permintaan melampaui data**, katakan. Preseden benar: Seasonality "(diminta 12, arsip hanya 6)".
- **Satu sumber definisi.** Taruh daftar preset + label + logika ketersediaan di **satu modul bersama** (kandidat: perluas `neo-papan/bersama.tsx` jadi `lib/dasbor/rentang.ts` yang dipakai semua halaman). Jangan ada halaman yang mendefinisikan presetnya sendiri lagi — itu asal-usul empat kosakata ini.

### Yang berubah per halaman setelah broker 2016 terbangun
- **Broker Stalker**: tambah `3y` · `5y` · `10y` (data broker akan 2016–2026 = 11 tahun). Beri tombol pemicu bertaksiran MB untuk yang panjang — pola ini **sudah ada** di Stalker, tinggal diperluas.
- **Neo Papan** (`RentangNp`): ganti `2w/b1/b3/b6` → kosakata baku, tambah `1y/3y/5y`.
- **Inventory / Compare**: ikut kosakata baku; keduanya membaca `broker_tahunan` jadi otomatis dapat kedalaman baru.
- **Stock Detail & Diary Pasar**: seragamkan `1D`→`1w` dst; keduanya sudah paling dalam, tinggal penamaannya.

---

## 3. Konsistensi tanggal (bagian kedua permintaan Johan)

Sekalian saat menyentuh rentang, seragamkan juga:
- **Format tanggal**: satu format di seluruh aplikasi (usul: `26 Agu 2026` untuk teks, `2026-08-26` untuk judul rentang teknis & CSV). Sekarang bercampur.
- **Pemilih tanggal**: Compare sudah punya DatePicker per sisi. Halaman lain yang menawarkan rentang bebas sebaiknya memakai komponen yang sama, bukan variasi baru.
- **Zona waktu**: intraday memakai geseran WIB (+7) karena chart menampilkan epoch sebagai UTC (`intradayWhales.ts`). Pastikan setiap tempat yang menampilkan jam memakai jalur itu, jangan hitung sendiri.

---

## 4. Sapuan konsistensi yang perlu dilakukan sekalian

Saat menyeragamkan, periksa juga pola yang sudah terbukti bermasalah di halaman lain:
1. **Tinggi chart vs panel** (§1) — cek halaman lain yang berpola chart+panel: Neo Papan, Broker Summary v2, Grafik Emiten. Kalau ada pola `align-items: start` + tinggi chart dipatok, cacatnya sama.
2. **Judul menampilkan rentang sebenarnya** — cek semua tabel/panel yang punya preset.
3. **Nol yang sebenarnya "tak ada data"** — temuan `IndeksDunia` (nol hijau) mungkin bukan satu-satunya.

---

## 5. Urutan

1. **Tata letak Whales Papan** (§1) — kecil, keluhan langsung Johan, dan sudah diminta sebelumnya.
2. **Modul rentang bersama** (§2) — buat modulnya dulu, baru migrasikan halaman satu per satu.
3. Migrasi halaman: Neo Papan → Stalker/Inventory/Compare (setelah broker 2016 terbangun, supaya preset panjangnya langsung ada isinya) → Stock Detail & Diary Pasar (penamaan saja).
4. **Sapuan §4** di halaman lain.

Kriteria Terima umum tetap berlaku: uji visual dua viewport + tema terang/gelap, angka dicocokkan ke arsip, dan **default state di-assert** saat halaman pertama dibuka.
