import type { Edisi, OhlcMap, Skor } from '../lib/skor/types'
import { hitungSkor } from '../lib/skor/skor'

export type SkorMap = Record<string, Skor>

export function buatSkorMap(ed: Edisi, ohlc: OhlcMap): SkorMap {
  const map: SkorMap = {}
  for (const em of ed.emiten) {
    map[em.ticker] = hitungSkor(em, ed, ohlc)
  }
  return map
}
