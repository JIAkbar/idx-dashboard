import type { BarisOhlc } from '../../lib/dasbor/ihsgOhlc'

/** Satu hari `broker_puncak/<KODE>.json` (spek #231 D2). */
export interface HariBrokerPuncak {
  tanggal: string
  /** Nilai di data: 'Acc' (akumulasi) atau 'Dist' (distribusi). */
  accdist: string | null
  total_nilai: number
  beli: [string, number][]
  jual: [string, number][]
}

export interface WatchlistBerubah {
  berubah: boolean
  brokerSebelum: string | null
  kalimat: string | null
}

/**
 * Pembeli terbesar dua hari lalu (hari sebelum hari terakhir) kini di sisi
 * jual hari terakhir, ATAU accdist berbalik arah. `hari` urut tanggal naik.
 */
export function cekWatchlistBerubah(hari: HariBrokerPuncak[]): WatchlistBerubah {
  if (hari.length < 2) return { berubah: false, brokerSebelum: null, kalimat: null }
  const sebelum = hari[hari.length - 2]
  const kini = hari[hari.length - 1]
  const topBeliSebelum = sebelum.beli[0]?.[0] ?? null
  if (!topBeliSebelum) return { berubah: false, brokerSebelum: null, kalimat: null }
  const kiniJual = kini.jual.some(([kode]) => kode === topBeliSebelum)
  const ARAH: Record<string, string> = { Acc: 'akumulasi', Dist: 'distribusi' }
  const accdistBerbalik = !!sebelum.accdist && !!kini.accdist && sebelum.accdist in ARAH && kini.accdist in ARAH && sebelum.accdist !== kini.accdist
  if (kiniJual) {
    return { berubah: true, brokerSebelum: topBeliSebelum, kalimat: `Pembeli terbesar dua hari lalu, ${topBeliSebelum}, hari ini menjual.` }
  }
  if (accdistBerbalik) {
    return { berubah: true, brokerSebelum: topBeliSebelum, kalimat: `Arah broker berbalik dari ${ARAH[sebelum.accdist!]} ke ${ARAH[kini.accdist!]}.` }
  }
  return { berubah: false, brokerSebelum: topBeliSebelum, kalimat: null }
}

export interface LonjakanHasil { n: number; medianH5: number | null }

/**
 * Kejadian lampau (bukan hari terakhir — indeksnya butuh 5 bar sesudahnya)
 * dengan kenaikan harian >= `ambangPct`, dan return H+5 sesudahnya. `bar`
 * urut tanggal naik, `[tanggal, buka, tinggi, rendah, tutup, volume]`.
 */
export function hitungLonjakan(bar: BarisOhlc[], ambangPct: number): LonjakanHasil {
  const ret: number[] = []
  for (let i = 1; i + 5 < bar.length; i++) {
    const chgPct = ((bar[i][4] - bar[i - 1][4]) / bar[i - 1][4]) * 100
    if (chgPct >= ambangPct) ret.push(((bar[i + 5][4] - bar[i][4]) / bar[i][4]) * 100)
  }
  ret.sort((a, b) => a - b)
  const n = ret.length
  if (n === 0) return { n, medianH5: null }
  const medianH5 = n % 2 === 1 ? ret[(n - 1) / 2] : (ret[n / 2 - 1] + ret[n / 2]) / 2
  return { n, medianH5 }
}
