import { useMemo } from 'react'
import type { Edisi, OhlcMap } from '../lib/skor/types'
import { buatSkorMap } from './skorMap'
import { HalamanSampul } from './components/HalamanSampul'
import { HalamanRingkasan } from './components/HalamanRingkasan'
import { HalamanEmiten } from './components/HalamanEmiten'
import { HalamanPeringkat } from './components/HalamanPeringkat'
import './cetak.css'

/** Perakit terbitan — padanan main() di build.py: sampul + ringkasan + tiap
 *  halaman emiten + peringkat, dari data Edisi + OHLC yang sama. */
export function Terbitan({ ed, ohlc }: { ed: Edisi; ohlc: OhlcMap }) {
  const skorMap = useMemo(() => buatSkorMap(ed, ohlc), [ed, ohlc])

  return (
    <div className="ap-cetak">
      <button type="button" className="cetak-btn no-print" onClick={() => window.print()}>
        Cetak PDF
      </button>
      <HalamanSampul ed={ed} skorMap={skorMap} />
      <HalamanRingkasan ed={ed} skorMap={skorMap} />
      {ed.emiten.map((em) => (
        <HalamanEmiten key={em.ticker} em={em} sk={skorMap[em.ticker]} ed={ed} ohlc={ohlc} />
      ))}
      <HalamanPeringkat ed={ed} skorMap={skorMap} />
    </div>
  )
}
