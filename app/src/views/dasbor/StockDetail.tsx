import { useState } from 'react'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { useStockFundamental, useStockIndex } from '../../lib/dasbor/stockDetailData'
import { fMC } from '../../lib/dasbor/stockDetailFormat'
import { FdPercent } from '../../components/dasbor/FdPercent'
import { KolomValuasi } from './stock-detail/KolomValuasi'
import { KolomKuartalan } from './stock-detail/KolomKuartalan'
import { KolomLaporan } from './stock-detail/KolomLaporan'
import { PanelValuasiInteraktif } from './stock-detail/PanelValuasiInteraktif'

/**
 * Panel "Stock Detail" — port markup baris 2184-2215 + fdInit/fdLoad/fdRender
 * index_live.html baris 3767-4448. Search custom-autocomplete → fetch
 * on-demand data/fundamental/{KODE}.json → render overview + 3 kolom +
 * modul valuasi interaktif.
 */
export function StockDetail() {
  const { index } = useStockIndex()
  const [inputVal, setInputVal] = useState('')
  const [activeTicker, setActiveTicker] = useState<string | null>(null)
  const { data: fd, loading, error } = useStockFundamental(activeTicker)

  function handleSubmit(raw: string) {
    const kode = raw.trim().toUpperCase().replace('.JK', '')
    if (!kode) return
    setInputVal(kode)
    setActiveTicker(kode)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="card" style={{ padding: '14px 16px', marginBottom: 8 }}>
        <div className="fd-search-wrap">
          <StockAutocomplete stocks={index?.stocks ?? []} value={inputVal} onChange={setInputVal} onSelect={handleSubmit} />
          <button type="button" className="fd-search-btn" onClick={() => handleSubmit(inputVal)}>🔍 Tampilkan</button>
        </div>
        <p style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>Data delay. Harga tidak real-time.</p>
      </div>

      {!activeTicker && (
        <div className="fd-empty">
          <p style={{ fontSize: 32, marginBottom: 8 }}>📋</p>
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
          <p style={{ fontSize: 28 }}>⚠️</p>
          <p>Data <strong>{activeTicker}</strong> tidak ditemukan.</p>
          <p style={{ fontSize: 10, marginTop: 8 }}>Pastikan kode saham benar (contoh: BBCA, ASII, TLKM)</p>
        </div>
      )}

      {activeTicker && !loading && !error && fd && (
        <>
          <div className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{fd.ticker}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '2px 0' }}>{fd.name || ''}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{fd.sector || ''}{fd.industry ? ' · ' + fd.industry : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{fd.last_price ? 'Rp ' + Number(fd.last_price).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>Mkt Cap: <strong style={{ color: 'var(--text)' }}>{fMC(fd.market_cap)}</strong> · EV: {fMC(fd.enterprise_value)}</div>
                <div style={{ fontSize: 9.5, color: 'var(--text3)', marginTop: 2 }}>
                  52W: {fd.week52_low ? 'Rp' + Number(fd.week52_low).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'} – {fd.week52_high ? 'Rp' + Number(fd.week52_high).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '—'}
                  {fd.week52_change_pct != null && <> · <FdPercent v={fd.week52_change_pct} /></>}
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--text3)' }}>
                  Beta: <strong style={{ color: 'var(--text)' }}>{fd.beta ?? '—'}</strong>
                  {fd.avg_volume ? ` · Vol Avg: ${(fd.avg_volume / 1e6).toFixed(1)}M` : ''}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 6, borderTop: '0.5px solid var(--border)', paddingTop: 5 }}>
              ⏱ Data delay · Diperbarui: {fd.updated || '—'}
            </div>
          </div>

          <div className="fd-layout">
            <KolomValuasi fd={fd} />
            <KolomKuartalan fd={fd} />
            <KolomLaporan fd={fd} />
          </div>

          <PanelValuasiInteraktif key={fd.ticker} fd={fd} />
        </>
      )}
    </div>
  )
}
