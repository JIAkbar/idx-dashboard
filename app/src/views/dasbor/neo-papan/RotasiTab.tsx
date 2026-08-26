import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TombolLayarPenuh } from '../../../components/dasbor/TombolLayarPenuh'
import { Chart as ChartJS } from 'chart.js/auto'
import { KODE_SEKTOR_EN } from '../../../lib/dasbor/sektorIdx'
import type { ChartConfiguration, Plugin, ScriptableLineSegmentContext } from 'chart.js/auto'
import { useChartCanvas, bacaTokenTema } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { muatOhlcv, type BarHarga } from '../../../lib/dasbor/neoPapanData'
import {
  RRG_DEFAULT, domainSimetris, kuadranRrg, rsRatioMomentumV2, warmUpRrg,
} from '../../../lib/dasbor/neoPapan'
import { muatUniverseSektor, type UniverseSektor } from './kandidat'
import { TOKEN_SERI, Kosong, Sumber } from './bersama'
import { PemilihRentang } from '../../../components/dasbor/PemilihRentang'

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
/** Kode PILL per sektor = akhiran indeks sektoral IDX-IC RESMI (IDXFINANCE
 *  dst - daftar terverifikasi di ChartIndeks TV_GROUPS.sektoral). Nama penuh
 *  Bahasa Indonesia terlalu panjang untuk pill di plot ("Barang Konsumen
 *  Non-Primer") dan itulah sebagian "benang kusut" yang Johan lihat. */
const KODE_SEKTOR = KODE_SEKTOR_EN
const OPSI_JEJAK = [4, 6, 8] as const
const TRAIL_MAKS = 8
const MAX_N = Math.max(...OPSI_N)
/** Lebar fetch pekan: warm-up kompoun (TERMASUK EMA — koreksi atas §1.3
 *  spek yang menulis 3n-2) + ekor + penyangga. Hardcode -40 lama membuat
 *  n=12 nyaris kosong. */
