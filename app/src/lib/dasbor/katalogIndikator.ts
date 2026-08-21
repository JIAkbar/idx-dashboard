/**
 * Katalog indikator pustaka — 366 rumus TERPAKAI dari 457 di
 * `lightweight-charts-indicators` (MIT, di atas `oakscriptjs`), dibaca dari
 * REGISTRY pustaka, bukan dari daftar yang ditulis tangan.
 *
 * Yang 91 sisanya disaring dua kali, keduanya mekanis dan keduanya berjejak di
 * `docs/riset/audit-indikator.tsv`: 72 tanpa `plotConfig` DAN tanpa bentuk
 * `markers` yang bisa dipetakan jujur (lihat `keEntriKatalog`, `ID_PENANDA`)
 * dan 19 yang terbukti tak menggambar apa pun di OHLC kita (lihat
 * `indikatorDibuang.ts`). Johan 19 Agu 2026: *"bnyk indikator yang kmu pasang
 * tidak berfungsi mestinya pasang yang berguna saja"*. Satu dari yang 72 itu
 * (`williams-fractals`) masuk lewat jalur PENANDA sejak B30 — lihat
 * `ID_PENANDA` di bawah untuk kenapa cuma satu, bukan tiga.
 *
 * Johan 18 Agu 2026: *"katanya indikator nya banyak? sudah ada repo github
 * untuk menunjang"*.
 *
 * Kenapa registry, bukan daftar sendiri: daftar tangan pasti basi begitu
 * pustakanya naik versi — indikator baru tak muncul, indikator yang berganti
 * nama parameter diam-diam dihitung dengan masukan yang salah. Registry
 * membawa NAMA, KATEGORI, `overlay` (menumpang di panel harga atau tidak),
 * seluruh spek masukan beserta batasnya, dan fungsi hitungnya sendiri; semua
 * yang dibutuhkan menu dan penggambar ada di situ.
 *
 * ------------------------------------------------------------------
 * IMPOR DINAMIS — DAN INI SYARAT, BUKAN PILIHAN GAYA.
 *
 * Berkas pustaka itu satu bundel 1,9 MB berisi keseluruhan 457 rumus, dan
 * begitu registry-nya disentuh tak ada satu pun yang bisa dipangkas
 * tree-shaking (registry menunjuk seluruhnya). Diimpor secara STATIS dari mana
 * pun di aplikasi, seluruh 1,9 MB itu masuk ke potongan /grafik dan diunduh
 * setiap orang yang membuka halaman — termasuk yang cuma ingin melihat lilin.
 *
 * Karena itu: **jangan pernah menambahkan `import ... from
 * 'lightweight-charts-indicators'` di berkas mana pun**. Satu saja impor statis
 * di suatu tempat membatalkan seluruh manfaat berkas ini tanpa satu pun galat —
 * yang berubah cuma angka di laporan build. Impor TIPE (`import type`) aman;
 * ia terhapus saat kompilasi.
 * ------------------------------------------------------------------
 */
import type { SpekParam } from './grafikEmiten'
// Berkas HASIL audit — dihasilkan `node scripts/audit-indikator.mjs --tulis`,
// isinya cuma dua Set berisi teks. Aman diimpor statis: ia tak menarik apa pun
// dari pustaka, jadi larangan di kepala berkas ini tidak berlaku untuknya.
import { ID_DIBUANG } from './indikatorDibuang'

/** Bentuk satu ruas masukan di registry pustaka. Ditulis ulang di sini (bukan
 *  diimpor sebagai tipe) supaya berkas ini tak menarik apa pun dari pustaka
 *  saat kompilasi, dan supaya bentuk yang kita ANDALKAN tercatat hitam di atas
 *  putih — kalau versi berikutnya mengubahnya, yang gagal kompilasi berkas
 *  ini, bukan halaman yang diam-diam kosong. */
interface RuasMasukan {
  id: string
  type: 'int' | 'float' | 'string' | 'bool' | 'source' | 'color'
  title: string
  defval: unknown
  min?: number
  max?: number
  options?: unknown[]
}

