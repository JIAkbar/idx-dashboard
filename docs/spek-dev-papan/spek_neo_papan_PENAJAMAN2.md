# PENAJAMAN SPEK NEO PAPAN — JILID 2 (§3 Inventory · §4 Compare · §5 Activity · §8 Transaction)

> Johan 26 Agu 2026: *"lanjutkan tab berikutnya, pertajam lagi spec nya"*.
> Sama seperti jilid 1: **premis datanya kuukur dulu**, baru speknya ditajamkan. Berlaku di atas `spek_neo_papan_revisi.md` dan `spek_neo_papan_PENAJAMAN.md`. Kalau bertentangan, **yang ini menang** (paling baru + terukur).
> Semua angka di bawah hasil ukur langsung 26 Agu 2026, bukan asumsi.

---

## 📊 Hasil ukur yang mengubah spek

| Yang diukur | Hasil | Dampak |
|---|---|---|
| `broker_tahunan/<KODE>/<TAHUN>.json` | **2020–2025: 236–247 hari/tahun · 2026: 150 hari** | Rentang 1Y/YTD/multi-tahun Inventory **aman**, bukan angan-angan |
| Ruas `asing` di broker_tahunan | **100% — 242/242, 247/247, …, 150/150 di SEMUA tahun & emiten yang diuji** | Filter Foreign/Domestic Inventory **tanpa lubang cakupan** (beda dari Stalker jalur harian) |
| Ruas `nego` di broker_tahunan | **100% juga, 7 tahun** | Kemampuan yang belum dipakai Neo Papan (§X baru) |
| `emiten_sektor.json` | 962/962 bersektor, sumber **IDX GetCompanyProfiles (IDX-IC resmi)**; ruas: `nama, sektor, subsektor, industri, subindustri, papan, tercatat` | Activity bisa **lebih kaya** dari NeoBDM |
| Daftar konstituen LQ45/IDX30/KOMPAS100 | **NIHIL** | Mode "Index" tetap mustahil — dikonfirmasi ulang |

---

## 🔴 PENAJAMAN 4 — Inventory: filter Foreign/Domestic TIDAK punya lubang cakupan (beda dari Stalker)

Di Stalker kita wajib memasang badge `inv N/M` karena jalur `broker_harian` punya hari-hari tanpa varian asing. **Jangan salin pola itu mentah-mentah ke Inventory.**

Terukur: `broker_tahunan` memuat ruas `asing` di **100% hari, semua tahun 2020–2026** (BBCA, BUMI, SIDO — 242/242, 247/247, 246/246, 239/239, 237/237, 236/236, 150/150). Karena Inventory memang membaca jalur tahunan (rentang 2W–1Y), **Domestik = ALL − ASING selalu bisa dihitung penuh**. Jadi:
- **Jangan** tampilkan badge cakupan varian di Inventory kalau sumbernya tahunan — badge yang selalu berkata "60/60" itu bising tanpa informasi.
- **Tetap** pertahankan penjaga kodenya (hari tanpa `asing` → null). Kalau kelak ada emiten/tahun yang ternyata bolong, ia gagal dengan jujur, bukan diam-diam menyamakan dengan ALL.
- **Peluang perbaikan untuk Stalker** (opsional, catat saja): karena jalur tahunan 100% lengkap, preset pendek Stalker dengan filter Asing/Domestik bisa **dialihkan ke jalur tahunan** supaya lubang cakupan hilang sama sekali. Ongkosnya memuat berkas tahunan; timbang sendiri. Jangan dikerjakan sekarang.

**Preset broker NeoBDM — definisi operasional yang harus dipakai** (`TOP_5_NB_LOT_C20` / `TOP_5_NS_LOT_C20`): baca sebagai *Top 5 Net Buy (satuan LOT) dalam 20 hari bursa terakhir* dan kembarannya Net Sell. **Tulis definisi ini di UI** (tooltip chip), jangan biarkan pemakai menebak arti sandi. Sediakan juga varian berbasis **Nilai**, karena toggle Value|Lot memang ada — dan peringkat berdasar lot bisa berbeda jauh dari peringkat berdasar nilai pada saham berharga rendah.

