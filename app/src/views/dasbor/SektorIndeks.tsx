import { useMemo } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { Kalender } from '../../components/dasbor/Kalender'
import { useChartCanvas } from '../../lib/dasbor/useChartJs'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { useTheme } from '../../context/ThemeContext'
import { fN, fp, cls, bdg } from '../../lib/dasbor/format'
import type { SectorRow } from '../../lib/dasbor/dataHarian'

/**
 * Panel "Sektor & Indeks" — port buildSectorPanel() index_live.html baris
 * 2970-3023, plus chart "secChart"/"idxChart" dari buildCharts() baris
 * 3068-3095. Termasuk Board Indices (Papan Utama/Pengembangan/Akselerasi).
 */
export function SektorIndeks() {
  const { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error } = useDataHarian()
  const { theme } = useTheme()

  const sectors = hari?.sectors ?? []
  const featured = hari?.featured ?? []
  const sharia = hari?.sharia ?? []

  const secChartConfig = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (sectors.length === 0) return null
    const isDark = theme === 'dark'
    const gc = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
    const tc = isDark ? '#4a6785' : '#78909c'
    const redMain = isDark ? '#ff4d4d' : '#d32f2f'
    const redFill = isDark ? 'rgba(255,77,77,0.55)' : 'rgba(211,47,47,0.55)'
    const greyFill = isDark ? 'rgba(180,180,180,0.3)' : 'rgba(100,120,130,0.35)'
    const greyMain = isDark ? '#9ab0bc' : '#78909c'
    const isMob = window.innerWidth <= 768

    const sd = [...sectors].sort((a, b) => a.ytd - b.ytd)
    return {
      type: 'bar',
      data: {
        labels: sd.map((x) => x.n.replace(/\[.\] /, '')),
        datasets: [
          { label: 'YTD %', data: sd.map((x) => x.ytd), backgroundColor: redFill, borderColor: redMain, borderWidth: 1.5, borderRadius: 2 },
          { label: 'Hari ini', data: sd.map((x) => x.d), backgroundColor: greyFill, borderColor: greyMain, borderWidth: 1, borderRadius: 2 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { color: tc, font: { size: 12 }, boxWidth: 12, padding: 14 } } },
        layout: { padding: { top: 4, bottom: 4 } },
        scales: {
          x: { ticks: { color: tc, font: { size: isMob ? 9 : 11, weight: 500 }, maxRotation: 40, minRotation: 40, padding: 4 }, grid: { color: gc } },
          y: { ticks: { color: tc, font: { size: 12 }, callback: (v) => `${v}%`, padding: 6 }, grid: { color: gc } },
        },
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectors, theme])

  const idxChartConfig = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (featured.length === 0) return null
    const isDark = theme === 'dark'
    const gc = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
    const tc = isDark ? '#4a6785' : '#78909c'
    const redMain = isDark ? '#ff4d4d' : '#d32f2f'
    const redFill = isDark ? 'rgba(255,77,77,0.55)' : 'rgba(211,47,47,0.55)'
    const redFaint = isDark ? 'rgba(255,77,77,0.35)' : 'rgba(211,47,47,0.35)'
    const isMob = window.innerWidth <= 768

    const all = [...featured, ...sharia].sort((a, b) => b.ytd - a.ytd)
    return {
      type: 'bar',
      data: {
        labels: all.map((x) => x.n),
        datasets: [{
          data: all.map((x) => x.ytd),
          backgroundColor: all.map((x) => (x.n.includes('IDX Composite') || x.n.includes('IHSG') ? redMain : redFaint)),
          borderColor: all.map((x) => (x.n.includes('IDX Composite') || x.n.includes('IHSG') ? redMain : redFill)),
          borderWidth: 1.5,
          borderRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        layout: { padding: { top: 4, bottom: 4 } },
        scales: {
          x: { ticks: { color: tc, font: { size: isMob ? 9 : 11, weight: 500 }, maxRotation: 50, minRotation: 50, padding: 4 }, grid: { color: gc } },
          y: { ticks: { color: tc, font: { size: 12 }, callback: (v) => `${v}%`, padding: 6 }, grid: { color: gc } },
        },
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured, sharia, theme])

  const secCanvasRef = useChartCanvas(secChartConfig)
  const idxCanvasRef = useChartCanvas(idxChartConfig)

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

  const board = hari.board ?? []
  const secRows = [...sectors].sort((a, b) => a.d - b.d)

  const perfRow = (x: SectorRow, hdgClass: string) => (
    <tr key={x.n}>
      <td>{x.n}</td>
      <td className="r muted">{fN(x.v)}</td>
      <td className={`r ${hdgClass}`}>{fp(x.d)}</td>
      <td className="r" dangerouslySetInnerHTML={{ __html: bdg(x.ytd) }} />
    </tr>
  )

  return (
    <>
      <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />

      <div className="card">
        <p className="ct b">📊 Performa Sektor — Hari Ini vs YTD</p>
        <table>
          <thead><tr><th>Sektor</th><th className="r">Nilai Indeks</th><th className="r">Hari Ini</th><th className="r">YTD</th></tr></thead>
          <tbody>{secRows.map((s) => perfRow(s, cls(s.d)))}</tbody>
        </table>
      </div>

      <div className="card">
        <p className="ct b">Sektor — YTD vs Hari Ini</p>
        <div className="chart-wrap" style={{ height: 300 }}>
          <canvas ref={secCanvasRef} />
        </div>
      </div>

      <div className="sep" />

      <div className="g2">
        <div className="card">
          <p className="ct b" style={{ fontSize: 12, marginBottom: 10 }}>📈 Indeks Unggulan</p>
          <table>
            <thead><tr><th>Indeks</th><th className="r">Nilai</th><th className="r">Hari Ini</th><th className="r">YTD</th></tr></thead>
            <tbody>{featured.map((x) => perfRow(x, cls(x.d)))}</tbody>
          </table>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card" style={{ flex: 1 }}>
            <p className="ct b" style={{ fontSize: 12, marginBottom: 10 }}>☪️ Indeks Syariah</p>
            <table>
              <thead><tr><th>Indeks</th><th className="r">Nilai</th><th className="r">Hari Ini</th><th className="r">YTD</th></tr></thead>
              <tbody>{sharia.map((x) => perfRow(x, cls(x.d)))}</tbody>
            </table>
          </div>
          <div className="card" style={{ flex: 1 }}>
            <p className="ct b" style={{ fontSize: 12, marginBottom: 10 }}>🗂️ Board Indices</p>
            <div className="board-tbl-wrap">
              <table className="board-tbl">
                <thead><tr><th>Board</th><th className="r">Nilai</th><th className="r">Hari Ini</th><th className="r">YTD</th></tr></thead>
                <tbody>
                  {board.map((x) => perfRow(
                    { ...x, n: x.n.replace('Main Board', 'Papan Utama').replace('Development Board', 'Papan Pengembangan').replace('Acceleration Board', 'Papan Akselerasi') },
                    cls(x.d),
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="ct b">YTD — Perbandingan Semua Indeks Utama</p>
        <div className="chart-wrap" style={{ height: 300 }}>
          <canvas ref={idxCanvasRef} />
        </div>
      </div>
    </>
  )
}
