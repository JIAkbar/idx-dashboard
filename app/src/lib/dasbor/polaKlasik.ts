import type { LilinData, TitikZigzag } from './grafikEmiten'
import { hitungATR, zigzagPivot } from './grafikEmiten'

/**
 * Pola chart klasik — mesin SATU untuk enam belas pola (sembilan reversal +
 * tujuh continuation: flag, pennant, ascending/descending/symmetrical
 * triangle), di atas pivot zigzag yang sudah dipakai Harmonic.
 *
 * Johan 21 Agu 2026 menaruh gambar 20 pola klasik di `data ide/` dan memilih
 * bertahap: *"reversal dulu"*. Permintaannya eksplisit dua hal: (1) polanya
 * jadi MENU di chart dan chart **menggambar garisnya sendiri** — leher,
 * garis tren baji, kerangka pivotnya; (2) *"bukan asal tebak berdasarkan
 * hasil benchmark dan backtesting data di 4H dan 1D bahkan kalau bisa 1W"*.
 * Angka backtest-nya ada di bawah, diukur `app/scripts/backtest-pola-klasik.ts`
 * yang MENGIMPOR berkas ini — bukan salinannya (pelajaran mahal dari
 * `backtest-struktur`: salinan rumus menguji kode yang tidak dikirim).
 *
 * ## Kenapa satu mesin, bukan sembilan detektor
 *
 * Seluruh pola di gambar itu adalah pola pada URUTAN PIVOT: Double Top = dua
 * pivot tinggi setara, Head & Shoulders = tiga pivot tinggi dengan yang
 * tengah menjulang, baji = dua garis tren pivot yang menyempit. Jadi
 * mesinnya satu — `zigzagPivot` (jendela + ayunan minimum) memberi deret
 * pivot berseling tinggi/rendah, lalu tiap jendela 3 atau 5 pivot diperiksa
 * terhadap syarat tiap pola. Sembilan detektor terpisah berarti sembilan
 * cara berbeda memilih pivot, dan dua di antaranya pasti tak sepakat.
 *
 * ## Tiga keputusan yang menentukan kejujurannya
 *
 * 1. **Pola baru SELESAI saat leher/garis trennya PATAH, bukan saat
 *    bentuknya kelihatan.** Dua puncak setara belum berarti apa-apa —
 *    setengah dari kejadiannya harga justru lanjut naik. Yang di-backtest
 *    dan yang digambar adalah PATAHANNYA (`iSinyal`), sama seperti buku
 *    teksnya mendefinisikan.
 * 2. **Bebas bocor masa depan.** Sebuah pivot baru TERBUKTI pivot sesudah
 *    `jendela` lilin di kanannya terbentuk, jadi patahan hanya dicari mulai
 *    `pivotTerakhir.i + jendela`. Pelajaran terukur dari struktur pasar:
 *    versi yang bocor melebihkan keunggulan hampir tiga kali lipat.
 * 3. **Kesetaraan diukur dalam ATR, bukan persen tetap** — alasan yang sama
 *    dengan Double Bottom: toleransi persen memperlakukan saham 50 rupiah
 *    dan 50.000 rupiah dengan dua ukuran yang salah satunya pasti keliru.
 *
 * ## Angka backtest (21 Agu 2026 — 18 emiten, param bawaan, leak-free)
 *
 * Diukur `backtest-pola-klasik.ts`, arah benar sesudah lilin SINYAL vs
 * peluang dasar arah yang sama di emiten yang sama (pp = poin persentase di
 * atas dasar; dasar sinyal bearish = seberapa sering harga memang turun).
 * Angka gabungan di bawah SUDAH termasuk continuation (n-nya karena itu naik
 * dari angka reversal-saja yang diukur 21 Agu; sebagian pivot yang dulu jatuh
 * ke Double Bottom/Rising Wedge dkk. sekarang lebih dulu diklaim continuation
 * — sama mekanismenya dengan Triple Top mengklaim pivot sebelum Double Top):
 *
 *   1D (n=491)  5 lilin −2,4pp · 10 lilin −1,2pp · 20 lilin **+2,7pp**
 *   4H (n=365)  5 lilin +0,5pp · 10 lilin +0,0pp · 20 lilin −0,2pp
 *   1W (n=105)  5 lilin **+6,9pp** · 10 lilin +2,8pp · 20 lilin +1,0pp
 *
 * Per pola TIDAK sama kuat, dan angkanya sengaja tak diratakan (angka
 * REVERSAL di bawah ini angka 21 Agu, sebelum continuation ditambahkan —
 * dibiarkan apa adanya, bukan diukur ulang, karena penjelasannya sudah
 * ditulis dan tetap sahih sebagai gambaran bentuknya):
 *
 *   - Paling teruji di harian: **Head & Shoulders** (+18,2/+15,8/+9,0pp,
 *     n=29), **Double Bottom** (+11,8/+11,2/+4,9pp, n=82), Double Top &
 *     Triple Top menguat di 20 lilin (+7,5pp dan +13,3pp).
 *   - Yang LEMAH di harian dan wajib disebut jujur: Rising Wedge
 *     (−4,9/−8,9/−4,2pp, n=93) dan Inverted H&S (−5,6/−11,1/−0,5pp, n=24) —
 *     di 4H keduanya justru positif (+7,6pp dan +18,6pp di jendelanya),
 *     jadi kelemahannya bukan cacat deteksi melainkan sifat kerangkanya.
 *   - Pekanan n-nya kecil (3-20 per pola) — angkanya indikatif, bukan vonis.
 *
 * ## Angka backtest — CONTINUATION (21 Agu 2026, sama 18 emiten & param)
 *
 * Diukur bersamaan dengan tabel gabungan di atas. Tak ada pola continuation
 * yang konsisten kuat di ketiga kerangka — beda nasib dari kerangka ke
 * kerangka, dan itu dicetak apa adanya, bukan diratakan jadi satu vonis:
 *
 *   1D:  ascending-triangle  +18,7/−0,2/−1,7pp (n=17)
 *        bearish-flag        +18,5/+19,4/**+34,7pp** (n=7)
 *        bearish-pennant     −9,5/−4,4/−8,1pp (n=16-17)
 *        bullish-flag        −7,1/−8,9/−18,4pp (n=13)
 *        bullish-pennant     −9,9/−5,0/−1,7pp (n=15)
 *        descending-triangle −6,2/−5,3/−11,2pp (n=26)
 *        symmetrical-triangle −11,6/−6,5/+3,2pp (n=41)
 *   4H:  ascending-triangle  −5,0 · **+20,5** · −2,6pp (n=9-10)
 *        bearish-flag        **−30,3 · −40,8** · −27,4pp (n=8)
 *        bearish-pennant     −9,7/−22,7/−14,5pp (n=14)
 *        bullish-flag        −11,8/+2,4/−15,3pp (n=6)
 *        bullish-pennant     −17,2/−19,7/−2,5pp (n=17)
 *        descending-triangle **+19,8** · −3,4/−11,3pp (n=12)
 *        symmetrical-triangle −4,1/−1,7/+5,4pp (n=48-51)
 *   1W:  n per pola 1-11 — terlalu kecil untuk dibaca sebagai apa pun selain
 *        indikasi kasar; bearish-flag & bullish-pennant malah n=1-2.
 *
 * Bacaan jujurnya: **Bearish Flag harian** (n=7, +34,7pp di 20 lilin) dan
 * **Descending Triangle 4H** (n=12, +19,8pp di 5 lilin) yang paling menjanjikan
 * — tapi n-nya kecil di kedua-duanya. Yang paling LEMAH dan n-nya cukup
 * besar untuk dipercaya: **Bullish Flag** negatif di ketiga jendela harian
 * (n=13) dan makin negatif di 4H **Bearish Flag** (n=8, −30,3/−40,8pp) —
 * dua kebalikan arah "flag" ini sama-sama lemah, jadi bukan kebetulan
 * satu kerangka. Symmetrical Triangle paling STABIL (selalu di kisaran
 * ±10pp di ketiga kerangka) meski tak pernah kuat.
 *
 * Kesimpulan mesinnya: pola digambar APA ADANYA (ia deskripsi bentuk, dan
 * garisnya berguna sekalipun keunggulan statistiknya tipis), sedangkan angka
 * per pola dicetak di panduan halaman supaya pembaca menimbangnya sendiri —
 * bukan disembunyikan di balik kata "teruji".
 */