interface EntriRegistry {
  id: string
  group: string
  name: string
  shortName: string
  description?: string
  category: string
  overlay: boolean
  inputConfig?: RuasMasukan[]
  plotConfig?: Array<{ id: string; title: string }>
  defaultInputs: Record<string, unknown>
  calculate: (bars: unknown[], inputs?: Record<string, unknown>) => {
    plots: Record<string, Array<{ time: unknown; value: number | null }>>
    // Entri TANPA `plotConfig` kadang mengembalikan ini alih-alih (atau
    // selain) `plots` — dibuktikan mekanis lewat
    // `app/scripts/periksa-bentuk-marker.mjs` (B30): `williams-fractals`
    // mengembalikannya PERSIS bentuk `SeriesMarker` pustaka kanvas. Opsional
    // karena mayoritas entri (deret) tak punya ruas ini sama sekali.
    markers?: PenandaMentah[]
    /** `zigzag` (B30): segmen garis dua titik yang BERSAMBUNG — akhir segmen
     *  ke-n selalu sama dengan awal segmen ke-n+1. */
    lines?: SegmenMentah[]
    /** `volume-delta` (B30): deret LILIN berskala volume, bukan deret angka. */
    plotCandles?: Record<string, LilinMentah[]>
  }
}

/** Satu penanda mentah dari `calculate()` pustaka — bentuk PERSIS `markers`
 *  di atas. Waktu masih EPOCH DETIK pustaka di sini; pemetaan balik ke lilin
 *  ada di `penandaPustaka` (`grafikEmiten.ts`), sama seperti `plotPustaka`
 *  memetakan balik deret angka. */
export interface PenandaMentah {
  time: unknown
  position: 'aboveBar' | 'belowBar' | 'inBar'
  shape: string
  color: string
  size?: number
}

/** Satu segmen garis mentah dari pustaka (`zigzag.lines`). Waktu masih epoch
 *  detik pustaka; pemetaan balik ke lilin ada di `pivotPustaka`. */
export interface SegmenMentah {
  time1: unknown
  price1: number
  time2: unknown
  price2: number
  color?: string
  width?: number
}

/** Satu lilin mentah dari pustaka (`volume-delta.plotCandles.delta`). */
export interface LilinMentah {
  time: unknown
  open: number
  high: number
  low: number
  close: number
  color?: string
  borderColor?: string
  wickColor?: string
}

export interface EntriKatalog {
  /** Id pustaka, mis. 'supertrend'. Jenis instansnya `p:supertrend`. */
  id: string
  nama: string
  singkat: string
  kategori: string
  /** Dari registry, bukan tebakan kita — lihat catatan di `KATEGORI`. */
  diPanelHarga: boolean
  param: SpekParam[]
  /** Judul tiap deret keluaran, urut sesuai `plotConfig`. */
  judulPlot: string[]
  /** Kunci plot ('plot0', 'plot1', …) urut sama dengan `judulPlot`. */
  kunciPlot: string[]
  hitung: (bars: unknown[], param: Record<string, number>) => {
    plots: Record<string, Array<{ time: unknown; value: number | null }>>
  }
  /** Cuma terisi untuk entri `ID_PENANDA` (`judulPlot`/`kunciPlot` kosong
   *  buat entri ini — tak ada deret untuk digambar sebagai garis). Kembalian
   *  `PenandaMentah[]`, waktu masih epoch pustaka; `grafikEmiten.ts` yang
   *  memetakannya balik ke lilin lewat `penandaPustaka`. */
  hitungPenanda?: (bars: unknown[], param: Record<string, number>) => PenandaMentah[]
  /** Cuma terisi untuk `ID_PIVOT` (`zigzag`). Segmen bersambung; penggambar
   *  merangkainya jadi SATU garis, bukan 145 seri terpisah. */
  hitungSegmen?: (bars: unknown[], param: Record<string, number>) => SegmenMentah[]
  /** Cuma terisi untuk `ID_LILIN` (`volume-delta`). */
  hitungLilin?: (bars: unknown[], param: Record<string, number>) => LilinMentah[]
}

export type Katalog = Map<string, EntriKatalog>

/**
 * Urutan kelompok di menu. Nama kategorinya milik registry (kolom `category`)
 * — TIDAK dikarang ulang; yang kita tentukan cuma urutan tampil dan
 * terjemahannya. Kategori yang muncul di registry tapi tak terdaftar di sini
 * tetap tampil, di bawah, dengan namanya sendiri: kategori baru di versi
 * pustaka berikutnya tak boleh membuat indikatornya lenyap dari menu.
 */
