# Task 2 — Laporan: Indeks Dunia (halaman percontohan) + perbaikan YTD

Commit: `633535d` (satu commit, 8 berkas, +298/−139)
Cabang: `claude/artifact-react-migration-c789ac`

## 1. Yang dikerjakan

### 1.1 Perbaikan YTD (TDD)

| Berkas | Status |
|---|---|
| `app/src/lib/dasbor/ytd.test.ts` | BARU — persis kode brief, tiga kasus |
| `app/src/lib/dasbor/ytd.ts` | BARU — persis kode brief |

Urutan TDD dipatuhi: test ditulis → gagal karena modul belum ada → implementasi →
lulus (bukti perintah di §2).

**Verifikasi ulang atas klaim brief:** bug `ihsg_ytd` **tidak ada** di port React.
`grep -rn ihsg_ytd` hanya menemukannya di `index_live.html:2725` dan `index.html:2725`
(dasbor lama), bukan di `IndeksDunia.tsx` — panji hijau yang menampilkannya memang belum
pernah diport. Jadi pekerjaan nyatanya bukan "memperbaiki baris yang salah", melainkan
menghitung YTD dengan benar sejak awal di papan flap baru. Nomor baris di brief valid,
tapi menunjuk berkas warisan, bukan berkas React.

Nilai nyata setelah perbaikan (5 Juni 2026): **−37,45%** (5.594,765 / 8.944,813 − 1),
bukan `+0,00%`.

### 1.2 Komponen baru

| Berkas | Isi |
|---|---|
| `app/src/components/dasbor/Papan.tsx` | Persis kode brief — papan split-flap |
| `app/src/components/dasbor/BatangPeringkat.tsx` | Daftar batang mendatar (lihat §3.2) |

### 1.3 View

`app/src/views/dasbor/IndeksDunia.tsx` dibungkus `<div className="lantai">` (termasuk
cabang loading dan error), pemetaan kelas:

| Lama | Baru |
|---|---|
| `.card` + `<p class="ct b">` | `.panel` + `.panel-h > .lbl` |
| `<table>` polos | `.tbl.w-tbl` di dalam `.board-tbl-wrap` |
| `tr.region-hdr` | `tr.kawasan` |
| `tr.idx-row` | `tr.kita` |
| `td.muted` (nama indeks), kolom A/AP/W | `.rk` |
| `td.r` + `cls()` → `.green`/`.red` | `.r.num` + `.up`/`.dn` |
| `bdg()` via `dangerouslySetInnerHTML` | JSX `<span class="ytd-bdg u\|d">` |
| kanvas Chart.js peringkat YTD | `<BatangPeringkat/>` → `.rank-wrap`/`.rk-*` |
| `.g3` + kotak inline-style ADT | `.adt`/`.adt-c`/`.adt-v`/`.adt-u`/`.adt-s` |
| `.g2` Net Foreign / Market Fundamental | `.grid2` + `.nf-grid`/`.nf-cell`/`.nf-big`/`.nf-sec`/`.nf-unit`/`.mf-big`/`.mf-x` |
| `.sep` | dihapus — jarak antarblok kini dari `gap` |

Blok baru (pengecualian struktur beku yang tertulis eksplisit di rencana, baris 106-107 +
Step 6 butir 1): papan `.board` di kepala halaman — `.lbl` tanggal + hari bursa, `<Papan/>`,
tiga `.chip` (perubahan harian, YTD, tertinggi/terendah), `.board-meta` lima `.bm`
(Volume/Nilai/Frekuensi/Kapitalisasi/USD-IDR).

`.board-side` (kanvas "IHSG — Tahun Berjalan" di artifact baris 385-391) **tidak** dibuat —
itu blok baru yang tidak disebut rencana.

### 1.4 Dua perbaikan infrastruktur yang wajib untuk pola ini

