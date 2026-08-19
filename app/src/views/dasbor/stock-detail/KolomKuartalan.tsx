import { useState, type ReactNode } from 'react'
import type { QuarterMap, StockFundamental, StockKeuangan } from '../../../lib/dasbor/stockDetailData'
import { useStockKeuanganIdx } from '../../../lib/dasbor/stockDetailData'
import { FdPercent } from '../../../components/dasbor/FdPercent'
import { LencanaTurunan } from '../../../components/dasbor/LencanaTurunan'

export type QMode = 'ni' | 'eps' | 'rev'

const TABS: { id: QMode; label: string }[] = [
  { id: 'ni', label: 'Net Income' },
  { id: 'eps', label: 'EPS' },
  { id: 'rev', label: 'Revenue' },
]

function TR(lbl: string, val: ReactNode) {
  return (
    <tr>
      <td>{lbl}</td>
      <td className="r">{val}</td>
    </tr>
  )
}

/**
 * Format satu sel tabel Kuartalan/Setahun/YTD/TTM — `null`/`undefined` (bahan
 * tak ada, mis. kuartal yang tak dipanen atau dilewati sanity-check backend)
 * WAJIB "—", HANYA nol sungguhan (v === 0) yang boleh dirender "0". Diekspor
 * & diuji sendiri (KolomKuartalan.test.ts) karena inilah tepat titik yang
 * dulu bikin bug q_eps ARCI (CLAUDE.md 18 Agu 2026) terlihat "datanya
 * kosong" padahal sebenarnya "backend salah menghitung, tapi angkanya bukan
 * null" — dua akar masalah beda yang gampang tertukar kalau titik render-nya
 * tak diuji terpisah dari titik hitungnya.
 */