export const KATEGORI: Array<[inggris: string, indonesia: string]> = [
  ['Moving Averages', 'Rata-rata bergerak'],
  ['Oscillators', 'Osilator'],
  ['Momentum', 'Momentum'],
  ['Trend', 'Tren'],
  ['Volatility', 'Volatilitas'],
  ['Channels & Bands', 'Pita & kanal'],
  ['Volume', 'Volume'],
  ['Candlestick Patterns', 'Pola lilin'],
]

/**
 * Id pustaka untuk indikator yang di TradingView masuk deretan bawaan/
 * terpopuler — tampil sebagai kelompok "Populer (TradingView)" TEPAT sesudah
 * "Pilihan PAPAN" di menu (`GrafikEmiten.tsx`), supaya tak tenggelam di antara
 * 340-an entri katalog lain. Johan 21 Agu 2026: *"indikator default atau yang
 * umum di pakai di tradingview munculkan di utama di kelompokkan"*.
 *
 * Tiap id di sini DIVERIFIKASI mekanis ada di registry DAN lolos
 * `keEntriKatalog` (skrip pemeriksa sekali-pakai, bukan tebakan) sebelum
 * ditulis — bukan disalin dari nama yang "kedengarannya" cocok. Tiga
 * kandidat yang diminta TIDAK masuk, dan alasannya bukan kelalaian:
 * - `atr`: entrinya ADA tapi masuk `ID_SUDAH_ADA` (ATR internal PAPAN) —
 *   menu sudah menyaringnya di tempat lain, dobel di sini tak akan pernah
 *   tampil.
 * - "Pivot Points Standard": TIDAK ada di registry pustaka ini (yang ada
 *   cuma varian turunan — `pivot-point-supertrend`, `pivot-hh-hl-lh-ll` —
 *   beda indikator, bukan pivot S/R baku).
 * - `price-volume-profile`: `plotConfig` kosong (bukan deret angka, bentuknya
 *   profil harga×volume) — tak lolos `keEntriKatalog`, tak pernah ada di
 *   katalog untuk dirujuk.
 */
export const POPULER: ReadonlySet<string> = new Set([
  'supertrend', 'ichimoku', 'parabolic-sar',
  'adx', 'dmi', // dua indikator TradingView terpisah (ADX-saja vs +DI/-DI/ADX), bukan duplikat
  'cci', 'mfi', 'roc', 'momentum',
  'williams-alligator', 'aroon', 'keltner', 'donchian',
  'ema-ribbon', 'hma', 'wma', 'dema', 'tema', 'vwma',
  'chaikin-mf', 'stochastic-momentum-index', 'trix',
  'ultimate-osc', 'awesome-oscillator', 'bull-bear-power',
  'elder-force', 'eom',
])

/**
 * Id pustaka TANPA `plotConfig` yang tetap masuk katalog lewat jalur PENANDA
 * (`createSeriesMarkers`), bukan garis. B30 — Johan menunjuk tiga kandidat
 * (`volume-delta`, `williams-fractals`, `zigzag`), diuji mekanis lewat
 * `app/scripts/periksa-bentuk-marker.mjs` atas OHLC nyata (BBCA) sebelum
 * satu baris kode ditulis. Cuma satu yang bentuknya PERSIS `SeriesMarker`
 * (`time`/`position`/`shape`/`color`/`size`) — dua lainnya TIDAK dipaksakan
 * lewat jalur ini:
 *
 * - `volume-delta` mengembalikan `plotCandles.delta`: deret LILIN (open/high/
 *   low/close/color) berskala volume, bukan penanda titik.
 * - `zigzag` mengembalikan `pivots`/`lines`/`labels`: SEGMEN garis dua titik
 *   + teks. Markernya sendiri (titik pivot) sah, tapi tanpa garis
 *   penghubungnya bukan lagi zigzag — cuma titik-titik lepas yang bentuknya
 *   menyesatkan (terlihat seperti pola acak, bukan tren berbelok).
 *
 * Dua yang terakhir sempat DITOLAK karena kanvas ini belum punya jalur untuk
 * bentuknya. Jalur itu sekarang ada — garis pola divergensi membuka jalan seri
 * garis tambahan, dan panel volume yang berdiri sendiri membuka jalan seri
 * lilin di pane sendiri — jadi keduanya masuk lewat pintunya masing-masing di
 * bawah, bukan dipaksakan jadi penanda titik.
 */
