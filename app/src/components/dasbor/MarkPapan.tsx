/**
 * Lambang PAPAN — "Kurung Ukur".
 *
 * Empat siku pengukur mengepung satu bilah nilai. Siku keempat (kanan bawah)
 * SENGAJA putus-putus dan pudar: bingkainya belum penuh, dan PAPAN
 * mengatakannya alih-alih menutupinya. Bilah aksen di tengah satu-satunya
 * bagian berwarna — yang dibingkai, bukan bingkainya.
 *
 * Menggantikan ubin kuning berhuruf "P" (29 Agu 2026) karena bentuk itu sudah
 * dipakai pihak lain.
 *
 * Badan memakai `currentColor`, jadi ia ikut warna teks induknya di tema mana
 * pun. Versi berwarna tetap untuk favicon dan kertas ada sebagai berkas
 * terpisah di `public/favicon.svg` dan `public/favicon-gelap.svg` — geometri
 * di sana SEDIKIT BERBEDA (garis lebih tebal, siku pudar tanpa dash) karena
 * di 16px satu penggal dash jatuh di bawah setengah piksel dan jadi garis
 * kotor berkedip, bukan "putus". Sumbu sikunya tetap sama, jadi kedua varian
 * berdiri di tempat yang persis sama.
 *
 * ATURAN yang mengikat semua turunan: kurangi kehadiran siku keempat memakai
 * alat yang tersedia di medium itu; jangan pernah menghilangkannya, jangan
 * pernah menyamakannya dengan tiga yang lain.
 */
export function MarkPapan({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="PAPAN">
      <g fill="none" stroke="currentColor" strokeWidth="6">
        <path d="M11 23V11H23" />
        <path d="M41 11H53V23" />
        <path d="M11 41V53H23" />
      </g>
      <path
        d="M41 53H53V41"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeDasharray="5 4.5"
        opacity=".42"
      />
      <rect x="19" y="29" width="26" height="6" fill="var(--accent)" />
    </svg>
  )
}