export interface ParamPolaKlasik {
  /** Lebar jendela pivot zigzag (lilin di kiri & kanan). */
  jendela: number
  /** Ayunan zigzag minimum, persen. */
  ayunMin: number
  /** Periode ATR untuk toleransi kesetaraan. */
  atr: number
  /** Toleransi kesetaraan puncak/lembah, dalam kelipatan ATR. */
  toleransi: number
  /** Berapa lilin sesudah pivot terakhir patahan masih ditunggu. */
  tunggu: number
  /** Panjang tiang (pole) yang dicek SEBELUM jendela flag/pennant, dalam
   *  lilin ke belakang dari pivot pertama jendela. */
  tiang: number
  /** Tinggi tiang minimum, dalam kelipatan ATR — gerak yang jelas bukan riak. */
  tiangAtr: number
}

export const PARAM_POLA_KLASIK_BAWAAN: ParamPolaKlasik = {
  jendela: 5,
  ayunMin: 3,
  atr: 14,
  toleransi: 1,
  // 40 lilin ≈ dua bulan bursa. Patahan yang datang lebih lambat dari itu
  // sudah bukan reaksi terhadap polanya — leher yang ditembus lima bulan
  // kemudian cuma kebetulan segaris.
  tunggu: 40,
  // 20 lilin ≈ sebulan bursa — tiang yang lebih pendek dari itu gampang jadi
  // riak biasa, bukan gerak yang layak disebut tiang flag/pennant.
  tiang: 20,
  // 4×ATR — gerak yang jelas bukan riak, satuan jarak yang sama di seluruh
  // papan (alasan sama dengan toleransi kesetaraan puncak/lembah).
  tiangAtr: 4,
}

