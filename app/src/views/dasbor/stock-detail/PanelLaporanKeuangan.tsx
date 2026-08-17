import { useMemo, useRef, useState } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useStockKeuangan, useStockKeuanganIdx, useStockFundamental, type PeriodeKeuangan } from '../../../lib/dasbor/stockDetailData'
import { fRingkas, fEps } from '../../../lib/dasbor/stockDetailFormat'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { IkonMenu, IKON_JAM } from '../../../components/dasbor/IkonMenu'
import { gabungkanBarisKeuangan, labelAsal, type AsalAngka } from '../../../lib/dasbor/fundamentalGabungan'

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

/** Lencana superscript pendek per sel — angka resmi bursa (IDX) dan angka
 * agregator (Yahoo/fundamental) tak boleh terlihat sama persis tanpa cara
 * membedakannya (lihat tooltip sel via labelAsal untuk keterangan penuh). */
function lencanaAsal(asal: AsalAngka): string {
  switch (asal) {
    case 'idx': return 'B'
    case 'idx-kumulatif': return 'B·YTD'
    case 'yahoo': return 'Y'
    default: return '†' // fundamental-* — tambalan lama, bukan laporan periode ini
  }
}

/**
 * Panel "Laporan Keuangan" ala Yahoo Finance /financials — chart batang
 * Pendapatan vs Laba Bersih (tetap tampil apa pun sub-tabnya, sama seperti
 * referensi) + tabel breakdown Laba Rugi/Neraca/Arus Kas di bawahnya.
 * Sumber DUA berkas per-periode, digabung ruas-per-ruas (lihat
 * lib/dasbor/fundamentalGabungan.ts — gabungkanBarisKeuangan):
 * data-idx/json/keuangan_idx/{TICKER}.json (resmi bursa, XBRL, MENANG kalau
 * ada) dan data-idx/json/keuangan/{TICKER}.json (yfinance, tambalan). Kalau
 * keduanya kosong untuk ruas ini baru jatuh ke data-idx/json/fundamental/.
 * TIDAK semua emiten punya kedua berkas keuangan, jadi state kosong wajib
 * sopan (bukan error) dan panel tetap terisi selama SALAH SATU ada.
 */
export function PanelLaporanKeuangan({ ticker }: { ticker: string }) {
  const { data: kd, loading: loadingYf } = useStockKeuangan(ticker)
  const { data: idx, loading: loadingIdx } = useStockKeuanganIdx(ticker)
  const loading = loadingYf || loadingIdx
  // A0: menambal ruas kosong (operating_cf dkk.) dari data-idx/json/fundamental/,
  // lihat lib/dasbor/fundamentalGabungan.ts untuk aturan penggabungannya.
  const { data: fd } = useStockFundamental(ticker)
  const [periodMode, setPeriodMode] = useState<PeriodMode>('kuartal')
  const [subTab, setSubTab] = useState<SubTab>('laba_rugi')
  const { theme } = useTheme()
  const wrapRef = useRef<HTMLDivElement>(null)

  const adaData = !!kd || !!idx
  const currency = idx?.currency ?? kd?.currency ?? null

  const periods = useMemo(() => {
    const srcYf = kd ? (periodMode === 'kuartal' ? kd.kuartal : kd.tahunan) : {}
    const srcIdx = idx ? (periodMode === 'kuartal' ? idx.kuartal : idx.tahunan) : {}
    const semuaIso = Array.from(new Set([...Object.keys(srcYf), ...Object.keys(srcIdx)])).sort()
    const terbaru = semuaIso[semuaIso.length - 1]
    return semuaIso.slice(-8).map((iso) => ({ iso, yf: srcYf[iso], terbaru: iso === terbaru }))
  }, [kd, idx, periodMode])

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
          { label: 'Pendapatan', data: periods.map((p) => gabungkanBarisKeuangan('revenue', p.iso, periodMode, p.yf, idx, null, p.terbaru).nilai), backgroundColor: blue, borderRadius: 3, maxBarThickness: 28 },
          { label: 'Laba Bersih', data: periods.map((p) => gabungkanBarisKeuangan('net_income', p.iso, periodMode, p.yf, idx, null, p.terbaru).nilai), backgroundColor: green, borderRadius: 3, maxBarThickness: 28 },
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
              label: (ctx) => `${ctx.dataset.label}: ${(currency === 'USD' ? 'US$ ' : 'Rp ')}${fRingkas(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: text2, font: { size: 10 } } },
          y: { grid: { color: line }, ticks: { color: text2, font: { size: 10 }, callback: (v) => fRingkas(Number(v)) } },
        },
      },
    }
    // theme: bukan dibaca langsung (warna datang dari bacaToken via wrapRef),
    // tapi WAJIB di deps supaya chart dibangun ulang saat tema di-toggle —
    // tanpa ini toggle gelap/terang tak mengubah warna chart yang sudah ada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, idx, periodMode, currency, theme])

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

        {!loading && !adaData && (
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Belum ada data laporan keuangan untuk emiten ini.</p>
        )}

        {!loading && adaData && (
          <>
            {currency && currency !== 'IDR' && (
              <span className="badge" style={{ marginTop: 0, marginBottom: 10 }}>Laporan dalam {currency} — bukan Rupiah</span>
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
                            const { nilai: v, asal } = gabungkanBarisKeuangan(baris.key, p.iso, periodMode, p.yf, idx, fd, p.terbaru)
                            const teks = v == null ? '—' : baris.key === 'eps' ? fEps(v) : fRingkas(v)
                            const penuh = v == null || !asal ? undefined : `${v.toLocaleString('id-ID')} — ${labelAsal(asal)}`
                            return (
                              <td key={p.iso} className="r" title={penuh}>
                                {teks}
                                {asal && <sup style={{ color: 'var(--text3)' }}>{lencanaAsal(asal)}</sup>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
                  B = IDX (laporan resmi bursa) · B·YTD = IDX kumulatif tahun berjalan, kuartal pembanding belum tersedia · Y = Yahoo Finance · † = ditambal dari data fundamental (bukan laporan periode ini). Arahkan kursor ke angka untuk detail asalnya.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