**(a) `.lantai` tidak punya jarak antarblok.** `.panel` — beda dari `.card` lama — tidak
punya `margin-bottom`. Padanan artifact `.content` (baris 96,
`display:flex;flex-direction:column;gap:16px`) dilewatkan Task 1 dengan alasan
`.dasbor-main` sudah setara, padahal `.dasbor-main` hanya mengatur padding. Tanpa ini
seluruh panel menempel. Ditambahkan ke `lantai.css` sebagai aturan `.lantai` tersendiri;
`animation:vin` sengaja tidak ikut supaya tidak ada gerak yang lolos dari blok
`prefers-reduced-motion` (selektornya `.lantai .content`, bukan `.lantai`).

**(b) Tabel `.lantai` terpotong di telepon.** `dasbor.css:359` punya
`.dasbor-shell .board-tbl-wrap{overflow-x:visible!important}` di `@media(max-width:768px)`.
Aturan itu dibuat untuk tabel lama yang diciutkan (`.board-tbl{min-width:0;table-layout:fixed}`),
tapi ikut mematikan geser mendatar tabel `.lantai` (`.w-tbl{min-width:660px}`) sehingga
kolom Nilai…W terpotong `.dasbor-main{overflow-x:hidden}` dan **tidak bisa dijangkau sama
sekali** di telepon. Diperbaiki dengan mempersempit selektornya:
`.dasbor-shell .board-tbl-wrap:has(.board-tbl)`. Terverifikasi: `/` kini bisa digeser
(`overflow-x:auto`), `/sector` (pemakai `.board-tbl` satu-satunya) tidak berubah
(`overflow-x:visible`, tabel 362px muat).

### 1.5 Tipe data

`dataHarian.ts`: ditambahkan ruas opsional `ihsg_prev/ihsg_high/ihsg_low/vol_today/
val_idr_today/freq_today/mcap_idr` beserta satuannya (diverifikasi dari
`scripts/parse_idx_pdf.py:61-92`, bukan ditebak dari nama). Tanpa ini pembacaannya lewat
index signature dan bertipe `unknown`.

`ihsg_change` **sengaja tidak didaftarkan**: pemeriksaan seluruh 93 berkas menunjukkan ruas
itu hanya ada di 55 berkas (bolong di 38). Memakainya pasti berujung `?? 0` — persis pola
bug `ihsg_ytd` yang sedang diperbaiki task ini. Perubahan poin dihitung
`ihsg_value − ihsg_prev` (dua ruas yang ada di 93/93 berkas).

## 2. Perintah yang dijalankan + keluarannya

### Step 2 — test gagal lebih dulu

```
$ npm --prefix app test -- ytd
 ❯ src/lib/dasbor/ytd.test.ts (0 test)
 FAIL  src/lib/dasbor/ytd.test.ts [ src/lib/dasbor/ytd.test.ts ]
Error: Cannot find module './ytd' imported from .../app/src/lib/dasbor/ytd.test.ts
 ❯ src/lib/dasbor/ytd.test.ts:2:1
 Test Files  1 failed (1)
      Tests  no tests
```

Gagal karena alasan yang benar (modul belum ada), bukan karena assertion salah tulis.

### Step 4 — test lulus

```
$ npm --prefix app test -- ytd
 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  216ms
```

### Seluruh suite (setelah view selesai)

```
$ npm --prefix app test
 Test Files  2 passed (2)
      Tests  6 passed (6)
   Duration  316ms
```

### Gerbang build

```
$ npm --prefix app run build
> tsc -b && vite build
✓ 719 modules transformed.
dist/index.html                   0.57 kB │ gzip:   0.36 kB
dist/assets/index-Dazw4bqD.css   77.48 kB │ gzip:  13.92 kB
dist/assets/index-D3hc5aIU.js   970.39 kB │ gzip: 293.49 kB
✓ built in 282ms
```

