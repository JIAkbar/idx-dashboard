# Antrean PAPAN — satu-satunya sumber untuk "ada backlog?"

Disatukan 20 Agu 2026 dari LIMA berkas yang sebelumnya berserak — akibat
nyatanya sudah dibayar: **C3 Screener** tercatat "BELUM" berbulan-bulan
karena "ada backlog?" selalu dijawab dari `rencana-berjalan.md` saja, tak
pernah dari `ceklist-backlog.md` tempat C3 sebenarnya hidup. Johan:
*"backlog screener aja belum kmu kerjakan sampai detik ini, payah kmu tidak
menepati janjimu"*.

**Aturan mengikat mulai sekarang**: "ada backlog?" dijawab dari berkas INI
saja. Kelima berkas lama (`rencana-berjalan.md`, `ceklist-backlog.md`,
`BACKLOG-SWEEP-VISUAL.md`, `RENCANA-REFACTOR-REACT.md` §9,
`backlog-edisi.md`) tetap ada untuk riwayat/keputusan teknis, tapi bagian
antreannya sudah dipindah ke sini. **Tiap baris "BELUM" di sini wajib dicoba
ulang (grep/baca kode) sebelum dilaporkan** — jangan disalin dari ingatan.
Sapuan 20 Agu menemukan **9 baris yang tercatat "belum" di berkas lama
ternyata sudah jadi**; daftarnya di bagian "Sudah selesai" dengan bukti
`berkas:baris`.

`docs/backlog-edisi.md` **tidak disentuh** — agen lain sedang bekerja di
area itu; dirujuk apa adanya.

---

## A. Menunggu keputusan Johan (tak bisa ditebak tanpa salah sasaran)

| # | Pekerjaan | Asal (berkas lama) | Pertanyaan yang menunggu jawaban |
|---|---|---|---|
| A1 | Panen statistik harian: awan atau rumahan | `rencana-berjalan.md` "Antrean terbuka 19 Agu" A2 | `download_idx.py` memanggil endpoint DAFTAR (`GetStatistic`) lalu unduh PDF dari URL yang diberikan daftar itu. Kalau yang diblokir cuma daftarnya sementara URL PDF tembus, jalan keluarnya jauh lebih murah daripada pindah panen ke rumah — **belum diuji** |
| A2 | Rel navigasi rail: asuransi murah vs kelompokkan submenu | `ceklist-backlog.md` #175 | Dua jalan: (1) `overflow-y:auto` di `.dasbor-rail-list`, satu baris, sementara; (2) kelompokkan chart PAPAN + penyaring + backtesting jadi satu pintu rel dengan tab di dalamnya. Sisa ruang rel di 1536×960 ≈52,6px (muat 1 ikon lagi) |
| A3 | Bulletin Arus Pasar: konsolidasi ke Supabase `edisi` atau tetap 2 jalur paralel | `BACKLOG-SWEEP-VISUAL.md` #37 | Repo punya 2 sistem Arus Pasar paralel (file-based publik `Bulletin.tsx` vs Supabase admin `Terbitan.tsx`/`supabaseEdisi.ts`). Agen sengaja tak pakai Supabase untuk Bulletin publik karena RLS-nya belum diverifikasi publik-aman |
| A4 | #170 sisa: K4/K6/K7 | `ceklist-backlog.md` #170, `docs/spek-kendali.md` "Yang TIDAK dikerjakan" | K4: rentang Grup Konglomerat menghitung apa? K6: kartu broksum — apa yang salah dari kartunya? K7: jalur data Radar (bukan pekerjaan tampilan) |
| A5 | Nama produk "Arus Pasar" & palet warna (teal) dipertanyakan ulang | `RENCANA-REFACTOR-REACT.md` §9 | User belum yakin nama final; teal mirip identitas proyek SAKTI lain ("fanatik hijau" — tegur Johan). Kalau nama diputuskan, palet ikut dievaluasi |
| A6 | Cover PDF Arus Pasar (`HalamanSampul.tsx`) — desain baru | `RENCANA-REFACTOR-REACT.md` §9 | Sekarang cuma daftar isi teks di atas warna teal polos; Johan: "bukan memunculkan daftar isi tapi cover" — perlu elemen visual. Sepaket: blok IHSG/Net Foreign dipindah dari bawah ke ATAS cover. Rencana: mockup dulu (pola sama redesign Login) sebelum eksekusi |
| A7 | `arus-pasar/cetak.css` — tabel Ringkasan Edisi & Peringkat Peluang terpotong diam-diam di >~7 emiten | `RENCANA-REFACTOR-REACT.md` §9 | **Dikonfirmasi ulang 20 Agu masih ada**: `.ap-cetak .page{height:296mm;overflow:hidden}` (baris 40/53/59) belum berubah, cuma dites 3 emiten (fixture Fase 2), belum pernah 10–20 emiten (skala rencana asli). Dua opsi: (1) lepas `overflow:hidden`+fixed height khusus 2 halaman ini, tabel pecah ke beberapa lembar A4 + `thead` repeat; (2) pagination React — potong emiten per-N, render beberapa blok `.page` |
| A8 | Chart.tsx (PDF Arus Pasar) — label pivot (R3/R1/P/R2/S1/S2/S3) nempel tepi kanan, kurang jelas | `RENCANA-REFACTOR-REACT.md` §9 baris #15 | Opsi: pindah label ke luar area chart, atau dihilangkan kalau tetap berantakan. **[ANTRE]**, belum diagnosa lanjut |

