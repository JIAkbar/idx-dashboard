<!-- Hasil adu lima rancangan + pembantahnya, 18-19 Agu 2026. Disimpan dari
     keluaran workflow yang kalau tidak akan hilang bersama berkas sementara.
     Ini DOKUMEN KEPUTUSAN, bukan catatan: bagian yang sudah dikerjakan ditandai
     di ringkasan sesi, sisanya jadi antrean. -->

# Kartu Ringkas PAPAN — Dokumen Keputusan

*18 Agustus 2026 · hasil adu lima rancangan + pembantahnya, diperiksa ulang terhadap kode dan berkas yang ada.*

---

## Ringkasan eksekutif

Kartu compact dibangun sebagai **wajah kedua dari komponen kartu yang sudah ada**, bukan komponen baru. Yang paling mendesak bukan tata letaknya, melainkan tiga cacat yang **sudah tayang hari ini**: layar menulis "penutupan di bawah 1.080" padahal rumusnya menguji *low* intraday; kolom `Harapan` menghitung 67% skenario sebagai imbal 0%; dan `n=1.217` itu jendela tumpang tindih yang melebihkan bukti ±20×. Ketiganya diperbaiki lebih dulu — nol jaringan, nol risiko, dan berlaku juga untuk kartu detail yang sudah ada. Kartu ringkas v1 **tanpa ingatan**: potret harian bertanggal, tanpa penanda HIT, tanpa kartu dipatok. Fitur "kartu hidup 7 hari" adalah pertanyaan produk, bukan pertanyaan teknis — dan jawabannya harus dari Johan. Angka: 100% otomatis dari OHLC; kontributor tak pernah menyentuh angka.

---

## Keputusan per pertanyaan Johan

### 1. RINGKAS — apa yang bertahan, apa yang dibuang

**Putusan: satu komponen dua wajah.** `KartuSatuEmiten` di `app/src/views/dasbor/KartuAnalisa.tsx` diberi muka ringkas di atas, enam blok yang sekarang berjajar dilipat jadi **tiga** `<details>`. Bukan komponen `KartuRingkas` terpisah — dua komponen yang menampilkan angka sama akan menyimpang dalam sebulan tanpa satu galat pun.

Muka ringkas, maksimum 6 baris:

1. `ARCI · 1.320 · +7,76% · data 18 Agu` — tanggal data selalu tercetak, tak pernah kata "hari ini".
2. Posisi: `+15,5% di atas MA20 · di bawah MA200 · RSI 69 · StochRSI 66/64`.
3. Dua level dengan sentuhannya: `S1 1.080 · 5× | R1 1.660 · 4×`.
4. **Peringatan ATR bila `stop_pct < atr_pct`** — bukan opsional, lihat butir "cacat" di bawah.
5. Karakter: `ER persentil 77 dari 911 · Rp36 mrd/hari`.
6. Asing: `net 20h −41,0 juta lembar` — kata "lembar" dicetak penuh.

Tiga `<details>`: (a) Skenario lengkap; (b) Aliran asing & musiman; (c) Fundamental, blok "Asal", tesis.

**Lima hal haram disembunyikan** (kalau tak muat, angkanya yang dibuang, bukan pendampingnya): `n` pada tiap angka peluang · satuan "lembar" · tanggal data · baris "tak terjadi keduanya" · penyebut persentil ("dari 911").

**Yang dikorbankan:** MA50, S2/S3, R2/R3, seluruh blok musiman di muka, enam rasio fundamental, tesis tiga paragraf. Semuanya satu ketukan jauhnya, tak ada yang hilang dari berkas.

**Dua koreksi yang berlaku juga untuk kartu detail sekarang:**

- **Kolom `Harapan` dibuang dari layar** (tetap di JSON). Rumusnya `(kena/n)·naik − (stop/n)·turun` memberi imbal **tepat 0%** kepada 815 dari 1.217 jalur ARCI yang tak menyentuh apa pun. Itu bukan nilai harapan; itu penjumlahan parsial berlabel harapan, dan tandanya bisa terbalik. Pada ARCI T3 nilainya −0,67 — satu angka negatif tunggal di kartu ponsel terbaca sebagai vonis. *(Dituntut dibuang oleh empat dari lima pembantah.)*
- **`n` dicetak dua angka**: `n = 1.217 hari mulai (≈61 jendela bebas)`. Jendela 20 hari yang dimulai tiap hari beririsan 19/20; `n_efektif = n ÷ horizon`. Satu pembagian di `kartu_analisa.py`, satu ruas baru di JSON. Tanpa ini, perangkat kejujuran utama kartu justru jadi angka paling melebih-lebihkan di layar.

