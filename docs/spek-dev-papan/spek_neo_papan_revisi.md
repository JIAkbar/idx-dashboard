# Spek Revisi NEO PAPAN (audit PDF NeoBDM + kode existing — Fable, 26 Agu 2026)

> Status kode: 8 tab sudah ada (`NeoPapan.tsx` + `neo-papan/*.tsx`), lib `neoPapan.ts` sudah punya banyak fungsi siap-pakai. Ini REVISI, bukan bangun-dari-nol — tiap section menyebut eksplisit apa yang direuse vs ditulis baru.

> **⚠️ KOREKSI 26 Agu 2026 (setelah RRG dibangun & diuji — dua cacat DI SPEK INI, ditemukan sesi Papan, diverifikasi pengawas):**
> 1. **§1.3 warm-up salah.** Rumus `3n-2` MELUPAKAN warm-up EMA smoothing. Rantai benar: EMA valid dari `s-1` → ratio dari `s+n-2` → ROC dari `s+2n-2` → momentum dari `s+3n-3`. **Warm-up = `3n + smoothLen - 3`.** Empiris n=4, s=3 → **12** (bukan 10). Dibuktikan: `hitungEMA` (`grafikEmiten.ts:207-210`) mengisi `null` untuk indeks 0..periode-2, nilai pertama di `periode-1`. Fetch window = `warmUpRrg(maxN, smoothLen) + TRAIL + 5` = 47 pekan untuk n=12.
> 2. **§1.8.1 fixture uji rotasi DEGENERATE.** Fixture "tren linier mulus" tak bisa membuktikan apa pun: deret linier → z-score bergerak KONSTAN → ROC = 0 konstan → sd = 0 → momentum **null** (kena penjaga epsilon kita sendiri), bukan >100. Uji yang sah wajib memakai **akselerasi lalu melandai**: momentum >100 konsisten selagi laju naik, lalu jatuh (terukur 97,75) SEMENTARA ratio masih di atas 100 (101,5) — de-coupling itulah yang membuktikan mekanisme §1.1 sungguh bekerja.

## 0. Ringkas: kondisi sekarang vs target

| Tab | Chart lib sekarang | Sudah ada | Cacat utama | Direvisi |
|---|---|---|---|---|
| **Rotation (RRG)** | Chart.js scatter+plugin (tetap) | `zScoreBergerak`/`rsRatioMomentum`, garis silang 100/100 | 🔴 Momentum = z-score dari LEVEL rsRatio (bukan laju-perubahan) → rotasi hilang; SD populasi; warm-up jadi 100 palsu; RS tak dihaluskan; skala sempit | Rumus total (§1) + rendering kelas-Bloomberg |
| **Broker Stalker** | tabel (tanpa chart) | chip broker, 2 tabel Buy/Sell, kolom sudah pas | Preset "60d" bohong (data cuma jendela 20 hari geser); tanpa sort/filter/paginasi/Foreign-Only | Routing sumber data + fitur tabel (§2) |
| **Inventory Chart** | Chart.js | `agregasiBroker`/`avgHarga`/`kumulatifBroker`/`topNet` | Chart.js tak punya plugin candlestick asli; kontrol DATE RANGE/preset broker belum ada | Migrasi ke lightweight-charts + kontrol (§3) |
| **Compare Inventory** | — (belum ada) | pola brush `SeleksiAreaChart` (Whales Papan) | Tabel perbandingan & brush 2-chart belum ada | Bangun dari primitive existing (§4) |
| **Sector/Index Activity** | Chart.js | `porsiBergerak`, `pilihKandidatSektor` | Mode Indeks (KOMPAS100 dst) butuh data yang tak dimiliki | Definisi operasional + disclaimer (§5) |
| **Balance Position** | Chart.js | data KSEI bulanan | Field name KSEI belum dikonfirmasi literal; cakupan scripless bisa disalahbaca 100% | Verifikasi field + label 2-persentase (§6) |
| **Seasonality** | tabel (tanpa chart) | `musimanHari`/`musimanBulan` lengkap | Hardcode 12 tahun tanpa parameter, tanpa BadgeRapor/n-kecil | Signature+param tahun, BadgeRapor wajib (§7) |
| **Transaction Chart** | Chart.js | `moneyFlowAsing` | Label 4-kategori Retail/Institution/Zombie tak bisa dipenuhi data; Participation bisa >100% | Jujurkan ke Asing/Domestik, fix rumus Participation (§8) |

**Substrat chart final (§10)**: RRG/Activity/Balance **tetap Chart.js**; Inventory/Compare/Transaction **pindah ke lightweight-charts** (sudah dependency, sudah dipakai identik di `GrafikEmiten.tsx`/`WhalesPapan.tsx`, dan menutup gap TransaksiTab yang komentarnya sendiri (`TransaksiTab.tsx:9-11`) mengaku Chart.js tak punya plugin candlestick).

---

## 1. 🔴 ROTATION CHART (RRG) — PRIORITAS UTAMA

### 1.1 Diagnosa cacat (root cause)

Kode sekarang (`neoPapan.ts:141-158`):
```ts
zScoreBergerak(xs, n)[i] = 100 + (x[i]-mean_n)/sd_populasi_n
rsRatio[i]    = zScoreBergerak(rs, n)[i]
rsMomentum[i] = zScoreBergerak(rsRatio, n)[i]   // ← z-score dari LEVEL rsRatio, BUKAN laju-perubahannya
```