**Rentang**: 2W · 1M · 3M · 6M · YTD · 1Y (terukur aman) **+ multi-tahun sampai 2020** — NeoBDM berhenti di 1Y; kita punya 7 tahun dan ongkosnya cuma memuat berkas tahunan tambahan. Sama seperti Stalker: **picu dengan tombol eksplisit bertaksiran MB** untuk rentang panjang, jangan otomatis.

---

## 🔴 PENAJAMAN 5 — Activity: ganti mode "Index" yang mustahil dengan mode **PAPAN** (kita justru unggul)

Dikonfirmasi ulang: tidak ada deret indeks, tidak ada daftar konstituen. Mode "Index" ala NeoBDM (KOMPAS100/LQ45/IDX30/GOCAP/U100/U200/U500) **mati di sumber**.

Tapi `emiten_sektor.json` memberi sesuatu yang **NeoBDM tidak punya** — klasifikasi IDX-IC resmi berlapis untuk 962/962 emiten:

- **Sektor** (11): Barang Konsumen Non-Primer 163 · Barang Konsumen Primer 133 · Barang Baku 113 · Keuangan 106 · Properti & Real Estat 92 · Energi 91 · Infrastruktur 70 · Perindustrian 66 · Teknologi 47 · Kesehatan 41 · Transportasi & Logistik 40.
- **Subsektor → industri → subindustri**: tiga lapis lebih dalam.
- **Papan** (5): Pengembangan 495 · Utama 271 · **Pemantauan Khusus 154** · Akselerasi 41 · Ekonomi Baru 1.

**Yang harus dibangun:**
1. **Mode Sektor** (11 garis) — samakan metodenya dengan RRG: agregat tertimbang kapitalisasi, bobot hari sebelumnya. Satu metode, bukan dua.
2. **Mode Papan** — pengganti mode Index. Ini bukan tambal sulam: *lonjakan Activity di papan **Pemantauan Khusus*** adalah sinyal risiko nyata (papan itu berisi emiten bermasalah), dan tak satu pun pesaing menampilkannya. 154 emiten cukup besar untuk agregat yang stabil.
3. **Drill-down subsektor** (opsional, setelah 1–2 jalan): klik satu sektor → pecah jadi subsektornya. NeoBDM berhenti di sektor.
4. **Mode Index: HILANGKAN.** Jangan tampilkan tombolnya lalu dikunci — itu menjanjikan sesuatu yang tak pernah datang. Cukup tulis satu baris di Metodologi: *"Indeks bertema (LQ45/IDX30/KOMPAS100) tidak tersedia karena daftar konstituennya tidak dipanen; keanggotaannya berubah tiap rebalance dan menebaknya menghasilkan angka yang salah."*

Definisi **Activity** tetap wajib operasional: *porsi nilai transaksi grup ÷ total nilai transaksi seluruh sampel, rata-rata bergerak N hari* (`porsiBergerak` sudah ada). Cantumkan N di layar.

---

## 🟢 PENAJAMAN 6 — Kemampuan NEGO yang menganggur (bukan di NeoBDM, tapi kita punya)

Terukur: ruas `nego` ada di **100% hari, 7 tahun**, isinya lengkap (`ringkas` dengan `n_beli/n_jual/total_lot/total_nilai/avg/top1_3_5_pct/accdist` + larik `broker`).

Sudah dipakai di `BrokerSummaryV2` (`broker-summary-v2/Nego.tsx`, `Overview.tsx`), `BrokerSummary`, `presetScreener` — **tapi belum di Neo Papan**. NeoBDM sendiri tidak punya tab nego.

**Usul (prioritas rendah, kerjakan setelah §3–§5 dan §8):** tambahkan **overlay nego di Inventory**, bukan tab baru — penanda kecil di tanggal-tanggal bernego besar, dengan tooltip broker pelakunya. Alasannya: nego yang besar sering **mendahului** pergerakan reguler, jadi nilainya justru muncul saat disandingkan dengan kurva inventori, bukan berdiri sendiri. Kalau ternyata `Nego.tsx` sudah menjawab kebutuhan ini di halaman lain, **cukup tautkan** — jangan bangun kedua kalinya. **Cek dulu sebelum membangun.**

