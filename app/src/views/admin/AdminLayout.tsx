import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProfilSaya, type ProfilSaya } from '../../lib/profilSaya'
import { daftarJenjang, hitungRingkasanSetoranSaya, ringkasanJenjang, type JenjangRow } from '../../lib/jenjang'
import { useKuotaSaya } from '../../lib/kuotaSaya'
import { IkonJenjang } from '../../components/dasbor/IkonJenjang'
import { ModalNaikJenjang } from '../../components/dasbor/ModalNaikJenjang'
import { supabase } from '../../lib/supabase'
import { AdminTanggalProvider } from '../../context/AdminTanggalContext'
import { hitungSetoranMenunggu } from '../../lib/supabaseSetoran'
import { perluSambutan, kunciSambutan, kunciBeku, kunciJenjang, perluRayakan } from '../../lib/sambutan'
import { statusBekuSaya, type StatusBeku } from '../../lib/statusBeku'
import { namaTampil } from '../../lib/namaTampil'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
import { LoncengNotifikasi } from '../../components/dasbor/LoncengNotifikasi'
import {
  IkonMenu,
  IKON_CATATAN,
  IKON_GAMBAR,
  IKON_GIR,
  IKON_GRAFIK_NAIK,
  IKON_JAM,
  IKON_KOTAK_ARSIP,
  IKON_KUNCI,
  IKON_PAPAN_KLIP,
  IKON_PERINGATAN,
  IKON_RADAR,
} from '../../components/dasbor/IkonMenu'
import './AdminShared.css'

/** Sapaan menurut jam lokal — dipakai header modal sambutan. */
function sapaan(): string {
  const j = new Date().getHours()
  if (j < 11) return 'Selamat pagi'
  if (j < 15) return 'Selamat siang'
  if (j < 19) return 'Selamat sore'
  return 'Selamat malam'
}

interface TabDef {
  to: string
  end?: boolean
  label: string
  ikon: string
  /** Tab tanpa hak TIDAK dirender sama sekali (bukan disabled). */
  tampil: boolean
  badge?: number
}

/**
 * Shell tab area admin (#shell-tab) — SATU route bersarang (/admin/*) yang
 * merender header (judul, kuota, email, Keluar) + tab bar sekali, lalu
 * <Outlet/> ganti isi panel tanpa remount header/tab saat pindah tab. Dulu
 * tiap sub-halaman (AdminHome/AkunAdmin/KurasiSetoran) punya headernya
 * sendiri dan tautan silang lewat <Link> biasa (flash blank + header
 * hilang-muncul tiap pindah) — sekarang cuma <Outlet/> yang berganti.
 *
 * Tanggal "panggung" dibagi ke seluruh tab lewat AdminTanggalProvider di
 * sini (bukan di tiap halaman) — pindah Unggah↔Kurasi tidak mereset tanggal
 * yang sedang dikerjakan.
 */
