import { useMemo, useState, type KeyboardEvent } from 'react'
import type { StockIndexEntry } from '../../lib/dasbor/stockDetailData'

interface StockAutocompleteProps {
  stocks: StockIndexEntry[]
  value: string
  onChange: (v: string) => void
  /** Dipanggil saat item dipilih (klik/Enter pada item aktif) ATAU Enter/submit tanpa item aktif. */
  onSelect: (ticker: string) => void
  placeholder?: string
  /** Opsional (#101) — ticker dalam set ini dapat badge di kanan item saran.
   *  Dipakai AdminHome menandai emiten yang sudah terunggah tanggal aktif;
   *  tanpa prop ini perilaku persis sama seperti sebelumnya (mis. Stock Detail). */
  tandai?: ReadonlySet<string>
  /** Teks badge, default "terunggah". */
  labelTanda?: string
}

/**
 * Dropdown autocomplete custom — port fdAcFilter/fdAcShow/fdAcHide/fdAcSelect/
 * fdAcKey index_live.html baris 3784-3847. fdAcFilter & fdAcShow di sumber
 * punya logic filter identik (satu dipanggil saat mengetik, satu saat fokus)
 * — di sini disatukan lewat satu `matches` yang selalu dihitung dari `value`.
 */
export function StockAutocomplete({ stocks, value, onChange, onSelect, placeholder = 'Kode saham: BBCA, ASII, TLKM…', tandai, labelTanda = 'terunggah' }: StockAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const matches = useMemo(() => {
    const q = value.trim().toUpperCase()
    const list = q
      ? stocks.filter((s) => s.ticker.startsWith(q) || s.name.toUpperCase().includes(q))
      : stocks
    return list.slice(0, 10)
  }, [stocks, value])

  function selectTicker(ticker: string) {
    setOpen(false)
    setActiveIndex(-1)
    onSelect(ticker)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1 >= matches.length ? 0 : i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 < 0 ? matches.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && matches[activeIndex]) selectTicker(matches[activeIndex].ticker)
      else { setOpen(false); onSelect(value) }
    } else if (e.key === 'Escape') {
      // Saat menu saran terbuka, Escape cuma menutup menu — jangan merambat
      // ke pendengar Escape level modal/halaman.
      if (open) e.stopPropagation()
      setOpen(false)
    }
  }

  const showMenu = open && matches.length > 0

  return (
    <div className={`dd${showMenu ? ' open' : ''}`} style={{ flex: 1, minWidth: 160, position: 'relative' }}>
      <input
        className="inp"
        type="text"
        placeholder={placeholder}
        autoComplete="off"
        value={value}
        onChange={(e) => { onChange(e.target.value.toUpperCase()); setActiveIndex(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={handleKeyDown}
        style={value ? { paddingRight: 30 } : undefined}
      />
      {value !== '' && (
        <button
          type="button"
          aria-label="Bersihkan kode saham"
          title="Bersihkan"
          onMouseDown={(e) => { e.preventDefault(); onChange(''); setActiveIndex(-1); setOpen(true) }}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0,
          }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
      {showMenu && (
        <div className="dd-menu" style={{ right: 0, maxHeight: 260, overflowY: 'auto' }}>
          {matches.map((s, i) => (
            <div
              key={s.ticker}
              className={`dd-it${i === activeIndex ? ' sel' : ''}`}
              onMouseDown={() => selectTicker(s.ticker)}
            >
              <span className="tick" style={{ minWidth: 52, flexShrink: 0 }}>{s.ticker}</span>
              <span className="satu-baris" style={{ flex: 1, minWidth: 0, color: 'var(--text3)', fontSize: 11 }}>{s.name}</span>
              {tandai?.has(s.ticker) && (
                <span style={{
                  flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                  background: 'var(--amber-dim)', color: 'var(--amber)', padding: '1px 6px', borderRadius: 3,
                }}>{labelTanda}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
