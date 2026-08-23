import { useMemo } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useChartCanvas } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import {
  useKepemilikan, useProfil, susunKsei, deretKomposisiKsei, pemegangSaham, anakUsaha, pengurus,
} from '../../../lib/dasbor/brokerProfilKsei'
import { fmtRingkas } from '../../../lib/dasbor/brokerSummaryFormat'
import { labelTanggal } from '../../../lib/dasbor/brokerHarian'
import { EmptyState } from './Overview'

const WARNA_SERI = ['#3CCFBD', '#B48CF7', '#8F98A6', '#5B9BFF', '#E0B341']

interface ShareholdersProps {
  kode: string
}

/** Tab "Shareholders" — port `renderShareholders()` mockup: dua sumber nyata (kepemilikan KSEI + profil Stockbit). */
export function Shareholders({ kode }: ShareholdersProps) {
  const { theme } = useTheme()
  const kepemilikan = useKepemilikan(kode)
  const profil = useProfil(kode)

  const ksei = useMemo(() => (kepemilikan ? susunKsei(kepemilikan) : null), [kepemilikan])
  const komposisi = useMemo(() => (kepemilikan ? deretKomposisiKsei(kepemilikan) : null), [kepemilikan])
  const pemegang = useMemo(() => (profil ? pemegangSaham(profil) : null), [profil])
  const anak = useMemo(() => (profil ? anakUsaha(profil) : null), [profil])
  const orang = useMemo(() => (profil ? pengurus(profil) : null), [profil])

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!komposisi || komposisi.bulanList.length === 0) return null
    const isDark = theme === 'dark'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    return {
      type: 'line',
      data: {
        labels: komposisi.bulanList,
        datasets: komposisi.seri.map((s, i) => ({
          label: s.label, data: s.pct, fill: true, stack: 'k',
          borderColor: WARNA_SERI[i], backgroundColor: WARNA_SERI[i] + 'CC', pointRadius: 0, borderWidth: 1,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: text2Color, boxWidth: 10, font: { size: 9.5 } } } },
        scales: {
          x: { ticks: { color: text2Color, maxTicksLimit: 8, callback: (_v, i) => labelTanggal(komposisi.bulanList[i]).slice(-6) }, grid: { display: false } },
          y: { min: 0, max: 100, stacked: true, ticks: { color: text2Color, callback: (v) => `${v}%` }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }
  }, [komposisi, theme])
  const canvasRef = useChartCanvas(config)

  return (
    <div className="grid2">
      <section className="panel">
        <div className="panel-h"><h2>Pemegang saham ≥5% &amp; pengendali</h2><span className="lbl">profil resmi</span></div>
        <div className="panel-b">
          {!profil ? <EmptyState>Memuat…</EmptyState> : pemegang && pemegang.length > 0 ? (
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Nama</th><th className="r">%</th><th className="r">Lembar</th></tr></thead>
                <tbody>{pemegang.map((r) => (
                  <tr key={r.nama}>
                    <td>{r.nama}{r.pengendali && <span className="chip up" style={{ marginLeft: 6, padding: '0 6px' }}>pengendali</span>}</td>
                    <td className="r num">{r.persen.toFixed(2)}</td>
                    <td className="r num">{r.lembar !== null ? fmtRingkas(r.lembar) : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState>Data pemegang saham belum tersedia.</EmptyState>}

          <div className="panel-h" style={{ marginTop: 14, paddingLeft: 0, paddingRight: 0 }}><h2>Anak usaha</h2></div>
          {anak && anak.length > 0 ? (
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Perusahaan</th><th>Bidang</th><th className="r">%</th></tr></thead>
                <tbody>{anak.map((r) => (
                  <tr key={r.nama}>
                    <td>{r.nama}</td>
                    <td style={{ color: 'var(--text2)' }}>{r.bidang || '—'}</td>
                    <td className="r num">{r.persen !== null ? r.persen.toFixed(2) : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState>Data anak usaha belum tersedia.</EmptyState>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-h"><h2>Komposisi kepemilikan KSEI</h2><span className="lbl">{ksei ? `posisi ${labelTanggal(ksei.bulanTerakhir)} · ${fmtRingkas(ksei.lembarTercatat)} lembar tercatat` : ''}</span></div>
        <div className="panel-b">
          {!kepemilikan ? <EmptyState>Memuat…</EmptyState> : !ksei || !config ? <EmptyState>Belum ada data kepemilikan KSEI untuk emiten ini.</EmptyState> : (
            <>
              <div className="chart-wrap" style={{ height: 260 }}><canvas ref={canvasRef} /></div>
              <div className="board-tbl-wrap" style={{ marginTop: 10 }}>
                <table className="tbl">
                  <thead><tr><th>Jenis investor</th><th className="r">Lokal</th><th className="r">Asing</th><th className="r">Total %</th><th className="r">Δ 12 bln</th></tr></thead>
                  <tbody>
                    {ksei.baris.map((r) => (
                      <tr key={r.jenis}>
                        <td>{r.label} <span style={{ color: 'var(--text3)' }}>{r.jenis}</span></td>
                        <td className="r num">{r.lokalPct.toFixed(1)}%</td>
                        <td className="r num">{r.asingPct.toFixed(1)}%</td>
                        <td className="r num"><b>{r.totalPct.toFixed(1)}%</b></td>
                        <td className="r num" style={{ color: r.deltaSetahunPp >= 0 ? 'var(--green)' : 'var(--red)' }}>{r.deltaSetahunPp >= 0 ? '+' : ''}{r.deltaSetahunPp.toFixed(1)}pp</td>
                      </tr>
                    ))}
                    <tr>
                      <td><b>Asing total</b></td><td /><td />
                      <td className="r num"><b>{ksei.asingTotalPct.toFixed(1)}%</b></td>
                      <td className="r num" style={{ color: ksei.asingDeltaSetahunPp >= 0 ? 'var(--green)' : 'var(--red)' }}>{ksei.asingDeltaSetahunPp >= 0 ? '+' : ''}{ksei.asingDeltaSetahunPp.toFixed(1)}pp</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="panel-h" style={{ marginTop: 14, paddingLeft: 0, paddingRight: 0 }}><h2>Pengurus</h2></div>
          {orang ? (
            <p className="lbl" style={{ textTransform: 'none', letterSpacing: 0, lineHeight: 1.7 }}>
              <b style={{ color: 'var(--text)' }}>Direksi:</b> {orang.direksi.join(' · ') || '—'}<br />
              <b style={{ color: 'var(--text)' }}>Komisaris:</b> {orang.komisaris.join(' · ') || '—'}
            </p>
          ) : <EmptyState>Memuat…</EmptyState>}
        </div>
      </section>
    </div>
  )
}
