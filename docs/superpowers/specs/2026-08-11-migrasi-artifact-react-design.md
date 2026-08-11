# Spec — Migrasi Artifact "Lantai Bursa" (Opsi A) ke Kode React

> Disusun 11 Agustus 2026. Menutup baris #20 papan pekerjaan
> (`docs/RENCANA-REFACTOR-REACT.md`) yang berhenti di "MENUNGGU PILIHAN USER: A, B, atau C".
> Keputusan user: **Opsi A "Lantai Bursa", reskin penuh 10 halaman**.

## 1. Ruang lingkup

Ini **bukan** migrasi struktur. Dasbor React sudah lengkap: 10 view + shell
(`DasborLayout`, `Sidebar`, `MobileNav`, `dasbor.css`) selesai di Fase 5. Yang dikerjakan
spec ini adalah penggantian identitas visual dari Opsi C-lama (teal dipoles) ke
"Lantai Bursa" — ink-navy + amber terminal — plus sejumlah perbaikan bug dan
peningkatan interaksi yang diminta user saat meninjau tiap halaman.

### Sumber kebenaran visual

`C:\Users\Johan\AppData\Local\Temp\claude\C--1-Johan-10--Pengembangan-IDX-Statistik\87745b66-a313-4511-b41e-52c6f15a44f0\scratchpad\lantai-bursa-reimagined.html`
— 1.157 baris / 72 KB. CSS baris 4–341, markup 342–778, skrip 779–1157.

Berkas ini **wajib disalin byte-per-byte** untuk lapisan token dan primitif
(`kemampuan-workflow.md` §169). Dilarang "menulis ulang dari pemahaman mockup".
Karena berkasnya ada secara lokal, tidak ada alasan untuk mengarang ulang.

Berkas sumber **sudah diarsipkan ke repo** di `docs/design-lantai-bursa-reimagined.html`
(commit `c8930f2`), supaya sesi berikutnya tidak bergantung pada folder sementara yang bisa
dibersihkan sistem. Rujuk arsip itu, bukan folder sementara.

### Aturan beku (ditetapkan user, 11 Agustus 2026)

> Struktur blok, judul, urutan, dan isi kolom tiap view **BEKU**. Reskin hanya boleh
> mengganti token warna dan primitif tampilan. Menambah, menghapus, atau menggabung blok
> hanya atas perintah eksplisit user.

Kutipan asal: *"top leader jangan diubah2 seenaknya sendiri kecuali ada perintah dari saya"*.

Konsekuensi penting: di artifact, sembilan dari sepuluh view hanya 17–61 baris — itu sketsa,
bukan tata letak penuh. Hanya `view-ind` (129 baris) yang lengkap. Karena itu:

| Aspek | Sumbernya |
|---|---|
| Warna, tipografi, radius, bayangan, primitif (`.panel .tbl .tabs .chip .bar-row`) | artifact |
| Blok apa saja, judulnya, urutannya, isi kolomnya | kode React yang sudah jalan |

## 2. Arsitektur berkas

```
app/src/dasbor/lantai.css   ← BARU. Isi baris 4–341 artifact, disalin verbatim.
                               Seluruh aturan (kecuali blok :root) dibungkus .lantai { … }
app/src/dasbor/dasbor.css   ← tetap hidup, dihapus pada commit terakhir
docs/design-lantai-bursa-reimagined.html ← arsip sumber (commit c8930f2)
```

Alasan pembungkus: `dasbor.css` dan CSS artifact punya **13 nama class bentrok** —
`.panel .up .dn .r .today .open .sep .bchip .cal-grid .rk1 .rk2 .rk3 .board-tbl-wrap`.
Tanpa pagar, halaman yang belum diport ikut rusak begitu berkas baru dimuat.
View yang sudah diport dibungkus `<div className="lantai">`; yang belum, tetap gaya lama.
Tidak ada commit big-bang.

Blok `:root` (token, baris 6–48) **tidak** dibungkus — sifatnya global. `ThemeContext`
yang sudah ada menulis `data-theme` di elemen `<html>`, persis yang dibaca artifact pada
baris 31–48, jadi tema tersambung tanpa kode baru.

