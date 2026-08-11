import { BS_AVAIL, BS_DATA, type BrokerRow, type ForeignDay } from './brokerSummaryData'

/** Port bsRangeDates() index_live.html baris 5831-5833. */
export function bsRangeDates(from: string, to: string): string[] {
  return BS_AVAIL.filter((k) => k >= from && k <= to)
}

/**
 * Port bsAggBrokers() index_live.html baris 5870-5886 — sum vol/nilai/freq
 * per kode broker across tanggal dalam range, lalu rank ganda: rn (by nilai,
 * ini juga urutan array yang dikembalikan) dan rf (by frekuensi, tidak
 * mengubah urutan array).
 */
export function bsAggBrokers(from: string, to: string): BrokerRow[] {
  const map = new Map<string, BrokerRow>()
  bsRangeDates(from, to).forEach((d) => {
    (BS_DATA.broker[d] ?? []).forEach((b) => {
      const cur = map.get(b.kode) ?? { kode: b.kode, nama: b.nama, vol: 0, nilai: 0, freq: 0, rn: 0, rf: 0 }
      cur.vol += b.vol
      cur.nilai += b.nilai
      cur.freq += b.freq
      map.set(b.kode, cur)
    })
  })
  const arr = [...map.values()].sort((a, b) => b.nilai - a.nilai)
  arr.forEach((b, i) => { b.rn = i + 1 })
  const byFreq = [...arr].sort((a, b) => b.freq - a.freq)
  byFreq.forEach((b, i) => { b.rf = i + 1 })
  return arr
}

/** Port bsAggForeign() index_live.html baris 5887-5892. */
export function bsAggForeign(from: string, to: string): ForeignDay {
  let buy = 0
  let sell = 0
  bsRangeDates(from, to).forEach((d) => {
    const f = BS_DATA.foreign[d]
    if (f) { buy += f.buy; sell += f.sell }
  })
  return { buy, sell, net: buy - sell }
}
