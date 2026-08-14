import { useEffect, useState, type FormEvent } from 'react'
import { useProfilSaya } from '../../lib/profilSaya'
import { daftarAkun, buatAkun, hapusAkun, resetSandi, setProfil, ubahEmail, type AkunRow } from '../../lib/adminAkun'
import { daftarJenjang, type JenjangRow } from '../../lib/jenjang'
import { IkonMenu, IKON_CENTANG, IKON_KUNCI, IKON_PERINGATAN, IKON_SURAT, IKON_TAMBAH, IKON_TONG } from '../../components/dasbor/IkonMenu'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
import { Dropdown } from '../../components/dasbor/Dropdown'
import { AksesDitolak } from './AdminLayout'
import { PanelJenjang } from './PanelJenjang'
import './AkunAdmin.css'

/** Pilihan kuota harian — dropdown gantinya input number bertombol panah
 *  (sempit, gampang salah ketik). Dipakai form Tambah Akun & kolom kuota
 *  per baris tabel (perbaikan A, #shell-tab). */
const KUOTA_OPSI = [1, 2, 3, 5, 8, 12, 20, 50].map((n) => ({ nilai: String(n), label: String(n) }))

/** Sentinel dropdown "Ikut jenjang" (Fase 6) — `kuota_manual: null` di server. */
const IKUT_JENJANG = 'ikut'
const KUOTA_MANUAL_OPSI = [
  { nilai: IKUT_JENJANG, label: 'Ikut jenjang' },
  ...[1, 2, 3, 5, 8, 12, 20, 50].map((n) => ({ nilai: String(n), label: String(n) })),
]

/** ISO datetime (timestamptz) → "13 Agu 2026, 14:05"; "—" kalau null/kosong/tak valid. */
function waktuManusiawi(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()]
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getDate()} ${bulan} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Toggle pill boolean per baris — pola tombol Lantai, bukan checkbox native
 *  (accent-color browser tidak ikut token tema). */
function Sakelar({ nyala, onToggle, label, disabled }: { nyala: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`aa-sakelar${nyala ? ' on' : ''}`}
      role="switch"
      aria-checked={nyala}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className="aa-sakelar-bola" />
    </button>
  )
}

/**
 * Halaman "Kelola Akun" (/admin/akun, #101) — khusus superadmin: daftar akun
 * (superadmin + kontributor), ubah kuota/izin Bedah/status aktif per baris,
 * atur ulang sandi, dan buat akun baru. Semua aksi lewat Edge Function
 * `admin-akun` (backend Fase 1) — penegakan superadmin-only ada DI SERVER
 * (403 utk non-superadmin), guard di sini cuma UX (hindari kedip form yang
 * pasti ditolak).
 */
