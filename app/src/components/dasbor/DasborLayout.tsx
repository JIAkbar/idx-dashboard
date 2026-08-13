import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { PitaKurs } from './PitaKurs'
import { LoginModal } from './LoginModal'
import { useTheme } from '../../context/ThemeContext'
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
 *
 * LoginModal dirender SATU kali di sini (bukan di Sidebar/MobileNav
 * masing-masing) — keduanya selalu ter-mount bersamaan (CSS yang
 * menyembunyikan salah satu per lebar layar), jadi state modal dan listener
 * Escape-nya harus satu sumber, dilempar lewat prop onMasuk (#38/#40).
 * location.state.openLogin dibaca supaya rute /login lama (bookmark/tautan
 * luar, lihat views/Login.tsx) tetap bisa buka modal ini alih-alih 404.
 */
export function DasborLayout() {
  const { theme } = useTheme()
  const [loginOpen, setLoginOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if ((location.state as { openLogin?: boolean } | null)?.openLogin) {
      setLoginOpen(true)
      navigate(location.pathname, { replace: true })
    }
  }, [location, navigate])

  return (
    <div className="dasbor-shell" data-theme={theme}>
      <div className="dasbor-body">
        <Sidebar onMasuk={() => setLoginOpen(true)} />
        <div className="dasbor-kolom">
          <header className="dasbor-atas">
            <Link to="/" className="dasbor-merek-mini" title="PAPAN — Pusat Analisa Pasar Nusantara" aria-label="PAPAN — halaman depan">
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
              PAPAN (Pusat Analisa Pasar Nusantara) bukan produk resmi Bursa Efek Indonesia.
            </span>
            <span className="dasbor-kaki-kanan">
              Buletin analisa: <b>Arus Pasar</b>
            </span>
          </footer>
        </div>
      </div>
      <MobileNav onMasuk={() => setLoginOpen(true)} />
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  )
}
