import { useEffect, useState } from 'react'
import { TabHalaman } from './TabHalaman'
import { PitaPengumuman } from './PitaPengumuman'
import { Renovasi } from './Renovasi'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { LaciMobile } from './LaciMobile'
import { PitaKurs, StatusBursa } from './PitaKurs'
import { LoginModal } from './LoginModal'
import { TanyaPapan } from './TanyaPapan'
import { LoginModalProvider } from '../../context/LoginModalContext'
import { useTheme } from '../../context/ThemeContext'
import { MarkPapan } from './MarkPapan'
import { TANYA_PAPAN_AKTIF } from '../../lib/fitur'
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
  // Rute Beranda satu-satunya '/'; catch-all mengalihkan ke sana dengan
  // `replace`, jadi pathname sesudah pengalihan tetap '/'.
  const beranda = location.pathname === '/'
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
                  <MarkPapan size={24} />
                </button>
              </div>
              {/* Pita kurs berjalan HANYA di Beranda (Johan, 5 Sep 2026:
                  "marquee sepertinya cukup di home saja"). Di halaman lain
                  kepala tetap berdiri dengan chip status bursa saja.

                  Chip-nya sengaja TIDAK ikut bersyarat: menaruhnya di kepala
                  adalah keputusan terpisah (Johan 2 Sep, "D + E digabung")
                  justru supaya ia tampil di semua halaman - ia keadaan seluruh
                  situs, bukan milik satu halaman. Kalau pita disembunyikan
                  begitu saja, chip ikut hilang dan keputusan lama itu batal
                  diam-diam.

                  `<header>` sendiri TETAP dirender di semua halaman: tingginya
                  konstanta `--dasbor-topbar-h` (52px), dan sederet
                  `calc(100dvh - N)` di halaman grafik/tabel sudah
                  memperhitungkannya. Membuang kepalanya akan menggeser
                  semuanya 52px tanpa satu pun galat. */}
              {beranda ? <PitaKurs /> : <div className="dasbor-pita dasbor-pita-solo"><StatusBursa /></div>}
            </header>

            <main className="dasbor-main">
              {/* Pengumuman sistem — DI DALAM `dasbor-main`, bukan di atas
                  `<header>`. Di luar sini ia akan menggeser seluruh kerangka
                  termasuk bilah sisi, dan pada ponsel mendorong menu keluar
                  layar. Di dalam, ia menempati aliran isi seperti halaman
                  biasa dan ikut aturan gulir yang sudah ada. */}
              {/* Pita renovasi di atas pengumuman lain: ia soal KEADAAN
                  DATA seluruh situs, jadi ia membingkai apa pun di bawahnya. */}
              <Renovasi />
              <PitaPengumuman />
              {/* Baris tab halaman yang sudah dilebur jadi satu pintu
                  (peleburan 30 → 9 menu, 31 Agu 2026). Dipasang SEKALI di sini,
                  bukan di 27 halaman: komponennya mengembalikan null pada
                  halaman yang bukan bagian dari tab mana pun, jadi memasangnya
                  satu per satu cuma menambah 27 tempat yang bisa lupa. */}
              <TabHalaman />
              <Outlet />
            </main>

            {/* Kaki global DIBUANG (Johan 28 Agu: "footer nya di hapus saja
                itu") — ruangnya jatuh ke halaman; chart Whales kini mentok
                bawah. Klausa atribusi lightweight-charts yang WAJIB lisensi
                pindah ke halaman Metodologi (lihat komentar di sana) —
                menghapus kaki TIDAK boleh menghapus klausanya. */}
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
            kehilangan pintu tanyanya. Ditakdown sementara 21 Agu 2026,
            lihat lib/fitur.ts — sakelar TANYA_PAPAN_AKTIF. */}
        {TANYA_PAPAN_AKTIF && <TanyaPapan />}
      </div>
    </LoginModalProvider>
  )
}
