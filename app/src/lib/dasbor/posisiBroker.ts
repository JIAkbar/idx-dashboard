/**
 * Posisi 6 Bulan per broker (spek_bandarmologi_c2.md §B.5): floor price,
 * pnl%, hari sejak tanda kumulatif net terakhir berpindah, status AKUM/DIST
 * + tren 10 hari, badge TRAPPED. Rumus KITA, sengaja terpisah dari
 * `floorPriceBroker` (brokerEmiten.ts) — itu harga TERENDAH satu hari,
 * bukan rata-rata tertimbang seluruh jendela seperti diminta di sini.
 */

export interface BarisPosisiHari {
  kode: string
  beliLot: number
  beliNilai: number
  jualLot: number
  jualNilai: number
}

export interface PosisiBroker {
  kode: string
  net: number
  beliNilai: number
  beliLot: number
  /** Σbeli_nilai ÷ (Σbeli_lot×100) seluruh jendela — null kalau broker itu jual-saja. */
  floor: number | null
  /** (hargaKini − floor) ÷ floor — hanya diisi untuk broker net-beli (net > 0). */
  pnlPersen: number | null
  /** Hari (termasuk hari terakhir) dengan tanda kumulatif net sama seperti sekarang. */
  hariSejakFlip: number
  status: 'AKUM' | 'DIST' | 'NETRAL'
  /** Divergensi arah TREN_N hari terakhir vs status jendela penuh; null = selaras. */
  tren: 'RE-AKUM' | 'MELEPAS' | null
  /** Net harian, urut tanggal naik — bahan sparkline. */
  seriHarian: Array<{ t: string; net: number }>
}

const TREN_N = 10

/** Hari (dari belakang) dengan tanda kumulatif sama seperti hari terakhir. */
function hariSejakFlip(kumulatif: number[]): number {
  const n = kumulatif.length
  if (n === 0) return 0
  const tandaAkhir = Math.sign(kumulatif[n - 1])
  let i = n - 1
  while (i > 0 && Math.sign(kumulatif[i - 1]) === tandaAkhir) i--
  return n - i
}

/** Posisi tiap broker yang aktif pada `tanggal` (jendela dipilih pemanggil —
 *  spek: 126 hari bursa terakhir yang tersedia di arsip). */
export function hitungPosisiBroker(
  tanggal: string[],
  hari: Record<string, { broker: BarisPosisiHari[] }>,
  hargaKini: number | null,
): PosisiBroker[] {
  const kodeSet = new Set<string>()
  for (const t of tanggal) for (const b of hari[t]?.broker ?? []) kodeSet.add(b.kode)

  return [...kodeSet].map((kode) => {
    let beliNilai = 0, beliLot = 0, jualNilai = 0, jualLot = 0
    const seriHarian: Array<{ t: string; net: number }> = []
    const kum: number[] = []
    let run = 0
    for (const t of tanggal) {
      const b = hari[t]?.broker.find((x) => x.kode === kode)
      const net = b ? b.beliNilai - b.jualNilai : 0
      if (b) { beliNilai += b.beliNilai; beliLot += b.beliLot; jualNilai += b.jualNilai; jualLot += b.jualLot }
      run += net
      seriHarian.push({ t, net })
      kum.push(run)
    }
    const net = beliNilai - jualNilai
    const floor = beliLot ? beliNilai / (beliLot * 100) : null
    const pnlPersen = net > 0 && floor != null && hargaKini != null ? (hargaKini - floor) / floor : null
    const status: PosisiBroker['status'] = net > 0 ? 'AKUM' : net < 0 ? 'DIST' : 'NETRAL'
    const ekor = seriHarian.slice(-TREN_N)
    const net10 = ekor.reduce((a, s) => a + s.net, 0)
    const tren: PosisiBroker['tren'] =
      status === 'AKUM' && net10 < 0 ? 'MELEPAS'
      : status === 'DIST' && net10 > 0 ? 'RE-AKUM'
      : null
    return { kode, net, beliNilai, beliLot, floor, pnlPersen, hariSejakFlip: hariSejakFlip(kum), status, tren, seriHarian }
  })
}

/** Badge TRAPPED: dari N net-buyer terbesar (net nilai), berapa yang pnl% < 0.
 *  `total` bisa < n kalau net-buyer di jendela ini kurang dari n — dilaporkan
 *  jujur (mis. "2/3"), bukan dipaksa jadi "n/5". */
export function trappedTopN(posisi: PosisiBroker[], n = 5): { trapped: number; total: number } {
  const topBuyers = posisi.filter((p) => p.net > 0).sort((a, b) => b.net - a.net).slice(0, n)
  const trapped = topBuyers.filter((p) => p.pnlPersen != null && p.pnlPersen < 0).length
  return { trapped, total: topBuyers.length }
}