---

## B. Terbuka — bisa dikerjakan (urutan ringan→mahal mengikat, `ceklist-backlog.md`)

### Ringan

| # | Pekerjaan | Asal | Keadaan · Bukti/penghalang |
|---|---|---|---|
| B1 | C7 — Foreign flow 5D/10D **per emiten** | `ceklist-backlog.md` C7 | SEBAGIAN. Sudah: agregasi `ds_*.json` → net foreign harian+kumulatif, tab Flow di `/broker-summary` (`lib/dasbor/flowNego.ts`, `BrokerSummary.tsx:255`). Belum: kolom 5D/10D per emiten — angka sekarang level pasar (`nf_today_idr`) |
| ~~B2~~ | ~~C8 — Watchlist **dinamis**~~ | `ceklist-backlog.md` C8 | **SELESAI 20 Agu** (`b2a80af6`) — rute `/watchlist`, tabel ikut OHLCV harian + harga milik, untung-rugi berjalan. Disimpan di `localStorage` (bisa dipakai tanpa login) dan keterbatasannya ditulis di layar. Skema `beli: EntriBeli[]` sudah larik sejak awal supaya riwayat beli bertahap tak butuh migrasi. 11 uji |
| ~~B3~~ | ~~C4 — Market breadth (advance/decline)~~ | `ceklist-backlog.md` C4 | **SELESAI 20 Agu** (`72a79713`) — panel di Beranda, hari ini + riwayat bergrafik. Urutan keranjang `price_movement.stocks` diverifikasi lintas **144 hari**: 127/143 searah IHSG, korelasi **0,91**. Hari tanpa data `null`, bukan 0 |
| ~~B4~~ | ~~#173 — Tabel Akses hierarki induk-turunan~~ | `ceklist-backlog.md` #173, `rencana-berjalan.md` #173 | **SELESAI 20 Agu** (`fd42aa11`) — kolom `akses_halaman.induk` (nullable, FK ke `kunci` sendiri) + `boleh_buka()` meng-AND-kan hasil baris dgn hasil induknya (rekursif), ditegakkan di DATABASE bukan cuma render React. `probvv`→`bulletin`, `seasonality-hari`→`seasonality`. Tab Akses admin tampilkan hierarkinya (indentasi). Diverifikasi transaksi rollback: mengunci `bulletin` bikin `boleh_buka('probvv')` ikut `false`. Detail: `jejak-permintaan.md` #196 |
| ~~B5~~ | ~~#165 — Thumbnail dibuat saat unggah~~ | `ceklist-backlog.md` #165 | **SELESAI 20 Agu** (`fd3df7c0`) — companion `{tanggal}/{ticker}-{jenis}.thumb.webp` (maks 160px, WebP) dibuat via `<canvas>` browser sesudah unggahan asli sukses (fire-and-forget, asli tak disentuh). RLS storage + `ada_alasan()` diperluas. **Diukur nyata** (12 screenshot 19 Agu, PIL resize+encode persis logika `<canvas>`): 5.955,6 KB → 16,1 KB, hemat 99,7%. Detail: `jejak-permintaan.md` #197 |
| ~~B6~~ | ~~#171 — Rule engine: peta sinonim + tahan salah ketik~~ | `ceklist-backlog.md` #171 | **SELESAI, ternyata sejak `a58a8968`/`a0ff1703` (18 Agu)** — baris "Dicoba ulang 20 Agu" di atas adalah FALSE NEGATIVE: greppnya mencari literal `sinonim`/`levenshtein` di `pengetahuan.ts`, tapi peta sinonimnya bernama `PADANAN` dan hidup di `teksTanya.ts` (dipakai bersama tanyaPapan/pengetahuan/glosarium), toleransi salah ketiknya `mirip()`+`jarak()` (Levenshtein berambang panjang kata, terukur — commit message a58a8968 mencatat "88/112 → 112/112" lalu a0ff1703 "32 dari 58 salah sasaran → 0"). Kata tunggal ambigu sudah ditawari cabang lewat `CABANG` di `tanyaPapan.ts`. Diverifikasi ulang 20 Agu (sesi ini) dengan `git merge-base --is-ancestor a0ff1703 HEAD` — sudah ancestor `main`, tak ada perubahan diperlukan |
| ~~B7~~ | ~~#172 — Emiten dijawab aspek broker + chip saran + sambungan kata ganti~~ | `ceklist-backlog.md` #172, `rencana-berjalan.md` #172 | **SELESAI 20 Agu** (`b938a577`) — `jawabBroker()` baru: "broker paling aktif hari ini" dijawab dari `h.broker_val` (sudah termuat di fetch harian, field yang sama dipakai `/broker` — TANPA fetch tahap-2); broker PER EMITEN dijawab jujur belum tersedia lewat `RUAS_BELUM`. `Jawaban.saran` (chip lanjutan) diisi terpusat di `jawab()` dari topik/subjek akhir, dirender `TanyaPapan.tsx` pakai ulang kelas `.tp-contoh-it`. `RUAS_SUSULAN` diperluas terima awalan tanya ("bagaimana"/"gimana"/"berapa") — "bagaimana valuasinya?" sesudah "harga BBCA" kini nyambung ke valuasi BBCA, bukan valuasi pasar. 89 uji baru, dicoba manual di localhost:5175 (1536×960 & 412×915) dengan data hari berjalan sungguhan |
| ~~B8~~ | ~~D9 — Buang `potongRentang` (kode mati)~~ | `rencana-berjalan.md` D9 | **SELESAI 20 Agu** (`e01b7861`) — fungsi + 3 uji yang cuma menguji dirinya sendiri dibuang; grep `potongRentang` di `grafikEmiten.ts` kini **0**. Sembilan uji anti-bocor Bar replay di berkas yang sama tak tersentuh |
| ~~B9~~ | ~~D10 — Baris salah di `docs/status-panen.md:79`~~ | `rencana-berjalan.md` D10 | **SELESAI 20 Agu** (`78c92168`) — kalimatnya kini membedakan batas **daftar** laporan (ResultCount 0 di 2018 ke belakang) dari batas **isi** (2019–2025 + interim 2024) |

