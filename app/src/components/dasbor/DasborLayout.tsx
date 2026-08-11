import { Link, Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { PitaKurs } from './PitaKurs'
import { useTheme } from '../../context/ThemeContext'
import '../../dasbor/dasbor.css'
import '../../dasbor/lantai.css'

/**
 * Shell dasbor publik "Papan": rail kiri (layar lebar) + pita kurs berjalan +
 * konten menu aktif; di telepon rail berganti bilah bawah dengan laci menu.
 *
 * Bilah atas seluruhnya milik pita kurs. Merek dan tombol Masuk tinggal di
 * rail — kontrol yang duduk di jalur teks berjalan menghalangi bacaan. Di
 * telepon rail disembunyikan, jadi tanda merek muncul kembali di bilah atas
 * sebagai satu bilah papan kecil, dan Masuk pindah ke laci.
 *
 * Nama produk sengaja BUKAN "IDX ..." — IDX itu merek Bursa Efek Indonesia dan
 * dasbor ini terbuka untuk umum. Asal datanya tetap disebut, tapi sebagai
 * keterangan sumber di kaki halaman, bukan sebagai nama di kepala.
 */
export function DasborLayout() {
  const { theme } = useTheme()

  return (
    <div className="dasbor-shell" data-theme={theme}>
      <div className="dasbor-body">
        <Sidebar />
        <div className="dasbor-kolom">
          <header className="dasbor-atas">
            <Link to="/" className="dasbor-merek-mini" title="Papan" aria-label="Papan — halaman depan">
              P
            </Link>
            <PitaKurs />
          </header>

          <main className="dasbor-main">
            <Outlet />
          </main>

          <footer className="dasbor-kaki">
            <span>
              Sumber data: <b>Statistik Ringkas IDX</b> (idx.co.id), Yahoo Finance, dan KSEI.
              Papan bukan produk resmi Bursa Efek Indonesia.
            </span>
            <span className="dasbor-kaki-kanan">
              Buletin analisa: <b>Arus Pasar</b>
            </span>
          </footer>
        </div>
      </div>
      <MobileNav />
    </div>
  )
}
