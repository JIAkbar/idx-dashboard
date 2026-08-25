import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useProfilSaya } from '../../lib/profilSaya'
import { useAdminTanggal } from '../../context/AdminTanggalContext'
import {
  daftarSetoran,
  hitungMenungguKurasi,
  kurasiSetoran,
  mintaRevisiSetoran,
  pindahTanggalSetoran,
  setDimuat,
  urlScreenshots,
  type SetoranRow,
  type StatusSetoran,
} from '../../lib/supabaseSetoran'
import { alasanBukanHariBursa, todayIsoJakarta } from '../../lib/tanggalBursa'
import { IkonMenu, IKON_CENTANG, IKON_KALENDER, IKON_PAPAN_KLIP, IKON_PERINGATAN, IKON_SILANG } from '../../components/dasbor/IkonMenu'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { LightboxGambar, type GambarLightbox } from '../../components/dasbor/LightboxGambar'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
import { Toast } from '../../components/dasbor/Toast'
import { AksesDitolak } from './AdminLayout'
import './KurasiSetoran.css'
import { pesanGalat } from '../../lib/pesanGalat'

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

const LABEL_JENIS: Record<SetoranRow['jenis'], string> = { broksum: 'Broker Summary', chart: 'Chart', bedah: 'Deep Dive' }
const LABEL_STATUS: Record<StatusSetoran, string> = { menunggu: 'Menunggu', revisi: 'Perlu revisi', disetujui: 'Disetujui', dihapus: 'Dihapus' }
// 'revisi' pakai kelas 'warn' yang sama dengan 'menunggu' — sama-sama keadaan
// menunggu tindakan (dari penyetor), bukan akhir seperti 'dihapus'.
const KELAS_STATUS: Record<StatusSetoran, string> = { menunggu: 'warn', revisi: 'warn', disetujui: 'up', dihapus: 'dn' }

const TAB_STATUS: { id: StatusSetoran | 'semua'; label: string }[] = [
  { id: 'menunggu', label: 'Menunggu' },
  { id: 'revisi', label: 'Perlu revisi' },
  { id: 'disetujui', label: 'Disetujui' },
  { id: 'dihapus', label: 'Dihapus' },
  { id: 'semua', label: 'Semua' },
]

/**
 * Halaman "Kurasi Setoran" (/admin/kurasi, Admin Fase 3) — khusus superadmin:
 * tinjau tiap baris `setoran` (satu berkas = satu baris) per tanggal, setujui
 * revisi, atau hapus (massal maupun satu-satu), dan salin daftar ticker yang sudah
 * disetujui untuk dirakit ke bulletin. Semua aksi lewat `kurasiSetoran` —
 * server (trigger/RLS) yang menegakkan "kolom kurasi cuma bisa diubah
 * superadmin", guard di sini cuma UX (hindari kedip form yang pasti ditolak).
 */
