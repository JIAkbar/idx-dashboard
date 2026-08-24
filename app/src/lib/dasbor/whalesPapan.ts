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
 * ## Net, bukan empat kuadran
 *
 * Whales memecah hasil jadi agresor-beli, agresor-jual, pasif-beli,
 * pasif-jual karena mereka tahu sisi mana yang menyerang harga. Data harian
 * tak menyimpan itu. Jadi di sini cuma NET BELI dan NET JUAL — dan komponen
 * WAJIB mencetak keterangan itu, bukan menyembunyikannya, supaya pengguna
 * yang pernah memakai whales tak mengira kuadrannya hilang karena bug.
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
  beliLot: number
  jualLot: number
}

export interface HasilArea {
  netBeli: RingkasBroker[]
  netJual: RingkasBroker[]
  nHari: number
  nBroker: number
  totalNetBeliLot: number
  totalNetJualLot: number
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
        r = { kode, netLot: 0, netNilai: 0, beliLot: 0, jualLot: 0 }
        peta.set(kode, r)
      }
      r.beliLot += beliLot
      r.jualLot += jualLot
      r.netLot += beliLot - jualLot
      r.netNilai += beliNilai - jualNilai
    }
  }

  const semua = [...peta.values()]
  const netBeli = semua.filter((r) => r.netLot > 0).sort((a, b) => b.netLot - a.netLot)
  const netJual = semua.filter((r) => r.netLot < 0).sort((a, b) => a.netLot - b.netLot)

  return {
    netBeli,
    netJual,
    nHari: pilih.length,
    nBroker: semua.length,
    totalNetBeliLot: netBeli.reduce((s, r) => s + r.netLot, 0),
    totalNetJualLot: netJual.reduce((s, r) => s + r.netLot, 0),
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
  hari?: Record<string, { ringkas?: { avg?: number; total_lot?: number }; broker?: BarisBroker[] }>
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
    })
  }
  return out.sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1))
}
