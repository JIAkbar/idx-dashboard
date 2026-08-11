import type { BrokerRow } from '../../../lib/dasbor/brokerSummaryData'
import { fmtB, fmtLot } from '../../../lib/dasbor/brokerSummaryFormat'

interface InventoryProps {
  brokers: BrokerRow[]
}

/** Tab "Inventory" — port bsRenderBrokerTable() index_live.html baris 5927-5949. */
export function Inventory({ brokers }: InventoryProps) {
  const totalNilai = brokers.reduce((s, b) => s + b.nilai, 0)
  const maxNilai = brokers[0]?.nilai ?? 1

  return (
    <div className="bs-tbl-wrap">
      <table className="bs-tbl">
        <thead>
          <tr>
            <th>#</th><th>Kode</th><th>Nama</th><th>Nilai</th><th>Volume</th><th>Frekuensi</th><th>%Nilai</th>
          </tr>
        </thead>
        <tbody>
          {brokers.map((b, i) => {
            const pct = totalNilai > 0 ? (b.nilai / totalNilai * 100).toFixed(2) : '0'
            const barW = Math.round((b.nilai / maxNilai) * 80)
            return (
              <tr key={b.kode}>
                <td className="bs-rank">{i + 1}</td>
                <td className="bs-kode">{b.kode}</td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text2)' }}>
                  {b.nama}
                </td>
                <td>
                  <b>{fmtB(b.nilai)}</b>
                  <span className="bs-bar-mini" style={{ width: barW }} />
                </td>
                <td>{fmtLot(b.vol)}</td>
                <td>{b.freq.toLocaleString('id-ID')}</td>
                <td className="bs-pct">{pct}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
