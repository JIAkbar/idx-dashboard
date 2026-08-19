import { useEffect, useState, type FormEvent } from 'react'
import { useProfilSaya } from '../../lib/profilSaya'
import { daftarAkun, type AkunRow } from '../../lib/adminAkun'
import { daftarJenjang, type JenjangRow } from '../../lib/jenjang'
import {
  daftarHalamanAkses,
  ubahHalamanAkses,
  daftarAksesKhusus,
  tambahAksesKhusus,
  hapusAksesKhusus,
  type HalamanBaris,
  type AksesKhususBaris,
} from '../../lib/aksesAdmin'
import { Dropdown } from '../../components/dasbor/Dropdown'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
import { Toast } from '../../components/dasbor/Toast'
import { IkonMenu, IKON_TAMBAH, IKON_TONG } from '../../components/dasbor/IkonMenu'
import { AksesDitolak } from './AdminLayout'
import { PanelJenjang } from './PanelJenjang'
import './AkunAdmin.css'
import { pesanGalat } from '../../lib/pesanGalat'

const TINGKAT_OPSI = [
  { nilai: 'publik', label: 'Publik' },
  { nilai: 'login', label: 'Perlu login' },
  { nilai: 'superadmin', label: 'Superadmin' },
]

/**
 * Tab "Akses" (/admin/akses, superadmin saja, Fase 6) — dua panel: setelan
 * per halaman (`akses_halaman`) dan pengecualian per akun (`akses_khusus`).
 * Ditulis langsung ke Supabase lewat supabase-js (bukan Edge Function) —
 * RLS tabel `akses_halaman`/`akses_khusus` sudah menjaga superadmin-only
 * write, guard `superadmin` di sini cuma UX (hindari kedip form yang pasti
 * ditolak).
 */
