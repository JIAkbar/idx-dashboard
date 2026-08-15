import { useEffect, useState } from 'react'
import { useProfilSaya } from '../../lib/profilSaya'
import { daftarAkun, type AkunRow } from '../../lib/adminAkun'
import {
  ringkasanKeaktifan,
  sinyalBruteforce,
  jejakHalaman,
  JEJAK_PER_HAL,
  LABEL_JENIS_JEJAK,
  type RingkasanKeaktifan,
  type SinyalBruteforce,
  type JejakAkses,
  type JenisJejak,
} from '../../lib/aktivitas'
import { namaTampil } from '../../lib/namaTampil'
import { Dropdown } from '../../components/dasbor/Dropdown'
import { IkonMenu, IKON_PERINGATAN, IKON_KUNCI } from '../../components/dasbor/IkonMenu'
import { AksesDitolak } from './AdminLayout'
import './AdminShared.css'

/** Hari diam dari sini dianggap "mendekati pembekuan otomatis" — ambang
 *  pembekuan sebenarnya (biasanya lebih tinggi, per jenjang) dihitung server;
 *  ini cuma penanda dini di UI, bukan angka otoritatif. */
const AMBANG_DIAM_PERINGATAN = 5

const JENDELA_OPSI = [
  { nilai: '15', label: '15 menit terakhir' },
  { nilai: '60', label: '1 jam terakhir' },
  { nilai: '1440', label: '24 jam terakhir' },
]

const JENIS_OPSI: { nilai: JenisJejak | 'semua'; label: string }[] = [
  { nilai: 'semua', label: 'Semua jenis' },
  ...(Object.entries(LABEL_JENIS_JEJAK) as [JenisJejak, string][]).map(([nilai, label]) => ({ nilai, label })),
]

/** ISO datetime → "13 Agu 2026, 14:05"; "—" kalau null/kosong/tak valid.
 *  Duplikat kecil dari pola yang sama di AkunAdmin.tsx/KurasiSetoran.tsx —
 *  proyek ini belum menaruh helper tanggal bersama, konsisten dgn berkas lain. */
function waktuManusiawi(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()]
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getDate()} ${bulan} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Tab "Aktivitas" (/admin/aktivitas, superadmin saja, Fase 4) — tiga panel:
 * keaktifan kontributor, sinyal bruteforce, dan jejak akses terakhir. Semua
 * data dari RPC/tabel yang sudah live (`ringkasan_keaktifan`, `sinyal_bruteforce`,
 * `jejak_akses`) — tidak ada migrasi baru dari sini.
 */
