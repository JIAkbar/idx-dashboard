import { Terbitan } from '../arus-pasar/Terbitan'
import type { Edisi, OhlcMap } from '../lib/skor/types'
import edisiJson from '../lib/skor/__fixtures__/edisi-2026-08-10.json'
import ohlcJson from '../lib/skor/__fixtures__/ohlc-2026-08-10.json'

/**
 * Pratinjau Fase 2 — data edisi ujicoba AP-100826-E01 masih dari fixture lokal
 * (sama yang dipakai test paritas Fase 1). Diganti fetch Supabase di Fase 3/4.
 */
export function EdisiUjicoba() {
  const ed = edisiJson as unknown as Edisi
  const ohlc = ohlcJson as unknown as OhlcMap
  return <Terbitan ed={ed} ohlc={ohlc} />
}