export function AkunAdmin() {
  const { profil, loading: profilLoading } = useProfilSaya()
  const [akun, setAkun] = useState<AkunRow[] | null>(null)
  const [jenjang, setJenjang] = useState<JenjangRow[]>([])
  const [galat, setGalat] = useState('')
  const [muat, setMuat] = useState(0)
  /** id baris yang sedang punya request in-flight — dipakai disable kontrol baris itu. */
  const [sibuk, setSibuk] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ ok: boolean; pesan: string } | null>(null)

  const [tambahBuka, setTambahBuka] = useState(false)
  const [resetTarget, setResetTarget] = useState<AkunRow | null>(null)
  const [hapusTarget, setHapusTarget] = useState<AkunRow | null>(null)
  const [emailTarget, setEmailTarget] = useState<AkunRow | null>(null)

  const superadmin = profil?.peran === 'superadmin'

  useEffect(() => {
    if (!superadmin) return
    let batal = false
    setGalat('')
    daftarAkun()
      .then((a) => !batal && setAkun(a))
      .catch((e) => !batal && setGalat(e instanceof Error ? e.message : 'Gagal memuat daftar akun.'))
    daftarJenjang().then((j) => !batal && setJenjang(j)).catch(() => {})
    return () => {
      batal = true
    }
  }, [superadmin, muat])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  function tandaiSibuk(id: string, v: boolean) {
    setSibuk((s) => {
      const q = new Set(s)
      if (v) q.add(id)
      else q.delete(id)
      return q
    })
  }

  async function ubahProfil(
    baris: AkunRow,
    patch: Partial<{ kuota_harian: number; boleh_bedah: boolean; aktif: boolean; kuota_manual: number | null; beku_otomatis: boolean }>
  ) {
    tandaiSibuk(baris.id, true)
    try {
      await setProfil(baris.id, patch)
      setAkun((list) => list && list.map((a) => (a.id === baris.id ? { ...a, ...patch } : a)))
    } catch (e) {
      setToast({ ok: false, pesan: e instanceof Error ? e.message : 'Gagal menyimpan perubahan.' })
    } finally {
      tandaiSibuk(baris.id, false)
    }
  }

  if (profilLoading) return <p className="muted">Memuat…</p>

  // Tab Akun disembunyikan di AdminLayout kalau bukan superadmin — guard ini
  // jaga-jaga akses langsung lewat URL/bookmark (rute /admin/akun tetap hidup).
  if (!superadmin) return <AksesDitolak pesan="Halaman ini khusus superadmin." />

  return (
    <>
      <section className="panel">
        <div className="panel-h" style={{ alignItems: 'center' }}>
          <span className="lbl">Akun{akun ? ` (${akun.length})` : ''}</span>
          <button type="button" className="btn-p af-tambah" onClick={() => setTambahBuka(true)}>
            <IkonMenu d={IKON_TAMBAH} size={13} /> Tambah Akun
          </button>
        </div>
        <div className="panel-b">
          {galat && <p className="af-err" style={{ marginTop: 0 }}>{galat}</p>}
          {akun === null && !galat && <p className="muted">Memuat…</p>}
          {akun && akun.length === 0 && <p className="muted">Belum ada akun.</p>}
          {akun && akun.length > 0 && (
            <div className="af-gulir aa-tbl-wrap">
              <table className="tbl aa-tbl">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Alias</th>
                    <th>Peran</th>
                    <th>Jenjang</th>
                    <th className="r">Kuota/hari</th>
                    <th>Izin Bedah</th>
                    <th>Beku otomatis</th>
                    <th>Aktif</th>
                    <th>Terakhir masuk</th>
                    <th className="af-aksi">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {akun.map((a) => {
                    const sedangProses = sibuk.has(a.id)
                    const tier = a.tier ?? 0
                    const jenjangAkun = jenjang.find((j) => j.tier === tier)
                    // Superadmin TIDAK berjenjang: `kuota_saya()` di server
                    // mengecualikannya, jadi menampilkan "Perunggu · efektif
                    // 2/hari" untuknya bukan cuma janggal — itu angka yang
                    // tidak pernah dipakai server. Kolom tier tetap terisi di
                    // basis data (dihitung dari setorannya sendiri), hanya
                    // tidak berarti apa-apa untuk peran ini.
                    const berjenjang = a.peran !== 'superadmin'
                    const kuotaEfektif = berjenjang
                      ? (a.kuota_manual ?? jenjangAkun?.kuota ?? a.kuota_harian)
                      : Math.max(a.kuota_harian, 50)
                    return (
                      <tr key={a.id}>
                        <td>{a.email}</td>
                        <td>{a.alias || '—'}</td>
                        <td>
                          <span className={`chip ${a.peran === 'superadmin' ? 'warn' : 'up'}`}>
                            {a.peran === 'superadmin' ? 'Superadmin' : 'Kontributor'}
                          </span>
                        </td>
                        <td>
                          {berjenjang ? (
                            <span className="chip" title={`Tier ${tier}`}>{jenjangAkun?.nama ?? `Tier ${tier}`}</span>
                          ) : (
                            <span className="muted" title="Superadmin tidak dibatasi jenjang maupun kuota harian">
                              Tanpa jenjang
                            </span>
                          )}
                        </td>
                        <td className="r">
                          <div className="aa-kuota-dd" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <Dropdown
                              opsi={KUOTA_MANUAL_OPSI}
                              nilai={a.kuota_manual == null ? IKUT_JENJANG : String(a.kuota_manual)}
                              ariaLabel={`Kuota manual — ${a.email}`}
                              disabled={sedangProses}
                              onGanti={(n) => ubahProfil(a, { kuota_manual: n === IKUT_JENJANG ? null : Number(n) })}
                            />
                            <span className="muted" style={{ fontSize: 10 }}>efektif {kuotaEfektif}/hari</span>
                          </div>
                        </td>
                        <td>
                          <Sakelar
                            nyala={a.boleh_bedah}
                            disabled={sedangProses}
                            label={`Izin Bedah — ${a.email}`}
                            onToggle={() => ubahProfil(a, { boleh_bedah: !a.boleh_bedah })}
                          />
                        </td>
                        <td>
                          <Sakelar
                            nyala={a.beku_otomatis ?? true}
                            disabled={sedangProses}
                            label={`Beku otomatis — ${a.email} (matikan untuk kontributor yang sedang cuti)`}
                            onToggle={() => ubahProfil(a, { beku_otomatis: !(a.beku_otomatis ?? true) })}
                          />
                        </td>
                        <td>
                          <Sakelar
                            nyala={a.aktif}
                            disabled={sedangProses}
                            label={`Status aktif — ${a.email}`}
                            onToggle={() => ubahProfil(a, { aktif: !a.aktif })}
                          />
                        </td>
                        <td>{waktuManusiawi(a.terakhir_masuk)}</td>
                        <td className="af-aksi">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button type="button" className="dd-btn" disabled={sedangProses} onClick={() => setEmailTarget(a)}>
                              <IkonMenu d={IKON_SURAT} size={12} /> Ubah Email
                            </button>
                            <button type="button" className="dd-btn" disabled={sedangProses} onClick={() => setResetTarget(a)}>
                              <IkonMenu d={IKON_KUNCI} size={12} /> Atur Ulang Sandi
                            </button>
                            <button type="button" className="dd-btn merah" disabled={sedangProses} onClick={() => setHapusTarget(a)}>
                              <IkonMenu d={IKON_TONG} size={12} /> Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Acuan jenjang — kolom "Jenjang" dan dropdown kuota di atas tidak ada
          artinya tanpa tahu ambangnya. */}
      <PanelJenjang />

      {tambahBuka && (
        <FormTambahAkun
          onClose={() => setTambahBuka(false)}
          onSukses={(pesan) => {
            setToast({ ok: true, pesan })
            setTambahBuka(false)
            setMuat((m) => m + 1)
          }}
        />
      )}

      {resetTarget && (
        <FormResetSandi
          akun={resetTarget}
          onClose={() => setResetTarget(null)}
          onSukses={(pesan) => {
            setToast({ ok: true, pesan })
            setResetTarget(null)
          }}
        />
      )}

      {emailTarget && (
        <FormUbahEmail
          akun={emailTarget}
          sendiri={emailTarget.id === profil?.id}
          onClose={() => setEmailTarget(null)}
          onSukses={(emailBaru, pesan) => {
            setAkun((list) => list && list.map((a) => (a.id === emailTarget.id ? { ...a, email: emailBaru } : a)))
            setToast({ ok: true, pesan })
            setEmailTarget(null)
          }}
        />
      )}

      {hapusTarget && (
        <FormHapusAkun
          akun={hapusTarget}
          onClose={() => setHapusTarget(null)}
          onSukses={(pesan) => {
            setToast({ ok: true, pesan })
            setHapusTarget(null)
            setMuat((m) => m + 1)
          }}
        />
      )}

      {toast && (
        <div className={`lantai af-toast${toast.ok ? '' : ' gagal'}`} role="status">
          <IkonMenu d={toast.ok ? IKON_CENTANG : IKON_PERINGATAN} size={15} />
          <span>{toast.pesan}</span>
        </div>
      )}
    </>
  )
}

function FormTambahAkun({ onClose, onSukses }: { onClose: () => void; onSukses: (pesan: string) => void }) {
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [alias, setAlias] = useState('')
  const [kuota, setKuota] = useState(1)
  const [bedah, setBedah] = useState(false)
  const [kirim, setKirim] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !sandi) {
      setErr('Email dan sandi wajib diisi.')
      return
    }
    if (sandi.length < 8) {
      setErr('Sandi minimal 8 karakter.')
      return
    }
    if (alias.trim().length < 2) {
      setErr('Alias wajib diisi (minimal 2 karakter) — dipakai sebagai kredit di PDF.')
      return
    }
    setKirim(true)
    setErr('')
    try {
      const hasil = await buatAkun({
        email: email.trim(),
        sandi,
        alias: alias.trim(),
        kuota_harian: kuota,
        boleh_bedah: bedah,
      })
      onSukses(`Akun ${hasil.email} dibuat.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal membuat akun.')
    } finally {
      setKirim(false)
    }
  }

  return (
    <ModalKecil className="af-form-modal" label="Tambah akun" onClose={() => { if (!kirim) onClose() }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <span className="lbl">Email</span>
          <input className="inp" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@contoh.com" />
        </div>
        <div className="field">
          <span className="lbl">Sandi awal</span>
          <input className="inp" type="password" required value={sandi} onChange={(e) => setSandi(e.target.value)} placeholder="Minimal 8 karakter" />
        </div>
        <div className="field">
          <span className="lbl">Alias</span>
          <input className="inp" type="text" required value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Nama panggilan — minimal 2 karakter" />
        </div>
        <div className="field">
          <span className="lbl">Kuota awal / hari</span>
          <Dropdown opsi={KUOTA_OPSI} nilai={String(kuota)} ariaLabel="Kuota awal per hari" onGanti={(n) => setKuota(Number(n))} />
        </div>
        <label className="aa-cek-baris">
          <input type="checkbox" className="af-cek" checked={bedah} onChange={(e) => setBedah(e.target.checked)} />
          <span>Izin Bedah Arus Saham</span>
        </label>
        <button type="submit" className="btn-p" disabled={kirim}>{kirim ? 'Membuat…' : 'Buat Akun'}</button>
        {err && <p className="af-err" style={{ margin: 0 }}>{err}</p>}
      </form>
    </ModalKecil>
  )
}

/** Modal konfirmasi hapus akun (#item4) — permanen, dijaga tiga lapis di
 *  SERVER (tidak bisa hapus diri sendiri / superadmin lain / akun dengan
 *  setoran disetujui). Di sini cuma UX: sebut alias & email jelas, peringatan
 *  ireversibel, dan tampilkan pesan galat server APA ADANYA (mis. saran
 *  "nonaktifkan saja") — jangan diterjemahkan ulang. */
function FormHapusAkun({ akun, onClose, onSukses }: { akun: AkunRow; onClose: () => void; onSukses: (pesan: string) => void }) {
  const [kirim, setKirim] = useState(false)
  const [err, setErr] = useState('')

  async function hapus() {
    setKirim(true)
    setErr('')
    try {
      const hasil = await hapusAkun(akun.id)
      onSukses(`Akun ${hasil.email} dihapus.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus akun.')
    } finally {
      setKirim(false)
    }
  }

  return (
    <ModalKecil label={`Hapus akun — ${akun.alias || akun.email}?`} onClose={() => { if (!kirim) onClose() }}>
      <p style={{ margin: 0, fontSize: 12.5 }}>
        Akun <b>{akun.alias || '(tanpa alias)'}</b> ({akun.email}) akan dihapus <b>permanen</b> — tindakan ini tidak
        bisa dibatalkan.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn-p af-btn-keluar" disabled={kirim} onClick={hapus}>
          {kirim ? 'Menghapus…' : 'Ya, Hapus Permanen'}
        </button>
        <button type="button" className="dd-btn" disabled={kirim} onClick={onClose}>Batal</button>
      </div>
      {err && <p className="af-err" style={{ margin: 0 }}>{err}</p>}
    </ModalKecil>
  )
}

function FormResetSandi({ akun, onClose, onSukses }: { akun: AkunRow; onClose: () => void; onSukses: (pesan: string) => void }) {
  const [sandi, setSandi] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [kirim, setKirim] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (sandi.length < 8) {
      setErr('Sandi baru minimal 8 karakter.')
      return
    }
    if (sandi !== konfirmasi) {
      setErr('Konfirmasi sandi tidak sama.')
      return
    }
    setKirim(true)
    setErr('')
    try {
      await resetSandi(akun.id, sandi)
      onSukses(`Sandi ${akun.email} diatur ulang.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal mengatur ulang sandi.')
    } finally {
      setKirim(false)
    }
  }

  return (
    <ModalKecil label={`Atur ulang sandi — ${akun.email}`} onClose={() => { if (!kirim) onClose() }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <span className="lbl">Sandi baru</span>
          <input className="inp" type="password" required value={sandi} onChange={(e) => setSandi(e.target.value)} placeholder="Minimal 8 karakter" />
        </div>
        <div className="field">
          <span className="lbl">Konfirmasi sandi</span>
          <input className="inp" type="password" required value={konfirmasi} onChange={(e) => setKonfirmasi(e.target.value)} />
        </div>
        <button type="submit" className="btn-p" disabled={kirim}>{kirim ? 'Menyimpan…' : 'Atur Ulang'}</button>
        {err && <p className="af-err" style={{ margin: 0 }}>{err}</p>}
      </form>
    </ModalKecil>
  )
}

/** Modal "Ubah Email" (#2, permintaan superadmin — ganti mis. arus@idx.id
 *  jadi admin@papan.id) — pola sama FormResetSandi: alamat sekarang hanya
 *  baca, validasi bentuk email di sisi aplikasi (server validasi ulang, ini
 *  cuma cegah kedip form yang pasti ditolak), peringatan alamat lama langsung
 *  tak bisa dipakai masuk lagi. Kalau superadmin mengubah emailnya SENDIRI,
 *  peringatan tambahan: pakai alamat baru saat masuk berikutnya. */
function FormUbahEmail({ akun, sendiri, onClose, onSukses }: { akun: AkunRow; sendiri: boolean; onClose: () => void; onSukses: (emailBaru: string, pesan: string) => void }) {
  const [email, setEmail] = useState('')
  const [kirim, setKirim] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const baru = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(baru)) {
      setErr('Bentuk email tidak valid.')
      return
    }
    if (baru.toLowerCase() === akun.email.toLowerCase()) {
      setErr('Email baru sama dengan yang sekarang.')
      return
    }
    setKirim(true)
    setErr('')
    try {
      const hasil = await ubahEmail(akun.id, baru)
      onSukses(hasil.email, `Email ${akun.email} diubah jadi ${hasil.email}.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal mengubah email.')
    } finally {
      setKirim(false)
    }
  }

  return (
    <ModalKecil label={`Ubah email — ${akun.alias || akun.email}`} onClose={() => { if (!kirim) onClose() }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <span className="lbl">Alamat sekarang</span>
          <input className="inp" type="email" value={akun.email} readOnly disabled />
        </div>
        <div className="field">
          <span className="lbl">Alamat baru</span>
          <input className="inp" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama.baru@contoh.com" />
        </div>
        <p className="af-warn" style={{ margin: 0 }}>
          <IkonMenu d={IKON_PERINGATAN} size={13} />
          <span>
            Alamat lama ({akun.email}) tidak bisa dipakai masuk lagi setelah diganti.
            {sendiri && ' Karena ini akunmu sendiri, pakai alamat BARU saat masuk berikutnya.'}
          </span>
        </p>
        <button type="submit" className="btn-p" disabled={kirim}>{kirim ? 'Menyimpan…' : 'Ubah Email'}</button>
        {err && <p className="af-err" style={{ margin: 0 }}>{err}</p>}
      </form>
    </ModalKecil>
  )
}