### Sedang

| # | Pekerjaan | Asal | Keadaan · Bukti/penghalang |
|---|---|---|---|
| ~~B10~~ | ~~A1 — Rata-rata 5 tahun + ambang verdict valuasi~~ | `ceklist-backlog.md` A1 | **SELESAI 20 Agu** (`ec318fd2`) — 338 emiten layak vonis P/E, 574 P/B, 151 tak punya deret. Jebakan yang ditemukan & dihindari: harga `ohlc/` sudah disesuaikan pemecahan saham sementara `eps` XBRL tidak — BBCA 2019 terbaca **5,8×** padahal ~29×. Dipakai `harga × saham_kini ÷ laba_bersih`, bukan ruas per-saham |
| B11 | #166 — Rakit ulang mesin Mingguan & Bulanan (sisa) | `ceklist-backlog.md` #166, `rencana-berjalan.md` #166 | SEBAGIAN. Sudah: Bulanan murni agregat, Mingguan dapat halaman Pola Sepekan + strip Progresi Skor. Belum: halaman per-emiten Mingguan masih memanggil `halaman_emiten()` milik `build.py` (`build_weekly.py:469`) — sumber keluhan "identik dengan edisi harian" |
| B12 | SW#29 — Kalender full-width di `/stocks`, `/broker` | `BACKLOG-SWEEP-VISUAL.md` #29 | Belum dicoba ulang kodenya 20 Agu (bukan salah satu dari 8 yang disebut sudah jadi). 7 kolom grid stretch penuh lebar viewport tanpa cap |
| B13 | SW#36 — Kalkulator JIA grid terlalu lebar di desktop | `BACKLOG-SWEEP-VISUAL.md` #36 | Bukan bug CSS spesifik — rekomendasi: cap `max-width` halaman ~1400-1600px. Belum dieksekusi, perlu backtest 2 viewport begitu dikerjakan |
| B14 | SW#20 — `hist_fcf`/`hist_bv` masih mentah USD | `BACKLOG-SWEEP-VISUAL.md` #20 | **Dicoba ulang 20 Agu**: ruas `hist_fcf` terisi non-null di 964/967 berkas (bukan lagi kosong), tapi kelas bug aslinya (konversi mata uang, kelas sama dengan fix Critical 99 emiten) **belum diverifikasi terpisah** — nilai USD-nya sendiri belum jelas sudah dikonversi atau belum |
| B15 | RR — Sumber chart candlestick pindah ke data Stockbit (indikator lebih kaya) | `RENCANA-REFACTOR-REACT.md` §9 | Ide, belum diperinci. Chart PAPAN sekarang OHLC+EMA50+Pivot dari yfinance |
| B16 | RR — Backup harian folder screenshot upload (bucket Supabase) | `RENCANA-REFACTOR-REACT.md` §9 | Mekanisme belum ditentukan (cron? sinkron Drive/lokal?). Isinya screenshot manual, tak reproducible kalau hilang — beda dari `data/*.json`. Sepaket: klarifikasi "2 jenis orderbook" di folder data owner lokal Johan (di luar repo) |
| ~~B17~~ | ~~D11 — Perbesar flyout submenu rail~~ | `rencana-berjalan.md` D11 | **SELESAI 20 Agu** (`06787778`) — `lantai.css:247` kini `min-width:240px; max-width:300px` (dari 208/260), tiap baris `min-height:44px`, huruf 12,5→13,5px. Penjepitan posisi di `Sidebar.tsx` memakai `offsetHeight` aktual jadi ikut menyesuaikan sendiri |
| B18 | #154 — Peringatan konteks + tanggal metodologi di tiap halaman analitik | `ceklist-backlog.md` #154 | Belum. Yang membuat SPLE dipercaya bukan sinyalnya, tapi panduannya (rumus terbuka, perubahan bertanggal) |
| ~~B19~~ | ~~#162 — Sebab penolakan unggah MBMA belum terbukti~~ | `ceklist-backlog.md` #162 | **DITUTUP 20 Agu — investigasi, bukan tambalan kode.** Percobaan gagal 14 Agu memang tak meninggalkan jejak baris (`setoran` policy INSERT langsung menolak alasan pendek SEBELUM baris sempat dibuat, jadi tak ada apa pun utk "auto-dihapus"), jadi sebab pastinya tak bisa dibuktikan mundur. Tapi jejak waktu kuat mengarah ke SATU penjelasan: migrasi `setoran_alasan_dan_kurasi` (RLS "alasan wajib ≥20 karakter", `20260814113459` = **18:34:59 WIB**) mendarat **~26 menit SEBELUM** commit klien `d9313d5e` (form alasan, **19:00:58 WIB**) — jendela balapan deploy di mana server sudah menuntut alasan tapi klien belum mengirimnya. Baris `setoran` MBMA bertanggal 14 Agu baru sukses tercatat **17 Agu** (`dibuat_pada`), 3 hari kemudian — cocok dgn "gagal lalu dicoba ulang belakangan". **Diperiksa ulang 20 Agu, BUKAN dari ingatan**: `pg_policies.setoran_tulis` sekarang mensyaratkan persis `length(btrim(coalesce(alasan,''))) >= 20`, dan `lib/alasanValidasi.ts` (`ALASAN_MIN=20`, `.trim()`) SUDAH SELARAS — tak ada lagi celah klien-vs-server. 3 unggahan MBMA berikutnya (18, 19 Agu) sukses bersih. Alat diagnosa #161 (galat server + tahap `[baris setoran]`/`[unggah berkas]`) sudah terpasang (`supabaseEdisi.ts:99-116`) utk kejadian serupa berikutnya, kalau memang ada |
| ~~B20~~ | ~~D4 — Peta Investor tak menyebut tanggal data~~ | `rencana-berjalan.md` D4 | **SELESAI 20 Agu** (`ff573bc0`) — `PetaInvestor.tsx` kini membaca `investor_map.meta.json` (berkas 263 byte yang sebelumnya tak pernah disentuh kode) dan mencetak posisinya di subjudul: "jaringan kepemilikan KSEI · posisi 2 Juni 2026 · ≥1% · N emiten". Baris ini sempat tercatat BELUM di berkas ini karena dicoba beberapa menit sebelum tambalannya mendarat |
| B21 | D6 — 98 emiten pelapor USD tak punya baris "Setahun (audit)" | `rencana-berjalan.md` D6 | `fd.hist_*` sudah dikonversi tapi sumbernya yfinance — menyebutnya "audit" akan jadi kebohongan |
| B22 | D7 — 3.099 dari 9.665 mata uang masih TAKSIRAN | `rencana-berjalan.md` D7 | 2020/2021/2025 audit dan 2026 TW2 tak pernah terarsip mentahnya. Menaikkan jadi bacaan pasti butuh unduh ulang |
| B23 | D8 — Sembilan lompatan neraca belum terjelaskan | `rencana-berjalan.md` D8 | Empat wajar (ekuitas melintasi nol), sisanya cacat di sumber IDX sendiri |

