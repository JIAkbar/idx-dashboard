import type { BrokerRow } from '../../../lib/dasbor/brokerSummaryData'
import { fmtB, fmtLot } from '../../../lib/dasbor/brokerSummaryFormat'

interface InventoryProps {
  brokers: BrokerRow[]
}

/**
 * Tab "Inventory" — port bsRenderBrokerTable() index_live.html baris 5927-5949.
 * Gaya Lantai Bursa (Task 10): `.tbl` + kode broker `.bchip` + batang nilai
 * `.bar-tr`/`.bar-fl` (docs/design-lantai-bursa-reimagined.html:687-696).
 * Chrome kartu (panel/panel-h) dipegang parent BrokerSummary.tsx — komponen
 * ini cuma mengembalikan isi tabel.
 */
export function Inventory({ brokers }: InventoryProps) {
  const totalNilai = brokers.reduce((s, b) => s + b.nilai, 0)
  const maxNilai = brokers[0]?.nilai ?? 1

  return (
    <div className="board-tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>#</th><th>Kode</th><th>Nama</th><th className="r">Nilai</th><th className="r">Volume</th><th className="r">Frekuensi</th><th className="r">%Nilai</th>
          </tr>
        </thead>
        <tbody>
          {brokers.map((b, i) => {
            const pct = totalNilai > 0 ? (b.nilai / totalNilai * 100).toFixed(2) : '0'
            const barPct = Math.round((b.nilai / maxNilai) * 100)
            return (
              <tr key={b.kode}>
                <td className="num">{i + 1}</td>
                <td><span className="bchip">{b.kode}</span></td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                  {b.nama}
                </td>
                <td className="r">
                  <b className="num">{fmtB(b.nilai)}</b>
                  <div className="bar-tr" style={{ display: 'inline-block', width: 80, marginLeft: 8, verticalAlign: 'middle' }}>
                    <div className="bar-fl" style={{ width: `${barPct}%` }} />
                  </div>
                </td>
                <td className="r num">{fmtLot(b.vol)}</td>
                <td className="r num">{b.freq.toLocaleString('id-ID')}</td>
                <td className="r num" style={{ color: 'var(--text2)' }}>{pct}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