### 2. UMUR DATA — dihitung ulang atau dibekukan

**Putusan v1: dihitung ulang tiap hari, tanpa ingatan, tanpa penanda HIT.**

Kartu = potret bertanggal. Penanda basi berjenjang menurut **hari bursa** sejak `dihitung` — dan ini murni kebasian DATA (panen gagal), bukan umur rencana:

| Umur | Perlakuan |
|---|---|
| 0 hb | normal |
| 1–4 hb | chip abu `data 3 hari bursa lalu` |
| ≥5 hb | chip merah + ruas momentum (RSI, StochRSI, ER, asing 5h) diredam ke `--text3` dengan keterangan "dihitung 14 Agu, belum diperbarui" |

Level tetap terang saat momentum diredam: level memang bergerak lambat, momentum yang basi itu yang berbohong.

**Kenapa tidak dibekukan-lalu-dilacak di v1** — walau itu yang membuat kartu acuan DMAS hidup 7 hari:

- Deret OHLC kita **sudah disesuaikan aksi korporasi** (BBCA 1 Sep 2021 tercatat 6.565 vs harga pra-pemecahan ~35.000), level beku disimpan nominal. Satu split 1:5 antara tanggal patok dan hari ini membuat level tak terjangkau selamanya, atau langsung "HIT" pada hari penyesuaian. Kartunya tetap terender rapi.
- Tiga target = tiga lomba first-passage **serentak dengan stop yang sama**. Jalur yang kena T1 hari ke-3 lalu stop hari ke-10 adalah "kena" untuk T1 dan "stop" untuk T2/T3. Tak satu pun rancangan punya skema status yang bisa mewakili itu; semuanya menaruh satu `status` per kartu.
- Peluangnya beku, jaraknya tidak. Harga naik ke 1.500 → target beku tinggal +10,7% jauhnya, tapi kartu tetap memampang 18,3% yang dihitung untuk +25,8%.
- Kalibrasi yang dijanjikan sebagai imbalan **tidak sah**: `first_passage()` dihitung dari *setiap* hari historis tanpa syarat, sedangkan arsip beku hanya berisi hari-hari yang lolos saringan terbit. Membandingkan frekuensi tersaring dengan ramalan tak tersaring mengukur saringannya, bukan metodenya.

**Kalau nanti dipatok (lihat Keputusan Johan A), lima aturan HIT ini mengikat** — semuanya sudah diverifikasi cocok dengan `first_passage()` di `scripts/riset/kartu_analisa.py:205`:

1. Pelacakan mulai **hari patok + 1** (fungsi itu beriterasi `t+1`).
2. Sentuh dari `high >= target` / batal dari `low <= stop` — **bukan penutupan**.
3. Keduanya di hari sama → **pembatal** (urutan cek `kena_bawah` sebelum `kena_atas`, baris 224).
4. Ditulis "tersentuh intraday 25 Agu", **tak pernah jam** — kita tak punya lilin intraday. Acuan menulis "14.45"; kita tidak.
5. Lompatan `|c[j]/c[j−1] − 1| > 25%` → tahan klaim, tandai perlu ditinjau.

**Dilarang permanen:** "SL sudah pindah ke entry (risk-free)" dan persen keuntungan "+10,8%". Keduanya klaim tentang posisi yang terisi; PAPAN tak tahu apa pun soal eksekusi siapa pun.

### 3. BANYAK SAHAM — bentuk dan cara memilih

**Putusan: tabel, urut abjad, tanpa kolom peluang.**

