# SPEK CHART HYBRID PAPAN — keputusan Johan 26 Agu 2026

> Menggantikan aturan lama "dilarang engine chart baru" **khusus untuk chart**. Johan: *"boleh buat library chart lagi karena bisa jadi seperti whales.id itu, lalu di chart kita kalau kurang smooth coba perbaiki"* · *"soal chart di PAPAN jika itu lebih baik ya di kombinasikan supaya lebih sempurna"* · pilihan eksplisit lewat AskUserQuestion: **HYBRID**.
> Semua klaim kode di bawah **diverifikasi langsung** ke `app/src` + `app/node_modules` (bukan asumsi).

## 0. Bentuk hybrid yang diputuskan

**Lapis 1 (basis, tetap)** — `lightweight-charts@5.2.1` di `app/src/views/dasbor/GrafikEmiten.tsx` (4.092 baris, sudah matang): candle, volume, multi-pane (`addPane`), 366 rumus indikator (`lightweight-charts-indicators` via `katalogIndikator`), 68 alat gambar (`lightweight-charts-drawing` via `gambarPustaka.ts`), marker, watermark, template tersimpan, locale id-ID + `tickMarkFormatter` sendiri.

**Lapis 2 (baru, custom)** — lapisan gambar canvas sendiri **DI DALAM render-loop chart yang sama**, lewat **Plugin API resmi lightweight-charts v5**: `attachPrimitive(primitive: IPanePrimitive)` → `paneViews()` → `renderer()` → `IPrimitivePaneRenderer.draw(target)`. **Terverifikasi ada** di `node_modules/lightweight-charts/dist/typings.d.ts` baris 2055, 2135, 2178, 2292.

**Kenapa lewat primitive, bukan canvas terpisah bertumpuk**: canvas terpisah harus disinkronkan manual tiap zoom/pan/resize — sumber bug klasik overlay ketinggalan sepersekian detik dari candle (terlihat sebagai "geser"/"gemetar"). Primitive digambar di frame yang sama dengan candle, berbagi koordinat dan DPR chart. Ini memberi kebebasan menggambar apa pun (persis canvas 2D tangan sendiri) TANPA masalah sinkronisasi. Kalau kelak ada efek yang benar-benar tak muat di primitive (misalnya lapisan WebGL), barulah canvas terpisah — dan itu keputusan terpisah.

**DPR gratis dan benar**: renderer menerima `CanvasRenderingTarget2D` dari `fancy-canvas` (terpasang) yang punya `useBitmapCoordinateSpace(scope => ...)` + `horizontalPixelRatio`/`verticalPixelRatio` (`node_modules/fancy-canvas/canvas-rendering-target.d.ts` baris 17 dan 29). Gambar di dalam scope itu maka hasilnya tajam di layar DPR berapa pun, tanpa mengulang bug `WhalesPapan.tsx:78`.

---

## 1. AKAR "KURANG SMOOTH / GARIS MELEKAT" — KETEMU, PERBAIKAN 1 BARIS

Johan soal chart tradersaham/whales: *"garis putih yang di cursor itu tidak melekat pada candle tapi membaca candle"*.

**Sebab di PAPAN**: `CrosshairMode` **TIDAK PERNAH DISETEL** di seluruh `app/src` (grep `CrosshairMode|crosshair:` → **nol hasil**). Bawaan lightweight-charts adalah **Magnet**:

- `typings.d.ts:1084` → `@defaultValue {@link CrosshairMode.Magnet}`
- `typings.d.ts:41-43` → `Magnet = 1` — *"sticks crosshair's horizontal line to the price value of a single-value series or to the **close price** of OHLC-based series"* (= MELEKAT ke candle, persis yang Johan tak suka)
- `typings.d.ts:37-39` → `Normal = 0` — *"allows crosshair to move freely on the chart"* (= garis bebas ikut kursor, sementara pembacaan O/H/L/C tetap snap ke bar = persis perilaku tradersaham/whales)

