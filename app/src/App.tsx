import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { AksesHalamanProvider } from './context/AksesHalamanContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PenjagaHalaman } from './components/PenjagaHalaman'
import { DasborLayout } from './components/dasbor/DasborLayout'
import { PemuatHalaman } from './components/dasbor/PemuatHalaman'
import { Beranda } from './views/dasbor/Beranda'
import { IndeksDunia } from './views/dasbor/IndeksDunia'
import { TopStocks } from './views/dasbor/TopStocks'
import { TopBroker } from './views/dasbor/TopBroker'
import { SektorIndeks } from './views/dasbor/SektorIndeks'
import { KalkulatorJia } from './views/dasbor/KalkulatorJia'
import { Forum, ForumSambutan } from './views/dasbor/Forum'
import { ForumRuang } from './views/dasbor/ForumRuang'
import { Feedback } from './views/dasbor/Feedback'
import { Login } from './views/Login'
import './App.css'

// Code splitting (percepat pemuatan awal jaringan lambat, #109): halaman
// berat dipecah dari bundle utama, diunduh cuma saat rutenya benar-benar
// dibuka. Indeks Dunia (halaman depan) SENGAJA tetap statis di atas — itu
// yang harus tampil tercepat. Chart (TradingView), Peta Investor (d3),
// Broker Summary/Stock Detail (Chart.js), Radar, Bulletin, dan seluruh
// area /admin/* dipindah ke sini.
const ChartIndeks = lazy(() => import('./views/dasbor/ChartIndeks').then((m) => ({ default: m.ChartIndeks })))
const BrokerSummary = lazy(() => import('./views/dasbor/BrokerSummary').then((m) => ({ default: m.BrokerSummary })))
const StockDetail = lazy(() => import('./views/dasbor/StockDetail').then((m) => ({ default: m.StockDetail })))
const PetaInvestor = lazy(() => import('./views/dasbor/PetaInvestor').then((m) => ({ default: m.PetaInvestor })))
const Kabar = lazy(() => import('./views/dasbor/Kabar').then((m) => ({ default: m.Kabar })))
const Bulletin = lazy(() => import('./views/dasbor/Bulletin').then((m) => ({ default: m.Bulletin })))
const Radar = lazy(() => import('./views/dasbor/Radar').then((m) => ({ default: m.Radar })))
const Seasonality = lazy(() => import('./views/dasbor/Seasonality').then((m) => ({ default: m.Seasonality })))
const AdminLayout = lazy(() => import('./views/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const UnggahHarian = lazy(() => import('./views/admin/UnggahHarian').then((m) => ({ default: m.UnggahHarian })))
const AkunAdmin = lazy(() => import('./views/admin/AkunAdmin').then((m) => ({ default: m.AkunAdmin })))
const KurasiSetoran = lazy(() => import('./views/admin/KurasiSetoran').then((m) => ({ default: m.KurasiSetoran })))
const RadarUnggah = lazy(() => import('./views/admin/RadarUnggah').then((m) => ({ default: m.RadarUnggah })))
const BedahTab = lazy(() => import('./views/admin/BedahTab').then((m) => ({ default: m.BedahTab })))
const AksesAdmin = lazy(() => import('./views/admin/AksesAdmin').then((m) => ({ default: m.AksesAdmin })))
const AktivitasAdmin = lazy(() => import('./views/admin/AktivitasAdmin').then((m) => ({ default: m.AktivitasAdmin })))
const RakTerbitan = lazy(() => import('./views/admin/RakTerbitan').then((m) => ({ default: m.RakTerbitan })))
const ChangelogAdmin = lazy(() => import('./views/admin/ChangelogAdmin').then((m) => ({ default: m.ChangelogAdmin })))
const ChangelogPanel = lazy(() => import('./views/admin/ChangelogAdmin').then((m) => ({ default: m.ChangelogPanel })))
const EdisiUjicoba = lazy(() => import('./views/EdisiUjicoba').then((m) => ({ default: m.EdisiUjicoba })))
const EdisiView = lazy(() => import('./views/EdisiView').then((m) => ({ default: m.EdisiView })))

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Fase 6 — akses & jenjang: satu sumber `halaman_saya()` dipakai
            bareng PenjagaHalaman (guard rute) & badge gembok Sidebar/LaciMobile.
            Di dalam AuthProvider (butuh sesi), di luar ThemeProvider (tak
            terkait tema). */}
        <AksesHalamanProvider>
        <ThemeProvider>
          {/* Satu boundary Suspense utk semua rute lazy di bawah — fallback
              pakai .fullscreen-msg yang sudah ada (dipakai jua PenjagaHalaman/
              ProtectedRoute utk keadaan "sedang menunggu jawaban"), bukan
              komponen pemuat baru. */}
          <Suspense fallback={<PemuatHalaman />}>
          <Routes>
            {/* Publik — dasbor, tanpa login. Index = Beranda: pintu masuk
                yang menyebut identitas PAPAN (data & informasi), kabar edisi
                terbaru, lalu kartu ke tiap halaman. Indeks Dunia — yang dulu
                menempati '/' — pindah ke /indeks dengan kunci aksesnya
                (`dasbor`) ikut pindah; Beranda sendiri terbuka untuk siapa
                pun, termasuk yang belum masuk. */}
            <Route element={<DasborLayout />}>
              <Route path="/" element={<Beranda />} />
              <Route path="/indeks" element={<PenjagaHalaman kunci="dasbor"><IndeksDunia /></PenjagaHalaman>} />
              {/* Sweep 15 Agu: SETIAP halaman yang punya rute sendiri wajib
                  punya kunci akses. Top Stocks & Top Broker sebelumnya tidak
                  terdaftar sama sekali — halaman tanpa aturan berarti celah
                  yang tak kelihatan dari tab Akses (persis yang terjadi pada
                  Radar). Keduanya kini publik secara default, tapi bisa
                  dikunci dari panel tanpa menyentuh kode. */}
              <Route path="/stocks" element={<PenjagaHalaman kunci="stocks"><TopStocks /></PenjagaHalaman>} />
              {/* Kunci 'broker' = "Broker Summary" (halaman lain); Top Broker
                  punya kuncinya sendiri, 'topbroker'. */}
              <Route path="/broker" element={<PenjagaHalaman kunci="topbroker"><TopBroker /></PenjagaHalaman>} />
              <Route path="/sector" element={<PenjagaHalaman kunci="sektor"><SektorIndeks /></PenjagaHalaman>} />
              <Route path="/chart" element={<PenjagaHalaman kunci="chart"><ChartIndeks /></PenjagaHalaman>} />
              <Route path="/stock-detail" element={<PenjagaHalaman kunci="detail"><StockDetail /></PenjagaHalaman>} />
              <Route path="/peta-investor" element={<PenjagaHalaman kunci="peta"><PetaInvestor /></PenjagaHalaman>} />
              <Route path="/broker-summary" element={<PenjagaHalaman kunci="broker"><BrokerSummary /></PenjagaHalaman>} />
              <Route path="/kalkulator" element={<PenjagaHalaman kunci="kalkulator"><KalkulatorJia /></PenjagaHalaman>} />
              <Route path="/kabar" element={<Kabar />} />
              <Route path="/bulletin" element={<PenjagaHalaman kunci="bulletin"><Bulletin /></PenjagaHalaman>} />
              {/* Kunci 'radar' (label "Radar WDWL") menunjuk HALAMAN PUBLIK ini,
                  bukan tab admin tempat sumbernya diunggah — produknya yang
                  dijaga, bukan alat rakitnya. Sempat salah tafsir dan halaman
                  ini terbuka untuk semua orang padahal setelannya "perlu
                  login". */}
              <Route path="/radar" element={<PenjagaHalaman kunci="radar"><Radar /></PenjagaHalaman>} />
              <Route path="/seasonality" element={<PenjagaHalaman kunci="seasonality"><Seasonality /></PenjagaHalaman>} />
              {/* Forum: backend belum punya kunci `akses_halaman` utk ini —
                  sengaja TIDAK dibungkus PenjagaHalaman. Kalau nanti mau
                  dikunci, tambah barisnya di tab Akses lalu pasang di sini. */}
              {/* Rute bersarang: <Forum/> jadi shell (rel ruang + kotak cari)
                  yang TIDAK ikut dimuat ulang saat pindah ruang; cuma
                  <Outlet/> di kanannya yang berganti. */}
              <Route path="/forum" element={<Forum />}>
                <Route index element={<ForumSambutan />} />
                <Route path=":kunci" element={<ForumRuang />} />
              </Route>
              <Route path="/feedback" element={<PenjagaHalaman kunci="saran"><Feedback /></PenjagaHalaman>} />
              {/* /admin ikut DI DALAM layout (rail/topbar tetap tampil) tapi
                  tetap dijaga ProtectedRoute — belum login dilempar ke /login
                  yang berujung balik ke / dengan LoginModal terbuka (#41).
                  Bersarang di bawah AdminLayout (#shell-tab): satu shell
                  (header + tab bar) yang TIDAK remount saat pindah tab —
                  cuma <Outlet/> isinya yang berganti. Tab tanpa hak (Kurasi/
                  Akun non-superadmin, Bedah tanpa boleh_bedah) disembunyikan
                  di AdminLayout sendiri, tapi URL-nya tetap hidup (guard
                  AksesDitolak di tiap halaman jaga akses langsung/bookmark).
                  CATATAN (Fase 6): kunci akses_halaman 'admin' ("Area Admin")
                  SENGAJA TIDAK dipakai membungkus rute ini — isinya di database
                  tingkat='superadmin', kalau dipasang di sini SEMUA kontributor
                  (bukan cuma superadmin) akan terkunci dari tab Unggah mereka
                  sendiri, padahal itu jalur inti aplikasi. Superadmin-only sudah
                  ditegakkan lewat guard AksesDitolak per-tab yang sudah ada
                  (profil.peran, dicek di server tiap tabel/fungsi) — bukan lewat
                  lapisan Fase 6 ini. Kalau maksud kunci 'admin' sebenarnya beda
                  (mis. seharusnya tingkat='login'), sesuaikan baris itu di tab
                  Akses lalu pasang PenjagaHalaman kunci="admin" di sini. */}
              <Route element={<ProtectedRoute />}>
                {/* Kunci 'admin' sekarang bertingkat "perlu login" (bukan
                    superadmin) — /admin juga rumah kontributor, jadi penjaga
                    di pintu depan aman dipasang. Gerbang superadmin tetap
                    berlaku PER TAB (Kurasi/Akun/Akses/Radar). */}
                <Route path="/admin" element={<PenjagaHalaman kunci="admin"><AdminLayout /></PenjagaHalaman>}>
                  <Route index element={<UnggahHarian />} />
                  <Route path="kurasi" element={<KurasiSetoran />} />
                  <Route path="radar" element={<RadarUnggah />} />
                  <Route path="bedah" element={<PenjagaHalaman kunci="bedah"><BedahTab /></PenjagaHalaman>} />
                  <Route path="terbitan" element={<RakTerbitan />} />
                  <Route path="akun" element={<AkunAdmin />} />
                  <Route path="akses" element={<AksesAdmin />} />
                  <Route path="aktivitas" element={<AktivitasAdmin />} />
                  {/* "riwayat", bukan "changelog": /admin/changelog sudah dipakai
                      halaman mandiri lama (penanda halaman masih beredar), dan
                      dua route berpath sama di dua tingkat bikin bingung. */}
                  <Route path="riwayat" element={<ChangelogPanel />} />
                </Route>
              </Route>
            </Route>
            {/* /login lama dipertahankan sbg redirect (bookmark/tautan luar) — login
                sekarang modal, dipicu dari Sidebar/MobileNav (lihat views/Login.tsx). */}
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/admin/changelog" element={<ChangelogAdmin />} />
              <Route path="/admin/edisi/ujicoba" element={<EdisiUjicoba />} />
              <Route path="/admin/edisi/:kode" element={<EdisiView />} />
            </Route>
          </Routes>
          </Suspense>
        </ThemeProvider>
        </AksesHalamanProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