### Besar

| # | Pekerjaan | Asal | Keadaan · Bukti/penghalang |
|---|---|---|---|
| ~~B24~~ | ~~A2(ceklist) — Halaman Bedah Emiten, 12 section~~ | `ceklist-backlog.md` A2, `rencana-berjalan.md` #153 | **KODE SELESAI 20 Agu 2026** (`b09255bc`) — rute `/bedah-emiten`, menu `BDH` (kelompok Emiten), dua belas seksi lengkap sesuai rancangan `workflow-fundamental.md` A2. Hitungannya `lib/dasbor/bedahEmiten.ts` + 27 uji; **864 hijau di 46 berkas**, `npx vite build` bersih. **Sisa dua, dua-duanya di luar halaman ini:** (a) verifikasi layar 2 viewport belum jalan — chrome-devtools terkunci sesi lain (PID 26484, mulai 11:53), tidak dimatikan & tidak diganti alat sesuai aturan; (b) `npm run build` masih merah karena galat TS agen lain di `lib/dasbor/tanyaPapan.ts:666`. Papan Pekerjaan: `jejak-permintaan.md` #191–195 |
| ~~B25~~ | ~~#130 — Divergensi tiga lapis~~ | `ceklist-backlog.md` #130 | **SELESAI 20 Agu** (`88f7526c`) — dikalibrasi atas 916 berkas / 1,51 juta lilin: **2,83 temuan per 100 lilin** (Double Bottom pembanding 2,43), median 6 per emiten per tahun. Stochastic 14/3/3 (bukan 14/1/3), jendela volume menoleh ke belakang supaya tak melanggar kausalitas Bar replay |
| ~~B26~~ | ~~B3(ceklist) — Pemegang saham pengendali~~ | `ceklist-backlog.md` B3 | **SELESAI SEBAGIAN 20 Agu** (`b6b1e330`) — 949 emiten, nol jaringan, dari arsip XBRL. **Batasnya penting:** yang ada KATEGORI (526 korporasi nasional, 205 individu WNI, 92 korporasi asing, 53 pemerintah), **bukan NAMA**. 47 sheet BBCA & ASII disisir, daftar nama tak ada. Jadi nama & grup konglomerat TETAP terbuka, butuh KSEI/prospektus |
| B27 | C2 sisa — Wyckoff Phase (Grup 3) & Harmonic (Grup 4) | `ceklist-backlog.md` C2 | Grup 1 (Stochastic/StochRSI/Williams%R) + VWAP **SELESAI 19 Agu**. Sisa: Wyckoff Phase (nol jejak), Harmonic (nol jejak) |
| B28 | RR#21 — Yahoo `^JKSE` sebagai sumber cadangan IHSG | `RENCANA-REFACTOR-REACT.md` §9 baris #21 | **Penghalangnya sudah hilang**: dulu bergantung "#18 dibetulkan dulu" (bug `t.history()`), dan #18(RR) sudah selesai 20 Agu (lihat Sudah Selesai). Layak diangkat jadi antrean aktif kalau Johan mau |

