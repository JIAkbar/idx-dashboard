import { useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { PemilihRentang } from '../../../components/dasbor/PemilihRentang'
import type { BarisOhlcv } from '../../../lib/dasbor/brokerEmitenV2'
import { regresiVsIhsg } from '../../../lib/dasbor/brokerEmitenV2'
import { LABEL_RENTANG } from '../../../lib/dasbor/periode'
import { labelTanggal } from '../../../lib/dasbor/brokerHarian'
import { EmptyState } from './Overview'

type RentangVs = 'b3' | 'b6' | 'ytd'
const OPSI_RENTANG: { id: RentangVs; label: string }[] = [
  { id: 'b3', label: LABEL_RENTANG.b3 },
  { id: 'b6', label: LABEL_RENTANG.b6 },
  { id: 'ytd', label: LABEL_RENTANG.ytd },
]

/** Jumlah hari bursa yang diminta rentang — YTD dihitung dari 1 Jan tahun bar TERAKHIR (bukan angka tetap). */
function hariUntukRentang(r: RentangVs, bars: BarisOhlcv[]): number {
  if (r === 'b3') return 63
  if (r === 'b6') return 126
  const akhir = bars[bars.length - 1]?.tanggal
  if (!akhir) return 252
  const awalTahun = `${akhir.slice(0, 4)}-01-01`
  return bars.filter((b) => b.tanggal >= awalTahun).length || 252
}

function Metrik({ k, ket, v, warna }: { k: string; ket?: string; v: string; warna?: string }) {
  return (
    <div>
      <span className="k">{k}{ket && <small>{ket}</small>}</span>
      <span className="v" style={warna ? { color: warna } : undefined}>{v}</span>
    </div>
  )
}

interface VsIhsgProps {
  /** Kode emiten yang sedang dilihat — label seri chart. Dulu hardcode
   *  'BUMI', jadi semua emiten berlabel BUMI di legenda (temuan sweep #355). */
  kode: string
  saham: BarisOhlcv[]
  ihsg: BarisOhlcv[]
}

/** Tab "vs IHSG" — port `deretVs()`+`renderVsIHSG()` mockup: rebased, RS trend, 3 panel metrik. */
export function VsIhsg({ kode, saham, ihsg }: VsIhsgProps) {
  const { theme } = useTheme()
  const [rentang, setRentang] = useState<RentangVs>('b6')
  const n = hariUntukRentang(rentang, saham)
  const r = useMemo(() => regresiVsIhsg(saham, ihsg, n), [saham, ihsg, n])

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!r) return null
    const isDark = theme === 'dark'
    const textColor = isDark ? '#cfd8e3' : '#1a2733'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    return {
      type: 'line',
      data: {
        labels: r.tgl,
        datasets: [
          { label: kode, data: r.rebasedSaham, borderColor: '#38B77E', borderWidth: 2.2, pointRadius: 0 },
          { label: 'IHSG', data: r.rebasedIhsg, borderColor: '#5B94E8', borderWidth: 2, pointRadius: 0 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, font: { size: 10 } } } },
        scales: {
          x: { ticks: { color: text2Color, maxTicksLimit: 8, callback: (_v, i) => labelTanggal(r.tgl[i]) }, grid: { display: false } },
          y: { ticks: { color: text2Color, callback: (v) => Number(v).toFixed(0) }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }
  }, [r, theme])
  const canvasRef = useChartCanvas(config)

  const configRS = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!r) return null
    const isDark = theme === 'dark'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    const rsd = r.rebasedSaham.map((v, i) => v - r.rebasedIhsg[i])
    return {
      type: 'line',
      data: { labels: r.tgl, datasets: [{ label: 'Relative strength', data: rsd, borderColor: '#38B77E', backgroundColor: 'rgba(56,183,126,.14)', fill: true, borderWidth: 2, pointRadius: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: text2Color, maxTicksLimit: 8, callback: (_v, i) => labelTanggal(r.tgl[i]) }, grid: { display: false } },
          y: { ticks: { color: text2Color }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }
  }, [r, theme])
  const canvasRSRef = useChartCanvas(configRS)

  const tone = (v: number, baik = true) => (baik ? v >= 0 : v < 0) ? 'var(--green)' : 'var(--red)'

  return (
    <>
      <div className="kendali" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <PemilihRentang opsi={OPSI_RENTANG} nilai={rentang} onGanti={setRentang} ariaLabel="Rentang vs IHSG" />
        {r && <span className="lbl">{labelTanggal(r.tgl[0])} – {labelTanggal(r.tgl[r.tgl.length - 1])} · {r.n} hari bursa</span>}
      </div>
      {!r ? (
        <section className="panel"><div className="panel-b"><EmptyState>Tak cukup irisan tanggal BUMI vs IHSG pada rentang ini.</EmptyState></div></section>
      ) : (
        <div className="grid-vs" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 14 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <section className="panel">
              <div className="panel-h"><h2>Rebased performance</h2><span className="lbl">titik pertama = 100 · <span style={{ color: '#38B77E' }}>■</span> BUMI <span style={{ color: '#5B94E8' }}>■</span> IHSG</span></div>
              <div className="panel-b"><div className="chart-wrap" style={{ height: 320 }}><canvas ref={canvasRef} /></div></div>
            </section>
            <section className="panel">
              <div className="panel-h"><h2>Relative strength trend</h2><span className="lbl">saham − IHSG (rebased), di atas 0 = unggul</span></div>
              <div className="panel-b"><div className="chart-wrap" style={{ height: 200 }}><canvas ref={canvasRSRef} /></div></div>
            </section>
          </div>
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <section className="panel">
              <div className="panel-h"><h2>Regression metrics</h2></div>
              <div className="panel-b bs2-metrik">
                <Metrik k="Beta" ket={r.beta < 0.8 ? 'defensif (volatilitas rendah)' : r.beta < 1.2 ? 'sejalan pasar' : 'agresif (volatilitas tinggi)'} v={r.beta.toFixed(2)} />
                <Metrik k="Korelasi (r)" ket={`${Math.abs(r.korelasi) < 0.3 ? 'lemah' : Math.abs(r.korelasi) < 0.6 ? 'sedang' : 'kuat'} (${r.korelasi >= 0 ? 'positif' : 'negatif'})`} v={r.korelasi.toFixed(2)} />
                <Metrik k="R-Squared (R²)" ket="proporsi varians terjelaskan IHSG" v={r.rSquared.toFixed(2)} />
                <Metrik k="Alpha (abnormal return)" ket="return saham − beta × return IHSG" v={`${r.alpha >= 0 ? '+' : ''}${r.alpha.toFixed(2)}%`} warna={tone(r.alpha)} />
                <Metrik k="Hari perdagangan" ket="sampel data aktif" v={String(r.n)} />
              </div>
            </section>
            <section className="panel">
              <div className="panel-h"><h2>Returns summary</h2></div>
              <div className="panel-b bs2-metrik">
                <Metrik k="Return BUMI" v={`${r.returnSaham >= 0 ? '+' : ''}${r.returnSaham.toFixed(2)}%`} warna={tone(r.returnSaham)} />
                <Metrik k="Return IHSG" v={`${r.returnIhsg >= 0 ? '+' : ''}${r.returnIhsg.toFixed(2)}%`} warna={tone(r.returnIhsg)} />
                <Metrik k="Relative strength" ket="return saham − return IHSG" v={`${(r.returnSaham - r.returnIhsg) >= 0 ? '+' : ''}${(r.returnSaham - r.returnIhsg).toFixed(2)}%`} warna={tone(r.returnSaham - r.returnIhsg)} />
              </div>
            </section>
            <section className="panel">
              <div className="panel-h"><h2>Risk &amp; consistency</h2></div>
              <div className="panel-b bs2-metrik">
                <Metrik k="Volatilitas BUMI" ket="annualized (σ harian × √252)" v={`${r.volatilitasSaham.toFixed(1)}%`} />
                <Metrik k="Volatilitas IHSG" ket="annualized" v={`${r.volatilitasIhsg.toFixed(1)}%`} />
                <Metrik k="Win rate harian" ket="% hari saham > IHSG" v={`${r.winRateHarian.toFixed(1)}%`} />
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  )
}
