import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'

export interface PilItem {
  key: string
  nama: string
  pct: number
  title: string
}

/** Maksimum chip yang dirender di baris pengukur — desktop terlebar muat ±7,
    lebih dari ini cuma menambah beban DOM (ByInvestor bisa 65 holding). */
const MAKS_UKUR = 10
const GAP = 6 // = gap .pil-row di lantai.css
const CADANGAN_LABEL = 64 // ± lebar "+NN lagi"

/**
 * Lajur chip pemegang saham / holding yang ADAPTIF lebar (#77b revisi):
 * jumlah chip tampil dihitung dari lebar nyata kolom (baris pengukur
 * tersembunyi + ResizeObserver), bukan angka tetap — "+N lagi" baru muncul
 * saat chip berikutnya benar-benar tidak muat, dan tabel tidak pernah
 * dipaksa melebar (tanpa scroll horizontal). Chip di baris tampil tetap
 * min-width:0 sebagai jaring pengaman selisih pembulatan 1-2px.
 */
export function PilRow({ items, total, onKlikItem }: {
  items: PilItem[]
  total: number
  /** #3: chip bisa diklik (mis. lompat ke Grafik Jaringan fokus emiten/investor
   * itu) — baris <tr> pemanggil biasanya sudah punya onClick sendiri, jadi
   * chip WAJIB stopPropagation (ditangani di sini, bukan di pemanggil). */
  onKlikItem?: (item: PilItem) => void
}) {
  const ukurRef = useRef<HTMLDivElement>(null)
  const [muat, setMuat] = useState(Math.min(items.length, MAKS_UKUR))

  useLayoutEffect(() => {
    const el = ukurRef.current
    if (!el) return
    const hitung = () => {
      const lebar = el.clientWidth
      if (!lebar) return
      const anak = [...el.children] as HTMLElement[]
      let x = 0
      let n = 0
      for (const c of anak) {
        const w = c.offsetWidth
        if (x + w > lebar) break
        x += w + GAP
        n++
      }
      if (n < total) {
        // sisakan ruang label "+N lagi"
        while (n > 1 && x - GAP + CADANGAN_LABEL > lebar) {
          n--
          x -= anak[n].offsetWidth + GAP
        }
      }
      setMuat(Math.max(1, n))
    }
    hitung()
    const ro = new ResizeObserver(hitung)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items, total])

  const chip = (h: PilItem) => (
    <span
      key={h.key}
      className={`bchip${onKlikItem ? ' bchip-klik' : ''}`}
      title={h.title}
      {...(onKlikItem
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              onKlikItem(h)
            },
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onKlikItem(h)
              }
            },
          }
        : {})}
    >
      <span className="pil-nm">{h.nama}</span>
      <span className="pil-pct">{h.pct.toFixed(1)}%</span>
    </span>
  )
  const sisa = total - muat

  return (
    <div className="pil-wrap">
      {/* Baris pengukur: semua kandidat chip pada lebar natural (flex:none),
          tak terlihat & tak memengaruhi layout — sumber angka `muat`. */}
      <div ref={ukurRef} className="pil-row pil-ukur" aria-hidden="true">
        {items.slice(0, MAKS_UKUR).map(chip)}
      </div>
      <div className="pil-row">
        {items.slice(0, muat).map(chip)}
        {sisa > 0 && <span className="lbl">+{sisa} lagi</span>}
      </div>
    </div>
  )
}
