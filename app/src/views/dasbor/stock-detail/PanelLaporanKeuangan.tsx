import { useMemo, useRef, useState } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useStockKeuangan, type PeriodeKeuangan } from '../../../lib/dasbor/stockDetailData'
import { fRingkas, fEps } from '../../../lib/dasbor/stockDetailFormat'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { IkonMenu, IKON_JAM } from '../../../components/dasbor/IkonMenu'

type PeriodMode = 'kuartal' | 'tahunan'
type SubTab = 'laba_rugi' | 'neraca' | 'arus_kas'

const BARIS: Record<SubTab, { key: keyof PeriodeKeuangan; label: string }[]> = {
  laba_rugi: [
    { key: 'revenue', label: 'Pendapatan' },
    { key: 'cogs', label: 'Beban Pokok Penjualan' },
    { key: 'gross_profit', label: 'Laba Kotor' },
    { key: 'operating_income', label: 'Laba Usaha' },
    { key: 'net_income', label: 'Laba Bersih' },
    { key: 'eps', label: 'EPS (Dasar)' },
  ],
  neraca: [
    { key: 'total_assets', label: 'Total Aset' },
    { key: 'total_liabilities', label: 'Total Liabilitas' },
    { key: 'equity', label: 'Ekuitas' },
    { key: 'cash', label: 'Kas & Setara Kas' },
    { key: 'total_debt', label: 'Total Utang Berbunga' },
  ],
  arus_kas: [
    { key: 'operating_cf', label: 'Arus Kas Operasi' },
    { key: 'investing_cf', label: 'Arus Kas Investasi' },
    { key: 'financing_cf', label: 'Arus Kas Pendanaan' },
    { key: 'free_cf', label: 'Arus Kas Bebas (FCF)' },
  ],
}

/** "2026-03-31" (kuartal) → "Q1'26"; (tahunan) → "2026". */
function labelPeriode(iso: string, mode: PeriodMode): string {
  const [y, m] = iso.split('-')
  if (mode === 'tahunan') return y
  const q = Math.ceil(Number(m) / 3)
  return `Q${q}'${y.slice(2)}`
}

/** Baca token warna dari CSS var tercascade di elemen `.lantai` (dark/light
 * beda nilai lewat `.dasbor-shell[data-theme]`) — bukan hex hardcode. */
function bacaToken(el: HTMLElement | null, nama: string, fallback: string): string {
  if (!el) return fallback
  const v = getComputedStyle(el).getPropertyValue(nama).trim()
  return v || fallback
}

/**
 * Panel "Laporan Keuangan" ala Yahoo Finance /financials — chart batang
 * Pendapatan vs Laba Bersih (tetap tampil apa pun sub-tabnya, sama seperti
 * referensi) + tabel breakdown Laba Rugi/Neraca/Arus Kas di bawahnya.
 * Sumber: data-idx/json/keuangan/{TICKER}.json (scripts/fetch_keuangan.py) —
 * TIDAK semua emiten punya berkas ini, jadi state kosong wajib sopan (bukan error).
 */
