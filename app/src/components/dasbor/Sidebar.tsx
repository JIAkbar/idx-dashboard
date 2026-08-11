import { Link, NavLink } from 'react-router-dom'
import { MENU_ITEMS } from '../../lib/dasbor/menu'
import { IkonMenu } from './IkonMenu'
import { useTheme } from '../../context/ThemeContext'

/**
 * Rail kiri (layar lebar). Isinya tiga lapis, dari atas ke bawah:
 *   1. tanda merek — bilah papan bolak-balik berhuruf P, sekaligus tautan ke
 *      halaman depan;
 *   2. menu, dinamai KODE tiga huruf gaya ticker bursa (nama panjang jadi
 *      tooltip);
 *   3. kaki: penanda data tersambung, tombol tema, dan pintu Masuk.
 *
 * Merek dan tombol Masuk sengaja di sini, bukan di bilah atas: bilah atas
 * seluruhnya milik pita kurs, dan kontrol yang duduk di jalur teks berjalan
 * menghalangi bacaan.
 */
export function Sidebar() {
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="dasbor-rail" aria-label="Menu utama">
      <Link to="/" className="dasbor-rail-merek" title="Papan — Pusat Analisa Pasar, Arus &amp; Nilai">
        <b>P</b>
        <span>Papan</span>
      </Link>

      <div className="dasbor-rail-list">
        {MENU_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === '/'}
            title={item.label + (item.badge ? ` (${item.badge})` : '')}
            className={({ isActive }) => 'dasbor-rail-item' + (isActive ? ' active' : '')}
          >
            <IkonMenu d={item.ikon} />
            <span className="dasbor-rail-kode">{item.kode}</span>
          </NavLink>
        ))}
      </div>

      <div className="dasbor-rail-foot">
        <span className="dasbor-dot-live" title="Data pasar tersambung" />

        <button
          type="button"
          className="dasbor-rail-tombol"
          onClick={toggleTheme}
          aria-label="Ganti tema terang atau gelap"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" className="dasbor-ikon" aria-hidden="true">
            {theme === 'dark' ? (
              <path d="M20.5 14.6A8.5 8.5 0 019.4 3.5a8.5 8.5 0 1011.1 11.1z" />
            ) : (
              <path d="M12 7.8a4.2 4.2 0 100 8.4 4.2 4.2 0 000-8.4zM12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
            )}
          </svg>
          <span className="dasbor-rail-kode">{theme === 'dark' ? 'Terang' : 'Gelap'}</span>
        </button>

        <Link to="/login" className="dasbor-rail-tombol" title="Masuk — kelola unggahan &amp; edisi">
          <svg viewBox="0 0 24 24" width="18" height="18" className="dasbor-ikon" aria-hidden="true">
            <path d="M14 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
          </svg>
          <span className="dasbor-rail-kode">Masuk</span>
        </Link>
      </div>
    </nav>
  )
}