export type NamaPolaKlasik =
  | 'double-top' | 'double-bottom'
  | 'triple-top' | 'triple-bottom'
  | 'head-shoulders' | 'inv-head-shoulders'
  | 'rising-wedge' | 'falling-wedge'
  | 'expanding-triangle'
  | 'bullish-flag' | 'bearish-flag'
  | 'bullish-pennant' | 'bearish-pennant'
  | 'ascending-triangle' | 'descending-triangle' | 'symmetrical-triangle'

export const LABEL_POLA_KLASIK: Record<NamaPolaKlasik, string> = {
  'double-top': 'Double Top',
  'double-bottom': 'Double Bottom',
  'triple-top': 'Triple Top',
  'triple-bottom': 'Triple Bottom',
  'head-shoulders': 'Head & Shoulders',
  'inv-head-shoulders': 'Inverted Head & Shoulders',
  'rising-wedge': 'Rising Wedge',
  'falling-wedge': 'Falling Wedge',
  'expanding-triangle': 'Expanding Triangle',
  'bullish-flag': 'Bullish Flag',
  'bearish-flag': 'Bearish Flag',
  'bullish-pennant': 'Bullish Pennant',
  'bearish-pennant': 'Bearish Pennant',
  'ascending-triangle': 'Ascending Triangle',
  'descending-triangle': 'Descending Triangle',
  'symmetrical-triangle': 'Symmetrical Triangle',
}

/** Satu titik garis — indeks lilin + harga. Pemetaan ke waktu chart terjadi
 *  di penggambar, bukan di sini: mesinnya dipakai juga oleh backtest yang
 *  tak punya (dan tak butuh) sumbu waktu kanvas. */
export interface TitikGarisPola {
  i: number
  harga: number
}

export interface PolaKlasik {
  nama: NamaPolaKlasik
  arah: 'bullish' | 'bearish'
  /** Pivot pembentuknya, urut waktu. */
  pivot: TitikZigzag[]
  /** Lilin tempat leher/garis tren PATAH — di sinilah polanya selesai dan
   *  di sinilah penandanya berdiri. */
  iSinyal: number
  /** Penutupan lilin sinyal. */
  hargaSinyal: number
  /**
   * Garis yang digambar kanvas. Garis pertama SELALU kerangka pivot
   * (polyline zigzag pembentuk pola); sisanya leher / garis tren, ditarik
   * sampai lilin sinyal supaya patahannya terlihat sebagai perpotongan.
   */
  garis: TitikGarisPola[][]
  /**
   * TARGET harga — spek Auto Chart Patterns TradingView, dibaca langsung
   * dari Help Center-nya (`docs/riset/spek-pola-tradingview.md`): sesudah
   * patahan, harga diharapkan berjalan kira-kira SETINGGI POLANYA searah
   * patahan. Tinggi pola = rentang pivot pembentuknya; jangkarnya nilai
   * garis yang ditembus pada lilin sinyal.
   */
  target: number
  /** Level PEMBATAL — ekstrem pola di sisi berlawanan patahan (spek yang
   *  sama: Double Top gagal saat harga melewati puncaknya lagi, Triangle
   *  saat melewati titik terakhir sisi berlawanan). */
  batal: number
  /**
   * Nasib pola SETELAH sinyal, dari lilin yang sudah terjadi:
   *   - `tercapai` — ekstrem harga menyentuh target;
   *   - `gagal`    — penutupan melewati `batal` sebelum target tersentuh;
   *   - `menunggu` — belum keduanya.
   * Ini LABEL deskriptif atas data yang sudah lewat, bukan ramalan — dan
   * backtest TIDAK memakainya (ia hanya mengukur arah dari lilin sinyal).
   */
  status: StatusPolaKlasik
  /** Lilin tempat statusnya diputuskan; `null` selagi `menunggu`. Garis
   *  target digambar dari lilin sinyal sampai ke sini — meniru TradingView
   *  yang menghentikan garisnya begitu status berubah. */
  iStatus: number | null
}

