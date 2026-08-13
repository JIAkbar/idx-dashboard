import { useEffect, useRef, useState } from 'react'

export interface OpsiDropdown {
  nilai: string
  label: string
}

interface DropdownProps {
  opsi: OpsiDropdown[]
  nilai: string
  onGanti: (nilai: string) => void
  ariaLabel?: string
  /** Label tombol saat `nilai` tidak ada di `opsi` (mis. Kalender menampilkan bulan berjalan di luar rentang data). */
  placeholder?: string
}

/**
 * Dropdown generik dari primitif `.dd`/`.dd-btn`/`.dd-menu`/`.dd-it` lantai.css
 * (#82) — satu komponen menggantikan semua `<select>` native + pola .dd manual
 * yang dulu diduplikasi di Kalender.tsx & BrokerSummary.tsx: buka/tutup klik
 * tombol, klik luar menutup, chevron berputar (CSS `.dd.open`), item terpilih
 * amber (`.sel`). Keyboard: Escape menutup, panah atas/bawah memindah fokus
 * antar item, Enter memilih (klik native tombol terfokus).
 */
export function Dropdown({ opsi, nilai, onGanti, ariaLabel, placeholder }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  const label = opsi.find((o) => o.nilai === nilai)?.label ?? placeholder ?? '—'

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      ref.current?.querySelector<HTMLButtonElement>('.dd-btn')?.focus()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    if (!open) {
      setOpen(true)
      return
    }
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('.dd-it') ?? [])]
    if (!items.length) return
    // idx -1 (fokus masih di tombol) → panah bawah/atas sama-sama masuk ke item pertama.
    const idx = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0)
    items[next].focus()
  }

  return (
    <div className={`dd${open ? ' open' : ''}`} ref={ref} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="dd-btn"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className="dd-menu" role="listbox" aria-label={ariaLabel}>
        {opsi.map((o) => (
          <button
            key={o.nilai}
            type="button"
            role="option"
            aria-selected={o.nilai === nilai}
            className={`dd-it${o.nilai === nilai ? ' sel' : ''}`}
            onClick={() => {
              onGanti(o.nilai)
              setOpen(false)
              // Item yang barusan diklik ikut tersembunyi (menu display:none) —
              // tanpa ini fokus jatuh ke <body> dan navigasi keyboard mati.
              ref.current?.querySelector<HTMLButtonElement>('.dd-btn')?.focus()
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