export function PanelLaporanKeuangan({ ticker }: { ticker: string }) {
  const { data: kd, loading } = useStockKeuangan(ticker)
  const [periodMode, setPeriodMode] = useState<PeriodMode>('kuartal')
  const [subTab, setSubTab] = useState<SubTab>('laba_rugi')
  const { theme } = useTheme()
  const wrapRef = useRef<HTMLDivElement>(null)

  const periods = useMemo(() => {
    const src = kd ? (periodMode === 'kuartal' ? kd.kuartal : kd.tahunan) : {}
    return Object.keys(src).sort().slice(-8).map((iso) => ({ iso, val: src[iso] }))
  }, [kd, periodMode])

  const chartConfig = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (periods.length === 0) return null
    const el = wrapRef.current
    const blue = bacaToken(el, '--blue', '#4c8dff')
    const green = bacaToken(el, '--green', '#30a46c')
    const text2 = bacaToken(el, '--text2', '#9aa7b8')
    const line = bacaToken(el, '--line', '#232e3f')
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return {
      type: 'bar',
      data: {
        labels: periods.map((p) => labelPeriode(p.iso, periodMode)),
        datasets: [
          { label: 'Pendapatan', data: periods.map((p) => p.val.revenue), backgroundColor: blue, borderRadius: 3, maxBarThickness: 28 },
          { label: 'Laba Bersih', data: periods.map((p) => p.val.net_income), backgroundColor: green, borderRadius: 3, maxBarThickness: 28 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduceMotion ? false : undefined,
        plugins: {
          legend: { position: 'bottom', labels: { color: text2, boxWidth: 10, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${(kd?.currency === 'USD' ? 'US$ ' : 'Rp ')}${fRingkas(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: text2, font: { size: 10 } } },
          y: { grid: { color: line }, ticks: { color: text2, font: { size: 10 }, callback: (v) => fRingkas(Number(v)) } },
        },
      },
    }
  }, [periods, periodMode, kd?.currency, theme])

  const canvasRef = useChartCanvas(chartConfig)

  return (
    <div className="panel" ref={wrapRef} style={{ marginBottom: 12 }}>
      <div className="panel-h">
        <span className="lbl">Laporan Keuangan</span>
        <div className="tabs" role="tablist" aria-label="Periode Laporan Keuangan">
          <button type="button" role="tab" aria-selected={periodMode === 'kuartal'} className={'tab' + (periodMode === 'kuartal' ? ' on' : '')} onClick={() => setPeriodMode('kuartal')}>Kuartalan</button>
          <button type="button" role="tab" aria-selected={periodMode === 'tahunan'} className={'tab' + (periodMode === 'tahunan' ? ' on' : '')} onClick={() => setPeriodMode('tahunan')}>Tahunan</button>
        </div>
      </div>
      <div className="panel-b">
        {loading && (
          <p style={{ fontSize: 11, color: 'var(--text3)' }}><IkonMenu d={IKON_JAM} size={12} /> Memuat laporan keuangan…</p>
        )}

        {!loading && !kd && (
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Belum ada data laporan keuangan untuk emiten ini.</p>
        )}

        {!loading && kd && (
          <>
            {kd.currency && kd.currency !== 'IDR' && (
              <span className="badge" style={{ marginTop: 0, marginBottom: 10 }}>Laporan dalam {kd.currency} — bukan Rupiah</span>
            )}

            {periods.length === 0 && (
              <p style={{ fontSize: 11, color: 'var(--text3)' }}>Tidak ada periode {periodMode === 'kuartal' ? 'kuartalan' : 'tahunan'} yang tersedia.</p>
            )}

            {periods.length > 0 && (
              <>
                <div className="chart-wrap" style={{ height: 220, marginBottom: 12 }}>
                  <canvas ref={canvasRef} />
                </div>

                <div className="tabs" role="tablist" aria-label="Jenis Laporan" style={{ marginBottom: 10 }}>
                  <button type="button" role="tab" aria-selected={subTab === 'laba_rugi'} className={'tab' + (subTab === 'laba_rugi' ? ' on' : '')} onClick={() => setSubTab('laba_rugi')}>Laba Rugi</button>
                  <button type="button" role="tab" aria-selected={subTab === 'neraca'} className={'tab' + (subTab === 'neraca' ? ' on' : '')} onClick={() => setSubTab('neraca')}>Neraca</button>
                  <button type="button" role="tab" aria-selected={subTab === 'arus_kas'} className={'tab' + (subTab === 'arus_kas' ? ' on' : '')} onClick={() => setSubTab('arus_kas')}>Arus Kas</button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ minWidth: 360 }}>
                    <thead>
                      <tr>
                        <th>Metrik</th>
                        {periods.map((p) => <th key={p.iso} className="r">{labelPeriode(p.iso, periodMode)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {BARIS[subTab].map((baris) => (
                        <tr key={baris.key}>
                          <td>{baris.label}</td>
                          {periods.map((p) => {
                            const v = p.val[baris.key]
                            const teks = v == null ? '—' : baris.key === 'eps' ? fEps(v) : fRingkas(v)
                            const penuh = v == null ? undefined : v.toLocaleString('id-ID')
                            return <td key={p.iso} className="r" title={penuh}>{teks}</td>
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