1. **Sumbu Y salah secara struktural.** `rsMomentum` adalah z-score dari *level* `rsRatio` pada jendela yang sama — dan `rsRatio` sendiri deret yang bergerak lambat/berautokorelasi tinggi, sehingga `rsMomentum` jadi hampir fungsi-monoton dari `rsRatio`. Titik jatuh di sekitar diagonal `y=x`, **rotasi searah-jarum-jam (ciri khas RRG) tidak pernah muncul**. RRG kanonik (JdK RS-Ratio/RS-Momentum, dipakai NeoBDM/Bloomberg/StockCharts) mendefinisikan Momentum sebagai **laju perubahan (rate-of-change) RS-Ratio**, dinormalisasi terpisah — mekanisme inilah yang membuat sektor baru-mulai-membaik masuk kuadran *Improving* dulu (ratio masih <100, momentum sudah >100), baru menyeberang ke *Outperform* — pola melengkung, bukan lompat diagonal.
2. **Skala sempit**: `100+z_mentah` (tanpa pengali) → sebaran khas ~97-103, jauh dari referensi ~94-106. Semua titik menggerombol di tengah.
3. **SD populasi** (`/n`) bukan sampel (`/(n-1)`) — bias-turun, terasa di jendela pendek.
4. **Warm-up menggumpal palsu**: saat jendela belum penuh atau `sd=0`, kode fallback diam-diam ke `100+0=100` — titik jatuh persis di pusat bukan karena netral, tapi karena data belum cukup.
5. **RS mentah tak dihaluskan** sebelum dinormalisasi → noise harian ikut terbawa, diperkuat lagi oleh ROC di langkah momentum.

### 1.2 Rumus final

Alur: `harga → RS mentah → EMA (reuse `hitungEMA` grafikEmiten.ts:207, JANGAN tulis EMA baru) → RS-Ratio (z-score level) → RS-Momentum (z-score LAJU-PERUBAHAN RS-Ratio)`.

```ts
import { hitungEMA } from './grafikEmiten'   // REUSE — jangan tulis emaSederhana baru

export interface RrgParam {
  n: number          // PERIODE (PEKAN) — satu kontrol untuk windowRatio, rocPeriod, windowMomentum sekaligus
  smoothLen: number  // haluskan RS sebelum normalisasi, default 3
  skala: number       // pelebar sebaran z-score, default 1.5 — kalibrasi ulang via §1.5
}
export const RRG_DEFAULT: RrgParam = { n: 8, smoothLen: 3, skala: 1.5 }

/**
 * z-score bergerak, SD SAMPEL. Window WAJIB penuh & tanpa null di dalamnya —
 * kalau ada null (warm-up ATAU gap/suspend di tengah), hasil = null.
 * TIDAK bridging gap, TIDAK coerce ke 0 — dua bug yang sama-sama menggumpalkan
 * titik palsu di (100,100) kalau dilanggar.
 */
function zScoreBergerakN(xs: (number | null)[], n: number, epsilon = 1e-6): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = 0; i < xs.length; i++) {
    if (i < n - 1) { out.push(null); continue }
    const w = xs.slice(i - n + 1, i + 1)
    if (w.some((v) => v == null)) { out.push(null); continue }
    const ww = w as number[]
    const m = ww.reduce((a, b) => a + b, 0) / ww.length
    const sd = Math.sqrt(ww.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1))  // SAMPEL
    out.push(sd < epsilon ? null : ((xs[i] as number) - m) / sd)
  }
  return out
}

export interface TitikRrg { rsRatio: number | null; rsMomentum: number | null }

/** rsMentah = 100 × hargaGrup ÷ hargaAcuan (dihitung pemanggil). */
export function rsRatioMomentumV2(rsMentah: number[], p: RrgParam = RRG_DEFAULT): TitikRrg[] {
  const rs = hitungEMA(rsMentah, p.smoothLen)
  const zRatio = zScoreBergerakN(rs, p.n)
  const rsRatio = zRatio.map((z) => (z == null ? null : 100 + p.skala * z))

  const rocRatio: (number | null)[] = rsRatio.map((v, i) =>
    v == null || i < p.n || rsRatio[i - p.n] == null ? null : v - (rsRatio[i - p.n] as number)  // ← FIX inti: LAJU, bukan level
  )
  const zMomentum = zScoreBergerakN(rocRatio, p.n)   // index tetap, TIDAK di-compact
  const rsMomentum = zMomentum.map((z) => (z == null ? null : 100 + p.skala * z))

  return rsRatio.map((r, i) => ({ rsRatio: r, rsMomentum: rsMomentum[i] }))
}
```

Titik dengan `rsRatio==null || rsMomentum==null` **tidak dirender** (bukan disembunyikan diam-diam — memang belum valid).

**`zScoreBergerak`/`rsRatioMomentum` lama**: ditandai `@deprecated`, TIDAK dihapus. Grep dikonfirmasi hanya `RotasiTab.tsx` yang memanggilnya — aman diganti langsung ke `rsRatioMomentumV2` di situ saja.

### 1.3 ⚠️ Warm-up kompoun — dampak nyata ke kode existing

