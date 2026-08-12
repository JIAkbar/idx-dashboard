import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MENU_ITEMS, MOBILE_NAV_COUNT } from '../../lib/dasbor/menu'
import { IkonMenu } from './IkonMenu'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'

/**
 * Bilah bawah telepon: 5 menu + tombol laci. Laci memuat SELURUH 10 menu
 * bernama penuh plus tombol tema — laci adalah bentuk telepon dari rail kiri,
 * yang di layar sempit disembunyikan. Tombol laci ikut menyala saat menu yang
 * sedang aktif berada di luar lima yang tampil, supaya posisi tidak hilang.
 *
 * Pintu Masuk/Admin di kaki laci sadar status login juga (#40), sama seperti
 * Sidebar — onMasuk buka LoginModal yang dirender DasborLayout (#38).
 */
export function MobileNav({ onMasuk }: { onMasuk: () => void }) {
  const [laciBuka, setLaciBuka] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { session } = useAuth()
  const { pathname } = useLocation()

  const tampil = MENU_ITEMS.slice(0, MOBILE_NAV_COUNT)
  const diLuarBilah = !tampil.some((m) => (m.path === '/' ? pathname === '/' : pathname.startsWith(m.path)))

  // Tutup laci saat berpindah halaman lewat jalur lain (mis. tombol kembali).
  useEffect(() => { setLaciBuka(false) }, [pathname])

  // Escape menutup laci — laci menutupi seluruh layar, jadi harus ada jalan keluar papan ketik.
  useEffect(() => {
    if (!laciBuka) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLaciBuka(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [laciBuka])

  return (
    <>
      <nav className="dasbor-bilah" aria-label="Menu bawah">
        {tampil.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => 'dasbor-bilah-item' + (isActive ? ' active' : '')}
          >
            <IkonMenu d={item.ikon} size={19} />
            <span className="dasbor-rail-kode">{item.kode}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={'dasbor-bilah-item' + (diLuarBilah ? ' active' : '')}
          onClick={() => setLaciBuka((v) => !v)}
          aria-expanded={laciBuka}
          aria-label="Semua menu"
        >
          <svg viewBox="0 0 24 24" width="19" height="19" className="dasbor-ikon" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <span className="dasbor-rail-kode">MENU</span>
        </button>
      </nav>

      {laciBuka && (
        <>
          <div className="dasbor-laci-bg" onClick={() => setLaciBuka(false)} />
          <div className="dasbor-laci" role="dialog" aria-modal="true" aria-label="Semua menu">
            <div className="dasbor-laci-tarik" />
            <div className="dasbor-laci-jd">
              <span className="dasbor-lbl">Semua Menu</span>
              <button type="button" className="dasbor-laci-tutup" onClick={() => setLaciBuka(false)}>
                Tutup
              </button>
            </div>
            <div className="dasbor-laci-list">
              {MENU_ITEMS.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => 'dasbor-laci-item' + (isActive ? ' active' : '')}
                  onClick={() => setLaciBuka(false)}
                >
                  <IkonMenu d={item.ikon} size={19} />
                  <span>{item.label}</span>
                  {item.badge && <span className="dasbor-nav-badge">{item.badge}</span>}
                </NavLink>
              ))}
            </div>
            {/* Rail disembunyikan di telepon, jadi tombol tema dan pintu Masuk
                yang tinggal di kakinya ikut pindah ke sini. */}
            <div className="dasbor-laci-aksi">
              <button type="button" className="dasbor-laci-tombol" onClick={toggleTheme}>
                <svg viewBox="0 0 24 24" width="17" height="17" className="dasbor-ikon" aria-hidden="true">
                  {theme === 'dark' ? (
                    <path d="M20.5 14.6A8.5 8.5 0 019.4 3.5a8.5 8.5 0 1011.1 11.1z" />
                  ) : (
                    <path d="M12 7.8a4.2 4.2 0 100 8.4 4.2 4.2 0 000-8.4zM12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
                  )}
                </svg>
                <span>{theme === 'dark' ? 'Tema terang' : 'Tema gelap'}</span>
              </button>
              {session ? (
                <NavLink to="/admin" className="dasbor-laci-tombol" onClick={() => setLaciBuka(false)}>
                  <svg viewBox="0 0 24 24" width="17" height="17" className="dasbor-ikon" aria-hidden="true">
                    <path d="M14 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
                  </svg>
                  <span>Admin</span>
                </NavLink>
              ) : (
                <button
                  type="button"
                  className="dasbor-laci-tombol"
                  onClick={() => { setLaciBuka(false); onMasuk() }}
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" className="dasbor-ikon" aria-hidden="true">
                    <path d="M14 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
                  </svg>
                  <span>Masuk</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
