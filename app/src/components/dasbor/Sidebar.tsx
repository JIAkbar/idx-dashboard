import { MarkPapan } from './MarkPapan'
import { Link, NavLink } from 'react-router-dom'
import { MENU_UTAMA, type MenuItem } from '../../lib/dasbor/menu'
import { IkonMenu, IKON_KUNCI } from './IkonMenu'

/** Rumah — hanya dipakai pintu Beranda di rail & laci. */
const IKON_RUMAH = 'M4 11.5 12 4l8 7.5M6.5 10v9h11v-9'
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
        {/* Kata "PAPAN" DIHAPUS (keputusan Johan 29 Agu 2026): di lebar rail
            ia tercetak 7,5px — itu kabut, bukan kata. Ubinnya DIPERTAHANKAN
            justru karena katanya hilang: tanpa ubin, lambang merek jatuh jadi
            ikon menu biasa di antara 16 ikon lain dan kehilangan perannya
            sebagai titik pulang. */}
        <MarkPapan size={28} />
      </Link>

      <div className="dasbor-rail-list">
        {/* Beranda berdiri sendiri di atas kelompok, bukan di dalam salah
            satunya: ia bukan bagian dari Pasar/Emiten/Aliran/Analisa/Baca,
            ia titik pulang. Sebelumnya satu-satunya jalannya lambang PAPAN di
            puncak rail — dan lambang merek dibaca sebagai identitas, bukan
            tombol. */}
        <NavLink
          to="/"
          end
          className={({ isActive }) => 'dasbor-rail-item' + (isActive ? ' active' : '')}
          title="Beranda"
          onClick={(e) => klik(e, '/')}
        >
          <IkonMenu d={IKON_RUMAH} size={22} />
          <span className="dasbor-rail-kode">HOME</span>
        </NavLink>
        {/* DATAR — tanpa kelompok, tanpa flyout. Saran Johan 2 Sep 2026
            melihat ANL membuka tiga pilihan: "tidak perlu lagi dijadikan sub
            menu, sudah bisa di lebur juga".

            Pengelompokan lahir waktu rail memuat 12 menu satuan; sesudah
            peleburan #306 (30 pintu jadi 9) ia jadi ongkos tanpa manfaat —
            dan tiga dari lima kelompok bahkan cuma berisi SATU item, jadi
            PSR/EMT/ALR adalah flyout yang membuka untuk memperlihatkan satu
            pilihan. Satu klik terbuang di tiap kunjungan.

            Muat diukur, bukan ditebak: tinggi baris 60px, 10 baris = 600px.
            Daftar rail punya ±693px di laptop 1536x960 dan ±823px di desktop
            1920x1080. Di layar lebih pendek dari ±800px CSS ia menggulung —
            `.dasbor-rail-list` memang sudah `overflow-y: auto` sejak awal. */}
        {MENU_UTAMA.map((item) => {
          const kunci = kunciMengganjal(item, boleh)
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => 'dasbor-rail-item' + (isActive ? ' active' : '')}
              title={kunci ? `${item.label} — ${alasanRingkas(kunci)}` : item.label}
              onClick={(e) => klik(e, item.path)}
              // Chunk halaman diunduh saat penunjuk mampir, bukan saat diklik.
              onPointerEnter={() => prefetchRute(item.path)}
            >
              <IkonMenu d={item.ikon} size={22} />
              <span className="dasbor-rail-kode">{item.kode}</span>
              {kunci ? (
                <span className="dasbor-kunci-badge" aria-hidden="true">
                  <IkonMenu d={IKON_KUNCI} size={8} />
                </span>
              ) : (
                item.badge && <span className="dasbor-nav-badge">{item.badge}</span>
              )}
            </NavLink>
          )
        })}
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
