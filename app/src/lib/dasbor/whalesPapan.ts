/**
 * Whales Papan — logika MURNI kanvas jejak bandar (tanpa DOM, tanpa React).
 *
 * Namanya menyebut asalnya: bentuk "area breakdown" ini dipetik dari
 * whales.id (audit `docs/riset/whales-bongkar.md`). Yang TIDAK dipetik:
 * datanya. Whales berdiri di atas tick intraday + sisi agresor lewat
 * websocket; kita tak punya itu dan tak bisa memanennya dari endpoint publik
 * mana pun yang sudah diinventarisasi.
 *
 * ## Pembalikan yang membuat ini layak dibangun
 *
 * Riwayat publik whales cuma TIGA HARI. Arsip broker kita 2021-2026 dan masih
 * mundur. Jadi versi harian ini bukan tiruan yang lebih buruk — ia menjawab
 * pertanyaan yang whales sendiri tak bisa jawab: "selama tiga bulan terakhir,
 * di rentang harga 190-200, siapa yang menampung?"
 *
 * ## Kenapa `ringkas.avg`, bukan `close`
 *
 * Tiap hari punya SATU bar OHLC — sebuah rentang, bukan satu harga. Untuk
 * menempatkan hari itu pada sumbu harga kita perlu satu angka wakil, dan
 * `ringkas.avg` (harga rata-rata transaksi hari itu, sudah dihitung pemanen
 * dari nilai/lot) jauh lebih mewakili daripada close: close adalah harga
 * transaksi TERAKHIR, yang di saham tipis bisa jauh dari tempat mayoritas lot
 * benar-benar berpindah tangan.
 *
 * Konsekuensinya harus jujur di layar: seleksi "190-200" berarti "hari-hari
 * yang harga rata-ratanya jatuh di 190-200", BUKAN "lot yang tereksekusi di
 * 190-200". Untuk yang kedua butuh data per-tingkat-harga, dan itu intraday.
 *
 * ## GROSS/NET, bukan agresor/pasif
 *
 * Whales memecah hasil jadi agresor-beli, agresor-jual, pasif-beli,
 * pasif-jual karena mereka tahu sisi mana yang menyerang harga (data tick +
 * orderbook). Data harian tak menyimpan itu — jadi empat kuadran di sini
 * BUKAN agresif/pasif, melainkan GROSS BELI · GROSS JUAL · NET BELI · NET
 * JUAL: gross = total transaksi tiap sisi tanpa saling kurang, net = gross
 * beli dikurangi gross jual. Komponen WAJIB mencetak keterangan itu, bukan
 * menyembunyikannya, supaya pengguna yang pernah memakai whales tak mengira
 * kuadrannya salah nama karena bug.
 */

/** Satu baris broker apa adanya dari berkas tahunan: urutannya mengikuti
 *  `kolom` = ['broker','beli_lot','beli_nilai','jual_lot','jual_nilai']. */
export type BarisBroker = [string, number, number, number, number]

export interface HariBroker {
  tanggal: string
  /** Harga rata-rata transaksi hari itu. `null` kalau pemanen tak bisa
   *  menghitungnya (hari tanpa transaksi reguler) — hari begitu TIDAK bisa
   *  ditempatkan di sumbu harga dan sengaja dibuang dari kanvas. */
  avg: number | null
  totalLot: number
  broker: BarisBroker[]
  /** Baris broker varian ASING (papan reguler × investor asing) hari itu —
   *  dipakai footprint untuk menghitung PORSI asing per sel. Kosong kalau
   *  hari itu belum punya varian asing di arsip; JANGAN dibaca sebagai nol
   *  (audit whales 28 Agu §7d). */
  brokerAsing?: BarisBroker[]
}

export interface SeleksiArea {
  hargaMin: number
  hargaMax: number
  tglMulai: string
  tglAkhir: string
}

export interface RingkasBroker {
  kode: string
  netLot: number
  netNilai: number
  /** Total GROSS — lot/rupiah sisi beli & jual TANPA saling dikurangi. */
  beliLot: number
  beliNilai: number
  jualLot: number
  jualNilai: number
}

