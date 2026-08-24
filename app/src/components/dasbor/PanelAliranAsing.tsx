import { useMemo, useRef, useState } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useStockAsing, type AsingHarian } from '../../lib/dasbor/stockDetailData'
import { fRingkas, fv } from '../../lib/dasbor/stockDetailFormat'
import { useChartCanvas } from '../../lib/dasbor/useChartJs'
import { useTheme } from '../../context/ThemeContext'
import { useOhlcvKaya } from '../../lib/dasbor/ohlcvKaya'
import { netRupiahPeriode, kumulatifRupiah, type TitikRupiah } from '../../lib/dasbor/aliranAsingRupiah'
import { tanggalPendek } from '../../lib/dasbor/statistikBerkala'
import { IkonMenu, IKON_JAM } from './IkonMenu'
import { PemilihRentang } from './PemilihRentang'
import { LabelRentang } from './LabelRentang'
import { LABEL_RENTANG } from '../../lib/dasbor/periode'

/**
 * Panel "Aliran Asing" (per-emiten) — lembar dari sumber bursa resmi (riwayat
 * sejak 2020, panen terpisah dari fundamental & masih berjalan — belum semua
 * ~989 emiten, dan riwayat yang sudah ada pun masih bertambah). Rupiah
 * SEBENARNYA (bukan taksiran) dari gudang harga kaya yang sudah dipakai
 * Grafik Emiten — beli/jual asingnya sudah dalam rupiah — dan riwayatnya jauh
 * lebih panjang (mundur ke ±2004). Bagian rupiah sebelum cakupan bursa TIDAK
 * punya pembanding sumber kedua; ditandai jujur di grafik & teks (garis
 * putus-putus + catatan), bukan disamakan begitu saja dengan bagian yang
 * sudah diverifikasi silang.
 *
 * Empat kebutuhan brief: (1) net 1/5/20 hari, (2) grafik net kumulatif —
 * arah akumulasi/distribusi, (3) konteks persentil vs sebaran 250 hari
 * terakhir emiten itu sendiri, (4) beli & jual terpisah (bukan cuma net) —
 * di kartu ringkas MAUPUN tabel 15 hari transaksi terakhir. Persentil tetap
 * berbasis lembar (bursa) — riwayat rupiah yang lebih panjang belum
 * dipasang di situ, cuma di grafik kumulatif & kartu ringkas.
 */

// ── Kalkulasi murni (diuji PanelAliranAsing.test.ts) ──

export interface NetPeriode {
  beli: number
  jual: number
  net: number
  /** Bisa < `hari` diminta kalau riwayatnya memang lebih pendek. */
  hariTersedia: number
}

/** Net beli-jual `hari` hari bursa TERAKHIR di `d` (d terurut naik tanggal). */
export function netPeriode(d: AsingHarian[], hari: number): NetPeriode | null {
  if (d.length === 0) return null
  const slice = d.slice(-hari)
  const beli = slice.reduce((s, r) => s + r.beli, 0)
  const jual = slice.reduce((s, r) => s + r.jual, 0)
  return { beli, jual, net: beli - jual, hariTersedia: slice.length }
}

export interface PersentilNet {
  persentil: number
  n: number
  netHariIni: number
}

/**
 * Persentil net hari TERAKHIR di `d` dibanding sebarannya sendiri (net harian
 * `jendela` hari terakhir, default 250 ≈ 1 tahun bursa) — "besar/kecil"
 * cuma bermakna relatif terhadap ukuran transaksi emiten itu sendiri.
 * Persentil rank standar (titik yang seri dibagi tengah). null kalau
 * datanya kurang dari 5 hari — persentil dari <5 titik tidak bermakna.
 */
export function persentilNet(d: AsingHarian[], jendela = 250): PersentilNet | null {
  if (d.length < 5) return null
  const slice = d.slice(-jendela)
  const nets = slice.map((r) => r.beli - r.jual)
  const netHariIni = nets[nets.length - 1]
  const lebihKecil = nets.filter((v) => v < netHariIni).length
  const sama = nets.filter((v) => v === netHariIni).length
  const persentil = ((lebihKecil + sama / 2) / nets.length) * 100
  return { persentil, n: nets.length, netHariIni }
}

export interface TitikKumulatif {
  tanggal: string
  kumulatif: number
}

