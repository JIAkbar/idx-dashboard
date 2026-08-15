import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { useStockFundamental, useStockIndex } from '../../lib/dasbor/stockDetailData'
import { fMC, fv, fvx } from '../../lib/dasbor/stockDetailFormat'
import { FdPercent } from '../../components/dasbor/FdPercent'
import { PanelValuasi, PanelPerSaham, PanelSolvency, PanelEfektivitas, PanelSkor } from './stock-detail/KolomValuasi'
import { PanelKuartalan, PanelProfitabilitas, PanelGrowth, PanelDividen, PanelRiwayatDividen } from './stock-detail/KolomKuartalan'
import { PanelIncome, PanelBalance, PanelCashflow, PanelPerformance, PanelTahunan } from './stock-detail/KolomLaporan'
import { PanelValuasiInteraktif } from './stock-detail/PanelValuasiInteraktif'
import { PanelLaporanKeuangan } from './stock-detail/PanelLaporanKeuangan'
import { IkonMenu, IKON_CARI, IKON_PERINGATAN, IKON_JAM } from '../../components/dasbor/IkonMenu'

type Tab = 'statistik' | 'valuasi'

/** Chip saham populer di empty state — daftar beku dari mockup. */
const POPULER = ['BBCA', 'BBRI', 'TLKM', 'ASII', 'AMMN', 'TPIA']

/** localStorage "terakhir dilihat" — simpan maks 3 ticker terakhir. */
const RECENT_KEY = 'sd_recent_tickers'

function bacaRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 3) : []
  } catch {
    return []
  }
}

/** Satu sel strip rasio (.rasio mockup): label + nilai + sub. */
function RasioCell({ lbl, v, cls, sub }: { lbl: string; v: ReactNode; cls?: string; sub?: ReactNode }) {
  return (
    <div>
      <span className="lbl">{lbl}</span>
      <div className={`v num${cls ? ' ' + cls : ''}`}>{v}</div>
      <span className="sub">{sub ?? ' '}</span>
    </div>
  )
}

/**
 * Panel "Stock Detail" — search custom-autocomplete → fetch on-demand
 * data-idx/json/fundamental/{KODE}.json. Re-layout mockup
 * stock-detail-relayout.html:
 * - Empty state: pencarian jadi panggung tengah (.empty) + chip populer +
 *   terakhir dilihat (localStorage); kotak cari atas DISEMBUNYIKAN di state
 *   ini (dobel fungsi), tampil lagi begitu ada ticker aktif.
 * - Halaman data: hero 3 zona (.hero) + strip rasio (.rasio) + konten 2
 *   kolom seimbang (.duo) menggantikan .fd-layout 3 kolom lama.
 *
 * Task 11: dipecah jadi 2 tab lewat `?tab=` (bukan modal) — isian simulasi
 * Graham/DDM di tab valuasi harus tetap bisa dibagikan lewat tautan, dan
 * modal akan membuang hasil simulasi saat ditutup.
 */