export function AktivitasAdmin() {
  const { profil, loading } = useProfilSaya()
  const superadmin = profil?.peran === 'superadmin'

  const [keaktifan, setKeaktifan] = useState<RingkasanKeaktifan[] | null>(null)
  const [akun, setAkun] = useState<AkunRow[] | null>(null)
  const [galatKeaktifan, setGalatKeaktifan] = useState('')

  const [jendela, setJendela] = useState('15')
  const [bruteforce, setBruteforce] = useState<SinyalBruteforce[] | null>(null)
  const [galatBruteforce, setGalatBruteforce] = useState('')

  const [jenisFilter, setJenisFilter] = useState<JenisJejak | 'semua'>('semua')
  const [jejak, setJejak] = useState<JejakAkses[] | null>(null)
  /** Halaman jejak yang sedang dilihat (0 = terbaru) + total baris di server. */
  const [halaman, setHalaman] = useState(0)
  const [totalJejak, setTotalJejak] = useState(0)
  const [galatJejak, setGalatJejak] = useState('')

  // Keaktifan kontributor + daftarAkun (Edge Function admin-akun) cuma dipakai
  // buat tahu peran (superadmin/kontributor) per baris — RPC ringkasan_keaktifan
  // TIDAK ikut mengembalikan kolom peran (dicek langsung ke definisi fungsi di
  // database, bukan tebakan), jadi baris superadmin di tabel jenjang harus
  // disilangkan dgn daftar akun ini, pola sama AkunAdmin.tsx (a.peran !== 'superadmin').
  useEffect(() => {
    if (!superadmin) return
    let batal = false
    setGalatKeaktifan('')
    Promise.all([ringkasanKeaktifan(), daftarAkun()])
      .then(([k, a]) => {
        if (batal) return
        setKeaktifan(k)
        setAkun(a)
      })
      .catch((e) => !batal && setGalatKeaktifan(e instanceof Error ? e.message : 'Gagal memuat keaktifan kontributor.'))
    return () => {
      batal = true
    }
  }, [superadmin])

  useEffect(() => {
    if (!superadmin) return
    let batal = false
    setGalatBruteforce('')
    sinyalBruteforce(Number(jendela), 5)
      .then((s) => !batal && setBruteforce(s))
      .catch((e) => !batal && setGalatBruteforce(e instanceof Error ? e.message : 'Gagal memuat sinyal keamanan.'))
    return () => {
      batal = true
    }
  }, [superadmin, jendela])

  // Ganti saringan jenis mengembalikan pembaca ke halaman pertama — halaman 3
  // dari daftar lama hampir pasti tidak ada di daftar yang baru disaring.
  useEffect(() => { setHalaman(0) }, [jenisFilter])

  useEffect(() => {
    if (!superadmin) return
    let batal = false
    setGalatJejak('')
    jejakHalaman(jenisFilter, halaman)
      .then((h) => {
        if (batal) return
        setJejak(h.baris)
        setTotalJejak(h.total)
      })
      .catch((e) => !batal && setGalatJejak(e instanceof Error ? e.message : 'Gagal memuat jejak akses.'))
    return () => {
      batal = true
    }
  }, [superadmin, jenisFilter, halaman])

  if (loading) return <p className="muted">Memuat…</p>
  // Tab disembunyikan di AdminLayout kalau bukan superadmin — guard ini jaga-
  // jaga akses langsung lewat URL/bookmark (rute /admin/aktivitas tetap hidup).
  if (!superadmin) return <AksesDitolak pesan="Halaman ini khusus superadmin." />

  const peranById = new Map((akun ?? []).map((a) => [a.id, a.peran]))

  return (
    <>
      <section className="panel">
        <div className="panel-h"><span className="lbl">Keaktifan kontributor{keaktifan ? ` (${keaktifan.length})` : ''}</span></div>
        <div className="panel-b">
          {galatKeaktifan && <p className="af-err">{galatKeaktifan}</p>}
          {keaktifan === null && !galatKeaktifan && <p className="muted">Memuat…</p>}
          {keaktifan && keaktifan.length === 0 && <p className="muted">Belum ada kontributor.</p>}
          {keaktifan && keaktifan.length > 0 && (
            <div className={`af-gulir aa-tbl-wrap${keaktifan.length > 10 ? ' af-gulir-cap' : ''}`}>
              <table className="tbl aa-tbl">
                <thead>
                  <tr>
                    <th>Kontributor</th>
                    <th>Jenjang</th>
                    <th className="af-c">Setoran</th>
                    <th className="af-c">Disetujui</th>
                    <th className="af-c">Ditolak</th>
                    <th className="af-c">Menunggu</th>
                    <th className="af-c">Akurasi</th>
                    <th>Terakhir setor</th>
                    <th className="af-c">Hari diam</th>
                    <th className="af-c">IP berbeda (30h)</th>
                  </tr>
                </thead>
                <tbody>
                  {keaktifan.map((r) => {
                    const berjenjang = peranById.get(r.id) !== 'superadmin'
                    const diamPeringatan = r.hari_diam >= AMBANG_DIAM_PERINGATAN
                    return (
                      <tr key={r.id}>
                        <td>{namaTampil({ alias: r.alias, email: r.email }, null)}</td>
                        <td>
                          {berjenjang ? (
                            <span className="chip" title={`Tier ${r.tier}`}>{r.jenjang}</span>
                          ) : (
                            <span className="muted" title="Superadmin tidak dibatasi jenjang">Tanpa jenjang</span>
                          )}
                        </td>
                        <td className="af-c">{r.setoran}</td>
                        <td className="af-c">{r.disetujui}</td>
                        <td className="af-c">{r.ditolak}</td>
                        <td className="af-c">{r.menunggu}</td>
                        <td className="af-c">{r.akurasi === null ? '—' : `${r.akurasi}%`}</td>
                        <td>{waktuManusiawi(r.terakhir_setor)}</td>
                        <td className="af-c">
                          {diamPeringatan ? (
                            <span className="chip warn" title="Mendekati pembekuan otomatis">
                              <IkonMenu d={IKON_PERINGATAN} size={11} /> {r.hari_diam}
                            </span>
                          ) : (
                            r.hari_diam
                          )}
                        </td>
                        <td className="af-c">{r.ip_berbeda}</td>
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
          <span className="lbl"><IkonMenu d={IKON_KUNCI} size={13} /> Keamanan — percobaan masuk gagal</span>
          <Dropdown opsi={JENDELA_OPSI} nilai={jendela} ariaLabel="Jendela waktu" onGanti={setJendela} />
        </div>
        <div className="panel-b">
          <p className="muted" style={{ marginTop: 0, fontSize: 11 }}>
            IP dengan 5 atau lebih percobaan masuk gagal dalam jendela waktu di atas —
            penanda dini kemungkinan serangan tebak sandi (bruteforce).
          </p>
          {galatBruteforce && <p className="af-err">{galatBruteforce}</p>}
          {bruteforce === null && !galatBruteforce && <p className="muted">Memuat…</p>}
          {bruteforce && bruteforce.length === 0 && (
            <p className="muted">
              Tidak ada IP dengan percobaan masuk gagal mencurigakan dalam {JENDELA_OPSI.find((j) => j.nilai === jendela)?.label} —
              kondisi aman.
            </p>
          )}
          {bruteforce && bruteforce.length > 0 && (
            <div className={`af-gulir aa-tbl-wrap${bruteforce.length > 10 ? ' af-gulir-cap' : ''}`}>
              <table className="tbl aa-tbl">
                <thead>
                  <tr>
                    <th>IP</th>
                    <th className="af-c">Percobaan gagal</th>
                    <th className="af-c">Email dicoba</th>
                    <th>Pertama</th>
                    <th>Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {bruteforce.map((b) => (
                    <tr key={b.ip}>
                      <td className="tick">{b.ip}</td>
                      <td className="af-c"><span className="chip dn">{b.gagal}</span></td>
                      <td className="af-c">{b.email_dicoba}</td>
                      <td>{waktuManusiawi(b.pertama)}</td>
                      <td>{waktuManusiawi(b.terakhir)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-h" style={{ alignItems: 'center' }}>
          <span className="lbl">Jejak terakhir</span>
          <Dropdown opsi={JENIS_OPSI} nilai={jenisFilter} ariaLabel="Saring jenis jejak" onGanti={(v) => setJenisFilter(v as JenisJejak | 'semua')} />
        </div>
        <div className="panel-b">
          {galatJejak && <p className="af-err">{galatJejak}</p>}
          {jejak === null && !galatJejak && <p className="muted">Memuat…</p>}
          {jejak && jejak.length === 0 && <p className="muted">Belum ada jejak akses{jenisFilter !== 'semua' ? ` jenis "${LABEL_JENIS_JEJAK[jenisFilter]}"` : ''}.</p>}
          {jejak && jejak.length > 0 && (
            <div className={`af-gulir aa-tbl-wrap${jejak.length > 10 ? ' af-gulir-cap' : ''}`}>
              <table className="tbl aa-tbl">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Jenis</th>
                    <th>Email</th>
                    <th>IP</th>
                    <th>User agent</th>
                  </tr>
                </thead>
                <tbody>
                  {jejak.map((j) => (
                    <tr key={j.id}>
                      <td>{waktuManusiawi(j.waktu)}</td>
                      <td><span className={`chip ${j.jenis === 'login_gagal' ? 'dn' : 'up'}`}>{LABEL_JENIS_JEJAK[j.jenis]}</span></td>
                      <td className="muted" style={{ fontSize: 11 }}>{j.email || '—'}</td>
                      <td className="muted" style={{ fontSize: 11 }}>{j.ip || '—'}</td>
                      <td className="af-ua" title={j.user_agent || undefined}>{j.user_agent || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Paginasi. Ditampilkan hanya kalau memang ada halaman kedua —
              kontrol navigasi untuk satu halaman cuma menambah kebisingan. */}
          {totalJejak > JEJAK_PER_HAL && (
            <div className="af-paginasi">
              <span className="muted">
                {halaman * JEJAK_PER_HAL + 1}–{Math.min((halaman + 1) * JEJAK_PER_HAL, totalJejak)} dari {totalJejak}
              </span>
              <span className="af-paginasi-tbl">
                <button
                  type="button" className="dd-btn" disabled={halaman === 0}
                  onClick={() => setHalaman((h) => Math.max(0, h - 1))}
                >
                  ‹ Lebih baru
                </button>
                <button
                  type="button" className="dd-btn"
                  disabled={(halaman + 1) * JEJAK_PER_HAL >= totalJejak}
                  onClick={() => setHalaman((h) => h + 1)}
                >
                  Lebih lama ›
                </button>
              </span>
            </div>
          )}
          <p className="muted af-privasi" style={{ marginBottom: 0 }}>
            <IkonMenu d={IKON_PERINGATAN} size={11} /> IP dicatat untuk keperluan keamanan (deteksi bruteforce & akun
            terkompromi) dan terhapus otomatis setelah 90 hari.
          </p>
        </div>
      </section>
    </>
  )
}
