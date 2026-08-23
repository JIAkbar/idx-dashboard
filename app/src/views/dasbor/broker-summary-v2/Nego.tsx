import type { HariBroker } from '../../../lib/dasbor/brokerEmiten'
import { warnaBroker, namaBroker } from '../../../lib/dasbor/kelompokBroker'
import { fmtB, fmtLot } from '../../../lib/dasbor/brokerSummaryFormat'
import { labelTanggal } from '../../../lib/dasbor/brokerHarian'
import { EmptyState } from './Overview'

interface NegoProps {
  hari: Array<[string, HariBroker]>
}

/** Tab "NEGO" — port `renderNego()` mockup: satu baris per broker per hari yang punya varian nego. */
export function Nego({ hari }: NegoProps) {
  const hariNego = hari.filter(([, h]) => h.nego)

  return (
    <section className="panel">
      <div className="panel-h">
        <h2>Pasar negosiasi</h2>
        <span className="lbl">{hariNego.length ? `${hariNego.length} hari terpanen dalam rentang` : 'belum ada hari nego dalam rentang'}</span>
      </div>
      <div className="panel-b">
        {hariNego.length === 0 ? (
          <EmptyState>Tidak ada hari dengan data pasar negosiasi pada rentang ini — backfill sedang berjalan.</EmptyState>
        ) : (
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Tanggal</th><th>Broker</th><th className="r">Beli (nilai)</th><th className="r">Jual (nilai)</th><th className="r">Lot</th><th className="r">Harga rata-rata</th></tr></thead>
              <tbody>
                {hariNego.flatMap(([tgl, h]) => h.nego!.broker.map((r) => {
                  const [kode, beliLot, beliNilai, jualLot, jualNilai] = r
                  const rata = beliLot ? beliNilai / (beliLot * 100) : jualLot ? jualNilai / (jualLot * 100) : null
                  return (
                    <tr key={`${tgl}-${kode}`}>
                      <td className="num">{labelTanggal(tgl)}</td>
                      <td style={{ color: warnaBroker(kode), fontWeight: 600 }} title={namaBroker(kode)}>{kode}</td>
                      <td className="r num">{beliNilai ? fmtB(beliNilai) : '—'}</td>
                      <td className="r num">{jualNilai ? fmtB(jualNilai) : '—'}</td>
                      <td className="r num">{fmtLot(Math.max(beliLot, jualLot))}</td>
                      <td className="r num">{rata !== null ? Math.round(rata).toLocaleString('id-ID') : '—'}</td>
                    </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
        )}
        <p className="lbl" style={{ marginTop: 8, textTransform: 'none', letterSpacing: 0 }}>
          Baris nego cuma ada untuk hari yang varian pasar NEGO-nya sudah dipanen — backfill asing+nego BUMI 2017→2026 sedang berjalan.
        </p>
      </div>
    </section>
  )
}
