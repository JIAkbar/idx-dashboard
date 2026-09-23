import { Component, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { LAYAR, EMITEN_BAWAAN, layarDari, ruteLapisan, ruteLayar } from './peta'
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
  // Layar utama Emiten berada di /baru/emiten/:kode (segmen terakhir = kode).
  const diIkhtisarEmiten = /^\/baru\/emiten\/[^/]+\/?$/.test(pathname)
  const slug = diIkhtisarEmiten ? 'emiten' : slugAktif(pathname)
  const layar = layarDari(slug)
  const diIkhtisar = !!layar && slug === layar.id
  return (
    <div className="baru">
      <header className="bb-kepala">
        <div className="bb-kepala-atas">
          <Link to="/baru" className="bb-induk">← PAPAN Baru</Link>
          <nav className="bb-pils layar" aria-label="Layar">
            {LAYAR.map((l) => (
              <NavLink key={l.id} to={ruteLayar(l.id, kodeAktif)} className={() => (layar?.id === l.id ? 'aktif' : '')}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        {layar && (
          <nav className="bb-pils" aria-label="Lapisan">
            <Link to={ruteLayar(layar.id, kodeAktif)} className={diIkhtisar ? 'aktif' : ''} aria-current={diIkhtisar ? 'page' : undefined}>Ikhtisar</Link>
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