Karena `windowRatio=rocPeriod=windowMomentum=n` (satu kontrol PERIOD), titik pertama yang valid jatuh di index **`i = 3n-2`** (bukan `n-1`):
- `rsRatio` valid mulai `i=n-1`
- `rocRatio` butuh `rsRatio[i]` & `rsRatio[i-n]` → valid mulai `i=2n-1`
- `rsMomentum` (z-score dari `rocRatio`) valid mulai `i=3n-2`

| n (pekan) | warm-up (`3n-2`) | fetch existing (`pekanIdx.slice(-40)`) | TRAIL (6) | Sisa titik valid |
|---|---|---|---|---|
| 4 | 10 | 40 | 6 | 30 — aman |
| 8 (default) | 22 | 40 | 6 | 18 — aman |
| 12 | **34** | 40 | 6 | **6 — pas-pasan, RRG nyaris kosong** |

**Wajib**: fetch window dihitung dinamis `slice(-(3*maxN - 2 + TRAIL + 5))` (buffer 5), bukan hardcode `-40` — `maxN` dari `OPSI_N` terbesar yang tersedia di UI (12). Ini ganti 1 konstanta, bukan refactor besar.

### 1.4 Rendering kelas Bloomberg

`RotasiTab.tsx` sekarang cuma gambar garis silang 100/100 lewat plugin `quadran` (baris 80-105) — **extend plugin yang sama**, jangan bikin plugin kedua:

1. **4 kuadran berlabel + tint** — `beforeDraw`: rect tipis (opacity ~0.06) per kuadran + label pojok (bukan tengah): kiri-atas **IMPROVING** (tint biru), kanan-atas **OUTPERFORM** (hijau), kanan-bawah **WEAKENING** (kuning/oranye), kiri-bawah **UNDERPERFORM** (merah). Warna dari token tema, bukan hex hardcode.
2. **Garis silang 100/100** dipertahankan, digambar putus-putus di atas tint, di bawah data.
3. **Grid simetris**: tick dipaksa `100 ± {3,6,9,...}` (bukan auto Chart.js), garis tipis redup.
4. **Domain simetris + kontainer bujursangkar** — sebelum render: `maxDev = max(|semua titik+ekor − 100|)`, set `xMin=yMin=100-maxDev*1.1`, `xMax=yMax=100+maxDev*1.1` (domain X=Y sama lebar, wajib — supaya kuadran selalu bujursangkar visual, tidak mendistorsi sudut rotasi). Chart.js tak punya "equal-unit scale" bawaan — domain sama + container rasio 1:1 adalah cara praktisnya.
5. **Ekor gradasi opasitas**: `segment.borderColor` callback per-segmen, opacity ~15%→100% dari titik tertua ke terkini.
6. **Titik terkini** radius ~2× titik ekor + label kode (pill kontras) di sampingnya.
7. **Panah arah** di ujung ekor, dirotasi sesuai vektor (titik terkini − titik sebelumnya) — ditandai *enhancement di luar NeoBDM asli*, bukan requirement inti.
8. **Legenda kanan**: daftar entitas + swatch, klik toggle, hover memudarkan yang lain.
9. **Tooltip**: kode, tanggal, RS-Ratio, RS-Momentum, nama kuadran — ditandai *enhancement*, bukan requirement inti.
10. **`skipped`**: mode "putar riwayat" (animasi playback) — tambahkan kalau uji §1.6 lolos dan diminta.

### 1.5 Kontrol & filter (ala NeoBDM, disesuaikan realita data)

| Kontrol NeoBDM | Realisasi |
|---|---|
| `STOCK UNIVERSE` | Toggle "Sektor (11 kandidat likuid)" vs "Saham individual (pilih manual)" |
| `PERIOD (HARI)` | **PERIODE (PEKAN)** — RotasiTab **SUDAH SELALU mingguan** (`tandaMingguan`, `levelSektor`), kontrol existing `OPSI_N=[4,8,12]` dipertahankan, cuma label diperjelas jadi "Periode (pekan)" — bukan "(hari)". **Tidak ada mode harian**, jangan tambah toggle Weekly (redundan dengan yang sudah selalu-aktif). |
| `Liquid Only` | sembunyikan entitas dengan median `value` trailing 20 hari < kuartil-bawah Universe terpilih (adaptif, bukan angka Rp tetap) |
| `Hide Weak` | sembunyikan `RS-Ratio` terkini < 97 (≈ −2σ dari 100 pada `skala=1.5`) |
| `Hide Abnormal` | sembunyikan titik `null` (warm-up/gap) ATAU `|RS-Ratio−100|>15` |
| `Composite Benchmark` | toggle acuan IHSG (default) ↔ LQ45/IDX30 — **cek dulu apakah ada deret harga resmi LQ45/IDX30 di arsip**; kalau tidak, sembunyikan toggle ini sampai datanya ada, jangan mengarang |
| Label "Benchmark: … / Update: …" | dari bar terakhir dataset |
| Tombol refresh | re-fetch data terbaru |

### 1.6 Sumber data — sektor (dikonfirmasi, bukan diasumsikan)