export interface HasilArea {
  netBeli: RingkasBroker[]
  netJual: RingkasBroker[]
  /** Sisi GROSS — total beli/jual per broker TANPA dikurangi lawannya. Angka
   *  ini sudah dijumlahkan di `agregatArea` (kolom `beliLot`/`jualLot` pada
   *  tiap `RingkasBroker`); di sini cuma disaring & diurutkan jadi peringkat
   *  sendiri, terpisah dari NET — broker bisa gross besar tapi net kecil
   *  (banyak transaksi, posisi nyaris tak berubah) dan sebaliknya. */
  grossBeli: RingkasBroker[]
  grossJual: RingkasBroker[]
  nHari: number
  nBroker: number
  /** Tanggal hari bursa PERTAMA/TERAKHIR yang benar-benar masuk seleksi —
   *  dari datanya, bukan tepi kotak seret (kotak bisa mulai di akhir pekan).
   *  null saat tak ada hari yang lolos. Permintaan Johan 28 Agu: "17 hari
   *  bursa ini munculkan rentang waktu nya kapan". */
  tglPertama: string | null
  tglTerakhir: string | null
  totalNetBeliLot: number
  totalNetJualLot: number
  totalGrossBeliLot: number
  totalGrossJualLot: number
}

/** Ambang "Significant" ala whales.id (toggle Significant/Full baris broker):
 *  satu baris disembunyikan di mode ringkas kalau porsinya terhadap total
 *  sisi ini < 1%. whales.id tak mempublikasikan angka aslinya — 1% dipilih
 *  supaya broker recehan tak membanjiri daftar sementara kontributor nyata
 *  tetap kelihatan. */
export const AMBANG_SIGNIFIKAN = 0.01

/**
 * Saring baris broker yang porsinya (nilai mutlak) di bawah ambang dari total
 * sisi ini. `nilai` memilih ruas yang relevan — beda tiap kuadran: `netLot`
 * untuk NET BELI/JUAL, `beliLot`/`jualLot` untuk GROSS BELI/JUAL — karena
 * "porsi terhadap total" berarti hal berbeda di tiap kuadran.
 */
export function saringSignifikan(
  baris: RingkasBroker[],
  nilai: (r: RingkasBroker) => number,
  ambang: number = AMBANG_SIGNIFIKAN,
): RingkasBroker[] {
  const total = baris.reduce((s, r) => s + Math.abs(nilai(r)), 0)
  if (total <= 0) return baris
  return baris.filter((r) => Math.abs(nilai(r)) / total >= ambang)
}

/** Hari mana saja yang masuk seleksi. Dipisah supaya bisa diuji sendiri —
 *  ini titik paling gampang salah (batas inklusif, hari tanpa avg). */
export function hariTerpilih(hari: HariBroker[], sel: SeleksiArea): HariBroker[] {
  const lo = Math.min(sel.hargaMin, sel.hargaMax)
  const hi = Math.max(sel.hargaMin, sel.hargaMax)
  const d1 = sel.tglMulai <= sel.tglAkhir ? sel.tglMulai : sel.tglAkhir
  const d2 = sel.tglMulai <= sel.tglAkhir ? sel.tglAkhir : sel.tglMulai
  return hari.filter(
    (h) => h.avg != null && h.avg >= lo && h.avg <= hi && h.tanggal >= d1 && h.tanggal <= d2,
  )
}

/**
 * Jumlahkan net per broker atas hari yang terpilih.
 *
 * Net = beli − jual, baik lot maupun nilai. Broker yang net-nya PERSIS nol
 * dibuang dari kedua daftar: ia bertransaksi tapi tak memindahkan posisi, dan
 * memajangnya di salah satu sisi akan menyesatkan.
 */
export function agregatArea(hari: HariBroker[], sel: SeleksiArea): HasilArea {
  const pilih = hariTerpilih(hari, sel)
  const peta = new Map<string, RingkasBroker>()

  for (const h of pilih) {
    for (const [kode, beliLot, beliNilai, jualLot, jualNilai] of h.broker) {
      let r = peta.get(kode)
      if (!r) {
        r = { kode, netLot: 0, netNilai: 0, beliLot: 0, beliNilai: 0, jualLot: 0, jualNilai: 0 }
        peta.set(kode, r)
      }
      r.beliLot += beliLot
      r.beliNilai += beliNilai
      r.jualLot += jualLot
      r.jualNilai += jualNilai
      r.netLot += beliLot - jualLot
      r.netNilai += beliNilai - jualNilai
    }
  }

  const semua = [...peta.values()]
  const netBeli = semua.filter((r) => r.netLot > 0).sort((a, b) => b.netLot - a.netLot)
  const netJual = semua.filter((r) => r.netLot < 0).sort((a, b) => a.netLot - b.netLot)
  const grossBeli = semua.filter((r) => r.beliLot > 0).sort((a, b) => b.beliLot - a.beliLot)
  const grossJual = semua.filter((r) => r.jualLot > 0).sort((a, b) => b.jualLot - a.jualLot)

  return {
    netBeli,
    netJual,
    grossBeli,
    grossJual,
    nHari: pilih.length,
    nBroker: semua.length,
    tglPertama: pilih[0]?.tanggal ?? null,
    tglTerakhir: pilih[pilih.length - 1]?.tanggal ?? null,
    totalNetBeliLot: netBeli.reduce((s, r) => s + r.netLot, 0),
    totalNetJualLot: netJual.reduce((s, r) => s + r.netLot, 0),
    totalGrossBeliLot: grossBeli.reduce((s, r) => s + r.beliLot, 0),
    totalGrossJualLot: grossJual.reduce((s, r) => s + r.jualLot, 0),
  }
}