Skrip vanilla artifact (pita berjalan, papan flap, kanvas) menjadi komponen React.
`PitaKurs.tsx` yang sudah ada dipakai ulang, bukan dibuat baru.

## 3. Shell

| Bagian | Sekarang | Menjadi |
|---|---|---|
| Navigasi lebar | Sidebar teks | Rail 76px: logo, ikon + kode ticker per menu, garis kiri amber saat aktif |
| Navigasi telepon | Bilah bawah 5 dari 10 menu | Bilah bawah 5 + tombol MENU ke-6 membuka laci berisi 10 menu penuh |
| Tombol tema | — | Kaki rail (`.rail-foot`); di telepon ikut ke dalam laci |
| Panji hijau ~150px | Berulang di 10 halaman | **Dibubarkan** — lihat §4.11 |
| Pita kurs | — | Bilah berjalan 44px menggantikan posisi panji |

## 4. Per halaman

Nomor mengikuti urutan kerja di §5.

### 4.1 Indeks Dunia — percontohan

Blok tetap seperti sekarang. Yang berubah:

- Angka IHSG jadi papan split-flap (`.flap`, artifact baris 121–129).
- Peringkat YTD 35 negara: sudah berupa daftar batang mendatar (`.rk-row`) — dipertahankan,
  hanya ganti token.
- **Perbaikan bug:** YTD IHSG di kepala selalu `+0,00%`. Akar: `index_live.html:2725`
  membaca `D.ihsg_ytd ?? 0`, ruas yang tidak pernah ada di `ds_*.json`. Perbaikan:
  hitung dari `index.json` (93 tanggal, sudah dimuat `useDataHarian`) —
  `ihsg_sekarang / ihsg_tanggal_pertama − 1`. Nol permintaan jaringan tambahan.

### 4.2 Top Stocks

Enam blok yang ada di `TopStocks.tsx` dipertahankan persis: Top 10 Market Capitalization
(:56), Top Gainers (:80), Top Losers (:96), Top Leaders Kontribusi (:115), Top Leaders YTD
(:121), Top Laggards Kontribusi (:128), Top Laggards YTD (:134).

- Top 10 Market Cap pakai pola `.mc-row` artifact (peringkat berlingkaran, batang, nilai, persen).
- Gainers/Losers tetap dua tabel sebaris.
- Kalender ikut hadir di halaman ini seperti sekarang — lihat §4.12.

### 4.3 Top Broker

Enam tabel dipertahankan: Top Stock Trading by Volume/Value/Frequency (`TopBroker.tsx:56`)
dan Top Broker by Volume/Value/Frequency (:84, :91, :98).

**Tambahan interaksi (disetujui user):** klik judul kolom untuk mengurutkan. Satu helper
`useUrut` (±15 baris) dipakai bersama oleh 6 tabel halaman ini dan 6 tabel Top Stocks.
Nol dependensi baru.

Tidak dikerjakan tanpa perintah tambahan: kolom Δ peringkat vs hari bursa sebelumnya
(butuh muat satu `ds_*.json` tambahan + aturan tanggal bolong); pencarian/saring/paginasi
(tiap tabel hanya 10 baris).

### 4.4 Sektor & Indeks