export function StockDetail() {
  const { index } = useStockIndex()
  const [inputVal, setInputVal] = useState('')
  const [activeTicker, setActiveTicker] = useState<string | null>(null)
  const { data: fd, loading, error } = useStockFundamental(activeTicker)
  const [sp, setSp] = useSearchParams()
  const tab: Tab = sp.get('tab') === 'valuasi' ? 'valuasi' : 'statistik'

  const [recent, setRecent] = useState<string[]>(bacaRecent)
  useEffect(() => {
    if (!fd) return
    setRecent((prev) => {
      const next = [fd.ticker, ...prev.filter((t) => t !== fd.ticker)].slice(0, 3)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* storage penuh/privat — abaikan */ }
      return next
    })
  }, [fd])

  function handleSubmit(raw: string) {
    const kode = raw.trim().toUpperCase().replace('.JK', '')
    if (!kode) return
    setInputVal(kode)
    setActiveTicker(kode)
  }

  // ── Turunan hero & rasio ──
  const lo = fd?.week52_low ?? null
  const hi = fd?.week52_high ?? null
  const px = fd?.last_price ?? null
  const pos52 = lo != null && hi != null && px != null && hi !== lo
    ? Math.max(2, Math.min(98, ((px - lo) / (hi - lo)) * 100))
    : null
  // financial_currency dari JSON fundamental; fallback ke currency (saat ini
  // financial_currency masih null di semua file — currency terisi "IDR").
  const mataUang = (fd?.financial_currency as string | undefined) ?? fd?.currency ?? null
  const earningsYield = fd?.eps && fd.last_price ? (fd.eps / fd.last_price) * 100 : null

  return (
    <div className="lantai">
      {activeTicker && (
        <div>
          {/* Proporsi #81: input dominan (flex:1 di StockAutocomplete, cap
              lebar wajar di wrap), tombol ramping ikon-saja + aria-label. */}
          <div className="fd-search-wrap" style={{ maxWidth: 480, marginBottom: 6, flexWrap: 'nowrap' }}>
            <StockAutocomplete stocks={index?.stocks ?? []} value={inputVal} onChange={setInputVal} onSelect={handleSubmit} />
            <button
              type="button" className="btn-p" aria-label="Tampilkan"
              style={{ padding: '7px 12px', flexShrink: 0 }}
              onClick={() => handleSubmit(inputVal)}
            >
              <IkonMenu d={IKON_CARI} size={14} />
            </button>
          </div>
          {/* "Data delay" saja menyisakan pertanyaan yang justru menentukan:
              tertinggal lima belas menit atau tiga hari? Tanggalnya membuat
              pembaca menilai sendiri, bukan menebak. Ditempel hanya kalau
              memang ada — "Terakhir diperbarui —" lebih buruk daripada diam. */}
          <p style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>
            Data delay, bukan harga real-time.{fd?.updated ? ` Terakhir diperbarui ${fd.updated}.` : ''}
          </p>
        </div>
      )}

      {!activeTicker && (
        <div className="panel">
          <div className="empty">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <p><b>Cari kode saham IDX</b> untuk membedah data fundamentalnya — valuasi, laporan kuartalan, dividen, arus kas.</p>
            <div className="cari">
              <StockAutocomplete stocks={index?.stocks ?? []} value={inputVal} onChange={setInputVal} onSelect={handleSubmit} />
              <button type="button" className="btn-p" onClick={() => handleSubmit(inputVal)}>Tampilkan</button>
            </div>
            <div className="chips">
              {POPULER.map((t) => (
                <button key={t} type="button" className="chip-t" onClick={() => handleSubmit(t)}>{t}</button>
              ))}
            </div>
            {recent.length > 0 && (
              <span className="lbl">
                Terakhir dilihat:{' '}
                {recent.map((t, i) => (
                  <span key={t}>
                    {i > 0 && ' · '}
                    <button type="button" className="chip-r" onClick={() => handleSubmit(t)}>{t}</button>
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      )}

      {activeTicker && loading && (
        <div className="fd-empty">
          <p><IkonMenu d={IKON_JAM} size={28} /></p>
          <p>Mengambil data {activeTicker}…</p>
        </div>
      )}

      {activeTicker && !loading && error && (
        <div className="fd-empty">
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p>Data <strong>{activeTicker}</strong> tidak ditemukan.</p>
          <p style={{ fontSize: 10, marginTop: 8 }}>Pastikan kode saham benar (contoh: BBCA, ASII, TLKM)</p>
        </div>
      )}

      {activeTicker && !loading && !error && fd && (
        <>
          {/* Hero 3 zona: identitas | harga + rentang 52 minggu | grid 6 stat */}
          <div className="panel hero">
            <div className="ident">
              <span className="tk">{fd.ticker} · IDX</span>
              <div className="nm">{fd.name || ''}</div>
              <div className="sek">{fd.sector || ''}{fd.industry ? ' · ' + fd.industry : ''}</div>
              {mataUang && <span className="badge">Laporan: {mataUang}</span>}
            </div>
            <div className="harga">
              <span className="px num">{px != null ? 'Rp ' + Number(px).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'}</span>
              <div className="rng">
                <span className="lbl">
                  Rentang 52 Minggu{fd.week52_change_pct != null && <> · <FdPercent v={fd.week52_change_pct} d={2} /></>}
                </span>
                <div className="rngbar">{pos52 != null && <i style={{ left: `calc(${pos52}% - 5px)` }} />}</div>
                <div className="mm">
                  <span>{lo != null ? Number(lo).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'}</span>
                  <span>{hi != null ? Number(hi).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'}</span>
                </div>
              </div>
            </div>
            <div className="statgrid">
              <div><span className="lbl">Mkt Cap</span><span className="v">{fMC(fd.market_cap)}</span></div>
              <div><span className="lbl">EV</span><span className="v">{fMC(fd.enterprise_value)}</span></div>
              <div><span className="lbl">Vol Avg</span><span className="v">{fd.avg_volume ? (fd.avg_volume / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' Jt' : '—'}</span></div>
              <div><span className="lbl">Free Float</span><span className="v">{fd.float_pct ? fd.float_pct.toFixed(2) + '%' : '—'}</span></div>
              <div><span className="lbl">Saham Beredar</span><span className="v">{fd.shares ? (fd.shares / 1e9).toFixed(2) + ' M' : '—'}</span></div>
              <div><span className="lbl">Beta</span><span className="v">{fd.beta ?? '—'}</span></div>
            </div>
          </div>

          {/* Strip rasio full-width 6 sel */}
          <div className="rasio">
            <RasioCell lbl="P/E (TTM)" v={fvx(fd.pe)} sub={fd.forward_pe != null ? `fwd ${fvx(fd.forward_pe)}` : null} />
            <RasioCell lbl="P/B" v={fvx(fd.pb)} sub={fd.bv != null ? `BV Rp ${fv(fd.bv)}` : null} />
            <RasioCell lbl="P/S (TTM)" v={fvx(fd.ps)} sub={fd.rev_ps != null ? `Rev/shr Rp ${fv(fd.rev_ps)}` : null} />
            <RasioCell
              lbl="Earnings Yield"
              v={earningsYield != null ? (earningsYield >= 0 ? '+' : '') + earningsYield.toFixed(2) + '%' : '—'}
              cls={earningsYield != null ? (earningsYield >= 0 ? 'up' : 'dn') : undefined}
              sub={fd.eps != null ? `EPS Rp ${fv(fd.eps)}` : null}
            />
            <RasioCell
              lbl="Div Yield"
              v={fd.dividend_yield != null ? '+' + fd.dividend_yield.toFixed(2) + '%' : '—'}
              cls={fd.dividend_yield != null ? 'up' : undefined}
              sub={fd.dividend != null
                ? `Rp ${fv(fd.dividend)}${fd.payout_ratio != null ? ` · payout ${(fd.payout_ratio * 100).toFixed(0)}%` : ''}`
                : null}
            />
            <RasioCell lbl="FCF/Share" v={fd.fcf_ps != null ? `Rp ${fv(fd.fcf_ps)}` : '—'} sub={fd.cash_ps != null ? `Cash/shr Rp ${fv(fd.cash_ps)}` : null} />
          </div>

          <div style={{ fontSize: 9, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span><IkonMenu d={IKON_JAM} size={11} /> Data delay · Diperbarui: {fd.updated || '—'}</span>
            <Link to={`/forum/${fd.ticker}`} className="bchip bchip-klik" style={{ cursor: 'pointer' }}>
              Diskusi {fd.ticker}
            </Link>
          </div>

          <div className="tabs" role="tablist" aria-label="Tab Detail Saham">
            <button
              type="button" role="tab" aria-selected={tab === 'statistik'}
              className={'tab' + (tab === 'statistik' ? ' on' : '')}
              onClick={() => setSp({ tab: 'statistik' }, { replace: true })}
            >
              Statistik
            </button>
            <button
              type="button" role="tab" aria-selected={tab === 'valuasi'}
              className={'tab' + (tab === 'valuasi' ? ' on' : '')}
              onClick={() => setSp({ tab: 'valuasi' }, { replace: true })}
            >
              Valuasi
            </button>
          </div>

          {tab === 'statistik' && (
            /* #99: panel Laporan Keuangan (chart + breakdown kuartal/tahunan)
               di luar .duo — perlu lebar penuh untuk chart & tabel periode,
               bukan kolom sempit 340px seperti panel ringkas lain. */
            <PanelLaporanKeuangan ticker={fd.ticker} />
          )}

          {tab === 'statistik' && (
            /* #93 Key Stats — panel anak langsung .duo (multicol), urutan
               kiri→kanan ala referensi Stockbit: valuasi & per-saham dulu,
               solvabilitas & efektivitas, profitabilitas/growth/dividen,
               lalu kuartalan + laporan ringkas + skor + performance. */
            <div className="duo">
              <PanelValuasi fd={fd} />
              <PanelPerSaham fd={fd} />
              <PanelSolvency fd={fd} />
              <PanelEfektivitas fd={fd} />
              <PanelProfitabilitas fd={fd} />
              <PanelGrowth fd={fd} />
              <PanelDividen fd={fd} />
              <PanelRiwayatDividen fd={fd} />
              <PanelKuartalan fd={fd} />
              <PanelTahunan fd={fd} />
              <PanelIncome fd={fd} />
              <PanelBalance fd={fd} />
              <PanelCashflow fd={fd} />
              <PanelSkor fd={fd} />
              <PanelPerformance fd={fd} />
            </div>
          )}

          {tab === 'valuasi' && <PanelValuasiInteraktif key={fd.ticker} fd={fd} />}
        </>
      )}
    </div>
  )
}
