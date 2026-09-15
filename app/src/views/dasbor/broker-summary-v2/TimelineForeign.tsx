import { useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import { PemilihRentang } from '../../../components/dasbor/PemilihRentang'
import type { BarisOhlcv } from '../../../lib/dasbor/brokerEmitenV2'
import { timelineForeign } from '../../../lib/dasbor/brokerEmitenV2'
import { LABEL_RENTANG, jendelaBaku, opsiRentangBaku, RENTANG_BAKU, type KunciBaku } from '../../../lib/dasbor/periode'
import { labelTanggal } from '../../../lib/dasbor/brokerHarian'
import { fmtB } from '../../../lib/dasbor/brokerSummaryFormat'
import { EmptyState } from './Overview'

type RentangFr = 'h1' | 'w1' | 'w2' | 'b1' | 'b3' | 'b6' | 'ytd' | 'y1' | 'y2' | 'semua'
const KUNCI_RENTANG: Record<RentangFr, KunciBaku | 'semua'> =
  { h1: 'h1', w1: 'w1', w2: 'w2', b1: 'b1', b3: 'b3', b6: 'b6', ytd: 'sejakJan', y1: 'y1', y2: 'y2', semua: 'semua' }

/** Opsi pil: SEPULUH baku (#209 koreksi pengawas), nonaktif HANYA kalau
 *  `jendelaBaku` bilang riwayat bar-nya tak cukup untuk rentang itu. */
function opsiRentang(bars: BarisOhlcv[]) {
  const tanggal = bars.map((b) => b.tanggal)
  const akhir = tanggal[tanggal.length - 1]
  const peta: Partial<Record<KunciBaku | 'semua', RentangFr>> = {}
  if (akhir) {
    ;([...RENTANG_BAKU, 'semua'] as const).forEach((k) => {
      if (jendelaBaku(tanggal, akhir, k)) peta[k] = k === 'sejakJan' ? 'ytd' : k
    })
  }
  return opsiRentangBaku(peta)
}

/** Berapa bar terakhir yang dipakai — `jendelaBaku` atas tanggal bar,
 *  bukan jumlah bar tetap (63/126/252) seperti sebelumnya. Jatuh ke seluruh
 *  riwayat bar kalau presetnya tak valid untuk deret ini. */
function hariUntukRentang(r: RentangFr, bars: BarisOhlcv[]): number {
  const tanggal = bars.map((b) => b.tanggal)
  const akhir = tanggal[tanggal.length - 1]
  if (!akhir) return 0
  const j = jendelaBaku(tanggal, akhir, KUNCI_RENTANG[r])
  if (!j) return tanggal.length
  return tanggal.length - tanggal.indexOf(j.mulai)
}

interface TimelineForeignProps {
  bars: BarisOhlcv[]
}

/**
 * Tab "Timeline Foreign" — port `renderForeign()` mockup, TAPI rupiah
 * LANGSUNG dari `foreignbuy`/`foreignsell` OHLCV (bukan taksiran lembar×avg
 * yang di mockup ditulis miring +33% kumulatif — lihat CLAUDE.md), jadi
 * sumbunya rupiah, bukan lembar.
 */
export function TimelineForeign({ bars }: TimelineForeignProps) {
  const { theme } = useTheme()
  const [rentang, setRentang] = useState<RentangFr>('b6')
  const n = hariUntukRentang(rentang, bars)
  const f = useMemo(() => timelineForeign(bars, n), [bars, n])

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!f) return null
    const isDark = theme === 'dark'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    return {
      type: 'line',
      data: {
        labels: f.tgl,
        datasets: [
          { label: 'Net asing kumulatif (Rp)', data: f.kumulatifRp, borderColor: '#5B94E8', backgroundColor: 'rgba(91,148,255,.14)', fill: true, borderWidth: 2.2, pointRadius: 0, yAxisID: 'y' },
          { label: 'Harga tutup', data: f.tutup, borderColor: '#8C94A1', borderWidth: 1.6, pointRadius: 0, yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { color: text2Color, boxWidth: 12, font: { size: 10 } } },
          tooltip: { callbacks: { label: (ctx) => ctx.dataset.yAxisID === 'y1' ? `Harga: Rp ${Number(ctx.raw).toLocaleString('id-ID')}` : `Kumulatif: Rp ${fmtB(Number(ctx.raw))}` } },
        },
        scales: {
          x: { ticks: { color: text2Color, maxTicksLimit: 8, callback: (_v, i) => labelTanggal(f.tgl[i]) }, grid: { display: false } },
          y: { position: 'left', ticks: { color: text2Color, callback: (v) => fmtB(Number(v)) }, grid: { color: 'rgba(128,128,128,.1)' } },
          y1: { position: 'right', ticks: { color: text2Color }, grid: { display: false } },
        },
      },
    }
  }, [f, theme])
  const canvasRef = useChartCanvas(config)

  return (
    <>
      <div className="kendali" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <PemilihRentang opsi={opsiRentang(bars)} nilai={rentang} onGanti={setRentang} ariaLabel="Rentang asing" />
        {f && (
          <span className="bs2-chipstat">Net {LABEL_RENTANG[rentang]} <b className="num" style={{ color: f.netRentang >= 0 ? 'var(--green)' : 'var(--red)' }}>Rp {fmtB(f.netRentang)}</b></span>
        )}
      </div>
      <section className="panel">
        <div className="panel-h"><h2>Kumulatif net foreign flow vs harga</h2><span className="lbl">sumber: bursa, nilai resmi</span></div>
        <div className="panel-b">
          {!f ? <EmptyState>Belum ada data OHLCV untuk emiten ini.</EmptyState> : (
            <>
              <div className="chart-wrap" style={{ height: 340 }}><canvas ref={canvasRef} /></div>
              <p className="lbl" style={{ marginTop: 10, textTransform: 'none', letterSpacing: 0 }}>
                Kumulatif net asing dalam <b>rupiah</b> — nilai resmi dari bursa, bukan taksiran lembar×harga rata-rata (taksiran seperti itu terbukti bisa meleset cukup jauh secara kumulatif). Penanda holder 1% belum ada.
              </p>
            </>
          )}
        </div>
      </section>
    </>
  )
}