export function AksesAdmin() {
  const { profil, loading } = useProfilSaya()
  const superadmin = profil?.peran === 'superadmin'

  const [halaman, setHalaman] = useState<HalamanBaris[] | null>(null)
  const [jenjang, setJenjang] = useState<JenjangRow[]>([])
  const [khusus, setKhusus] = useState<AksesKhususBaris[] | null>(null)
  const [akun, setAkun] = useState<AkunRow[] | null>(null)
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ ok: boolean; pesan: string } | null>(null)
  const [tambahBuka, setTambahBuka] = useState(false)
  const [muat, setMuat] = useState(0)

  useEffect(() => {
    if (!superadmin) return
    let batal = false
    setGalat('')
    Promise.all([daftarHalamanAkses(), daftarJenjang(), daftarAksesKhusus(), daftarAkun()])
      .then(([h, j, k, a]) => {
        if (batal) return
        setHalaman(h)
        setJenjang(j)
        setKhusus(k)
        setAkun(a)
      })
      .catch((e) => !batal && setGalat(pesanGalat(e, 'Gagal memuat data akses.')))
    return () => {
      batal = true
    }
  }, [superadmin, muat])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  function tandaiSibuk(kunciSibuk: string, v: boolean) {
    setSibuk((s) => {
      const q = new Set(s)
      if (v) q.add(kunciSibuk)
      else q.delete(kunciSibuk)
      return q
    })
  }

  /** Menyebut apa yang berubah jadi apa, bukan sekadar "Tersimpan". Mengubah
   *  siapa yang boleh membuka sebuah halaman berlaku diam-diam di sisi
   *  pengguna, jadi satu-satunya bukti bahwa klik tadi benar-benar masuk
   *  adalah kalimat yang mengulang setelan barunya. */
  function ringkasPerubahan(
    baris: HalamanBaris,
    patch: Partial<Pick<HalamanBaris, 'tingkat' | 'min_tier' | 'urutan'>>,
  ): string {
    const bagian: string[] = []
    if (patch.tingkat !== undefined) {
      bagian.push(TINGKAT_OPSI.find((o) => o.nilai === patch.tingkat)?.label ?? patch.tingkat)
    }
    // Jenjang hanya disebut kalau memang berlaku. Menyebutnya saat tingkatnya
    // Publik cuma menimbulkan pertanyaan, karena kolomnya diabaikan di sana.
    const tingkatAkhir = patch.tingkat ?? baris.tingkat
    if (patch.min_tier !== undefined && tingkatAkhir === 'login') {
      const j = jenjang.find((x) => x.tier === patch.min_tier)
      bagian.push(`jenjang minimum ${j ? j.nama : `tier ${patch.min_tier}`}`)
    }
    if (patch.urutan !== undefined) bagian.push(`urutan ${patch.urutan}`)
    return bagian.length ? `${baris.label}: ${bagian.join(' · ')}` : `${baris.label} tersimpan`
  }

  async function ubahBaris(baris: HalamanBaris, patch: Partial<Pick<HalamanBaris, 'tingkat' | 'min_tier' | 'urutan'>>) {
    tandaiSibuk(baris.kunci, true)
    try {
      await ubahHalamanAkses(baris.kunci, patch)
      setHalaman((list) => list && list.map((h) => (h.kunci === baris.kunci ? { ...h, ...patch } : h)))
      setToast({ ok: true, pesan: ringkasPerubahan(baris, patch) })
    } catch (e) {
      setToast({ ok: false, pesan: pesanGalat(e, 'Gagal menyimpan.') })
    } finally {
      tandaiSibuk(baris.kunci, false)
    }
  }

  async function hapusBarisKhusus(b: AksesKhususBaris) {
    const key = `${b.profil_id}:${b.kunci}`
    tandaiSibuk(key, true)
    try {
      await hapusAksesKhusus(b.profil_id, b.kunci)
      setKhusus((list) => list && list.filter((x) => !(x.profil_id === b.profil_id && x.kunci === b.kunci)))
    } catch (e) {
      setToast({ ok: false, pesan: pesanGalat(e, 'Gagal menghapus.') })
    } finally {
      tandaiSibuk(key, false)
    }
  }

  if (loading) return <p className="muted">Memuat…</p>
  // Tab Akses disembunyikan di AdminLayout kalau bukan superadmin — guard ini
  // jaga-jaga akses langsung lewat URL/bookmark (rute /admin/akses tetap hidup).
  if (!superadmin) return <AksesDitolak pesan="Halaman ini khusus superadmin." />

  const jenjangOpsi = jenjang.map((j) => ({ nilai: String(j.tier), label: `${j.nama} (tier ${j.tier})` }))

  return (
    <>
      <section className="panel">
        <div className="panel-h"><span className="lbl">Halaman &amp; jenjang minimum</span></div>
        <div className="panel-b">
          <p className="muted" style={{ marginTop: 0, fontSize: 11 }}>
            Superadmin selalu bisa membuka semua halaman apa pun setelan di bawah ini. Jenjang
            minimum cuma berlaku utk tingkat "Perlu login".
          </p>
          {galat && <p className="af-err">{galat}</p>}
          {halaman === null && !galat && <p className="muted">Memuat…</p>}
          {halaman && (
            <div className="af-gulir aa-tbl-wrap">
              <table className="tbl aa-tbl">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Tingkat</th>
                    <th>Jenjang minimum</th>
                    <th className="r" title="Menentukan posisi menu di rail — makin kecil makin atas">Urutan</th>
                  </tr>
                </thead>
                <tbody>
                  {halaman.map((h) => {
                    const sedangProses = sibuk.has(h.kunci)
                    return (
                      <tr key={h.kunci}>
                        <td>
                          {h.label} <span className="muted" style={{ fontSize: 10 }}>({h.kunci})</span>
                        </td>
                        <td>
                          <Dropdown
                            opsi={TINGKAT_OPSI}
                            nilai={h.tingkat}
                            ariaLabel={`Tingkat — ${h.label}`}
                            disabled={sedangProses}
                            onGanti={(v) =>
                              ubahBaris(h, {
                                tingkat: v as HalamanBaris['tingkat'],
                                // Jenjang minimum direset ke 0, BUKAN null:
                                // kolom min_tier di server NOT NULL, jadi
                                // mengirim null membuat SETIAP perubahan ke
                                // Publik/Superadmin ditolak ("null value in
                                // column min_tier violates not-null
                                // constraint"). Nilai 0 aman — kolom ini tidak
                                // dipakai di luar tingkat 'login', dan sel "—"
                                // di tabel ditentukan oleh TINGKAT-nya, bukan
                                // oleh min_tier yang bernilai null.
                                ...(v !== 'login' ? { min_tier: 0 } : {}),
                              })
                            }
                          />
                        </td>
                        <td>
                          {h.tingkat === 'login' ? (
                            <Dropdown
                              opsi={jenjangOpsi}
                              nilai={String(h.min_tier ?? 0)}
                              ariaLabel={`Jenjang minimum — ${h.label}`}
                              disabled={sedangProses}
                              onGanti={(v) => ubahBaris(h, { min_tier: Number(v) })}
                            />
                          ) : (
                            <span className="muted" title="Cuma berlaku utk tingkat 'Perlu login'">—</span>
                          )}
                        </td>
                        <td className="r">
                          <input
                            className="inp"
                            type="number"
                            // 56px cuma memuat dua digit: setelah dikurangi
                            // padding dan tombol putar bawaan type=number,
                            // "100" tergunting jadi "10(" dan "145" jadi "14:".
                            style={{ width: 78, textAlign: 'right' }}
                            defaultValue={h.urutan}
                            disabled={sedangProses}
                            aria-label={`Urutan — ${h.label}`}
                            onBlur={(e) => {
                              const n = Number(e.target.value)
                              if (Number.isFinite(n) && n !== h.urutan) ubahBaris(h, { urutan: n })
                            }}
                          />
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

      <section className="panel">
        <div className="panel-h" style={{ alignItems: 'center' }}>
          <span className="lbl">Pengecualian per akun{khusus ? ` (${khusus.length})` : ''}</span>
          <button type="button" className="btn-p af-tambah" disabled={!akun || !halaman} onClick={() => setTambahBuka(true)}>
            <IkonMenu d={IKON_TAMBAH} size={13} /> Tambah pengecualian
          </button>
        </div>
        <div className="panel-b">
          {khusus && khusus.length === 0 && <p className="muted">Belum ada pengecualian.</p>}
          {khusus && khusus.length > 0 && (
            <div className="af-gulir aa-tbl-wrap">
              <table className="tbl aa-tbl">
                <thead>
                  <tr>
                    <th>Akun</th>
                    <th>Halaman</th>
                    <th>Setelan</th>
                    <th>Catatan</th>
                    <th className="af-aksi">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {khusus.map((k) => {
                    const key = `${k.profil_id}:${k.kunci}`
                    const sedangProses = sibuk.has(key)
                    return (
                      <tr key={key}>
                        <td>{k.profil?.alias || k.profil?.email || k.profil_id}</td>
                        <td>{halaman?.find((h) => h.kunci === k.kunci)?.label ?? k.kunci}</td>
                        <td><span className={`chip ${k.izinkan ? 'up' : 'dn'}`}>{k.izinkan ? 'Diizinkan' : 'Dicabut'}</span></td>
                        <td className="muted" style={{ fontSize: 11 }}>{k.catatan || '—'}</td>
                        <td className="af-aksi">
                          <button type="button" className="dd-btn merah" disabled={sedangProses} onClick={() => hapusBarisKhusus(k)}>
                            <IkonMenu d={IKON_TONG} size={12} /> Hapus
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

      {/* Dropdown "jenjang minimum" di atas tidak berarti apa-apa tanpa tahu
          apa syarat tiap jenjang — acuannya ditaruh persis di bawahnya.
          Ringkas: kolom "yang terbuka" sudah diwakili tabel halaman di atas. */}
      <PanelJenjang ringkas />

      {tambahBuka && akun && halaman && (
        <FormTambahPengecualian
          akun={akun}
          halaman={halaman}
          onClose={() => setTambahBuka(false)}
          onSukses={(pesan) => {
            setToast({ ok: true, pesan })
            setTambahBuka(false)
            setMuat((m) => m + 1)
          }}
        />
      )}

      <Toast toast={toast} />
    </>
  )
}

function FormTambahPengecualian({ akun, halaman, onClose, onSukses }: {
  akun: AkunRow[]
  halaman: HalamanBaris[]
  onClose: () => void
  onSukses: (pesan: string) => void
}) {
  const [profilId, setProfilId] = useState(akun[0]?.id ?? '')
  const [kunci, setKunci] = useState(halaman[0]?.kunci ?? '')
  const [izinkan, setIzinkan] = useState('ya')
  const [catatan, setCatatan] = useState('')
  const [kirim, setKirim] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!profilId || !kunci) {
      setErr('Pilih akun dan halaman.')
      return
    }
    setKirim(true)
    setErr('')
    try {
      await tambahAksesKhusus({ profil_id: profilId, kunci, izinkan: izinkan === 'ya', catatan })
      onSukses('Pengecualian ditambahkan.')
    } catch (e) {
      setErr(pesanGalat(e, 'Gagal menambah pengecualian.'))
    } finally {
      setKirim(false)
    }
  }

  const akunOpsi = akun.map((a) => ({ nilai: a.id, label: a.alias || a.email }))
  const halamanOpsi = halaman.map((h) => ({ nilai: h.kunci, label: h.label }))
  const izinkanOpsi = [{ nilai: 'ya', label: 'Izinkan' }, { nilai: 'tidak', label: 'Cabut' }]

  return (
    <ModalKecil className="af-form-modal" label="Tambah pengecualian akses" onClose={() => { if (!kirim) onClose() }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <span className="lbl">Akun</span>
          <Dropdown opsi={akunOpsi} nilai={profilId} ariaLabel="Akun" onGanti={setProfilId} />
        </div>
        <div className="field">
          <span className="lbl">Halaman</span>
          <Dropdown opsi={halamanOpsi} nilai={kunci} ariaLabel="Halaman" onGanti={setKunci} />
        </div>
        <div className="field">
          <span className="lbl">Setelan</span>
          <Dropdown opsi={izinkanOpsi} nilai={izinkan} ariaLabel="Izinkan / cabut" onGanti={setIzinkan} />
        </div>
        <div className="field">
          <span className="lbl">Catatan (opsional)</span>
          <input className="inp" type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Alasan pengecualian…" />
        </div>
        <button type="submit" className="btn-p" disabled={kirim}>{kirim ? 'Menyimpan…' : 'Tambah'}</button>
        {err && <p className="af-err" style={{ margin: 0 }}>{err}</p>}
      </form>
    </ModalKecil>
  )
}