**Dikonfirmasi**: tidak ada berkas indeks sektor resmi IDX (`emiten_sektor*index*`/deret indeks sektor) di `app/public`. Sektor RRG **wajib** dibangun dari agregat emiten (`pilihKandidatSektor`, `neoPapan.ts:253`, komentar existing baris 246-252 sudah jujur — pertahankan).

**Rekomendasi bobot**: kapitalisasi pasar (`soxclose` per emiten), bukan sama-rata — mendekati metodologi resmi IDX (free-float market cap) meski bukan free-float-adjusted sungguhan.
```
indeksSektor[t] = Σ(harga_i[t] × soxclose_i[t]) / Σ(harga_i[t0] × soxclose_i[t0]) × 100
```
**Wajib** catatan UI: *"Sektor dihitung dari agregat sampel emiten paling likuid, bukan indeks resmi IDX."*

**Legenda 16-indeks NeoBDM → 11 tersedia**: hanya 11 sektor IDX-IC (IDXENERGY/IDXBASIC/IDXINDUST/IDXNONCYC/IDXCYCLIC/IDXHEALTH/IDXFINANCE/IDXPROPERT/IDXTECHNO/IDXINFRA/IDXTRANS) yang bisa dibangun dari `pilihKandidatSektor`. 5 sisanya (IDX30, ISSI, JII70, KOMPAS100, LQ45) butuh daftar keanggotaan indeks yang tidak dimiliki — **skip**, lihat §11.

### 1.7 BadgeRapor / klaim prediktif — keputusan eksplisit

Label kuadran (Improving/Outperform/dst) **deskriptif posisi historis**, bukan sinyal beli/jual — **tidak diberi BadgeRapor**. Tapi wajib ada disclaimer UI eksplisit: *"Posisi rotasi historis, bukan rekomendasi beli/jual."*

### 1.8 Uji terima RRG

1. **Uji rotasi (wajib)** — fixture RS mentah naik LINEAR MULUS (bukan step function — step function menyalahi warm-up kompoun §1.3) selama `≥ 3n-2+20` bar. Assert pada `i ≥ 3n-2`: selama tren linier terus naik, `rsMomentum[i] > 100` konsisten (ROC RS-Ratio positif); begitu tren melandai (RS mentah flat), `rsMomentum` turun ke ~100 **sebelum** `rsRatio` sendiri turun signifikan di bawah 100 — bukti de-coupling Ratio-vs-Momentum, tanda tangan matematis penutup Cacat #1, dievaluasi index-aligned (bukan klaim "leading" kalender absolut).
2. **Domain simetris**: unit test murni fungsi hitung domain (§1.4.4) — assert `xMax-xMin===yMax-yMin`, pusat `(xMax+xMin)/2===100`.
3. **Warm-up & gap tak menggumpal/tak menjahit**: fixture flat sempurna N bar awal → assert `null` (bukan `100`) untuk seluruh window `3n-2` bar pertama; fixture dengan gap di tengah (bar suspend) → assert window yang overlap gap = `null`, tidak menyambung index non-adjacent (verifikasi `zScoreBergerakN` tidak compact array).
4. **Cocok manual**: fixture 15 bar angka bulat, hitung tangan, assert `rsRatioMomentumV2` sama dalam toleransi `1e-6` — simpan sebagai kasus tetap `neoPapan.test.ts`.
5. **Kompatibilitas fetch window**: assert untuk `n=12`, jumlah titik valid dalam window fetch (setelah fix §1.3) `≥ TRAIL(6)`.
6. **Update test lama**: 3 (atau lebih) test `zScoreBergerak`/`rsRatioMomentum` existing di `neoPapan.test.ts` — nilai expected berubah karena formula sengaja diganti; update, bukan biarkan gagal diam-diam.

---

## 2. Broker Stalker

### 2.1 Sudah ada (~60%)
`StalkerTab.tsx` + `stalkerAgregasi`/`kodeBrokerUnik`/`kalenderBrokerHarian`/`avgHarga` — chip multi-broker, 2 tabel Buy/Sell berdampingan, kolom `emiten·net·beli·jual·bavg·savg` (setara `symbol·netval·bval·sval·bavg·savg`).

### 2.2 🔴 Cacat: preset "60 hari" bohong
`stalkerAgregasi` sumbernya `broker_harian/{kode}.json` = **jendela geser 20 hari bursa**, ditulis-ulang tiap hari (dikonfirmasi isi berkas BUMI: `jendela_hari:20`). Preset "60d" di UI diam-diam memberi data ≤20 hari — **wajib diperbaiki**.

**Routing baru**:
| Kondisi | Sumber |
|---|---|
| ≤20 hari & investor=ALL | `broker_harian/*.json` (tetap, murah, sudah cache) |
| >20 hari, custom-range, atau Foreign/Domestic | `broker_tahunan/{kode}/{tahun}.json` (index.json per emiten daftar tahun tersedia — pakai itu untuk tahu berkas mana yang diambil, jangan asumsi rentang lengkap) |

