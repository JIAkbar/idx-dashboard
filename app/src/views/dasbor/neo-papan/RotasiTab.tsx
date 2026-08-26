import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChartConfiguration, Plugin, ScriptableLineSegmentContext } from 'chart.js/auto'
import { useChartCanvas, bacaTokenTema } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { muatOhlcv, type BarHarga } from '../../../lib/dasbor/neoPapanData'
import {
  RRG_DEFAULT, domainSimetris, kuadranRrg, rsRatioMomentumV2, warmUpRrg,
} from '../../../lib/dasbor/neoPapan'
import { muatUniverseSektor, type UniverseSektor } from './kandidat'
import { TOKEN_SERI, Kosong, Sumber } from './bersama'

/**
 * Rotation Chart (RRG) — revisi total `spek_neo_papan_revisi.md` §1.
 *
 * Rumus lama (`rsRatioMomentum`) cacat struktural: momentum = z-score LEVEL
 * rsRatio → titik jatuh di diagonal, rotasi tak pernah terbentuk. Sekarang
 * `rsRatioMomentumV2` (momentum = z-score LAJU-PERUBAHAN RS-Ratio, RS
 * dihaluskan EMA, SD sampel, warm-up jujur null). Titik null TIDAK dirender —
 * memang belum valid, bukan disembunyikan.
 */

const OPSI_N = [4, 8, 12]
const TRAIL = 6
const MAX_N = Math.max(...OPSI_N)
/** Lebar fetch pekan: warm-up kompoun (TERMASUK EMA — koreksi atas §1.3
 *  spek yang menulis 3n-2) + ekor + penyangga. Hardcode -40 lama membuat
 *  n=12 nyaris kosong. */
const LEBAR_PEKAN = warmUpRrg(MAX_N, RRG_DEFAULT.smoothLen) + TRAIL + 5

/**
 * Level sektor TERTIMBANG KAPITALISASI (harga × saham beredar, dirantai per
 * hari) — mendekati metodologi indeks resmi (bukan free-float sungguhan;
 * spek §1.6). Bobot dari kapitalisasi hari SEBELUMNYA supaya return hari ini
 * tak menimbang dirinya sendiri.
 */
