import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { LaciMobile } from './LaciMobile'
import { PitaKurs } from './PitaKurs'
import { LoginModal } from './LoginModal'
import { LoginModalProvider } from '../../context/LoginModalContext'
import { useTheme } from '../../context/ThemeContext'
import '../../dasbor/lantai.css'

/**
 * Shell dasbor publik "Papan": rail kiri (layar lebar) + pita kurs berjalan +
 * konten menu aktif; di telepon rail berganti laci kiri (#76) yang dibuka
 * logo P di bilah atas — bilah bawah 5 menu lama dihapus, navigasi telepon
 * satu jalur saja.
 *
 * Bilah atas seluruhnya milik pita kurs. Merek dan tombol Masuk tinggal di
 * rail — kontrol yang duduk di jalur teks berjalan menghalangi bacaan. Di
 * telepon rail disembunyikan, jadi tanda merek muncul kembali di bilah atas
 * sebagai satu bilah papan kecil (sekaligus tombol laci), dan Masuk pindah
 * ke laci.
 *
 * Nama produk sengaja BUKAN "IDX ..." — IDX itu merek Bursa Efek Indonesia dan
 * dasbor ini terbuka untuk umum. Asal datanya tetap disebut, tapi sebagai
 * keterangan sumber di kaki halaman, bukan sebagai nama di kepala.
 *
 * LoginModal dirender SATU kali di sini (bukan di Sidebar/LaciMobile
 * masing-masing) — keduanya selalu ter-mount bersamaan (CSS yang
 * menyembunyikan salah satu per lebar layar), jadi state modal dan listener
 * Escape-nya harus satu sumber, dilempar lewat prop onMasuk (#38/#40).
 * location.state.openLogin dibaca supaya rute /login lama (bookmark/tautan
 * luar, lihat views/Login.tsx) tetap bisa buka modal ini alih-alih 404.
 */
export function DasborLayout() {
  const { theme } = useTheme()
  const [loginOpen, setLoginOpen] = useState(false)
  const [laciKiri, setLaciKiri] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if ((location.state as { openLogin?: boolean } | null)?.openLogin) {
      setLoginOpen(true)
      navigate(location.pathname, { replace: true })
    }
  }, [location, navigate])

  return (
    <LoginModalProvider buka={() => setLoginOpen(true)}>
      <div className="dasbor-shell" data-theme={theme}>
        <div className="dasbor-body">
          <Sidebar onMasuk={() => setLoginOpen(true)} />
          <div className="dasbor-kolom">
            <header className="dasbor-atas">
              {/* #76: logo P di telepon = tombol laci navigasi kiri (BUKAN
                  hamburger terpisah — satu trigger). Zona logo diberi pembatas
                  hairline sendiri supaya tidak menyatu dengan pita kurs; akses
                  halaman depan tetap ada lewat item pertama laci. Di desktop
                  seluruh zona ini display:none — merek yang berlaku di rail. */}
              <div className="dasbor-merek-zona">
                <button
                  type="button"
                  className="dasbor-merek-mini"
                  onClick={() => setLaciKiri((v) => !v)}
                  aria-expanded={laciKiri}
                  aria-controls="dasbor-laci-kiri"
                  title="PAPAN — Pusat Analisa Pasar Nusantara"
                  aria-label="Buka menu navigasi"
                >
                  P
                </button>
              </div>
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
        <LaciMobile buka={laciKiri} onTutup={() => setLaciKiri(false)} onMasuk={() => setLoginOpen(true)} />
        {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      </div>
    </LoginModalProvider>
  )
}