**Biaya unduhan** (nyata, bukan cuma CPU): 1 berkas `{kode}/{tahun}.json` ≈ 0,75MB mentah/~280KB gzip (`bangun_broker_tahunan.py:13`) → 962 emiten × 1 file ≈ **722MB mentah / ~270MB gzip untuk satu query**. `ponytail:` ship dulu jalur sederhana — fetch **hanya saat preset ≥60d/Foreign/Domestic/custom benar-benar dipilih** (bukan diprefetch), cache per `(kode,tahun)` (reuse `CACHE` module-level existing), tampilkan indikator loading + peringatan ukuran unduhan di UI. **Upgrade path** (bukan blocker sekarang): CI menerbitkan `broker_60d/` (varian `broker_harian`, ubah `JENDELA_HARI` di script panen — infra sudah ada) khusus preset 60d+ALL, supaya tak perlu sentuh `broker_tahunan` sama sekali. Tambahkan kalau pengukuran nyata membuktikan perlu, jangan bangun sekarang.

### 2.3 Foreign Only / Domestic Only

`broker_tahunan/{kode}/{tahun}.json` **sudah membawa** sub-objek `asing` per hari, bentuk identik `broker` (ALL): `{ringkas, broker:[[kode,beliLot,beliNilai,jualLot,jualNilai],…]}`. **Penting**: ini investor-type asing (klien luar negeri lintas broker), **bukan** `kelompokBroker.ts` (identitas kepemilikan sekuritas: asing/bumn/smart) — beri label UI eksplisit "Investor Asing (klien)" supaya tak tertukar.

```
domestikLot(b)   = allLot(b) - asingLot(b)
domestikNilai(b) = allNilai(b) - asingNilai(b)
```
(pola `ALL−FOREIGN=DOMESTIC` sudah diuji-silang 0 selisih di proyek ini — cukup 1 sampel ulang di uji terima, bukan riset baru).

**⚠️ Tidak "tinggal dipakai"**: `useBrokerTahunan`(`brokerTahunanData.ts`) itu hook React SATU-emiten (tak bisa dipanggil 962× dalam loop), dan parsernya (`dariBerkasTahunan`, `whalesPapan.ts`) **tidak memparse `asing` sama sekali**. Yang direuse cuma **pola URL** (`index.json`+`{tahun}.json`). Loader BULK lintas-962-emiten (mirip `muatBrokerSemua()` tapi lewat `broker_tahunan`) + parser yang expose `asing` — **ditulis baru**.

### 2.4 Rumus kolom
```
beliLot(E)/beliNilai(E)/jualLot(E)/jualNilai(E) = Σ baris broker∈B tiap hari di rentang, sumber sesuai investor type
netval = beliNilai - jualNilai
bval   = beliNilai
sval   = jualNilai
bavg   = beliLot ? beliNilai/(beliLot*100) : null   // avgHarga() — REUSE, jangan tulis baru
savg   = jualLot ? jualNilai/(jualLot*100) : null   // avgHarga() — REUSE
```
**Signature baru** (ganti `n:number` jadi rentang eksplisit):
```ts
stalkerAgregasi(
  perEmiten: Map<string, BrokerHarianEmiten>,
  brokerTerpilih: string[],
  rentang: { dari: string; sampai: string },
  investor: 'all' | 'asing' | 'domestik',
): HasilStalker
```
**Wajib**: update 3 test case `stalkerAgregasi` (`neoPapan.test.ts` — signature lama `(peta,['AK'],2)` dipanggil 3×) ke signature baru — **kompilasi TypeScript gagal tanpa ini**, bukan opsional.

### 2.5 Sort, filter, paginasi
- **Sort**: reuse pola `UrutState<T>={kunci,arah,klik}` + tombol `th-sort` yang sudah dipakai `Screener.tsx`/`TopBroker.tsx` — instansiasi ulang, bukan komponen baru. `null` (bavg/savg kosong) selalu diletakkan di ujung urutan, bukan posisi acak default JS.
- **Filter per kolom**: `<input>` baris kedua header. Teks (Emiten) → substring case-insensitive. Angka (Net/Beli/Jual) → operator prefix tunggal (`>1000000000`/`<0`), parser 5-6 baris. `ponytail:` rentang `a-b` belum didukung, tambah kalau diminta.
- **Paginasi**: `useState(halaman)`, 25 baris/halaman, tombol ‹N/M›, reset ke 1 tiap filter/sort/broker/rentang berubah. Genuinely baru (tak ada preseden di `views/dasbor`), minimal.

### 2.6 Kolom tambahan (lebih dari NeoBDM — data kita lebih kaya)
Satu perluasan `stalkerAgregasi` (field `seriHarian: {t:string;net:number}[]` per baris) memberi 4 kolom sekaligus:

| Kolom | Rumus/sumber | BadgeRapor? |
|---|---|---|
| Posisi vs B.Avg | `(closeTerakhir−bavg)/bavg×100%` dari `muatOhlcv(E)` | Tidak — historis murni |
| Konsistensi | hari berturut `net(hari)>0` dari terkini mundur, `n/N hari` | Tidak kalau label netral; wajib BT Papan kalau dibingkai "Sinyal" |
| Porsi Volume | `Σ beliLot(B)/Σ ringkas.totalLot` per hari, dirata jendela — `ringkas.totalLot` sudah ada per hari | Tidak |
| Sparkline harian | render `seriHarian` sebagai mini-bar hijau/merah | Tidak |