- `/kartu` bawaannya **tabel semua emiten yang lolos ambang**, urutan **abjad**. Kartu ringkas hanya muncul saat hasil saringan ≤ **12** — pakai `BATAS_TAMPIL_SEMUA` yang sudah ada di `KartuAnalisa.tsx:18`, jangan tambah konstanta kedua.
- **Kolom `p_kena`/`harapan` TIDAK ADA di tabel 900 baris, dan tidak bisa diurut.** Ini keputusan paling keras di dokumen ini. Alasannya terukur, bukan kehati-hatian: `p_kena` adalah fungsi **geometri jarak**, bukan kualitas emiten. BUMI target terdekat `p_kena 62,42%` semata karena R1 cuma +5,43% sementara pembatalnya −14,67%. Satu ketukan pada kepala kolom itu menghasilkan peringkat 900 emiten menurut "resistensi terdekat + volatilitas tinggi" — daftar gorengan berlencana statistik. Larangan panel "Top 10" jadi tak berarti kalau kolomnya bisa diurut; jadi kolomnya yang tidak ada.
- Kolom yang ada: Kode · Harga · %chg · vs MA20 · jarak ke S1 & R1 (dalam % **dan** ATR) · ER persentil · likuiditas median20 · tanggal data. Pakai `.th-sort` + `useUrut.ts` yang sudah ada.
- Saringan berupa **kalimat kondisi + jumlah yang lolos**: `Likuiditas ≥ Rp1 mrd/hari · 318` · `Riwayat ≥ 500 lilin · 731` · `Level terdekat < 1 ATR · 143`. **Nol chip menyala bawaan**, dan tak ada chip bernama sifat ("Momentum", "Jagoan"). Dijaga dua tes: `expect(chipBawaan).toEqual([])` dan regex yang menolak label tanpa operator.
- **Ambang masuk:** `n < 250` lilin atau likuiditas median20 < Rp500 jt/hari → tak dapat kartu, dan **jumlahnya dicetak di kaki tabel** ("47 emiten belum memenuhi ambang data"), bukan hilang senyap. Papan Pemantauan Khusus tetap masuk dan diberi label — ambang likuiditas sudah menyaring sebagian besarnya, jadi jangan tambah saringan papan.
- **Angka batas:** 100 baris per halaman desktop, 25 di ponsel, tombol "muat 25 lagi". Kartu ringkas maksimal 12; di 412px itu ±4 kartu di atas lipatan nyata 810px, sisanya digulir. Tanpa virtualisasi, tanpa infinite scroll — gulir tak berujung mengubah "daftar yang saya saring" jadi "umpan yang mereka kurasi".
- **Berkas:** satu `data-idx/json/kartu/ringkas.json`, ~10 ruas per emiten (kode, tgl, harga, chg, atr_pct, er_persentil, likuiditas, s1, r1, stop_pct) ≈ **150 KB** untuk 900 emiten, satu permintaan. **Wajib diturunkan dari dict kartu penuh yang sama**, bukan dihitung jalur terpisah, plus assert di CI yang mencocokkan 5 emiten acak antara kedua berkas. Jangan dipecah sebelum tembus 1 MB.

### 4. ASAL DATA — kontributor, Claude Code, atau apa

**Putusan: 100% hitungan otomatis dari OHLC. Kontributor tak pernah menyentuh satu angka pun di kartu. Claude Code menulis rumusnya, tak pernah nilainya.**

Alasannya mekanis, bukan selera — dan ini bagian terkuat dari seluruh adu:

> Setoran Broker Summary aman **karena bisa diaudit dengan MELIHATNYA**: kurator membandingkan tangkapan layar dengan layar sekuritasnya dalam hitungan detik, jadi kata "disetujui" punya arti, dan seluruh mesin jenjang/akurasi/kuota berdiri di atas arti itu. Satu `p_kena` karangan berperilaku sebaliknya: **tak terbantahkan oleh apa pun yang terlihat hari itu**, mengendap di arsip, dan merusak permanen tanpa terdeteksi. Kurator tak punya cara memverifikasinya selain menghitung sendiri — dan kalau dia menghitung, setoran itu tak berguna sejak awal.

Kalau setoran ANGKA dibuka, "disetujui" diam-diam berubah arti jadi "formatnya benar" **tanpa satu baris kode berubah** — persis pola regresi #142. Ditambah jenjang yang memberi hadiah untuk menyetor, itu juga membuka pump: kontributor menyetor sinyal untuk emiten yang ia pegang, dan platform yang menerbitkannya ikut menanggung.