- **Chart sektor: kanvas dibuang, diganti daftar batang mendatar** `.rk-row`. Alasan:
  11 nama sektor panjang diputar ~60° sampai bertumpuk — kegagalan yang sama persis dengan
  Peringkat YTD (papan #23) yang sudah dipecahkan dengan cara ini. Untung ikutan: teks ikut
  token tema otomatis, bisa disalin, terbaca pembaca layar, dan satu blok Chart.js hilang.
- Chart "YTD — Perbandingan Semua Indeks Utama" kena perlakuan sama.
- **Periode: Hari Ini · 1 Bulan · 3 Bulan · YTD** memakai `.tabs`. `d` dan `ytd` sudah ada
  di berkas harian; 1B/3B dihitung `v_sekarang / v_tanggal_pembanding − 1` = **satu fetch
  tambahan**, bukan 93. Tidak ada perubahan pipeline Python.
  Ruas `sectors:[{n,v,d,ytd}]` terverifikasi ada di seluruh 93 berkas harian.
- Indeks Unggulan / Syariah / Board Indices: struktur beku, gaya jadi `.tbl` + lencana
  `.ytd-bdg` (lebar dikunci `min-width:62px` supaya kolom persen rata).

**Belum diputuskan:** apakah pemilih periode 1B/3B juga berlaku untuk tabel indeks, atau
tabel sektor saja.

### 4.5 Chart

- **Perbaikan bug:** `ChartIndeks.tsx:102` — `colorTheme: 'dark'` hardcode pada heatmap,
  sementara chart utama memakai `theme` dari `useTheme()` (:170). Di tema terang heatmap
  tetap hitam.
- **Expand pakai Fullscreen API bawaan.** Sekarang expand = class `.tv-fullscreen` +
  gaya sebaris + penangkap ESC (:65–73) + tinggi khusus telepon (:123–135, `mobileFsHeight`),
  ±40 baris yang menirukan perilaku peramban. `el.requestFullscreen()` menggantikan semuanya.
  Diff-nya minus.
- Dua baris tombol dibedakan derajatnya: baris Featured/Co-Branding/Syariah jadi `.tabs`;
  baris IHSG/LQ45/IDX30/… jadi pil kecil `.bchip` bergaris tepi. Tombol Expand pindah ke
  kanan `.panel-h`, sebaris judul panel.
- Heatmap tetap embed TradingView.

### 4.6 Stock Detail — perhatian khusus

**(a) Valuasi dipisah jadi tab, bukan modal.**

```
/stock-detail/:ticker?tab=statistik   Current Valuation, Per Share, Solvency, IS/BS/CF, Profitabilitas
/stock-detail/:ticker?tab=valuasi     Graham, NCAV, Relative, DDM, Tren Historis
```

Modal ditolak karena isi valuasi tinggi dan punya isian yang disimulasikan pengguna
(EPS, growth, risk-free, required return) — modal berarti gulir di dalam kotak gulir, dan
hasil simulasi hilang saat ditutup. Tab `.tabs` + `?tab=` pada router yang sudah ada
membuatnya bisa dibagikan tautannya dan kembali ke tab yang sama saat dimuat ulang.
Isi tiap blok tetap beku; hanya dipisah ke dua tab.

**(b) Data Yahoo Finance — empat perbaikan, urut dampak.**

1. **Mata uang tercampur — akar rusaknya rasio.** `data/fundamental/AADI.json` nyata:
   `pe = 5,61` (wajar) tapi `pb = 20.683,855`. AADI melaporkan keuangan dalam **USD**,
   harganya **IDR**: `9.225 IDR ÷ 0,446 USD = 20.683`. `fetch_fundamental.py:511` hanya
   membaca `currency` (mata uang HARGA) dan **tidak pernah membaca `financialCurrency`**.
   Semua emiten pelapor-USD menghasilkan PB/PS/EV/BV rusak. Perbaikan: baca
   `financialCurrency`; bila berbeda, konversi memakai `usd_idr` yang **sudah dipanen
   harian** di `ds_*.json`. Tidak ada sumber baru.
2. **Berhenti menelan galat.** `fetch_fundamental.py:287-290` —
   `except Exception: hist, pp = None, {}`. Tanpa pesan, tanpa hitungan; alur tetap melapor
   berhasil. Akibatnya `price_perf` kosong di **957 dari 957** berkas selama dua bulan tanpa
   ada yang tahu. Perbaikan: catat sebab, hitung kegagalan, **gagalkan langkah bila >5%
   saham gagal**. Semua perbaikan lain bergantung pada kegagalan yang berisik.
3. **Kunci versi yfinance.** `.github/workflows/update-fundamental.yml:41` memasang
   `pip install yfinance` tanpa versi, dan `requirements.txt` bahkan tidak menyebut yfinance.
   Tiap jalan bulanan menarik versi terbaru sementara Yahoo berkali mengubah crumb/cookie.
   Pin versinya, naikkan dengan sengaja.
4. **Bila ternyata IP GitHub Actions yang diblokir** (gejala: 401/429 beruntun, bukan galat
   per-saham): pindahkan jalannya ke komputer user. Data ini bulanan; sekali sebulan satu
   perintah lalu commit. Alur harian IDX tidak terpengaruh — ia tidak menyentuh Yahoo.
   Tambahan: mode lanjutan-sebagian (simpan daftar saham gagal, jalan berikutnya hanya
   mengambil yang gagal/basi) supaya batas laju di tengah jalan tidak memaksa ulang dari nol.

Urutan wajib: 2 dan 3 lebih dulu, baru 1, baru 4. Menyambungkan sumber sebelum kegagalan
terlihat hanya memindahkan kegagalan (alasan yang sama membuat papan #21 ditunda).

### 4.7 Peta Investor

- **Simpul & label.** Belah ketupat runcing diganti simpul bundar bersudut lembut. Label
  hanya untuk N terbesar; sisanya muncul saat diarahkan/disentuh. Grafik yang melabeli semua
  simpul selalu berakhir tak terbaca — itu bukan soal ukuran font.
- **Palet.** Sekarang oranye/biru/ungu/hijau/merah jenuh di satu kanvas. Ganti ke satu warna
  aksen (amber) untuk emiten, sisanya derajat abu-biru dari `--text2/--text3/--line2`.
  Token boleh diambil dari skill `graphify`. **Hijau/merah tetap khusus arah angka** —
  dilarang jadi warna kategori simpul.
- **Tabel By Stock / By Investor.** Sumber ketidakrapian: kolom pemegang saham memuat pil
  sebanyak-banyaknya sehingga tinggi baris berbeda-beda tiap emiten. Perbaikan: batasi
  **3 pil + "+N lagi"**, tinggi baris terkunci, pil memakai `.bchip`.
- Kolom CORP%/IND%/OTH% yang berisi "—" untuk semua baris: datanya memang kosong. Tulis
  sebabnya, jangan biarkan strip tanpa keterangan.

### 4.8 Broker Summary (Alpha)

`brokerSummaryData.ts:3-4` mengakui sendiri: data asli hanya tersedia 3 hari
(2026-06-02..04), 412 baris angka tertanam di berkas, nol jaringan. Tanggal di halaman
tidak pernah berubah.

Sumber yang ada tidak cukup: PDF harian IDX (`parse_idx_pdf.py:151`) hanya memuat **top-10
broker**, sementara halaman ini butuh **88 broker + NEGO + foreign net**.

1. **Verifikasi lebih dulu** apakah IDX menyediakan endpoint ringkasan broker harian
   satu keluarga dengan `TradingSummary` yang sudah dipakai. **Ini dugaan yang harus diuji,
   belum fakta.** Ujinya murah: `download_idx.py` sudah memakai Playwright dengan header
   yang lolos ke idx.co.id.
2. Bila tidak ada: halaman tetap Alpha dengan data 3 hari, dan **tuliskan itu di layar**
   ("data contoh 2–4 Juni 2026, tidak diperbarui"), bukan tanggal yang tampak hidup.
3. Sumber vendor berbayar: di luar cakupan, dicatat sebagai kemungkinan.

Langkah 1 dikerjakan **sebelum** halaman ini direskin — percuma mempercantik halaman yang
bentuknya bisa berubah begitu data 88 broker harian didapat.

### 4.9 Kalkulator JIA

Masalah terukur pada tampilan sekarang: empat tombol sub-menu selebar halaman (±230px
masing-masing) untuk label satu-dua kata; isian dan hasil dalam satu kolom sempit di tengah
layar 1.500px; baris Fee melayang di luar panel mana pun.

- Sub-menu jadi `.tabs` kecil di kiri atas. Lebar ikut isi, tinggi seragam
  (`kemampuan-web-dev.md` §177: tinggi wajib sama, lebar justru jangan diseragamkan).
- Tata letak `grid2 w-kiri`: kiri isian, kanan **ringkasan hasil menempel** (`position:sticky`)
  sehingga tiap perubahan angka langsung terlihat akibatnya tanpa menggulir.
- Fee Beli/Fee Jual masuk ke `.panel-h` sebagai dua isian kecil — fee itu pengaturan,
  bukan langkah pertama menghitung.
- Daftar 5 strategi Average Down: dari baris radio setinggi ±70px menjadi kelompok pil.
  Keterangan satu baris tetap.
- **Rumus dan isian tidak disentuh** — 4 formula sudah diverifikasi manual (papan #3).

### 4.10 Kritik & Saran

Reskin murni. Blok `.rate` (tombol nilai) dan tautan WhatsApp tetap.

### 4.11 Changelog — kembali, tapi admin saja

Membalik keputusan papan #8 ("hapus menu Changelog, pindah ke docs statis"). Pembalikan
sadar atas permintaan user: *"changelog hanya bisa di akses admin saja"*.

```
/admin/changelog   ← di dalam ProtectedRoute yang sudah ada, sejajar /admin/upload
```

Rail publik tetap 10 menu. Satu sumber kebenaran: `docs/CHANGELOG.md`, dibaca lewat impor
mentah Vite (`?raw`) — **tidak disalin isinya ke TSX**, karena dua salinan akan berbeda
dalam tiga bulan (alasan yang sama membuat popup "What's New" dulu dibuang). Penyaji ±15
baris (`##` jadi judul, `-` jadi butir); tanpa pustaka markdown.

Lencana versi berwarna acak diganti kategori Keep a Changelog (`Added` `Changed` `Fixed`
`Removed`) supaya warnanya punya arti.

### 4.12 Header & kalender (lintas halaman)

**Panji hijau dibubarkan**, bukan diwarnai ulang. Isinya dipindah ke tempat yang sesuai:

| Isi sekarang | Pindah ke |
|---|---|
| "IDX Market Intelligence / BY JIA" | logo kepala rail (artifact baris 348) |
| Tanggal + hari perdagangan ke-N | baris `.lbl` di atas papan |
| IHSG + perubahan + YTD | papan split-flap `.flap` |
| ASEAN #6 · Asia Pasifik #13 · Dunia #35 | `.chip` di samping papan |
| Atribusi sumber & pembuat | kaki halaman, satu baris kecil |

Penggantinya di atas layar: pita kurs berjalan 44px. Untung nyata di telepon — panji lama
memakan sepertiga layar pertama sebelum satu angka pun terbaca.

**Kalender** hadir di 4 view (Indeks Dunia, Top Stocks, Top Broker, Sektor) lewat
`Kalender.tsx` (292 baris), sementara Broker Summary memakai `BsDatePicker.tsx` (131 baris)
— dua implementasi berdampingan. Disatukan lewat shim tipis re-export
(`kemampuan-web-dev.md` §168), bukan mengedit semua pemanggil.

**Belum diputuskan (perlu jawaban user sebelum dikerjakan):**

1. Kalender tetap panel terbuka, atau jadi dropdown? Panel sekarang memakan ±500px tinggi
   di atas tabel; dropdown menaikkan tabel ke layar pertama.
2. Pilih rentang tanggal **bukan pekerjaan UI saja**. `dataHarian` memuat satu berkas per
   tanggal (`ds_YYYYMMDD.json`). Rentang berarti banyak berkas **plus aturan agregasi baru
   per menu**: Top Stocks se-rentang dijumlah, dirata-rata, atau diambil hari terakhir?
   Tanpa jawaban ini, rentang tidak bisa diimplementasikan tanpa mengarang.

Blok "Sesi Bursa IDX (WIB)" tetap; padanannya sudah ada di artifact (`.sesi`).

## 5. Urutan kerja

Satu halaman satu commit (`kemampuan-workflow.md` §170, §174):

```
 1  Fondasi      lantai.css + arsip sumber + rail + pita + laci + bilah bawah
 2  Percontohan  Indeks Dunia (papan flap, kanvas YTD, kalender, peringkat, kontribusi,
                 kapitalisasi) + perbaikan YTD +0,00%
 3  Kritik & Saran
 4  Kalkulator JIA
 5  Top Stocks
 6  Top Broker (+ helper useUrut)
 7  Sektor & Indeks
 8  Chart (+ perbaikan tema heatmap, Fullscreen API)
 9  Broker Summary  — didahului verifikasi sumber data (§4.8 langkah 1)
10  Stock Detail    — didahului perbaikan Yahoo (§4.6b langkah 2 & 3)
11  Peta Investor   — paling akhir, D3 dengan payload 590 KB
12  Changelog admin
13  Hapus dasbor.css, buang pembungkus .lantai
```

Mudah menuju berisiko — pola yang sama terbukti jalan pada Fase 5.

Perbaikan pipeline Python (§4.6b) berdiri sendiri di luar urutan ini dan boleh dikerjakan
kapan saja sebelum langkah 10.

## 6. Verifikasi

Gerbang wajib tiap commit. Klaim "selesai" tanpa bukti di bawah ini tidak dihitung selesai.

```bash
npm --prefix app run build
```

Bukan `tsc --noEmit`: root `tsconfig.json` memakai `references`, sehingga perintah compiler
generik bisa memeriksa nol berkas (`kemampuan-web-dev.md` §173).

Tampilan diverifikasi pada **2 viewport** — proyek ini menimpa aturan global tiga layar,
lihat `memory/viewport-2-layar-saja.md`. Dua tab chrome-devtools, ukuran dikunci `emulate`
(bukan `resize_page`):

| Tab | emulate |
|---|---|
| laptop | `1536x960x1.25` |
| telepon | `412x915x2.625,mobile,touch` — batas lipatan nyata **810px** |

Tiap halaman, **dua tema**:

- `scrollWidth == clientWidth` (nol gulir mendatar)
- console bersih
- kanvas: penjaga lebar `<2px` sebelum menggambar, ditaruh sekali di pembungkus kanvas
  (papan #26), bukan ditambal per grafik
- angka finansial: warna merah/hijau kondisional, tidak pernah hardcode (bug papan #2 lolos
  justru karena hardcode)

Tidak dibuat: unit test untuk reskin — medannya CSS dan tata letak, gerbangnya verifikasi
visual. `skor.paritas.test.ts` tidak disentuh. Perbaikan bermuatan logika (konversi mata
uang §4.6b, hitung YTD §4.1, `useUrut` §4.3) masing-masing meninggalkan satu pemeriksaan
runnable kecil.

## 7. Pembagian model

| Tahap | Model | Alasan |
|---|---|---|
| 1 fondasi, 2 percontohan | Opus | banyak keputusan kecil belum tertulis di spec |
| 3–13 | Sonnet, satu halaman satu sesi | volume berpola |
| review hasil delegasi | Opus | |

Prompt tiap sesi Sonnet **wajib** memuat dua rujukan: seksi artifact (`file:baris`) dan
hash commit percontohan. Tanpa keduanya, model akan menulis ulang dari pemahamannya sendiri
— kegagalan 125 chart di §169.

## 8. Belum diputuskan

1. Pemilih periode 1B/3B: tabel sektor saja, atau ikut tabel indeks? (§4.4)
2. Kalender: panel tetap atau dropdown? (§4.12)
3. Rentang tanggal: aturan agregasi per menu — dijumlah, dirata-rata, atau hari terakhir?
   (§4.12) Tanpa jawaban, fitur ini tidak dikerjakan.
4. Kolom Δ peringkat vs hari bursa sebelumnya di Top Broker/Top Stocks (§4.3) — ditawarkan,
   belum disetujui.

## 9. Temuan yang dicatat spec ini

Ditemukan saat menyiapkan spec, semuanya terverifikasi di kode/data:

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| A | YTD IHSG selalu +0,00% — ruas `ihsg_ytd` tidak pernah ada | `index_live.html:2725` | diperbaiki di langkah 2 |
| B | PB/PS/EV/BV rusak untuk emiten pelapor USD | `fetch_fundamental.py:511` | §4.6b-1 |
| C | `price_perf` kosong 957/957 karena galat ditelan | `fetch_fundamental.py:287-290` | §4.6b-2 |
| D | yfinance dipasang tanpa versi | `update-fundamental.yml:41` | §4.6b-3 |
| E | Heatmap terkunci tema gelap | `ChartIndeks.tsx:102` | langkah 8 |
| F | Broker Summary memakai data tertanam 3 hari | `brokerSummaryData.ts:3-4` | §4.8 |
| G | Dua implementasi kalender berdampingan | `Kalender.tsx`, `BsDatePicker.tsx` | §4.12 |

Temuan lama yang masih terbuka dan **tidak** ditangani spec ini: papan #17 (data harian IDX
beku sejak 5 Juni 2026) dan #19 (`investor_map.json` tanpa alur pembaruan). Keduanya soal
pipeline data, bukan tampilan.