const LEBAR_PEKAN = warmUpRrg(MAX_N, RRG_DEFAULT.smoothLen) + TRAIL_MAKS + 5

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
  /** Panjang jejak (pekan). Bawaan 4 - 6 terukur jadi benang kusut di 11
   *  sektor (Johan 27 Agu); yang butuh riwayat lebih tinggal menaikkan. */
  const [jejak, setJejak] = useState<number>(4)
  /** Sektor yang sedang di-hover (kanvas ATAU legenda) - jejak lain redup.
   *  Ref, bukan state: hover cuma memicu update('none') chart. */
  const sorotRef = useRef<string | null>(null)
  const [sembunyiAbnormal, setSembunyiAbnormal] = useState(true)
  /** Legenda HTML (bukan legenda Chart.js) — sektor yang dimatikan klik. */
  const [sektorMati, setSektorMati] = useState<ReadonlySet<string>>(new Set())
  /** Sektor yang daftar emitennya sedang dibuka (klik nama di legenda). */
  const [sektorPilih, setSektorPilih] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const [layarPenuh, setLayarPenuh] = useState(false)
  useEffect(() => {
    const h = () => setLayarPenuh(document.fullscreenElement === panelRef.current)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

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
      hasil[s] = valid.slice(-jejak)
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
  }, [uni, ihsg, sektorList, n, sembunyiAbnormal, jejak])

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
    return daftar.filter((s) => !sektorMati.has(s))
  }, [trail, sektorList, likuidSaja, sembunyiLemah, sektorMati])

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
        const { ctx, chartArea } = chart
        const sorot = sorotRef.current
        ctx.save()
        ctx.font = '600 10px system-ui, sans-serif'
        // Kumpulkan pill dulu, DODGE anti-tumpuk (pola pitaCprChart: titik
        // data tetap di tempatnya, hanya label yang digeser vertikal), baru
        // gambar - 11 pill saling tindih = keluhan "gak rapi" Johan.
        const TINGGI = 15
        interface Pill { teks: string; x: number; y: number; lebar: number; warna: string; redup: boolean }
        const pills: Pill[] = []
        chart.data.datasets.forEach((ds, di) => {
          const meta = chart.getDatasetMeta(di)
          if (meta.hidden || !meta.data.length) return
          const akhir = meta.data[meta.data.length - 1]
          const sebelum = meta.data.length > 1 ? meta.data[meta.data.length - 2] : null
          const namaSektor = String(ds.label ?? '')
          const redup = sorot !== null && sorot !== namaSektor
          const warna = String(ds.borderColor)
          if (sebelum) {
            const sudut = Math.atan2(akhir.y - sebelum.y, akhir.x - sebelum.x)
            ctx.globalAlpha = redup ? 0.18 : 1
            ctx.fillStyle = warna
            ctx.translate(akhir.x, akhir.y)
            ctx.rotate(sudut)
            ctx.beginPath()
            ctx.moveTo(10, 0); ctx.lineTo(3, -3.6); ctx.lineTo(3, 3.6)
            ctx.closePath(); ctx.fill()
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.globalAlpha = 1
          }
          const teks = KODE_SEKTOR[namaSektor] ?? namaSektor
          const lebar = ctx.measureText(teks).width + 10
          // Pill selalu menghadap KE DALAM plot: titik di paruh kanan diberi
          // pill di KIRI titiknya (gaya RRG standar) — titik dekat tepi tak
          // pernah mendorong labelnya keluar area gambar.
          const tengah = chartArea ? (chartArea.left + chartArea.right) / 2 : 0
          let x = akhir.x > tengah ? akhir.x - 12 - lebar : akhir.x + 12
          if (chartArea) x = Math.max(chartArea.left + 2, Math.min(x, chartArea.right - lebar - 4))
          pills.push({ teks, x, y: akhir.y - TINGGI / 2, lebar, warna, redup })
        })
        // dodge vertikal: urut y, geser turun bila menimpa pill di atasnya
        pills.sort((a, b) => a.y - b.y)
        for (let i = 1; i < pills.length; i++) {
          const atas = pills[i - 1]
          const ini = pills[i]
          const tumpuk = ini.y < atas.y + TINGGI + 2 &&
            ini.x < atas.x + atas.lebar + 4 && atas.x < ini.x + ini.lebar + 4
          if (tumpuk) ini.y = atas.y + TINGGI + 2
        }
        if (import.meta.env.DEV) {
          ;(window as Window & { __rrgPills?: unknown }).__rrgPills =
            pills.map((q) => ({ t: q.teks, x: Math.round(q.x), u: Math.round(q.x + q.lebar) }))
        }
        for (const pl of pills) {
          ctx.globalAlpha = pl.redup ? 0.18 : 1
          ctx.fillStyle = pl.warna
          ctx.beginPath()
          ctx.roundRect(pl.x, pl.y, pl.lebar, TINGGI, TINGGI / 2)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(pl.teks, pl.x + 5, pl.y + TINGGI / 2)
          ctx.globalAlpha = 1
        }
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
                let f = 0.15 + 0.85 * (c.p1DataIndex / Math.max(1, ekor.length - 1))
                // Hover meredupkan jejak LAIN (spek 27 Agu) - data tak
                // dibuang, cuma diberi panggung.
                const sorot = sorotRef.current
                if (sorot !== null && sorot !== s) f *= 0.14
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
        onHover: (e, _el, chart) => {
          // Sorot sektor terdekat kursor; jejak lain diredupkan lewat
          // sorotRef (update 'none' - tanpa animasi, tanpa render React).
          const el = chart.getElementsAtEventForMode(e as unknown as Event, 'nearest', { intersect: false }, true)
          const baru = el.length ? tampilList[el[0].datasetIndex] ?? null : null
          if (sorotRef.current !== baru) {
            sorotRef.current = baru
            chart.update('none')
          }
        },
        plugins: {
          // Legenda pindah ke HTML di samping kanvas (ala panel Bloomberg) —
          // sekaligus membuat ukuran plot bisa PRESISI: plot = kanvas −
          // sumbu yang lebarnya DIKUNCI afterFit, tanpa legenda yang lebarnya
          // berubah-ubah ikut panjang teks.
          legend: { display: false },
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
            // Tinggi sumbu DIKUNCI supaya plot = kanvas − angka tetap —
            // syarat lebar==tinggi plot yang presisi ("kotak", Johan 26 Agu).
            afterFit: (s) => { s.height = 52 },
          },
          y: {
            type: 'linear', min: dom.min, max: dom.max,
            title: { display: true, text: 'RS-Momentum →', color: abu },
            ticks: { color: abu, stepSize: 3 },
            grid: { color: garis },
            afterFit: (s) => { s.width = 60 },
          },
        },
      },
    }
  }, [trail, tampilList, sektorList, theme])
  const ref = useChartCanvas(config)
  // Instance chart via registry resmi Chart.js (hook tak mengeksposnya) —
  // dipakai hover legenda untuk memicu redraw redup/pekat.
  const chartAktif = () => (ref.current ? ChartJS.getChart(ref.current) : undefined)
  useEffect(() => {
    // Hook QA dev-only (pola __papanChart TransaksiTab) — uji pill/dodge.
    if (import.meta.env.DEV && ref.current) {
      (ref.current as HTMLCanvasElement & { __papanChart?: unknown }).__papanChart = chartAktif()
    }
  })

  if (uni === undefined) return <Kosong>Memuat sampel sektor…</Kosong>
  if (!uni) return <Kosong>Data screener untuk membangun sampel sektor belum tersedia.</Kosong>

  const barTerakhir = ihsg?.length ? ihsg[ihsg.length - 1].t : '—'

  return (
    <section className="panel panel-b np-rrg-panel" ref={panelRef}>
      <div className="np-rrg-kepala">
        <h2>Rotation Chart — sektor IDX-IC vs IHSG</h2>
        <TombolLayarPenuh target={panelRef} aktif={layarPenuh} />
      </div>
      <p className="np-sub">
        X: RS-Ratio (kekuatan relatif) · Y: RS-Momentum (laju perubahannya). Jejak {jejak} pekan,
        titik besar + panah = pekan terbaru. Acuan: IHSG · data s.d. {barTerakhir}.
        {' '}Posisi rotasi historis, bukan rekomendasi beli/jual.
      </p>
      <div className="np-baris">
        <span className="np-lbl">Periode (pekan)</span>
        {/* Kendali rentang kanonis #170 — bukan chip lepas (Johan: "kan sudah
            ada SOP nya"). */}
        <PemilihRentang
          opsi={OPSI_N.map((p) => ({ id: String(p), label: `${p} pekan` }))}
          nilai={String(n)}
          onGanti={(id) => setN(Number(id))}
        />
        <span className="np-lbl" style={{ marginLeft: 8 }}>Jejak</span>
        <PemilihRentang
          opsi={OPSI_JEJAK.map((j) => ({ id: String(j), label: `${j} pekan` }))}
          nilai={String(jejak)}
          onGanti={(id) => setJejak(Number(id))}
          ariaLabel="Panjang jejak"
        />
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
      {/* Plot PRESISI bujursangkar (Johan: "lebar tinggi besar nya presisi"):
          sumbu dikunci afterFit (y=60, x=52) dan legenda di luar kanvas,
          jadi plot = (540−60) × (532−52) = 480 × 480 persis. */}
      <div className="np-rrg-panggung">
        <div className="chart-wrap np-rrg-wrap"><canvas ref={ref} /></div>
        <div className="np-rrg-legenda">
          {sektorList.map((s) => {
            const warna = bacaTokenTema(TOKEN_SERI[sektorList.indexOf(s) % TOKEN_SERI.length])
            const mati = sektorMati.has(s)
            return (
              <div key={s} className={'np-rrg-item' + (mati ? ' mati' : '') + (sektorPilih === s ? ' pilih' : '')}
                onMouseEnter={() => { sorotRef.current = s; chartAktif()?.update('none') }}
                onMouseLeave={() => { sorotRef.current = null; chartAktif()?.update('none') }}>
                <button type="button" className="np-rrg-swatch" style={{ background: warna }}
                  title={mati ? 'Tampilkan jejaknya lagi' : 'Sembunyikan jejaknya'}
                  aria-label={`${mati ? 'Tampilkan' : 'Sembunyikan'} ${s}`}
                  onClick={() => setSektorMati((m) => {
                    const b = new Set(m)
                    if (b.has(s)) b.delete(s)
                    else b.add(s)
                    return b
                  })} />
                <button type="button" className="np-rrg-nama"
                  title="Lihat emiten sampel sektor ini"
                  onClick={() => setSektorPilih((v) => (v === s ? null : s))}>
                  {s}
                </button>
              </div>
            )
          })}
          {sektorPilih && uni.perSektor[sektorPilih] && (
            <div className="np-rrg-emiten">
              <div className="np-rrg-emiten-judul">{sektorPilih} — emiten sampel</div>
              {uni.perSektor[sektorPilih].map((k) => (
                <a key={k} className="np-rrg-kode" href={`/grafik?kode=${k}`}>{k}</a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="np-peringatan">
        Sektor dihitung dari agregat sampel {uni.perSektorJumlah} emiten paling likuid per sektor
        (tertimbang kapitalisasi), bukan indeks resmi IDX. RS-Ratio/RS-Momentum memakai normalisasi
        z-score atas laju perubahan — sekeluarga dengan RRG, bukan rumus JdK berlisensi.
      </div>
      <Sumber>Harga mingguan sampel emiten per sektor (IDX-IC) dibandingkan IHSG, dari arsip harga.</Sumber>
    </section>
  )
}
