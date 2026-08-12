# Migrasi Artifact "Lantai Bursa" ke React — Rencana Implementasi

> **Untuk pekerja agentik:** SUB-SKILL WAJIB: pakai superpowers:subagent-driven-development
> (disarankan) atau superpowers:executing-plans untuk mengerjakan rencana ini tugas demi
> tugas. Langkah memakai kotak centang (`- [ ]`) untuk pelacakan.

**Goal:** Menerapkan identitas visual artifact "Lantai Bursa" ke 10 halaman dasbor React
sekaligus memperbaiki 7 temuan terverifikasi, satu halaman satu commit.

**Architecture:** Primitif tampilan artifact (papan flap, tabel, tab, pil, batang, baris
peringkat) disalin verbatim ke `app/src/dasbor/lantai.css` di bawah pembungkus `.lantai`,
lalu tiap view dibungkus `<div className="lantai">` satu per satu. `dasbor.css` tetap hidup
sampai view terakhir selesai, baru dihapus. Struktur blok tiap view beku; yang berubah hanya
lapisan tampilan, kecuali perbaikan bug dan penambahan yang disebut eksplisit di rencana ini.

**Tech Stack:** React 19, TypeScript, Vite 8, react-router-dom 7, Chart.js 4, D3 7,
Vitest 4, oxlint. Python 3.11 + yfinance untuk pipeline data.

**Spec:** `docs/superpowers/specs/2026-08-11-migrasi-artifact-react-design.md`
**Sumber visual:** `docs/design-lantai-bursa-reimagined.html` (1.157 baris; CSS 4–341,
markup 342–778, skrip 779–1157)

## Global Constraints

- **Struktur beku.** Blok, judul, urutan, dan isi kolom tiap view tidak boleh ditambah,
  dihapus, atau digabung. Hanya lapisan tampilan yang berubah. Pengecualian hanya yang
  tertulis eksplisit di rencana ini.
- **Port byte-per-byte.** Aturan CSS dan nilai token disalin dari
  `docs/design-lantai-bursa-reimagined.html`, tidak ditulis ulang dari ingatan
  (`kemampuan-workflow.md` §169).
- **Hijau/merah hanya untuk arah angka.** Tidak boleh dipakai sebagai warna chrome,
  kategori simpul grafik, atau aksen navigasi. Warna aksen antarmuka = amber.
- **Gerbang build:** `npm --prefix app run build` (bukan `tsc --noEmit`; root tsconfig
  memakai `references` sehingga perintah compiler generik bisa memeriksa nol berkas —
  `kemampuan-web-dev.md` §173).
- **Verifikasi 2 viewport** (proyek ini menimpa aturan tiga layar, lihat
  `memory/viewport-2-layar-saja.md`): laptop `emulate 1536x960x1.25`, telepon
  `emulate 412x915x2.625,mobile,touch` (batas lipatan nyata 810px). **Dua tema** tiap
  halaman. Wajib: `scrollWidth == clientWidth`, console bersih.
- **Satu tugas = satu commit.** Pesan commit berbahasa Indonesia, diakhiri
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Backlog B1–B4 (spec §8) tidak dikerjakan.** Perilaku sekarang dipertahankan: periode
  sektor hanya di tabel sektor, kalender tetap panel, tanggal tunggal, tanpa kolom Δ.

## Temuan penting yang mengubah asumsi spec

Diverifikasi 11 Agustus 2026 sebelum rencana ini ditulis:

`app/src/dasbor/dasbor.css` **sudah memakai palet ink-navy + amber**, bukan teal:
gelap `--bg #0b1017`, `--accent #f0a62b`; terang `--bg #f2f4f7`, `--accent2 #b87a10`.
Nilainya sama persis dengan token artifact. Yang berbeda adalah **nama tokennya**
(`--bg/--bg2/--card/--accent` vs `--bg0/--bg1/--bg2/--amber`) dan **primitifnya** — artifact
punya papan flap, `.tabs`, `.chip`, `.bar-row`, `.rk-row`, `.mc-row`, `.flap` yang belum ada
di kode.

Akibatnya untuk Task 1: pekerjaannya bukan mengganti palet, melainkan **menambahkan
primitif** dan memetakan nama token. Rail, pita kurs, laci telepon, ikon SVG per menu, dan
kode ticker tiga huruf **sudah ada** (`Sidebar.tsx`, `MobileNav.tsx`, `menu.ts`, `PitaKurs.tsx`).

**Tabrakan token yang harus dihindari:** artifact mendefinisikan `--bg2`/`--bg3` di `:root`,
sementara `dasbor.css` mendefinisikan nama yang sama di `.dasbor-shell[data-theme]`. Selektor
yang lebih spesifik menang untuk semua keturunan shell, jadi nilai artifact akan tertimpa
diam-diam. Karena itu blok token artifact **tidak** ditaruh di `:root`, melainkan di dalam
`.lantai` (lihat Task 1 Step 3).

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `app/src/dasbor/lantai.css` | BARU. Token + primitif artifact, seluruhnya di bawah `.lantai` |
| `app/src/dasbor/dasbor.css` | Gaya lama; hidup sampai Task 13, lalu dihapus |
| `app/src/lib/dasbor/ytd.ts` | BARU. Hitung YTD IHSG dari `index.json` |
| `app/src/lib/dasbor/useUrut.ts` | BARU. Pengurutan tabel oleh klik judul kolom |
| `app/src/components/dasbor/Papan.tsx` | BARU. Papan split-flap angka IHSG |
| `app/src/components/dasbor/BatangPeringkat.tsx` | BARU. Daftar batang mendatar divergen (ganti kanvas berlabel miring) |
| `app/src/views/dasbor/*.tsx` | Tiap view dibungkus `.lantai`, kelas dipetakan ke primitif |
| `app/src/views/admin/ChangelogAdmin.tsx` | BARU. Penyaji `docs/CHANGELOG.md` |
| `scripts/fetch_fundamental.py` | Perbaikan galat ditelan + mata uang |
| `.github/workflows/update-fundamental.yml` | Pin versi yfinance |
| `requirements.txt` | Daftarkan yfinance |

---

### Task 1: Fondasi — `lantai.css` + primitif

**Files:**
- Create: `app/src/dasbor/lantai.css`
- Modify: `app/src/components/dasbor/DasborLayout.tsx:6` (impor CSS)
- Reference: `docs/design-lantai-bursa-reimagined.html:4-341`

**Interfaces:**
- Consumes: —
- Produces: kelas `.lantai` beserta primitif `.panel .panel-h .panel-b .grid2 .grid2.w-kiri
  .grid2.w-lebar .grid2.w-agak .grid3 .board .board-main .board-side .flap .flap.sym .chip
  .chip.up .chip.dn .chip.warn .tbl .tick .bchip .tabs .tab .dd .dd-btn .dd-menu .dd-it
  .inp .btn-p .field .tiles .tile .tile.big .bar-row .bar-tr .bar-fl .vcard .cal-strip
  .cal-d .sesi .cal-grid .rank-wrap .rk-row .rk-no .rk-nm .rk-tr .rk-b .rk-v .mc-row .mc-rk
  .kontrib-jd .kb-wrap .kb-tr .kb-bar .kb-v .w-tbl .ytd-bdg .rate .num .lbl .up .dn`,
  dipakai semua task berikutnya.

**Catatan tentang spec §4.12 (panji hijau dibubarkan):** panji itu milik `index_live.html`
lama. Shell React **sudah** tidak memakainya — `DasborLayout.tsx` sudah berisi rail + pita
kurs + kaki halaman, dan `Sidebar.tsx`/`menu.ts` sudah memakai kode ticker tiga huruf serta
ikon SVG. Jadi tidak ada pekerjaan pembubaran panji; yang tersisa dari §4.12 hanyalah
pemindahan angka IHSG ke papan flap (Task 2) dan penyatuan dua kalender (Task 10 Step 4a).

