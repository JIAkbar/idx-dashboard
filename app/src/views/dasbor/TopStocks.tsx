import { Kalender } from '../../components/dasbor/Kalender'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { fN, fp, cls, bdg } from '../../lib/dasbor/format'
import type { StockContribRow } from '../../lib/dasbor/dataHarian'

/** Panel "Top Stocks" — port buildStocksPanel() index_live.html baris 2839-2916. */
export function TopStocks() {
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

  const mcap = hari.mcap ?? []
  const mx = mcap[0]?.v || 1
  const gainers = hari.gainers ?? []
  const losers = hari.losers ?? []
  const leadersToday = hari.leaders_today ?? []
  const leadersYtd = hari.leaders_ytd ?? []
  const laggardsToday = hari.laggards_today ?? []
  const laggardsYtd = hari.laggards_ytd ?? []

  const contribRow = (x: StockContribRow, color: 'green' | 'red') => (
    <tr key={x.c}>
      <td style={{ fontWeight: 700, color: `var(--${color})` }}>{x.c}</td>
      <td className={`r ${cls(x.p)}`}>{fp(x.p)}</td>
      <td className={`r ${cls(x.ih)}`}>{x.ih >= 0 ? '+' : ''}{x.ih.toFixed(2)}</td>
    </tr>
  )

  return (
    <>
      <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />

      <div className="card">
        <p className="ct gold">Top 10 Market Capitalization (Triliun IDR)</p>
        {mcap.map((m, i) => {
          const rc = i < 3 ? ['rk1', 'rk2', 'rk3'][i] : ''
          return (
            <div key={m.c} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  {i < 3
                    ? <span className={`rank ${rc}`}>{i + 1}</span>
                    : <span style={{ color: 'var(--text3)', fontSize: 10, marginRight: 4 }}>{i + 1}</span>}
                  {m.c}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>
                  {m.v}T &nbsp;<span className="bdg bdg-b" style={{ fontSize: 9 }}>{m.p}%</span>
                </span>
              </div>
              <div className="bar-bg"><div className="bar-fill" style={{ width: `${(m.v / mx * 100).toFixed(0)}%`, background: 'var(--accent)' }} /></div>
            </div>
          )
        })}
      </div>

      <div className="g2">
        <div className="card">
          <p className="ct g">Top Gainers Hari Ini</p>
          <table>
            <thead><tr><th>Kode</th><th className="r">Prev</th><th className="r">Today</th><th className="r">% Change</th></tr></thead>
            <tbody>
              {gainers.map((x) => (
                <tr key={x.c}>
                  <td style={{ fontWeight: 700, color: 'var(--green)' }}>{x.c}</td>
                  <td className="r muted">{fN(x.pr, 0)}</td>
                  <td className="r green">{fN(x.td, 0)}</td>
                  <td className="r" dangerouslySetInnerHTML={{ __html: bdg(x.p) }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <p className="ct r">Top Losers Hari Ini</p>
          <table>
            <thead><tr><th>Kode</th><th className="r">Prev</th><th className="r">Today</th><th className="r">% Change</th></tr></thead>
            <tbody>
              {losers.map((x) => (
                <tr key={x.c}>
                  <td style={{ fontWeight: 700, color: 'var(--red)' }}>{x.c}</td>
                  <td className="r muted">{fN(x.pr, 0)}</td>
                  <td className="r red">{fN(x.td, 0)}</td>
                  <td className="r" dangerouslySetInnerHTML={{ __html: bdg(x.p) }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="g2">
        <div className="card">
          <p className="ct g">Top Leaders — Kontribusi IHSG Hari Ini</p>
          <table>
            <thead><tr><th>Kode</th><th className="r">%Saham</th><th className="r">+IHSG</th></tr></thead>
            <tbody>{leadersToday.map((x) => contribRow(x, 'green'))}</tbody>
          </table>
          <hr className="divider" />
          <p className="ct g">Top Leaders YTD</p>
          <table>
            <thead><tr><th>Kode</th><th className="r">%YTD</th><th className="r">+IHSG</th></tr></thead>
            <tbody>{leadersYtd.map((x) => contribRow(x, 'green'))}</tbody>
          </table>
        </div>
        <div className="card">
          <p className="ct r">Top Laggards — Kontribusi IHSG Hari Ini</p>
          <table>
            <thead><tr><th>Kode</th><th className="r">%Saham</th><th className="r">IHSG</th></tr></thead>
            <tbody>{laggardsToday.map((x) => contribRow(x, 'red'))}</tbody>
          </table>
          <hr className="divider" />
          <p className="ct r">Top Laggards YTD</p>
          <table>
            <thead><tr><th>Kode</th><th className="r">%YTD</th><th className="r">IHSG</th></tr></thead>
            <tbody>{laggardsYtd.map((x) => contribRow(x, 'red'))}</tbody>
          </table>
        </div>
      </div>
    </>
  )
}
