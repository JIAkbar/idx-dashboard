import { useMemo } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { BULAN, type RingkasEmiten } from '../../lib/seasonality'
import { useChartCanvas } from '../../lib/dasbor/useChartJs'
import { useTheme } from '../../context/ThemeContext'

const BLN3 = BULAN.map((b) => b.slice(0, 3))

/**
 * Lima warna seri — sengaja BEDA HUE, bukan lima nuansa satu warna: emiten
 * yang dibandingkan tak punya urutan, jadi gradasi akan mengarang peringkat
 * yang tidak ada. Nilai terang digelapkan supaya tetap terbaca di atas latar
 * putih tema terang.
 */
const WARNA = {
  dark: ['#F2C230', '#38B77E', '#5B94E8', '#E6635A', '#B98CE0'],
  light: ['#7A5E00', '#197047', '#2C63C4', '#B73A31', '#6B3FA0'],
}

/**
 * Chart komparasi Seasonality antar-emiten (#132).
 *
 * Matriks di atasnya sudah memuat angka yang sama, jadi chart ini TIDAK
 * mengulanginya — dia menjawab pertanyaan lain: bulan mana yang polanya
 * BERSAMAAN di beberapa emiten, dan bulan mana yang cuma milik satu. Itu
 * pertanyaan bentuk, dan bentuk lebih cepat dibaca sebagai garis daripada
 * sebagai 60 angka di dalam kotak.
 *
 * Komponen terpisah (pola sama IhsgYtdChart di IndeksDunia): pemanggilnya
 * punya cabang kosong/galat sebelum kanvas terpasang, dan hook chart yang
 * dipanggil saat kanvas belum ada di DOM tidak akan pernah menggambar.
 */
export function SeasonalityKomparasi({ ringkas }: { ringkas: RingkasEmiten[] }) {
  const { theme } = useTheme()

  const config = useMemo<ChartConfiguration<'line', (number | null)[], string> | null>(() => {
    if (ringkas.length === 0) return null
    const gelap = theme === 'dark'
    const warna = gelap ? WARNA.dark : WARNA.light
    const grid = gelap ? 'rgba(156,160,172,.18)' : 'rgba(82,88,96,.18)'
    const teks = gelap ? '#9CA0AC' : '#525860'
    return {
      type: 'line',
      data: {
        labels: BLN3,
        datasets: ringkas.map((r, i) => ({
          label: r.kode,
          // Bulan tanpa data digambar sebagai PUTUS, bukan nol: nol berarti
          // "tak pernah naik", dan itu klaim yang jauh lebih kuat daripada
          // "belum ada datanya".
          data: r.perBulan.map((b) => (b.n === 0 ? null : Math.round(b.tersusut))),
          borderColor: warna[i % warna.length],
          backgroundColor: warna[i % warna.length],
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.25,
          spanGaps: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: teks, boxWidth: 10, boxHeight: 10, font: { size: 10 } } },
          tooltip: {
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y ?? '—'}%` },
          },
        },
        scales: {
          x: { grid: { color: grid }, ticks: { color: teks, font: { size: 10 } } },
          // Garis 50% adalah pemisah yang berarti: di atasnya bulan yang lebih
          // sering naik daripada tidak. Sumbu dikunci 0-100 supaya perbandingan
          // antar-emiten tidak berubah skala tiap kali daftarnya berganti.
          y: {
            min: 0, max: 100,
            grid: { color: grid },
            ticks: { color: teks, font: { size: 10 }, stepSize: 25, callback: (v) => `${v}%` },
          },
        },
      },
    }
  }, [ringkas, theme])

  const canvasRef = useChartCanvas(config)

  return (
    <section className="panel">
      <div className="panel-h">
        <span className="lbl">Bentuk musiman — {ringkas.map((r) => r.kode).join(' · ')}</span>
        <span className="v-note">peluang tersusut, garis 50% = seimbang</span>
      </div>
      <div className="panel-b">
        <div className="chart-wrap" style={{ height: 260 }}>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>
      </div>
    </section>
  )
}
