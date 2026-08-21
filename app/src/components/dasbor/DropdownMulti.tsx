import { useEffect, useRef, useState } from 'react'
import { useArahBuka } from './useArahBuka'

export interface OpsiMulti {
  nilai: string
  label: string
  jumlah?: number
  keterangan?: string
}

interface DropdownMultiProps {
  label: string
  opsi: OpsiMulti[]
  nilai: string[]
  onGanti: (nilai: string[]) => void
  ariaLabel: string
  /** Teks tombol saat nol pilihan. Bawaan "Semua". */
  ringkasKosong?: string
}

/**
 * Ringkasan yang tampil di tombol — nol pilihan → `ringkasKosong`, satu →
 * label opsi itu, ≥2 → "N dipilih". Diekstrak jadi fungsi murni (bukan
 * dihitung inline di render) supaya bisa diuji tanpa testing-library, yang
 * belum jadi dependensi proyek ini (lihat `DropdownMulti.test.tsx`).
 */
export function ringkasPilihan(nilai: string[], opsi: OpsiMulti[], ringkasKosong = 'Semua'): string {
  if (nilai.length === 0) return ringkasKosong
  if (nilai.length === 1) return opsi.find((o) => o.nilai === nilai[0])?.label ?? nilai[0]
  return `${nilai.length} dipilih`
}

/**
 * Dropdown checklist (#170) — dipakai saat pemilihannya boleh LEBIH dari satu
 * (mis. Rating/Sektor Screener), beda dari `Dropdown.tsx` yang satu nilai
 * saja. Kerangka & primitif CSS (`.dd`/`.dd-btn`/`.dd-menu`) sama persis,
 * termasuk arah buka lewat `useArahBuka` bersama — jangan disalin ulang.
 *
 * Lahir 21 Agu 2026 dari perombakan kedua bilah saring Screener: Johan
 * "tombol-tombol ini perlu di rapikan mgkn bisa di buat dropdown ceklist".
 * Dropdown MERAPIKAN tapi menyembunyikan apa yang aktif — makanya pemanggil
 * (Screener.tsx) menaruh baris chip "sedang aktif" di bawah bilah, bukan
 * komponen ini yang menampilkannya, supaya `DropdownMulti` tetap generik
 * dipakai halaman lain tanpa terikat pola chip Screener.
 */
export function DropdownMulti({ label, opsi, nilai, onGanti, ariaLabel, ringkasKosong }: DropdownMultiProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const bukaAtas = useArahBuka(ref, open)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open) { setQ(''); return }
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      ref.current?.querySelector<HTMLButtonElement>('.dd-btn')?.focus()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    if (!open) { setOpen(true); return }
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('.dd-it, .dd-multi-hdr button') ?? [])]
    if (!items.length) return
    const idx = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0)
    items[next].focus()
  }

  function toggle(v: string) {
    onGanti(nilai.includes(v) ? nilai.filter((x) => x !== v) : [...nilai, v])
  }

  const pakaiCari = opsi.length >= 10
  const kata = q.trim().toLowerCase()
  const tampil = kata ? opsi.filter((o) => o.label.toLowerCase().includes(kata)) : opsi

  return (
    <div className={`dd${open ? ' open' : ''}${bukaAtas ? ' dd-atas' : ''}`} ref={ref} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="dd-btn"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}: {ringkasPilihan(nilai, opsi, ringkasKosong)}
        {nilai.length > 0 && <span className="dd-badge">{nilai.length}</span>}
        <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className="dd-menu" role="listbox" aria-label={ariaLabel} aria-multiselectable="true">
        {pakaiCari && (
          <input
            className="dd-cari"
            value={q}
            placeholder="Cari…"
            aria-label={`Cari ${ariaLabel}`}
            onChange={(e) => setQ(e.target.value)}
          />
        )}
        <div className="dd-multi-hdr">
          <button type="button" className="chip-t" onClick={() => onGanti(opsi.map((o) => o.nilai))}>Pilih semua</button>
          <button type="button" className="chip-t" onClick={() => onGanti([])}>Bersihkan</button>
        </div>
        {pakaiCari && tampil.length === 0 && <p className="dd-kosong">Tak ada yang cocok.</p>}
        {tampil.map((o) => (
          <label key={o.nilai} className="dd-it dd-it-multi" title={o.keterangan}>
            <input type="checkbox" checked={nilai.includes(o.nilai)} onChange={() => toggle(o.nilai)} />
            <span className="dd-it-teks">{o.label}</span>
            {o.jumlah != null && <span className="muted dd-it-jumlah">{o.jumlah}</span>}
          </label>
        ))}
      </div>
    </div>
  )
}