- [ ] **Step 1: Baca sumber, jangan tulis ulang**

Baca `docs/design-lantai-bursa-reimagined.html` baris 4–341 utuh. Semua aturan CSS di rentang
itu akan dipindah apa adanya; nilai warna, ukuran, dan komentar penjelas ikut disalin.

- [ ] **Step 2: Buat `lantai.css` dengan blok token di dalam `.lantai`**

Blok `:root` artifact (baris 6–48) **tidak** disalin sebagai `:root`. Ganti selektornya
seperti ini — nilai-nilainya disalin persis:

```css
/*
 * Token + primitif artifact "Lantai Bursa"
 * (docs/design-lantai-bursa-reimagined.html baris 4-341), disalin verbatim.
 *
 * Blok token SENGAJA tidak di :root. dasbor.css mendefinisikan --bg2/--bg3 di
 * .dasbor-shell[data-theme], selektor yang lebih spesifik daripada :root untuk
 * semua keturunannya, sehingga nilai artifact akan tertimpa diam-diam. Menaruh
 * token di .lantai membuat keduanya hidup berdampingan sampai dasbor.css dihapus
 * (Task 13).
 */
.lantai {
  --bg0:#0B1017; --bg1:#111826; --bg2:#18212F; --bg3:#1F2A3B;
  --line:#232E3F; --line2:#2E3B50;
  --text:#E8EDF4; --text2:#9AA7B8; --text3:#5C6B7E;
  --amber:#F0A62B; --amber-ink:#131008; --amber-dim:rgba(240,166,43,.13);
  --red:#E5484D; --red-dim:rgba(229,72,77,.14);
  --green:#30A46C; --green-dim:rgba(48,164,108,.14);
  --blue:#4C8DFF;
  --flap:#060A10; --flap-line:rgba(255,255,255,.07);
  --mono:"Cascadia Code","Cascadia Mono",Consolas,"SF Mono","Roboto Mono",monospace;
  --disp:"Bahnschrift","Arial Narrow","Segoe UI",system-ui,sans-serif;
  --ui:"Segoe UI",system-ui,-apple-system,sans-serif;
  --r:6px;
  font-family:var(--ui); font-size:13px; line-height:1.5; color:var(--text);
}
.dasbor-shell[data-theme="light"] .lantai{
  --bg0:#F2F4F7; --bg1:#FFFFFF; --bg2:#F7F9FC; --bg3:#EDF1F6;
  --line:#DDE3EA; --line2:#C9D2DD;
  --text:#131B26; --text2:#4E5D70; --text3:#8896A8;
  --amber:#B87A10; --amber-ink:#FFFFFF; --amber-dim:rgba(184,122,16,.10);
  --red:#CE3B41; --red-dim:rgba(206,59,65,.10);
  --green:#1F8A57; --green-dim:rgba(31,138,87,.10);
  --flap:#131B26; --flap-line:rgba(255,255,255,.10);
}
```

- [ ] **Step 3: Salin sisa aturan, tiap selektor diawali `.lantai`**

Aturan baris 58–334 artifact disalin dengan awalan `.lantai `. Contoh pemetaan yang wajib
diikuti (nilai tidak berubah, hanya selektornya):

```css
.lantai .num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.lantai .lbl{font-family:var(--disp);font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--text3)}
.lantai .up{color:var(--green)} .lantai .dn{color:var(--red)}
.lantai .panel{background:var(--bg1);border:1px solid var(--line);border-radius:var(--r)}
.lantai .panel-h{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line)}
.lantai .panel-b{padding:12px 14px}
.lantai .grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;grid-auto-flow:dense}
.lantai .grid2.w-kiri{grid-template-columns:1.25fr 1fr}
```

Aturan `.shell`, `.rail`, `.nav-btn`, `.tape`, `.content`, `.bottom-nav`, `.laci*`
(baris 63–98, 295–334) **dilewati** — padanannya sudah ada di `dasbor.css` sebagai
`.dasbor-rail`, `.dasbor-atas`, `.dasbor-main`, dan laci `MobileNav.tsx`. Menyalinnya
akan membuat dua sistem navigasi bertabrakan.

Blok media `@media (max-width:820px)` (baris 319–334) disalin untuk aturan isi saja
(`.grid2`, `.rank-wrap`, `.rk-row`, `.mc-row`, `.kb-wrap`, `.board`, `.flap`), tanpa aturan
rail/bottom-nav. Blok `@media (prefers-reduced-motion: reduce)` (baris 335–340) disalin utuh.

- [ ] **Step 4: Impor di shell**

`app/src/components/dasbor/DasborLayout.tsx` baris 6, tambahkan setelah impor lama:

```tsx
import '../../dasbor/dasbor.css'
import '../../dasbor/lantai.css'
```

- [ ] **Step 5: Build**

Run: `npm --prefix app run build`
Expected: sukses tanpa galat. CSS baru ikut bundel.

- [ ] **Step 6: Commit**

```bash
git add app/src/dasbor/lantai.css app/src/components/dasbor/DasborLayout.tsx
git commit -m "feat(dasbor): lapisan primitif Lantai Bursa di bawah .lantai

Token ditaruh di .lantai, bukan :root — dasbor.css mendefinisikan --bg2/--bg3
di .dasbor-shell[data-theme] yang lebih spesifik dan akan menimpanya diam-diam.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Indeks Dunia — halaman percontohan + perbaikan YTD

Halaman ini menetapkan pola yang ditiru sembilan halaman lain. Kerjakan dengan teliti;
commit-nya akan dirujuk sebagai contoh di prompt sesi berikutnya.

**Files:**
- Create: `app/src/lib/dasbor/ytd.ts`, `app/src/lib/dasbor/ytd.test.ts`
- Create: `app/src/components/dasbor/Papan.tsx`
- Modify: `app/src/views/dasbor/IndeksDunia.tsx`
- Reference: `docs/design-lantai-bursa-reimagined.html:368-496`

**Interfaces:**
- Consumes: `.lantai` primitif dari Task 1; `useDataHarian()` dari
  `app/src/lib/dasbor/dataHarian.ts`.
- Produces:
  - `hitungYtdPct(ihsgSekarang: number, dates: TanggalIndex[]): number | null`
  - `<Papan nilai={number} />` — merender tiap karakter angka sebagai `.flap`

- [ ] **Step 1: Tulis test yang gagal untuk YTD**

`app/src/lib/dasbor/ytd.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hitungYtdPct } from './ytd'

const dates = [
  { stem: 'ds_260107', date_iso: '2026-01-07', ihsg: 8000, ihsg_pct: 0.1, trading_day: 4 },
  { stem: 'ds_260108', date_iso: '2026-01-08', ihsg: 8100, ihsg_pct: 1.2, trading_day: 5 },
] as never[]

describe('hitungYtdPct', () => {
  it('menghitung persen terhadap tanggal pertama tahun berjalan', () => {
    expect(hitungYtdPct(8400, dates)).toBeCloseTo(5, 6)
  })

  it('memberi null kalau daftar tanggal kosong — jangan diam-diam jadi 0', () => {
    expect(hitungYtdPct(8400, [])).toBeNull()
  })

  it('memberi null kalau harga acuan nol', () => {
    const nol = [{ stem: 'x', date_iso: '2026-01-07', ihsg: 0, ihsg_pct: 0, trading_day: 1 }] as never[]
    expect(hitungYtdPct(8400, nol)).toBeNull()
  })
})
```

Butir kedua adalah inti temuan A: nilai yang tidak diketahui **wajib** `null` supaya tampil
sebagai "—", bukan `+0,00%` yang terbaca seperti angka nyata.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm --prefix app test -- ytd`
Expected: FAIL — `Failed to resolve import "./ytd"`.

