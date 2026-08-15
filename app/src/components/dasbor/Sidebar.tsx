import { Fragment } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { MENU_ITEMS } from '../../lib/dasbor/menu'
import { IkonMenu, IKON_KUNCI } from './IkonMenu'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useAksesHalaman } from '../../context/AksesHalamanContext'
import { PETA_MENU_KUNCI } from '../../lib/aksesHalaman'
import { useKlikTransisi } from '../../lib/dasbor/transisi'
import { prefetchRute } from '../../lib/prefetchRute'

/**
 * Rail kiri (layar lebar). Isinya tiga lapis, dari atas ke bawah:
 *   1. tanda merek — bilah papan bolak-balik berhuruf P, sekaligus tautan ke
 *      halaman depan;
 *   2. menu, dinamai KODE tiga huruf gaya ticker bursa (nama panjang jadi
 *      tooltip);
 *   3. kaki: penanda data tersambung, tombol tema, dan pintu Masuk/Admin.
 *
 * Merek dan tombol Masuk sengaja di sini, bukan di bilah atas: bilah atas
 * seluruhnya milik pita kurs, dan kontrol yang duduk di jalur teks berjalan
 * menghalangi bacaan.
 *
 * Tombol Masuk sadar status login (#40): sudah masuk -> tautan ke /admin,
 * belum -> buka LoginModal (onMasuk, dikelola DasborLayout — modal, bukan
 * navigasi /login lagi, lihat #38).
 */
export function Sidebar({ onMasuk }: { onMasuk: () => void }) {
  const { theme, toggleTheme } = useTheme()
  const { session } = useAuth()
  const { boleh, alasanRingkas } = useAksesHalaman()
  // #79: navigasi rail dibungkus View Transition (crossfade + naik tipis di
  // .dasbor-main). LaciMobile sengaja TIDAK ikut — laci yang menutup sudah
  // jadi gerak perpindahannya, dan startViewTransition membekukan snapshot
  // laci-terbuka 180ms sehingga animasi tutupnya justru tercekat.
  const klik = useKlikTransisi()

  return (
    <nav className="dasbor-rail" aria-label="Menu utama">
      <Link to="/" className="dasbor-rail-merek" title="PAPAN — Pusat Analisa Pasar Nusantara" onClick={(e) => klik(e, '/')}>
        <b>P</b>
        <span>PAPAN</span>
      </Link>

      <div className="dasbor-rail-list">
        {MENU_ITEMS.map((item) => {
          // Cuma item yang punya padanan eksplisit di PETA_MENU_KUNCI yang
          // dicek — TIDAK fallback ke item.id: beberapa id menu (mis. 'broker',
          // 'radar') kebetulan sama persis dengan kunci akses_halaman utk
          // HALAMAN LAIN (Broker Summary / tab admin Radar WDWL), fallback ke
          // id apa adanya bisa salah pasang gembok ke menu yang tak dijaga.
          const kunci = PETA_MENU_KUNCI[item.id]
          // Menu TETAP tampil & bisa diklik walau terkunci (bukan disembunyikan)
          // — halaman tujuannya sendiri menampilkan kerangka terkunci
          // (PenjagaHalaman.tsx), badge di sini cuma penanda.
          const terkunci = kunci ? !boleh(kunci) : false
          const judul = item.label + (item.badge ? ` (${item.badge})` : '') + (terkunci ? ` — ${alasanRingkas(kunci!)}` : '')
          return (
            <Fragment key={item.id}>
              {/* Jeda kelompok sebelum item pembuka kelompok berikutnya —
                  didefinisikan di menu.ts (`mulaiKelompok`), bukan diambil
                  dari indeks, supaya urutan menu boleh berubah tanpa
                  memindahkan garisnya secara manual. */}
              {item.mulaiKelompok && <div className="dasbor-rail-pisah" aria-hidden="true" />}
            <NavLink
              to={item.path}
              end={item.path === '/'}
              title={judul}
              className={({ isActive }) => 'dasbor-rail-item' + (isActive ? ' active' : '')}
              onClick={(e) => klik(e, item.path)}
              // Chunk halaman diunduh saat penunjuk mampir, bukan saat diklik —
              // lihat lib/prefetchRute.ts. `onFocus` menyertakan navigasi papan
              // ketik, yang kalau tidak akan selalu kena jalur lambat.
              onPointerEnter={() => prefetchRute(item.path)}
              onFocus={() => prefetchRute(item.path)}
            >
              <IkonMenu d={item.ikon} size={18} />
              <span className="dasbor-rail-kode">{item.kode}</span>
              {terkunci && (
                <span className="dasbor-kunci-badge" aria-hidden="true">
                  <IkonMenu d={IKON_KUNCI} size={8} />
                </span>
              )}
            </NavLink>
            </Fragment>
          )
        })}
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

        {session ? (
          <NavLink
            to="/admin"
            title="Admin — kelola unggahan &amp; edisi"
            className={({ isActive }) => 'dasbor-rail-tombol' + (isActive ? ' active' : '')}
            onClick={(e) => klik(e, '/admin')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" className="dasbor-ikon" aria-hidden="true">
              <path d="M14 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            <span className="dasbor-rail-kode">Admin</span>
          </NavLink>
        ) : (
          <button type="button" className="dasbor-rail-tombol" onClick={onMasuk} title="Masuk — kelola unggahan &amp; edisi">
            <svg viewBox="0 0 24 24" width="18" height="18" className="dasbor-ikon" aria-hidden="true">
              <path d="M14 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            <span className="dasbor-rail-kode">Masuk</span>
          </button>
        )}
      </div>
    </nav>
  )
}
