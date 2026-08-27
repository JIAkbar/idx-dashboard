# SPEK — FOOTPRINT HARIAN di Whales Papan (P8) — 27 Agu 2026

> Asal perintah Johan (verbatim, 27 Agu 2026): *"P8 kerjakan footprint harian whales"*.
> Induk: `spek_whales_papan.md` (arsitektur hybrid lightweight-charts + primitive — SUDAH terpasang di `WhalesPapan.tsx`, W1–W4 + intraday jadi). Spek ini menambah **W7: footprint harian** — fitur yang whales.id sendiri tak bisa punya karena arsip publiknya cuma 3 hari; arsip broker kita 2016→.
> Keputusan terkait yang sudah diambil: kategori broker fitur Smart Money = **perilaku terukur** (Johan 27 Agu, AskUserQuestion) — TIDAK dipakai di spek ini (footprint memakai kelompok IDENTITAS yang sudah ada untuk warna), dicatat supaya tak tertukar.

## 1. Apa yang digambar

Mode **Harian** Whales Papan mendapat toggle **Footprint** di toolbar (default MATI — candle biasa tetap bawaan). Saat menyala:

- Tiap hari (kolom candle) dipecah jadi **sel-sel level harga**. Isi sel = broker-broker yang harga rata-rata hariannya jatuh di level itu, beserta lot beli / lot jual mereka.
- Sumber sel: `broker_tahunan/<KODE>/<tahun>.json` → `hari[tgl].broker` = `[[kode, beli_lot, beli_nilai, jual_lot, jual_nilai], …]` (GROSS reguler). Harga penempatan broker: `avg_beli = beli_nilai ÷ (beli_lot × 100)` untuk sisi beli, `avg_jual` untuk sisi jual — **satu broker boleh muncul di dua sel berbeda** (avg beli ≠ avg jual).
- **Binning**: rentang low–high hari itu (dari candle) dibagi maksimal **12 bin**; kalau rentang ≤ 12 tick bursa, bin = tick asli (`keFraksi`/tabel fraksi yang sudah ada). Broker di-bin berdasarkan avg-nya; avg di luar low–high (bisa terjadi karena pembulatan) dijepit ke bin tepi.
- **Render sel**: bar horizontal dua arah di dalam kolom hari — kiri (beli) dan kanan (jual), panjang ∝ lot, **warna = kelompok identitas broker dominan** di sisi itu (`warnaBrokerCanvas`, 6 kelompok yang ada). Angka total lot per sel dicetak bila lebar kolom ≥ 48 px (zoom cukup); di bawah itu hanya bar.
- **Tooltip sel** (hover / tap): tanggal, level harga, daftar broker terbesar di sel (maks 8 + "+n lagi"): kode ber-warna kelompok, lot beli, lot jual, nilai.
- Footprint menyala ⇒ candle tetap digambar (tipis/di belakang) supaya konteks OHLC tidak hilang.

## 2. Yang TIDAK boleh diklaim (batas jujur — tambah ke kotak Metodologi §7 spek induk)

- Ini **hampiran**: posisi broker = **harga rata-rata hariannya**, bukan sebaran transaksi nyata per level. Tulis persis: *"Footprint harian menempatkan tiap broker di harga rata-rata belinya/jualnya hari itu — bukan rincian transaksi per level harga."*
- Tidak ada HAKA/HAKI (sisi agresor) — jangan pakai istilah itu.
- Hanya papan REGULER (varian yang dibaca halaman ini); nego/tunai tidak ikut.
- Hanya mode Harian. Di mode intraday toggle disembunyikan (bukan disabled tanpa penjelasan).

## 3. Implementasi

- **Primitive baru** `lib/dasbor/footprintHarian.ts` mengikuti pola primitive yang sudah ada (`profilHargaChart.ts` adalah contoh terdekat — sama-sama menggambar bar berbasis data broker di `useBitmapCoordinateSpace`). JANGAN kanvas terpisah.
- Fungsi data murni `binFootprint(hariBroker, low, high, tickFn)` → `SelFootprint[]` dipisah dari penggambaran dan **diuji unit** (vitest): kasus rentang sempit (=tick), rentang lebar (12 bin), avg di luar rentang (terjepit), broker dua sel.
- Toggle ikut pola toolbar Whales Papan yang ada (komponen kanonis #170 — `TombolIkon`/chip yang sudah dipakai halaman itu, jangan kelas baru).
- Kinerja: gambar hanya bar yang terlihat di viewport waktu (`timeScale().getVisibleLogicalRange()`), sel di luar dilewati. Trace saat pan/zoom dengan footprint menyala: ≥55 fps.

## 4. Kriteria Terima (di atas 6 butir baku `pengantar_pembagian_kerja.md`)

1. Angka satu sel dicocokkan MANUAL: satu emiten × satu tanggal × satu level — jumlah lot sel harus sama dengan penjumlahan ulang dari `broker_tahunan/<KODE>/<tahun>.json` (lampirkan angkanya di laporan).
2. Toggle default MATI; menyala → sel tampil; ganti emiten → footprint ikut data baru; mode intraday → toggle hilang.
3. Tooltip diklik/hover nyata via chrome-devtools; isi cocok data.
4. Dua viewport (1536×960×1.25 & 412×915×2.625) × tema terang/gelap — sel terbaca, tak menimpa sumbu.
5. Leak pass: nol nama endpoint/berkas internal di layar.