- [ ] **Step 3: Tulis implementasi minimal**

`app/src/lib/dasbor/ytd.ts`:

```ts
import type { TanggalIndex } from './dataHarian'

/**
 * Persen IHSG tahun berjalan terhadap hari bursa pertama di `index.json`.
 *
 * Sebelumnya nilai ini dibaca dari ruas `ihsg_ytd` di ds_*.json (index_live.html
 * baris 2725) — ruas yang tidak pernah ada, sehingga `?? 0` membuatnya selalu
 * tampil +0,00%. Mengembalikan null, bukan 0, supaya "tidak diketahui" tidak
 * menyamar jadi "tidak berubah".
 */
export function hitungYtdPct(ihsgSekarang: number, dates: TanggalIndex[]): number | null {
  const awal = dates[0]?.ihsg
  if (!awal) return null
  return (ihsgSekarang / awal - 1) * 100
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npm --prefix app test -- ytd`
Expected: PASS 3 test.

- [ ] **Step 5: Buat komponen Papan**

`app/src/components/dasbor/Papan.tsx`:

```tsx
/**
 * Papan split-flap — tiap karakter angka jadi satu kartu .flap, pemisah ribuan
 * dan koma memakai varian .sym. Port docs/design-lantai-bursa-reimagined.html
 * baris 121-129 (animasi flip + jeda bertahap per kartu ada di CSS).
 */
export function Papan({ nilai }: { nilai: number }) {
  const teks = nilai.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <div className="flap-row">
      {[...teks].map((ch, i) => (
        <span key={i} className={/\d/.test(ch) ? 'flap' : 'flap sym'}>{ch}</span>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Bungkus view dan pasang papan**

Di `app/src/views/dasbor/IndeksDunia.tsx`, bungkus seluruh keluaran dengan
`<div className="lantai">…</div>`, lalu:

1. Ganti blok angka IHSG teratas dengan `.board` + `<Papan nilai={hari.ihsg_value} />`,
   `.lbl` untuk baris tanggal, `.chip dn`/`.chip up` untuk perubahan, `.board-meta` untuk
   Volume/Nilai/Frekuensi/Kapitalisasi/USD-IDR.
2. Tampilkan YTD dari `hitungYtdPct(hari.ihsg_value, dates)`; kalau `null`, render `—`.
3. Ganti kelas kartu lama ke `.panel` + `.panel-h` + `.panel-b`, tabel ke `.tbl`,
   lencana persen ke `.ytd-bdg u`/`.ytd-bdg d`.
4. Peringkat YTD 35 negara: pertahankan daftar batang mendatar yang sudah ada, ganti kelasnya
   ke `.rank-wrap`/`.rk-row`/`.rk-no`/`.rk-nm`/`.rk-tr`/`.rk-b`/`.rk-v`, baris Indonesia
   dapat kelas tambahan `kita`.

Jangan menambah, menghapus, atau menggabung blok mana pun.

- [ ] **Step 7: Build + verifikasi tampilan**

Run: `npm --prefix app run build`
Lalu jalankan dev server dan periksa `/` di dua tab chrome-devtools:

```
tab laptop   emulate 1536x960x1.25
tab telepon  emulate 412x915x2.625,mobile,touch
```

Tiap tab, dua tema. Wajib lulus:
- `document.documentElement.scrollWidth === document.documentElement.clientWidth`
- console bersih
- YTD menampilkan angka nyata (bukan +0,00%)
- lebar kanvas grafik > 2px sebelum digambar

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/dasbor/ytd.ts app/src/lib/dasbor/ytd.test.ts \
        app/src/components/dasbor/Papan.tsx app/src/views/dasbor/IndeksDunia.tsx
git commit -m "feat(dasbor): Indeks Dunia gaya Lantai Bursa + perbaikan YTD selalu 0

YTD dulu dibaca dari ruas ihsg_ytd yang tidak pernah ada di ds_*.json
(index_live.html:2725), jatuh ke ?? 0 sehingga selalu +0,00%. Sekarang dihitung
dari index.json yang memang sudah dimuat. Nilai tak diketahui jadi null, bukan 0.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Kritik & Saran

**Files:**
- Modify: `app/src/views/dasbor/Feedback.tsx`
- Reference: `docs/design-lantai-bursa-reimagined.html:738-778`

**Interfaces:**
- Consumes: `.lantai` primitif (Task 1), pola view dari Task 2.
- Produces: —

- [ ] **Step 1: Bungkus dan petakan kelas**

Bungkus keluaran dengan `<div className="lantai">`. Pemetaan:

| Elemen | Kelas baru |
|---|---|
| kartu | `.panel` + `.panel-h` + `.panel-b` |
| judul kecil | `.lbl` |
| isian teks | `.inp` |
| label isian | `.field` + `.lbl` |
| tombol kirim | `.btn-p` |
| tombol nilai 1–5 | `.rate` + `.rate button`, terpilih dapat `.on` |

Isi teks, tautan WhatsApp, dan urutan blok tidak berubah.

- [ ] **Step 2: Build**

Run: `npm --prefix app run build` — Expected: sukses.

- [ ] **Step 3: Verifikasi 2 viewport × 2 tema di `/feedback`**

Wajib: `scrollWidth == clientWidth`, console bersih, tombol nilai tetap bisa dipilih.

- [ ] **Step 4: Commit**

```bash
git add app/src/views/dasbor/Feedback.tsx
git commit -m "feat(dasbor): Kritik & Saran gaya Lantai Bursa

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Kalkulator JIA — tata ulang dua kolom

**Files:**
- Modify: `app/src/views/dasbor/KalkulatorJia.tsx`
- Modify: `app/src/views/dasbor/kalkulator/AvgDown.tsx`, `ProfitAra.tsx`, `RiskReward.tsx`,
  `Dividen.tsx`
- Reference: `docs/design-lantai-bursa-reimagined.html:710-737`

**Interfaces:**
- Consumes: `.lantai` primitif, pola Task 2.
- Produces: —

