import { useEffect, useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useChartCanvas, bacaTokenTema } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import type { BarHarga } from '../../../lib/dasbor/neoPapanData'
import { porsiBergerak } from '../../../lib/dasbor/neoPapan'
import { muatUniverseSektor, type UniverseSektor } from './kandidat'
import { TOKEN_SERI, Kosong, Sumber } from './bersama'

const HARI_TAMPIL = 180

/** Nilai transaksi harian tiap kandidat, per tanggal (map bersama seluruh kandidat). */
function nilaiPerTanggal(kand: string[], bars: Map<string, BarHarga[]>): Map<string, number>[] {
  return kand.map((k) => new Map((bars.get(k) ?? []).map((b) => [b.t, b.val])))
}

export function ActivityTab() {
  const { theme } = useTheme()
  const [uni, setUni] = useState<UniverseSektor | null | undefined>(undefined)
  const [jenis, setJenis] = useState<'sektor' | 'indeks'>('sektor')

  useEffect(() => {
    let batal = false
    muatUniverseSektor().then((u) => { if (!batal) setUni(u) })
    return () => { batal = true }
  }, [])

  const kalender = useMemo(() => {
    if (!uni) return []
    const set = new Set<string>()
    for (const b of uni.bars.values()) for (const bar of b) set.add(bar.t)
    return [...set].sort().slice(-HARI_TAMPIL)
  }, [uni])

  const grup = useMemo(() => {
    if (!uni) return {} as Record<string, string[]>
    if (jenis === 'sektor') return uni.perSektor
    const g: Record<string, string[]> = {}
    for (const [kode, idxs] of uni.indeks) for (const ix of idxs) (g[ix] ??= []).push(kode)
    return g
  }, [uni, jenis])

  const seri = useMemo(() => {
    if (!uni || !kalender.length) return null
    const nama = Object.keys(grup).sort()
    const semuaMap = [...uni.bars.values()].map((b) => new Map(b.map((x) => [x.t, x.val])))
    const totalPerHari = kalender.map((t) => semuaMap.reduce((a, m) => a + (m.get(t) ?? 0), 0))
    return nama.map((g) => {
      const map = nilaiPerTanggal(grup[g], uni.bars)
      const nilaiGrup = kalender.map((t) => map.reduce((a, m) => a + (m.get(t) ?? 0), 0))
      return { nama: g, share: porsiBergerak(nilaiGrup, totalPerHari, 20) }
    })
  }, [uni, grup, kalender])

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!seri) return null
    const abu = bacaTokenTema('--text2')
    return {
      type: 'line',
      data: {
        labels: kalender,
        datasets: seri.map((s, i) => ({
          label: s.nama, data: s.share.map((v) => v * 100),
          borderColor: bacaTokenTema(TOKEN_SERI[i % TOKEN_SERI.length]),
          borderWidth: 1.5, pointRadius: 0, tension: 0.15,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { color: abu, boxWidth: 10, font: { size: 9 } } } },
        scales: {
          x: { ticks: { color: abu, maxTicksLimit: 10 }, grid: { display: false } },
          y: { min: 0, ticks: { color: abu, callback: (v) => v + '%' }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }
  }, [seri, kalender, theme])
  const ref = useChartCanvas(config)

  if (uni === undefined) return <Kosong>Memuat sampel…</Kosong>
  if (!uni) return <Kosong>Data screener untuk membangun sampel belum tersedia.</Kosong>

  return (
    <section className="panel panel-b">
      <h2>{jenis === 'sektor' ? 'Sector' : 'Index'} Activity</h2>
      <p className="np-sub">Porsi nilai transaksi kelompok terhadap sampel, rata-rata bergerak 20 hari bursa.</p>
      <div className="np-baris">
        <button type="button" className={'chip-t' + (jenis === 'sektor' ? ' on' : '')} onClick={() => setJenis('sektor')}>Sektor IDX-IC</button>
        <button type="button" className={'chip-t' + (jenis === 'indeks' ? ' on' : '')} onClick={() => setJenis('indeks')}>Indeks</button>
      </div>
      <div className="chart-wrap" style={{ height: 420, marginTop: 10 }}><canvas ref={ref} /></div>
      <div className="np-peringatan">
        Definisi PAPAN sendiri: porsi dihitung terhadap SAMPEL emiten paling likuid
        (yang sama dipakai Rotation Chart, {uni.perSektorJumlah} per sektor) — bukan terhadap seluruh nilai
        transaksi pasar, karena itu butuh riwayat harga seluruh emiten yang tidak diunduh di peramban.
      </div>
      <Sumber>Nilai transaksi harian sampel emiten dari arsip harga Stockbit, dikelompokkan per sektor IDX-IC atau keanggotaan indeks.</Sumber>
    </section>
  )
}
