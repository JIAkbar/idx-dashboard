import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProfilSaya } from '../../lib/profilSaya'
import { AdminTanggalProvider } from '../../context/AdminTanggalContext'
import { hitungSetoranMenunggu } from '../../lib/supabaseEdisi'
import { perluSambutan, kunciSambutan } from '../../lib/sambutan'
import { namaTampil } from '../../lib/namaTampil'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
import {
  IkonMenu,
  IKON_GAMBAR,
  IKON_GIR,
  IKON_GRAFIK_NAIK,
  IKON_KOTAK_ARSIP,
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
  const superadmin = profil?.peran === 'superadmin'

  const [konfirmKeluar, setKonfirmKeluar] = useState(false)
  const [sambut, setSambut] = useState(false)
  const [menunggu, setMenunggu] = useState(0)

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

  const tabs: TabDef[] = [
    { to: '/admin', end: true, label: 'Unggah', ikon: IKON_GAMBAR, tampil: true },
    { to: '/admin/kurasi', label: 'Kurasi', ikon: IKON_PAPAN_KLIP, tampil: superadmin, badge: menunggu },
    // Radar WDWL — produk kurasi khusus, kontributor tidak menyetor bahannya.
    { to: '/admin/radar', label: 'Radar', ikon: IKON_RADAR, tampil: superadmin },
    { to: '/admin/bedah', label: 'Bedah', ikon: IKON_GRAFIK_NAIK, tampil: Boolean(profil?.boleh_bedah) },
    { to: '/admin/terbitan', label: 'Terbitan', ikon: IKON_KOTAK_ARSIP, tampil: true },
    { to: '/admin/akun', label: 'Akun', ikon: IKON_GIR, tampil: superadmin },
  ]

  return (
    <div className="lantai admin-view">
      <div className="vhead" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Arus Pasar</h1>
          <span className="sub">Area admin — unggah &amp; kelola edisi</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          {profil && (
            <span className="af-kuota-info" title="Batas final dihitung server, bukan angka di layar ini">
              Kuota hari ini: {profil.kuota_harian}/hari
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

      {sambut && (
        <div className="dasbor-modal-bg" onClick={tutupSambutan}>
          <div className="lantai dasbor-modal" role="dialog" aria-modal="true" aria-label="Ringkasan sesi admin" onClick={(e) => e.stopPropagation()}>
            <div className="panel af-sambut">
              <div className="af-sambut-head">
                <span className="af-monogram" aria-hidden="true">P</span>
                <div className="af-sambut-judul">
                  <span className="af-sambut-merek">PAPAN · Area Admin</span>
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
                  Unggah screenshot orderbook harian, kurasi setoran, pantau Radar WDWL,
                  dan kelola rak terbitan Arus Pasar — semuanya di tab-tab atas.
                </p>
                <button type="button" className="btn-p" style={{ width: '100%' }} onClick={tutupSambutan}>Mulai</button>
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
