import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Diputus dari `Dropdown.tsx` (21 Agu 2026, bug #170 dobel) supaya
 * `DropdownMulti.tsx` tak menyalin logikanya — persis jenis duplikasi yang
 * baru dibayar (panel pendek memaksa menu membuka ke atas, lalu menu
 * mengambang liar di panel satu-baris). Mengukur apakah menu `.dd-menu` di
 * dalam `ref` harus membuka ke ATAS.
 *
 * Batas jatuh = kartu `.panel` terdekat (modal ATAU panel biasa) kalau ada —
 * dropdown dekat ujung modal pendek jangan menutupi kontrol di bawahnya
 * walau viewport sendiri masih longgar (bug #3). Tanpa `.panel` (dropdown
 * lepas) baru pakai batas viewport. Dan kalau panelnya sendiri terlalu
 * pendek untuk menampung menu ke arah MANA PUN (bilah saring satu baris di
 * Kartu Analisa, 21 Agu 2026), batas panel diabaikan — arahnya diputuskan
 * dari viewport.
 */
export function useArahBuka(ref: RefObject<HTMLElement | null>, open: boolean) {
  const [bukaAtas, setBukaAtas] = useState(false)

  useLayoutEffect(() => {
    if (!open) { setBukaAtas(false); return }
    const wadah = ref.current
    const menu = wadah?.querySelector<HTMLElement>('.dd-menu')
    if (!wadah || !menu) return
    const rWadah = wadah.getBoundingClientRect()
    const batas = wadah.closest<HTMLElement>('.panel')
    const rBatas = batas?.getBoundingClientRect()
    const batasBawah = rBatas ? rBatas.bottom : window.innerHeight
    const batasAtas = rBatas ? rBatas.top : 0
    let ruangBawah = batasBawah - rWadah.bottom
    let ruangAtas = rWadah.top - batasAtas
    const perlu = menu.offsetHeight + 8
    if (rBatas && ruangBawah < perlu && ruangAtas < perlu) {
      ruangBawah = window.innerHeight - rWadah.bottom
      ruangAtas = rWadah.top
    }
    setBukaAtas(ruangBawah < perlu && ruangAtas > ruangBawah)
  }, [open, ref])

  return bukaAtas
}