### 2.7 Uji terima
1. **Angka**: 1 broker×5 hari, cocokkan manual ke `broker_harian/{kode}.json`.
2. **Foreign/Domestic**: cocokkan ke `hari[t].asing.broker` manual 1 sampel; Domestic=ALL−FOREIGN.
3. **60 hari**: `jendela.length` benar-benar mendekati 60 hari bursa (bukan ~20 seperti sekarang).
4. **Sort**: klik 2× tiap header → urutan naik/turun benar, `null` konsisten di ujung.
5. **Filter**: substring Emiten & operator angka bekerja.
6. **Paginasi**: `min(25, sisaBaris)` per halaman, reset ke halaman 1 saat filter/sort/rentang berubah.

---

## 3. Inventory Chart

### 3.1 Reuse (tanpa tulis ulang)
`agregasiBroker`/`avgHarga`/`topNet`/`kumulatifBroker` dipakai apa adanya — tambahkan 2 parameter opsional (mode Lot, aditif) tanpa mengubah signature lama. `RentangNp`/`potongRentang` (`bersama.tsx:57-67`, existing 4 nilai `b1/b3/ytd/semua`) diperluas 2 nilai baru (2W/6M — aditif). `DropdownMulti`+`kodeBrokerUnik` (pola `StalkerTab.tsx:93`) direuse untuk pemilih broker.

### 3.2 Migrasi ke lightweight-charts
`lightweight-charts@5.2.1` sudah dependency (`package.json:17`), sudah dipakai pola candle+overlay identik (`GrafikEmiten.tsx`/`WhalesPapan.tsx`). Overlay garis kumulatif broker di sumbu terpisah:
```ts
chart.applyOptions({ leftPriceScale: { visible: true, borderVisible: false } })  // WAJIB eksplisit
```
**Catatan**: `leftPriceScale.visible` default `false` di lightweight-charts, dan **tidak ada preseden `priceScaleId:'left'` di codebase ini** (dikonfirmasi grep nihil) — ini pemakaian API native baru, bukan "reuse pola existing".

### 3.3 Kontrol UI (lengkap, sesuai referensi PDF)
STOCK UNIVERSE (diusulkan **dihilangkan** — Neo Papan sudah scoped per-halaman-per-ticker, redundan) · **TICKER** · **DATE RANGE** (2W/1M/3M/6M/YTD/1Y, via `RentangNp` diperluas) · **VALUE** (Value|Lot toggle → `kumulatifBroker`/`topNet` mode Lot) · preset broker (`TOP_5_NB_LOT_C20`/`TOP_5_NS_LOT_C20` — **definisi diusulkan sendiri, BUKAN kutipan source NeoBDM** yang tak publik: Top-5 net buyer/seller by lot, jendela 20 hari) + "Add broker…" manual · **INVESTOR TYPE** (Foreign/Domestic/All).

**GAP DATA — INVESTOR TYPE `disabled` sampai loader §2.3 selesai.** `BarisBroker` (`neoPapanData.ts:54`) saat ini cuma 1 varian (ALL). Begitu loader bulk+parser `asing` dari §2.3 (Stalker) selesai, Inventory bisa langsung memakainya — **jangan duplikasi kerja**, ini satu pekerjaan dipakai 2 tab.

### 3.4 Chart & panel
Candle harga + garis kumulatif net-flow per broker (label kode di ujung garis, sumbu kiri Rp/Lot, kanan Harga), volume di bawah. Panel kanan: Net Buy/Net Sell list + tabel per-tanggal **BROKER·CUM·NET 1D·BAVG·SAVG**.

### 3.5 Uji terima
Angka kumulatif cocok manual 1 broker; toggle Value/Lot konsisten; DATE RANGE mengubah rentang chart benar; preset broker terisi sesuai definisi §3.3.

---

## 4. Compare Inventory

### 4.1 Brush 2-chart
Primitive baru `SeleksiRentangChart` — **lebih sederhana** dari `SeleksiAreaChart` existing (pita waktu saja, tanpa sumbu harga), reuse pola drag/redraw yang sudah terbukti (Whales Papan). Dua chart LEFT & RIGHT, area diarsir = periode A/B.

### 4.2 Tabel & header
Tabel: **BROKER·LEFT(CUM/BAVG/SAVG)·RIGHT(CUM/BAVG/SAVG)·CHANGE FROM A(%)·TOTAL** + baris Total.
```
CHANGE FROM A (%) = (netB − netA) / |netA| × 100    // reuse rumus CompareTab.tsx:90 kalau sudah ada
```
Header: `"Left: <tgl>→<tgl> (Nd)  Right: <tgl>→<tgl> (Nd)"` + tombol Clear.

### 4.3 Uji terima
Brush drag menghasilkan rentang A/B benar; tabel CHANGE FROM A cocok manual; Clear reset kedua brush.

---

## 5. Sector/Index Activity

`porsiBergerak(nilaiGrup, nilaiTotal, ma)` (`neoPapan.ts:163-169`) **sudah** menghitung persis "Activity" NeoBDM — tidak perlu fungsi baru.

- **Definisi operasional (caption UI)**: "Activity = rata-rata bergerak N hari dari (nilai transaksi grup ÷ nilai transaksi total sampel)".
- **Mode Sektor**: `nilaiGrup` dari `pilihKandidatSektor`, 11 sektor (konsisten §1.6). **Mode Indeks** (KOMPAS100/LQ45/IDX30 dst): keanggotaan indeks resmi **tidak ada di arsip** → skip, atau realisasikan sebagai daftar kode emiten manual dengan flag eksplisit UI "daftar manual, cek berkala" — jangan klaim sinkron otomatis IDX.
- Label "Last data: <tanggal>" dari bar terakhir. Rentang 3/6/12 bulan.
- Chart: Chart.js line multi-seri, warna konsisten via §9.