/** Net kumulatif (running sum, mulai dari 0) dalam rentang [mulai, akhir] —
 * arah garisnya yang dibaca (akumulasi/distribusi SELAMA jendela ini), bukan
 * totalnya sejak awal riwayat yang kurang bermakna buat emiten lama. */
export function kumulatifNet(d: AsingHarian[], mulai: string, akhir: string): TitikKumulatif[] {
  let running = 0
  return d
    .filter((r) => r.tanggal >= mulai && r.tanggal <= akhir)
    .map((r) => {
      running += r.beli - r.jual
      return { tanggal: r.tanggal, kumulatif: running }
    })
}

// ── Rentang chart — preset kalender-hari mundur, sama polanya dgn BrokerSummary.tsx ──

type PresetId = 'w1' | 'b1' | 'b3' | 'ytd' | 'semua'

const PRESET: { id: PresetId; label: string; hari: number }[] = [
  { id: 'w1', label: LABEL_RENTANG.w1, hari: 7 },
  { id: 'b1', label: LABEL_RENTANG.b1, hari: 30 },
  { id: 'b3', label: LABEL_RENTANG.b3, hari: 91 },
  { id: 'ytd', label: LABEL_RENTANG.ytd, hari: 0 },
  { id: 'semua', label: LABEL_RENTANG.semua, hari: 0 },
]

function mundurIso(iso: string, hari: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - hari)
  return d.toISOString().slice(0, 10)
}

function mulaiPreset(id: PresetId, akhir: string, mulaiData: string): string {
  if (id === 'semua') return mulaiData
  if (id === 'ytd') return `${akhir.slice(0, 4)}-01-01`
  return mundurIso(akhir, PRESET.find((x) => x.id === id)!.hari)
}

// ── Format ──

/** Net dengan tanda +/-, ringkas T/M/Jt (lembar). */
function fNet(v: number): string {
  return (v >= 0 ? '+' : '') + fRingkas(v)
}

/** Net rupiah dengan tanda +/- di depan "Rp" (fRingkas sendiri tak tahu prefiks mata uang). */
function fRp(v: number): string {
  return (v >= 0 ? '+' : '-') + 'Rp ' + fRingkas(Math.abs(v))
}

function bacaToken(el: HTMLElement | null, nama: string, fallback: string): string {
  if (!el) return fallback
  const v = getComputedStyle(el).getPropertyValue(nama).trim()
  return v || fallback
}

/** Satu sel `.rasio` — net besar berwarna + sub beli/jual terpisah (req 4).
 * `rp` = format rupiah (Stockbit); default lembar (bursa). Bentuk data
 * (`beli`/`jual`/`net`) sama di `NetPeriode` (lembar) dan `NetRupiahPeriode`
 * (rupiah), jadi satu komponen cukup untuk keduanya. */
function NetCell({ label, p, rp = false }: { label: string; p: { beli: number; jual: number; net: number } | null; rp?: boolean }) {
  const fmt = rp ? (v: number) => 'Rp ' + fRingkas(v) : fRingkas
  const fmtNet = rp ? fRp : fNet
  return (
    <div>
      <span className="lbl">{label}</span>
      <div className={`v num${p ? (p.net >= 0 ? ' up' : ' dn') : ''}`}>{p ? fmtNet(p.net) : '—'}</div>
      <span className="sub">
        {p ? `Beli ${fmt(p.beli)} · Jual ${fmt(p.jual)}` : ' '}
      </span>
    </div>
  )
}

type Metrik = 'lembar' | 'rupiah'
const METRIK_OPSI: { id: Metrik; label: string }[] = [
  { id: 'lembar', label: 'Lembar' },
  { id: 'rupiah', label: 'Rupiah' },
]

