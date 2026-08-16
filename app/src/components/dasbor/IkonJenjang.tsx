import { useId } from 'react'

/**
 * Lencana jenjang kontributor — satu medali per tier, dengan cahaya yang
 * menguat seiring jenjang.
 *
 * Bentuknya sengaja SATU medali, bukan enam gambar berbeda: yang membedakan
 * jenjang adalah warna logam dan jumlah takik di lingkar luar, jadi kenaikan
 * jenjang terbaca sebagai benda yang sama naik kelas — bukan benda lain.
 * Takiknya = tier, sehingga bisa dihitung tanpa membaca namanya.
 *
 * Cahaya ("lampu") datang dari dua lapis: halo radial di belakang medali dan
 * kilau di dalam cincin. Keduanya menguat dari Pemula ke Diamond. Denyutnya
 * dimatikan lewat prefers-reduced-motion di lantai.css — animasi di sini
 * dekorasi, bukan pembawa informasi, jadi aman hilang.
 */

/** Warna logam per tier. Indeks = tier 0..5. */
const LOGAM = [
  { nama: 'Pemula', isi: '#6B7A90', kilau: '#93A3B8' },
  { nama: 'Perunggu', isi: '#A96B33', kilau: '#D89A5C' },
  { nama: 'Perak', isi: '#8E9AA8', kilau: '#D3DBE4' },
  { nama: 'Emas', isi: '#D19A22', kilau: '#F5CE6B' },
  { nama: 'Platinum', isi: '#7FA6B5', kilau: '#CFE9F2' },
  { nama: 'Diamond', isi: '#4FA8D8', kilau: '#B6ECFF' },
]

/** Warna logam terang satu tier — untuk bingkai/aksen di luar SVG (mis. kartu
 *  tangga jenjang) supaya lencana dan wadahnya tak pernah berselisih warna. */
export function warnaJenjang(tier: number): string {
  return LOGAM[Math.min(Math.max(tier, 0), LOGAM.length - 1)].kilau
}

/** Titik-titik takik di lingkar medali — satu per tier, mulai dari atas. */
function takik(tier: number, r: number) {
  return Array.from({ length: Math.max(tier, 0) }, (_, i) => {
    const sudut = (-90 + (360 / Math.max(tier, 1)) * i) * (Math.PI / 180)
    return { x: 24 + Math.cos(sudut) * r, y: 24 + Math.sin(sudut) * r }
  })
}

export function IkonJenjang({
  tier, nama, size = 44,
}: {
  tier: number
  /** Nama jenjang dari basis data — dipakai untuk label aksesibilitas, bukan
   *  untuk memilih warna (warna murni dari tier, supaya penggantian nama di
   *  tabel `jenjang` tidak diam-diam mengubah tampilannya). */
  nama?: string
  size?: number
}) {
  const t = Math.min(Math.max(tier, 0), LOGAM.length - 1)
  const logam = LOGAM[t]
  // useId: dokumen bisa memuat lebih dari satu lencana (modal + kartu), dan
  // id gradien yang kembar membuat keduanya memakai gradien yang sama.
  const uid = useId().replace(/:/g, '')
  const idHalo = `jh-halo-${uid}`
  const idIsi = `jh-isi-${uid}`

  return (
    <span
      className="jenjang-lencana"
      style={{ ['--jenjang-kilau' as string]: logam.kilau, ['--jenjang-tier' as string]: t }}
    >
      <svg
        width={size} height={size} viewBox="0 0 48 48"
        role="img" aria-label={`Jenjang ${nama ?? logam.nama}`}
      >
        <defs>
          <radialGradient id={idHalo}>
            <stop offset="0%" stopColor={logam.kilau} stopOpacity={0.10 + t * 0.09} />
            <stop offset="70%" stopColor={logam.kilau} stopOpacity={0} />
          </radialGradient>
          <linearGradient id={idIsi} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={logam.kilau} />
            <stop offset="100%" stopColor={logam.isi} />
          </linearGradient>
        </defs>

        {/* Halo: lampu di belakang medali. */}
        <circle cx="24" cy="24" r="23" fill={`url(#${idHalo})`} className="jl-halo" />

        {/* Cincin luar + takik jenjang. */}
        <circle cx="24" cy="24" r="15.5" fill="none" stroke={logam.isi} strokeWidth="1.4" opacity=".55" />
        {takik(t, 15.5).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.7" fill={logam.kilau} />
        ))}

        {/* Medali. */}
        <circle cx="24" cy="24" r="11.5" fill={`url(#${idIsi})`} />
        {/* Kilau tepi atas — sumber cahayanya satu, dari kiri atas. */}
        <path
          d="M15.5 20a11.5 11.5 0 0 1 13-6.2"
          fill="none" stroke={logam.kilau} strokeWidth="1.6" strokeLinecap="round" opacity=".85"
        />
        {/* Puncak: bentuk grafik naik — lencana ini soal setoran yang lolos
            kurasi, jadi lambangnya kerja pasar, bukan piala generik. */}
        <path
          d="M18.5 27.5l3.5-4 3 2.2 4-5.2"
          fill="none" stroke="#0B1017" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".8"
        />
      </svg>
    </span>
  )
}