Ukuran bundel dibandingkan dengan HEAD tanpa perubahan ini (stash → build → pop):
`970.15 kB / 77.41 kB`. Jadi tambahan bersihnya **+0,24 kB JS, +0,07 kB CSS** — Chart.js
tetap masuk bundel karena empat view lain masih memakainya. (Peringatan "chunks larger
than 500 kB" sudah ada sebelum task ini.)

### Lint

```
$ npm --prefix app run lint
src/context/ThemeContext.tsx:33:17: warning react(only-export-components) ...
src/context/AuthContext.tsx:47:17: warning react(only-export-components) ...
```

Dua peringatan itu sudah ada sebelum task ini; nol temuan di berkas yang disentuh.

### Verifikasi tampilan (2 viewport × 2 tema, chrome-devtools MCP, dua tab)

Server: `npm --prefix app run dev -- --port 5199 --strictPort`.
Catatan lingkungan: worktree tidak punya `app/.env.local` (gitignore `*.local`), sehingga
aplikasi gagal boot dengan `VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi`.
Disalin dari checkout utama; sudah diverifikasi tetap terabaikan git di worktree.

| Tab | `emulate` | Tema | `scrollWidth == clientWidth` | Console |
|---|---|---|---|---|
| Laptop | `1536x960x1.25` | terang | 1521 == 1521 ✅ | bersih ✅ |
| Laptop | `1536x960x1.25` | gelap | 1521 == 1521 ✅ | bersih ✅ |
| Telepon | `412x915x2.625,mobile,touch` | terang | 412 == 412 ✅ | bersih ✅ |
| Telepon | `412x915x2.625,mobile,touch` | gelap | 412 == 412 ✅ | bersih ✅ |

"Console bersih" = hanya `[vite] connecting/connected`, info React DevTools, dan
`[vite] hot updated`.

Pemeriksaan isi (dibaca dari DOM, bukan dari tangkapan layar):
- papan flap: 8 kartu `5.594,77`, dua di antaranya `.flap.sym` (`.` dan `,`) ✅
- chip: `▼ -245,02 (-4.20%)`, `YTD -37.45%`, `Tertinggi 5.860,67 · Terendah 5.594,11` —
  **YTD angka nyata, bukan +0,00%** ✅
- `.board-meta`: 5 `.bm` terisi (`35.378 Jt lbr`, `31.710 M IDR`, `2.152 Rb kali`,
  `9.807 T IDR`, `18.039`) ✅
- peringkat: 35 `.rk-row`, `#1 Korea +93.65%`, `#35 Indonesia −35.30%` berkelas `kita` ✅
- tabel dunia: 39 baris tbody (35 negara + 4 kepala kawasan) ✅
- anak langsung `.lantai`: `board, cal-wrap, panel, panel, panel, grid2` — enam blok,
  urutan sesuai ✅
- telepon: `.rank-wrap` dan `.grid2` jadi satu kolom, `.board-tbl-wrap` bisa digeser ✅

**Butir "lebar kanvas grafik > 2px sebelum digambar" tidak berlaku lagi di halaman ini** —
`document.querySelectorAll('.lantai canvas').length === 0`, kanvas terakhir hilang bersama
peringatan YTD berbasis Chart.js. Butir itu tetap relevan untuk Task 7/8.

Tangkapan layar tersimpan di scratchpad sesi (`laptop-tema1.png`, `laptop-gelap.png`,
`telepon-terang.png`, `telepon-rank.png`, `telepon-gelap.png`).

## 3. Temuan tinjauan-mandiri (dan keputusannya)

### 3.1 Rencana menganggap peringkat YTD sudah berupa daftar batang — ternyata masih kanvas

Spec §4.1 menulis "sudah berupa daftar batang mendatar (`.rk-row`) — dipertahankan, hanya
ganti token", dan brief Step 6 butir 4 menulis "pertahankan daftar batang mendatar yang
sudah ada". Kenyataannya `IndeksDunia.tsx` masih memakai kanvas Chart.js dengan 35 label
diputar 55°. Yang mana yang dituruti?

Dituruti **keadaan akhir yang dimaksud**, yakni daftar batang, karena tiga sumbers sepakat:
(a) markup artifact baris 470 `<div class="rank-wrap" id="rankYtd">`, (b) komentar
`lantai.css` baris 191-194 yang eksplisit "**BUKAN kanvas** … versi kanvas sebelumnya
menumpuk 35 label miring sampai tak terbaca", (c) kelas `.rk-*` yang Task 1 sediakan tidak
punya konsumen lain di task ini. Blok, judul, urutan, dan datanya tidak berubah — yang
berganti hanya cara menggambarnya, jadi ini lapisan tampilan, bukan struktur.

### 3.2 `BatangPeringkat` dibuat sekarang, bukan di Task 7

Rencana menaruh pembuatan `BatangPeringkat.tsx` di Task 7. Karena §3.1 membuat Task 2 butuh
markup yang sama persis, pilihannya: menulis markup inline di sini lalu Task 7 membuat
komponen kembar (duplikasi), atau membuat komponennya sekarang dan Task 7 tinggal memakai.
Diambil yang kedua. **Tanda tangan propnya sama persis dengan yang ditulis rencana**
(`baris: {nama,nilai}[]`, `sorot?: string`) supaya Task 7 tidak perlu menyesuaikan apa pun.

Tiga beda dari sketsa kode rencana, semuanya karena sketsa itu menyederhanakan skrip
artifact baris 892-908:
1. **Sumbu nol proporsional**, bukan dipaku 50%. Sketsa rencana memakai
   `lebar = |v|/maks*50` dengan garis nol di tengah; kalau semua nilai searah (di data 5
   Juni, 27 dari 35 negara positif) separuh lajur jadi kosong permanen dan garis nol
   menunjuk tempat yang salah. Dipakai rumus artifact: `nol = (0−lo)/rentang*100`,
   `lebar = |v|/rentang*100`, dengan `lo = min(0,…)`, `hi = max(0,…)`. Variabel CSS `--nol`
   di `.rk-tr::before` memang ada justru untuk ini.
2. **Urut menurun di dalam komponen.** Nomor `i+1` yang dicetak di kolom pertama hanya
   benar kalau urutannya dijamin; menitipkannya ke pemanggil membuat salah pakai jadi
   senyap.
3. **Penjaga bagi-nol** (`rentang || 1`) untuk kasus semua nilai nol.

### 3.3 Format angka masih campur titik/koma

`format.ts` `fp()` menghasilkan `-4.20%` (titik) sementara `fN()` menghasilkan `-245,02`
(koma), jadi satu chip berbunyi `▼ -245,02 (-4.20%)`. Artifact memakai
`fp = (v>=0?"+":"−") + |v|.toFixed(2).replace(".",",") + "%"` — koma dan minus U+2212.

**Tidak diubah di task ini.** `format.ts` dipakai sepuluh view; mengubahnya di sini
mengubah tampilan sembilan halaman yang belum dimigrasi dalam satu commit yang hanya
ditinjau untuk Indeks Dunia — melanggar "satu halaman satu commit". Saran: kerjakan
sebagai satu commit tersendiri (cocok digabung ke Task 13 saat `dasbor.css` dihapus).

### 3.4 Acuan YTD adalah hari bursa pertama di `index.json`, bukan penutupan akhir tahun

`dates[0]` = 7 Januari 2026, `trading_day: 4` — tiga hari bursa pertama 2026 tidak ada
berkasnya. Jadi angka YTD memakai acuan penutupan 7 Januari, bukan 31 Desember. Ini persis
yang diperintahkan rencana (dan yang bisa dihitung tanpa permintaan jaringan tambahan);
komentar di `ytd.ts` menyebut acuannya apa adanya ("hari bursa pertama di index.json").
Kalau `index.json` kelak memuat lebih dari satu tahun, `dates[0]` perlu disaring per tahun
— belum perlu sekarang (93 tanggal, semuanya 2026).

### 3.5 Yang sengaja tidak diubah

- **Judul blok** dipertahankan apa adanya, termasuk emoji dan teks Inggris
  ("📊 Average Daily Trading (YTD)", "🌐 Net Foreign", "📐 Market Fundamental",
  "YTD Ranking — Semua Negara (Indonesia disorot merah)") walaupun artifact memakai
  judul Indonesia yang berbeda. Judul termasuk "struktur beku".
- **Semua baris isi Net Foreign dipertahankan** (label, status, IDR, satuan, USD, satuan).
  Sempat dicoba memindahkan baris status ke `.panel-h` sebagai `.chip` mengikuti artifact —
  dibatalkan sendiri sebelum commit karena itu memindahkan isi antar-blok.
- **`Kalender`** dibiarkan apa adanya (Task 10). Satu efek samping yang perlu diketahui:
  `.lantai .cal-grid` dan `.dasbor-shell .cal-grid` sama-sama spesifisitas (0,2,0), dan
  `lantai.css` diimpor belakangan, jadi grid bulan kalender kini ikut aturan `.lantai`
  (tambahan `margin-top:12px`, `border-top`, `padding-top:11px`). Terlihat wajar di layar
  dan memang jadi urusan Task 10.
- `.dasbor-shell .muted`, `.bdg`, `.g2/.g3`, `.sep` tidak dipakai lagi di view ini; nama
  indeks dan kolom A/AP/W memakai `.rk` supaya tidak ada kelas `dasbor.css` yang tersisa
  di halaman ini (`dasbor.css` dihapus di Task 13).

### 3.6 Sisa kecil dari Task 1

`lantai.css` baris ~262 masih memuat `.lantai .content{animation:none}` di blok
`prefers-reduced-motion`, padahal `.content` tidak dipakai (padanannya kini `.lantai`
sendiri, tanpa animasi). Tidak berbahaya, tapi menyesatkan — cocok dibersihkan di Task 13.

## 4. Catatan pola untuk Task 3/5/7/… (baca ini sebelum meniru)

1. **Bungkus, jangan tulis ulang.** Satu `<div className="lantai">` melingkupi seluruh
   keluaran view — termasuk cabang `loading` dan `error`, kalau tidak dua keadaan itu
   kehilangan token dan jaraknya.
2. **Jarak antarblok datang dari `.lantai` (`gap:16px`), bukan dari margin panel.** Jangan
   menambahkan `margin-bottom` ke `.panel` dan jangan memakai `.sep` lagi.
3. **Kepala panel = `.panel-h > span.lbl`.** Isi bertabel langsung di bawahnya (tanpa
   `.panel-b`); isi bebas dibungkus `.panel-b`.
4. **Tabel: `<div className="board-tbl-wrap"><table className="tbl w-tbl">`.** `.w-tbl`
   membawa `min-width:660px`, jadi di telepon tabel digeser mendatar, bukan diciutkan.
   Sudah aman berkat perbaikan `:has(.board-tbl)` di `dasbor.css` — **jangan kembalikan
   selektor lamanya.** Kalau sebuah tabel memang sempit (≤ 4 kolom), pakai `.tbl` saja
   tanpa `.w-tbl`.
5. **Warna arah angka hanya lewat `.up`/`.dn`** (dan `.ytd-bdg u|d` untuk lencana persen).
   Jangan pakai `cls()` yang menghasilkan `.green`/`.red` milik `dasbor.css`.
6. **Buang `dangerouslySetInnerHTML`.** `bdg()` diganti JSX `<span class="ytd-bdg …">`;
   kalau menemukannya di view lain, lakukan hal yang sama.
7. **Kanvas berlabel banyak → `<BatangPeringkat/>`** (sudah ada di
   `app/src/components/dasbor/BatangPeringkat.tsx`, Task 7 tinggal impor). Komponen ini
   mengurutkan sendiri; oper data apa adanya, dan `sorot` diisi dari data
   (`world.find(w => w.is_idx)?.c`), jangan nama negara ditulis tetap.
8. **Ruas data yang mungkin kosong tampil `—`, tidak pernah `0`.** Ini inti temuan A. Sebelum
   memakai ruas baru dari `ds_*.json`, periksa dulu ke-93 berkas
   (`node -e` sekali jalan) — dua ruas sudah terbukti bolong: `ihsg_ytd` (0 berkas) dan
   `ihsg_change` (55 dari 93).
9. **Struktur beku itu serius.** Boleh: ganti kelas, ganti pembungkus, ganti cara
   menggambar, buang `dangerouslySetInnerHTML`. Tidak boleh: mengubah judul, menambah
   angka baru di kepala panel, memindahkan isi antar-blok, menggabung dua blok. Kalau
   ragu, pertahankan.
10. **Verifikasi butuh `app/.env.local`.** Worktree tidak mewarisinya (gitignore `*.local`);
    salin dari checkout utama atau aplikasi gagal boot dan halaman kosong.
11. **Ukur, jangan lihat saja.** Selain tangkapan layar, baca DOM lewat `evaluate_script`
    (`scrollWidth == clientWidth`, jumlah baris, isi chip, `getComputedStyle` untuk
    `overflow-x`) — tabel yang terpotong `overflow:hidden` kelihatan baik-baik saja di
    tangkapan layar.

## 5. Usulan baris ledger `progress.md`

```
Task 2: complete (commit 633535d, review belum dijalankan)
```

## 6. Koreksi catatan pola — 2026-08-11 (tinjauan pasca-commit)

Butir 9 di §4 di atas menulis aturan blanket "Tidak boleh: ... menambah angka baru di
kepala panel" — ini **tidak akurat**, dan tinjauan tugas atas commit 633535d menangkapnya:
baris 200 kode (`~ USD/IDR BI = ...` di `.panel-h` panel Market Fundamental) memang
menambah satu angka ringkasan di kepala panel, dan itu **benar**, bukan pelanggaran —
karena mengikuti markup artifact sumber apa adanya (lihat §368-493 artifact rujukan).
Yang salah sebelum perbaikan ini bukan penempatannya, melainkan `fN(hari.usd_idr, 0)`
memakai pola lama yang mengubah ruas kosong jadi `0` (sudah diperbaiki jadi
`hari.usd_idr == null ? '—' : fN(hari.usd_idr, 0)`, sama seperti papan flap baris 58).

**Aturan yang akurat, menggantikan bagian kedua butir 9:** satu nilai ringkasan/meta BOLEH
ditaruh di `.panel-h` kalau artifact sumber menaruhnya di sana (seperti USD/IDR BI di panel
Market Fundamental). Di luar itu, angka pendukung tetap di `.panel-b` — seperti baris status
Net Foreign (§3.5) yang sengaja DIBATALKAN dipindah ke `.panel-h` karena artifact sumbernya
menaruh baris itu di badan panel, bukan kepala.

Beda antara dua kasus ini bukan "boleh vs tidak boleh menambah angka di kepala panel",
melainkan "ikuti markup artifact sumber, blok per blok" — persis butir 1 di §4. Task
3/5/7/… yang mendapati artifact sumber menaruh nilai ringkasan di kepala panel boleh
menirunya; yang menaruhnya di badan panel harus tetap di badan panel. Kalau ragu dan
markup artifact sumber tidak jelas, default ke `.panel-b`.

Catatan asli di butir 9 dibiarkan apa adanya di atas (tidak diedit) supaya jejaknya utuh —
koreksi di bagian ini yang berlaku untuk task-task berikutnya.