export const ID_PENANDA: ReadonlySet<string> = new Set(['williams-fractals'])

/** Keluarannya SEGMEN garis bersambung (`lines`), dirangkai jadi satu garis
 *  di panel harga. */
export const ID_PIVOT: ReadonlySet<string> = new Set(['zigzag'])

/** Keluarannya deret LILIN (`plotCandles`), digambar sebagai seri candlestick
 *  di panel sendiri. Kunci deretnya diambil apa adanya dari `plotCandles` —
 *  yang pertama yang dipakai. */
export const ID_LILIN: ReadonlySet<string> = new Set(['volume-delta'])

/**
 * Id pustaka yang TIDAK dimasukkan ke katalog karena PAPAN sudah punya
 * rumusnya sendiri (dan ujinya sendiri — lihat grafikEmiten.test.ts).
 *
 * Bukan soal harga diri: dua "RSI" di satu menu berarti dua garis yang boleh
 * berbeda tanpa ada yang tahu mana yang benar. Yang dipakai tetap punya kita;
 * kesetaraan angkanya dijaga uji silang RSI, bukan asumsi.
 */
export const ID_SUDAH_ADA = new Set([
  'sma', 'ema', 'rsi', 'macd', 'bb', 'obv', 'atr',
  // Empat berikut sudah dikurasi jadi jenis sendiri (label & parameter
  // Indonesia, jangkar VWAP yang tak degenerate di data harian) — rumusnya
  // tetap milik pustaka, jalurnya lewat `hitungInstans`.
  'stoch', 'stoch-rsi', 'williams-r', 'vwap',
])

/**
 * Id yang GALAT atau seluruh nilainya kosong begitu dipanggil lewat jalur
 * KATALOG sesungguhnya (`buatInstans`+`hitungInstans`, param bawaan
 * `SpekParam`) atas BBCA nyata — beda dari `ID_DIBUANG` (`indikatorDibuang.ts`),
 * yang diuji lewat `defaultInputs` MENTAH registry, BBCA+ARCI. Bedanya
 * berarti: entri bisa lolos audit registry tapi rusak di sini kalau
 * `calculate()`-nya diam-diam butuh ruas `bool`/`color` yang TAK PERNAH
 * dikirim `keMasukanPustaka` (lihat audit). Diukur mekanis oleh
 * `app/scripts/audit-katalog-terpakai.ts`, laporan penuh di
 * `docs/riset/audit-katalog-terpakai.md`.
 *
 * Kosong sekarang: audit 21 Agu 2026 atas 368 entri katalog, nol yang rusak
 * di jalur ini. Dibiarkan berdiri (bukan dihapus) supaya audit berikutnya —
 * begitu pustaka naik versi — punya tempat menaruh temuannya tanpa menyentuh
 * `keEntriKatalog`.
 */
export const ID_RUSAK: ReadonlySet<string> = new Set([])

/** Ruas masukan pustaka -> satu kolom di panel setelan. `null` = tak
 *  ditampilkan dan dibiarkan memakai bawaan pustaka:
 *  - `source` (close/hl2/hlc3/…): pilihan yang cuma berarti kalau pembacanya
 *    sudah tahu isi rumusnya; bawaannya selalu yang lazim.
 *  - `bool` & `color`: kolom kita cuma mengenal angka, dan menambah dua jenis
 *    ruas baru demi sakelar yang jarang dipakai bukan tukar yang setara. */
