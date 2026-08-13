import { useEffect, useRef, useState } from 'react'

/**
 * #91 — muat bertahap (infinite scroll) untuk tabel panjang Peta Investor.
 * Sentinel diamati IntersectionObserver dengan root = wrapper scroll terdekat
 * (.pi-tbl-wrap), rootMargin 200px: mendekati bawah → batch berikutnya.
 * Observer dibuat ulang tiap batch supaya sentinel yang masih terlihat
 * langsung memicu batch lanjutan (callback awal IO) sampai keluar zona.
 * Kalau IO tak tersedia/gagal → `ioGagal` true, pemanggil render tombol lama.
 */
export function useMuatBertahap<T>(rows: T[], page = 20) {
  const [visibleCount, setVisibleCount] = useState(page)
  const [ioGagal, setIoGagal] = useState(typeof IntersectionObserver === 'undefined')
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Reset batch saat hasil filter/sort/pencarian berganti (identitas array useMemo).
  useEffect(() => setVisibleCount(page), [rows, page])

  const habis = visibleCount >= rows.length

  useEffect(() => {
    if (ioGagal || habis) return
    const el = sentinelRef.current
    if (!el) return
    let obs: IntersectionObserver
    try {
      obs = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) setVisibleCount((v) => v + page)
        },
        { root: el.closest('.pi-tbl-wrap'), rootMargin: '200px 0px' },
      )
      obs.observe(el)
    } catch {
      setIoGagal(true)
      return
    }
    return () => obs.disconnect()
  }, [ioGagal, habis, rows, page, visibleCount])

  return {
    visible: rows.slice(0, visibleCount),
    habis,
    ioGagal,
    sentinelRef,
    muatLagi: () => setVisibleCount((v) => v + page),
  }
}