**Yang BOLEH dari kontributor** (fakta yang punya sumber resmi, bisa diadu): koreksi identitas/sektor, **aksi korporasi terutama stock split**, dan catatan kualitatif bertanggal + bertanda tangan di blok terpisah berlatar beda ("Catatan pembaca — bukan bagian dari perhitungan"). `bangunTesis()` tidak boleh membacanya. Catatan yang bertentangan dengan ruas terhitung **ditolak, tidak digabungkan**.

**Jaminan kebenarannya bukan "ada yang memeriksa" melainkan keterulangan:** kartu yang sama + OHLC yang sama + versi metode yang sama = kartu identik. Karena itu tambah ruas `versi_metode` dan cetak sebagai label pendek ("metode v3") — itu nomor versi, bukan jalur berkas, jadi tak melanggar larangan membocorkan internal.

**Dilarang:** narasi LLM per emiten. 900 teks yang tak seorang pun baca sebelum tayang, tiap satunya terbaca sebagai penilaian. `bangunTesis()` yang merakit kalimat dari angka lewat aturan tetap sudah benar — itu **batasnya**, bukan titik awalnya.

### 5. TABEL DALAM KARTU — 8 kolom di 412px

**Putusan: tabel DIPUTAR (transpose) di ≤700px, kolom `Harapan` dibuang, tanpa bilah proporsi.**

Jadi 3 kolom (satu per target) × 7 baris (Jarak · Target dulu · Pembatal dulu · Tak terjadi keduanya · Median waktu · Q1–Q3 · n). `<th scope="col">` = harga level, `<th scope="row">` = nama metrik. Anggaran 412px: kolom label 104px + 3×76px = 332px pada mono 11px — muat, semantik tabel utuh untuk pembaca layar, `.tp-tbl` yang sudah ada tetap dipakai, **nol kelas `.kta-tbl` baru**.

Perakitannya: satu `TabelSkenario({ target, orientasi })`, `orientasi` dari `useLayarSempit(700)` yang **sudah ada** di `SeasonalityHarian.tsx:39` — diangkat ke `lib/dasbor`, bukan ditulis ulang, dan bukan dua markup kembar yang disembunyikan CSS (dua markup = dua tempat angka bisa berbeda). `display:flex` tak pernah menyentuh `<td>`.

Batas kapasitas jujur: **maksimum 3 kolom level di 412px**. Data sekarang tepat 3 target. Kalau nanti lebih, tampilkan 3 terdekat + baris "2 level lain hanya di layar lebar" — bukan pembuangan senyap.

**Bilah proporsi tiga warna ditolak**, walau tiga rancangan mengusulkannya sebagai alat kejujuran utama ("67% jadi benda terlebar di layar"). Argumen itu **gagal pada 2 dari 3 emiten yang datanya sudah ada**:

| Emiten | Target terdekat | kena | stop | lewat |
|---|---|---|---|---|
| ARCI | 1.660 (+25,8%) | 18,32% | 14,71% | **67,0%** |
| BUMI | 194 (+5,4%) | **62,42%** | 20,71% | 16,9% |
| WIFI | 2.190 (+3,3%) | 48,31% | 51,69% | **0%** |

Bilah BUMI jadi batang hijau 62% tepat di sebelah harga target — meteran beli tanpa satu kata ajakan. Bilah WIFI jadi meteran odds dua warna 48/52 tanpa segmen netral sama sekali. Alat kejujuran yang bergantung pada properti data yang kebetulan berlaku di ARCI bukan alat kejujuran.

**Sebagai gantinya, satu penjaga di sumbernya (±3 baris):** kalau `stop_pct < atr_pct`, **seluruh blok skenario tidak ditampilkan** — diganti kalimat "Pembatal berada di dalam satu ATR harian; angka skenario tidak bermakna untuk konfigurasi ini." WIFI (stop 3,30% vs ATR 4,57%, `lewat=0`, median 1 hari) hilang sekaligus, dan baris "median 1 hari, Q1–Q3 1–2" memang definisi, bukan temuan. Peringatan `pembatalDalamAtr()` yang sekarang cuma memberi catatan di bawah tabel dinaikkan jadi **gerbang**, bukan keterangan.

---

## Butuh keputusan Johan

