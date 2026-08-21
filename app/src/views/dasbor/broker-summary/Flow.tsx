import { useMemo } from 'react'
import type { ChartConfiguration, ChartDataset } from 'chart.js/auto'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { fmtB } from '../../../lib/dasbor/brokerSummaryFormat'
import { labelTanggal } from '../../../lib/dasbor/brokerHarian'
import { useFlowNego } from '../../../lib/dasbor/flowNego'
import type { BrokerRentangAktif } from '../../../lib/dasbor/brokerHarian'
import { IkonMenu, IKON_OMBAK, IKON_ULANG, IKON_PERINGATAN } from '../../../components/dasbor/IkonMenu'
import { AsingEmiten } from './AsingEmiten'
import { InvestorChart } from './InvestorChart'

interface FlowProps {
  tanggalAktif: string | null
  rentang: BrokerRentangAktif | null
}

/** "2026-08-12" → "12 Agu" (tanpa tahun, label sumbu). */
const labelPendek = (iso: string) => labelTanggal(iso).replace(/ \d{4}$/, '')

/**
 * Tab "Flow" (#99) — data NYATA dari ds_YYMMDD.json, mengikuti tanggal/rentang
 * aktif halaman. `ds_YYMMDD.json` hanya menyediakan NET foreign harian
 * (nf_today_idr, miliar Rp), jadi chart ini jujur: bar Net (hijau=net buy,
 * merah=net sell) + garis kumulatif. Hari tanpa angka nf (7/138 berkas,
 * parser gagal) tampil sebagai celah.
 *
 * Kalimat "buy/sell terpisah TIDAK ada" yang dulu berdiri di sini sudah
 * GUGUR (B36, 21 Agu 2026): `ForeignBuy`/`ForeignSell` per emiten memang ada
 * di `GetStockSummary` — dalam LEMBAR — dan penjumlahannya kini tampil di
 * panel `InvestorChart` di bawah. Yang tetap tak ada: belahan rupiah dan
 * belahan frekuensi. Batasnya bergeser, bukan hilang.
 */
export function Flow({ tanggalAktif, rentang }: FlowProps) {
  const { theme } = useTheme()
  const { hari, loading, error, cakupan } = useFlowNego(tanggalAktif, rentang)

  const config = useMemo<ChartConfiguration<'bar' | 'line', (number | null)[], string> | null>(() => {
    if (!hari || hari.length === 0) return null
    const isDark = theme === 'dark'
    const textColor = isDark ? '#cfd8e3' : '#1a2733'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    const gridColor = 'rgba(128,128,128,.1)'

    const labels = hari.map((h) => labelPendek(h.iso))
    const net = hari.map((h) => h.nf)
    let jml = 0
    const kumulatif = hari.map((h) => (jml += h.nf ?? 0))
    const warna = net.map((v) => ((v ?? 0) >= 0 ? 'rgba(34,197,94,.7)' : 'rgba(239,68,68,.7)'))

    const datasets: ChartDataset<'bar' | 'line', (number | null)[]>[] = [
      { type: 'bar', label: 'Net Foreign (miliar Rp)', data: net, backgroundColor: warna, order: 2 },
      { type: 'line', label: 'Kumulatif', data: kumulatif, borderColor: '#facc15', backgroundColor: 'transparent', borderWidth: 2, pointRadius: hari.length > 40 ? 0 : 3, order: 1 },
    ]

    return {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed.y
                if (v == null) return `${ctx.dataset.label}: tidak tersedia`
                return `${ctx.dataset.label}: Rp ${fmtB(v * 1e9)}`
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: text2Color, maxTicksLimit: 12 }, grid: { color: gridColor } },
          y: { ticks: { color: text2Color, callback: (v) => fmtB(Number(v) * 1e9) }, grid: { color: gridColor } },
        },
      },
    }
  }, [hari, theme])

  const canvasRef = useChartCanvas(config)

  if (loading) {
    return (
      <>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_ULANG} size={26} /></p>
          <p className="lbl">Memuat data foreign flow…</p>
        </div>
        <AsingEmiten />
        <InvestorChart />
      </>
    )
  }
  if (error || !hari || hari.length === 0) {
    return (
      <>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">
            {error
              ? `Gagal memuat data foreign flow (${error})`
              : cakupan
                ? `Data harian pasar tersedia ${labelTanggal(cakupan.min)} – ${labelTanggal(cakupan.max)} — tidak ada di tanggal/rentang aktif`
                : 'Data harian pasar belum tersedia'}
          </p>
        </div>
        <AsingEmiten />
      </>
    )
  }

  const tanpaNf = hari.filter((h) => h.nf == null).length
  const jendela = rentang
    ? `${labelTanggal(hari[0].iso)} – ${labelTanggal(hari[hari.length - 1].iso)} (${hari.length} hari bursa)`
    : `${hari.length} hari bursa s.d. ${labelTanggal(hari[hari.length - 1].iso)}`

  return (
    <>
      <div className="lbl" style={{ marginBottom: 8 }}><IkonMenu d={IKON_OMBAK} size={13} /> Net Foreign Harian — {jendela}</div>
      <div className="chart-wrap chart-tinggi">
        <canvas ref={canvasRef} />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
        * Sumber (IDX daily statistics) hanya memuat NET foreign per hari — buy/sell terpisah tidak tersedia.
        {tanpaNf > 0 && ` ${tanpaNf} hari tanpa angka net foreign di sumber (celah pada chart).`}
      </div>
      <AsingEmiten />
      <InvestorChart />
    </>
  )
}
