import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProfilSaya, type ProfilSaya } from '../../lib/profilSaya'
import { daftarJenjang, hitungRingkasanSetoranSaya, ringkasanJenjang, type JenjangRow } from '../../lib/jenjang'
import { useKuotaSaya } from '../../lib/kuotaSaya'
import { IkonJenjang } from '../../components/dasbor/IkonJenjang'
import { supabase } from '../../lib/supabase'
import { AdminTanggalProvider } from '../../context/AdminTanggalContext'
import { hitungSetoranMenunggu } from '../../lib/supabaseEdisi'
import { perluSambutan, kunciSambutan, kunciBeku } from '../../lib/sambutan'
import { statusBekuSaya, type StatusBeku } from '../../lib/statusBeku'
import { namaTampil } from '../../lib/namaTampil'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
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

  function tutupBeku() {
    if (session) localStorage.setItem(kunciBeku(session.user.id), session.user.last_sign_in_at ?? '')
    setBekuTampil(false)
  }

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

  const tabs: TabDef[] = [
    { to: '/admin', end: true, label: 'Unggah', ikon: IKON_GAMBAR, tampil: true },
    { to: '/admin/kurasi', label: 'Kurasi', ikon: IKON_PAPAN_KLIP, tampil: superadmin, badge: menunggu },
    // Radar WDWL — produk kurasi khusus, kontributor tidak menyetor bahannya.
    { to: '/admin/radar', label: 'Radar', ikon: IKON_RADAR, tampil: superadmin },
    { to: '/admin/bedah', label: 'Bedah', ikon: IKON_GRAFIK_NAIK, tampil: Boolean(profil?.boleh_bedah) },
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

  return (
    <div className="lantai admin-view">
      <div className="vhead" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Arus Pasar</h1>
          <span className="sub">{superadmin ? 'Area admin — unggah & kelola edisi' : 'Kontributor — setor orderbook harian'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          {kuota != null && (
            <span className="af-kuota-info" title="Angka ini datang dari server (kuota_saya()), bukan hitungan layar">
              Kuota hari ini: {kuota}/hari
            </span>
          )}
          <span className="muted" title={session?.user.email}>{namaTampil(profil, session)}</span>
          <button type="button" className="dd-btn" onClick={() => setKonfirmKeluar(true)}>Keluar</button>
        </div>
      </div>

      <nav className="tabs admin-tabbar" role="tablist" aria-label="Bagian admin">
        {tabs.filter((t) => t.tampil).map((t) => (
          // NavLink otomatis pasang aria-current="page" pada tab aktif (perilaku
          // bawaan React Router) — tak perlu diurus manual di sini.
          <NavLink key={t.to} to={t.to} end={t.end} role="tab" className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
            <IkonMenu d={t.ikon} size={13} /> {t.label}
            {Boolean(t.badge) && <span className="admin-tab-badge">{t.badge}</span>}
          </NavLink>
        ))}
      </nav>

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
            yang disetujui — akun dibekukan otomatis kalau mencapai <b>{bekuInfo.ambang} hari kerja</b>.
          </p>
          <p className="muted" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55 }}>
            Sisa <b>{Math.max(0, bekuInfo.ambang - bekuInfo.hari)} hari kerja</b> lagi. Setor orderbook
            hari ini lalu tunggu dikurasi superadmin — status "disetujui" yang mereset hitungan ini,
            bukan sekadar mengunggah.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-p" style={{ flex: 1 }} onClick={setorSekarang}>Setor sekarang</button>
            <button type="button" className="dd-btn" onClick={tutupBeku}>Nanti</button>
          </div>
        </ModalKecil>
      )}

      {sambut && !perluLengkapiProfil && !bekuTampil && (
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
                  {superadmin
                    ? 'Unggah screenshot orderbook harian, kurasi setoran, pantau Radar WDWL, dan kelola rak terbitan Arus Pasar — semuanya di tab-tab atas.'
                    : 'Unggah screenshot orderbook harian dan pantau rak terbitan Arus Pasar — semuanya di tab-tab atas.'}
                </p>
                {!superadmin && profil && <SambutanJenjang profil={profil} />}
                <button
                  type="button"
                  className="btn-p"
                  style={{ width: '100%' }}
                  onClick={superadmin ? tutupSambutan : setorDariSambutan}
                >
                  {superadmin ? 'Mulai' : 'Setor orderbook'}
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
  const [data, setData] = useState<{ jenjang: JenjangRow[]; angka: { disetujui: number; ditolak: number } } | null>(null)

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
    data.angka.disetujui, data.angka.ditolak, data.jenjang
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
          <b>{r.kuotaEfektif} orderbook</b>
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