function levelSektor(kandidat: string[], bars: Map<string, BarHarga[]>, kalender: string[]): number[] {
  const byKode = kandidat.map((k) => new Map((bars.get(k) ?? []).map((b) => [b.t, b])))
  const level: number[] = []
  let x = 100
  for (let i = 0; i < kalender.length; i++) {
    if (i > 0) {
      let bobotTotal = 0
      let retTertimbang = 0
      for (const m of byKode) {
        const cur = m.get(kalender[i])
        const prev = m.get(kalender[i - 1])
        if (!cur || !prev || !prev.c) continue
        const cap = prev.c * (prev.so || 1)
        bobotTotal += cap
        retTertimbang += cap * (cur.c / prev.c - 1)
      }
      if (bobotTotal > 0) x *= 1 + retTertimbang / bobotTotal
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

interface TitikEkor { x: number; y: number; t: string }

export function RotasiTab() {
  const { theme } = useTheme()
  const [uni, setUni] = useState<UniverseSektor | null | undefined>(undefined)
  const [ihsg, setIhsg] = useState<BarHarga[] | null>(null)
  const [n, setN] = useState(RRG_DEFAULT.n)
  const [likuidSaja, setLikuidSaja] = useState(false)
  const [sembunyiLemah, setSembunyiLemah] = useState(false)
  const [sembunyiAbnormal, setSembunyiAbnormal] = useState(true)

  const muat = useCallback((segar: boolean) => {
    let batal = false
    muatUniverseSektor(segar).then((u) => { if (!batal) setUni(u) })
    muatOhlcv('IHSG').then((d) => { if (!batal) setIhsg(d) })
    return () => { batal = true }
  }, [])
  useEffect(() => muat(false), [muat])

  // Kunci '-' = emiten yang screener-nya tak menyebut sektor — bukan sektor
  // sungguhan, jangan digambar sebagai entitas.
  const sektorList = useMemo(
    () => (uni ? Object.keys(uni.perSektor).filter((s) => s && s !== '-').sort() : []),
    [uni],
  )

  const trail = useMemo(() => {
    if (!uni || !ihsg || !ihsg.length) return null
    const kalender = ihsg.map((b) => b.t)
    // Fetch window DINAMIS dari warm-up terbesar — bukan -40 hardcode (§1.3).
    const pekanIdx = tandaMingguan(kalender).slice(-LEBAR_PEKAN)
    const ihsgW = pekanIdx.map((i) => ihsg[i].c)
    const hasil: Record<string, TitikEkor[]> = {}
    const likuiditas: Record<string, number> = {}
    for (const s of sektorList) {
      const kand = uni.perSektor[s]
      const level = levelSektor(kand, uni.bars, kalender)
      const rs = pekanIdx.map((i, w) => (100 * level[i]) / ihsgW[w])
      const titik = rsRatioMomentumV2(rs, { ...RRG_DEFAULT, n })
      const valid: TitikEkor[] = []
      titik.forEach((p, i) => {
        if (p.rsRatio == null || p.rsMomentum == null) return
        if (sembunyiAbnormal && Math.abs(p.rsRatio - 100) > 15) return
        valid.push({ x: p.rsRatio, y: p.rsMomentum, t: kalender[pekanIdx[i]] })
      })
      hasil[s] = valid.slice(-TRAIL)
      // Likuiditas sektor: median nilai transaksi harian sampel 20 hari terakhir.
      const nilaiHarian = new Map<string, number>()
      for (const k of kand) {
        for (const b of (uni.bars.get(k) ?? []).slice(-20)) {
          nilaiHarian.set(b.t, (nilaiHarian.get(b.t) ?? 0) + b.val)
        }
      }
      const urut = [...nilaiHarian.values()].sort((a, b) => a - b)
      likuiditas[s] = urut.length ? urut[Math.floor(urut.length / 2)] : 0
    }
    return { hasil, likuiditas }
  }, [uni, ihsg, sektorList, n, sembunyiAbnormal])

  const tampilList = useMemo(() => {
    if (!trail) return []
    let daftar = sektorList.filter((s) => trail.hasil[s].length > 0)
    if (likuidSaja) {
      const nilai = daftar.map((s) => trail.likuiditas[s]).sort((a, b) => a - b)
      const q1 = nilai[Math.floor(nilai.length / 4)] ?? 0
      daftar = daftar.filter((s) => trail.likuiditas[s] >= q1)
    }
    if (sembunyiLemah) {
      daftar = daftar.filter((s) => {
        const e = trail.hasil[s]
        return e[e.length - 1].x >= 97
      })
    }
    return daftar
  }, [trail, sektorList, likuidSaja, sembunyiLemah])

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!trail) return null
    const abu = bacaTokenTema('--text2')
    const garis = bacaTokenTema('--line2')
    const semuaNilai: number[] = []
    for (const s of tampilList) for (const p of trail.hasil[s]) semuaNilai.push(p.x, p.y)
    // Domain simetris X=Y (§1.4.4) — kuadran selalu bujursangkar, sudut
    // rotasi tak terdistorsi.
    const dom = domainSimetris(semuaNilai)
    const warnaSektor = (i: number) => bacaTokenTema(TOKEN_SERI[i % TOKEN_SERI.length])

    const KUADRAN = [
      { x: 'kiri', y: 'atas', label: 'IMPROVING', warna: 'rgba(64, 128, 235, 0.06)', teks: 'rgba(96, 148, 235, 0.75)' },
      { x: 'kanan', y: 'atas', label: 'OUTPERFORM', warna: 'rgba(48, 164, 108, 0.06)', teks: 'rgba(64, 180, 124, 0.75)' },
      { x: 'kanan', y: 'bawah', label: 'WEAKENING', warna: 'rgba(226, 163, 54, 0.06)', teks: 'rgba(226, 170, 70, 0.75)' },
      { x: 'kiri', y: 'bawah', label: 'UNDERPERFORM', warna: 'rgba(229, 72, 77, 0.06)', teks: 'rgba(229, 96, 100, 0.75)' },
    ] as const

    const quadran: Plugin<'line'> = {
      id: 'quadran',
      beforeDraw(chart) {
        const { ctx, chartArea, scales } = chart
        if (!chartArea) return
        const x100 = scales.x.getPixelForValue(100)
        const y100 = scales.y.getPixelForValue(100)
        ctx.save()
        // 1. tint kuadran + label pojok
        ctx.font = '600 10px system-ui, sans-serif'
        for (const k of KUADRAN) {
          const x0 = k.x === 'kiri' ? chartArea.left : x100
          const x1 = k.x === 'kiri' ? x100 : chartArea.right
          const y0 = k.y === 'atas' ? chartArea.top : y100
          const y1 = k.y === 'atas' ? y100 : chartArea.bottom
          ctx.fillStyle = k.warna
          ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
          ctx.fillStyle = k.teks
          ctx.textAlign = k.x === 'kiri' ? 'left' : 'right'
          ctx.textBaseline = k.y === 'atas' ? 'top' : 'bottom'
          ctx.fillText(k.label, k.x === 'kiri' ? x0 + 6 : x1 - 6, k.y === 'atas' ? y0 + 5 : y1 - 5)
        }
        // 2. garis silang 100/100 putus-putus (di atas tint, di bawah data)
        ctx.strokeStyle = garis
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(x100, chartArea.top); ctx.lineTo(x100, chartArea.bottom)
        ctx.moveTo(chartArea.left, y100); ctx.lineTo(chartArea.right, y100)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()
      },
      afterDatasetsDraw(chart) {
        // 6-7. label pill + panah arah di titik terkini tiap sektor tampil.
        const { ctx } = chart
        ctx.save()
        ctx.font = '600 10px system-ui, sans-serif'
        chart.data.datasets.forEach((ds, di) => {
          const meta = chart.getDatasetMeta(di)
          if (meta.hidden || !meta.data.length) return
          const akhir = meta.data[meta.data.length - 1]
          const sebelum = meta.data.length > 1 ? meta.data[meta.data.length - 2] : null
          const warna = String(ds.borderColor)
          // panah arah dari vektor (terkini − sebelumnya) — enhancement
          if (sebelum) {
            const sudut = Math.atan2(akhir.y - sebelum.y, akhir.x - sebelum.x)
            ctx.fillStyle = warna
            ctx.translate(akhir.x, akhir.y)
            ctx.rotate(sudut)
            ctx.beginPath()
            ctx.moveTo(10, 0); ctx.lineTo(3, -3.6); ctx.lineTo(3, 3.6)
            ctx.closePath(); ctx.fill()
            ctx.setTransform(1, 0, 0, 1, 0, 0)
          }
          // pill kode di samping titik terkini
          const teks = String(ds.label ?? '')
          const lebar = ctx.measureText(teks).width + 10
          const px = akhir.x + 12
          const py = akhir.y - 8
          ctx.fillStyle = warna
          ctx.beginPath()
          ctx.roundRect(px, py, lebar, 15, 7.5)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(teks, px + 5, py + 7.5)
        })
        ctx.restore()
      },
    }

    return {
      type: 'line',
      data: {
        datasets: tampilList.map((s) => {
          const ekor = trail.hasil[s]
          const warna = warnaSektor(sektorList.indexOf(s))
          return {
            label: s,
            data: ekor.map((p) => ({ x: p.x, y: p.y })),
            borderColor: warna,
            backgroundColor: warna,
            showLine: true,
            borderWidth: 1.6,
            // 5. ekor gradasi: segmen tertua pudar → terkini pekat
            segment: {
              borderColor: (c: ScriptableLineSegmentContext) => {
                const f = 0.15 + 0.85 * (c.p1DataIndex / Math.max(1, ekor.length - 1))
                const alpha = Math.round(f * 255).toString(16).padStart(2, '0')
                return warna.length === 7 ? `${warna}${alpha}` : warna
              },
            },
            pointRadius: ekor.map((_, j) => (j === ekor.length - 1 ? 5 : 2.4)),
            pointBorderWidth: 0,
          }
        }),
      },
      plugins: [quadran],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 1,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: abu, boxWidth: 10, font: { size: 10 } },
          },
          tooltip: {
            callbacks: {
              label: (c) => {
                const s = tampilList[c.datasetIndex]
                const p = trail.hasil[s][c.dataIndex]
                return `${s} · ${p.t} · R ${p.x.toFixed(2)} / M ${p.y.toFixed(2)} · ${kuadranRrg(p.x, p.y)}`
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear', min: dom.min, max: dom.max,
            title: { display: true, text: 'RS-Ratio →', color: abu },
            ticks: { color: abu, stepSize: 3 },
            grid: { color: garis },
          },
          y: {
            type: 'linear', min: dom.min, max: dom.max,
            title: { display: true, text: 'RS-Momentum →', color: abu },
            ticks: { color: abu, stepSize: 3 },
            grid: { color: garis },
          },
        },
      },
    }
  }, [trail, tampilList, sektorList, theme])
  const ref = useChartCanvas(config)

  if (uni === undefined) return <Kosong>Memuat sampel sektor…</Kosong>
  if (!uni) return <Kosong>Data screener untuk membangun sampel sektor belum tersedia.</Kosong>

  const barTerakhir = ihsg?.length ? ihsg[ihsg.length - 1].t : '—'

  return (
    <section className="panel panel-b">
      <h2>Rotation Chart — sektor IDX-IC vs IHSG</h2>
      <p className="np-sub">
        X: RS-Ratio (kekuatan relatif) · Y: RS-Momentum (laju perubahannya). Jejak {TRAIL} pekan,
        titik besar + panah = pekan terbaru. Acuan: IHSG · data s.d. {barTerakhir}.
        {' '}Posisi rotasi historis, bukan rekomendasi beli/jual.
      </p>
      <div className="np-baris">
        <span className="np-lbl">Periode (pekan)</span>
        {OPSI_N.map((p) => (
          <button key={p} type="button" className={'chip-t' + (n === p ? ' on' : '')} onClick={() => setN(p)}>{p}</button>
        ))}
        <button type="button" className={'chip-t' + (likuidSaja ? ' on' : '')}
          title="Sembunyikan sektor dengan median nilai transaksi sampel 20 hari di kuartil bawah"
          onClick={() => setLikuidSaja((v) => !v)}>Liquid Only</button>
        <button type="button" className={'chip-t' + (sembunyiLemah ? ' on' : '')}
          title="Sembunyikan sektor dengan RS-Ratio terkini di bawah 97"
          onClick={() => setSembunyiLemah((v) => !v)}>Hide Weak</button>
        <button type="button" className={'chip-t' + (sembunyiAbnormal ? ' on' : '')}
          title="Buang titik belum-valid (warm-up/gap) dan |RS-Ratio − 100| > 15"
          onClick={() => setSembunyiAbnormal((v) => !v)}>Hide Abnormal</button>
        <button type="button" className="chip-t" title="Muat ulang data terbaru"
          onClick={() => { setUni(undefined); muat(true) }}>↻</button>
      </div>
      {/* Kontainer rasio 1:1 (lebar = tinggi) menjaga kuadran bujursangkar —
          domain X=Y saja belum cukup kalau kanvasnya lonjong. */}
      <div className="chart-wrap np-rrg-wrap" style={{ height: 540, marginTop: 10 }}><canvas ref={ref} /></div>
      <div className="np-peringatan">
        Sektor dihitung dari agregat sampel {uni.perSektorJumlah} emiten paling likuid per sektor
        (tertimbang kapitalisasi), bukan indeks resmi IDX. RS-Ratio/RS-Momentum memakai normalisasi
        z-score atas laju perubahan — sekeluarga dengan RRG, bukan rumus JdK berlisensi.
      </div>
      <Sumber>Harga mingguan sampel emiten per sektor (IDX-IC) dibandingkan IHSG, dari arsip harga.</Sumber>
    </section>
  )
}
