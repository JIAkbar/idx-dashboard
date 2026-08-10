import type { Emiten, OhlcMap } from '../../lib/skor/types'
import { fmt } from '../format'

/** Port 1:1 dari statistik_hari() di build.py — termasuk kuirk .replace(".",",")
 *  pada baris EMA50 (mengubah SEMUA titik jadi koma, termasuk pemisah ribuan). */
export function StatsRow({ em, ohlc }: { em: Emiten; ohlc: OhlcMap }) {
  const o = em.ohlc_hari
  const c = o.c
  const vsEma = ((c - em.ema50) / em.ema50) * 100
  const nilaiB = (c * o.vol_juta) / 1000
  const vol20 = ohlc[em.ticker].slice(-21, -1).map((b) => b.v)
  const vsVol = vol20.length ? (o.vol_juta * 1e6) / (vol20.reduce((s, v) => s + v, 0) / vol20.length) : 0

  const emaHtml = `${fmt(em.ema50)} <small>(${vsEma >= 0 ? '+' : ''}${vsEma.toFixed(1)}%)</small>`.replaceAll(
    '.',
    ','
  )
  const volHtml = `${fmt(o.vol_juta, 1)} jt <small>(${fmt(vsVol, 1)}× rerata20)</small>`

  const stats: { l: string; v: string; html?: boolean }[] = [
    { l: 'Rentang Hari', v: `${fmt(o.l)}–${fmt(o.h)}` },
    { l: 'EMA50', v: emaHtml, html: true },
    { l: 'Pivot Harian', v: fmt(em.pivot.P) },
    { l: 'Volume', v: volHtml, html: true },
    { l: 'Nilai Transaksi', v: `≈ Rp${fmt(nilaiB, 1)} miliar` },
  ]

  return (
    <div className="stats">
      {stats.map((s) => (
        <div className="s" key={s.l}>
          <div className="l">{s.l}</div>
          {s.html ? (
            <div className="v" dangerouslySetInnerHTML={{ __html: s.v }} />
          ) : (
            <div className="v">{s.v}</div>
          )}
        </div>
      ))}
    </div>
  )
}
