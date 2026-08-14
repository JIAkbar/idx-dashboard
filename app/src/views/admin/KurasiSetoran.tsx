import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useProfilSaya } from '../../lib/profilSaya'
import {
  daftarSetoran,
  kurasiSetoran,
  urlScreenshots,
  type SetoranRow,
  type StatusSetoran,
} from '../../lib/supabaseEdisi'
import { IkonMenu, IKON_CENTANG, IKON_PAPAN_KLIP, IKON_PERINGATAN, IKON_SILANG } from '../../components/dasbor/IkonMenu'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { LightboxGambar, type GambarLightbox } from '../../components/dasbor/LightboxGambar'
import { ModalKecil } from '../AdminHome'
import './KurasiSetoran.css'

function tanggalHariIni(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** ISO datetime → "13 Agu 2026, 14:05"; "—" kalau tak valid. Salinan kecil
 *  dari waktuManusiawi AkunAdmin.tsx — sengaja tidak diekstrak jadi util
 *  bersama, cuma 4 baris & dipakai 2 halaman admin. */
function waktuManusiawi(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()]
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getDate()} ${bulan} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const LABEL_JENIS: Record<SetoranRow['jenis'], string> = { orderbook: 'Orderbook', chart: 'Chart', bedah: 'Bedah' }
const LABEL_STATUS: Record<StatusSetoran, string> = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' }
const KELAS_STATUS: Record<StatusSetoran, string> = { menunggu: 'warn', disetujui: 'up', ditolak: 'dn' }

const TAB_STATUS: { id: StatusSetoran | 'semua'; label: string }[] = [
  { id: 'menunggu', label: 'Menunggu' },
  { id: 'disetujui', label: 'Disetujui' },
  { id: 'ditolak', label: 'Ditolak' },
  { id: 'semua', label: 'Semua' },
]

/**
 * Halaman "Kurasi Setoran" (/admin/kurasi, Admin Fase 3) — khusus superadmin:
 * tinjau tiap baris `setoran` (satu berkas = satu baris) per tanggal, setujui
 * atau tolak (massal maupun satu-satu), dan salin daftar ticker yang sudah
 * disetujui untuk dirakit ke bulletin. Semua aksi lewat `kurasiSetoran` —
 * server (trigger/RLS) yang menegakkan "kolom kurasi cuma bisa diubah
 * superadmin", guard di sini cuma UX (hindari kedip form yang pasti ditolak).
 */