**A. Kartu berjejak — apakah PAPAN mau punya kartu bertanggal yang dilacak sampai selesai?**
Ini yang membuat kartu acuan hidup 7 hari, dan ini juga yang paling dekat ke layanan sinyal.
- **A1 (rekomendasi):** tidak untuk sekarang. Kartu = potret harian bertanggal. Alasan: aksi korporasi merusak level beku tanpa galat, tiga target = tiga lomba yang tak muat dalam satu status, dan kalibrasi yang jadi imbalannya tidak sah secara statistik.
- **A2:** ya, tapi milik pengguna sendiri — dipatok manual, disimpan di localStorage, tanpa arsip di sisi kita, tanpa rekap agregat apa pun. Empat hasil selalu terlihat bersama: SENTUH · PEMBATAL · BERJALAN · **LEWAT HORIZON**.
- **A3:** ya, diterbitkan sistem 30–80 kartu/hari dengan arsip. **Jangan** — begitu sistem yang memilih 60 dari 900 dan melacak hasilnya, itu layanan sinyal berkinerja-terpublikasi, apa pun disclaimernya.

**B. Blok skenario tetap tampil, mengingat `p_kena` tak bersyarat?**
Terverifikasi di `kartu_analisa.py:217`: `for t in range(n-horizon-1)` berangkat dari **setiap** hari historis — tanpa filter RSI, posisi MA, atau apa pun. "18,3%" berarti "pada hari acak mana pun dalam 5 tahun ARCI", bukan "dari posisi hari ini".
- **B1 (rekomendasi):** tetap tampil, **judul bloknya diganti** dari "Skenario" jadi "Laju dasar historis jarak ini", dengan kalimat tetap: "dihitung dari setiap hari sejak 2021, tanpa memandang kondisi hari ini". Ongkos: nol. Kelemahan diakui di bawah.
- **B2:** dibuat bersyarat (saring hari historis yang mirip kondisi sekarang) — riset berhari-hari, sampel menyusut drastis, dan angka barunya butuh validasi sendiri.
- **B3:** dibuang seluruhnya dari kartu ringkas, hanya ada di kartu penuh.

**C. Halaman /kartu untuk 900 emiten dibangun sekarang atau nanti?**
- **C1 (rekomendasi):** nanti. Selesaikan dulu kartu 3 emiten + tabel skenario yang benar, baru jalankan `--semua`. Menjalankan 900 emiten sekarang akan melahirkan ratusan kartu dengan ruas kosong yang belum ada aturannya.
- **C2:** sekarang, terima bahwa emiten di puncak sejarah (`target = []`) dan emiten baru IPO menghasilkan kartu pincang sampai ditambal.

---

## Urutan pengerjaan — termurah dulu

Murah = sedikit permintaan jaringan, sedikit risiko.

| # | Pekerjaan | Berkas | Jaringan | Catatan |
|---|---|---|---|---|
| **0** | Perbaiki teks pembatal: "penutupan di bawah" → **"harga menyentuh"** | `KartuAnalisa.tsx:241` | nol | **Bug hidup hari ini.** Layar dan rumus (`l[j] <= bawah`) sudah beda aturan di kartu yang sudah tayang. Satu baris. |
| **1** | Buang kolom `Harapan` dari layar (tetap di JSON) | `KartuAnalisa.tsx:230-236` + `BarisSkenario` | nol | 8 → 7 kolom. |
| **2** | `n_efektif = n ÷ horizon`, cetak "≈61 jendela bebas" | `kartu_analisa.py` + kartu | nol | Satu pembagian, satu ruas. |
| **3** | Gerbang ATR: `stop_pct < atr_pct` → blok skenario tidak ditampilkan | `KartuAnalisa.tsx` (`pembatalDalamAtr` sudah ada) | nol | Membunuh kasus WIFI 48/52 di sumbernya. |
| **4** | Ganti judul blok jadi "Laju dasar historis" + kalimat tak-bersyarat *(kalau B1)* | `KartuAnalisa.tsx` | nol | |
| **5** | Transpose tabel di ≤700px; angkat `useLayarSempit` ke `lib/dasbor` | `SeasonalityHarian.tsx:39` → `lib/dasbor` | nol | Satu komponen, dua orientasi. |
| **6** | Muka ringkas + tiga `<details>`; primitif `.ungkap`/`.ungkap-h` ke `lantai.css` | `KartuAnalisa.tsx`, `lantai.css` | nol | `summary` tinggi 44px. `.kta-*` hanya penempatan & lebar. |
| **7** | Penanda basi berjenjang (chip + redam momentum) | `KartuAnalisa.tsx` | nol | Hitung hari bursa, bukan hari kalender. |
| **8** | Verifikasi 3 viewport (1920×1080×1 · 1536×960×1,25 · 412×915×2,625) | — | nol | Wajib sebelum lapor selesai. |
| **9** | *(kalau C2)* jalankan `kartu_analisa.py --semua`, tulis `ringkas.json` + assert lintas berkas | skrip + CI | **panen** | Sesudah pemanen OHLC, bukan sebelum. |
| **10** | *(kalau C2)* halaman tabel 900 emiten + chip saringan + dua tes penjaga | view baru | nol | |
| **11** | *(kalau A2)* kartu dipatok, localStorage, lima aturan HIT | — | nol | Hanya setelah A diputuskan. |

