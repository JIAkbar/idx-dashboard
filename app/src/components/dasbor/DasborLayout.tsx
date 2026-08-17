import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { LaciMobile } from './LaciMobile'
import { PitaKurs } from './PitaKurs'
import { LoginModal } from './LoginModal'
import { TanyaPapan } from './TanyaPapan'
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
                {/* Klausa atribusi WAJIB lisensi Apache 2.0 lightweight-charts
                    (dipakai /grafik) — README-nya mensyaratkan tautan nyata ke
                    tradingview.com di halaman situs yang terlihat pengguna.
                    Sengaja di KAKI GLOBAL (bukan di halaman /grafik sendiri,
                    lihat riwayat commit) supaya halaman chart-nya tetap terbaca
                    sebagai produk PAPAN. Jangan hapus tautan ini. */}
                {' '}Grafik memakai Lightweight Charts™ (
                <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--text2)' }}>TradingView</a>
                ). PAPAN (Pusat Analisa Pasar Nusantara) bukan produk resmi Bursa Efek Indonesia.
              </span>
              {/* "Buletin analisa: Arus Pasar" DIBUANG (16 Agu): tempatnya di
                  pojok kanan bawah kini ditempati tombol Tanya PAPAN yang
                  mengambang, jadi teksnya tertimpa di tiap halaman. Isinya pun
                  tak hilang — Bulletin punya menu sendiri (BLT) dan kartu di
                  Beranda. */}
            </footer>
          </div>
        </div>
        {/* Membuka modal masuk dari laci telepon HARUS menutup lacinya: kalau
            tidak, modal berdiri di atas laci yang masih terbuka — menunya
            terbaca sebagian di belakang, dan menutup modal mengembalikan orang
            ke menu alih-alih ke halaman yang tadi dilihat. */}
        <LaciMobile
          buka={laciKiri}
          onTutup={() => setLaciKiri(false)}
          onMasuk={() => { setLaciKiri(false); setLoginOpen(true) }}
        />
        {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
        {/* Mengambang di pojok kanan bawah, ikut ke SEMUA halaman publik —
            dipasang di shell, bukan per halaman, supaya tak ada halaman yang
            kehilangan pintu tanyanya. */}
        <TanyaPapan />
      </div>
    </LoginModalProvider>
  )
}