export function KurasiSetoran() {
  const { profil, loading: profilLoading } = useProfilSaya()
  const superadmin = profil?.peran === 'superadmin'

  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const [tabStatus, setTabStatus] = useState<StatusSetoran | 'semua'>('menunggu')
  const [setoran, setSetoran] = useState<SetoranRow[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [galat, setGalat] = useState('')
  const [muat, setMuat] = useState(0)
  const [pilih, setPilih] = useState<Set<string>>(new Set())
  /** path yang sedang punya request kurasi in-flight — disable tombol baris itu. */
  const [sibuk, setSibuk] = useState<Set<string>>(new Set())
  const [tolakTarget, setTolakTarget] = useState<string[] | null>(null)
  const [lightbox, setLightbox] = useState<{ items: GambarLightbox[]; index: number } | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; pesan: string } | null>(null)

  useEffect(() => {
    if (!superadmin) return
    let batal = false
    setGalat('')
    setPilih(new Set())
    daftarSetoran(tanggal)
      .then(async (rows) => {
        if (batal) return
        setSetoran(rows)
        const urlMap = await urlScreenshots(rows.map((r) => r.path)).catch(() => ({}) as Record<string, string>)
        if (!batal) setUrls(urlMap)
      })
      .catch((e) => !batal && setGalat(e instanceof Error ? e.message : 'Gagal memuat setoran.'))
    return () => {
      batal = true
    }
  }, [superadmin, tanggal, muat])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  const ringkasan = useMemo(() => {
    const r = { menunggu: 0, disetujui: 0, ditolak: 0 }
    for (const s of setoran ?? []) r[s.status]++
    return r
  }, [setoran])

  const tampil = useMemo(
    () => (tabStatus === 'semua' ? (setoran ?? []) : (setoran ?? []).filter((s) => s.status === tabStatus)),
    [setoran, tabStatus]
  )

  function togglePilih(path: string) {
    setPilih((p) => {
      const q = new Set(p)
      if (q.has(path)) q.delete(path)
      else q.add(path)
      return q
    })
  }

  function tandaiSibuk(paths: string[], v: boolean) {
    setSibuk((s) => {
      const q = new Set(s)
      for (const p of paths) v ? q.add(p) : q.delete(p)
      return q
    })
  }

  async function setujui(paths: string[]) {
    tandaiSibuk(paths, true)
    try {
      await kurasiSetoran(paths, 'disetujui')
      setToast({ ok: true, pesan: paths.length === 1 ? '1 setoran disetujui.' : `${paths.length} setoran disetujui.` })
      setPilih(new Set())
      setMuat((m) => m + 1)
    } catch (e) {
      setToast({ ok: false, pesan: e instanceof Error ? e.message : 'Gagal menyetujui.' })
    } finally {
      tandaiSibuk(paths, false)
    }
  }

  async function tolak(paths: string[], catatan: string) {
    tandaiSibuk(paths, true)
    try {
      await kurasiSetoran(paths, 'ditolak', catatan)
      setToast({ ok: true, pesan: paths.length === 1 ? '1 setoran ditolak.' : `${paths.length} setoran ditolak.` })
      setPilih(new Set())
      setTolakTarget(null)
      setMuat((m) => m + 1)
    } catch (e) {
      setToast({ ok: false, pesan: e instanceof Error ? e.message : 'Gagal menolak.' })
    } finally {
      tandaiSibuk(paths, false)
    }
  }

  function bukaPratinjau(path: string) {
    const entri = tampil.filter((s) => urls[s.path]).map((s) => ({
      path: s.path,
      ket: `${s.ticker} · ${LABEL_JENIS[s.jenis]} · ${s.tanggal}`,
    }))
    const idx = entri.findIndex((e) => e.path === path)
    if (idx < 0) return
    setLightbox({ items: entri.map((e) => ({ src: urls[e.path], keterangan: e.ket })), index: idx })
  }

  async function salinDisetujui() {
    const tickers = [...new Set((setoran ?? []).filter((s) => s.status === 'disetujui').map((s) => s.ticker))].sort()
    if (tickers.length === 0) {
      setToast({ ok: false, pesan: 'Belum ada yang disetujui untuk tanggal ini.' })
      return
    }
    try {
      await navigator.clipboard.writeText(tickers.join(', '))
      setToast({ ok: true, pesan: `${tickers.length} ticker disalin ke clipboard.` })
    } catch {
      setToast({ ok: false, pesan: 'Gagal menyalin — clipboard tidak tersedia di browser ini.' })
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
          <h1>Kurasi Setoran</h1>
          <span className="sub">Superadmin — setujui/tolak setoran sebelum masuk bulletin</span>
        </div>
        <Link to="/admin" className="dd-btn">← Admin</Link>
      </div>

      <section className="panel">
        <div className="panel-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span className="lbl">
            {ringkasan.menunggu} menunggu · {ringkasan.disetujui} disetujui · {ringkasan.ditolak} ditolak
          </span>
          <button type="button" className="dd-btn" onClick={salinDisetujui}>
            <IkonMenu d={IKON_PAPAN_KLIP} size={12} /> Salin daftar disetujui
          </button>
        </div>
        <div className="panel-b">
          <div className="ks-filter">
            <DatePicker value={tanggal} onChange={setTanggal} ariaLabel="Tanggal kurasi" />
            <div className="tabs" role="tablist" aria-label="Filter status setoran">
              {TAB_STATUS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tabStatus === t.id}
                  className={'tab' + (tabStatus === t.id ? ' on' : '')}
                  onClick={() => setTabStatus(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {galat && <p className="af-err" style={{ marginTop: 10 }}>{galat}</p>}
          {setoran === null && !galat && <p className="muted">Memuat…</p>}
          {setoran !== null && tampil.length === 0 && !galat && (
            <div className="fd-empty" style={{ padding: '28px 16px' }}>
              <p>Tidak ada setoran{tabStatus !== 'semua' ? ` berstatus "${LABEL_STATUS[tabStatus]}"` : ''} untuk {tanggal}.</p>
            </div>
          )}

          {pilih.size > 0 && (
            <div className="af-aksibar" style={{ marginTop: 10 }}>
              <span>{pilih.size} setoran dipilih</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="dd-btn" onClick={() => setujui([...pilih])}>
                  <IkonMenu d={IKON_CENTANG} size={12} /> Setujui terpilih
                </button>
                <button type="button" className="dd-btn merah" onClick={() => setTolakTarget([...pilih])}>
                  <IkonMenu d={IKON_SILANG} size={12} /> Tolak terpilih
                </button>
              </div>
            </div>
          )}

          {tampil.length > 0 && (
            <div className="ks-grid">
              {tampil.map((s) => {
                const proses = sibuk.has(s.path)
                const nama = s.profil?.alias || s.profil?.email || '—'
                return (
                  <div key={s.path} className={`ks-kartu${pilih.has(s.path) ? ' pilih' : ''}`}>
                    <div className="ks-kartu-atas">
                      <input
                        type="checkbox"
                        className="af-cek"
                        aria-label={`Pilih setoran ${s.ticker}`}
                        checked={pilih.has(s.path)}
                        onChange={() => togglePilih(s.path)}
                      />
                      <span className={`chip ${KELAS_STATUS[s.status]}`}>{LABEL_STATUS[s.status]}</span>
                    </div>
                    {urls[s.path] ? (
                      <button type="button" className="ks-thumb" title="Klik untuk pratinjau besar" onClick={() => bukaPratinjau(s.path)}>
                        <img src={urls[s.path]} alt={`${s.ticker} · ${LABEL_JENIS[s.jenis]}`} />
                      </button>
                    ) : (
                      <div className="ks-thumb ks-thumb-kosong">
                        <IkonMenu d={IKON_PERINGATAN} size={20} />
                      </div>
                    )}
                    <div className="ks-info">
                      <span className="tick">{s.ticker}</span>
                      <span className="muted" style={{ fontSize: 10.5 }}>{LABEL_JENIS[s.jenis]} · {nama}</span>
                      <span className="muted" style={{ fontSize: 10 }}>{waktuManusiawi(s.dibuat_pada)}</span>
                      <p className="ks-alasan">{s.alasan?.trim() || '(tanpa alasan — superadmin)'}</p>
                      {s.status === 'ditolak' && s.catatan_kurator && (
                        <p className="ks-catatan"><IkonMenu d={IKON_PERINGATAN} size={11} /> {s.catatan_kurator}</p>
                      )}
                    </div>
                    <div className="ks-aksi">
                      <button type="button" className="dd-btn" disabled={proses || s.status === 'disetujui'} onClick={() => setujui([s.path])}>
                        <IkonMenu d={IKON_CENTANG} size={12} /> Setujui
                      </button>
                      <button type="button" className="dd-btn merah" disabled={proses || s.status === 'ditolak'} onClick={() => setTolakTarget([s.path])}>
                        <IkonMenu d={IKON_SILANG} size={12} /> Tolak
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {tolakTarget && (
        <TolakModal
          jumlah={tolakTarget.length}
          onClose={() => setTolakTarget(null)}
          onKirim={(catatan) => tolak(tolakTarget, catatan)}
        />
      )}

      {lightbox && (
        <LightboxGambar
          items={lightbox.items}
          index={lightbox.index}
          onIndex={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
          onClose={() => setLightbox(null)}
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

/** Modal catatan kurator saat menolak — wajib diisi (kontributor berhak tahu
 *  alasan penolakan), dipakai tolak satuan maupun massal. */
function TolakModal({ jumlah, onClose, onKirim }: { jumlah: number; onClose: () => void; onKirim: (catatan: string) => void }) {
  const [catatan, setCatatan] = useState('')
  const [kirim, setKirim] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!catatan.trim()) {
      setErr('Catatan wajib diisi — kontributor berhak tahu alasan penolakan.')
      return
    }
    setKirim(true)
    setErr('')
    await onKirim(catatan.trim())
    setKirim(false)
  }

  return (
    <ModalKecil label={jumlah === 1 ? 'Tolak setoran ini?' : `Tolak ${jumlah} setoran?`} onClose={() => { if (!kirim) onClose() }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <span className="lbl">Catatan kurator — wajib diisi</span>
          <textarea
            className="inp"
            rows={3}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Alasan penolakan — akan terlihat oleh penyetor."
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
        <button type="submit" className="btn-p af-btn-keluar" disabled={kirim}>{kirim ? 'Menolak…' : 'Tolak'}</button>
        {err && <p className="af-err" style={{ margin: 0 }}>{err}</p>}
      </form>
    </ModalKecil>
  )
}
