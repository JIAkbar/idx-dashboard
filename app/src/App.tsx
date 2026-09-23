import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
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
import { BrokerPasar } from './views/dasbor/BrokerPasar'
import { BrokerDetail } from './views/dasbor/BrokerDetail'
import { SektorPasar } from './views/dasbor/SektorPasar'
import { AlatKalkulator } from './views/dasbor/AlatKalkulator'
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
// Broker Summary v2 (22 Agu 2026) — arus broker PER EMITEN, berkas terpisah
// dari BrokerSummary lama (broker level pasar) yang sengaja tidak disentuh.
const BrokerSummaryV2 = lazy(() => import('./views/dasbor/BrokerSummaryV2').then((m) => ({ default: m.BrokerSummaryV2 })))
// Neo Papan (23 Agu 2026) — delapan tab analisis, sibling Kuli Papan di grup Dev.
const NeoPapan = lazy(() => import('./views/dasbor/NeoPapan').then((m) => ({ default: m.NeoPapan })))
const BerkasEmiten = lazy(() => import('./views/dasbor/BerkasEmiten'))
const WhalesPapan = lazy(() => import('./views/dasbor/WhalesPapan'))
const TraderPapan = lazy(() => import('./views/dasbor/TraderPapan'))
const Bandarmologi = lazy(() => import('./views/dasbor/Bandarmologi'))
const HarianPapan = lazy(() => import('./views/dasbor/HarianPapan').then((m) => ({ default: m.HarianPapan })))
const JagoPapan = lazy(() => import('./views/dasbor/JagoPapan').then((m) => ({ default: m.JagoPapan })))
const StockDetail = lazy(() => import('./views/dasbor/StockDetail').then((m) => ({ default: m.StockDetail })))
const PetaInvestor = lazy(() => import('./views/dasbor/PetaInvestor').then((m) => ({ default: m.PetaInvestor })))
const Kabar = lazy(() => import('./views/dasbor/Kabar').then((m) => ({ default: m.Kabar })))
const Bulletin = lazy(() => import('./views/dasbor/Bulletin').then((m) => ({ default: m.Bulletin })))
const Radar = lazy(() => import('./views/dasbor/Radar').then((m) => ({ default: m.Radar })))
const Seasonality = lazy(() => import('./views/dasbor/Seasonality').then((m) => ({ default: m.Seasonality })))
const GrafikEmiten = lazy(() => import('./views/dasbor/GrafikEmiten').then((m) => ({ default: m.GrafikEmiten })))
const KartuAnalisa = lazy(() => import('./views/dasbor/KartuAnalisa').then((m) => ({ default: m.KartuAnalisa })))
const WinratePapan = lazy(() => import('./views/dasbor/WinratePapan').then((m) => ({ default: m.WinratePapan })))
const RaporUji = lazy(() => import('./views/dasbor/RaporUji').then((m) => ({ default: m.RaporUji })))
const Screener = lazy(() => import('./views/dasbor/Screener').then((m) => ({ default: m.Screener })))
const Metodologi = lazy(() => import('./views/dasbor/Metodologi').then((m) => ({ default: m.Metodologi })))
const StatistikBerkala = lazy(() => import('./views/dasbor/StatistikBerkala').then((m) => ({ default: m.StatistikBerkala })))
const Watchlist = lazy(() => import('./views/dasbor/Watchlist').then((m) => ({ default: m.Watchlist })))
const AliranAsing = lazy(() => import('./views/dasbor/AliranAsing').then((m) => ({ default: m.AliranAsing })))
const IpoAnalysis = lazy(() => import('./views/dasbor/IpoAnalysis').then((m) => ({ default: m.IpoAnalysis })))
const AdminLayout = lazy(() => import('./views/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const UnggahHarian = lazy(() => import('./views/admin/UnggahHarian').then((m) => ({ default: m.UnggahHarian })))
const TesisTab = lazy(() => import('./views/admin/TesisTab').then((m) => ({ default: m.TesisTab })))
const AkunAdmin = lazy(() => import('./views/admin/AkunAdmin').then((m) => ({ default: m.AkunAdmin })))
const KurasiSetoran = lazy(() => import('./views/admin/KurasiSetoran').then((m) => ({ default: m.KurasiSetoran })))
const RadarUnggah = lazy(() => import('./views/admin/RadarUnggah').then((m) => ({ default: m.RadarUnggah })))
const BedahTab = lazy(() => import('./views/admin/BedahTab').then((m) => ({ default: m.BedahTab })))
const AksesAdmin = lazy(() => import('./views/admin/AksesAdmin').then((m) => ({ default: m.AksesAdmin })))
const AktivitasAdmin = lazy(() => import('./views/admin/AktivitasAdmin').then((m) => ({ default: m.AktivitasAdmin })))
const RakTerbitan = lazy(() => import('./views/admin/RakTerbitan').then((m) => ({ default: m.RakTerbitan })))
const ChangelogAdmin = lazy(() => import('./views/admin/ChangelogAdmin').then((m) => ({ default: m.ChangelogAdmin })))
const ChangelogPanel = lazy(() => import('./views/admin/ChangelogAdmin').then((m) => ({ default: m.ChangelogPanel })))
// PAPAN Baru (#586): 5 layar, 18 lapisan re-imagined. Halaman lama tak disentuh.
const BaruLayout = lazy(() => import('./views/baru/BaruLayout').then((m) => ({ default: m.BaruLayout })))
const BaruBaruBeranda = lazy(() => import('./views/baru/BaruBeranda'))
const BaruL1Bukti = lazy(() => import('./views/baru/L1Bukti'))
const BaruL1Metodologi = lazy(() => import('./views/baru/L1Metodologi'))
const BaruL2Indeks = lazy(() => import('./views/baru/L2Indeks'))
const BaruL2Arus = lazy(() => import('./views/baru/L2Arus'))
const BaruL2Peringkat = lazy(() => import('./views/baru/L2Peringkat'))
const BaruL2HariIni = lazy(() => import('./views/baru/L2HariIni'))
const BaruL2Berkala = lazy(() => import('./views/baru/L2Berkala'))
const BaruL3Harga = lazy(() => import('./views/baru/L3Harga'))
const BaruL3Berkas = lazy(() => import('./views/baru/L3Berkas'))
const BaruL3SudutBroker = lazy(() => import('./views/baru/L3SudutBroker'))
const BaruL3BrokerSummary = lazy(() => import('./views/baru/L3BrokerSummary'))
const BaruL3Musiman = lazy(() => import('./views/baru/L3Musiman'))
const BaruL3Ipo = lazy(() => import('./views/baru/L3Ipo'))
const BaruL4Jago = lazy(() => import('./views/baru/L4Jago'))
const BaruL4Terbitan = lazy(() => import('./views/baru/L4Terbitan'))
const BaruL4Screener = lazy(() => import('./views/baru/L4Screener'))
const BaruL4Redaksi = lazy(() => import('./views/baru/L4Redaksi'))
const BaruL5Watchlist = lazy(() => import('./views/baru/L5Watchlist'))
const EdisiUjicoba = lazy(() => import('./views/EdisiUjicoba').then((m) => ({ default: m.EdisiUjicoba })))

/**
 * Bedah Emiten pensiun 21 Agu 2026 — isinya digabung ke Stock Detail. Rute
 * `/bedah-emiten` DIBIARKAN hidup (tautan lama tak boleh mati) tapi cuma
 * mengalihkan ke `/stock-detail` dengan kode emiten yang sama, dari `?kode=`
 * ATAU `?sym=` (nama lama halaman ini, dipertahankan).
 */
function RedirectBedahEmiten() {
  const [sp] = useSearchParams()
  const kode = sp.get('kode') ?? sp.get('sym')
  return <Navigate to={kode ? `/stock-detail?kode=${encodeURIComponent(kode)}` : '/stock-detail'} replace />
}

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
              {/* Broker Pasar (#200 A gelombang 2): Top Broker + Broker Summary
                  level pasar. Rute menjaga bagian Peringkat dengan 'topbroker';
                  bagian Rincian dijaga 'broker' di dalam BrokerPasar. */}
              <Route path="/broker" element={<PenjagaHalaman kunci="topbroker"><BrokerPasar /></PenjagaHalaman>} />
              {/* Rincian satu broker (#30). Kuncinya SENGAJA `topbroker`,
                  bukan kunci baru: ini tampilan rinci dari halaman yang
                  sama, bukan halaman menu tersendiri, jadi aturan akses
                  induknya harus berlaku apa adanya. Kunci sendiri akan
                  membuat rincian bisa terbuka saat induknya terkunci -
                  gerbang yang bocor lewat satu klik. */}
              <Route path="/broker/:kode" element={<PenjagaHalaman kunci="topbroker"><BrokerDetail /></PenjagaHalaman>} />
              <Route path="/sector" element={<PenjagaHalaman kunci="sektor"><SektorPasar /></PenjagaHalaman>} />
              {/* Statistik Berkala — rekap pekan bursa dari terbitan resmi IDX
                  (arsipnya sudah lama dipanen tapi belum pernah punya layar).
                  Kunci 'statistik' belum ada barisnya di `akses_halaman`, dan
                  itu memang aman: kunci tak dikenal fail-open (aksesHalaman.ts),
                  jadi halamannya publik sampai Johan mengatur tingkatnya dari
                  tab Akses — tanpa menyentuh kode lagi. */}
              <Route path="/statistik" element={<PenjagaHalaman kunci="statistik"><StatistikBerkala /></PenjagaHalaman>} />
              <Route path="/chart" element={<PenjagaHalaman kunci="chart"><ChartIndeks /></PenjagaHalaman>} />
              <Route path="/stock-detail" element={<PenjagaHalaman kunci="detail"><StockDetail /></PenjagaHalaman>} />
              {/* Bedah Emiten (backlog A2 / #153) PENSIUN 21 Agu 2026 — isinya
                  digabung ke Stock Detail (Aktivitas Transaksi, Lima Langkah
                  Uang, Panel Khas PAPAN masuk tab Statistik; Banding Emiten
                  jadi tab Banding). Rute dibiarkan hidup, cuma mengalihkan —
                  tautan lama ("Bedah BBCA") tak boleh mendarat di halaman
                  kosong. Guard-nya dipertahankan (kunci 'bedah-emiten' fail-
                  open sampai diatur dari tab Akses) supaya perilakunya sama
                  seperti sebelum dialihkan. */}
              <Route path="/bedah-emiten" element={<PenjagaHalaman kunci="bedah-emiten"><RedirectBedahEmiten /></PenjagaHalaman>} />
              <Route path="/peta-investor" element={<PenjagaHalaman kunci="peta"><PetaInvestor /></PenjagaHalaman>} />
              {/* Alamat lama Broker Summary level pasar tetap terbuka: dialihkan
                  ke bagian Rincian di Broker Pasar (#200 A gelombang 2). */}
              <Route path="/broker-summary" element={<Navigate to="/broker?bagian=rincian" replace />} />
              {/* Broker Summary v2 (22 Agu 2026) — arus broker PER EMITEN,
                  berdampingan dengan /broker-summary di atas (tidak
                  disentuh). Kunci 'broker-v2' terdaftar di PETA_MENU_KUNCI
                  DAN akses_halaman sejak rute ini dibuat (aturan wajib). */}
              <Route path="/broker-summary-v2" element={<PenjagaHalaman kunci="broker-v2"><BrokerSummaryV2 /></PenjagaHalaman>} />
              {/* Kuli Papan jadi bagian Kalkulator (#200 A gelombang 4); alamat lama tetap terbuka. */}
              <Route path="/kuli-papan" element={<Navigate to="/kalkulator?bagian=kuli-papan" replace />} />
              {/* Neo Papan (23 Agu 2026) — kunci 'neo-papan' terdaftar di
                  PETA_MENU_KUNCI di sini; baris `akses_halaman` di Supabase
                  MENYUSUL (aturan wajib #170, dikerjakan Johan). */}
              <Route path="/neo-papan" element={<PenjagaHalaman kunci="neo-papan"><NeoPapan /></PenjagaHalaman>} />
              {/* Whales Papan (25 Agu 2026) — kanvas jejak bandar harian,
                  bentuknya dipetik dari whales.id. Kunci 'whales-papan'
                  terdaftar di PETA_MENU_KUNCI; baris `akses_halaman` di
                  Supabase menyusul (aturan dua tempat). */}
              {/* Berkas Emiten (28 Agu 2026) — satu kode, semua gudang. Kunci
                  'berkas-emiten' terdaftar di PETA_MENU_KUNCI DAN di tabel
                  akses_halaman (tingkat superadmin) pada hari yang sama. */}
              <Route path="/berkas-emiten" element={<PenjagaHalaman kunci="berkas-emiten"><BerkasEmiten /></PenjagaHalaman>} />
              <Route path="/whales-papan" element={<PenjagaHalaman kunci="whales-papan"><WhalesPapan /></PenjagaHalaman>} />
              {/* Trader Papan (25 Agu 2026) — posisi broker per emiten, bentuknya
                  dipetik dari tab Inventory tradersaham.com. Pasangan Whales
                  Papan (sumbu masuk pelaku, bukan harga) dan membaca berkas yang
                  sama. Baris `akses_halaman` di Supabase menyusul. */}
              <Route path="/trader-papan" element={<PenjagaHalaman kunci="trader-papan"><TraderPapan /></PenjagaHalaman>} />
              <Route path="/bandarmologi" element={<PenjagaHalaman kunci="bandarmologi"><Bandarmologi /></PenjagaHalaman>} />
              {/* Harian & Jago Papan (26 Agu 2026, dispatch Dev PAPAN) — kunci
                  terdaftar di PETA_MENU_KUNCI; baris akses_halaman Supabase
                  menyusul (aturan dua tempat). */}
              <Route path="/harian-papan" element={<PenjagaHalaman kunci="harian-papan"><HarianPapan /></PenjagaHalaman>} />
              <Route path="/jago-papan" element={<PenjagaHalaman kunci="jago-papan"><JagoPapan /></PenjagaHalaman>} />
              {/* Aliran Asing (22 Agu 2026) — kunci 'aliran-asing' sudah
                  terdaftar di PETA_MENU_KUNCI DAN akses_halaman sejak rute
                  ini dibuat (aturan wajib 21 Agu 2026). */}
              <Route path="/aliran-asing" element={<PenjagaHalaman kunci="aliran-asing"><AliranAsing /></PenjagaHalaman>} />
              <Route path="/kalkulator" element={<PenjagaHalaman kunci="kalkulator"><AlatKalkulator /></PenjagaHalaman>} />
              <Route path="/kabar" element={<Kabar />} />
              <Route path="/bulletin" element={<PenjagaHalaman kunci="bulletin"><Bulletin /></PenjagaHalaman>} />
              {/* Kunci 'radar' (label "Radar WDWL") menunjuk HALAMAN PUBLIK ini,
                  bukan tab admin tempat sumbernya diunggah — produknya yang
                  dijaga, bukan alat rakitnya. Sempat salah tafsir dan halaman
                  ini terbuka untuk semua orang padahal setelannya "perlu
                  login". */}
              <Route path="/radar" element={<PenjagaHalaman kunci="radar"><Radar /></PenjagaHalaman>} />
              {/* Watchlist dinamis (backlog C8, 19 Agu 2026) — beda dari
                  /radar (Radar Watchlist, arsip WDWL berbasis aturan): ini
                  daftar pantau MILIK PEMBACA SENDIRI, disimpan localStorage
                  (lib/dasbor/watchlist.ts), bergerak mengikuti OHLCV harian.
                  Kunci 'watchlist' belum ada baris di `akses_halaman` (pola
                  sama 'kta'/'statistik') -> publik sampai diatur dari tab
                  Akses, tapi kuncinya sudah terpasang di sini & PETA_MENU_KUNCI. */}
              {/* PAPAN Baru (#586) — satu kunci akses untuk seluruh bagian; Meja redaksi superadmin. */}
              <Route path="/baru" element={<PenjagaHalaman kunci="papan-baru"><BaruLayout /></PenjagaHalaman>}>
                <Route index element={<BaruBaruBeranda />} />
                <Route path="bukti" element={<BaruL1Bukti />} />
                <Route path="metodologi" element={<BaruL1Metodologi />} />
                <Route path="indeks" element={<BaruL2Indeks />} />
                <Route path="arus" element={<BaruL2Arus />} />
                <Route path="peringkat" element={<BaruL2Peringkat />} />
                <Route path="hari-ini" element={<BaruL2HariIni />} />
                <Route path="berkala" element={<BaruL2Berkala />} />
                <Route path="ipo" element={<BaruL3Ipo />} />
                <Route path="jago" element={<BaruL4Jago />} />
                <Route path="terbitan" element={<BaruL4Terbitan />} />
                <Route path="screener" element={<BaruL4Screener />} />
                <Route path="watchlist" element={<BaruL5Watchlist />} />
                <Route path="redaksi" element={<PenjagaHalaman kunci="papan-baru-redaksi"><BaruL4Redaksi /></PenjagaHalaman>} />
                <Route path="emiten" element={<Navigate to="/baru/emiten/BBCA/harga" replace />} />
                <Route path="emiten/:kode" element={<Navigate to="harga" replace />} />
                <Route path="emiten/:kode/harga" element={<BaruL3Harga />} />
                <Route path="emiten/:kode/berkas" element={<BaruL3Berkas />} />
                <Route path="emiten/:kode/broker" element={<BaruL3SudutBroker />} />
                <Route path="emiten/:kode/broker-summary" element={<BaruL3BrokerSummary />} />
                <Route path="emiten/:kode/musiman" element={<BaruL3Musiman />} />
              </Route>
              <Route path="/watchlist" element={<PenjagaHalaman kunci="watchlist"><Watchlist /></PenjagaHalaman>} />
              <Route path="/seasonality" element={<PenjagaHalaman kunci="seasonality"><Seasonality /></PenjagaHalaman>} />
              {/* Chart PAPAN (bukan /chart TradingView) — lilin+volume dari
                  OHLC lokal, tahap 3. Perlu login (keputusan Johan 17 Agu
                  2026): fitur baru tak boleh publik. */}
              <Route path="/grafik" element={<PenjagaHalaman kunci="grafik"><GrafikEmiten /></PenjagaHalaman>} />
              {/* Kartu Analisa Emiten — kartu per emiten dirakit dari
                  data-idx/json/kartu/<KODE>.json (scripts/riset/kartu_analisa.py
                  --tulis). Kunci 'kta' belum punya baris di `akses_halaman`
                  (pola sama 'statistik') -> publik sampai Johan mengatur
                  tingkatnya dari tab Akses, tanpa perlu menyentuh kode lagi. */}
              <Route path="/kartu" element={<PenjagaHalaman kunci="kta"><KartuAnalisa /></PenjagaHalaman>} />
              <Route path="/winrate" element={<PenjagaHalaman kunci="winrate"><WinratePapan /></PenjagaHalaman>} />
              {/* Rapor Uji (#221 opsi a) — pilihan & sinyal PAPAN dinilai
                  sesudah kejadian. Baris `akses_halaman` sudah dibuat
                  bersamaan (migrasi akses_halaman_rapor_uji), tingkat publik. */}
              <Route path="/rapor-uji" element={<PenjagaHalaman kunci="rapor-uji"><RaporUji /></PenjagaHalaman>} />
              {/* Screener lembar-kerja (B31). Kunci `screener` sudah terdaftar
                  di `PETA_MENU_KUNCI` DAN di tabel `akses_halaman` sejak
                  rutenya dibuat — aturan wajib yang lahir 21 Agu 2026 sesudah
                  empat halaman hidup berminggu-minggu tanpa bisa diatur. */}
              <Route path="/screener" element={<PenjagaHalaman kunci="screener"><Screener /></PenjagaHalaman>} />
              {/* IPO Papan (spek §G, 27 Agu 2026) — kunci 'ipo' terdaftar
                  BERSAMAAN di PETA_MENU_KUNCI (aksesHalaman.ts); baris
                  `akses_halaman` Supabase dikerjakan pengawas, bukan agen ini
                  (aturan spek). Sampai baris itu ada, kuncinya fail-open. */}
              <Route path="/ipo" element={<PenjagaHalaman kunci="ipo"><IpoAnalysis /></PenjagaHalaman>} />
              <Route path="/feedback" element={<PenjagaHalaman kunci="saran"><Feedback /></PenjagaHalaman>} />
              {/* Backlog C6 — publik SENGAJA tanpa PenjagaHalaman: glosarium &
                  metodologi justru untuk pembaca yang belum percaya sistemnya,
                  menguncinya di balik login melawan tujuannya sendiri. */}
              <Route path="/metodologi" element={<Metodologi />} />
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
                  {/* Halaman muka /admin sekarang TESIS, bukan unggah tangkapan
                      layar (antrean #3, Johan 5 Sep 2026: "artinya tidak ada lagi
                      upload broker summary yaa, cukup buat tesis ?"). Unggah lama
                      tidak dihapus — ia pindah ke rute arsip di bawah supaya
                      riwayatnya tetap bisa dibuka superadmin. */}
                  <Route index element={<TesisTab />} />
                  <Route path="unggah-arsip" element={<UnggahHarian />} />
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
              {/* Pratinjau komponen Terbitan (React port template PDF) dari
                  fixture lokal. Rute `/admin/edisi/:kode` yang dulu membaca
                  tabel Supabase `edisi` DIBUANG di A3 (20 Agu 2026): tabelnya
                  nol baris, tak ada penulisnya, jadi rute itu selalu menjawab
                  "Edisi tidak ditemukan". Edisi jadi tetap berupa PDF di
                  `arus-pasar/keluaran/`, dibuka lewat /bulletin & Rak Terbitan. */}
              <Route path="/admin/edisi/ujicoba" element={<EdisiUjicoba />} />
            </Route>
            {/* Rute cadangan. Tanpa ini, URL yang tak dikenal memberi LAYAR PUTIH
                TOTAL — rail dan topbar ikut hilang, nol galat di konsol, dan
                pengunjung tak punya jalan kembali selain menekan tombol mundur.
                Terjadi nyata pada tag emiten di pesan yang menunjuk /forum/<kode>
                sesudah halaman Forum dicabut. Diarahkan ke Beranda alih-alih
                merender halaman 404 tersendiri: yang dibutuhkan orang tersesat
                adalah jalan keluar, bukan pemberitahuan bahwa ia tersesat. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </ThemeProvider>
        </AksesHalamanProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
