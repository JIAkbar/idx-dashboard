import { useEffect, useRef, type KeyboardEvent } from 'react'
import { IkonMenu, IKON_SILANG } from './IkonMenu'

/** Satu gambar di lightbox — src bisa signed URL storage atau object URL lokal. */
export interface GambarLightbox {
  src: string
  /** Keterangan bermakna, jadi caption + alt + aria-label ("BREN · Orderbook · 13 Agu 2026"). */
  keterangan: string
}

/**
 * Lightbox pratinjau gambar gaya Lantai (#94) — overlay gelap layar penuh,
 * gambar besar object-fit contain, caption di bawah, navigasi ‹ › antar item.
 * Tutup: tombol, Escape, klik latar. Panah kiri/kanan pindah gambar.
 *
 * Aksesibilitas: fokus pindah ke dialog saat buka & kembali ke pemicu saat
 * tutup; focus trap sederhana (Tab berputar di tombol-tombol dialog).
 * Escape di-stopPropagation supaya modal induk (mis. form Tambah Emiten yang
 * pasang listener Escape di window) tidak ikut tertutup.
 *
 * Gaya .af-lb-* hidup di AdminHome.css — komponen ini hanya dipakai dari
 * halaman admin.
 */
export function LightboxGambar({ items, index, onIndex, onClose }: {
  items: GambarLightbox[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const item = items[index]

  // Fokus masuk dialog saat buka, kembali ke elemen pemicu saat tutup.
  useEffect(() => {
    const sebelumnya = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => sebelumnya?.focus()
  }, [])

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      onIndex(index - 1)
    } else if (e.key === 'ArrowRight' && index < items.length - 1) {
      onIndex(index + 1)
    } else if (e.key === 'Tab') {
      // Focus trap sederhana: Tab berputar di tombol-tombol dalam dialog.
      const f = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled)')
      if (!f || f.length === 0) return
      const pertama = f[0]
      const terakhir = f[f.length - 1]
      if (e.shiftKey && document.activeElement === pertama) {
        e.preventDefault()
        terakhir.focus()
      } else if (!e.shiftKey && document.activeElement === terakhir) {
        e.preventDefault()
        pertama.focus()
      }
    }
  }

  if (!item) return null

  return (
    <div className="af-lb-bg" onClick={onClose}>
      <div
        ref={ref}
        className="af-lb"
        role="dialog"
        aria-modal="true"
        aria-label={`Pratinjau gambar: ${item.keterangan}`}
        tabIndex={-1}
        onKeyDown={onKey}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="af-lb-tutup" aria-label="Tutup pratinjau" onClick={onClose}>
          <IkonMenu d={IKON_SILANG} size={16} />
        </button>
        <img src={item.src} alt={item.keterangan} />
        <div className="af-lb-bar">
          {items.length > 1 && (
            <button
              type="button"
              className="af-lb-nav"
              aria-label="Gambar sebelumnya"
              disabled={index === 0}
              onClick={() => onIndex(index - 1)}
            >
              &lsaquo;
            </button>
          )}
          <span className="ket">
            {item.keterangan}
            {items.length > 1 && <span className="hitung"> · {index + 1}/{items.length}</span>}
          </span>
          {items.length > 1 && (
            <button
              type="button"
              className="af-lb-nav"
              aria-label="Gambar berikutnya"
              disabled={index === items.length - 1}
              onClick={() => onIndex(index + 1)}
            >
              &rsaquo;
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
