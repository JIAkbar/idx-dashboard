import { Component, Suspense, type ReactNode } from 'react'
import './baru.css'

/** Galat di ringkasan kanvas tak boleh menjatuhkan halaman induknya:
 *  sembunyikan ringkasannya saja, halaman lama tetap tampil. `kunci` = kode/
 *  rute, supaya berganti pilihan mereset keadaan galat. */
class TahanGalat extends Component<{ children: ReactNode; kunci: string }, { galat: boolean }> {
  state = { galat: false }
  static getDerivedStateFromError() { return { galat: true } }
  componentDidUpdate(prev: { kunci: string }) {
    if (prev.kunci !== this.props.kunci && this.state.galat) this.setState({ galat: false })
  }
  render() { return this.state.galat ? null : this.props.children }
}

/** #228: bungkus lapisan PAPAN Baru yang ditanam di halaman lama (tampilan
 *  Baru). Pemanggil memuat lapisannya lewat `lazy()` dan memberi prop `sisip`. */
export function SisipKanvas({ kunci, label, children }: { kunci: string; label: string; children: ReactNode }) {
  return (
    <section className="baru kanvas-sisip" aria-label={label}>
      <TahanGalat kunci={kunci}>
        <Suspense fallback={null}>{children}</Suspense>
      </TahanGalat>
    </section>
  )
}
