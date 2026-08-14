import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useProfilSaya } from '../../lib/profilSaya'
import { daftarAkun, buatAkun, resetSandi, setProfil, type AkunRow } from '../../lib/adminAkun'
import { IkonMenu, IKON_CENTANG, IKON_KUNCI, IKON_PERINGATAN, IKON_TAMBAH } from '../../components/dasbor/IkonMenu'
import { ModalKecil } from '../AdminHome'
import './AkunAdmin.css'

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
  const [galat, setGalat] = useState('')
  const [muat, setMuat] = useState(0)
  /** id baris yang sedang punya request in-flight — dipakai disable kontrol baris itu. */
  const [sibuk, setSibuk] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ ok: boolean; pesan: string } | null>(null)

  const [tambahBuka, setTambahBuka] = useState(false)
  const [resetTarget, setResetTarget] = useState<AkunRow | null>(null)

  const superadmin = profil?.peran === 'superadmin'

  useEffect(() => {
    if (!superadmin) return
    let batal = false
    setGalat('')
    daftarAkun()
      .then((a) => !batal && setAkun(a))
      .catch((e) => !batal && setGalat(e instanceof Error ? e.message : 'Gagal memuat daftar akun.'))
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

  async function ubahProfil(baris: AkunRow, patch: Partial<{ kuota_harian: number; boleh_bedah: boolean; aktif: boolean }>) {
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

  if (profilLoading) {
    return (
      <div className="lantai admin-view">
        <p className="muted">Memuat…</p>
      </div>
    )
  }

  if (!superadmin) {
    return (
      <div className="lantai admin-view">
        <div className="fd-empty" style={{ padding: '60px 20px' }}>
          <p style={{ marginBottom: 8 }}><IkonMenu d={IKON_PERINGATAN} size={26} /></p>
          <p>Halaman ini khusus superadmin.</p>
          <p style={{ fontSize: 11, marginTop: 6 }}><Link to="/admin">← Kembali ke Admin</Link></p>
        </div>
      </div>
    )
  }

  return (
    <div className="lantai admin-view">
      <div className="vhead" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Kelola Akun</h1>
          <span className="sub">Superadmin — akun kontributor, kuota harian &amp; izin Bedah</span>
        </div>
        <Link to="/admin" className="dd-btn">← Admin</Link>
      </div>

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
                    <th className="r">Kuota/hari</th>
                    <th>Izin Bedah</th>
                    <th>Aktif</th>
                    <th>Terakhir masuk</th>
                    <th className="af-aksi">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {akun.map((a) => {
                    const sedangProses = sibuk.has(a.id)
                    return (
                      <tr key={a.id}>
                        <td>{a.email}</td>
                        <td>{a.alias || '—'}</td>
                        <td>
                          <span className={`chip ${a.peran === 'superadmin' ? 'warn' : 'up'}`}>
                            {a.peran === 'superadmin' ? 'Superadmin' : 'Kontributor'}
                          </span>
                        </td>
                        <td className="r">
                          <input
                            type="number"
                            className="inp aa-kuota"
                            min={0}
                            max={50}
                            defaultValue={a.kuota_harian}
                            disabled={sedangProses}
                            aria-label={`Kuota harian — ${a.email}`}
                            onBlur={(e) => {
                              const n = Math.max(0, Math.min(50, Math.round(Number(e.target.value)) || 0))
                              e.target.value = String(n)
                              if (n !== a.kuota_harian) ubahProfil(a, { kuota_harian: n })
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur()
                            }}
                          />
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
                            nyala={a.aktif}
                            disabled={sedangProses}
                            label={`Status aktif — ${a.email}`}
                            onToggle={() => ubahProfil(a, { aktif: !a.aktif })}
                          />
                        </td>
                        <td>{waktuManusiawi(a.terakhir_masuk)}</td>
                        <td className="af-aksi">
                          <button type="button" className="dd-btn" disabled={sedangProses} onClick={() => setResetTarget(a)}>
                            <IkonMenu d={IKON_KUNCI} size={12} /> Atur Ulang Sandi
                          </button>
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

      {toast && (
        <div className={`lantai af-toast${toast.ok ? '' : ' gagal'}`} role="status">
          <IkonMenu d={toast.ok ? IKON_CENTANG : IKON_PERINGATAN} size={15} />
          <span>{toast.pesan}</span>
        </div>
      )}
    </div>
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
    setKirim(true)
    setErr('')
    try {
      const hasil = await buatAkun({
        email: email.trim(),
        sandi,
        alias: alias.trim() || undefined,
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
    <ModalKecil label="Tambah akun" onClose={() => { if (!kirim) onClose() }}>
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
          <span className="lbl">Alias (opsional)</span>
          <input className="inp" type="text" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Nama panggilan" />
        </div>
        <div className="field">
          <span className="lbl">Kuota awal / hari</span>
          <input
            className="inp aa-kuota"
            type="number"
            min={0}
            max={50}
            value={kuota}
            onChange={(e) => setKuota(Math.max(0, Math.min(50, Math.round(Number(e.target.value)) || 0)))}
          />
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