Langkah 0–8 bisa selesai dalam satu sesi, seluruhnya tanpa satu permintaan jaringan.

---

## Risiko yang diterima sadar

**1. `p_kena` tetap tak bersyarat, dan label tidak menghapus salah baca.** Menaruh "laju dasar" di judul blok tidak mengubah bahwa pembaca melihatnya di bawah "RSI 69 · di atas MA20" dan menyimpulkan itu peluang setup hari ini. Ini cacat terbesar yang **masih ada** di rekomendasi akhir. Diterima karena B2 mahal dan hasilnya belum tentu lebih baik — tapi jangan pura-pura sudah ditutup.

**2. Bukti sebenarnya ~61 jendela, bukan 1.217.** Kita mencetak keduanya, tapi **tidak** menghitung selang kepercayaan (±10 poin pada 18,3% dengan n_eff 61). Musiman disaring pakai Wilson, first-passage tidak — standar ganda yang diterima sadar untuk sekarang. Menambah Wilson di n_efektif kira-kira lima baris; kalau nanti ada waktu, itu tambalan yang paling sepadan.

**3. Siluetnya tetap menyerupai rencana dagang.** "Harga acuan → pembatal → tiga target" adalah entry/SL/TP dalam bentuk yang sama, dan pembaca membaca siluet, bukan disclaimer. Kosakata "acuan/pembatal/level" tidak mengubahnya. Penahannya cuma dua yang benar-benar struktural: **tak ada R:R** (rasio dua jarak tak membawa apa pun dari data), dan **tak ada kolom peluang yang bisa diurut**. Kalau nanti ada yang minta "urutkan menurut peluang" atau "berapa persen kartu kena", itu bukan permintaan fitur — itu risiko ini yang sedang menagih.

**4. Ruas kosong belum punya aturan.** `ma200` null di bawah 200 lilin, `er_persentil` null kalau n<250, `target = []` untuk emiten di puncak sejarah, `stop` jatuh ke fallback −5% kalau tak ada klaster support (`kartu_analisa.py:390`) — level yang **tak pernah muncul di layar** tapi `p_stop`-nya tetap dicetak. Semua ini belum ketahuan karena baru 3 emiten yang punya kartu dan ketiganya punya resistance. Sebelum `--semua`, tiap slot butuh jawaban "belum tersedia", tak pernah 0.

**5. Musiman praktis mati.** Ambang "selang Wilson tak melewati 50%" tak pernah tercapai untuk n=6 tahun (ARCI 43,6–97,0). Itu keputusan membuang yang disamarkan jadi syarat. Kalau memang dibuang, tulis dibuang — supaya orang berikutnya tak menghabiskan waktu mencari kenapa bloknya tak pernah muncul.

---

*Gagasan yang dicangkok dari rancangan yang kalah:* satu-komponen-dua-wajah dan pemakaian ulang `BATAS_TAMPIL_SEMUA` (dari **ponsel-dulu**); lima aturan HIT + mandat memanggil `first_passage()` yang sama alih-alih menyalin logikanya (dari **ingatan-rencana**); pembedaan "kurasi hanya bekerja untuk klaim yang punya pembanding" dan assert lintas berkas `ringkas.json` (dari **skala-pasar**); pemetaan setoran-angka ke regresi #142 dan risiko pump (dari **asal-dan-jaminan**); transpose tabel + `useLayarSempit` yang sudah ada (dari **tabel-sempit**).

*Bukan rekomendasi atau saran investasi. Angka di dokumen ini bersifat deskriptif atas data historis.*