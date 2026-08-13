import { useRef, type CSSProperties, type PointerEvent } from 'react'

/**
 * Arah swipe dari delta pointer (#97): null kalau di bawah threshold 40px
 * atau gerakan dominan vertikal (biar scroll halaman tidak terganggu).
 * 1 = swipe kiri (maju/berikutnya), -1 = swipe kanan (mundur/sebelumnya).
 */
export function arahSwipe(dx: number, dy: number): -1 | 1 | null {
  if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return null
  return dx < 0 ? 1 : -1
}

/**
 * Gesture geser horizontal (#97) via pointer events — spread hasilnya ke
 * elemen target: `<div {...swipe}>`. `touch-action: pan-y` membiarkan
 * scroll vertikal tetap native sementara pan horizontal dikirim ke JS.
 * Posisi awal disimpan di ref (bukan closure) karena komponen kalender
 * re-render tiap detik (jam bursa) — closure bakal ke-reset di tengah swipe.
 */
export function useSwipe(onSwipe: (arah: -1 | 1) => void) {
  const awal = useRef<{ x: number; y: number } | null>(null)
  return {
    style: { touchAction: 'pan-y' } as CSSProperties,
    onPointerDown(e: PointerEvent) {
      awal.current = { x: e.clientX, y: e.clientY }
    },
    onPointerUp(e: PointerEvent) {
      const a = awal.current
      awal.current = null
      if (!a) return
      const arah = arahSwipe(e.clientX - a.x, e.clientY - a.y)
      if (arah !== null) onSwipe(arah)
    },
    onPointerCancel() {
      awal.current = null
    },
  }
}