export function PanelAliranAsing({ ticker }: { ticker: string }) {
  const { data, loading } = useStockAsing(ticker)
  const stockbit = useOhlcvKaya(ticker)
  const [preset, setPreset] = useState<PresetId>('b3')
  const [metrik, setMetrik] = useState<Metrik>('lembar')
  const { theme } = useTheme()
  const wrapRef = useRef<HTMLDivElement>(null)

  const n1 = data ? netPeriode(data.d, 1) : null
  const n5 = data ? netPeriode(data.d, 5) : null
  const n20 = data ? netPeriode(data.d, 20) : null
  const pct = data ? persentilNet(data.d) : null

  // Jendela rupiah dihitung dari hari TERSEDIA Stockbit s.d. hari terakhir
  // bursa (`data.akhir`) — bukan dari hari bursa data.d, karena keduanya
  // sumber terpisah dan bisa berlubang beda hari.
  const n1r = data ? netRupiahPeriode(stockbit, data.akhir, 1) : null
  const n5r = data ? netRupiahPeriode(stockbit, data.akhir, 5) : null
  const n20r = data ? netRupiahPeriode(stockbit, data.akhir, 20) : null

  const titikLembar = useMemo(() => {
    if (!data) return []
    const mulai = mulaiPreset(preset, data.akhir, data.mulai)
    return kumulatifNet(data.d, mulai, data.akhir)
  }, [data, preset])

  const titikRupiah = useMemo<TitikRupiah[]>(() => {
    if (!data) return []
    const mulaiData = stockbit.mulai ?? data.mulai
    const mulai = mulaiPreset(preset, data.akhir, mulaiData)
    return kumulatifRupiah(stockbit, data.mulai, mulai, data.akhir)
  }, [data, stockbit, preset])

  const titik = metrik === 'lembar' ? titikLembar : titikRupiah
  // Titik sebelum cakupan bursa (garis putus-putus di grafik) — cuma ada
  // untuk metrik rupiah, lembar selalu solid karena seluruhnya dari bursa.
  const jahitan = (i: number): boolean => metrik === 'rupiah' && (titikRupiah[i]?.jahitan ?? false)

  const chartConfig = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (titik.length < 2) return null
    const el = wrapRef.current
    const green = bacaToken(el, '--green', '#38b77e')
    const red = bacaToken(el, '--red', '#e6635a')
    const text3 = bacaToken(el, '--text3', '#6b7688')
    const text2 = bacaToken(el, '--text2', '#9aa7b8')
    const line = bacaToken(el, '--line', '#232e3f')
    const warna = titik[titik.length - 1].kumulatif >= 0 ? green : red
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fmt = metrik === 'rupiah' ? fRp : (v: number) => `${fNet(v)} lembar`
    return {
      type: 'line',
      data: {
        labels: titik.map((t) => t.tanggal),
        datasets: [
          {
            label: 'Nol',
            data: titik.map(() => 0),
            borderColor: text3,
            borderDash: [4, 4],
            borderWidth: 1,
            pointRadius: 0,
          },
          {
            label: 'Net Kumulatif',
            data: titik.map((t) => t.kumulatif),
            borderColor: warna,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.15,
            fill: false,
            // Bagian sebelum cakupan bursa (jahitan, cuma satu sumber) digambar
            // putus-putus supaya beda kepercayaannya kelihatan, bukan cuma teks.
            segment: { borderDash: (ctx) => (jahitan(ctx.p0DataIndex) ? [4, 4] : undefined) },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduceMotion ? false : undefined,
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (ctx) => ctx.datasetIndex === 1,
            callbacks: { label: (ctx) => `Net kumulatif: ${fmt(Number(ctx.parsed.y))}` },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: text2, font: { size: 9 }, maxTicksLimit: 8 } },
          y: { grid: { color: line }, ticks: { color: text2, font: { size: 10 }, callback: (v) => (metrik === 'rupiah' ? fRp(Number(v)) : fNet(Number(v))) } },
        },
      },
      // theme wajib di deps (lihat PanelLaporanKeuangan.tsx) — warnanya dibaca
      // dari CSS var via bacaToken, bukan langsung dari `theme`.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [titik, theme, metrik])

  const canvasRef = useChartCanvas(chartConfig)

  /** Rentang tanggal yang SEDANG ditampilkan (Johan 21 Agu 2026: "munculkan
   *  rentang waktu juga bro"). Chip preset menyebut NAMA rentang ("3 Bulan"),
   *  bukan batasnya — dan batas itulah yang dibutuhkan saat membaca grafik
   *  kumulatif: "3 Bulan" pada emiten yang riwayatnya baru sebulan bukan tiga
   *  bulan sungguhan. Dihitung dari titik yang benar-benar tergambar, bukan
   *  dari preset, supaya angkanya tak pernah menjanjikan lebih dari isinya. */
  const rentang = titik.length >= 1
    ? { mulai: titik[0].tanggal, akhir: titik[titik.length - 1].tanggal, hari: titik.length }
    : null

  const recent = data ? data.d.slice(-15).slice().reverse() : []

  return (
    <div className="panel" ref={wrapRef} style={{ marginBottom: 12 }}>
      <div className="panel-h">
        <span className="lbl">Aliran Asing</span>
        {data && (
          <>
            {rentang && (
              <LabelRentang className="asg-rentang" mulai={rentang.mulai} akhir={rentang.akhir} n={rentang.hari} />
            )}
            <PemilihRentang className="asg-preset" opsi={PRESET} nilai={preset} onGanti={setPreset} ariaLabel="Rentang Aliran Asing" />
          </>
        )}
      </div>
      <div className="panel-b">
        {loading && (
          <p style={{ fontSize: 11, color: 'var(--text3)' }}><IkonMenu d={IKON_JAM} size={12} /> Memuat aliran asing…</p>
        )}

        {!loading && !data && (
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Data aliran asing untuk {ticker} belum tersedia.</p>
        )}

        {!loading && data && (
          <>
            <div className="rasio">
              <NetCell label={`Net ${n1?.hariTersedia ?? 1} Hari`} p={n1} />
              <NetCell label={`Net ${n5?.hariTersedia ?? 5} Hari`} p={n5} />
              <NetCell label={`Net ${n20?.hariTersedia ?? 20} Hari`} p={n20} />
            </div>

            {stockbit.mulai && (
              <div className="rasio" style={{ marginTop: 8 }}>
                <NetCell label={`Rupiah ${n1r?.hariTersedia ?? 1} Hari`} p={n1r} rp />
                <NetCell label={`Rupiah ${n5r?.hariTersedia ?? 5} Hari`} p={n5r} rp />
                <NetCell label={`Rupiah ${n20r?.hariTersedia ?? 20} Hari`} p={n20r} rp />
              </div>
            )}

            {pct ? (
              <div style={{ marginTop: 12 }}>
                <span className="lbl">Net hari ini vs {pct.n} hari bursa terakhir emiten ini</span>
                <div className="bar-tr" style={{ marginTop: 6 }}>
                  <div className={`bar-fl${pct.persentil < 50 ? ' neg' : ''}`} style={{ width: `${Math.max(2, Math.min(100, pct.persentil))}%` }} />
                </div>
                <span className="sub">Persentil ke-{Math.round(pct.persentil)} — {fNet(pct.netHariIni)} lembar</span>
              </div>
            ) : (
              <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10 }}>Riwayat belum cukup (min. 5 hari bursa) untuk konteks persentil.</p>
            )}

            {stockbit.mulai && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <PemilihRentang opsi={METRIK_OPSI} nilai={metrik} onGanti={setMetrik} ariaLabel="Satuan grafik kumulatif" />
              </div>
            )}

            {chartConfig ? (
              <div className="chart-wrap" style={{ height: 200, margin: '14px 0' }}>
                <canvas ref={canvasRef} />
              </div>
            ) : (
              <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10 }}>Riwayat belum cukup untuk grafik net kumulatif.</p>
            )}

            {metrik === 'rupiah' && titik.some((_, i) => jahitan(i)) && (
              <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: -8, marginBottom: 10 }}>
                Garis putus-putus (sebelum {tanggalPendek(data.mulai)}) cuma dari satu sumber — belum ada pembanding resmi bursa untuk periode itu.
              </p>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 320 }}>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th className="r">Beli</th>
                    <th className="r">Jual</th>
                    <th className="r">Net</th>
                    <th className="r">Net Rp</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => {
                    const net = r.beli - r.jual
                    const bRp = stockbit.byDate.get(r.tanggal)
                    return (
                      <tr key={r.tanggal}>
                        <td>{r.tanggal}</td>
                        <td className="r num">{fv(r.beli)}</td>
                        <td className="r num">{fv(r.jual)}</td>
                        <td className={`r num${net >= 0 ? ' up' : ' dn'}`}>{(net >= 0 ? '+' : '') + fv(net)}</td>
                        <td className={`r num${bRp ? (bRp.foreignBeli - bRp.foreignJual >= 0 ? ' up' : ' dn') : ''}`}>
                          {bRp ? fRp(bRp.foreignBeli - bRp.foreignJual) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
              Lembar (beli/jual/net asing) dari sumber resmi bursa. Rupiah aliran asing sebenarnya (bukan perkiraan) —
              riwayat sebelum {tanggalPendek(data.mulai)} cuma dari satu sumber, belum ada pembanding bursa.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
