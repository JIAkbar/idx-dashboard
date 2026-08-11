import { Kalender } from '../../components/dasbor/Kalender'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { fN, fp } from '../../lib/dasbor/format'
import type { StockContribRow } from '../../lib/dasbor/dataHarian'

/**
 * Panel "Top Stocks" — port buildStocksPanel() index_live.html baris 2839-2916,
 * bergaya papan "Lantai Bursa" (docs/design-lantai-bursa-reimagined.html
 * baris 497-557).
 *
 * Enam blok dan urutannya beku — hanya lapisan tampilan yang berubah: Top 10
 * Market Capitalization, Top Gainers, Top Losers, Top Leaders (Kontribusi),
 * Top Leaders YTD, Top Laggards (Kontribusi), Top Laggards YTD.
 */
export function TopStocks() {
  const { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error } = useDataHarian()

  if (loading && !hari) {
    return (
      <div className="lantai">
        <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 28 }}>⏳</p>
          <p className="lbl">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (error || !hari) {
    return (
      <div className="lantai">
        <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 28 }}>⚠️</p>
          <p className="lbl">Data tidak tersedia untuk tanggal ini</p>
        </div>
      </div>
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

  const contribRow = (x: StockContribRow, dir: 'up' | 'dn') => (
    <tr key={x.c}>
      <td><span className={`tick ${dir}`}>{x.c}</span></td>
      <td className={`r num ${x.p >= 0 ? 'up' : 'dn'}`}>{fp(x.p)}</td>
      <td className={`r num ${x.ih >= 0 ? 'up' : 'dn'}`}>{x.ih >= 0 ? '+' : ''}{x.ih.toFixed(2)}</td>
    </tr>
  )

  return (
    <div className="lantai">
      <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />

      <div className="panel">
        <div className="panel-h"><span className="lbl">Top 10 Market Capitalization (Triliun IDR)</span></div>
        <div className="panel-b">
          {mcap.map((m, i) => (
            <div className="mc-row" key={m.c}>
              <span className={'mc-rk' + (i < 3 ? ` rk${i + 1}` : '')}>{i + 1}</span>
              <span className="tick">{m.c}</span>
              <div className="bar-tr"><div className="bar-fl" style={{ width: `${(m.v / mx * 100).toFixed(0)}%` }} /></div>
              <span className="mc-v num">{m.v}T</span>
              <span className="mc-p num">{m.p}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Gainers Hari Ini</span></div>
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Kode</th><th className="r">Prev</th><th className="r">Today</th><th className="r">% Change</th></tr></thead>
              <tbody>
                {gainers.map((x) => (
                  <tr key={x.c}>
                    <td><span className="tick up">{x.c}</span></td>
                    <td className="r num muted">{fN(x.pr, 0)}</td>
                    <td className="r num green">{fN(x.td, 0)}</td>
                    <td className="r"><span className={`ytd-bdg ${x.p >= 0 ? 'u' : 'd'}`}>{fp(x.p)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Losers Hari Ini</span></div>
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Kode</th><th className="r">Prev</th><th className="r">Today</th><th className="r">% Change</th></tr></thead>
              <tbody>
                {losers.map((x) => (
                  <tr key={x.c}>
                    <td><span className="tick dn">{x.c}</span></td>
                    <td className="r num muted">{fN(x.pr, 0)}</td>
                    <td className="r num red">{fN(x.td, 0)}</td>
                    <td className="r"><span className={`ytd-bdg ${x.p >= 0 ? 'u' : 'd'}`}>{fp(x.p)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Leaders — Kontribusi IHSG Hari Ini</span></div>
          <div className="panel-b">
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Kode</th><th className="r">%Saham</th><th className="r">+IHSG</th></tr></thead>
                <tbody>{leadersToday.map((x) => contribRow(x, 'up'))}</tbody>
              </table>
            </div>
            <hr className="divider" />
            <div className="lbl" style={{ margin: '10px 0 8px' }}>Top Leaders YTD</div>
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Kode</th><th className="r">%YTD</th><th className="r">+IHSG</th></tr></thead>
                <tbody>{leadersYtd.map((x) => contribRow(x, 'up'))}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Laggards — Kontribusi IHSG Hari Ini</span></div>
          <div className="panel-b">
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Kode</th><th className="r">%Saham</th><th className="r">IHSG</th></tr></thead>
                <tbody>{laggardsToday.map((x) => contribRow(x, 'dn'))}</tbody>
              </table>
            </div>
            <hr className="divider" />
            <div className="lbl" style={{ margin: '10px 0 8px' }}>Top Laggards YTD</div>
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Kode</th><th className="r">%YTD</th><th className="r">IHSG</th></tr></thead>
                <tbody>{laggardsYtd.map((x) => contribRow(x, 'dn'))}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