export type StatusPolaKlasik = 'menunggu' | 'tercapai' | 'gagal'

export const LABEL_STATUS_POLA: Record<StatusPolaKlasik, string> = {
  menunggu: 'menunggu',
  tercapai: 'target tercapai',
  gagal: 'gagal',
}

/** Pola sebelum pasca-proses — tanpa target/batal/status. Ruas itu
 *  dilengkapi SATU kali di ujung `cariPolaKlasik`, bukan di enam belas
 *  tempat push yang pasti akan tercecer satu. */
type PolaKlasikMentah = Omit<PolaKlasik, 'target' | 'batal' | 'status' | 'iStatus'>

/** Nilai sebuah garis lurus lewat dua titik, dievaluasi di indeks `i`.
 *  Dipakai leher miring H&S dan garis tren baji. Dua pivot berindeks sama
 *  tak pernah terjadi (zigzag berseling), jadi pembaginya aman. */
function nilaiGaris(a: TitikGarisPola, b: TitikGarisPola, i: number): number {
  return a.harga + ((b.harga - a.harga) / (b.i - a.i)) * (i - a.i)
}

/**
 * Arah tiang (pole) SEBELUM `i0` (pivot pertama jendela flag/pennant) —
 * 'naik'/'turun' kalau gerak dari `i0 - p.tiang` ke `i0` sudah cukup kuat
 * (>= `tiangAtr` × ATR di `i0`), null kalau datanya belum cukup ke belakang
 * atau geraknya cuma riak. Tanpa tiang, flag/pennant tak beda dari baji &
 * expanding yang sudah ditangani blok sebelumnya — tiang-lah yang menandai
 * pola ini sebagai KELANJUTAN tren, bukan pembalikannya.
 */
function arahTiang(
  lilin: LilinData[], atr: Array<number | null>, i0: number, p: ParamPolaKlasik,
): 'naik' | 'turun' | null {
  const iAsal = i0 - p.tiang
  if (iAsal < 0) return null
  const a = atr[i0]
  if (a === null) return null
  const delta = lilin[i0].close - lilin[iAsal].close
  if (delta >= p.tiangAtr * a) return 'naik'
  if (delta <= -p.tiangAtr * a) return 'turun'
  return null
}

/**
 * Cari lilin pertama yang MENUTUP menembus `batas(i)` ke arah `arah`,
 * mulai `dari` (sudah termasuk konfirmasi pivot), paling jauh `tunggu` lilin.
 *
 * Penutupan, bukan intraday: sumbu yang menusuk leher lalu ditarik kembali
 * adalah kejadian paling biasa di papan tipis, dan menghitungnya sebagai
 * patahan membuat polanya berbunyi tiga kali lebih sering dengan keunggulan
 * yang menguap.
 */
function cariTembus(
  lilin: LilinData[],
  dari: number,
  tunggu: number,
  batas: (i: number) => number,
  arah: 'bawah' | 'atas',
): number | null {
  const sampai = Math.min(lilin.length, dari + tunggu)
  for (let i = dari; i < sampai; i++) {
    const c = lilin[i].close
    if (arah === 'bawah' ? c < batas(i) : c > batas(i)) return i
  }
  return null
}

/** Kerangka pivot sebagai garis pertama. */
const kerangka = (w: TitikZigzag[]): TitikGarisPola[] => w.map((p) => ({ i: p.i, harga: p.harga }))

/**
 * Mesin pencarinya.
 *
 * Urutan pemeriksaan disengaja: jendela LIMA pivot dulu (H&S, triple, baji,
 * expanding), baru jendela tiga pivot (double). Pivot yang sudah diklaim
 * pola lima-pivot tak boleh dipakai double lagi — tanpa itu setiap Triple
 * Top juga melahirkan satu-dua Double Top di pivot yang sama, dan kanvasnya
 * menumpuk tiga label untuk satu kejadian.
 */
