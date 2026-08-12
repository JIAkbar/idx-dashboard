import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { useStockFundamental, useStockIndex } from '../../lib/dasbor/stockDetailData'
import { fMC } from '../../lib/dasbor/stockDetailFormat'
import { FdPercent } from '../../components/dasbor/FdPercent'
import { KolomValuasi } from './stock-detail/KolomValuasi'
import { KolomKuartalan } from './stock-detail/KolomKuartalan'
import { KolomLaporan } from './stock-detail/KolomLaporan'
import { PanelValuasiInteraktif } from './stock-detail/PanelValuasiInteraktif'
import { IkonMenu, IKON_CARI, IKON_PAPAN_KLIP, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'

type Tab = 'statistik' | 'valuasi'

/**
 * Panel "Stock Detail" — port markup baris 2184-2215 + fdInit/fdLoad/fdRender
 * index_live.html baris 3767-4448. Search custom-autocomplete → fetch
 * on-demand data/fundamental/{KODE}.json → render overview + 3 kolom +
 * modul valuasi interaktif.
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

  function handleSubmit(raw: string) {
    const kode = raw.trim().toUpperCase().replace('.JK', '')
    if (!kode) return
    setInputVal(kode)
    setActiveTicker(kode)
  }

  return (
    <div className="lantai">
      <div>
        <div className="fd-search-wrap" style={{ maxWidth: 480, marginBottom: 6 }}>
          <StockAutocomplete stocks={index?.stocks ?? []} value={inputVal} onChange={setInputVal} onSelect={handleSubmit} />
          <button type="button" className="btn-p" onClick={() => handleSubmit(inputVal)}><IkonMenu d={IKON_CARI} size={13} /> Tampilkan</button>
        </div>
        <p style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>Data delay. Harga tidak real-time.</p>
      </div>

      {!activeTicker && (
        <div className="fd-empty">
          <p style={{ marginBottom: 8 }}><IkonMenu d={IKON_PAPAN_KLIP} size={30} /></p>
          <p>Cari kode saham IDX di atas untuk melihat data fundamental</p>
        </div>
      )}

      {activeTicker && loading && (
        <div className="fd-empty">
          <p style={{ fontSize: 28 }}>⏳</p>
          <p>Mengambil data {activeTicker}...</p>
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
          <div className="board fd-board">
            <div className="board-main">
              <span className="lbl">{fd.ticker}</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '3px 0' }}>{fd.name || ''}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fd.sector || ''}{fd.industry ? ' · ' + fd.industry : ''}</div>
            </div>
            <div className="board-side" style={{ textAlign: 'right' }}>
              <span className="num" style={{ fontSize: 28, fontWeight: 600 }}>
                {fd.last_price ? 'Rp ' + Number(fd.last_price).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'}
              </span>
              <div className="board-meta" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                <div className="bm"><span className="lbl">Mkt Cap</span><span className="num">{fMC(fd.market_cap)}</span></div>
                <div className="bm"><span className="lbl">EV</span><span className="num">{fMC(fd.enterprise_value)}</span></div>
                <div className="bm"><span className="lbl">Beta</span><span className="num">{fd.beta ?? '—'}</span></div>
                {fd.avg_volume ? <div className="bm"><span className="lbl">Vol Avg</span><span className="num">{(fd.avg_volume / 1e6).toFixed(1)}M</span></div> : null}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--text3)', marginTop: 8 }}>
                52W: {fd.week52_low ? 'Rp' + Number(fd.week52_low).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'} – {fd.week52_high ? 'Rp' + Number(fd.week52_high).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'}
                {fd.week52_change_pct != null && <> · <FdPercent v={fd.week52_change_pct} /></>}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text3)' }}>
            ⏱ Data delay · Diperbarui: {fd.updated || '—'}
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
            <div className="fd-layout">
              <KolomValuasi fd={fd} />
              <KolomKuartalan fd={fd} />
              <KolomLaporan fd={fd} />
            </div>
          )}

          {tab === 'valuasi' && <PanelValuasiInteraktif key={fd.ticker} fd={fd} />}
        </>
      )}
    </div>
  )
}
