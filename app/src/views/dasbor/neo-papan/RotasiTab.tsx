import { useEffect, useMemo, useState } from 'react'
import type { ChartConfiguration, Plugin } from 'chart.js/auto'
import { useChartCanvas, bacaTokenTema } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { muatOhlcv, type BarHarga } from '../../../lib/dasbor/neoPapanData'
import { rsRatioMomentum } from '../../../lib/dasbor/neoPapan'
import { muatUniverseSektor, type UniverseSektor } from './kandidat'
import { TOKEN_SERI, Kosong, Sumber } from './bersama'

const OPSI_N = [4, 8, 12]
const TRAIL = 6

/** Level sektor (rata-rata setara sampel, basis 100 di hari pertama) per tanggal IHSG. */
function levelSektor(kandidat: string[], bars: Map<string, BarHarga[]>, kalender: string[]): number[] {
  const closeByKode = kandidat.map((k) => new Map((bars.get(k) ?? []).map((b) => [b.t, b.c])))
  const level: number[] = []
  let x = 100
  for (let i = 0; i < kalender.length; i++) {
    if (i > 0) {
      const ret: number[] = []
      for (const m of closeByKode) {
        const cur = m.get(kalender[i]), prev = m.get(kalender[i - 1])
        if (cur != null && prev) ret.push(cur / prev - 1)
      }
      if (ret.length) x *= 1 + ret.reduce((a, b) => a + b, 0) / ret.length
    }
    level.push(x)
  }
  return level
}

/** Hari bursa terakhir tiap pekan ISO, dari kalender yang tersedia. */
function tandaMingguan(kalender: string[]): number[] {
  const idxTerakhir = new Map<string, number>()
  kalender.forEach((t, i) => {
    const [y, m, d] = t.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    const onejan = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
    const pekan = Math.ceil(((+dt - +onejan) / 86400000 + onejan.getUTCDay() + 1) / 7)
    idxTerakhir.set(`${dt.getUTCFullYear()}-${pekan}`, i)
  })
  return [...idxTerakhir.values()].sort((a, b) => a - b)
}

export function RotasiTab() {
  const { theme } = useTheme()
  const [uni, setUni] = useState<UniverseSektor | null | undefined>(undefined)
  const [ihsg, setIhsg] = useState<BarHarga[] | null>(null)
  const [n, setN] = useState(8)

  useEffect(() => {
    let batal = false
    muatUniverseSektor().then((u) => { if (!batal) setUni(u) })
    muatOhlcv('IHSG').then((d) => { if (!batal) setIhsg(d) })
    return () => { batal = true }
  }, [])

  const sektorList = useMemo(() => (uni ? Object.keys(uni.perSektor).sort() : []), [uni])

  const trail = useMemo(() => {
    if (!uni || !ihsg || !ihsg.length) return null
    const kalender = ihsg.map((b) => b.t)
    const pekanIdx = tandaMingguan(kalender).slice(-40)
    const ihsgW = pekanIdx.map((i) => ihsg[i].c)
    const hasil: Record<string, { rsRatio: number; rsMomentum: number }[]> = {}
    for (const s of sektorList) {
      const kand = uni.perSektor[s]
      const level = levelSektor(kand, uni.bars, kalender)
      const levelW = pekanIdx.map((i) => level[i])
      const rs = levelW.map((v, i) => (100 * v) / ihsgW[i])
      const { rsRatio, rsMomentum } = rsRatioMomentum(rs, n)
      hasil[s] = rsRatio.map((r, i) => ({ rsRatio: r, rsMomentum: rsMomentum[i] })).slice(-TRAIL)
    }
    return hasil
  }, [uni, ihsg, sektorList, n])

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!trail) return null
    const abu = bacaTokenTema('--text2'), garis = bacaTokenTema('--line2')
    const quadran: Plugin<'line'> = {
      id: 'quadran',
      beforeDraw(chart) {
        const { ctx, chartArea, scales } = chart
        if (!chartArea) return
        const x100 = scales.x.getPixelForValue(100), y100 = scales.y.getPixelForValue(100)
        ctx.save()
        ctx.strokeStyle = garis; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x100, chartArea.top); ctx.lineTo(x100, chartArea.bottom)
        ctx.moveTo(chartArea.left, y100); ctx.lineTo(chartArea.right, y100); ctx.stroke()
        ctx.restore()
      },
    }
    return {
      type: 'line',
      data: {
        datasets: sektorList.map((s, i) => ({
          label: s,
          data: trail[s].map((p) => ({ x: p.rsRatio, y: p.rsMomentum })),
          borderColor: bacaTokenTema(TOKEN_SERI[i % TOKEN_SERI.length]),
          backgroundColor: bacaTokenTema(TOKEN_SERI[i % TOKEN_SERI.length]),
          showLine: true, borderWidth: 1.3,
          pointRadius: trail[s].map((_, j) => (j === trail[s].length - 1 ? 5 : 2)),
        })),
      },
      plugins: [quadran],
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: abu, boxWidth: 10, font: { size: 9 } } } },
        scales: {
          x: { type: 'linear', title: { display: true, text: 'RS-Ratio →', color: abu }, ticks: { color: abu } },
          y: { type: 'linear', title: { display: true, text: 'RS-Momentum →', color: abu }, ticks: { color: abu } },
        },
      },
    }
  }, [trail, sektorList, theme])
  const ref = useChartCanvas(config)

  if (uni === undefined) return <Kosong>Memuat sampel sektor…</Kosong>
  if (!uni) return <Kosong>Data screener untuk membangun sampel sektor belum tersedia.</Kosong>

  return (
    <section className="panel panel-b">
      <h2>Rotation Chart — sektor IDX-IC vs IHSG</h2>
      <p className="np-sub">
        Sumbu X: RS-Ratio (kekuatan relatif), Y: RS-Momentum. Jejak {TRAIL} pekan terakhir, titik besar = pekan terbaru.
      </p>
      <div className="np-baris">
        <span className="np-lbl">Jendela z-score (pekan)</span>
        {OPSI_N.map((p) => (
          <button key={p} type="button" className={'chip-t' + (n === p ? ' on' : '')} onClick={() => setN(p)}>{p}</button>
        ))}
      </div>
      <div className="chart-wrap" style={{ height: 440, marginTop: 10 }}><canvas ref={ref} /></div>
      <div className="np-peringatan">
        Perkiraan PAPAN, bukan RRG/JdK bersertifikat: tiap sektor diwakili {uni.perSektorJumlah} emiten paling likuid
        (dari sampel yang sama dipakai Screener), bukan seluruh anggota sektor — mengunduh riwayat harga seluruh
        pasar di peramban tidak masuk akal. RS-Ratio/RS-Momentum = z-score bergerak, bukan rumus JdK resmi.
      </div>
      <Sumber>Harga mingguan sampel emiten per sektor (IDX-IC) dibandingkan IHSG, dari arsip harga Stockbit.</Sumber>
    </section>
  )
}