/** Rentang harga & tanggal seluruh data — dipakai kanvas untuk menskalakan
 *  sumbu sebelum pengguna memilih apa pun. */
export function batasKanvas(hari: HariBroker[]): {
  hargaMin: number
  hargaMax: number
  tglMulai: string
  tglAkhir: string
} | null {
  const berharga = hari.filter((h) => h.avg != null)
  if (berharga.length === 0) return null
  let lo = Infinity
  let hi = -Infinity
  for (const h of berharga) {
    const a = h.avg as number
    if (a < lo) lo = a
    if (a > hi) hi = a
  }
  // Beri napas 4% di atas & bawah supaya titik terluar tak menempel bingkai.
  const napas = (hi - lo) * 0.04 || Math.max(1, hi * 0.02)
  const tgl = berharga.map((h) => h.tanggal).sort()
  return {
    hargaMin: Math.max(0, lo - napas),
    hargaMax: hi + napas,
    tglMulai: tgl[0],
    tglAkhir: tgl[tgl.length - 1],
  }
}

/**
 * Profil harga: berapa lot berpindah di tiap pita harga.
 *
 * Ini padanan harian "market profile" whales. Bedanya sudah disebut di atas —
 * satuan terkecilnya HARI, jadi seluruh lot satu hari masuk ke satu pita
 * (pita tempat harga rata-ratanya jatuh), bukan tersebar ke banyak tingkat
 * harga seperti profil intraday sungguhan.
 */
export function profilHarga(
  hari: HariBroker[],
  nPita = 24,
): { hargaBawah: number; hargaAtas: number; lot: number; nHari: number }[] {
  const b = batasKanvas(hari)
  if (!b || nPita < 1) return []
  const lebar = (b.hargaMax - b.hargaMin) / nPita
  if (!(lebar > 0)) return []
  const pita = Array.from({ length: nPita }, (_, i) => ({
    hargaBawah: b.hargaMin + i * lebar,
    hargaAtas: b.hargaMin + (i + 1) * lebar,
    lot: 0,
    nHari: 0,
  }))
  for (const h of hari) {
    if (h.avg == null) continue
    let i = Math.floor((h.avg - b.hargaMin) / lebar)
    if (i < 0) i = 0
    if (i >= nPita) i = nPita - 1
    pita[i].lot += h.totalLot
    pita[i].nHari += 1
  }
  return pita
}

/** Tahun mana saja yang perlu diambil untuk menutup rentang tanggal. */
export function tahunDibutuhkan(dari: string, sampai: string): number[] {
  const a = Number(dari.slice(0, 4))
  const b = Number(sampai.slice(0, 4))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return []
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

/** Bentuk mentah satu berkas tahunan — cukup ruas yang kita pakai. */
interface BerkasTahunan {
  hari?: Record<string, {
    ringkas?: { avg?: number; total_lot?: number }
    broker?: BarisBroker[]
    /** Varian asing — bentuk sama, dipakai porsi asing footprint. */
    asing?: { broker?: BarisBroker[] }
  }>
}

/**
 * Ubah satu berkas tahunan jadi deret `HariBroker`.
 *
 * Dipisah dari pengambilan jaringan supaya bisa diuji dengan objek biasa —
 * pola yang sama dipakai di seluruh `lib/dasbor`.
 */
export function dariBerkasTahunan(j: BerkasTahunan | null): HariBroker[] {
  if (!j?.hari) return []
  const out: HariBroker[] = []
  for (const [tanggal, isi] of Object.entries(j.hari)) {
    const avg = isi?.ringkas?.avg
    out.push({
      tanggal,
      avg: typeof avg === 'number' && Number.isFinite(avg) && avg > 0 ? avg : null,
      totalLot: isi?.ringkas?.total_lot ?? 0,
      broker: Array.isArray(isi?.broker) ? isi.broker : [],
      brokerAsing: Array.isArray(isi?.asing?.broker) ? isi.asing.broker : undefined,
    })
  }
  return out.sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1))
}