export function fmtCell(v: number | null | undefined, mode: QMode): string {
  if (v == null) return '—'
  return mode === 'eps'
    ? Number(v).toLocaleString('id-ID', { maximumFractionDigits: 0 })
    : (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

/** Indeks kuartal absolut supaya "berurutan" bisa diuji dengan pengurangan. */
function idxKuartal(y: number, q: string): number {
  return y * 4 + (Number(q.slice(1)) - 1)
}

/**
 * Berapa kuartal PERTAMA berturut-turut (Q1, Q1+Q2, ...) yang terisi di tahun
 * terbaru. Inilah "n" pada label YTD: angkanya jadi bisa diadu lurus dengan
 * tahun-tahun sebelumnya pada jumlah kuartal yang sama — sesuatu yang angka
 * setahun-hasil-karangan tak pernah bisa. 0 = Q1 pun belum ada.
 */
export function ytdKuartal(qData: QuarterMap): number {
  const tahun = Object.keys(qData).map(Number)
  if (!tahun.length) return 0
  const ymap = qData[String(Math.max(...tahun))] || {}
  let n = 0
  while (ymap['Q' + (n + 1)] != null) n++
  return n
}

/** Jumlah Q1..Qn tahun `y`. `null` kalau ada satu saja yang bolong — sebagian
 *  tahun tak boleh menyamar jadi YTD n kuartal. */
export function jumlahYtd(qData: QuarterMap, y: number, n: number): number | null {
  if (n < 1) return null
  const ymap = qData[String(y)] || {}
  let sum = 0
  for (let i = 1; i <= n; i++) {
    const v = ymap['Q' + i]
    if (v == null) return null
    sum += v
  }
  return sum
}

/**
 * TTM hanya sah bila empat kuartal kalender BERURUTAN tanpa celah dan
 * berakhir di kuartal terlapor terakhir. Syarat lama cuma menghitung "ada
 * empat nilai" — empat nilai teratas bisa merentang lima kuartal (mis. Q2,
 * Q4, Q1, Q2) dan tetap disebut TTM. `tersedia` = panjang runtun yang benar
 * ada, dipakai memberi tahu pembaca kenapa selnya kosong.
 */
export function hitungTtm(qData: QuarterMap): { sum: number | null; tersedia: number } {
  const nilai = new Map<number, number>()
  Object.entries(qData).forEach(([y, qmap]) => {
    Object.entries(qmap).forEach(([q, v]) => { if (v != null) nilai.set(idxKuartal(Number(y), q), v) })
  })
  if (!nilai.size) return { sum: null, tersedia: 0 }
  const akhir = Math.max(...nilai.keys())
  let runtun = 0
  while (runtun < 4 && nilai.has(akhir - runtun)) runtun++
  if (runtun < 4) return { sum: null, tersedia: runtun }
  let sum = 0
  for (let i = 0; i < 4; i++) sum += nilai.get(akhir - i) as number
  return { sum, tersedia: 4 }
}

const RUAS_TAHUNAN = { ni: 'net_income', eps: 'eps', rev: 'revenue' } as const

/**
 * Port fdQTabBuild() index_live.html baris 3928-3993. Re-layout mockup
 * stock-detail-relayout.html: seksi ekstra "Dividen & Yield" + "Info Pasar"
 * yang dulu numpang di mode Net Income DIHAPUS — datanya sekarang tampil
 * permanen di hero (.statgrid: Mkt Cap/EV/Shares/Free Float) dan strip
 * rasio + panel Dividen (Div/payout/yield), jadi murni duplikat.
 *
 * Baris "Annualised" DIHAPUS (19 Agu 2026): ia menjumlahkan kuartal yang
 * kebetulan ada lalu menyebutnya setahun, jadi tahun berjalan yang baru dua
 * kuartal tercetak sebagai angka setahun di SETIAP emiten — dan untuk tahun
 * buku yang sudah tutup ia mengarang taksiran padahal angka resminya sudah
 * ada di cakram. Gantinya dua baris yang keduanya bisa diadu: angka setahun
 * dari laporan resmi, dan YTD apa adanya pada jumlah kuartal yang sama
 * lintas tahun. Angka tersalin ke spreadsheet orang, catatan kakinya tidak
 * — jadi kejujurannya harus ada di LABEL, bukan di catatan.
 */
function QuarterlyTable({ fd, mode, kd }: { fd: StockFundamental; mode: QMode; kd: StockKeuangan | null }) {
  const qData: QuarterMap = (mode === 'ni' ? fd.q_net_income : mode === 'eps' ? fd.q_eps : fd.q_revenue) ?? {}
  const fmt = (v: number | null | undefined) => fmtCell(v, mode)

  const years = Object.keys(qData).map(Number).sort((a, b) => b - a).slice(0, 3)
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const blankCols = Math.max(0, years.length - 1)

  const nYtd = ytdKuartal(qData)
  const ttm = hitungTtm(qData)

  /* Kolom kuartal sudah dinormalkan ke rupiah di hulu, laporan setahun BELUM
     (98 emiten melapor dolar). Menyandingkannya apa adanya meleset ~17.000x
     tanpa satu pun galat, jadi yang bukan rupiah sengaja tak ditampilkan. */
  const beda = kd && kd.currency !== 'IDR' ? kd.currency : null
  const tahunan = beda ? null : kd?.tahunan

  const suffix = mode === 'eps' ? 'IDR' : 'B IDR'

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="fd-qtab">
        <thead>
          <tr>
            <th>Period</th>
            {years.map((y) => <th key={y} className="r">{y}</th>)}
          </tr>
          <tr>
            <td colSpan={years.length + 1} style={{ fontSize: 9, color: 'var(--text3)', padding: '2px 8px' }}>({suffix})</td>
          </tr>
        </thead>
        <tbody>
          {quarters.map((q) => (
            <tr key={q}>
              <td>{q}</td>
              {years.map((y) => <td key={y} className="r">{fmt(qData[String(y)]?.[q])}</td>)}
            </tr>
          ))}
          <tr className="fd-divider">
            <td>Setahun (audit)</td>
            {years.map((y) => {
              const v = tahunan?.[`${y}-12-31`]?.[RUAS_TAHUNAN[mode]] ?? null
              return (
                <td key={y} className="r" title={v == null && beda ? `Laporan setahun disajikan dalam ${beda}, tak sebanding dengan kolom rupiah` : undefined}>
                  {fmt(v)}
                </td>
              )
            })}
          </tr>
          {nYtd > 0 && (
            <tr>
              <td>{`YTD (${nYtd} kuartal)`}</td>
              {years.map((y) => <td key={y} className="r">{fmt(jumlahYtd(qData, y, nYtd))}</td>)}
            </tr>
          )}
          <tr className="ttm-row">
            <td>TTM</td>
            <td className="r" title={ttm.sum == null ? `Butuh 4 kuartal berurutan, tersedia ${ttm.tersedia}` : undefined}>{fmt(ttm.sum)}</td>
            {blankCols > 0 && <td colSpan={blankCols} />}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** Panel kuartalan bertab (Net Income/EPS/Revenue) — kolom KIRI mockup. */
export function PanelKuartalan({ fd }: { fd: StockFundamental }) {
  const [mode, setMode] = useState<QMode>('ni')
  const { data: kd } = useStockKeuanganIdx(fd.ticker)
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="lbl">Kuartalan</span>
        <div className="tabs" role="tablist" aria-label="Metrik Kuartalan">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mode === t.id}
              className={`tab${mode === t.id ? ' on' : ''}`}
              onClick={() => setMode(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-b">
        <QuarterlyTable fd={fd} mode={mode} kd={kd} />
      </div>
    </div>
  )
}

export function PanelProfitabilitas({ fd }: { fd: StockFundamental }) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Profitabilitas</span></div>
      <div className="panel-b">
        <table>
          <tbody>
            {TR('Gross Profit Margin', <FdPercent v={fd.gpm != null ? fd.gpm * 100 : null} />)}
            {TR('Operating Margin', <FdPercent v={fd.opm != null ? fd.opm * 100 : null} />)}
            {TR('Net Profit Margin', <FdPercent v={fd.npm != null ? fd.npm * 100 : null} />)}
            {/* #93: ROE/ROA pindah ke PanelEfektivitas; EBITDA margin masuk sini. */}
            {TR('EBITDA Margin', <FdPercent v={fd.ebitda_margin != null ? fd.ebitda_margin * 100 : null} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * CATATAN: sumber asli (index_live.html baris 4170-4180 & 3975-3980)
 * mengalikan fd.rev_yoy/ni_yoy/gp_yoy/dividend_yield dengan 100 sebelum
 * format — tapi field itu di data JSON SUDAH dalam skala persen (mis.
 * rev_yoy:6.8 = 6,8%, bukan 0,068), jadi dashboard lama menampilkan angka
 * salah (mis. +680% alih-alih +6,8%). Bug data, bukan pilihan desain —
 * diperbaiki di sini (tanpa *100), bukan diport apa adanya. payout_ratio
 * (fraksi asli, *100 benar) tidak kena masalah ini, tetap dikali 100.
 */
export function PanelGrowth({ fd }: { fd: StockFundamental }) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Growth (YoY)</span></div>
      <div className="panel-b">
        <table>
          <tbody>
            {TR('Revenue YoY', <FdPercent v={fd.rev_yoy} />)}
            {TR('Gross Profit YoY', <FdPercent v={fd.gp_yoy} />)}
            {TR('Net Income YoY', <FdPercent v={fd.ni_yoy} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PanelDividen({ fd }: { fd: StockFundamental }) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Dividen</span></div>
      <div className="panel-b">
        <table>
          <tbody>
            {TR('Dividen/Saham', fd.dividend ? 'Rp ' + Number(fd.dividend).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—')}
            {TR('Payout Ratio', <FdPercent v={fd.payout_ratio != null ? fd.payout_ratio * 100 : null} d={1} />)}
            {TR('Div Yield', <><FdPercent v={fd.dividend_yield} /><LencanaTurunan fd={fd} ruas="dividend_yield" /></>)}
            {TR('Ex-Date', fd.ex_dividend_date || '—')}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PanelRiwayatDividen({ fd }: { fd: StockFundamental }) {
  // #93: maks 6 baris terbaru — data sudah urut terbaru→terlama dari backend.
  const divHistRows = (fd.div_history ?? []).slice(0, 6)
  if (divHistRows.length === 0) return null
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Riwayat Dividen</span></div>
      <div className="panel-b">
        <table>
          <thead>
            <tr><th>Tahun</th><th className="r">Dividen</th><th className="r">Ex-Date</th></tr>
          </thead>
          <tbody>
            {divHistRows.map((d, i) => (
              <tr key={`${d.year}-${d.ex_date}-${i}`}>
                <td className="muted">{d.year}</td>
                <td className="r">Rp {Number(d.amount).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                <td className="r muted">{d.ex_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
