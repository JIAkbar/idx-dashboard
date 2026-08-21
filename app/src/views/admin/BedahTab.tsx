import { useProfilSaya } from '../../lib/profilSaya'
import { BedahUnggah } from './BedahUnggah'

/**
 * Tab "Bedah" (/admin/bedah) — gerbang izin profil.boleh_bedah, dipindah apa
 * adanya dari ternary AdminHome.tsx lama. Tab-nya sendiri sudah disembunyikan
 * di AdminLayout kalau tak berhak (#shell-tab); guard di sini jaga-jaga akses
 * langsung lewat URL/bookmark.
 */
export function BedahTab() {
  const { profil } = useProfilSaya()
  if (profil?.boleh_bedah) return <BedahUnggah />
  return (
    <section className="panel">
      <div className="panel-h"><span className="lbl">Deep Dive — unggah sumber</span></div>
      <div className="panel-b">
        <p className="muted" style={{ margin: 0, fontSize: 11 }}>
          Hak akses analisa single-saham diberikan superadmin.
        </p>
      </div>
    </section>
  )
}
