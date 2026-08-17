import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { MENU_KELOMPOK, type GrupId, type MenuGrup, type MenuItem } from '../../lib/dasbor/menu'
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
  const { pathname } = useLocation()
  // Cuma satu flyout terbuka pada satu waktu — dipegang di sini, bukan di tiap
  // kelompok, supaya membuka yang satu otomatis menutup yang lain.
  const [grupBuka, setGrupBuka] = useState<GrupId | null>(null)
  // Pindah halaman lewat jalur lain (tombol kembali, tautan di isi halaman)
  // ikut menutup flyout yang menggantung.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setGrupBuka(null) }, [pathname])
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
        {MENU_KELOMPOK.map((grup) => (
          <RailGrup
            key={grup.id}
            grup={grup}
            buka={grupBuka === grup.id}
            onToggle={() => setGrupBuka((k) => (k === grup.id ? null : grup.id))}
            onTutup={() => setGrupBuka(null)}
            pathname={pathname}
            klik={klik}
            boleh={boleh}
            alasanRingkas={alasanRingkas}
          />
        ))}
      </div>

      <div className="dasbor-rail-foot">
        <span className="dasbor-dot-live" title="Data pasar tersambung" />

        {/* Satu tombol, ikon saja. Pil tiga pilihan sempat dicoba di sini
            dan makan tiga baris di rail yang cuma 76px — di kolom setipis itu
            sakelar tunggal menang telak atas kelengkapan pilihan. Mode
            "sistem" tetap ada di ThemeContext dan tetap dipakai kalau
            tersimpan; yang hilang cuma cara memilihnya dari rail. */}
        <button
          type="button"
          className="dasbor-rail-tombol"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
          aria-label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" className="dasbor-ikon" aria-hidden="true">
            {theme === 'dark' ? (
              <path d="M12 7.8a4.2 4.2 0 100 8.4 4.2 4.2 0 000-8.4zM12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
            ) : (
              <path d="M20.5 14.6A8.5 8.5 0 019.4 3.5a8.5 8.5 0 1011.1 11.1z" />
            )}
          </svg>
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

/**
 * Kunci akses yang mengganjal sebuah menu, atau null kalau terbuka.
 * Cuma item yang punya padanan eksplisit di PETA_MENU_KUNCI yang dicek —
 * TIDAK fallback ke item.id: beberapa id menu (mis. 'broker', 'radar')
 * kebetulan sama persis dengan kunci akses_halaman untuk HALAMAN LAIN
 * (Broker Summary / tab admin Radar WDWL), fallback ke id apa adanya bisa
 * salah pasang gembok ke menu yang tak dijaga.
 */
function kunciMengganjal(item: MenuItem, boleh: (k: string) => boolean): string | null {
  const kunci = PETA_MENU_KUNCI[item.id]
  return kunci && !boleh(kunci) ? kunci : null
}

/**
 * Satu ikon kelompok di rail + flyout daftar menunya (#175).
 *
 * Rail memuat KELOMPOK, bukan menu satuan: 16 ikon berderet sudah menyisakan
 * 53px di laptop, dan menu ke-18 akan meluber ke kaki rail tanpa gulir dan
 * tanpa galat.
 *
 * Flyout memakai `position: fixed` dengan koordinat dihitung dari kotak
 * tombolnya, bukan `absolute` di dalam rail: `.dasbor-rail-list` menggulung,
 * dan panel absolut di dalamnya akan terpotong tepat saat kelompok terbawah
 * dibuka. Koordinatnya sekalian dijepit ke tinggi jendela supaya kelompok
 * dekat kaki layar naik sendiri.
 */