export function keSpekParam(ruas: RuasMasukan): SpekParam | null {
  if (ruas.type === 'int' || ruas.type === 'float') {
    return {
      kunci: ruas.id,
      label: ruas.title,
      bawaan: Number(ruas.defval) || 0,
      // Batas bawaan sengaja lebar, bukan ketat: registry tak selalu menyebut
      // min/max, dan menebak batas yang tak disebut berarti menolak nilai yang
      // sebenarnya sah di rumus itu.
      min: ruas.min ?? -100000,
      maks: ruas.max ?? 100000,
      bulat: ruas.type === 'int',
      // Periode yang lebih panjang dari jumlah lilin membuat seluruh deretnya
      // `null` — garisnya lenyap tanpa galat. Ruas yang namanya berbau periode
      // ikut dijaga aturan yang sudah ada; sisanya tidak, karena "offset 500"
      // memang bukan periode.
      bandingLilin: /len|length|period|panjang/i.test(ruas.id),
    }
  }
  if (ruas.type === 'string' && Array.isArray(ruas.options) && ruas.options.length > 1) {
    const opsi = ruas.options.map((o) => String(o))
    const bawaan = Math.max(0, opsi.indexOf(String(ruas.defval)))
    return {
      kunci: ruas.id,
      label: ruas.title,
      // Disimpan sebagai INDEKS, bukan teksnya: seluruh jalur instans
      // (validasi, template, penyimpanan) sudah berupa angka, dan menambahkan
      // ruas bertipe teks berarti menyentuh semuanya demi satu kasus.
      bawaan,
      min: 0,
      maks: opsi.length - 1,
      bulat: true,
      pilihan: opsi.map((label, nilai) => ({ nilai, label })),
    }
  }
  return null
}

/** Kebalikannya: nilai kolom (angka) -> masukan pustaka. Ruas berpilihan
 *  dikembalikan jadi teks aslinya. Ruas yang tak kita tampilkan tak dikirim
 *  sama sekali — `calculate` menggabungkannya sendiri dengan `defaultInputs`. */
export function keMasukanPustaka(
  ruas: RuasMasukan[],
  param: Record<string, number>,
): Record<string, unknown> {
  const keluar: Record<string, unknown> = {}
  for (const r of ruas) {
    const v = param[r.id]
    if (v === undefined || !Number.isFinite(v)) continue
    if (r.type === 'string' && Array.isArray(r.options)) keluar[r.id] = r.options[v] ?? r.defval
    else if (r.type === 'int' || r.type === 'float') keluar[r.id] = v
  }
  return keluar
}

/**
 * Satu entri registry -> entri katalog, atau `null` kalau tak bisa digambar
 * dengan jujur oleh kanvas ini.
 *
 * Yang ditolak dan kenapa: entri TANPA `plotConfig` (73 dari 457 — hampir
 * seluruhnya pola lilin yang keluarannya penanda/label, bukan deret angka).
 * Kanvas ini menggambar deret; entri semacam itu akan ditambahkan, muncul di
 * legenda, dan tak menggambar apa pun — indikator yang "menyala tapi kosong"
 * jauh lebih buruk daripada indikator yang jujur tak ada di menu.
 *
 * Ketujuh puluh tiga itu TIDAK hilang tanpa jejak: seluruhnya terdaftar dengan
 * alasannya di `docs/riset/audit-indikator.tsv` bervonis `BUTUH_MASUKAN_LAIN`.
 * Yang mereka butuhkan penanda/label di atas lilin (jalur `markers`), bukan
 * ruas data yang tak kita punya. Jalur itu SEKARANG ada (`ID_PENANDA`,
 * B30) — tapi cuma untuk id yang bentuk keluarannya sudah dibuktikan cocok;
 * tanpa itu entrinya tetap ditolak di sini persis seperti sebelumnya.
 */