---

## C. Diparkir — bukan antre

> 🅿️ = **diparkir**, bukan antre. Yang antre boleh naik sendiri begitu
> penghalangnya hilang; yang diparkir **hanya boleh diangkat kalau Johan
> memanggilnya**. Menawarkannya lagi sama saja mengabaikan keputusan yang
> sudah diambil.

| # | Pekerjaan | Asal | Keadaan |
|---|---|---|---|
| C1 🅿️ | #167 — Lapis Gemini Flash di Tanya PAPAN | `ceklist-backlog.md`, `rencana-berjalan.md` #167 | **DIPARKIR** — Johan 17 Agu 2026: *"tetap jadikan backlog sampai saya panggil kmu lagi"*. Lapis aturannya sudah jalan; LLM ditunda sampai cakupan rule-engine lengkap |
| C2 🅿️ | #129 — Chart bandarmologi | `ceklist-backlog.md`, `rencana-berjalan.md` #129, #151 | **DIPARKIR** — keputusan Johan 17 Agu sama seperti C1. Tetap terhalang data juga: `GetBrokerSummary` mengabaikan `stockCode`, hasilnya selalu level pasar; jalur Netlify Function SPLE (yang membuktikan API-nya ADA) balas `IDX API 403` (IP datacenter diblokir) — belum diuji ulang dari IP rumahan |
| C3 🅿️ | #168 — Cara scraping arsip berita yang benar | `ceklist-backlog.md`, `rencana-berjalan.md` #168 | **DIPARKIR** atas instruksi sesi ini (setara C1/C2). Endpoint IPOT mengabaikan `halaman` → mentok ±200 berita/kanal. Menelusuri `news_id` mundur satu per satu **tidak dilakukan tanpa pembahasan** — ribuan permintaan ke server orang |

