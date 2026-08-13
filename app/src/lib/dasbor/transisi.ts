import type { MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'

/**
 * Transisi antar halaman (#79) — View Transitions API, progressive enhancement:
 * browser tanpa API (atau user dengan prefers-reduced-motion) langsung pindah
 * tanpa animasi. flushSync memaksa React merender rute baru DI DALAM callback
 * startViewTransition — tanpa itu snapshot "baru" diambil sebelum DOM berubah
 * dan tidak ada yang teranimasi. Animasinya sendiri milik CSS
 * (::view-transition-* di lantai.css, blok "#79 transisi rute").
 */
export function mulaiTransisi(perbarui: () => void) {
  if (
    !document.startViewTransition ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    perbarui()
    return
  }
  document.startViewTransition(() => {
    flushSync(perbarui)
  })
}

/**
 * Handler klik untuk NavLink/Link rute internal: batalkan navigasi bawaan lalu
 * jalankan navigate() di dalam view transition. Klik modifier (Ctrl/Cmd/Shift/
 * tengah — buka tab/jendela baru) diteruskan ke perilaku bawaan browser.
 */
export function useKlikTransisi() {
  const navigate = useNavigate()
  return (e: MouseEvent<HTMLAnchorElement>, ke: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    mulaiTransisi(() => navigate(ke))
  }
}
