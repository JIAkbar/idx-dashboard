import { useMemo } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { Kalender } from '../../components/dasbor/Kalender'
import { useChartCanvas } from '../../lib/dasbor/useChartJs'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { useTheme } from '../../context/ThemeContext'
import { fN, fp, cls, bdg, fmtNF } from '../../lib/dasbor/format'

/**
 * Panel "Indeks Dunia" — port buildWorldPanel() index_live.html baris
 * 2740-2836, plus chart "wChart" dari buildCharts() baris 3054-3066.
 */
export function IndeksDunia() {
  const { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error } = useDataHarian()
  const { theme } = useTheme()

  const world = hari?.world ?? []

  const chartConfig = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (world.length === 0) return null
    const isDark = theme === 'dark'
    const gc = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
    const tc = isDark ? '#4a6785' : '#78909c'
    const redMain = isDark ? '#ff4d4d' : '#d32f2f'
    const redFaint = isDark ? 'rgba(255,77,77,0.35)' : 'rgba(211,47,47,0.35)'
    const greenFill = isDark ? 'rgba(0,210,180,0.55)' : 'rgba(0,121,107,0.55)'
    const greenMain = isDark ? '#00d2b4' : '#00796b'
    const isMob = window.innerWidth <= 768

    const s = [...world].sort((a, b) => a.ytd - b.ytd)
    return {
      type: 'bar',
      data: {
        labels: s.map((x) => x.c),
        datasets: [{
          data: s.map((x) => x.ytd),
          backgroundColor: s.map((x) => (x.is_idx ? redMain : x.ytd >= 0 ? greenFill : redFaint)),
          borderColor: s.map((x) => (x.is_idx ? redMain : x.ytd >= 0 ? greenMain : redMain)),
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
          x: { ticks: { color: tc, font: { size: isMob ? 9 : 11, weight: 500 }, maxRotation: 55, minRotation: 55, padding: 4 }, grid: { color: gc } },
          y: { ticks: { color: tc, font: { size: 12 }, callback: (v) => `${v}%`, padding: 6 }, grid: { color: gc } },
        },
      },
    }
    // world identity berubah tiap fetch tanggal baru; itu cukup untuk trigger rebuild chart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, theme])

  const canvasRef = useChartCanvas(chartConfig)

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

  let curR = ''

  return (
    <>
      <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />

      <div className="card" style={{ padding: 10, overflowX: 'auto' }}>
        {/* Jumlah negara dihitung dari data, bukan ditulis tetap: judul lama
            berbunyi "36 Negara" padahal berkas harian berisi 35 baris. */}
        <p className="ct b">Perbandingan Indeks Dunia — {world.length} Negara ({hari.date_id})</p>
        <table>
          <thead>
            <tr>
              <th>Negara</th><th>Indeks</th><th className="r">Nilai</th>
              <th className="r">Hari Ini</th><th className="r">YTD</th>
              <th className="r">A</th><th className="r">AP</th><th className="r">W</th>
            </tr>
          </thead>
          <tbody>
            {world.flatMap((w) => {
              const rows = []
              if (w.r !== curR) {
                curR = w.r
                rows.push(<tr key={`r-${w.r}`} className="region-hdr"><td colSpan={8}>{w.r}</td></tr>)
              }
              rows.push(
                <tr key={`${w.r}-${w.c}`} className={w.is_idx ? 'idx-row' : ''}>
                  <td style={{ fontWeight: w.is_idx ? 700 : 400 }}>{w.c}</td>
                  <td className="muted" style={{ fontSize: 10 }}>{w.idx}</td>
                  <td className="r">{fN(w.v)}</td>
                  <td className={`r ${cls(w.d)}`}>{fp(w.d)}</td>
                  <td className="r" dangerouslySetInnerHTML={{ __html: bdg(w.ytd) }} />
                  <td className="r muted">{w.ra ?? '-'}</td>
                  <td className="r muted">{w.rap ?? '-'}</td>
                  <td className="r muted">{w.rw ?? '-'}</td>
                </tr>,
              )
              return rows
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <p className="ct b">YTD Ranking — Semua Negara (Indonesia disorot merah)</p>
        <div className="chart-wrap" style={{ height: 280 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      <div className="sep" />

      <div className="card">
        <p className="ct b">📊 Average Daily Trading (YTD)</p>
        <div className="g3" style={{ gap: 10 }}>
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, textAlign: 'center', border: '0.5px solid var(--border)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text2)', marginBottom: 6 }}>Avg. Volume</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{fN(hari.avg_vol, 0)} <span style={{ fontSize: 13, color: 'var(--text2)' }}>Jt Lbr</span></p>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, textAlign: 'center', border: '0.5px solid var(--border)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text2)', marginBottom: 6 }}>Avg. Value</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{fN(hari.avg_val_idr, 0)} <span style={{ fontSize: 11, color: 'var(--text2)' }}>B IDR</span></p>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{fN(hari.avg_val_usd, 0)} Jt USD</p>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, textAlign: 'center', border: '0.5px solid var(--border)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text2)', marginBottom: 6 }}>Avg. Frequency</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{fN(hari.avg_freq, 0)} <span style={{ fontSize: 13, color: 'var(--text2)' }}>Rb Kali</span></p>
          </div>
        </div>
      </div>

      <div className="g2" style={{ gap: 8 }}>
        <div className="card" style={{ background: 'rgba(66,165,245,0.06)', borderColor: 'rgba(66,165,245,0.3)' }}>
          <p className="ct b">🌐 Net Foreign</p>
          <div className="g2" style={{ gap: 0, border: '0.5px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderRight: '0.5px solid var(--border)' }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Today</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: (hari.nf_today_idr ?? 0) < 0 ? 'var(--red)' : 'var(--green)' }}>{hari.nf_today_status ?? '-'}</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmtNF(hari.nf_today_idr ?? 0)}</p>
              <p style={{ fontSize: 10, color: 'var(--text3)' }}>(billion IDR)</p>
              <p style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtNF(hari.nf_today_usd ?? 0)}</p>
              <p style={{ fontSize: 10, color: 'var(--text3)' }}>(million USD~)</p>
            </div>
            <div style={{ padding: '12px 14px' }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>YTD</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: (hari.nf_ytd_idr ?? 0) < 0 ? 'var(--red)' : 'var(--green)' }}>{hari.nf_ytd_status ?? '-'}</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmtNF(hari.nf_ytd_idr ?? 0)}</p>
              <p style={{ fontSize: 10, color: 'var(--text3)' }}>(billion IDR)</p>
              <p style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtNF(hari.nf_ytd_usd ?? 0)}</p>
              <p style={{ fontSize: 10, color: 'var(--text3)' }}>(million USD)</p>
            </div>
          </div>
        </div>
        <div className="card" style={{ background: 'rgba(240,176,48,0.06)', borderColor: 'rgba(240,176,48,0.3)' }}>
          <p className="ct gold">📐 Market Fundamental</p>
          <div className="g2" style={{ gap: 0, border: '0.5px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: 20, textAlign: 'center', borderRight: '0.5px solid var(--border)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text3)', marginBottom: 8 }}>Market PER (x)</p>
              <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>{(hari.mkt_per ?? 0).toFixed(2)}</p>
            </div>
            <div style={{ padding: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text3)', marginBottom: 8 }}>Market PBV (x)</p>
              <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>{(hari.mkt_pbv ?? 0).toFixed(2)}</p>
            </div>
          </div>
          <p style={{ fontSize: 10, textAlign: 'center', color: 'var(--text3)', marginTop: 8 }}>~ USD/IDR BI = {fN(hari.usd_idr, 0)}</p>
        </div>
      </div>
    </>
  )
}
