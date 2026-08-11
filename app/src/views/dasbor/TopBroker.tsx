import { Kalender } from '../../components/dasbor/Kalender'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { fN } from '../../lib/dasbor/format'
import type { StockRankRow, BrokerRankRow } from '../../lib/dasbor/dataHarian'

/** Panel "Top Broker" — port buildBrokerPanel() index_live.html baris 2919-2967. */
export function TopBroker() {
  const { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error } = useDataHarian()

  if (loading && !hari) {
    return (
      <>
        <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 28 }}>⏳</p>
          <p style={{ color: 'var(--text2)', fontSize: 12 }}>Memuat data...</p>
        </div>
      </>
    )
  }

  if (error || !hari) {
    return (
      <>
        <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 28 }}>⚠️</p>
          <p style={{ color: 'var(--text2)', fontSize: 12 }}>Data tidak tersedia untuk tanggal ini</p>
        </div>
      </>
    )
  }

  const tblStock = (data: StockRankRow[]) => data.map((x) => (
    <tr key={x.c}>
      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{x.c}</td>
      <td className="r">{fN(x.v, 0)}</td>
      <td className="r muted">{x.p}%</td>
    </tr>
  ))

  const tblBroker = (data: BrokerRankRow[]) => data.map((x) => (
    <tr key={x.cd}>
      <td><span className="bchip">{x.cd}</span></td>
      <td style={{ fontSize: 10, color: 'var(--text2)' }}>{x.nm}</td>
      <td className="r">{fN(x.v, 0)}</td>
      <td className="r muted">{x.p}%</td>
    </tr>
  ))

  return (
    <>
      <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />

      <div className="card">
        <p className="ct b">Top Stock Trading — By Volume · Value · Frequency</p>
        <div className="g3">
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>By Volume (Juta Saham)</p>
            <table>
              <thead><tr><th>Kode</th><th className="r">Volume</th><th className="r">%</th></tr></thead>
              <tbody>{tblStock(hari.top_vol ?? [])}</tbody>
            </table>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>By Value (Miliar IDR)</p>
            <table>
              <thead><tr><th>Kode</th><th className="r">Nilai</th><th className="r">%</th></tr></thead>
              <tbody>{tblStock(hari.top_val ?? [])}</tbody>
            </table>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>By Frequency (Kali)</p>
            <table>
              <thead><tr><th>Kode</th><th className="r">Frekuensi</th><th className="r">%</th></tr></thead>
              <tbody>{tblStock(hari.top_freq ?? [])}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="g3">
        <div className="card">
          <p className="ct gold">Top Broker — By Volume (Juta Saham)</p>
          <table>
            <thead><tr><th>Kode</th><th>Nama Broker</th><th className="r">Volume</th><th className="r">%</th></tr></thead>
            <tbody>{tblBroker(hari.broker_vol ?? [])}</tbody>
          </table>
        </div>
        <div className="card">
          <p className="ct gold">Top Broker — By Value (Miliar IDR)</p>
          <table>
            <thead><tr><th>Kode</th><th>Nama Broker</th><th className="r">Nilai</th><th className="r">%</th></tr></thead>
            <tbody>{tblBroker(hari.broker_val ?? [])}</tbody>
          </table>
        </div>
        <div className="card">
          <p className="ct gold">Top Broker — By Frequency (Kali)</p>
          <table>
            <thead><tr><th>Kode</th><th>Nama Broker</th><th className="r">Frekuensi</th><th className="r">%</th></tr></thead>
            <tbody>{tblBroker(hari.broker_freq ?? [])}</tbody>
          </table>
        </div>
      </div>
    </>
  )
}
