import { useMemo } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useChartCanvas, bacaTokenTema } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import type { AgregatBroker, HariBroker } from '../../../lib/dasbor/brokerEmiten'
import { convictionHarian } from '../../../lib/dasbor/brokerEmitenV2'
import { warnaBroker, namaBroker } from '../../../lib/dasbor/kelompokBroker'
import { fmtB } from '../../../lib/dasbor/brokerSummaryFormat'
import { labelTanggal } from '../../../lib/dasbor/brokerHarian'

/** Satu sisi (Buy atau Sell) tabel Gross/Net/%Net — port `renderFlowNetGross()` mockup. */
function BarisFlow({ a, sisi }: { a: AgregatBroker; sisi: 'beli' | 'jual' }) {
  const gross = sisi === 'beli' ? a.beliNilai : a.jualNilai
  const net = Math.abs(a.netNilai)
  const p = gross ? (net / gross) * 100 : 0
  const warna = sisi === 'beli' ? 'var(--green)' : 'var(--red)'
  return (
    <tr>
      <td style={{ color: warnaBroker(a.broker), fontWeight: 600 }} title={namaBroker(a.broker)}>{a.broker}</td>
      <td className="r num" style={{ color: 'var(--text2)' }}>{fmtB(gross)}</td>
      <td className="r num"><b>{fmtB(net)}</b></td>
      <td className="r num">
        {p.toFixed(1)}%
        <span className="bs2-pct-bar"><i style={{ width: `${Math.min(100, p)}%`, background: warna }} /></span>
      </td>
    </tr>
  )
}

interface FlowNetGrossProps {
  hari: Array<[string, HariBroker]>
  agg: AgregatBroker[]
}

/**
 * Tab "Flow Net vs Gross" — port `renderFlowNetGross()` (dua tabel) +
 * `renderConviction()` (chart Market Flow Conviction) mockup.
 */
export function FlowNetGross({ hari, agg }: FlowNetGrossProps) {
  const { theme } = useTheme()
  const beli = [...agg].filter((a) => a.netNilai > 0).sort((x, y) => y.netNilai - x.netNilai)
  const jual = [...agg].filter((a) => a.netNilai < 0).sort((x, y) => x.netNilai - y.netNilai)
  const konviksi = useMemo(() => convictionHarian(hari), [hari])

  const config = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (konviksi.length === 0) return null
    const isDark = theme === 'dark'
    const textColor = isDark ? '#cfd8e3' : '#1a2733'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    const labels = konviksi.map((k) => k.tanggal)
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { type: 'bar', label: 'Nilai kotor', data: konviksi.map((k) => k.kotor), backgroundColor: 'rgba(128,128,128,.25)', yAxisID: 'y' },
          { type: 'bar', label: 'Net handover', data: konviksi.map((k) => k.net), backgroundColor: bacaTokenTema('--blue', '#5B94E8'), yAxisID: 'y' },
          { type: 'line', label: 'Conviction %', data: konviksi.map((k) => k.konviksi), borderColor: '#38B77E', yAxisID: 'y1', pointRadius: 0, borderWidth: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label === 'Conviction %'
                ? `Conviction: ${Number(ctx.raw).toFixed(1)}%`
                : `${ctx.dataset.label}: Rp ${fmtB(Number(ctx.raw))}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: text2Color, maxTicksLimit: 10, callback: (_v, i) => labelTanggal(labels[i]) }, grid: { display: false } },
          y: { position: 'left', ticks: { color: text2Color, callback: (v) => fmtB(Number(v)) }, grid: { color: 'rgba(128,128,128,.1)' } },
          y1: { position: 'right', min: 0, max: 100, ticks: { color: text2Color, callback: (v) => `${v}%` }, grid: { display: false } },
        },
      },
    }
  }, [konviksi, theme])
  const canvasRef = useChartCanvas(config)

  return (
    <>
      <section className="panel">
        <div className="panel-h"><h2>Flow Analysis (Net vs Gross)</h2><span className="lbl">% net = net ÷ gross sisi itu</span></div>
        <div className="panel-b grid2">
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead><tr><th style={{ color: 'var(--green)' }}>Buy</th><th className="r">Gross</th><th className="r">Net</th><th className="r">% Net</th></tr></thead>
              <tbody>{beli.map((a) => <BarisFlow key={a.broker} a={a} sisi="beli" />)}</tbody>
            </table>
          </div>
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead><tr><th style={{ color: 'var(--red)' }}>Sell</th><th className="r">Gross</th><th className="r">Net</th><th className="r">% Net</th></tr></thead>
              <tbody>{jual.map((a) => <BarisFlow key={a.broker} a={a} sisi="jual" />)}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 14 }}>
        <div className="panel-h"><h2>Market Flow Conviction (Daily Trend)</h2><span className="lbl">batang: nilai kotor &amp; net handover · garis: conviction %</span></div>
        <div className="panel-b">
          {config ? (
            <div className="chart-wrap" style={{ height: 300 }}><canvas ref={canvasRef} /></div>
          ) : (
            <p className="lbl" style={{ padding: '20px 0', textAlign: 'center', textTransform: 'none' }}>Tak ada hari dalam rentang ini.</p>
          )}
          <p className="lbl" style={{ marginTop: 10, textTransform: 'none', letterSpacing: 0 }}>
            <b>Definisi kita:</b> net handover = Σ net pembeli hari itu (nilai yang berpindah tangan bersih); conviction = net handover ÷ nilai kotor. Tinggi = arus searah, rendah = bolak-balik intraday.
          </p>
        </div>
      </section>
    </>
  )
}