**Rumus dan isian tidak boleh disentuh** — empat formula sudah diverifikasi manual
(papan #3). Yang berubah hanya wadahnya.

- [ ] **Step 1: Sub-menu jadi `.tabs`**

Di `KalkulatorJia.tsx`, ganti empat tombol selebar halaman menjadi:

```tsx
<div className="tabs" role="tablist">
  {SUB.map((s) => (
    <button
      key={s.id}
      role="tab"
      aria-selected={aktif === s.id}
      className={'tab' + (aktif === s.id ? ' on' : '')}
      onClick={() => setAktif(s.id)}
    >
      {s.label}
    </button>
  ))}
</div>
```

`.tabs` memakai `width:max-content` sehingga lebar mengikuti isi, tinggi seragam —
`kemampuan-web-dev.md` §177: tinggi wajib sama, lebar justru jangan diseragamkan.

- [ ] **Step 2: Fee pindah ke kepala panel**

Baris Fee Beli/Fee Jual yang sekarang melayang di luar panel dipindah ke `.panel-h` panel
kalkulator aktif, sebagai dua `.inp` sempit (`style={{width:72}}`) berlabel `.lbl`.

- [ ] **Step 3: Dua kolom dengan hasil menempel**

Isi tiap sub-kalkulator dibungkus:

```tsx
<div className="grid2 w-kiri">
  <div>{/* isian: posisi saham, strategi, angka */}</div>
  <div style={{ position: 'sticky', top: 60, alignSelf: 'start' }}>
    {/* ringkasan hasil */}
  </div>
</div>
```

Ini yang menjawab keluhan asal: mengubah angka di kiri, akibatnya langsung terlihat di kanan
tanpa menggulir.

- [ ] **Step 4: Daftar strategi jadi pil**

Lima baris radio Average Down (`Half Loss`, `Loss Max`, `End Average`, `Average Down Qty`,
`Average Down Value`) jadi `.tabs` tegak — tetap `<input type="radio">` untuk aksesibilitas,
tapi labelnya bergaya `.tab`, dan keterangan satu baris memakai `.vcard .v-note`.

- [ ] **Step 5: Build + verifikasi**

Run: `npm --prefix app run build`
Verifikasi `/kalkulator` 2 viewport × 2 tema. Tambahan wajib untuk halaman ini: **uji satu
hitungan per sub-tab** dan bandingkan dengan nilai sebelum perubahan — angka harus identik.

- [ ] **Step 6: Commit**

```bash
git add app/src/views/dasbor/KalkulatorJia.tsx app/src/views/dasbor/kalkulator
git commit -m "feat(dasbor): Kalkulator JIA dua kolom, hasil menempel

Sub-menu jadi tab berlebar-isi (§177), fee masuk kepala panel, hasil menempel di
kanan supaya perubahan angka langsung terlihat akibatnya. Rumus tidak disentuh.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Top Stocks

**Files:**
- Modify: `app/src/views/dasbor/TopStocks.tsx`
- Reference: `docs/design-lantai-bursa-reimagined.html:497-557`

**Interfaces:**
- Consumes: `.lantai` primitif, pola Task 2.
- Produces: —

Enam blok yang wajib tetap ada, dengan nomor barisnya sekarang: Top 10 Market Capitalization
(:56), Top Gainers (:80), Top Losers (:96), Top Leaders Kontribusi (:115), Top Leaders YTD
(:121), Top Laggards Kontribusi (:128), Top Laggards YTD (:134).

- [ ] **Step 1: Bungkus `.lantai`, petakan kelas umum**

`.ct gold`/`.ct g`/`.ct r` (judul blok) → `.lbl` di dalam `.panel-h`; kartu → `.panel`;
tabel → `.tbl` dengan `.r` untuk kolom kanan; kode emiten → `.tick`; persen → `.up`/`.dn`.

- [ ] **Step 2: Top 10 Market Cap pakai `.mc-row`**

```tsx
<div className="panel-b">
  {mcap.map((m, i) => (
    <div className="mc-row" key={m.code}>
      <span className={'mc-rk' + (i < 3 ? ` rk${i + 1}` : '')}>{i + 1}</span>
      <span className="tick">{m.code}</span>
      <div className="bar-tr"><div className="bar-fl" style={{ width: `${(m.value / maks) * 100}%` }} /></div>
      <span className="mc-v num">{fmtT(m.value)}</span>
      <span className="mc-p num">{fmtP(m.pct)}</span>
    </div>
  ))}
</div>
```

Peringkat 1–3 mendapat `.rk1/.rk2/.rk3` (amber, perak, perunggu) sesuai artifact baris 264–266.

- [ ] **Step 3: Gainers/Losers tetap dua tabel sebaris**

Bungkus `<div className="grid2">` — `auto-fit minmax(340px,1fr)` membuatnya menumpuk sendiri
di telepon tanpa media query tambahan.

- [ ] **Step 4: Build + verifikasi 2 viewport × 2 tema di `/stocks`**

- [ ] **Step 5: Commit**

```bash
git add app/src/views/dasbor/TopStocks.tsx
git commit -m "feat(dasbor): Top Stocks gaya Lantai Bursa

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Top Broker + pengurutan kolom

**Files:**
- Create: `app/src/lib/dasbor/useUrut.ts`, `app/src/lib/dasbor/useUrut.test.ts`
- Modify: `app/src/views/dasbor/TopBroker.tsx`
- Modify: `app/src/views/dasbor/TopStocks.tsx` (pasang pengurutan pada 6 tabelnya)
- Reference: `docs/design-lantai-bursa-reimagined.html:558-581`

**Interfaces:**
- Consumes: `.lantai` primitif.
- Produces:
  - `bandingkanBaris<T>(a: T, b: T, kunci: keyof T, arah: 'naik' | 'turun'): number` (fungsi murni, diuji langsung)
  - `useUrut<T>(baris: T[], awal: keyof T): { urut: T[]; kunci: keyof T; arah: 'naik' | 'turun'; klik: (k: keyof T) => void }`

- [ ] **Step 1: Tulis test yang gagal — untuk fungsi murni, bukan hook**

`useUrut` sendiri hanyalah `useState`+`useMemo` di atas satu perbandingan; perbandingan itu
yang punya logika untuk diuji, dan itu bisa diuji sebagai fungsi biasa tanpa merender React
sama sekali. Menguji lewat `renderHook` akan menuntut devDependency baru
(`@testing-library/react`) untuk sesuatu yang tidak butuh itu — melanggar ladder "dependency
yang sudah terpasang dulu, baru tambah baru".

`app/src/lib/dasbor/useUrut.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { bandingkanBaris } from './useUrut'

describe('bandingkanBaris', () => {
  it('membandingkan angka secara numerik, turun', () => {
    expect(bandingkanBaris({ nilai: 3 }, { nilai: 1 }, 'nilai', 'turun')).toBeLessThan(0)
  })

  it('membalik urutan saat arah naik', () => {
    expect(bandingkanBaris({ nilai: 3 }, { nilai: 1 }, 'nilai', 'naik')).toBeGreaterThan(0)
  })

  it('membandingkan teks dengan localeCompare id, bukan urutan byte', () => {
    // 'Zebra' < 'apel' secara byte (Z=90 < a=97), tapi salah secara alfabet id-ID
    const hasil = bandingkanBaris({ nama: 'apel' }, { nama: 'Zebra' }, 'nama', 'turun')
    expect(hasil).toBeGreaterThan(0) // turun: apel setelah Zebra
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm --prefix app test -- useUrut`
Expected: FAIL — `Failed to resolve import "./useUrut"`.

- [ ] **Step 3: Implementasi**

`app/src/lib/dasbor/useUrut.ts`:

```ts
import { useMemo, useState } from 'react'

/**
 * Perbandingan satu pasang baris berdasar satu kunci. Fungsi murni supaya bisa
 * diuji tanpa merender React — useUrut di bawah cuma menyimpan state di atasnya.
 */
export function bandingkanBaris<T extends Record<string, unknown>>(
  a: T,
  b: T,
  kunci: keyof T,
  arah: 'naik' | 'turun',
): number {
  const x = a[kunci]
  const y = b[kunci]
  const c =
    typeof x === 'number' && typeof y === 'number'
      ? x - y
      : String(x ?? '').localeCompare(String(y ?? ''), 'id')
  return arah === 'naik' ? c : -c
}

/**
 * Pengurutan tabel oleh klik judul kolom. Dipakai bersama 6 tabel Top Broker dan
 * 6 tabel Top Stocks — satu helper, bukan satu keadaan per tabel per berkas.
 */
export function useUrut<T extends Record<string, unknown>>(baris: T[], awal: keyof T) {
  const [kunci, setKunci] = useState<keyof T>(awal)
  const [arah, setArah] = useState<'naik' | 'turun'>('turun')

  const urut = useMemo(
    () => [...baris].sort((a, b) => bandingkanBaris(a, b, kunci, arah)),
    [baris, kunci, arah],
  )

  function klik(k: keyof T) {
    if (k === kunci) setArah((a) => (a === 'naik' ? 'turun' : 'naik'))
    else {
      setKunci(k)
      setArah('turun')
    }
  }

  return { urut, kunci, arah, klik }
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npm --prefix app test -- useUrut`
Expected: PASS 3 test.

- [ ] **Step 5: Pasang di 6 tabel Top Broker**

Judul kolom jadi tombol; tanda arah memakai `▲`/`▼`:

```tsx
<th className="r">
  <button onClick={() => klik('nilai')}>
    Nilai {kunci === 'nilai' ? (arah === 'naik' ? '▲' : '▼') : ''}
  </button>
</th>
```

Blok yang wajib tetap ada: Top Stock Trading by Volume/Value/Frequency (`TopBroker.tsx:56`),
Top Broker by Volume (:84), by Value (:91), by Frequency (:98). Kode broker memakai `.bchip`,
nama broker teks biasa.

- [ ] **Step 6: Pasang di 6 tabel Top Stocks**

Perlakuan sama untuk keenam tabel di `TopStocks.tsx`.

- [ ] **Step 7: Build + verifikasi**

Run: `npm --prefix app run build`
Verifikasi `/broker` dan `/stocks`, 2 viewport × 2 tema. Uji klik: judul kolom mengurutkan,
klik kedua membalik arah, kolom lain mulai dari menurun.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/dasbor/useUrut.ts app/src/lib/dasbor/useUrut.test.ts \
        app/src/views/dasbor/TopBroker.tsx app/src/views/dasbor/TopStocks.tsx app/package.json
git commit -m "feat(dasbor): Top Broker gaya Lantai Bursa + urut lewat judul kolom

Satu helper useUrut dipakai 12 tabel (6 Top Broker + 6 Top Stocks), bukan keadaan
pengurutan per tabel.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Sektor & Indeks — batang mendatar + periode

**Files:**
- Create: `app/src/components/dasbor/BatangPeringkat.tsx`
- Modify: `app/src/views/dasbor/SektorIndeks.tsx`
- Reference: `docs/design-lantai-bursa-reimagined.html:582-598`, `240-256`

**Interfaces:**
- Consumes: `.lantai` primitif; ruas `sectors:[{n,v,d,ytd}]` dari `useDataHarian()`
  (terverifikasi ada di seluruh 93 berkas harian).
- Produces: `<BatangPeringkat baris={{nama: string; nilai: number}[]} sorot?: string />`

- [ ] **Step 1: Buat komponen batang mendatar**

`app/src/components/dasbor/BatangPeringkat.tsx`:

```tsx
/**
 * Daftar batang mendatar divergen dari sumbu nol. Menggantikan grafik kanvas
 * berlabel miring: 11 nama sektor panjang diputar ~60° sampai bertumpuk tak
 * terbaca — kegagalan yang sama dengan Peringkat YTD (papan #23).
 *
 * Teks HTML ikut token tema otomatis, bisa disalin, dan terbaca pembaca layar;
 * label yang digambar ke kanvas tidak punya satu pun dari ketiganya.
 */
export function BatangPeringkat({
  baris,
  sorot,
}: {
  baris: { nama: string; nilai: number }[]
  sorot?: string
}) {
  const maks = Math.max(...baris.map((b) => Math.abs(b.nilai)), 1)
  return (
    <div className="rank-wrap">
      {baris.map((b, i) => {
        const lebar = (Math.abs(b.nilai) / maks) * 50
        const positif = b.nilai >= 0
        return (
          <div className={'rk-row' + (b.nama === sorot ? ' kita' : '')} key={b.nama}>
            <span className="rk-no">{i + 1}</span>
            <span className="rk-nm" title={b.nama}>{b.nama}</span>
            <div className="rk-tr" style={{ ['--nol' as string]: '50%' }}>
              <div
                className={'rk-b ' + (positif ? 'p' : 'n')}
                style={positif ? { left: '50%', width: `${lebar}%` } : { right: '50%', width: `${lebar}%` }}
              />
            </div>
            <span className={'rk-v num ' + (positif ? 'up' : 'dn')}>
              {b.nilai.toFixed(2)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Ganti dua grafik kanvas**

Di `SektorIndeks.tsx`, ganti grafik "Sektor — YTD vs Hari Ini" dan "YTD — Perbandingan Semua
Indeks Utama" dengan `<BatangPeringkat />`. Hapus pemanggilan Chart.js untuk kedua blok
tersebut beserta `useEffect` pembersihnya. Judul blok tetap.

- [ ] **Step 3: Pemilih periode di tabel sektor**

```tsx
const PERIODE = [
  { id: 'd', label: 'Hari Ini' },
  { id: 'm1', label: '1 Bulan' },
  { id: 'm3', label: '3 Bulan' },
  { id: 'ytd', label: 'YTD' },
] as const
```

`d` dan `ytd` dibaca langsung dari ruas berkas harian. `m1`/`m3` dihitung
`v_sekarang / v_pembanding − 1`, dengan `v_pembanding` diambil dari **satu** berkas
`ds_*.json` tambahan: tanggal bursa terdekat ≤ (tanggal aktif − 30 atau − 91 hari) menurut
`index.json`. Kalau tanggal pembanding tidak ada, tampilkan `—`, jangan 0.

Pemilih ini **hanya dipasang di tabel sektor** — tabel indeks tidak (backlog B1).

- [ ] **Step 4: Petakan kelas sisanya**

Tabel Performa Sektor, Indeks Unggulan, Indeks Syariah, Board Indices → `.panel` + `.tbl`,
lencana persen → `.ytd-bdg u`/`.ytd-bdg d` (lebar terkunci `min-width:62px` sehingga kolom
persen rata). Struktur dan isi tabel tidak berubah.

- [ ] **Step 5: Build + verifikasi**

Run: `npm --prefix app run build`
Verifikasi `/sector`, 2 viewport × 2 tema. Wajib: nama sektor terbaca lurus (tidak diputar),
`scrollWidth == clientWidth`, pindah periode mengubah angka, periode tanpa data pembanding
menampilkan `—`.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/dasbor/BatangPeringkat.tsx app/src/views/dasbor/SektorIndeks.tsx
git commit -m "feat(dasbor): Sektor & Indeks — batang mendatar ganti kanvas, periode 1B/3B

11 nama sektor panjang diputar 60 derajat di kanvas sampai bertumpuk; diganti
daftar batang HTML yang ikut token tema dan terbaca pembaca layar (pola papan #23).
Periode 1B/3B butuh satu berkas pembanding, bukan 93.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Chart — tema heatmap + Fullscreen API

**Files:**
- Modify: `app/src/views/dasbor/ChartIndeks.tsx:65-73,102,123-135,140,154,184,190`
- Reference: `docs/design-lantai-bursa-reimagined.html:599-617`

**Interfaces:**
- Consumes: `.lantai` primitif; `useTheme()` dari `context/ThemeContext`.
- Produces: —

- [ ] **Step 1: Perbaiki tema heatmap**

`ChartIndeks.tsx:102` — ganti nilai tetap dengan tema aplikasi:

```tsx
colorTheme: theme,
```

`theme` sudah tersedia di komponen ini (baris 59). Chart utama sudah memakainya (baris 170);
heatmap tertinggal sehingga tetap hitam di tema terang.

- [ ] **Step 2: Ganti expand manual dengan Fullscreen API**

Hapus: keadaan `expanded` (:62), efek penangkap ESC (:65–73), `mobileFsHeight` (:123–135),
`CLOSE_BTN_STYLE` beserta dua tombol Tutup (:140, :184), dan kelas `.tv-fullscreen`.
Gantinya:

```tsx
const chartRef = useRef<HTMLDivElement>(null)
const heatRef = useRef<HTMLDivElement>(null)

function penuh(ref: React.RefObject<HTMLDivElement | null>) {
  ref.current?.requestFullscreen?.()
}
```

Tombol expand jadi:

```tsx
<button className="tab" onClick={() => penuh(chartRef)} title="Layar penuh">⛶ Layar Penuh</button>
```

Peramban menangani ESC, tinggi telepon, urutan tumpuk, dan tombol keluar — empat hal yang
sebelumnya ditiru manual.

- [ ] **Step 3: Rapikan dua baris tombol**

Baris pertama (Featured · Co-Branding · Syariah) → `.tabs` + `.tab`, aktif `.tab.on`.
Baris kedua (IHSG, LQ45, IDX30, IDX80, High Div20, BUMN20, Value30, Growth30, Quality30) →
tombol `.bchip`, aktif diberi `style={{borderColor:'var(--amber)',color:'var(--amber)'}}`.
Tombol Layar Penuh pindah ke kanan `.panel-h`, sebaris judul panel.

- [ ] **Step 4: Build + verifikasi**

Run: `npm --prefix app run build`
Verifikasi `/chart`, 2 viewport × 2 tema. Wajib: heatmap ikut berubah saat tema diganti;
layar penuh bekerja dan ESC menutupnya; pindah menu lalu kembali tidak memunculkan galat
`Cannot read properties of null` di console (penjaga StrictMode papan #4 tetap ada).

- [ ] **Step 5: Commit**

```bash
git add app/src/views/dasbor/ChartIndeks.tsx
git commit -m "fix(dasbor): heatmap ikut tema + expand pakai Fullscreen API

colorTheme heatmap dipatok 'dark' sementara chart utama ikut useTheme, sehingga
heatmap tetap hitam di tema terang. Expand manual (kelas, ESC, tinggi telepon)
diganti requestFullscreen bawaan peramban — diffnya minus.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Pipeline Yahoo — kegagalan berisik, versi terkunci, mata uang benar

Tugas ini menyentuh Python, bukan tampilan. Boleh dikerjakan kapan saja sebelum Task 11,
tapi **wajib selesai sebelum Task 11**.

**Files:**
- Modify: `scripts/fetch_fundamental.py:287-290,511`
- Modify: `.github/workflows/update-fundamental.yml:41`
- Modify: `requirements.txt`
- Create: `scripts/test_konversi.py`

**Interfaces:**
- Consumes: —
- Produces: `konversi_ke_idr(nilai: float | None, mata_uang: str, kurs_usd_idr: float) -> float | None`
  di `scripts/fetch_fundamental.py`.

- [ ] **Step 1: Tulis test konversi yang gagal**

`scripts/test_konversi.py`:

```python
"""Jalankan: python scripts/test_konversi.py — nol framework, sesuai konvensi repo."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from fetch_fundamental import konversi_ke_idr

def main():
    assert konversi_ke_idr(0.446, "USD", 16000) == 7136.0, "USD wajib dikali kurs"
    assert konversi_ke_idr(4460, "IDR", 16000) == 4460, "IDR tidak diubah"
    assert konversi_ke_idr(None, "USD", 16000) is None, "None tetap None"
    assert konversi_ke_idr(0.446, "USD", 0) is None, "kurs nol = tak bisa dihitung, bukan 0"
    print("OK")

if __name__ == "__main__":
    main()
```

Butir terakhir penting: kurs yang hilang harus membuat hasilnya tak diketahui, bukan nol —
akar temuan C adalah nilai gagal yang menyamar jadi nilai sah.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `python scripts/test_konversi.py`
Expected: `ImportError: cannot import name 'konversi_ke_idr'`.

- [ ] **Step 3: Implementasi konversi + pakai `financialCurrency`**

Tambahkan di `scripts/fetch_fundamental.py`:

```python
def konversi_ke_idr(nilai, mata_uang, kurs_usd_idr):
    """Samakan satuan angka laporan keuangan ke IDR.

    AADI (dan emiten pelapor-USD lain) melaporkan keuangan dalam USD sementara
    harganya IDR; membaginya mentah-mentah menghasilkan PB 20.683x. Sebelumnya
    skrip hanya membaca `currency` (mata uang HARGA) dan tidak pernah membaca
    `financialCurrency`.
    """
    if nilai is None:
        return None
    if mata_uang == "IDR":
        return nilai
    if not kurs_usd_idr:
        return None
    return nilai * kurs_usd_idr
```

Di `fetch_stock()`, baca `fin_cur = sg(info, "financialCurrency") or "IDR"` dan kurs dari
berkas harian terbaru (`data/ds_*.json`, ruas `usd_idr`). Terapkan `konversi_ke_idr` pada
ruas per-saham berbasis laporan: `bv`, `rev_ps`, `cash_ps`, `fcf_ps`, `eps`, `eps_fwd`, dan
rasio turunannya dihitung ulang **setelah** konversi, bukan diambil mentah dari Yahoo.

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `python scripts/test_konversi.py`
Expected: `OK`.

- [ ] **Step 5: Hentikan galat yang ditelan**

Ganti `fetch_fundamental.py:287-290`:

```python
        try:
            hist = t.history(period="1y")
            pp   = price_perf(hist)
        except Exception as e:
            print(f"   ! {ticker_jk} price_perf gagal: {type(e).__name__}: {e}", flush=True)
            gagal_price_perf.append(ticker_jk)
            hist, pp = None, {}
```

Di akhir `main()`, sebelum keluar:

```python
    rasio = len(gagal_price_perf) / max(len(tickers), 1)
    print(f"price_perf gagal: {len(gagal_price_perf)}/{len(tickers)} ({rasio:.1%})")
    if rasio > 0.05:
        print("GAGAL: lebih dari 5% saham tidak mendapat price_perf.")
        sys.exit(1)
```

Inilah yang mengubah kegagalan senyap jadi kegagalan berisik. Tanpa ini, 957 dari 957 berkas
kosong selama dua bulan tanpa satu pun tanda.

- [ ] **Step 6: Kunci versi yfinance**

`requirements.txt`, tambahkan baris:

```
yfinance==0.2.66
```

`.github/workflows/update-fundamental.yml:41`:

```yaml
          pip install -r requirements.txt pandas openpyxl --quiet
```

Versi tepatnya diverifikasi dulu dengan `pip index versions yfinance`; pilih versi stabil
terbaru saat mengerjakan, lalu tulis angkanya. Jangan biarkan tanpa versi — Yahoo berkali
mengubah crumb/cookie dan yfinance ikut berubah, sehingga "jalan bulan lalu" tidak menjamin
"jalan bulan ini".

- [ ] **Step 7: Uji satu saham sungguhan**

Run: `python scripts/fetch_fundamental.py --semua` lalu periksa:

```bash
python -c "import json;d=json.load(open('data/fundamental/AADI.json',encoding='utf-8'));print(d['pb'], bool(d['price_perf']))"
```

Expected: `pb` masuk akal (satuan puluhan, bukan puluhan ribu) dan `price_perf` **tidak**
kosong. Kalau langkah ini gagal dengan 401/429 beruntun, itu tanda IP diblokir Yahoo —
jalankan dari komputer user, bukan Actions (spec §4.6b-4), dan catat temuannya.

- [ ] **Step 8: Commit**

```bash
git add scripts/fetch_fundamental.py scripts/test_konversi.py requirements.txt \
        .github/workflows/update-fundamental.yml
git commit -m "fix(data): mata uang laporan, kegagalan berisik, versi yfinance terkunci

financialCurrency tidak pernah dibaca sehingga emiten pelapor-USD menghasilkan
PB 20.683x. Galat t.history() ditelan diam-diam sehingga price_perf kosong
957/957 selama dua bulan. yfinance dipasang tanpa versi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Broker Summary — verifikasi sumber, lalu reskin

**Files:**
- Create: `scripts/cek_broker_summary.py`
- Modify: `app/src/views/dasbor/BrokerSummary.tsx` dan
  `app/src/views/dasbor/broker-summary/{Flow,Inventory,Nego,Quadrant}.tsx`
- Reference: `docs/design-lantai-bursa-reimagined.html:671-709`

**Interfaces:**
- Consumes: `.lantai` primitif; `BS_DATA`/`BS_AVAIL` dari
  `app/src/lib/dasbor/brokerSummaryData.ts`.
- Produces: catatan hasil verifikasi sumber di `docs/RENCANA-REFACTOR-REACT.md`.

- [ ] **Step 1: Uji apakah IDX menyediakan ringkasan broker harian**

`scripts/cek_broker_summary.py` — pakai pola Playwright + header yang sudah terbukti lolos di
`download_idx.py` (baris 24, 35):

```python
"""Sekali jalan: cek apakah idx.co.id menyediakan ringkasan broker harian.

Ini VERIFIKASI, bukan pemanenan. Hasilnya menentukan apakah halaman Broker
Summary bisa naik kelas dari Alpha (data tertanam 3 hari) jadi harian.
"""
from playwright.sync_api import sync_playwright

KANDIDAT = [
    "https://www.idx.co.id/primary/TradingSummary/GetBrokerSummary?date=20260604&start=1&length=10",
    "https://www.idx.co.id/primary/TradingSummary/GetStockSummary?date=20260604&start=1&length=10",
]

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.goto("https://www.idx.co.id/id/data-pasar/ringkasan-perdagangan", wait_until="networkidle", timeout=60000)
    for url in KANDIDAT:
        r = pg.request.get(url)
        print(url.split("?")[0], "->", r.status, r.text()[:200].replace("\n", " "))
    b.close()
```

Run: `python scripts/cek_broker_summary.py`

- [ ] **Step 2: Catat hasilnya sebelum menyentuh tampilan**

Tulis hasil verifikasi (status HTTP + cuplikan) sebagai baris papan pekerjaan di
`docs/RENCANA-REFACTOR-REACT.md`. Dua cabang:

- **Ada dan berisi 88 broker** → hentikan tugas ini, buat baris backlog baru "sambungkan
  Broker Summary ke sumber harian", dan kerjakan reskin **setelah** bentuk datanya pasti.
  Mempercantik halaman yang bentuknya akan berubah adalah pekerjaan yang dibuang dua kali.
- **Tidak ada / diblokir** → lanjut Step 3.

- [ ] **Step 3: Jujurkan status data di layar**

Ganti pemilih tanggal yang tampak hidup dengan keterangan tetap di `.panel-h`:

```tsx
<span className="chip warn">
  Data contoh {BS_AVAIL[0]} – {BS_AVAIL[BS_AVAIL.length - 1]} · tidak diperbarui
</span>
```

- [ ] **Step 4a: Satukan dua kalender lewat shim tipis**

`BsDatePicker.tsx` (131 baris) hidup berdampingan dengan `Kalender.tsx` (292 baris) yang
dipakai 4 view lain. Satukan dengan **re-export tipis**, bukan mengedit semua pemanggil
(`kemampuan-web-dev.md` §168):

```tsx
// app/src/components/dasbor/BsDatePicker.tsx — isi lama diganti seluruhnya
import { Kalender } from './Kalender'

/**
 * Lapisan kompatibilitas: Broker Summary dulu memakai pemilih tanggal sendiri.
 * Nama komponen dipertahankan supaya pemanggilnya tidak perlu diubah; isinya
 * satu implementasi kalender yang sama dengan empat view lain (§168).
 */
export function BsDatePicker(props: { tanggalTersedia: string[]; tanggalAktif: string; onPilih: (t: string) => void }) {
  return <Kalender {...props} />
}
```

Kalau `Kalender` ternyata menuntut prop yang tidak dipunyai Broker Summary, **hentikan
penyatuan** dan catat sebagai baris backlog — jangan mengubah antarmuka `Kalender` yang
sudah dipakai empat view demi satu pemanggil.

- [ ] **Step 4: Petakan kelas**

Empat kartu ringkasan atas → `.grid3` + `.vcard` (`.v-num` untuk angka, `.v-note` untuk
keterangan). Empat tab (Inventory, Kuadran, NEGO, Flow) → `.tabs` + `.tab`. Tabel → `.tbl`,
kode broker → `.bchip`, batang nilai → `.bar-tr`/`.bar-fl`.

- [ ] **Step 5: Build + verifikasi**

Run: `npm --prefix app run build`
Verifikasi `/broker-summary`, 2 viewport × 2 tema. Wajib: Foreign Net negatif tampil dengan
tanda dan satuan benar (perbaikan `fmtLot` papan #5 tidak boleh mundur).

- [ ] **Step 6: Commit**

```bash
git add scripts/cek_broker_summary.py app/src/views/dasbor/BrokerSummary.tsx \
        app/src/views/dasbor/broker-summary docs/RENCANA-REFACTOR-REACT.md
git commit -m "feat(dasbor): Broker Summary gaya Lantai Bursa + status data dijujurkan

Data halaman ini tertanam 3 hari (2026-06-02..04) tapi tanggalnya tampak hidup.
Sumber harian IDX diverifikasi lebih dulu; hasilnya dicatat di papan pekerjaan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Stock Detail — dua tab

**Files:**
- Modify: `app/src/views/dasbor/StockDetail.tsx`
- Modify: `app/src/views/dasbor/stock-detail/{KolomKuartalan,KolomLaporan,KolomValuasi,PanelValuasiInteraktif}.tsx`
- Reference: `docs/design-lantai-bursa-reimagined.html:618-647`

**Prasyarat:** Task 9 selesai — kalau tidak, halaman ini akan direskin di atas angka yang
masih salah dan hasilnya tidak bisa diverifikasi.

**Interfaces:**
- Consumes: `.lantai` primitif; `useSearchParams` dari react-router-dom.
- Produces: —

- [ ] **Step 1: Dua tab lewat parameter URL**

```tsx
const [sp, setSp] = useSearchParams()
const tab = sp.get('tab') === 'valuasi' ? 'valuasi' : 'statistik'

<div className="tabs" role="tablist">
  <button role="tab" aria-selected={tab === 'statistik'}
    className={'tab' + (tab === 'statistik' ? ' on' : '')}
    onClick={() => setSp({ tab: 'statistik' }, { replace: true })}>Statistik</button>
  <button role="tab" aria-selected={tab === 'valuasi'}
    className={'tab' + (tab === 'valuasi' ? ' on' : '')}
    onClick={() => setSp({ tab: 'valuasi' }, { replace: true })}>Valuasi</button>
</div>
```

Pembagian isi:

| Tab | Blok |
|---|---|
| `statistik` | Current Valuation, Per Share, Solvency, Income Statement TTM, Balance Sheet LQ, Cash Flow TTM, Price Performance, Profitabilitas, kuartalan Net Income/EPS/Revenue, Dividen & Yield, Info Pasar |
| `valuasi` | Graham Valuation Calculator, Graham Classic/Growth, NCAV, Relative Valuation, DDM, Tren Historis per Saham |

Modal ditolak: isi valuasi punya isian simulasi (EPS, growth, risk-free, required return) yang
hasilnya hilang saat modal ditutup, dan tautannya tidak bisa dibagikan.

- [ ] **Step 2: Petakan kelas**

Kartu → `.panel`; kepala emiten (kode, nama, sektor, harga besar) → `.board` dengan
`.board-main`/`.board-side`; kartu hasil valuasi → `.vcard` (`.v-num`, `.v-note`);
isian simulasi → `.inp` + `.field`; pencarian emiten → `.inp` + `.btn-p`.

- [ ] **Step 3: Build + verifikasi**

Run: `npm --prefix app run build`
Verifikasi `/stock-detail`, 2 viewport × 2 tema. Wajib tambahan:
- buka `?tab=valuasi` langsung dari alamat — halaman terbuka di tab itu
- angka lima model valuasi (Graham Classic/Growth, NCAV, Relative, DDM) cocok dengan
  hitungan manual untuk satu emiten uji (pola verifikasi papan #6)
- Total Debt tidak "—" untuk emiten yang punya `lq_total_debt`

- [ ] **Step 4: Commit**

```bash
git add app/src/views/dasbor/StockDetail.tsx app/src/views/dasbor/stock-detail
git commit -m "feat(dasbor): Stock Detail dua tab statistik/valuasi

Valuasi dipisah lewat ?tab= supaya bisa dibagikan tautannya dan hasil simulasi
tidak hilang; modal ditolak karena isinya tinggi dan punya isian yang diubah user.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Peta Investor

**Files:**
- Modify: `app/src/views/dasbor/PetaInvestor.tsx`, `app/src/lib/dasbor/graphRender.ts`
- Modify: `app/src/views/dasbor/peta-investor/{ByStock,ByInvestor,DetailPanel,PetaInvestorSearch}.tsx`
- Reference: `docs/design-lantai-bursa-reimagined.html:648-670`

**Interfaces:**
- Consumes: `.lantai` primitif; `petaInvestorData.ts`.
- Produces: —

- [ ] **Step 1: Simpul bundar, bukan belah ketupat**

Di `graphRender.ts`, ganti bentuk simpul menjadi lingkaran, dan palet menjadi satu aksen
amber untuk emiten plus derajat abu-biru untuk sisanya:

```ts
const WARNA = {
  emiten:   'var(--amber)',
  institusi:'var(--text2)',
  individu: 'var(--text3)',
  lain:     'var(--line2)',
}
```

Hijau dan merah **dilarang** dipakai di sini — keduanya dikunci untuk arah angka.

- [ ] **Step 2: Label hanya untuk N terbesar**

Gambar label hanya untuk 12 simpul terbesar; sisanya muncul saat diarahkan atau disentuh.
Grafik yang melabeli semua simpul selalu berakhir tak terbaca, dan itu bukan soal ukuran font.

- [ ] **Step 3: Penjaga lebar kanvas**

Sebelum menggambar:

```ts
if (canvas.getBoundingClientRect().width < 2) {
  requestAnimationFrame(gambar)
  return
}
```

Penjaga ini ditaruh **satu kali** di fungsi gambar, bukan ditambal per pemanggil (papan #26).

- [ ] **Step 4: Rapikan tabel By Stock & By Investor**

Batasi kolom pemegang saham menjadi **3 pil + "+N lagi"** sehingga tinggi baris seragam;
pil memakai `.bchip`. Sekarang tinggi baris berbeda-beda karena jumlah pil mengikuti jumlah
pemegang saham. Kolom CORP%/IND%/OTH% yang kosong untuk semua baris diberi keterangan sekali
di `.panel-h` (`<span className="chip warn">Rincian tipe holder tidak tersedia di data KSEI ini</span>`),
bukan dibiarkan berisi strip tanpa penjelasan.

- [ ] **Step 5: Build + verifikasi**

Run: `npm --prefix app run build`
Verifikasi `/peta-investor`, 2 viewport × 2 tema. Wajib: cari "BBCA" menampilkan data nyata
(pola verifikasi papan #7), label tidak bertumpuk, `scrollWidth == clientWidth`, console bersih.

- [ ] **Step 6: Commit**

```bash
git add app/src/views/dasbor/PetaInvestor.tsx app/src/lib/dasbor/graphRender.ts \
        app/src/views/dasbor/peta-investor
git commit -m "feat(dasbor): Peta Investor gaya Lantai Bursa

Simpul bundar + satu aksen amber (hijau/merah dikunci untuk arah angka), label
hanya 12 terbesar, tinggi baris tabel diseragamkan lewat batas 3 pil.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Changelog admin + hapus `dasbor.css`

**Files:**
- Create: `app/src/views/admin/ChangelogAdmin.tsx`
- Modify: `app/src/App.tsx`
- Delete: `app/src/dasbor/dasbor.css`
- Modify: `app/src/components/dasbor/DasborLayout.tsx` (buang impornya)

**Interfaces:**
- Consumes: `ProtectedRoute` yang sudah ada; `.lantai` primitif.
- Produces: rute `/admin/changelog`.

- [ ] **Step 1: Penyaji changelog**

`app/src/views/admin/ChangelogAdmin.tsx`:

```tsx
import teks from '../../../../docs/CHANGELOG.md?raw'

/**
 * Changelog dibaca langsung dari docs/CHANGELOG.md — satu sumber kebenaran.
 * Menyalin isinya ke TSX akan membuat keduanya berbeda dalam beberapa bulan;
 * itu persis alasan popup "What's New" lama dibuang (papan #8).
 *
 * Penyaji sengaja seadanya: berkas ini hanya memakai "## judul" dan "- butir",
 * jadi pustaka markdown penuh tidak dibutuhkan.
 */
export function ChangelogAdmin() {
  const baris = teks.split('\n')
  return (
    <div className="lantai">
      <div className="panel">
        <div className="panel-h"><span className="lbl">Changelog</span></div>
        <div className="panel-b">
          {baris.map((b, i) => {
            if (b.startsWith('## ')) return <h2 key={i} className="lbl" style={{ marginTop: 18 }}>{b.slice(3)}</h2>
            if (b.startsWith('# ')) return <h1 key={i} style={{ fontSize: 19 }}>{b.slice(2)}</h1>
            if (b.startsWith('- ')) return <li key={i} style={{ marginLeft: 18 }}>{b.slice(2)}</li>
            return b.trim() ? <p key={i}>{b}</p> : null
          })}
        </div>
      </div>
    </div>
  )
}
```

Agar impor di luar akar Vite diizinkan, tambahkan di `app/vite.config.ts`:

```ts
server: { fs: { allow: ['..', '../..'] } },
```

- [ ] **Step 2: Daftarkan rute terlindungi**

Di `app/src/App.tsx`, di dalam cabang `/admin` yang sudah dibungkus `ProtectedRoute`:

```tsx
<Route path="changelog" element={<ChangelogAdmin />} />
```

**Jangan** menambahkannya ke `MENU_ITEMS` — rail publik tetap 10 menu.

- [ ] **Step 3: Hapus gaya lama**

Setelah memastikan kesepuluh view sudah dibungkus `.lantai` (Task 2–12), hapus
`app/src/dasbor/dasbor.css` dan impornya di `DasborLayout.tsx`. Jalankan pencarian sisa
kelas lama sebelum menghapus:

```bash
grep -rn "dasbor-kartu\|class=\"ct \|className=\"ct " app/src/views/dasbor || echo "bersih"
```

Kalau masih ada yang tersisa, selesaikan dulu — jangan hapus berkasnya.

- [ ] **Step 4: Build + verifikasi menyeluruh**

Run: `npm --prefix app run build`
Telusuri **kesepuluh** halaman publik di 2 viewport × 2 tema, plus `/admin/changelog` sesudah
masuk. Wajib: tidak ada halaman yang kehilangan gaya setelah `dasbor.css` dihapus.

- [ ] **Step 5: Commit**

```bash
git add app/src/views/admin/ChangelogAdmin.tsx app/src/App.tsx app/vite.config.ts \
        app/src/components/dasbor/DasborLayout.tsx
git rm app/src/dasbor/dasbor.css
git commit -m "feat(admin): halaman changelog terkunci + hapus gaya lama

Changelog kembali sebagai halaman, tapi di bawah /admin saja; isinya dibaca dari
docs/CHANGELOG.md lewat impor mentah supaya tidak ada dua salinan. Membalik
keputusan papan #8 atas permintaan user. dasbor.css dihapus setelah 10 view pindah.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Setelah semua tugas

Perbarui `docs/CHANGELOG.md` dan papan pekerjaan di `docs/RENCANA-REFACTOR-REACT.md`:
tandai baris #20 selesai, dan catat status backlog B1–B4 beserta hasil verifikasi sumber
Broker Summary dari Task 10.
