/**
 * Ikon menu — satu <path> di atas viewBox 24×24, digambar sendiri (lihat
 * `menu.ts`). Pakai `stroke: currentColor` supaya warnanya ikut warna teks
 * induknya, jadi tema terang/gelap dan keadaan aktif tidak perlu diurus
 * terpisah. Dipakai Sidebar (rail) dan MobileNav (bilah bawah + laci).
 */
export function IkonMenu({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg
      className="dasbor-ikon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}
