import { Link } from 'react-router-dom'
import { LAYAR, ruteLapisan } from './peta'
import { KakiBaru } from './KakiBaru'

/** /baru — pintu masuk: lima layar dan lapisannya. */
export default function BaruBeranda() {
  return (
    <div className="bb-isi">
      <div className="bb-hero">
        <span className="bb-label">PAPAN Baru</span>
        <h1 className="bb-judul" style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}>Lima layar, satu cerita pasar</h1>
        <p className="bb-narasi">Tampilan baru PAPAN: tiap angka disertai kalimat yang menyimpulkannya dan jalan menelusuri asalnya. Halaman lama tetap ada di menu seperti biasa.</p>
      </div>
      <div className="bb-kartu-grid">
        {LAYAR.map((l) => (
          <div key={l.id} className="bb-kartu">
            <span className="bb-label">{l.label}</span>
            <div className="bb-pils">
              {l.lapisan.map((p) => (
                <Link key={p.slug} to={ruteLapisan(p.slug)}>{p.label}</Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <KakiBaru sumber="Data dari statistik resmi bursa dan panen harian PAPAN." />
    </div>
  )
}
