import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MENU_KELOMPOK } from '../../lib/dasbor/menu'

/** Rumah — pintu Beranda di laci telepon. */
const IKON_RUMAH_LACI = 'M4 11.5 12 4l8 7.5M6.5 10v9h11v-9'
import { IkonMenu, IKON_KUNCI } from './IkonMenu'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useAksesHalaman } from '../../context/AksesHalamanContext'
import { PETA_MENU_KUNCI } from '../../lib/aksesHalaman'

/**
 * Laci navigasi kiri telepon (#76) — dibuka logo "P" di bilah atas (bukan
 * tombol hamburger terpisah; satu trigger saja). Isinya bentuk telepon dari
 * rail kiri: SELURUH menu bernama penuh + tombol tema + pintu Masuk/Admin
 * (sadar status login, #40 — onMasuk buka LoginModal di DasborLayout, #38).
 *
 * Selalu ter-mount (CSS menyembunyikan di layar lebar) supaya buka/tutup bisa
 * dianimasikan transform + visibility dua arah — visibility:hidden saat
 * tertutup sekalian mengeluarkan isi laci dari urutan Tab & pohon aksesibilitas,
 * jadi tidak perlu aria-hidden/inert manual.
 */
export function LaciMobile({ buka, onTutup, onMasuk }: {
  buka: boolean
  onTutup: () => void
  onMasuk: () => void
}) {
  const { theme, toggleTheme } = useTheme()
  const { session } = useAuth()
  const { boleh, alasanRingkas } = useAksesHalaman()
  const { pathname } = useLocation()

  // Tutup saat berpindah halaman lewat jalur lain (mis. tombol kembali).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onTutup() }, [pathname])

  // Escape menutup laci — laci menutupi konten, harus ada jalan keluar papan ketik.
  useEffect(() => {
    if (!buka) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [buka, onTutup])

  return (
    <>
      <div className={'dasbor-laci-kiri-bg' + (buka ? ' buka' : '')} onClick={onTutup} />
      <nav
        id="dasbor-laci-kiri"
        className={'dasbor-laci-kiri' + (buka ? ' buka' : '')}
        aria-label="Menu utama"
      >
        <div className="dasbor-laci-jd">
          <span className="dasbor-lbl">PAPAN — Menu</span>
          <button type="button" className="dasbor-laci-tutup" onClick={onTutup}>
            Tutup
          </button>
        </div>

        {/* Kelompok yang sama dengan rail desktop (#175), tapi TANPA flyout:
            layar sempit tak punya ruang untuk lapis kedua yang melayang, jadi
            kelompoknya jadi tajuk dan menunya menjorok di bawahnya. */}
        <div className="dasbor-laci-kiri-list">
          {/* Di telepon rail tak pernah tampil, jadi tanpa baris ini Beranda
              tak punya pintu sama sekali dari laci. */}
          <NavLink
            to="/"
            end
            className={({ isActive }) => 'dasbor-laci-item' + (isActive ? ' active' : '')}
            onClick={onTutup}
          >
            <IkonMenu d={IKON_RUMAH_LACI} size={18} /> Beranda
          </NavLink>
          {MENU_KELOMPOK.map((grup) => (
            <div className="dasbor-laci-grup" key={grup.id}>
              <div className="dasbor-laci-grup-jd">
                <IkonMenu d={grup.ikon} size={14} />
                <span>{grup.label}</span>
              </div>
              {grup.items.map((item) => {
                // Cuma item bermapping eksplisit yang dicek — lihat komentar
                // sama di Sidebar.tsx (jangan fallback ke item.id, bisa nyasar
                // ke kunci halaman lain yang kebetulan namanya sama).
                const kunci = PETA_MENU_KUNCI[item.id]
                const terkunci = kunci ? !boleh(kunci) : false
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) => 'dasbor-laci-item' + (isActive ? ' active' : '')}
                    onClick={onTutup}
                    title={terkunci ? alasanRingkas(kunci!) : undefined}
                  >
                    <IkonMenu d={item.ikon} size={19} />
                    <span>{item.label}</span>
                    {terkunci ? (
                      <IkonMenu d={IKON_KUNCI} size={14} />
                    ) : (
                      item.badge && <span className="dasbor-nav-badge">{item.badge}</span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </div>

        <div className="dasbor-laci-kiri-aksi">
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
            <NavLink
              to="/admin"
              className={({ isActive }) => 'dasbor-laci-tombol' + (isActive ? ' active' : '')}
              onClick={onTutup}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" className="dasbor-ikon" aria-hidden="true">
                <path d="M14 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
              <span>Admin</span>
            </NavLink>
          ) : (
            <button
              type="button"
              className="dasbor-laci-tombol"
              onClick={() => { onTutup(); onMasuk() }}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" className="dasbor-ikon" aria-hidden="true">
                <path d="M14 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
              <span>Masuk</span>
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