---

## 6. Balance Position

- **Sebelum coding**: buka berkas KSEI aktual, konfirmasi nama field literal (dokumen `docs/referensi_idx-statistik.md` bagian Kamus Ruas sudah punya catatan `lokal_total`/`asing_total`=Σ tipe, 9 kategori — cocokkan literal, jangan tebak).
- **Chart**: bar per bulan, Foreign/Lokal × 9 tipe (lainnya/yayasan/sekuritas/reksadana/individual/bank/dapen/korporat/asuransi). Di 412px, dua-bar-berdampingan per bulan kemungkinan lebih terbaca daripada 18-stack tunggal — verifikasi visual.
- **Judul**: `"<TICKER> | Balance Position Analysis [x% scripless]"`, `x% = total KSEI ÷ total saham beredar × 100` (dari profil/fundamental yang sudah dipanen).
- **⚠️ Wajib disclaimer UI**: KSEI hanya cakup saham scripless (C-BEST) — kalau `x%` jauh di bawah 100% (contoh terukur: BBCA ~42,55%), tampilkan *"Data KSEI mencakup X% dari saham tercatat; sisanya tidak tergambar."* Jangan biarkan bar-100%-di-bawahnya (normalisasi dari total KSEI bulan itu, BUKAN dari total saham beredar) terbaca seolah itu 100% seluruh saham.

---

## 7. Seasonality

`musimanHari`/`musimanBulan` (`neoPapan.ts:189-220`) sudah lengkap bentuk `{naikPersen,turunPersen,ekspektasiPersen,n}` — **tapi hardcode 12 tahun, tanpa parameter**. Data historis riil OHLCV cuma 2017→sekarang (≈9 tahun penuh).

**Wajib ubah signature**: `musimanHari(bars, tahunN=12)` / `musimanBulan(bars, tahunN=12)` — dan **update `neoPapan.test.ts`** untuk expected values + kasus baru `tahunN`. Default sebaiknya diturunkan realistis ke data tersedia (mis. 9), tampilkan `n` aktual di caption.

- Tabel Day (Senin-Jumat) / Month (Jan-Des), gradasi hijau→merah dari token tema (cek util warna existing di `bersama.tsx` dulu, reuse — jangan tulis interpolator baru).
- Kontrol: Ticker + Periode tahun (opsi dibatasi panjang data tersedia).
- **WAJIB BadgeRapor** (klaim prediktif berbasis histori): `n` tampil per sel (bukan cuma baris terpisah); sel `n<20` diberi penanda visual (opacity turun/border putus-putus/ikon ⚠). Reuse komponen BadgeRapor existing, jangan buat versi baru khusus Seasonality.

---

## 8. Transaction Chart

Data yang kita punya: `o/h/l/c/volume/value/frequency/foreignbuy/foreignsell/soxclose`. **Tidak ada** klasifikasi Retail/Institution/Zombie NeoBDM — itu klasifikasi *perilaku* transaksi, sementara `type` broker (Lokal/Asing/Pemerintah) yang kita panen bersifat *administratif*.

**Jujur, jangan mengarang label**:
- **Foreign Net Flow** (bukan "Money Flow" generik): `moneyFlowAsing(b)=fb−fs` (`neoPapan.ts:240-242`, reuse langsung).
- **Bar 2-kategori jujur**: `Asing` (`fb+fs`) vs `Domestik` (`value−fb−fs`, floor 0, catatan: sisa = asumsi bukan ukur langsung).
- **🔴 Participation — fix rumus** (draft awal bisa >100%): `fb` dan `fs` masing-masing sisi-independen 0..value, jadi `fb+fs` bisa sampai 2×`value`. **Jangan** `(fb+fs)/value`. Pisah jadi **2 rasio terpisah**, masing-masing stack 0-1: sisi-beli `fb/value`, sisi-jual `fs/value`.
- **4-kategori Retail/Institution/Zombie**: ❌ **di luar cakupan** — butuh klasifikasi perilaku broker (riset+validasi terpisah), catat eksplisit, jangan diam-diam skip.
- **Cross Index**: garis IHSG (acuan halaman lain) di panel harga sama, sumbu kanan.
- **"Compatibility M/NR"**: rumus tidak jelas dari PDF — **skip**, jangan ditebak.
- Chart candle+Money Flow+Volume+bar investor: migrasi ke lightweight-charts (§10), sekaligus menutup gap plugin candlestick Chart.js yang diakui komentar existing.

---

## 9. Standar visual & grid lintas-tab

