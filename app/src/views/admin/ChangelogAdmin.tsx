import teks from '../../../../docs/CHANGELOG.md?raw'
import { useTheme } from '../../context/ThemeContext'
import '../../dasbor/lantai.css'

/**
 * Changelog dibaca langsung dari docs/CHANGELOG.md — satu sumber kebenaran.
 * Menyalin isinya ke TSX akan membuat keduanya berbeda dalam beberapa bulan;
 * itu persis alasan popup "What's New" lama dibuang (papan #8).
 *
 * Penyaji sengaja seadanya: berkas ini hanya memakai "## judul" dan "- butir",
 * jadi pustaka markdown penuh tidak dibutuhkan.
 *
 * Sejak rombak shell tab /admin (#terbitan-tab), isi changelog dipakai DUA
 * tempat: rute mandiri /admin/changelog (dipertahankan utuh utk bookmark
 * lama) dan tab "Terbitan" di dalam AdminLayout (digabung dgn Rak Terbitan).
 * ChangelogPanel cuma markup+parsing markdown-nya, tanpa wrapper — dipakai
 * ulang di RakTerbitan.tsx yang sudah punya ancestor .dasbor-shell/.lantai
 * dari AdminLayout sendiri (bungkus dobel kalau ChangelogAdmin dipakai apa
 * adanya di situ).
 */
export function ChangelogPanel() {
  const baris = teks.split('\n')
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Changelog</span></div>
      <div className="panel-b">
        {baris.map((b, i) => {
          if (b.startsWith('## ')) return <h2 key={i} className="lbl" style={{ marginTop: 18 }}>{b.slice(3)}</h2>
          if (b.startsWith('# ')) return <h1 key={i} style={{ fontSize: 19 }}>{b.slice(2)}</h1>
          if (b.startsWith('- ')) return <li key={i} style={{ marginLeft: 18 }}>{b.slice(2)}</li>
          return b.trim() ? <p key={i}>{b}</p> : null
        })}
      </div>
    </div>
  )
}

/**
 * Halaman mandiri /admin/changelog (dijaga ProtectedRoute) — TIDAK ikut
 * dibungkus <DasborLayout> — layout itu menyeret Sidebar/MobileNav/PitaKurs
 * milik rail publik yang tak boleh nongol di halaman admin. Tapi
 * .lantai/.panel butuh ancestor .dasbor-shell[data-theme] buat token warnanya
 * (lihat lantai.css baris 454) — tanpa itu .lantai jatuh ke token gelap
 * default-nya terus, kebal toggle tema. Maka bungkus tipis di sini: cuma
 * className+data-theme, tanpa rail/topbar publik.
 */
export function ChangelogAdmin() {
  const { theme } = useTheme()
  return (
    <div className="dasbor-shell" data-theme={theme}>
      <div className="lantai">
        <ChangelogPanel />
      </div>
    </div>
  )
}