---

## D. Sudah selesai — dicoba ulang 20 Agu, ternyata sudah jadi

Sembilan baris ini tercatat "BELUM"/"Antre" di salah satu dari lima berkas
lama. Diverifikasi langsung ke kode (bukan dari ingatan) sebelum dipindah
ke sini.

| # | Pekerjaan | Asal (tercatat belum di) | Bukti |
|---|---|---|---|
| D1 | C6 — Halaman metodologi & glosarium | `ceklist-backlog.md` C6 ("BELUM — tak ada rute `/metodologi`") | **SUDAH ADA.** `App.tsx:36,123` route `/metodologi` → `views/dasbor/Metodologi.tsx`; `Metodologi.css`, `metodologi.test.ts` turut ada. Catatan lama basi — kemungkinan dikerjakan sesudah audit 18 Agu |
| D2 | SW#25 — Dropdown `.dd-it` latar putih di tema gelap | `BACKLOG-SWEEP-VISUAL.md` #25 ("Antre") | `lantai.css:777` — `.lantai button{font:inherit;color:inherit;background:none;border:none}` sudah menutup celah, dengan komentar eksplisit merujuk #25 di baris 773-776 |
| D3 | SW#33 — Sektor: heatmap tile 11 sektor | `BACKLOG-SWEEP-VISUAL.md` #33 ("Antre — belum pernah diimplementasi") | `SektorIndeks.tsx:305` — `<div className="tiles">` dengan tile per sektor, warna intensitas dari data harian, klik untuk filter |
| D4 | SW#35 — Peta Investor: tooltip nyantol stale + klik detail tak nyambung | `BACKLOG-SWEEP-VISUAL.md` #35 ("Antre") | Dua-duanya sudah ditambal. Tooltip: `GrafikJaringan.tsx:60` — `tooltipRef.current.style.display='none'` dipaksa saat ganti mode (komentar "Papan #tooltip-nyantol"). Klik detail: `graphRender.ts:438-454` — tooltip sendiri jadi target klik yang meneruskan ke `onSelect` (komentar "Papan #klik-detail-nyantol") |
| D5 | SW#19 — Expose `financial_currency` + caveat badge di Stock Detail | `BACKLOG-SWEEP-VISUAL.md` #19 ("Antre — backend tahu, JSON belum menyertakan") | Ruas terisi **962/967** berkas `fundamental/*.json`. Dipakai `stockDetailData.ts:178` (tipe) dan `StockDetail.tsx:106` (`mataUang = fd?.financial_currency ?? fd?.currency ?? null`). **Catatan**: komentar `StockDetail.tsx:105` masih berbunyi "financial_currency masih null di semua file" — komentar itu sendiri basi, datanya sudah ada |
| D6 | RR#17 — Data harian IDX beku 66 hari | `RENCANA-REFACTOR-REACT.md` §9 #17 ("BELUM DIPERBAIKI") | `data-idx/json/ds_*.json` terbaru **`ds_260819.json`** (19 Agustus, kemarin) — panen jalan lagi. Baris ini catatan 12 Agu; sudah dibetulkan sebelum sesi ini |
| D7 | RR#18 — `price_perf` kosong 957/957 berkas | `RENCANA-REFACTOR-REACT.md` §9 #18 ("BELUM DIPERBAIKI — akar sudah dipastikan") | Kini terisi **962/967** berkas — ditambal `scripts/lengkapi_fundamental.py` (dicatat juga di `rencana-berjalan.md` sesi 18 Agu, tapi RR belum diperbarui sampai sesi ini) |
| D8 | `rencana-berjalan.md` D5 — `/kartu?kode=XXXX` tak dikenal → halaman kosong | `rencana-berjalan.md` D5 (sudah ditandai "TERNYATA SUDAH JADI" 19 Agu, dipindah ke sini untuk kelengkapan) | `KartuAnalisa.tsx:163` dan `:344` sudah mencetak "Kartu {kode} belum tersedia." |
| D9 | Grup 1 indikator (Stochastic/StochRSI/Williams%R) + VWAP | `ceklist-backlog.md` C2 (sebelumnya tercatat "belum" di banyak tempat lain) | **SELESAI 19 Agu** — jenis terkurasi sendiri di `katalogIndikator.ts:126` (`ID_SUDAH_ADA`), rumus dari pustaka, bervonis BEKERJA di `docs/riset/audit-indikator.tsv`. Ini juga yang membuka #130 (B25) |

---

## Catatan sumber (bukan antrean, dibiarkan di berkas asal)

- `docs/rencana-berjalan.md` — riwayat keputusan sesi, sumber data (IDX vs
  Yahoo), aturan teknis berulang. **Tetap dibaca lebih dulu** untuk konteks
  sebelum kerja apa pun (baris pembuka berkas itu).
- `docs/ceklist-backlog.md` — riwayat audit 17/18 Agu, tabel "Selesai"
  lengkap per gelombang, keputusan Johan yang sudah diambil.
- `docs/BACKLOG-SWEEP-VISUAL.md` — riwayat sweep visual 11-12 Agu, item
  yang sudah selesai (#21-24,26-28,30-32,34,38-42) tetap tercatat di sana.
- `docs/RENCANA-REFACTOR-REACT.md` — rencana fase migrasi React, Papan
  Pekerjaan 9-kolom Fase 5 (baris #1-28), keputusan arsitektur §1-8.
- `docs/backlog-edisi.md` — **tidak disentuh sesi ini**, agen lain sedang
  bekerja di area itu.
