import { useMemo } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { fmtB } from '../../../lib/dasbor/brokerSummaryFormat'
import { labelTanggal, type BrokerRentangAktif } from '../../../lib/dasbor/brokerHarian'
import { useFlowNego } from '../../../lib/dasbor/flowNego'
import { IkonMenu, IKON_ULANG, IKON_PERINGATAN } from '../../../components/dasbor/IkonMenu'

interface NegoProps {
  tanggalAktif: string | null
  rentang: BrokerRentangAktif | null
}

/** "2026-08-12" → "12 Agu" (tanpa tahun, label sumbu). */
const labelPendek = (iso: string) => labelTanggal(iso).replace(/ \d{4}$/, '')

/**
 * Tab "NEGO" (#99) — data NYATA dari trading_recap papan NG di ds_YYMMDD.json,
 * mengikuti tanggal/rentang aktif halaman. Keputusan jujur: sumber hanya
 * memuat AGREGAT papan negosiasi per hari (vol/nilai/frek) — rincian per
 * saham tidak tersedia, jadi daftar "Top saham NEGO" (data contoh lama)
 * diganti chart nilai papan NG per hari + ringkasan, dengan keterangan.
 */
export function Nego({ tanggalAktif, rentang }: NegoProps) {
  const { theme } = useTheme()
  const { hari, loading, error, cakupan } = useFlowNego(tanggalAktif, rentang)

  const config = useMemo<ChartConfiguration<'bar', number[], string> | null>(() => {
    if (!hari || hari.length === 0) return null
    const isDark = theme === 'dark'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    const gridColor = 'rgba(128,128,128,.1)'

    return {
      type: 'bar',
      data: {
        labels: hari.map((h) => labelPendek(h.iso)),
        datasets: [{
          label: 'Nilai papan NG (Rp)',
          data: hari.map((h) => h.ngVal),
          backgroundColor: 'rgba(59,130,246,.7)',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const h = hari[ctx.dataIndex]
                return [`Nilai: Rp ${fmtB(h.ngVal)}`, `Vol: ${fmtB(h.ngVol)} lembar`, `Frek: ${h.ngFrek.toLocaleString('id-ID')}x`]
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: text2Color, maxTicksLimit: 12 }, grid: { color: gridColor } },
          y: { ticks: { color: text2Color, callback: (v) => fmtB(Number(v)) }, grid: { color: gridColor } },
        },
      },
    }
  }, [hari, theme])

  const canvasRef = useChartCanvas(config)

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p><IkonMenu d={IKON_ULANG} size={26} /></p>
        <p className="lbl">Memuat data pasar nego…</p>
      </div>
    )
  }
  if (error || !hari || hari.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
        <p className="lbl">
          {error
            ? `Gagal memuat data pasar nego (${error})`
            : cakupan
              ? `Data harian pasar tersedia ${labelTanggal(cakupan.min)} – ${labelTanggal(cakupan.max)} — tidak ada di tanggal/rentang aktif`
              : 'Data harian pasar belum tersedia'}
        </p>
      </div>
    )
  }

  const totalVal = hari.reduce((s, h) => s + h.ngVal, 0)
  const totalVol = hari.reduce((s, h) => s + h.ngVol, 0)
  const totalFrek = hari.reduce((s, h) => s + h.ngFrek, 0)
  const jendela = `${labelTanggal(hari[0].iso)} – ${labelTanggal(hari[hari.length - 1].iso)} (${hari.length} hari bursa)`

  return (
    <>
      <div className="lbl" style={{ marginBottom: 8 }}><IkonMenu d={IKON_ULANG} size={13} /> Pasar Negosiasi (Papan NG) — {jendela}</div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10, fontSize: 12 }}>
        <span>Nilai: <span className="num">Rp {fmtB(totalVal)}</span></span>
        <span>Volume: <span className="num">{fmtB(totalVol)} lembar</span></span>
        <span>Frekuensi: <span className="num">{totalFrek.toLocaleString('id-ID')}x</span></span>
      </div>
      <div className="chart-wrap" style={{ height: 240 }}>
        <canvas ref={canvasRef} />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
        * Agregat papan negosiasi (NG) dari IDX daily statistics — rincian transaksi nego per saham tidak tersedia dari sumber saat ini.
      </div>
    </>
  )
}
