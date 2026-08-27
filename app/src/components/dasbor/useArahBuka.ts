import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Diputus dari `Dropdown.tsx` (21 Agu 2026, bug #170 dobel) supaya
 * `DropdownMulti.tsx` tak menyalin logikanya — persis jenis duplikasi yang
 * baru dibayar (panel pendek memaksa menu membuka ke atas, lalu menu
 * mengambang liar di panel satu-baris). Mengukur arah buka menu `.dd-menu`
 * di dalam `ref`.
 *
 * VERTIKAL — batas jatuh = kartu `.panel` terdekat (modal ATAU panel biasa)
 * kalau ada; dropdown dekat ujung modal pendek jangan menutupi kontrol di
 * bawahnya walau viewport sendiri masih longgar (bug #3). Tanpa `.panel`
 * baru pakai batas viewport; panel yang terlalu pendek untuk arah mana pun
 * diabaikan (bilah saring satu-baris Kartu Analisa, 21 Agu 2026).
 *
 * HORIZONTAL — ditambah 27 Agu 2026 (sweep Johan: 6 dropdown keluar tepi
 * viewport 5–99px di ponsel). Menu rata kiri tombol secara baku; kalau ujung
 * kanannya menembus viewport DAN rata kanan muat, membalik jadi rata kanan
 * (dan kebalikannya untuk `rata="kanan"` dekat tepi kiri). Kalau KEDUA arah
 * tak muat (menu ≈ selebar viewport, tombol di tengah) menu digeser paksa
 * lewat marginLeft. Dua jebakan yang membuat versi pertama gagal senyap:
 * (a) acuan ukur harus elemen `.dd` — `ref` DatePicker adalah `.dpk-wrap`
 * yang memuat stepper pengapit, jadi tepi kanannya bohong; (b) menu bisa
 * BERUBAH LEBAR setelah terbuka (katalog indikator Grafik termuat async,
 * placeholder sempit → daftar lebar) — sekali ukur saat open tidak cukup,
 * ResizeObserver mengukur ulang tiap ukuran menu berubah.
 */
export function useArahBuka(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  rataDiminta: 'kiri' | 'kanan' = 'kiri',
): { bukaAtas: boolean; rataKanan: boolean } {
  const [bukaAtas, setBukaAtas] = useState(false)
  const [rataKanan, setRataKanan] = useState(rataDiminta === 'kanan')

  useLayoutEffect(() => {
    if (!open) { setBukaAtas(false); setRataKanan(rataDiminta === 'kanan'); return }
    const induk = ref.current
    if (!induk) return
    const wadah = induk.classList.contains('dd') ? induk : (induk.querySelector<HTMLElement>('.dd') ?? induk)
    const menu = wadah.querySelector<HTMLElement>('.dd-menu')
    if (!menu) return

    const ukur = () => {
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

      const lebarMenu = menu.offsetWidth
      const muatKiri = rWadah.left + lebarMenu <= window.innerWidth - 8 // rata kiri tombol
      const muatKanan = rWadah.right - lebarMenu >= 8                   // rata kanan tombol
      if (!muatKiri && !muatKanan) {
        setRataKanan(false)
        const keluarKanan = rWadah.left + lebarMenu - (window.innerWidth - 8)
        menu.style.marginLeft = `-${Math.max(0, Math.min(keluarKanan, rWadah.left - 8))}px`
      } else {
        menu.style.marginLeft = ''
        if (rataDiminta === 'kanan') setRataKanan(muatKanan || !muatKiri)
        else setRataKanan(!muatKiri && muatKanan)
      }
    }

    ukur()
    const ro = new ResizeObserver(ukur)
    ro.observe(menu)
    return () => ro.disconnect()
  }, [open, ref, rataDiminta])

  return { bukaAtas, rataKanan }
}
