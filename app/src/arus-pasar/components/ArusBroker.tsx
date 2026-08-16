import type { BarisBroker, Edisi, Emiten, PeranBroker } from '../../lib/skor/types'
import { fmt, fmtLot, fmtRp } from '../format'

function BarisTabel({ rows, sisi, peran }: { rows: BarisBroker[]; sisi: 'b' | 's'; peran: PeranBroker }) {
  const cls = sisi === 'b' ? 'bcode-b' : 'bcode-s'
  return (
    <>
      {rows.map(([kode, val, lot, avg]) => (
        <tr key={`${sisi}-${kode}-${val}`}>
          <td className={cls}>
            {kode}
            {peran.ritel.includes(kode) && <span className="tag ritel">RITEL</span>}
            {!peran.ritel.includes(kode) && peran.scalper.includes(kode) && (
              <span className="tag scalp">SCALP</span>
            )}
          </td>
          <td>{fmtRp(val)}</td>
          <td>{fmtLot(lot)}</td>
          <td>{fmt(avg)}</td>
        </tr>
      ))}
    </>
  )
}

export function ArusBroker({ em, ed }: { em: Emiten; ed: Edisi }) {
  const peran = ed.peran_broker
  const tb = em.beli.reduce((s, r) => s + r[1], 0)
  const tj = em.jual.reduce((s, r) => s + r[1], 0)
  const net = tb - tj
  const netCls = net >= 0 ? 'bull' : 'bear'
  const netTxt =
    (net >= 0 ? '+' : '−') + 'Rp' + fmtRp(Math.abs(net)).replace('B', ' miliar').replace('M', ' juta')

  return (
    <aside>
      <h3 className="rule">
        Arus Broker <span className="r">{ed.tanggal_flow} · Net</span>
      </h3>
      <div className="meter">
        <i style={{ left: `${em.slider_pct}%` }} />
      </div>
      <div className="meterlbl">
        <span>Big Dist</span>
        <span>Netral</span>
        <span>Big Acc</span>
      </div>
      <table className="brk">
        <tbody>
          <tr>
            <th>BY</th>
            <th>Nilai</th>
            <th>Lot</th>
            <th>Avg</th>
          </tr>
          <BarisTabel rows={em.beli} sisi="b" peran={peran} />
          <tr className="sep">
            <td colSpan={4}>Jual Terbesar</td>
          </tr>
          <BarisTabel rows={em.jual} sisi="s" peran={peran} />
          <tr className="tot">
            <td>NET</td>
            <td colSpan={3} className={netCls}>
              {netTxt}
              <small style={{ color: 'var(--mute)', fontWeight: 400 }}>
                {' '}
                (B {fmtRp(tb)} · S {fmtRp(tj)})
              </small>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="brksrc">
        Sumber: broker summary Stockbit, transkripsi manual terverifikasi. Peran broker: RITEL &amp; SCALP
        mengubah tafsir angka, bukan sekadar label.
      </div>
    </aside>
  )
}
