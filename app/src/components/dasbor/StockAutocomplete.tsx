import { useMemo, useState, type KeyboardEvent } from 'react'
import type { StockIndexEntry } from '../../lib/dasbor/stockDetailData'

interface StockAutocompleteProps {
  stocks: StockIndexEntry[]
  value: string
  onChange: (v: string) => void
  /** Dipanggil saat item dipilih (klik/Enter pada item aktif) ATAU Enter/submit tanpa item aktif. */
  onSelect: (ticker: string) => void
}

/**
 * Dropdown autocomplete custom — port fdAcFilter/fdAcShow/fdAcHide/fdAcSelect/
 * fdAcKey index_live.html baris 3784-3847. fdAcFilter & fdAcShow di sumber
 * punya logic filter identik (satu dipanggil saat mengetik, satu saat fokus)
 * — di sini disatukan lewat satu `matches` yang selalu dihitung dari `value`.
 */
export function StockAutocomplete({ stocks, value, onChange, onSelect }: StockAutocompleteProps) {
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
      setOpen(false)
    }
  }

  return (
    <div className="fd-ac-wrap">
      <input
        className="inp"
        type="text"
        placeholder="Kode saham: BBCA, ASII, TLKM ..."
        autoComplete="off"
        value={value}
        onChange={(e) => { onChange(e.target.value.toUpperCase()); setActiveIndex(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={handleKeyDown}
      />
      {open && matches.length > 0 && (
        <div className="fd-ac-dropdown">
          {matches.map((s, i) => (
            <div
              key={s.ticker}
              className={`fd-ac-item${i === activeIndex ? ' ac-active' : ''}`}
              onMouseDown={() => selectTicker(s.ticker)}
            >
              <span className="fd-ac-ticker">{s.ticker}</span>
              <span className="fd-ac-name">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