export function KurasiSetoran() {
  const { profil, loading: profilLoading } = useProfilSaya()
  const superadmin = profil?.peran === 'superadmin'
  const { tanggal, setTanggal } = useAdminTanggal()

  const [tabStatus, setTabStatus] = useState<StatusSetoran | 'semua'>('menunggu')
  const [setoran, setSetoran] = useState<SetoranRow[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [galat, setGalat] = useState('')
  const [muat, setMuat] = useState(0)
  const [pilih, setPilih] = useState<Set<string>>(new Set())
  /** path yang sedang punya request kurasi in-flight — disable tombol baris itu. */
  const [sibuk, setSibuk] = useState<Set<string>>(new Set())
  const [tolakTarget, setTolakTarget] = useState<string[] | null>(null)
  const [revisiTarget, setRevisiTarget] = useState<string[] | null>(null)
  /** Setoran yang sedang dipilihkan tanggal barunya (modal pindah tanggal). */
  const [pindahTarget, setPindahTarget] = useState<SetoranRow | null>(null)
  const [lightbox, setLightbox] = useState<{ items: GambarLightbox[]; index: number } | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; pesan: string } | null>(null)
  /** Badge kalender DatePicker — tanggal → jumlah menunggu kurasi (90 hari
   *  terakhir, lihat hitungMenungguKurasi). Dimuat ulang bareng `muat` supaya
   *  lencana ikut berubah begitu satu setoran selesai dikurasi. */
  const [tandaKurasi, setTandaKurasi] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    if (!superadmin) return
    let batal = false
    hitungMenungguKurasi()
      .then((m) => !batal && setTandaKurasi(m))
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [superadmin, muat])

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
      .catch((e) => !batal && setGalat(pesanGalat(e, 'Gagal memuat setoran.')))
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
    const r = { menunggu: 0, revisi: 0, disetujui: 0, dihapus: 0 }
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

  /**
   * "Pilih semua" mengikuti TAB yang sedang dibuka, bukan seluruh setoran
   * hari itu. Bedanya bukan kosmetik: di tab Menunggu, "semua" harus berarti
   * 8 kartu yang terlihat — kalau ia diam-diam ikut menyeret setoran yang
   * sudah disetujui atau dihapus, satu ketukan "Hapus terpilih" akan membatalkan
   * kurasi yang sudah selesai tanpa satu pun yang terlihat di layar.
   */
  const semuaTerpilih = tampil.length > 0 && tampil.every((s) => pilih.has(s.path))

  function togglePilihSemua() {
    setPilih((p) => {
      if (tampil.every((s) => p.has(s.path))) {
        const q = new Set(p)
        for (const s of tampil) q.delete(s.path)
        return q
      }
      return new Set([...p, ...tampil.map((s) => s.path)])
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
      setToast({ ok: false, pesan: pesanGalat(e, 'Gagal menyetujui.') })
    } finally {
      tandaiSibuk(paths, false)
    }
  }

  async function hapus(paths: string[], catatan: string) {
    tandaiSibuk(paths, true)
    try {
      await kurasiSetoran(paths, 'dihapus', catatan)
      setToast({ ok: true, pesan: paths.length === 1 ? '1 setoran dihapus.' : `${paths.length} setoran dihapus.` })
      setPilih(new Set())
      setTolakTarget(null)
      setMuat((m) => m + 1)
    } catch (e) {
      setToast({ ok: false, pesan: pesanGalat(e, 'Gagal menghapus.') })
    } finally {
      tandaiSibuk(paths, false)
    }
  }

  /** #138 — masukkan/keluarkan dari edisi. Sengaja TIDAK menyentuh status:
   *  kontributor tetap dapat kreditnya, redaksi tetap bisa memangkas isi. */
  async function ubahDimuat(paths: string[], dimuat: boolean) {
    tandaiSibuk(paths, true)
    try {
      await setDimuat(paths, dimuat)
      // Toast lama ("Dimasukkan ke edisi") terbaca seolah PDF-nya sudah
      // berubah. Tidak — kolom `dimuat` cuma penanda; PDF baru berubah setelah
      // `arus-pasar/build.py` dijalankan ulang, dan itu manual.
      setToast({
        ok: true,
        pesan: dimuat
          ? 'Ditandai masuk edisi — berlaku saat edisi dirakit ulang.'
          : 'Ditandai di luar edisi — kredit kontributor tidak berubah.',
      })
      setPilih(new Set())
      setMuat((m) => m + 1)
    } catch (e) {
      setToast({ ok: false, pesan: pesanGalat(e, 'Gagal mengubah isi edisi.') })
    } finally {
      tandaiSibuk(paths, false)
    }
  }

  /** Pindahkan satu setoran ke tanggal lain — untuk setoran yang masuk di
   *  tanggal keliru (mis. bursa libur). Bukan tindakan kurasi: status, kredit,
   *  dan penyetornya tidak berubah, cuma tanggalnya. */
  async function pindahTanggal(s: SetoranRow, tanggalBaru: string) {
    tandaiSibuk([s.path], true)
    try {
      await pindahTanggalSetoran(s.path, tanggalBaru)
      setPindahTarget(null)
      // Tanggal tujuan disebut lengkap: setelah pindah, setorannya HILANG dari
      // layar ini (yang tampil cuma tanggal panggung), dan menghilang tanpa
      // keterangan ke mana terbaca sebagai terhapus.
      setToast({ ok: true, pesan: `${s.ticker} dipindahkan ke ${tanggalBaru} — kredit penyetornya tidak berubah.` })
      setMuat((m) => m + 1)
    } catch (e) {
      setToast({ ok: false, pesan: pesanGalat(e, 'Gagal memindahkan tanggal.') })
    } finally {
      tandaiSibuk([s.path], false)
    }
  }

  async function revisi(paths: string[], catatan: string) {
    tandaiSibuk(paths, true)
    try {
      await mintaRevisiSetoran(paths, catatan)
      setToast({ ok: true, pesan: paths.length === 1 ? '1 setoran diminta revisi.' : `${paths.length} setoran diminta revisi.` })
      setPilih(new Set())
      setRevisiTarget(null)
      setMuat((m) => m + 1)
    } catch (e) {
      setToast({ ok: false, pesan: pesanGalat(e, 'Gagal meminta revisi.') })
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

  /** Daftar yang benar-benar MASUK EDISI: disetujui DAN dimuat (#138).
   *  Inilah yang dipakai saat transkripsi & perakitan PDF — bukan seluruh yang
   *  disetujui, karena sebagian sengaja disimpan di luar edisi hari itu. */
  async function salinDisetujui() {
    const disetujui = (setoran ?? []).filter((s) => s.status === 'disetujui')
    const masuk = [...new Set(disetujui.filter((s) => s.dimuat).map((s) => s.ticker))].sort()
    const keluar = [...new Set(disetujui.filter((s) => !s.dimuat).map((s) => s.ticker))].sort()
    if (masuk.length === 0 && keluar.length === 0) {
      setToast({ ok: false, pesan: 'Belum ada setoran disetujui untuk tanggal ini.' })
      return
    }
    // Dua daftar, dan yang KEDUA yang berbentuk argumen siap tempel.
    // `build.py --kecuali=` menerima daftar yang DIKELUARKAN; menempelkan
    // daftar "masuk edisi" ke sana membuang persis yang seharusnya dimuat —
    // dan kalau semuanya dimuat, build.py berhenti dengan "Semua emiten
    // dikeluarkan". Polaritasnya ditulis eksplisit supaya tak bisa tertukar.
    const teks = [
      `Masuk edisi (${masuk.length}): ${masuk.join(', ') || '—'}`,
      keluar.length
        ? [`Di luar edisi (${keluar.length}) — tempel ke build.py:`, `--kecuali=${keluar.join(',')}`].join('\n')
        : 'Di luar edisi: tidak ada — jalankan build.py tanpa --kecuali.',
    ].join('\n')
    try {
      await navigator.clipboard.writeText(teks)
      setToast({ ok: true, pesan: `${masuk.length} masuk edisi, ${keluar.length} dikeluarkan — disalin.` })
    } catch {
      setToast({ ok: false, pesan: 'Gagal menyalin — clipboard tidak tersedia di browser ini.' })
    }
  }

  if (profilLoading) return <p className="muted">Memuat…</p>

  // Tab Kurasi disembunyikan di AdminLayout kalau bukan superadmin — guard ini
  // jaga-jaga akses langsung lewat URL/bookmark (rute /admin/kurasi tetap hidup).
  if (!superadmin) return <AksesDitolak pesan="Halaman ini khusus superadmin." />

  return (
    <>
      <section className="panel">
        <div className="panel-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span className="lbl">
            {ringkasan.menunggu} menunggu · {ringkasan.revisi} perlu revisi · {ringkasan.disetujui} disetujui · {ringkasan.dihapus} dihapus
          </span>
          <button type="button" className="dd-btn" onClick={salinDisetujui}>
            <IkonMenu d={IKON_PAPAN_KLIP} size={12} /> Salin daftar masuk edisi
          </button>
        </div>
        <div className="panel-b">
          <AturanKurasi />

          <div className="ks-filter">
            <DatePicker value={tanggal} onChange={setTanggal} ariaLabel="Tanggal kurasi" tanda={tandaKurasi} />
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

          {/* Bilah pilih. Muncul begitu ada kartu — BUKAN cuma sesudah satu
              kartu dicentang seperti versi lama: kotak "pilih semua" adalah
              satu-satunya jalan mencentang 30 kartu sekaligus, jadi ia tak
              boleh bersembunyi di balik syarat yang mengharuskan mencentang
              dulu. Tombol tindakannya sendiri tetap hanya muncul kalau ada
              yang terpilih. */}
          {tampil.length > 0 && (
            <div className={`af-aksibar${pilih.size === 0 ? ' sepi' : ''}`} style={{ marginTop: 10 }}>
              <label className="ks-pilihsemua">
                <input
                  type="checkbox"
                  className="af-cek"
                  ref={(el) => { if (el) el.indeterminate = pilih.size > 0 && pilih.size < tampil.length }}
                  checked={semuaTerpilih}
                  onChange={togglePilihSemua}
                  aria-label={semuaTerpilih ? 'Lepas semua pilihan' : 'Pilih semua setoran yang tampil'}
                />
                <span>
                  {pilih.size === 0
                    ? `Pilih semua (${tampil.length})`
                    : `${pilih.size} dari ${tampil.length} setoran dipilih`}
                </span>
              </label>
              {pilih.size > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="dd-btn" onClick={() => setujui([...pilih])}>
                  <IkonMenu d={IKON_CENTANG} size={12} /> Setujui terpilih
                </button>
                <button type="button" className="dd-btn" onClick={() => setRevisiTarget([...pilih])}>
                  <IkonMenu d={IKON_PERINGATAN} size={12} /> Minta revisi terpilih
                </button>
                <button type="button" className="dd-btn merah" onClick={() => setTolakTarget([...pilih])}>
                  <IkonMenu d={IKON_SILANG} size={12} /> Hapus terpilih
                </button>
              </div>
              )}
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
                      {/* Lencana jenis. Sebelumnya jenis setoran cuma tertulis
                          sebagai teks abu-abu di tengah kartu, satu baris dengan
                          nama kontributor — jadi kartu Bedah dan kartu Broker
                          Summary terlihat persis sama sampai dibaca. Padahal
                          keduanya beda produk: Bedah dirakit jadi PDF studi satu
                          emiten, Broker Summary jadi edisi harian. */}
                      <span className="ks-kartu-kanan">
                        <span className={`chip ${KELAS_STATUS[s.status]}`}>{LABEL_STATUS[s.status]}</span>
                        {s.status === 'disetujui' && !s.dimuat && (
                          <span className="chip" title="Disetujui, tapi sengaja tidak dimuat di edisi ini">Di luar edisi</span>
                        )}
                      </span>
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
                      {/* Lencana jenis duduk di baris ticker, bukan di kepala
                          kartu: di kepala ia berebut lebar dengan chip status
                          ("Perlu revisi" lebih panjang dari "Disetujui") dan
                          membungkus ke baris kedua, sehingga tinggi kepala tiap
                          kartu jadi beda-beda. Di sini lebarnya lega karena kode
                          emiten cuma 4 huruf. */}
                      <span className="ks-tick-baris">
                        <span className="tick">{s.ticker}</span>
                        <span className={`chip ks-jenis ks-jenis-${s.jenis}`}>{LABEL_JENIS[s.jenis]}</span>
                      </span>
                      <span className="muted" style={{ fontSize: 10.5 }}>{nama}</span>
                      <span className="muted" style={{ fontSize: 10 }}>{waktuManusiawi(s.dibuat_pada)}</span>
                      <p className="ks-alasan">{s.alasan?.trim() || '(tanpa alasan — superadmin)'}</p>
                      {(s.status === 'dihapus' || s.status === 'revisi') && s.catatan_kurator && (
                        <p className="ks-catatan"><IkonMenu d={IKON_PERINGATAN} size={11} /> {s.catatan_kurator}</p>
                      )}
                    </div>
                    <div className="ks-aksi">
                      <button type="button" className="dd-btn" disabled={proses || s.status === 'disetujui'} onClick={() => setujui([s.path])}>
                        <IkonMenu d={IKON_CENTANG} size={12} /> Setujui
                      </button>
                      <button type="button" className="dd-btn" disabled={proses || s.status === 'revisi'} onClick={() => setRevisiTarget([s.path])}>
                        <IkonMenu d={IKON_PERINGATAN} size={12} /> Revisi
                      </button>
                      <button type="button" className="dd-btn merah" disabled={proses || s.status === 'dihapus'} onClick={() => setTolakTarget([s.path])}>
                        <IkonMenu d={IKON_SILANG} size={12} /> Hapus
                      </button>
                      {/* Baris kedua, dipisah garis: tiga tombol di atasnya
                          menjawab "datanya benar?". Dua ini pertanyaan lain —
                          "masuk edisi hari ini?" (redaksi) dan "tanggalnya
                          benar?" (koreksi), keduanya bukan kurasi. */}
                      <button type="button" className="dd-btn ks-dimuat" disabled={proses || s.status !== 'disetujui'}
                        title={s.status !== 'disetujui' ? 'Hanya setoran disetujui yang bisa masuk edisi' : undefined}
                        onClick={() => ubahDimuat([s.path], !s.dimuat)}>
                        <IkonMenu d={s.dimuat ? IKON_CENTANG : IKON_SILANG} size={12} />{' '}
                        {s.dimuat ? 'Di edisi' : 'Di luar edisi'}
                      </button>
                      <button type="button" className="dd-btn ks-pindah" disabled={proses}
                        title="Pindahkan setoran ini ke tanggal lain — berkas & barisnya berpindah bersama"
                        onClick={() => setPindahTarget(s)}>
                        <IkonMenu d={IKON_KALENDER} size={12} /> Pindah tanggal
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
          onKirim={(catatan) => hapus(tolakTarget, catatan)}
        />
      )}

      {revisiTarget && (
        <TolakModal
          jumlah={revisiTarget.length}
          varian="revisi"
          onClose={() => setRevisiTarget(null)}
          onKirim={(catatan) => revisi(revisiTarget, catatan)}
        />
      )}

      {pindahTarget && (
        <PindahTanggalModal
          setoran={pindahTarget}
          sibuk={sibuk.has(pindahTarget.path)}
          onClose={() => setPindahTarget(null)}
          onKirim={(tgl) => pindahTanggal(pindahTarget, tgl)}
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

      <Toast toast={toast} />
    </>
  )
}

/**
 * Keterangan aturan kurasi — apa yang benar-benar terjadi pada tiap tindakan.
 *
 * Isinya diturunkan dari kode & fungsi SQL yang sedang berjalan, BUKAN dari
 * niat desainnya:
 *   - `kurasiSetoran()` / `mintaRevisiSetoran()` — cuma UPDATE `status`
 *   - `hitung_orderbook_hari()` — kuota harian, semua kecuali `dihapus`
 *   - `emiten_sudah_disetor()` — kunci emiten, semua kecuali `dihapus`
 *   - `berkas_masih_menunggu()` — penyetor boleh mengganti berkasnya sendiri
 *   - `hitung_jenjang()` — akurasi
 *   - `kabari_hasil_kurasi()` — pemberitahuan otomatis
 * Kalau salah satunya diubah, teks di sini WAJIB ikut diperiksa — keterangan
 * yang menyimpang dari perilaku nyata lebih buruk daripada tak ada keterangan.
 *
 * Dilipat (`<details>`) supaya tak memakan ruang kerja harian: yang dibutuhkan
 * tiap hari daftar setorannya, bukan aturannya.
 */
function AturanKurasi() {
  return (
    <details className="ks-aturan">
      <summary>
        <IkonMenu d={IKON_PERINGATAN} size={12} />
        Aturan kurasi — apa yang hilang dan apa yang tetap ada
      </summary>

      <p className="ks-aturan-inti">
        <b>Tidak ada tindakan kurasi yang menghapus berkasnya.</b> Semua tombol di
        halaman ini hanya mengubah <i>status</i> baris setoran; tangkapan layar
        yang sudah diunggah tetap tersimpan dan tetap bisa dibuka dari kartunya,
        termasuk yang berstatus <b>Dihapus</b>. Yang berubah cuma: ikut edisi
        atau tidak, memakan kuota atau tidak, dan mengunci emiten atau tidak.
        <br />
        Satu-satunya yang benar-benar membuang berkas dari penyimpanan adalah
        tombol <b>“Hapus berkas”</b> di tab Unggah — dan itu cuma bisa dipakai
        penyetornya sendiri selagi setorannya masih <b>Menunggu</b> atau{' '}
        <b>Perlu revisi</b>.
      </p>

      <div className="af-gulir">
        <table className="tbl ks-aturan-tabel">
          <thead>
            <tr>
              <th>Status</th>
              <th>Berkas</th>
              <th>Kuota harian penyetor</th>
              <th>Emiten terkunci hari itu</th>
              <th>Penyetor boleh ganti/hapus</th>
              <th>Jenjang &amp; akurasi</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>Menunggu</b></td>
              <td>Tersimpan</td>
              <td>Terpakai</td>
              <td>Ya</td>
              <td>Ya</td>
              <td>Belum dihitung</td>
            </tr>
            <tr>
              <td><b>Perlu revisi</b></td>
              <td>Tersimpan</td>
              <td>Terpakai</td>
              <td>Ya</td>
              <td><b>Ya</b> — berkasnya boleh diganti</td>
              <td><b>Tidak menurunkan akurasi</b></td>
            </tr>
            <tr>
              <td><b>Disetujui</b></td>
              <td>Tersimpan &amp; terkunci</td>
              <td>Terpakai</td>
              <td>Ya</td>
              <td>Tidak</td>
              <td>Menambah jumlah disetujui</td>
            </tr>
            <tr>
              <td><b>Dihapus</b></td>
              <td><b>Tetap tersimpan</b></td>
              <td><b>Dikembalikan</b></td>
              <td><b>Tidak</b> — emitennya terbuka lagi</td>
              <td>Tidak</td>
              <td><b>Menurunkan akurasi</b></td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul className="ks-aturan-poin">
        <li>
          <b>“Dihapus” bukan penghapusan berkas, tapi pengeluaran dari antrean
          edisi.</b> Kuota harian penyetor dikembalikan dan emitennya terbuka
          lagi untuk hari itu — jadi orang lain (atau penyetor yang sama) bisa
          menyetor ulang emiten tersebut.
        </li>
        <li>
          <b>“Perlu revisi” adalah satu-satunya jalan yang menyuruh memperbaiki
          tanpa menghukum.</b> Kuotanya tetap terpakai dan emitennya tetap
          terkunci — memang disengaja, supaya emiten yang sudah dikerjakan tak
          direbut orang lain selagi diperbaiki. Catatan kurator <b>wajib
          diisi</b>: tanpa itu penyetor tak tahu apa yang harus diperbaiki.
        </li>
        <li>
          <b>Catatan kurator terlihat oleh penyetor</b>, dan tiap perubahan
          status (disetujui / perlu revisi / dihapus) otomatis mengirim
          pemberitahuan ke penyetornya.
        </li>
        <li>
          <b>“Di edisi” terpisah dari “Disetujui”.</b> Setoran yang disetujui
          tapi tidak dimuat tetap dihitung penuh untuk jenjang penyetor —
          memangkas isi edisi bukan alasan menghukum kerja yang benar.
        </li>
        <li className="ks-aturan-catat">
          <b>Menandai “Di edisi” tidak menerbitkan apa pun.</b> Ia cuma
          mengubah penanda di basis data. PDF edisi dirakit terpisah oleh{' '}
          <code>arus-pasar/build.py</code>, dijalankan <b>manual</b> — tak ada
          penjadwalan, dan skrip itu tidak membaca basis data sama sekali.
          Jembatannya tombol <b>“Salin daftar masuk edisi”</b> di atas:
          salinannya memuat daftar yang masuk <i>dan</i> argumen{' '}
          <code>--kecuali=</code> berisi yang dikeluarkan. Perhatikan
          polaritasnya — <code>--kecuali</code> menerima yang{' '}
          <b>DIKELUARKAN</b>, bukan yang masuk.
        </li>
        <li className="ks-aturan-catat">
          <b>Akurasi = disetujui ÷ (disetujui + dihapus).</b> Jadi menghapus
          setoran <b>menurunkan akurasi penyetornya</b>, dan itu ikut
          menentukan jenjang — tiap jenjang punya syarat akurasi minimum.
          Setoran <b>“perlu revisi” sengaja tidak masuk hitungan</b>: revisi
          adalah permintaan perbaikan, bukan vonis. Kalau revisi ikut
          menghukum, kontributor akan menghindarinya — persis kebalikan dari
          maksudnya.
        </li>
      </ul>
    </details>
  )
}

/**
 * Modal pemilih tanggal tujuan saat memindahkan setoran.
 *
 * Kasus yang melahirkannya: 17 Agu 2026 bursa libur, dua kontributor tetap
 * menyetor untuk tanggal itu. Setorannya benar, cuma tanggalnya salah — jadi
 * yang dibutuhkan pemindahan, bukan penghapusan, dan nadanya ikut begitu.
 */
function PindahTanggalModal({ setoran, sibuk, onClose, onKirim }: {
  setoran: SetoranRow
  sibuk: boolean
  onClose: () => void
  onKirim: (tanggalBaru: string) => void
}) {
  const [tanggal, setTanggal] = useState(setoran.tanggal)
  const libur = alasanBukanHariBursa(tanggal)
  const nama = setoran.profil?.alias || setoran.profil?.email || 'penyetornya'

  return (
    <ModalKecil className="ks-pindah-modal" label={`Pindahkan ${setoran.ticker} ke tanggal lain?`} onClose={() => { if (!sibuk) onClose() }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <p className="muted" style={{ margin: 0, fontSize: 11, lineHeight: 1.6 }}>
          Berkas dan barisnya berpindah bersama — berkasnya dipindah lebih dulu,
          dan kalau barisnya gagal ikut, berkasnya dikembalikan. Status kurasi,
          kredit, dan kepemilikan tidak berubah: setoran ini tetap milik <b>{nama}</b>.
        </p>
        <div className="field">
          <span className="lbl">Tanggal tujuan</span>
          <DatePicker value={tanggal} onChange={setTanggal} maks={todayIsoJakarta()} ariaLabel="Tanggal tujuan pemindahan" />
        </div>
        {libur && tanggal !== setoran.tanggal && (
          <p className="af-dup" style={{ margin: 0 }}>
            <IkonMenu d={IKON_PERINGATAN} size={12} />
            <span>{tanggal} juga bukan hari bursa ({libur}).</span>
          </p>
        )}
        <button
          type="button"
          className="btn-p"
          disabled={sibuk || tanggal === setoran.tanggal}
          onClick={() => onKirim(tanggal)}
        >
          {sibuk ? 'Memindahkan…' : tanggal === setoran.tanggal ? 'Pilih tanggal lain dulu' : `Pindahkan ke ${tanggal}`}
        </button>
      </div>
    </ModalKecil>
  )
}

/** Modal catatan kurator saat MENGHAPUS atau minta revisi — catatan wajib diisi
 *  di kedua varian (kontributor berhak tahu alasan/apa yang perlu diperbaiki),
 *  dipakai satuan maupun massal. Diekspor supaya kurasi cepat dari tabel
 *  "Sudah Diunggah" (UnggahHarian.tsx) pakai modal yang SAMA, bukan menulis
 *  ulang logikanya. `varian` cuma mengubah judul/teks — logika & bentuk
 *  form-nya identik, jadi satu modal dipakai ulang alih-alih dua. */
export function TolakModal({ jumlah, varian = 'hapus', onClose, onKirim }: {
  jumlah: number
  varian?: 'hapus' | 'revisi'
  onClose: () => void
  onKirim: (catatan: string) => void
}) {
  const revisi = varian === 'revisi'
  const [catatan, setCatatan] = useState('')
  const [kirim, setKirim] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!catatan.trim()) {
      setErr(revisi ? 'Catatan wajib diisi — penyetor perlu tahu apa yang harus diperbaiki.' : 'Catatan wajib diisi — kontributor berhak tahu kenapa setorannya dihapus.')
      return
    }
    setKirim(true)
    setErr('')
    await onKirim(catatan.trim())
    setKirim(false)
  }

  const label = revisi
    ? (jumlah === 1 ? 'Minta revisi setoran ini?' : `Minta revisi ${jumlah} setoran?`)
    : (jumlah === 1 ? 'Hapus setoran ini?' : `Hapus ${jumlah} setoran?`)

  return (
    <ModalKecil label={label} onClose={() => { if (!kirim) onClose() }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <span className="lbl">Catatan kurator — wajib diisi</span>
          <textarea
            className="inp"
            rows={3}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder={revisi ? 'Apa yang perlu diperbaiki — akan terlihat oleh penyetor.' : 'Kenapa dihapus — akan terlihat oleh penyetor.'}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
        <button type="submit" className={revisi ? 'btn-p' : 'btn-p af-btn-keluar'} disabled={kirim}>
          {revisi ? (kirim ? 'Mengirim…' : 'Minta revisi') : (kirim ? 'Menghapus…' : 'Hapus')}
        </button>
        {err && <p className="af-err" style={{ margin: 0 }}>{err}</p>}
      </form>
    </ModalKecil>
  )
}
