import type { BarisOhlc } from '../../lib/dasbor/ihsgOhlc'
import type { BarisAsing } from './cerita-hitung'

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

/** #236 empat pemicu Kartu Pagi. Tiap fungsi murni, `menyala` + `kalimat`
 *  berangka siap tampil (atau null kalau tak menyala / data kurang). */
export interface HasilPemicu { menyala: boolean; kalimat: string | null }

/** Wrapper tipis atas `cekWatchlistBerubah` — bentuk hasil seragam #236. */
export function pemicuPembeliBerganti(hari: HariBrokerPuncak[]): HasilPemicu {
  const r = cekWatchlistBerubah(hari)
  return { menyala: r.berubah, kalimat: r.kalimat }
}

function ma20At(ohlc: BarisOhlc[], i: number): number {
  let s = 0
  for (let j = i - 19; j <= i; j++) s += ohlc[j][4]
  return s / 20
}

/** Tutup vs MA20 berbalik arah dari kemarin ke hari terakhir. Butuh >= 21 bar. */
export function pemicuTembusMa20(ohlc: BarisOhlc[]): HasilPemicu {
  const n = ohlc.length
  if (n < 21) return { menyala: false, kalimat: null }
  const tutupKemarin = ohlc[n - 2][4]
  const tutupTerakhir = ohlc[n - 1][4]
  const ma20Kemarin = ma20At(ohlc, n - 2)
  const ma20Terakhir = ma20At(ohlc, n - 1)
  if (tutupKemarin <= ma20Kemarin && tutupTerakhir > ma20Terakhir) {
    return { menyala: true, kalimat: 'Tutup tembus ke ATAS MA20.' }
  }
  if (tutupKemarin >= ma20Kemarin && tutupTerakhir < ma20Terakhir) {
    return { menyala: true, kalimat: 'Tutup tembus ke BAWAH MA20.' }
  }
  return { menyala: false, kalimat: null }
}

/** Net asing (beli-jual lembar) searah >= `minHari` hari bursa terakhir berturut-turut. */
export function pemicuAsingBeruntun(asing: BarisAsing[], minHari = 5): HasilPemicu {
  if (asing.length < minHari) return { menyala: false, kalimat: null }
  const net = asing.slice(-minHari).map((b) => b[1] - b[2])
  if (net.every((x) => x > 0)) return { menyala: true, kalimat: `Asing net beli ${minHari} hari bursa berturut-turut.` }
  if (net.every((x) => x < 0)) return { menyala: true, kalimat: `Asing net jual ${minHari} hari bursa berturut-turut.` }
  return { menyala: false, kalimat: null }
}

/** Harga di atas stop dan jarak < 3%. */
export function pemicuDekatStop(kartu: { harga: number; stop: number }): HasilPemicu {
  if (!(kartu.stop > 0) || !(kartu.harga > kartu.stop)) return { menyala: false, kalimat: null }
  const jarakPct = ((kartu.harga - kartu.stop) / kartu.stop) * 100
  if (jarakPct < 3) return { menyala: true, kalimat: `Harga ${jarakPct.toFixed(1)}% di atas stop.` }
  return { menyala: false, kalimat: null }
}
