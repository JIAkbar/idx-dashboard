import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Kalender } from '../../components/dasbor/Kalender'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { useUrut } from '../../lib/dasbor/useUrut'
import { fN, fp } from '../../lib/dasbor/format'
import type { StockContribRow, StockMoveRow } from '../../lib/dasbor/dataHarian'
import { IkonMenu, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'

/**
 * Reset tombol judul kolom ke tampilan teks polos — padanan `button{font:
 * inherit;color:inherit;background:none;border:none;cursor:pointer;padding:0}`
 * (docs/design-lantai-bursa-reimagined.html:55). Aturan itu ada di "BASE" milik
 * artifact tapi TIDAK ikut disalin ke lantai.css (komentar lantai.css bilang
 * "sudah ditangani di luar .lantai", nyatanya belum — dasbor.css juga tidak
 * punya reset button global). Ditaruh inline di sini, bukan di lantai.css,
 * karena file itu di luar cakupan Task 6.
 */
const thBtn: CSSProperties = { font: 'inherit', color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }

type UrutState<T> = { kunci: keyof T; arah: 'naik' | 'turun'; klik: (k: keyof T) => void }

/** Judul kolom yang bisa diklik untuk mengurutkan; teks & makna kolom tetap sama. */
function thSort<T extends object>(s: UrutState<T>, k: keyof T, label: string, kanan = false) {
  const aktif = s.kunci === k
  return (
    <th className={kanan ? 'r' : undefined}>
      <button type="button" style={thBtn} onClick={() => s.klik(k)}>
        {label}{aktif ? (s.arah === 'naik' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

/**
 * Panel "Top Stocks" — port buildStocksPanel() index_live.html baris 2839-2916,
 * bergaya papan "Lantai Bursa" (docs/design-lantai-bursa-reimagined.html
 * baris 497-557).
 *
 * Enam blok dan urutannya beku — hanya lapisan tampilan yang berubah: Top 10
 * Market Capitalization, Top Gainers, Top Losers, Top Leaders (Kontribusi),
 * Top Leaders YTD, Top Laggards (Kontribusi), Top Laggards YTD.
 *
 * Pengurutan lewat judul kolom (useUrut, Task 6) dipasang di keenam tabel di
 * bawah — TIDAK di Top 10 Market Cap, itu daftar peringkat ber-.mc-row, bukan
 * tabel biasa.
 */
export function TopStocks() {
  const { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error } = useDataHarian()

  // Hooks dipanggil tanpa syarat sebelum return dini loading/error (Rules of
  // Hooks) — pola sama dengan SektorIndeks.tsx.
  const gainersS = useUrut<StockMoveRow>(hari?.gainers ?? [], 'p')
  const losersS = useUrut<StockMoveRow>(hari?.losers ?? [], 'p')
  const leadersTodayS = useUrut<StockContribRow>(hari?.leaders_today ?? [], 'ih')
  const leadersYtdS = useUrut<StockContribRow>(hari?.leaders_ytd ?? [], 'ih')
  const laggardsTodayS = useUrut<StockContribRow>(hari?.laggards_today ?? [], 'ih')
  const laggardsYtdS = useUrut<StockContribRow>(hari?.laggards_ytd ?? [], 'ih')

  if (loading && !hari) {
    return (
      <div className="lantai">
        <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />
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
        <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">Data tidak tersedia untuk tanggal ini</p>
        </div>
      </div>
    )
  }

  const mcap = hari.mcap ?? []
  const mx = mcap[0]?.v || 1

  const contribRow = (x: StockContribRow, dir: 'up' | 'dn') => (
    <tr key={x.c}>
      <td><Link to={`/chart?sym=${x.c}`} className={`tick ${dir}`}>{x.c}</Link></td>
      <td className={`r num ${x.p >= 0 ? 'up' : 'dn'}`}>{fp(x.p)}</td>
      <td className={`r num ${x.ih >= 0 ? 'up' : 'dn'}`}>{x.ih >= 0 ? '+' : ''}{x.ih.toFixed(2)}</td>
    </tr>
  )

  return (
    <div className="lantai">
      <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />

      <div className="panel">
        <div className="panel-h"><span className="lbl">Top 10 Market Capitalization (Triliun IDR)</span></div>
        <div className="panel-b">
          {mcap.map((m, i) => (
            <div className="mc-row" key={m.c}>
              <span className={'mc-rk' + (i < 3 ? ` rk${i + 1}` : '')}>{i + 1}</span>
              <Link to={`/chart?sym=${m.c}`} className="tick">{m.c}</Link>
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
              <thead><tr>
                {thSort(gainersS, 'c', 'Kode')}
                {thSort(gainersS, 'pr', 'Prev', true)}
                {thSort(gainersS, 'td', 'Today', true)}
                {thSort(gainersS, 'p', '% Change', true)}
              </tr></thead>
              <tbody>
                {gainersS.urut.map((x) => (
                  <tr key={x.c}>
                    <td><Link to={`/chart?sym=${x.c}`} className="tick up">{x.c}</Link></td>
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
              <thead><tr>
                {thSort(losersS, 'c', 'Kode')}
                {thSort(losersS, 'pr', 'Prev', true)}
                {thSort(losersS, 'td', 'Today', true)}
                {thSort(losersS, 'p', '% Change', true)}
              </tr></thead>
              <tbody>
                {losersS.urut.map((x) => (
                  <tr key={x.c}>
                    <td><Link to={`/chart?sym=${x.c}`} className="tick dn">{x.c}</Link></td>
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
                <thead><tr>
                  {thSort(leadersTodayS, 'c', 'Kode')}
                  {thSort(leadersTodayS, 'p', '%Saham', true)}
                  {thSort(leadersTodayS, 'ih', '+IHSG', true)}
                </tr></thead>
                <tbody>{leadersTodayS.urut.map((x) => contribRow(x, 'up'))}</tbody>
              </table>
            </div>
            <hr className="divider" />
            <div className="lbl" style={{ margin: '10px 0 8px' }}>Top Leaders YTD</div>
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead><tr>
                  {thSort(leadersYtdS, 'c', 'Kode')}
                  {thSort(leadersYtdS, 'p', '%YTD', true)}
                  {thSort(leadersYtdS, 'ih', '+IHSG', true)}
                </tr></thead>
                <tbody>{leadersYtdS.urut.map((x) => contribRow(x, 'up'))}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Laggards — Kontribusi IHSG Hari Ini</span></div>
          <div className="panel-b">
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead><tr>
                  {thSort(laggardsTodayS, 'c', 'Kode')}
                  {thSort(laggardsTodayS, 'p', '%Saham', true)}
                  {thSort(laggardsTodayS, 'ih', 'IHSG', true)}
                </tr></thead>
                <tbody>{laggardsTodayS.urut.map((x) => contribRow(x, 'dn'))}</tbody>
              </table>
            </div>
            <hr className="divider" />
            <div className="lbl" style={{ margin: '10px 0 8px' }}>Top Laggards YTD</div>
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead><tr>
                  {thSort(laggardsYtdS, 'c', 'Kode')}
                  {thSort(laggardsYtdS, 'p', '%YTD', true)}
                  {thSort(laggardsYtdS, 'ih', 'IHSG', true)}
                </tr></thead>
                <tbody>{laggardsYtdS.urut.map((x) => contribRow(x, 'dn'))}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