export function AdminLayout() {
  const { session, signOut } = useAuth()
  const { profil } = useProfilSaya()
  const location = useLocation()
  const navigate = useNavigate()
  const superadmin = profil?.peran === 'superadmin'
  const kuota = useKuotaSaya()

  const [konfirmKeluar, setKonfirmKeluar] = useState(false)
  const [sambut, setSambut] = useState(false)
  const [menunggu, setMenunggu] = useState(0)
  /** Modal peringatan "hampir dibekukan otomatis" (Fase 6, status_beku_saya()) —
   *  null selagi belum dicek/tak perlu tampil. Kontributor saja (superadmin
   *  tak pernah dicek/dibekukan). */
  const [bekuInfo, setBekuInfo] = useState<StatusBeku | null>(null)
  const [bekuTampil, setBekuTampil] = useState(false)
  /** Akun yang SUDAH dibekukan (aktif=false) — banner tetap, tak bisa ditutup. */
  const [statusTerkunci, setStatusTerkunci] = useState<StatusBeku | null>(null)
  /** Jenjang yang baru dicapai — non-null berarti modal perayaan tampil. */
  const [naikJenjang, setNaikJenjang] = useState<JenjangRow | null>(null)
  /** Modal "Lengkapi profil" (#item5, akun lama alias kosong) sudah ditutup
   *  sesi ini — dismissable, BUKAN gerbang mati: RLS `profil` saat ini cuma
   *  izinkan superadmin menulis baris siapa pun (lihat komentar di bawah
   *  render-nya), jadi kalau dipaksa non-dismissable, akun yang gagal simpan
   *  bisa terkunci total dari UI (termasuk tombol Keluar di baliknya). */
  const [lengkapiTutup, setLengkapiTutup] = useState(false)

  // Badge tab Kurasi — dihitung ulang tiap pindah halaman (proxy murah utk
  // "mungkin baru saja dikurasi/disetor", tanpa polling berkala).
  useEffect(() => {
    if (!superadmin) return
    let batal = false
    hitungSetoranMenunggu()
      .then((n) => !batal && setMenunggu(n))
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [superadmin, location.pathname])

  // Modal sambutan sekali per SESI LOGIN (perbaikan B) — penanda disimpan di
  // localStorage (bertahan lintas refresh/tab, beda dari sessionStorage lama)
  // berkunci user.id, nilainya user.last_sign_in_at (stabil selama refresh
  // token background, berubah tiap sign-in baru). Lihat lib/sambutan.ts.
  useEffect(() => {
    if (!session) return
    const kunci = kunciSambutan(session.user.id)
    const marker = session.user.last_sign_in_at
    if (perluSambutan(localStorage.getItem(kunci), marker)) setSambut(true)
  }, [session])

  function tutupSambutan() {
    if (session) localStorage.setItem(kunciSambutan(session.user.id), session.user.last_sign_in_at ?? '')
    setSambut(false)
  }

  // Peringatan "hampir dibekukan otomatis" — sekali per sesi login (pola
  // sama persis modal sambutan di atas, kunci localStorage beda namespace,
  // lihat lib/sambutan.ts). Kontributor saja: RPC `status_beku_saya()`
  // TIDAK dipanggil sama sekali utk superadmin (jangan tampil, jangan cek).
  useEffect(() => {
    if (!session || superadmin) return
    const kunci = kunciBeku(session.user.id)
    const marker = session.user.last_sign_in_at
    if (!perluSambutan(localStorage.getItem(kunci), marker)) return
    let batal = false
    statusBekuSaya().then((info) => {
      if (batal || !info) return
      if (info.peringatan) {
        setBekuInfo(info)
        setBekuTampil(true)
      }
    })
    return () => {
      batal = true
    }
  }, [session, superadmin])

  // Status "SUDAH beku" dibaca terpisah dari jalur peringatan di atas.
  // Peringatan menumpang jalur sambutan (sekali per sesi login, `perluSambutan`)
  // — masuk akal untuk pengingat, tapi salah untuk akun yang TELANJUR beku:
  // orang itu perlu melihat keterangannya tiap kali membuka halaman, bukan
  // sekali lalu hilang. Johan 22 Agu 2026: "berikan informasi akun anda
  // otomatis beku karena tidak aktif selama 5 hari dan tidak setor broker
  // summary ... hubungi superadmin untuk re-aktivasi akun lagi".
  useEffect(() => {
    if (!session || superadmin) return
    let batal = false
    statusBekuSaya().then((info) => {
      if (!batal && info && !info.aktif) setStatusTerkunci(info)
    })
    return () => { batal = true }
  }, [session, superadmin])

  function tutupBeku() {
    if (session) localStorage.setItem(kunciBeku(session.user.id), session.user.last_sign_in_at ?? '')
    setBekuTampil(false)
  }

  // Perayaan naik jenjang. Penandanya nomor tier, bukan sesi login: kenaikan
  // bisa terjadi saat halaman sedang terbuka (setoran baru disetujui), dan
  // perayaannya pantas muncul saat itu juga. Superadmin dilewati — ia tidak
  // berjenjang, dan tier di barisnya cuma sisa perhitungan yang tak dipakai.
  useEffect(() => {
    if (!session || superadmin || !profil) return
    const tier = profil.tier ?? 0
    const kunci = kunciJenjang(session.user.id)
    const tersimpan = localStorage.getItem(kunci)
    if (perluRayakan(tersimpan, tier)) {
      daftarJenjang()
        .then((daftar) => {
          const j = daftar.find((x) => x.tier === tier)
          if (j) setNaikJenjang(j)
        })
        .catch(() => {})
    }
    // Catat apa pun hasilnya — termasuk saat belum ada catatan sama sekali,
    // supaya kenaikan BERIKUTNYA punya pembanding.
    localStorage.setItem(kunci, String(tier))
  }, [session, superadmin, profil])

  /** Tombol "Setor sekarang" — tutup modal, pindah ke tab Unggah (index) dan
   *  minta form Tambah Emiten langsung terbuka lewat query `?tambah=1`
   *  (dibaca UnggahHarian.tsx, pola sama location.state.openLogin di
   *  DasborLayout.tsx — sinyal ringan lintas komponen tanpa lifting state). */
  function setorSekarang() {
    tutupBeku()
    navigate('/admin?tambah=1', { replace: true })
  }

  /** Tombol utama modal sambutan untuk kontributor — sama tujuannya dengan
   *  `setorSekarang` (form Tambah Emiten terbuka), beda penanda sesi yang
   *  ditulis: sambutan, bukan peringatan pembekuan. */
  function setorDariSambutan() {
    tutupSambutan()
    navigate('/admin?tambah=1', { replace: true })
  }

  useEffect(() => {
    if (!sambut) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutupSambutan()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tutupSambutan stabil cukup lewat closure session
  }, [sambut, session])

  async function keluar() {
    await signOut()
  }

  const perluLengkapiProfil = Boolean(profil && !profil.alias?.trim() && !lengkapiTutup)

  // ── Antrean #3, 6 Sep 2026 ────────────────────────────────────────────────
  // Johan: *"sekarang kan tidak perlu lagi ada kurasi, setor orderbook,
  // deepdive yang butuh data broker panjang"* · *"artinya menu2 sekarang di
  // bekukan saja"*. Yang kehilangan BAHANNYA dibekukan — bukan dihapus:
  // Unggah (tangkapan layar), Kurasi, dan Deep Dive manual sekarang superadmin
  // saja dan berlabel "Arsip", karena sumber brokernya kini panen mesin.
  // Tak ada satu baris `setoran` pun yang dihapus; riwayatnya tetap bisa
  // dibuka. Radar, Terbitan, Akun, Akses, Aktivitas, Changelog tak berubah.
  const tabs: TabDef[] = [
    { to: '/admin', end: true, label: 'Tesis', ikon: IKON_GRAFIK_NAIK, tampil: true },
    { to: '/admin/unggah-arsip', label: 'Unggah · arsip', ikon: IKON_GAMBAR, tampil: superadmin },
    { to: '/admin/kurasi', label: 'Kurasi · arsip', ikon: IKON_PAPAN_KLIP, tampil: superadmin, badge: menunggu },
    // Radar WDWL — produk kurasi khusus, kontributor tidak menyetor bahannya.
    { to: '/admin/radar', label: 'Radar', ikon: IKON_RADAR, tampil: superadmin },
    { to: '/admin/bedah', label: 'Deep Dive · arsip', ikon: IKON_GRAFIK_NAIK, tampil: superadmin },
    { to: '/admin/terbitan', label: 'Terbitan', ikon: IKON_KOTAK_ARSIP, tampil: true },
    { to: '/admin/akun', label: 'Akun', ikon: IKON_GIR, tampil: superadmin },
    { to: '/admin/akses', label: 'Akses', ikon: IKON_KUNCI, tampil: superadmin },
    // Fase 4 — keaktifan kontributor & sinyal keamanan, superadmin saja.
    { to: '/admin/aktivitas', label: 'Aktivitas', ikon: IKON_JAM, tampil: superadmin },
    // Changelog berdiri sendiri, bukan ekor tab Terbitan: Terbitan menjawab
    // "edisi apa yang sudah terbit", Changelog menjawab "aplikasinya berubah
    // apa" — dua pertanyaan berbeda yang kebetulan sama-sama berupa arsip.
    // Superadmin saja: isinya catatan rilis pengembangan, bukan bahan kerja
    // kontributor, dan memuatnya di sana cuma menambah tab yang tak dipakai.
    { to: '/admin/riwayat', label: 'Changelog', ikon: IKON_CATATAN, tampil: superadmin },
  ]

  // Tab aktif digulirkan ke dalam pandangan. Di 412px cuma empat dari sembilan
  // tab yang muat, jadi membuka /admin/akun lewat tautan langsung menampilkan
  // bilah tab yang tab aktifnya ada di luar layar — pembaca melihat "UNGGAH"
  // tersorot padahal yang terbuka "AKUN". `nearest` supaya bilah tak bergeser
  // sama sekali kalau tab aktifnya memang sudah kelihatan.
  const tabbarRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const bar = tabbarRef.current
    const aktif = bar?.querySelector<HTMLElement>('.tab.on')
    if (!bar || !aktif) return
    // Dihitung sendiri, bukan `scrollIntoView`: bilah ini punya pudaran 22px di
    // tepi kanan, dan scrollIntoView menempelkan tab aktif tepat di tepi
    // sehingga pudarannya sendiri yang menyembunyikannya (terukur: tab berakhir
    // 20px di luar, lalu 14px di dalam — tak pernah benar-benar lolos).
    const TEPI = 36
    const kiri = aktif.offsetLeft - TEPI
    const kanan = aktif.offsetLeft + aktif.offsetWidth + TEPI - bar.clientWidth
    if (bar.scrollLeft > kiri) bar.scrollLeft = Math.max(0, kiri)
    else if (bar.scrollLeft < kanan) bar.scrollLeft = kanan
    // `superadmin` ikut jadi ketergantungan: lima tab terakhir baru muncul
    // setelah profil termuat, jadi efek yang cuma bergantung pathname berjalan
    // saat bilahnya masih berisi empat tab dan tak menemukan tab aktifnya.
  }, [location.pathname, superadmin])

  /**
   * Pudaran tepi kanan hanya dipasang kalau bilahnya BENAR-BENAR bisa digulir.
   *
   * Versi sebelumnya memasangnya tanpa syarat dan mengandalkan
   * `animation-timeline: scroll(self inline)` untuk menghapusnya kembali.
   * Itu tak pernah bekerja pada kasus yang paling sering terlihat: kalau
   * isinya muat seluruhnya, elemennya tak punya overflow, timeline-nya
   * *inactive*, animasinya tak berefek — dan mask dasar tetap berlaku. Jadi
   * di layar lebar tab TERAKHIR selalu terlihat separuh pudar walau tak ada
   * apa pun di sebelah kanannya untuk digulir; persis yang dilaporkan
   * ("kepotong ini navbar nya") pada bilah selebar 1130px di jendela 1353px.
   */
  useEffect(() => {
    const bar = tabbarRef.current
    if (!bar) return
    const ukur = () => bar.classList.toggle('bisa-gulir', bar.scrollWidth > bar.clientWidth + 1)
    ukur()
    const ro = new ResizeObserver(ukur)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [superadmin])

  return (
    <div className="lantai admin-view">
      <div className="vhead" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Arus Pasar</h1>
          <span className="sub">{superadmin ? 'Area admin — unggah & kelola edisi' : 'Kontributor — setor broker summary harian'}</span>
        </div>
        <div className="af-kepala-aksi">
          {kuota != null && (
            <span className="af-kuota-info" title="Angka ini datang dari server (kuota_saya()), bukan hitungan layar">
              Kuota hari ini: {kuota}/hari
            </span>
          )}
          <span className="muted" title={session?.user.email}>{namaTampil(profil, session)}</span>
          <LoncengNotifikasi />
          <button type="button" className="dd-btn" onClick={() => setKonfirmKeluar(true)}>Keluar</button>
        </div>
      </div>

      <nav className="tabs admin-tabbar" role="tablist" aria-label="Bagian admin" ref={tabbarRef}>
        {tabs.filter((t) => t.tampil).map((t) => (
          // NavLink otomatis pasang aria-current="page" pada tab aktif (perilaku
          // bawaan React Router) — tak perlu diurus manual di sini.
          <NavLink key={t.to} to={t.to} end={t.end} role="tab" className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
            <IkonMenu d={t.ikon} size={13} /> {t.label}
            {Boolean(t.badge) && <span className="admin-tab-badge">{t.badge}</span>}
          </NavLink>
        ))}
      </nav>

      {statusTerkunci && (
        <div className="panel" style={{ marginTop: 14, borderColor: 'var(--amber)' }}>
          <div className="panel-h">
            <span className="lbl"><IkonMenu d={IKON_JAM} size={13} /> Akun dibekukan otomatis</span>
          </div>
          <div className="panel-b" style={{ display: 'grid', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
              Akun ini beku karena <b>{statusTerkunci.hari} hari kerja</b> berlalu tanpa setoran broker
              summary — ambang jenjangmu <b>{statusTerkunci.ambang} hari kerja</b>. Membuka halaman saja
              tidak menghentikan hitungan itu; yang menghentikannya adalah setoran.
            </p>
            <p className="muted" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.6 }}>
              Seluruh setoran yang pernah kamu kirim <b>tetap tercatat</b> — jenjang, jumlah setoran
              disetujui, dan kreditmu di edisi tidak hilang karena pembekuan ini. Hubungi
              <b> superadmin</b> untuk mengaktifkan kembali; begitu aktif, tiap setoran memperpanjang
              masa aktif {statusTerkunci.ambang} hari kerja berikutnya.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
        <AdminTanggalProvider>
          <Outlet />
        </AdminTanggalProvider>
      </div>

      {perluLengkapiProfil && (
        <LengkapiProfilModal onClose={() => setLengkapiTutup(true)} />
      )}

      {bekuInfo && bekuTampil && !perluLengkapiProfil && (
        <ModalKecil label="Hampir dibekukan otomatis" onClose={tutupBeku}>
          <p style={{ margin: 0, fontSize: 12.5 }}>
            <IkonMenu d={IKON_JAM} size={13} /> Sudah <b>{bekuInfo.hari} hari kerja</b> tanpa setoran
            broker summary — akun dibekukan otomatis kalau mencapai <b>{bekuInfo.ambang} hari kerja</b>.
          </p>
          <p className="muted" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55 }}>
            Sisa <b>{Math.max(0, bekuInfo.ambang - bekuInfo.hari)} hari kerja</b> lagi. Yang menghentikan
            hitungan ini adalah <b>setoran</b> itu sendiri — bukan menunggu kurasinya, dan bukan sekadar
            membuka halaman. Tiap setoran memperpanjang masa aktif {bekuInfo.ambang} hari kerja
            berikutnya, jadi menyetor di hari keempat pun mengulang hitungannya dari nol.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-p" style={{ flex: 1 }} onClick={setorSekarang}>Setor sekarang</button>
            <button type="button" className="dd-btn" onClick={tutupBeku}>Nanti</button>
          </div>
        </ModalKecil>
      )}

      {/* Perayaan naik jenjang didahulukan dari sambutan: kalau keduanya jatuh
          di muat yang sama, kabar bagus yang tampil duluan. */}
      {naikJenjang && !perluLengkapiProfil && (
        <ModalNaikJenjang
          jenjang={naikJenjang}
          kuotaBaru={kuota ?? naikJenjang.kuota}
          onTutup={() => setNaikJenjang(null)}
        />
      )}

      {sambut && !perluLengkapiProfil && !bekuTampil && !naikJenjang && (
        <div className="dasbor-modal-bg" onClick={tutupSambutan}>
          <div className="lantai dasbor-modal" role="dialog" aria-modal="true" aria-label="Ringkasan sesi admin" onClick={(e) => e.stopPropagation()}>
            <div className="panel af-sambut">
              <div className="af-sambut-head">
                <span className="af-monogram" aria-hidden="true">P</span>
                <div className="af-sambut-judul">
                  <span className="af-sambut-merek">{superadmin ? 'PAPAN · Area Admin' : 'PAPAN · Kontributor'}</span>
                  <span className="af-sambut-sapa">{sapaan()}</span>
                </div>
              </div>
              <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {session && (
                  <p style={{ margin: 0, fontSize: 12.5 }}>
                    Masuk sebagai <b>{namaTampil(profil, session)}</b>.
                  </p>
                )}
                <p className="muted" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55 }}>
                  {/* Antrean #3: kalimat ini dulu menyuruh mengunggah tangkapan
                      layar broker. Jalur itu beku — sumber brokernya kini panen
                      mesin — jadi sambutannya ikut berganti. Kalimat yang
                      mengarahkan ke jalur yang sudah tak menerima setoran lebih
                      buruk daripada tak ada kalimat sama sekali. */}
                  {superadmin
                    ? 'Setor tesis dari halaman Berkas Emiten, pantau Radar WDWL, dan kelola rak terbitan Arus Pasar — semuanya di tab-tab atas. Unggah & Kurasi kini arsip: isinya tetap bisa dibuka, tapi tak menerima setoran baru.'
                    : 'Setor tesis dari halaman Berkas Emiten, lalu pantau hasilnya di tab Tesis. Tesis dinilai mesin, bukan dikurasi — menang atau kalah, keduanya tercatat.'}
                </p>
                {!superadmin && profil && <SambutanJenjang profil={profil} />}
                <button
                  type="button"
                  className="btn-p"
                  style={{ width: '100%' }}
                  onClick={superadmin ? tutupSambutan : setorDariSambutan}
                >
                  {superadmin ? 'Mulai' : 'Setor broker summary'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {konfirmKeluar && (
        <ModalKecil label="Akhiri sesi?" onClose={() => setKonfirmKeluar(false)}>
          <p style={{ margin: 0, fontSize: 12.5 }}>
            Keluar dari akun <b>{namaTampil(profil, session)}</b>?
          </p>
          <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>
            Kamu harus masuk lagi untuk mengelola unggahan &amp; edisi.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-p af-btn-keluar" onClick={keluar}>Ya, keluar</button>
            <button type="button" className="dd-btn" onClick={() => setKonfirmKeluar(false)}>Batal</button>
          </div>
        </ModalKecil>
      )}
    </div>
  )
}

/**
 * Blok jenjang di modal sambutan kontributor — jenjang sekarang, kuota harian,
 * dan satu kalimat berisi jarak menuju jenjang berikutnya.
 *
 * Angkanya diturunkan `ringkasanJenjang()`, sumber yang sama dengan kartu
 * jenjang tab Unggah — bukan hitungan kedua yang bisa menyimpang darinya.
 * Sengaja tidak merender apa pun selagi data belum sampai: modal sambutan
 * muncul seketika setelah login, dan kerangka kosong yang berkedip sebentar
 * lebih mengganggu daripada blok yang menyusul sepersekian detik kemudian.
 */
function SambutanJenjang({ profil }: { profil: ProfilSaya }) {
  const [data, setData] = useState<{ jenjang: JenjangRow[]; angka: { disetujui: number; dihapus: number } } | null>(null)

  useEffect(() => {
    let batal = false
    Promise.all([daftarJenjang(), hitungRingkasanSetoranSaya()])
      .then(([jenjang, angka]) => !batal && setData({ jenjang, angka }))
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [])

  if (!data || data.jenjang.length === 0) return null
  const r = ringkasanJenjang(
    profil.tier ?? 0, profil.kuota_manual ?? null,
    data.angka.disetujui, data.angka.dihapus, data.jenjang
  )
  const ajakan = !r.berikutnya
    ? 'Kamu sudah di jenjang tertinggi — setoranmu yang menjaga bulletin tetap terbit tiap hari.'
    : r.kurangSetoran > 0
      ? `${r.kurangSetoran} setoran disetujui lagi untuk naik ke ${r.berikutnya.nama} — kuota harianmu ikut naik jadi ${r.berikutnya.kuota}.`
      : r.akurasiCukup
        ? `Syarat ${r.berikutnya.nama} sudah terpenuhi — tinggal menunggu kenaikan jenjang.`
        : `Akurasi belum cukup untuk ${r.berikutnya.nama} (butuh ${r.berikutnya.min_akurasi}%). Setoran yang lolos kurasi menaikkannya.`

  return (
    <div className="af-sambut-jenjang">
      <div className="af-sambut-jenjang-kepala">
        <IkonJenjang tier={r.jenjangSaatIni.tier} nama={r.jenjangSaatIni.nama} />
        <span className="nm">
          <span className="l">Jenjang</span>
          <b>{r.jenjangSaatIni.nama}</b>
        </span>
      </div>
      <div className="af-sambut-angka">
        <div>
          <span className="l">Kuota harian</span>
          <b>{r.kuotaEfektif} broker summary</b>
        </div>
        <div>
          <span className="l">Disetujui</span>
          <b>{r.disetujui}</b>
        </div>
        <div>
          <span className="l">Akurasi</span>
          <b>{r.akurasiPersen == null ? '—' : `${Math.round(r.akurasiPersen)}%`}</b>
        </div>
      </div>
      <p className="muted">{ajakan}</p>
    </div>
  )
}

/** Guard tampil dipakai tab yang butuh izin spesifik (mis. BedahTab, atau
 *  akses langsung /admin/kurasi & /admin/akun lewat URL/bookmark tanpa hak) —
 *  dipisah supaya tiap tab tak menduplikasi markup fd-empty. */
export function AksesDitolak({ pesan }: { pesan: string }) {
  return (
    <div className="fd-empty" style={{ padding: '60px 20px' }}>
      <p style={{ marginBottom: 8 }}><IkonMenu d={IKON_PERINGATAN} size={26} /></p>
      <p>{pesan}</p>
      <p style={{ fontSize: 11, marginTop: 6 }}><Link to="/admin">← Kembali ke Admin</Link></p>
    </div>
  )
}

/**
 * Modal "Lengkapi profil" (#item5) — akun lama yang aliasnya masih kosong
 * diminta mengisi sebelum menyetor (alias jadi kredit kontributor di PDF,
 * bukan email mentah). CATATAN PENTING: policy RLS tabel `profil` saat ini
 * (`profil_baca_sendiri` SELECT-only + `profil_kelola_superadmin` ALL-untuk-
 * superadmin) BELUM mengizinkan user mengubah baris sendiri — diperiksa
 * langsung ke database produksi, bukan tebakan. Update di bawah akan gagal
 * (galat RLS) untuk kontributor sampai ada policy UPDATE tambahan; sesuai
 * instruksi, SQL tidak diubah dari sini. Galat ditampilkan apa adanya supaya
 * jelas, dan modal ini SENGAJA bisa ditutup (bukan gerbang mati) —
 * non-dismissable + gagal-simpan permanen berarti akun itu terkunci total
 * dari UI, termasuk tombol Keluar di baliknya.
 */
function LengkapiProfilModal({ onClose }: { onClose: () => void }) {
  const [alias, setAlias] = useState('')
  const [kirim, setKirim] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const nilai = alias.trim()
    if (nilai.length < 2) {
      setErr('Alias minimal 2 karakter.')
      return
    }
    setKirim(true)
    setErr('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setErr('Sesi tidak ditemukan — masuk ulang.')
      setKirim(false)
      return
    }
    const { error } = await supabase.from('profil').update({ alias: nilai }).eq('id', user.id)
    if (error) {
      setErr(error.message)
      setKirim(false)
      return
    }
    onClose()
  }

  return (
    <ModalKecil label="Lengkapi profil" onClose={onClose}>
      <p style={{ margin: 0, fontSize: 12.5 }}>
        Isi alias sebelum menyetor — dipakai sebagai kredit kontributor di PDF Arus Pasar.
      </p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <span className="lbl">Alias</span>
          <input className="inp" type="text" autoFocus required value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Nama panggilan — minimal 2 karakter" />
        </div>
        <button type="submit" className="btn-p" disabled={kirim}>{kirim ? 'Menyimpan…' : 'Simpan'}</button>
        {err && <p className="af-err" style={{ margin: 0 }}>{err}</p>}
      </form>
    </ModalKecil>
  )
}