function RailGrup({ grup, buka, onToggle, onTutup, pathname, klik, boleh, alasanRingkas }: {
  grup: MenuGrup & { items: MenuItem[] }
  buka: boolean
  onToggle: () => void
  onTutup: () => void
  pathname: string
  klik: (e: React.MouseEvent<HTMLAnchorElement>, path: string) => void
  boleh: (k: string) => boolean
  alasanRingkas: (k: string) => string
}) {
  const tombolRef = useRef<HTMLButtonElement>(null)
  const flyRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const idFly = useId()

  const aktif = grup.items.some((m) => pathname === m.path || pathname.startsWith(m.path + '/'))
  // Gembok kelompok cuma menyala kalau SELURUH isinya terkunci — satu menu
  // terbuka saja sudah membuat kelompoknya berguna.
  const semuaTerkunci = grup.items.every((m) => kunciMengganjal(m, boleh) !== null)

  // Posisi dihitung di layout effect (sebelum cat pertama, jadi tak ada kedip)
  // dan fokus langsung dipindah ke menu pertama supaya papan ketik tidak perlu
  // Tab lagi setelah Enter.
  useLayoutEffect(() => {
    if (!buka) { setPos(null); return }
    const kotak = tombolRef.current?.getBoundingClientRect()
    const fly = flyRef.current
    if (!kotak || !fly) return
    const tinggi = fly.offsetHeight
    setPos({
      top: Math.max(8, Math.min(kotak.top, window.innerHeight - tinggi - 8)),
      left: kotak.right + 6,
    })
    fly.querySelector('a')?.focus()
  }, [buka])

  // Klik di luar menutup. Klik pada tombolnya sendiri sengaja dilewati supaya
  // tidak bertabrakan dengan onToggle (tutup lalu buka lagi seketika).
  useEffect(() => {
    if (!buka) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (tombolRef.current?.contains(t) || flyRef.current?.contains(t)) return
      onTutup()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [buka, onTutup])

  const tutupDanFokus = () => { onTutup(); tombolRef.current?.focus() }

  const onKeyFly = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); tutupDanFokus(); return }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const tautan = Array.from(flyRef.current?.querySelectorAll('a') ?? [])
    if (!tautan.length) return
    const kini = tautan.indexOf(document.activeElement as HTMLAnchorElement)
    const arah = e.key === 'ArrowDown' ? 1 : -1
    tautan[(kini + arah + tautan.length) % tautan.length].focus()
  }

  return (
    <div className="dasbor-rail-grup-bungkus">
      <button
        type="button"
        ref={tombolRef}
        className={'dasbor-rail-item dasbor-rail-grup' + (aktif ? ' active' : '') + (buka ? ' buka' : '')}
        title={grup.label}
        aria-haspopup="menu"
        aria-expanded={buka}
        aria-controls={buka ? idFly : undefined}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Escape' && buka) { e.preventDefault(); onTutup() } }}
        // Chunk halaman diunduh saat penunjuk mampir, bukan saat diklik —
        // lihat lib/prefetchRute.ts.
        onPointerEnter={() => grup.items.forEach((m) => prefetchRute(m.path))}
      >
        <IkonMenu d={grup.ikon} size={18} />
        <span className="dasbor-rail-kode">{grup.kode}</span>
        {semuaTerkunci && (
          <span className="dasbor-kunci-badge" aria-hidden="true">
            <IkonMenu d={IKON_KUNCI} size={8} />
          </span>
        )}
      </button>

      {buka && (
        <div
          id={idFly}
          ref={flyRef}
          role="menu"
          aria-label={grup.label}
          className="dasbor-rail-flyout"
          // Sebelum posisinya terhitung panelnya disembunyikan dengan OPACITY,
          // bukan visibility: elemen ber-visibility:hidden tidak bisa menerima
          // fokus, dan fokus pertama ke menu teratas jatuh diam-diam.
          style={pos ? { top: pos.top, left: pos.left } : { opacity: 0 }}
          onKeyDown={onKeyFly}
        >
          <div className="dasbor-rail-flyout-jd">{grup.label}</div>
          {grup.items.map((item) => {
            // Menu TETAP tampil & bisa diklik walau terkunci (bukan
            // disembunyikan) — halaman tujuannya sendiri menampilkan kerangka
            // terkunci (PenjagaHalaman.tsx), gembok di sini cuma penanda.
            const kunci = kunciMengganjal(item, boleh)
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/'}
                role="menuitem"
                title={kunci ? alasanRingkas(kunci) : undefined}
                className={({ isActive }) => 'dasbor-rail-fly-item' + (isActive ? ' active' : '')}
                onClick={(e) => { onTutup(); klik(e, item.path) }}
                onPointerEnter={() => prefetchRute(item.path)}
              >
                <IkonMenu d={item.ikon} size={16} />
                <span className="dasbor-rail-fly-kode">{item.kode}</span>
                <span className="dasbor-rail-fly-label">{item.label}</span>
                {kunci ? (
                  <IkonMenu d={IKON_KUNCI} size={12} />
                ) : (
                  item.badge && <span className="dasbor-nav-badge">{item.badge}</span>
                )}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}