export function cariPolaKlasik(lilin: LilinData[], p: ParamPolaKlasik): PolaKlasik[] {
  if (lilin.length === 0) return []
  const zz = zigzagPivot(lilin, p.jendela, p.ayunMin)
  if (zz.length < 3) return []
  const atr = hitungATR(lilin, p.atr)
  // Ruas target/status dilengkapi SATU kali di pasca-proses bawah — bukan
  // di enam belas tempat push, yang pasti akan tercecer satu.
  const out: PolaKlasikMentah[] = []
  const terpakai = new Set<number>()

  const tolDi = (i: number): number | null => {
    const a = atr[Math.min(i, atr.length - 1)]
    return a !== null && a > 0 ? a * p.toleransi : null
  }

  // ---- jendela LIMA pivot --------------------------------------------
  for (let k = 0; k + 5 <= zz.length; k++) {
    const w = zz.slice(k, k + 5)
    if (w.some((x) => terpakai.has(x.i))) continue
    const akhir = w[4]
    const dari = akhir.i + p.jendela // konfirmasi pivot — bukan akhir.i + 1
    if (dari >= lilin.length) continue
    const tol = tolDi(akhir.i)
    if (tol === null) continue

    // Dua garis tren (atas & bawah) dari jendela ini — dipakai baji,
    // expanding, DAN continuation (flag/pennant/segitiga) di bawah.
    const tinggi = w.filter((x) => x.jenis === 'tinggi')
    const rendah = w.filter((x) => x.jenis === 'rendah')
    const tAwal = tinggi[0]; const tAkhir = tinggi[tinggi.length - 1]
    const rAwal = rendah[0]; const rAkhir = rendah[rendah.length - 1]
    const gT = { a: { i: tAwal.i, harga: tAwal.harga }, b: { i: tAkhir.i, harga: tAkhir.harga } }
    const gR = { a: { i: rAwal.i, harga: rAwal.harga }, b: { i: rAkhir.i, harga: rAkhir.harga } }
    const slopeT = (gT.b.harga - gT.a.harga) / (gT.b.i - gT.a.i)
    const slopeR = (gR.b.harga - gR.a.harga) / (gR.b.i - gR.a.i)
    const naikT = tinggi.every((x, j) => j === 0 || x.harga > tinggi[j - 1].harga)
    const turunT = tinggi.every((x, j) => j === 0 || x.harga < tinggi[j - 1].harga)
    const naikR = rendah.every((x, j) => j === 0 || x.harga > rendah[j - 1].harga)
    const turunR = rendah.every((x, j) => j === 0 || x.harga < rendah[j - 1].harga)
    const garisBaji = (iS: number): TitikGarisPola[][] => [
      kerangka(w),
      [gT.a, { i: iS, harga: nilaiGaris(gT.a, gT.b, iS) }],
      [gR.a, { i: iS, harga: nilaiGaris(gR.a, gR.b, iS) }],
    ]

    let jadi: PolaKlasikMentah | null = null
    if (w[0].jenis === 'tinggi') {
      // [H1, L1, H2, L2, H3]
      const [H1, L1, H2, L2, H3] = w
      if (H2.harga - Math.max(H1.harga, H3.harga) >= tol
        && Math.abs(H1.harga - H3.harga) <= tol) {
        // Head & Shoulders — leher MIRING lewat kedua lembahnya. Buku teks
        // memang menggambarnya begitu, dan leher datar di bahu yang tak
        // sejajar menembak patahan di harga yang tak pernah jadi leher.
        const a = { i: L1.i, harga: L1.harga }
        const b = { i: L2.i, harga: L2.harga }
        const iS = cariTembus(lilin, dari, p.tunggu, (i) => nilaiGaris(a, b, i), 'bawah')
        if (iS !== null) {
          jadi = {
            nama: 'head-shoulders', arah: 'bearish', pivot: w, iSinyal: iS,
            hargaSinyal: lilin[iS].close,
            garis: [kerangka(w), [a, { i: iS, harga: nilaiGaris(a, b, iS) }]],
          }
        }
      } else if (Math.max(H1.harga, H2.harga, H3.harga) - Math.min(H1.harga, H2.harga, H3.harga) <= tol) {
        // Triple Top — tiga puncak setara; leher DATAR di lembah terendah.
        const leher = Math.min(L1.harga, L2.harga)
        const iS = cariTembus(lilin, dari, p.tunggu, () => leher, 'bawah')
        if (iS !== null) {
          jadi = {
            nama: 'triple-top', arah: 'bearish', pivot: w, iSinyal: iS,
            hargaSinyal: lilin[iS].close,
            garis: [kerangka(w), [{ i: w[0].i, harga: leher }, { i: iS, harga: leher }]],
          }
        }
      }
    } else {
      // [L1, H1, L2, H2, L3] — cermin persisnya.
      const [L1, H1, L2, H2, L3] = w
      if (Math.min(L1.harga, L3.harga) - L2.harga >= tol
        && Math.abs(L1.harga - L3.harga) <= tol) {
        const a = { i: H1.i, harga: H1.harga }
        const b = { i: H2.i, harga: H2.harga }
        const iS = cariTembus(lilin, dari, p.tunggu, (i) => nilaiGaris(a, b, i), 'atas')
        if (iS !== null) {
          jadi = {
            nama: 'inv-head-shoulders', arah: 'bullish', pivot: w, iSinyal: iS,
            hargaSinyal: lilin[iS].close,
            garis: [kerangka(w), [a, { i: iS, harga: nilaiGaris(a, b, iS) }]],
          }
        }
      } else if (Math.max(L1.harga, L2.harga, L3.harga) - Math.min(L1.harga, L2.harga, L3.harga) <= tol) {
        const leher = Math.max(H1.harga, H2.harga)
        const iS = cariTembus(lilin, dari, p.tunggu, () => leher, 'atas')
        if (iS !== null) {
          jadi = {
            nama: 'triple-bottom', arah: 'bullish', pivot: w, iSinyal: iS,
            hargaSinyal: lilin[iS].close,
            garis: [kerangka(w), [{ i: w[0].i, harga: leher }, { i: iS, harga: leher }]],
          }
        }
      }
    }

    // Baji & expanding — dinilai dari DUA GARIS TREN, apa pun fase awal
    // jendelanya (3 tinggi + 2 rendah atau sebaliknya, keduanya sah).
    if (!jadi) {
      if (naikT && naikR && slopeR > slopeT && slopeT > 0) {
        // Rising Wedge — keduanya naik, garis bawah lebih curam: menyempit.
        // Selesai saat penutupan jatuh ke bawah garis bawahnya. Bearish.
        const iS = cariTembus(lilin, dari, p.tunggu, (i) => nilaiGaris(gR.a, gR.b, i), 'bawah')
        if (iS !== null) {
          jadi = { nama: 'rising-wedge', arah: 'bearish', pivot: w, iSinyal: iS, hargaSinyal: lilin[iS].close, garis: garisBaji(iS) }
        }
      } else if (turunT && turunR && slopeT < slopeR && slopeR < 0) {
        // Falling Wedge — keduanya turun, garis atas lebih curam. Bullish.
        const iS = cariTembus(lilin, dari, p.tunggu, (i) => nilaiGaris(gT.a, gT.b, i), 'atas')
        if (iS !== null) {
          jadi = { nama: 'falling-wedge', arah: 'bullish', pivot: w, iSinyal: iS, hargaSinyal: lilin[iS].close, garis: garisBaji(iS) }
        }
      } else if (naikT && turunR) {
        // Expanding Triangle — puncak makin tinggi DAN lembah makin rendah.
        // Arahnya ditentukan patahan yang DATANG LEBIH DULU, bukan ditebak
        // dari tren sebelumnya: gambar acuannya sendiri memuat versi bullish
        // dan bearish untuk bentuk yang sama.
        const iBawah = cariTembus(lilin, dari, p.tunggu, (i) => nilaiGaris(gR.a, gR.b, i), 'bawah')
        const iAtas = cariTembus(lilin, dari, p.tunggu, (i) => nilaiGaris(gT.a, gT.b, i), 'atas')
        const iS = iBawah !== null && (iAtas === null || iBawah <= iAtas) ? iBawah : iAtas
        if (iS !== null) {
          jadi = {
            nama: 'expanding-triangle', arah: iS === iBawah ? 'bearish' : 'bullish',
            pivot: w, iSinyal: iS, hargaSinyal: lilin[iS].close, garis: garisBaji(iS),
          }
        }
      }
    }

    // Continuation — flag/pennant/segitiga, dari kanal tren yang SAMA di
    // atas. Yang membedakannya dari baji & expanding: TIANG (pole) sebelum
    // jendela. Tanpa syarat tiang, kanal turun sejajar sebelum tembus ke atas
    // tak beda dari Falling Wedge — tiang-lah yang menandainya sebagai
    // KELANJUTAN tren (konsolidasi), bukan pembalikan. Ascending/Descending/
    // Symmetrical Triangle sebaliknya TANPA syarat tiang: bentuknya sendiri
    // (atap/lantai datar, atau menyempit dua sisi) sudah cukup membedakannya.
    if (!jadi) {
      const tiang = arahTiang(lilin, atr, w[0].i, p)
      const sejajar = Math.abs(slopeT - slopeR) <= 0.35 * Math.max(Math.abs(slopeT), Math.abs(slopeR))

      if (tiang === 'naik' && turunT && turunR && slopeT < 0 && slopeR < 0 && sejajar) {
        // Bullish Flag — tiang naik lalu kanal turun sejajar. Selesai saat
        // penutupan menembus garis atas kanal.
        const iS = cariTembus(lilin, dari, p.tunggu, (i) => nilaiGaris(gT.a, gT.b, i), 'atas')
        if (iS !== null) {
          jadi = { nama: 'bullish-flag', arah: 'bullish', pivot: w, iSinyal: iS, hargaSinyal: lilin[iS].close, garis: garisBaji(iS) }
        }
      } else if (tiang === 'turun' && naikT && naikR && slopeT > 0 && slopeR > 0 && sejajar) {
        // Bearish Flag — cermin persisnya.
        const iS = cariTembus(lilin, dari, p.tunggu, (i) => nilaiGaris(gR.a, gR.b, i), 'bawah')
        if (iS !== null) {
          jadi = { nama: 'bearish-flag', arah: 'bearish', pivot: w, iSinyal: iS, hargaSinyal: lilin[iS].close, garis: garisBaji(iS) }
        }
      } else if (tiang === 'naik' && slopeT < 0 && slopeR > 0) {
        // Bullish Pennant — tiang naik, kanal menyempit simetris. Patah ke
        // atas.
        const iS = cariTembus(lilin, dari, p.tunggu, (i) => nilaiGaris(gT.a, gT.b, i), 'atas')
        if (iS !== null) {
          jadi = { nama: 'bullish-pennant', arah: 'bullish', pivot: w, iSinyal: iS, hargaSinyal: lilin[iS].close, garis: garisBaji(iS) }
        }
      } else if (tiang === 'turun' && slopeT < 0 && slopeR > 0) {
        // Bearish Pennant — bentuk sama, tiangnya yang berlawanan arah.
        const iS = cariTembus(lilin, dari, p.tunggu, (i) => nilaiGaris(gR.a, gR.b, i), 'bawah')
        if (iS !== null) {
          jadi = { nama: 'bearish-pennant', arah: 'bearish', pivot: w, iSinyal: iS, hargaSinyal: lilin[iS].close, garis: garisBaji(iS) }
        }
      } else if (!tiang && naikR && slopeR > 0
        && Math.max(...tinggi.map((x) => x.harga)) - Math.min(...tinggi.map((x) => x.harga)) <= tol) {
        // Ascending Triangle — TANPA syarat tiang. Atap datar, lantai naik.
        const atap = Math.max(...tinggi.map((x) => x.harga))
        const iS = cariTembus(lilin, dari, p.tunggu, () => atap, 'atas')
        if (iS !== null) {
          jadi = {
            nama: 'ascending-triangle', arah: 'bullish', pivot: w, iSinyal: iS, hargaSinyal: lilin[iS].close,
            garis: [kerangka(w), [{ i: w[0].i, harga: atap }, { i: iS, harga: atap }], [gR.a, { i: iS, harga: nilaiGaris(gR.a, gR.b, iS) }]],
          }
        }
      } else if (!tiang && turunT && slopeT < 0
        && Math.max(...rendah.map((x) => x.harga)) - Math.min(...rendah.map((x) => x.harga)) <= tol) {
        // Descending Triangle — cermin: lantai datar, atap turun.
        const lantai = Math.min(...rendah.map((x) => x.harga))
        const iS = cariTembus(lilin, dari, p.tunggu, () => lantai, 'bawah')
        if (iS !== null) {
          jadi = {
            nama: 'descending-triangle', arah: 'bearish', pivot: w, iSinyal: iS, hargaSinyal: lilin[iS].close,
            garis: [kerangka(w), [{ i: w[0].i, harga: lantai }, { i: iS, harga: lantai }], [gT.a, { i: iS, harga: nilaiGaris(gT.a, gT.b, iS) }]],
          }
        }
      } else if (!tiang && turunT && naikR && slopeT < 0 && slopeR > 0) {
        // Symmetrical Triangle — bentuk sama dengan Pennant, TANPA tiang;
        // hanya dicek kalau syarat tiang kedua Pennant di atas gagal. Arah
        // dari patahan yang datang lebih dulu — persis Expanding Triangle.
        const iBawah = cariTembus(lilin, dari, p.tunggu, (i) => nilaiGaris(gR.a, gR.b, i), 'bawah')
        const iAtas = cariTembus(lilin, dari, p.tunggu, (i) => nilaiGaris(gT.a, gT.b, i), 'atas')
        const iS = iBawah !== null && (iAtas === null || iBawah <= iAtas) ? iBawah : iAtas
        if (iS !== null) {
          jadi = {
            nama: 'symmetrical-triangle', arah: iS === iBawah ? 'bearish' : 'bullish',
            pivot: w, iSinyal: iS, hargaSinyal: lilin[iS].close, garis: garisBaji(iS),
          }
        }
      }
    }

    if (jadi) {
      out.push(jadi)
      for (const x of w) terpakai.add(x.i)
    }
  }

  // ---- jendela TIGA pivot: double top / bottom ------------------------
  for (let k = 0; k + 3 <= zz.length; k++) {
    const w = zz.slice(k, k + 3)
    if (w.some((x) => terpakai.has(x.i))) continue
    const akhir = w[2]
    const dari = akhir.i + p.jendela
    if (dari >= lilin.length) continue
    const tol = tolDi(akhir.i)
    if (tol === null) continue

    if (w[0].jenis === 'tinggi') {
      const [H1, L1, H2] = w
      if (Math.abs(H1.harga - H2.harga) > tol) continue
      const iS = cariTembus(lilin, dari, p.tunggu, () => L1.harga, 'bawah')
      if (iS === null) continue
      out.push({
        nama: 'double-top', arah: 'bearish', pivot: w, iSinyal: iS,
        hargaSinyal: lilin[iS].close,
        garis: [kerangka(w), [{ i: H1.i, harga: L1.harga }, { i: iS, harga: L1.harga }]],
      })
      for (const x of w) terpakai.add(x.i)
    } else {
      const [L1, H1, L2] = w
      if (Math.abs(L1.harga - L2.harga) > tol) continue
      const iS = cariTembus(lilin, dari, p.tunggu, () => H1.harga, 'atas')
      if (iS === null) continue
      out.push({
        nama: 'double-bottom', arah: 'bullish', pivot: w, iSinyal: iS,
        hargaSinyal: lilin[iS].close,
        garis: [kerangka(w), [{ i: L1.i, harga: H1.harga }, { i: iS, harga: H1.harga }]],
      })
      for (const x of w) terpakai.add(x.i)
    }
  }

  // Pasca-proses: target, level pembatal, dan nasibnya — SATU tempat untuk
  // enam belas pola (spek TradingView, `docs/riset/spek-pola-tradingview.md`).
  const lengkap: PolaKlasik[] = out.map((q) => {
    const hargaPivot = q.pivot.map((x) => x.harga)
    const maksP = Math.max(...hargaPivot)
    const minP = Math.min(...hargaPivot)
    // Tinggi pola = rentang pivotnya. Untuk Double/Triple Top itu persis
    // definisi TradingView (puncak - lembah antara); untuk baji/segitiga ia
    // alas pola di titik terlebarnya.
    const tinggi = maksP - minP
    // Jangkar proyeksi = nilai garis yang DITEMBUS di lilin sinyal. Semua
    // leher/garis tren ditarik sampai iSinyal, jadi garis yang ditembus
    // adalah yang ujungnya paling dekat ke penutupan sinyal.
    let jangkar = q.hargaSinyal
    let terdekat = Infinity
    for (let gi = 1; gi < q.garis.length; gi++) {
      const ujung = q.garis[gi][q.garis[gi].length - 1]
      if (ujung.i !== q.iSinyal) continue
      const jarak = Math.abs(ujung.harga - q.hargaSinyal)
      if (jarak < terdekat) { terdekat = jarak; jangkar = ujung.harga }
    }
    const bearish = q.arah === 'bearish'
    const target = bearish ? jangkar - tinggi : jangkar + tinggi
    const batal = bearish ? maksP : minP

    let status: StatusPolaKlasik = 'menunggu'
    let iStatus: number | null = null
    for (let i = q.iSinyal + 1; i < lilin.length; i++) {
      // Target dinilai dari EKSTREM lilin (menyentuh sudah cukup), pembatal
      // dari PENUTUPAN — asimetri yang sama dengan patahannya sendiri:
      // sumbu yang menusuk lalu ditarik kembali bukan pembatalan.
      if (bearish ? lilin[i].low <= target : lilin[i].high >= target) {
        status = 'tercapai'; iStatus = i; break
      }
      if (bearish ? lilin[i].close > batal : lilin[i].close < batal) {
        status = 'gagal'; iStatus = i; break
      }
    }
    return { ...q, target, batal, status, iStatus }
  })

  // Urut menurut lilin sinyalnya — pembaca daftar dan penggambar sama-sama
  // berpikir dalam "kapan polanya selesai", bukan kapan pivot pertamanya.
  return lengkap.sort((a, b) => a.iSinyal - b.iSinyal)
}