**Perbaikan** di blok `createChart` (`GrafikEmiten.tsx:956`):

```ts
import { CrosshairMode } from 'lightweight-charts'
// ...
crosshair: {
  mode: CrosshairMode.Normal,        // garis bebas ikut kursor, bukan melekat ke close
  vertLine: { labelVisible: true },  // label waktu di sumbu bawah
  horzLine: { labelVisible: true },  // label HARGA-DI-KURSOR di sumbu kanan (nilai jual utama mode Normal)
},
```

Pembacaan O/H/L/C/V di header tetap snap ke bar karena datang dari `subscribeCrosshairMove` (`GrafikEmiten.tsx:1045`, sudah terpasang) yang memberi `param.seriesData` bar terdekat. Hasilnya **magnet-off untuk garis, magnet-on untuk data** — persis pola tradersaham.

**Uji terima**: hover di antara dua level harga → garis horizontal berhenti PERSIS di kursor (bukan lompat ke close), label harga di sumbu kanan mengikuti, header O/H/L/C tetap menampilkan bar yang di-hover. Uji di 2 viewport + tema terang/gelap.

## 1b. Sumber "kurang smooth" lain yang wajib dicek (urut kemungkinan)

| # | Dugaan | Cara cek | Perbaikan |
|---|---|---|---|
| 1 | **Crosshair Magnet** (di atas) | grep CrosshairMode = nol hasil | set `Normal` |
| 2 | Re-render React tiap `crosshairMove` | apakah `saatGeserKursor` (`:1039`) memicu `setState` per event | tampung di `useRef` lalu tulis ke DOM langsung, atau throttle `requestAnimationFrame` — jangan `setState` per mousemove |
| 3 | DPR mentah di komponen lain | `WhalesPapan.tsx:78` `devicePixelRatio \|\| 1` | pakai pola benar `bandingEmiten.ts:575` `Math.min(3, Math.max(1, Math.round(dpr)))` |
| 4 | Hitung indikator/pola di jalur render | apakah `hitungInstans`/`cariPolaKlasik` dipanggil dalam render | `useMemo` berkunci data+param; kalau berat pindah ke Web Worker |
| 5 | Terlalu banyak bar dirender sekaligus | 10 tahun x 962 emiten | `setVisibleRange` awal yang wajar; jangan render seluruh riwayat tanpa perlu |
| 6 | Layout thrash saat ukur pane | `requestAnimationFrame(ukurPane)` (`:2106,2125,2318`) | pastikan baca-lalu-tulis DOM dipisah, hindari read/write berselang-seling |

**Kriteria Terima kehalusan (terukur, bukan rasa)**: rekam Performance trace saat pan/zoom/hover 10 detik → **rata-rata ≥55 fps, nol frame >50 ms** di 1920 dan 412; scripting per frame <8 ms. Lampirkan trace di laporan.

---

## 2. Yang digambar di LAPIS 2 (primitive) — daftar konkret

Hanya untuk yang lightweight-charts tak sediakan. Semua dari data yang KITA punya:

| Primitive | Isi gambar | Data | Prioritas |
|---|---|---|---|
| **P1 · Garis rata-rata broker** | garis horizontal putus-putus + pill label `XC AVG BUY 179 (54%)`, warna per broker | `broker_harian/<KODE>.json` (ruas `average` per broker) | tinggi (gaya whales, data kita punya) |
| **P2 · Bubble broker outlier (HARIAN)** | lingkaran berlabel kode broker, radius sebanding besar net, warna beli/jual, ambang z-score bisa disetel | broker summary harian | tinggi |
| **P3 · Pita CPR + level Pivot** | band TC/P/BC + R1–R3/S1–S3, label di ujung kanan | OHLCV (rumus di `audit_chart_custom_LENGKAP.md` §4.1–4.2) | tinggi |
| **P4 · Overlay pola** | poligon/label pola yang sudah dihitung PAPAN (`polaKlasik`, Wyckoff, harmonik, divergensi, double-bottom, lonjakan volume) bila penggambaran sekarang masih terbatas marker | modul yang SUDAH ADA di `lib/dasbor/` | sedang |
| **P5 · Zona/level RBS & Gap** | garis level + badge + segitiga (sudah dispek di `spek_rbs_gap_intraday.md`) | OHLCV | sedang |
| **P6 · Crosshair kaya** | opsional: label tambahan di kursor berisi jarak % ke R1/S1/TC/BC | turunan | rendah |