Satu util `chartOptionsDasar(tema)` di `bersama.tsx`, dipakai RRG/Activity/Balance (3 chart Chart.js):
- Grid: warna dari token tema, 1px, `drawTicks:false`.
- `maxTicksLimit` eksplisit (X:6-8, Y:5) — jangan biarkan auto Chart.js padat di 412px.
- Format angka `id-ID`, `font-variant-numeric:tabular-nums` untuk tabel angka sejajar (cek formatter existing dulu, reuse).
- Tema terang/gelap: semua warna chart dari CSS var, dibaca ulang saat tema berubah — bukan hex hardcode per-chart.
- Tinggi chart konsisten (320px desktop → 240px di ≤412px lewat CSS, bukan re-render JS).
- Legenda seragam: posisi bawah, `boxWidth:10`, font 9-10px — pola RotasiTab baris 108 dijadikan default, terapkan ke tab lain.
- State kosong/memuat/galat: 1 komponen kecil dipakai semua 8 tab (cek dulu apakah sudah ada padanan di proyek, reuse — jangan bikin baru per tab).
- Responsif 412px: tabel (Seasonality/Balance/Stalker/Compare/panel Inventory) dibungkus `overflow-x:auto` sendiri, tidak memaksa lebar body. Semua chart Chart.js `maintainAspectRatio:false`.
- Warna broker konsisten: `warnaBrokerCanvas` (sudah dipakai Whales Papan) direuse di Inventory/Compare/Stalker/Balance — jangan bikin fungsi warna kedua.
- **Kontrol bersama** (`bersama.tsx`) dipakai konsisten oleh semua tab yang direvisi (RRG: Universe+Periode; Stalker: Foreign Only; Inventory: Date Range+Value) — bukan tiap tab reinvent kontrolnya sendiri.

---

## 10. Keputusan pustaka chart (final, per tab)

| Tab | Substrat | Alasan |
|---|---|---|
| RRG | **Chart.js** (tetap) | scatter+ekor bebas, bukan time-series candle — plugin API Chart.js sudah dipakai & cukup |
| Sector/Index Activity | **Chart.js** (tetap) | garis multi-seri sederhana |
| Balance Position | **Chart.js** (tetap) | bar bertumpuk |
| Broker Stalker / Seasonality | tabel (tanpa chart) | tidak berubah |
| **Inventory Chart** | **pindah → lightweight-charts** | candle harga+overlay, pola identik `GrafikEmiten.tsx`/`WhalesPapan.tsx`, sudah dependency |
| **Compare Inventory** | **pindah → lightweight-charts** | sama alasan Inventory, brush primitive baru lebih ringan dari `SeleksiAreaChart` |
| **Transaction Chart** | **pindah → lightweight-charts** | candle+overlay identik, sekaligus menutup gap plugin candlestick yang diakui komentar existing kode |

Migrasi ketiganya sekaligus (bukan sebagian) — arsitekturnya identik, menunda salah satu cuma menyisakan inkonsistensi tanpa manfaat.

---

## 11. Batas jujur — tidak bisa direplikasi dari NeoBDM

| Fitur NeoBDM | Kenapa tidak bisa |
|---|---|
| Legenda 5 indeks (IDX30/ISSI/JII70/KOMPAS100/LQ45) di RRG & mode Indeks Activity | keanggotaan indeks resmi tidak dimiliki — hanya 11 sektor agregat-emiten yang bisa dibangun |
| `Composite Benchmark` ke LQ45/IDX30 | tidak ada deret harga resmi indeks itu di arsip (perlu verifikasi eksplisit, sembunyikan toggle sampai ada) |
| Retail/Institution/Zombie (Transaction) | butuh klasifikasi *perilaku* broker, bukan data administratif yang kita punya — proyek riset terpisah |
| "Compatibility M/NR %" (Transaction) | rumus tidak terbaca dari PDF, tidak ditebak |
| Footprint/orderbook/tick/broker-per-jam | tidak dipanen sama sekali, di luar semua tab ini |
| Lot Sizing (Money Management) | **sudah ada** sebagai Kuli Papan — cukup rujuk link, jangan duplikasi |

---

## 12. Urutan kerja + Kriteria Terima

**Urutan**: (1) RRG §1 penuh + test §1.8 → (2) Stalker §2 (routing data+fitur tabel) + update test §2.4 → (3) Inventory+Compare §3-4 (migrasi lightweight-charts) → (4) Activity/Balance/Seasonality §5-7 (termasuk update signature+test §7) → (5) Transaction §8 → (6) Standar visual §9 diterapkan lintas 8 tab (terakhir, karena bergantung bentuk final tiap tab) → (7) jalankan penuh `neoPapan.test.ts` (semua signature berubah harus hijau) → (8) Kriteria Terima final.

**Kriteria Terima (berlaku semua bagian di atas)**:
1. Verifikasi visual **2 viewport** (desktop 1920×1080, mobile 412px) × **tema terang/gelap** (4 kombinasi), via chrome-devtools MCP.
2. Angka dicocokkan manual ke arsip (bukan "terlihat lebih bagus") — RRG via uji rotasi §1.8, tab lain via sampel manual per section masing-masing.
3. Interaktivitas (checkbox filter, pemilih rentang, sort, klik legenda) diklik nyata, bukan diasumsikan dari kode.
4. Default state (rentang waktu, tab awal, filter awal) di-assert eksplisit dalam laporan.
5. Klaim prediktif (Seasonality) wajib BadgeRapor+win-rate BT Papan; RRG dikecualikan (deskriptif, bukan sinyal) dengan disclaimer eksplisit §1.7.
6. Laporan hasil menyertakan bukti (screenshot/snapshot per kombinasi viewport×tema).