---

## 🔴 PENAJAMAN 7 — Transaction Chart: dua cacat yang sudah tertulis di kode kalian sendiri

`TransaksiTab.tsx` komentar baris 7–13 mengaku dua hal: (a) *"candle diganti garis harga tutup — proyek belum punya plugin candlestick Chart.js"*, dan (b) KV kanan hanya dari **hari terakhir yang ada arsipnya**.

1. **Candle**: setelah migrasi ke lightweight-charts (keputusan §10 spek asli), alasan (a) **gugur** — pakai `CandlestickSeries` sungguhan, hapus komentar itu bersama alasannya. Ini menyelesaikan pengakuan kalian sendiri, bukan permintaan baru.
2. **Kategori investor**: NeoBDM memakai Retail/Institution/Zombie — **tidak bisa kita penuhi** dan jangan dipinjam istilahnya. Yang kita punya jujur: **Asing vs Domestik** (dari varian asing broker, 100% cakupan di jalur tahunan) dan **Nego vs Reguler**. Beri nama sendiri yang menggambarkan apa yang benar-benar diukur.
3. **Participation**: rumusnya wajib dijaga tidak melampaui 100%. Ingat pelajaran `top1/3/5_pct` — nilai seperti `top3_pct: 199,99` dan `top5_pct: 200` muncul karena **sisi beli dan jual dihitung dua kali** (maksimum wajar 200%, bukan 100%). Kalau Participation memakai basis yang sama, **tetapkan pembaginya secara eksplisit** dan tulis di Metodologi apakah skalanya 0–100 atau 0–200. Ini sumber salah-baca yang gampang lolos.
4. **`cross_index`**: NeoBDM menggambar garis ini tanpa penjelasan. Kalau maksudnya IHSG dinormalkan ke basis 100 (yang sudah dilakukan `TransaksiTab` sekarang), **beri nama yang jelas** — "IHSG (basis 100)" — jangan meniru istilah kabur orang lain.

---

## §4 Compare Inventory — tak berubah, satu tambahan

Tetap seperti spek asli (dua chart LEFT/RIGHT, brush pakai ulang `seleksiAreaChart.ts`, tabel `CHANGE FROM A %`). Tambahan dari ukur di atas: karena jalur tahunan lengkap, **periode A dan B boleh berbeda tahun** (mis. bandingkan Agustus 2025 vs Agustus 2026). NeoBDM terbatas di rentang pendek; ini keunggulan yang datang gratis.

Satu kehati-hatian: `CHANGE FROM A %` pada basis mendekati nol menghasilkan persentase raksasa (di tangkapan layar NeoBDM ada **+2773,15%**). Batasi tampilannya (mis. tampilkan "—" atau "≫" bila |basis| di bawah ambang) supaya tabel tidak didominasi angka yang benar secara aritmetika tapi tak berarti.

---

## Urutan & Kriteria Terima

Urutan tetap: **Seasonality (jalan) → Inventory → Compare → Activity → Transaction Chart**, nego terakhir (dan hanya bila belum terjawab halaman lain).

Kriteria Terima tambahan khusus jilid ini:
1. **Inventory**: kurva kumulatif satu broker dicocokkan **manual dari `broker_tahunan`** untuk satu rentang; filter Domestik diuji = ALL − ASING pada hari sampel.
2. **Activity**: nilai Activity satu sektor satu tanggal dihitung ulang manual; mode Papan diuji ada 5 kelompok dengan jumlah emiten sesuai (495/271/154/41/1).
3. **Transaction**: Participation diuji **tidak pernah melewati batas skalanya**; kalau memakai basis dua-sisi, tulis 0–200 dan buktikan dengan satu hari sampel.
4. **Compare**: satu baris `CHANGE FROM A %` dihitung ulang manual, termasuk satu kasus basis mendekati nol untuk membuktikan penjaganya bekerja.
