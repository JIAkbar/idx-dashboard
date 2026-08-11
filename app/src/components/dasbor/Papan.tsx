/**
 * Papan split-flap — tiap karakter angka jadi satu kartu .flap, pemisah ribuan
 * dan koma memakai varian .sym. Port docs/design-lantai-bursa-reimagined.html
 * baris 121-129 (animasi flip + jeda bertahap per kartu ada di CSS).
 */
export function Papan({ nilai }: { nilai: number }) {
  const teks = nilai.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <div className="flap-row">
      {[...teks].map((ch, i) => (
        <span key={i} className={/\d/.test(ch) ? 'flap' : 'flap sym'}>{ch}</span>
      ))}
    </div>
  )
}