Pola implementasi primitive (acuan):

```ts
class GarisAvgBroker implements IPanePrimitive<Time> {
  paneViews() {
    return [{ renderer: () => ({
      draw: (t) => t.useBitmapCoordinateSpace(({ context: ctx, verticalPixelRatio: vp }) => {
        // y = seriesHarga.priceToCoordinate(avg) * vp ; lalu gambar garis + label
      })
    }) }]
  }
}
chart.panes()[0].attachPrimitive(new GarisAvgBroker(/* ... */))
```

---

## 3. Yang TIDAK berubah (tetap berlaku)

- **Batas jujur**: footprint intraday per broker, heatmap orderbook, replay tick, CVD/delta sejati, area breakdown per level harga → **tetap TIDAK BISA** karena datanya tidak kita miliki. Izin "boleh bikin library chart" **tidak** mengubah ini. "Seperti whales.id" berarti kehalusan dan interaksi, bukan isi datanya.
- **TradingView embed** → tetap SKIP (dependensi pihak ketiga). Kewajiban atribusi lisensi lightweight-charts sudah dipenuhi lewat kaki situs `DasborLayout.tsx` — **jangan hapus baris atribusi itu** (lihat komentar `GrafikEmiten.tsx:967-978`).
- **Indikator dan panel analitik** → tetap seperti `audit_chart_custom_LENGKAP.md`: pakai registry 366 dulu (cross-check nama sebelum bikin baru), CPR/Pivot/R:R/VPA/Multi-Horizon dari OHLCV, Confluence 0–100 tetap **Tier 2 dikunci BT Papan + BadgeRapor**.
- **Kriteria Terima 6 butir** dan **BadgeRapor** tetap wajib.

## 4. Catatan: PAPAN sudah LEBIH KAYA dari tradersaham di deteksi pola

Terverifikasi di `app/src/lib/dasbor/`: `polaKlasik.ts` (pola klasik + status), `cariWyckoff`, `cariHarmonik` (+`RASIO_HARMONIK`), `cariDivergensi`, `cariDoubleBottom`, `cariLonjakanVolume`, `cariMusiman`, `chartAnalitik.ts`. Tradersaham hanya punya deteksi pola candle 1-bar (Marubozu dan sejenisnya). **Arah kerja: lengkapi yang kurang (pola candle 1-bar), jangan bongkar yang sudah unggul.**

## 5. Urutan kerja

1. **Sehari jadi**: set `CrosshairMode.Normal` + label harga di kursor, lalu uji hover (§1). Ini kemungkinan besar SUDAH menjawab keluhan "kurang smooth / melekat".
2. Profil performa (§1b, Kriteria Terima terukur) → perbaiki penyebab yang terbukti dari trace, satu per satu. **Jangan** menulis ulang engine sebelum trace menunjukkan lightweight-charts sendiri yang jadi batas.
3. Bangun 1 primitive percontohan (**P1 garis avg broker**) untuk membuktikan jalur hybrid mulus: zoom/pan/resize tidak menggeser overlay, tajam di DPR tinggi.
4. Lanjut P2 dan P3, lalu sisanya.
5. Baru pertimbangkan lapisan canvas terpisah atau engine sendiri **jika** ada kebutuhan yang terbukti tak muat di primitive — dengan bukti trace, bukan firasat.