export function keEntriKatalog(e: EntriRegistry): EntriKatalog | null {
  if (ID_RUSAK.has(e.id)) return null
  const ruas = e.inputConfig ?? []
  const dasar = {
    id: e.id,
    nama: e.name,
    singkat: e.shortName || e.name,
    kategori: e.category,
    // Langsung dari registry. Menebak sendiri berarti menaruh osilator 0-100
    // di skala rupiah (garisnya rata di dasar kanvas) atau menaruh garis harga
    // di panel bawah — dua-duanya salah dan dua-duanya senyap.
    diPanelHarga: e.overlay === true,
    param: ruas.map(keSpekParam).filter((s): s is SpekParam => s !== null),
  }
  if (e.plotConfig?.length) {
    return {
      ...dasar,
      judulPlot: e.plotConfig.map((p, i) => p.title || `Deret ${i + 1}`),
      kunciPlot: e.plotConfig.map((p) => p.id),
      hitung: (bars, param) => e.calculate(bars, keMasukanPustaka(ruas, param)),
    }
  }
  if (ID_PENANDA.has(e.id)) {
    // `judulPlot`/`kunciPlot` kosong — tak ada deret, jalur garis biasa
    // (`garisPustaka` di grafikEmiten.ts) menghasilkan legenda kosong dengan
    // benar buat entri ini alih-alih melempar galat.
    return {
      ...dasar,
      judulPlot: [],
      kunciPlot: [],
      hitung: (bars, param) => e.calculate(bars, keMasukanPustaka(ruas, param)),
      hitungPenanda: (bars, param) => e.calculate(bars, keMasukanPustaka(ruas, param)).markers ?? [],
    }
  }
  if (ID_PIVOT.has(e.id)) {
    return {
      ...dasar,
      judulPlot: [],
      kunciPlot: [],
      hitung: (bars, param) => e.calculate(bars, keMasukanPustaka(ruas, param)),
      hitungSegmen: (bars, param) => e.calculate(bars, keMasukanPustaka(ruas, param)).lines ?? [],
    }
  }
  if (ID_LILIN.has(e.id)) {
    return {
      ...dasar,
      judulPlot: [],
      kunciPlot: [],
      hitung: (bars, param) => e.calculate(bars, keMasukanPustaka(ruas, param)),
      hitungLilin: (bars, param) => {
        const c = e.calculate(bars, keMasukanPustaka(ruas, param)).plotCandles ?? {}
        return Object.values(c)[0] ?? []
      },
    }
  }
  return null
}

let terpasang: Promise<Katalog> | null = null

/**
 * Memuat katalog SEKALI lalu memakai ulang janjinya. Dipanggil saat pembaca
 * membuka menu Indikator (dan saat template memuat instans pustaka), bukan
 * saat halaman dibuka — lihat catatan impor dinamis di kepala berkas.
 *
 * Gagal muat (jaringan putus di tengah) mengembalikan katalog KOSONG, bukan
 * melempar: yang hilang cuma katalog tambahannya, dan menjatuhkan seluruh
 * halaman grafik karena itu adalah harga yang tak sebanding. Janjinya
 * dilepaskan supaya percobaan berikutnya benar-benar mencoba lagi.
 */
export function muatKatalog(): Promise<Katalog> {
  if (!terpasang) {
    terpasang = import('lightweight-charts-indicators')
      .then((m) => {
        const peta: Katalog = new Map()
        for (const e of m.indicatorRegistry as unknown as EntriRegistry[]) {
          // Vonis audit mekanis, BUKAN selera. 19 dari 457 entri melempar
          // galat, mengembalikan nol nilai berhingga, atau menggambar sesuatu
          // yang mustahil terlihat (konstan sepanjang deret, atau `overlay`
          // yang seluruh nilainya jatuh di luar pita harga). Dibuang DI SINI,
          // bukan di menu, supaya template lama yang menyimpan id semacam itu
          // ikut gagal-anggun jadi "jenis tak dikenal" alih-alih menambahkan
          // baris legenda yang selamanya kosong.
          if (ID_DIBUANG.has(e.id)) continue
          // `ID_SUDAH_ADA` TIDAK disaring di sini: empat di antaranya (Stoch,
          // StochRSI, W%R, VWAP) justru dihitung lewat entri ini — yang
          // dikurasi cuma label & parameternya. Yang menyaringnya menu (lihat
          // `opsiKatalog` di GrafikEmiten.tsx), karena yang tak boleh dobel
          // memang barisnya di menu, bukan rumusnya di peta.
          const entri = keEntriKatalog(e)
          if (entri) peta.set(entri.id, entri)
        }
        return peta
      })
      .catch(() => {
        terpasang = null
        return new Map<string, EntriKatalog>()
      })
  }
  return terpasang
}

/* Katalog TIDAK disimpan sebagai variabel modul yang dibaca diam-diam oleh
   perhitungan. Ia dipegang state React dan DILEWATKAN ke tiap pemanggil
   (`hitungInstans`, spek parameter, penempatan pane). Alasannya bukan
   kerapian: memo React membandingkan dependensinya: katalog yang datang lewat
   variabel modul tak pernah masuk daftar itu, jadi garis-garis yang sudah
   telanjur digambar kosong tak akan pernah digambar ulang saat katalognya
   akhirnya tiba — dan tak ada satu pun galat yang muncul. */
