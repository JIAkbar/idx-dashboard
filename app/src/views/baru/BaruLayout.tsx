import { Component, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { LAYAR, EMITEN_BAWAAN, layarDari, ruteLapisan } from './peta'
import './baru.css'

/** Slug lapisan aktif dari rute: segmen terakhir (/baru/indeks, /baru/emiten/BBCA/harga). */
function slugAktif(pathname: string): string {
  const seg = pathname.replace(/\/+$/, '').split('/')
  return seg[seg.length - 1]
}

/** Satu lapisan yang gagal render (data tak lengkap untuk emiten tertentu) tak boleh
 *  mengosongkan seluruh layar: tampilkan pesan, navigasi tetap hidup. `kunci` = rute,
 *  supaya pindah lapisan mereset keadaan galat. */
class PenangkapGalat extends Component<{ children: ReactNode; kunci: string }, { galat: boolean }> {
  state = { galat: false }
  static getDerivedStateFromError() { return { galat: true } }
  componentDidUpdate(prev: { kunci: string }) {
    if (prev.kunci !== this.props.kunci && this.state.galat) this.setState({ galat: false })
  }
  render() {
    if (this.state.galat) {
      return <p className="bb-keadaan">Lapisan ini belum bisa ditampilkan untuk pilihan ini — sebagian datanya tidak lengkap. Coba emiten atau lapisan lain.</p>
    }
    return this.props.children
  }
}

/** Kerangka semua halaman PAPAN Baru: baris layar, baris lapisan, isi. */
export function BaruLayout() {
  const { pathname } = useLocation()
  const { kode } = useParams()
  const kodeAktif = (kode ?? EMITEN_BAWAAN).toUpperCase()
  const slug = slugAktif(pathname)
  const layar = layarDari(slug)
  return (
    <div className="baru">
      <header className="bb-kepala">
        <div className="bb-kepala-atas">
          <Link to="/baru" className="bb-induk">← PAPAN Baru</Link>
          <nav className="bb-pils layar" aria-label="Layar">
            {LAYAR.map((l) => (
              <NavLink key={l.id} to={ruteLapisan(l.lapisan[0].slug, kodeAktif)} className={() => (layar?.id === l.id ? 'aktif' : '')}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        {layar && layar.lapisan.length > 1 && (
          <nav className="bb-pils" aria-label="Lapisan">
            {layar.lapisan.map((p) => (
              <Link key={p.slug} to={ruteLapisan(p.slug, kodeAktif)} className={p.slug === slug ? 'aktif' : ''} aria-current={p.slug === slug ? 'page' : undefined}>
                {p.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <PenangkapGalat kunci={pathname}><Outlet /></PenangkapGalat>
    </div>
  )
}
