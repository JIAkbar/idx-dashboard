import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useProfilSaya } from '../../lib/profilSaya'
import { daftarAkun, buatAkun, hapusAkun, hitungSetoranAkun, resetSandi, setProfil, ubahEmail, type AkunRow } from '../../lib/adminAkun'
import { daftarJenjang, type JenjangRow } from '../../lib/jenjang'
import { TombolIkon } from '../../components/dasbor/TombolIkon'
import { IkonMenu, IKON_CARI, IKON_CENTANG, IKON_KUNCI, IKON_PERINGATAN, IKON_SALIN, IKON_SURAT, IKON_TAMBAH, IKON_TONG, IKON_ULANG } from '../../components/dasbor/IkonMenu'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
import { Dropdown } from '../../components/dasbor/Dropdown'
import { KolomSandi } from '../../components/dasbor/KolomSandi'
import { rakitSandi } from '../../lib/sandiRakit'
import { AksesDitolak } from './AdminLayout'
import { PanelJenjang } from './PanelJenjang'
import './AkunAdmin.css'
import { pesanGalat } from '../../lib/pesanGalat'

/** Domain akun kontributor PAPAN. Ditulis sekali di sini supaya kalau suatu
 *  saat berganti, tak ada satu pun tempat yang tertinggal memakai yang lama. */
const DOMAIN_AKUN = '@papan.id'

type KunciUrut = 'terbaru' | 'terlama' | 'email' | 'alias' | 'jenjang' | 'kuota' | 'nonaktif'

const URUT_OPSI = [
  { nilai: 'terbaru', label: 'Terakhir masuk ↓' },
  { nilai: 'terlama', label: 'Terakhir masuk ↑' },
  { nilai: 'email', label: 'Email A–Z' },
  { nilai: 'alias', label: 'Alias A–Z' },
  { nilai: 'jenjang', label: 'Jenjang tertinggi' },
  { nilai: 'kuota', label: 'Kuota terbesar' },
  { nilai: 'nonaktif', label: 'Nonaktif dulu' },
]

/**
 * Saring lalu urutkan daftar akun. Dipisah jadi fungsi murni supaya bisa diuji
 * tanpa merender tabelnya — yang gampang salah di sini bukan tampilannya, tapi
 * perlakuan pada akun yang BELUM pernah masuk (`terakhir_masuk` null).
 */
export function saringUrutAkun(daftar: AkunRow[], cari: string, urut: KunciUrut): AkunRow[] {
  const q = cari.trim().toLowerCase()
  const hasil = q
    ? daftar.filter((a) => `${a.email} ${a.alias ?? ''}`.toLowerCase().includes(q))
    : [...daftar]

  // Akun yang belum pernah masuk selalu ditaruh di UJUNG, di kedua arah — bukan
  // diperlakukan sebagai "tahun 1970". Pada urutan "terlama" mereka akan
  // memenuhi layar teratas dan menutupi yang sebenarnya dicari: akun lama yang
  // sudah lama tak muncul.
  const waktu = (a: AkunRow) => (a.terakhir_masuk ? Date.parse(a.terakhir_masuk) : NaN)
  const banding: Record<KunciUrut, (a: AkunRow, b: AkunRow) => number> = {
    terbaru: (a, b) => bandingWaktu(waktu(a), waktu(b), -1),
    terlama: (a, b) => bandingWaktu(waktu(a), waktu(b), 1),
    email: (a, b) => a.email.localeCompare(b.email, 'id'),
    alias: (a, b) => (a.alias || '￿').localeCompare(b.alias || '￿', 'id'),
    jenjang: (a, b) => (b.tier ?? 0) - (a.tier ?? 0),
    kuota: (a, b) => (b.kuota_manual ?? b.kuota_harian) - (a.kuota_manual ?? a.kuota_harian),
    nonaktif: (a, b) => Number(a.aktif) - Number(b.aktif),
  }
  return hasil.sort(banding[urut])
}

function bandingWaktu(a: number, b: number, arah: 1 | -1): number {
  if (Number.isNaN(a) && Number.isNaN(b)) return 0
  if (Number.isNaN(a)) return 1
  if (Number.isNaN(b)) return -1
  return (a - b) * arah
}

/** Pilihan kuota harian — dropdown gantinya input number bertombol panah
 *  (sempit, gampang salah ketik). Dipakai form Tambah Akun & kolom kuota
 *  per baris tabel (perbaikan A, #shell-tab). */
const KUOTA_OPSI = [1, 2, 3, 5, 8, 12, 20, 50].map((n) => ({ nilai: String(n), label: String(n) }))

/** Sentinel dropdown "Ikut jenjang" (Fase 6) — `kuota_manual: null` di server. */
const IKUT_JENJANG = 'ikut'
const KUOTA_MANUAL_OPSI = [
  // Label sengaja satu kata: "Ikut jenjang" pecah dua baris di kolom
  // selebar ini, dan melebarkan kolomnya berarti menggeser semua kolom
  // sesudahnya (§172 SAKTI: pendekkan konten, jangan lebarkan kolom).
  { nilai: IKUT_JENJANG, label: 'Otomatis' },
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

/**
 * Tombol salin ke papan klip, dengan centang sesaat sebagai bukti.
 *
 * Tanpa umpan balik, satu-satunya cara memastikan salinan berhasil adalah
 * menempelkannya ke suatu tempat — dan orang yang ragu akan menekan tombolnya
 * dua-tiga kali. Centang dua detik menghapus keraguan itu.
 */
function TombolSalin({ teks, judul }: { teks: string; judul: string }) {
  const [tersalin, setTersalin] = useState(false)
  useEffect(() => {
    if (!tersalin) return
    const t = setTimeout(() => setTersalin(false), 2000)
    return () => clearTimeout(t)
  }, [tersalin])
  return (
    <TombolIkon
      d={tersalin ? IKON_CENTANG : IKON_SALIN}
      ukuranIkon={13}
      className="aa-salin"
      label={judul}
      disabled={!teks}
      onClick={() => {
        // Clipboard API bisa ditolak (izin, konteks non-secure). Diamkan
        // galatnya — tapi JANGAN tampilkan centang, karena centang yang muncul
        // padahal tak ada yang tersalin lebih menyesatkan daripada tak ada
        // umpan balik sama sekali.
        void navigator.clipboard.writeText(teks).then(() => setTersalin(true), () => {})
      }}
    />
  )
}

/**
 * Baris "Buatkan sandi" di bawah kolom sandi — merakit <Nama><4 digit> lalu
 * mengisinya ke kolom. Sandinya tampil apa adanya di layar superadmin (tombol
 * intip di KolomSandi) karena memang harus disalin dan dibacakan ke pemilik
 * akun; ia tidak pernah dikirim ke mana pun selain Edge Function admin-akun.
 */
function BarisBuatkanSandi({ nama, onBuat, disabled }: { nama: string; onBuat: (s: string) => void; disabled?: boolean }) {
  return (
    <div className="aa-buatkan">
      <button type="button" className="dd-btn" disabled={disabled} onClick={() => onBuat(rakitSandi(nama))}>
        <IkonMenu d={IKON_ULANG} size={12} /> Buatkan sandi
      </button>
      <span className="muted">Bentuknya {'<Nama><4 angka>'} — cukup untuk dibacakan, wajib diganti pemiliknya.</span>
    </div>
  )
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
  /** Opsi dropdown jenjang. Label nama saja — "Perunggu · 2/hari" pecah dua
   *  baris di kolom 110px, dan kuota efektifnya sudah tertulis di kolom
   *  sebelahnya (§172 SAKTI: pendekkan konten, jangan lebarkan kolom). */
  const jenjangOpsi = useMemo(
    () => [...jenjang]
      .sort((a, b) => a.tier - b.tier)
      .map((j) => ({ nilai: String(j.tier), label: j.nama })),
    [jenjang]
  )
  const [galat, setGalat] = useState('')
  const [muat, setMuat] = useState(0)
  /** id baris yang sedang punya request in-flight — dipakai disable kontrol baris itu. */
  const [sibuk, setSibuk] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ ok: boolean; pesan: string } | null>(null)

  const [cari, setCari] = useState('')
  // Jenjang tertinggi sebagai urutan awal: yang paling sering dicari di
  // tabel ini adalah kontributor yang paling banyak menyumbang, bukan yang
  // kebetulan paling baru membuka aplikasi.
  const [urut, setUrut] = useState<KunciUrut>('jenjang')
  const [tambahBuka, setTambahBuka] = useState(false)
  const [resetTarget, setResetTarget] = useState<AkunRow | null>(null)
  const [hapusTarget, setHapusTarget] = useState<AkunRow | null>(null)
  const [emailTarget, setEmailTarget] = useState<AkunRow | null>(null)
  const [resetAkurasiTarget, setResetAkurasiTarget] = useState<AkunRow | null>(null)

  const superadmin = profil?.peran === 'superadmin'
  const tampil = useMemo(() => saringUrutAkun(akun ?? [], cari, urut), [akun, cari, urut])

  useEffect(() => {
    if (!superadmin) return
    let batal = false
    setGalat('')
    daftarAkun()
      .then((a) => !batal && setAkun(a))
      .catch((e) => !batal && setGalat(pesanGalat(e, 'Gagal memuat daftar akun.')))
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
    patch: Partial<{ kuota_harian: number; boleh_bedah: boolean; aktif: boolean; kuota_manual: number | null; beku_otomatis: boolean; tier: number; akurasi_sejak: string | null }>
  ) {
    tandaiSibuk(baris.id, true)
    try {
      await setProfil(baris.id, patch)
      setAkun((list) => list && list.map((a) => (a.id === baris.id ? { ...a, ...patch } : a)))
    } catch (e) {
      setToast({ ok: false, pesan: pesanGalat(e, 'Gagal menyimpan perubahan.') })
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
          {/* Saat sedang menyaring, angkanya menyebut DUA-DUANYA. "Akun (3)"
              di layar yang tersaring gampang terbaca sebagai "cuma ada 3 akun". */}
          <span className="lbl">
            Akun{akun ? (cari.trim() ? ` (${tampil.length} dari ${akun.length})` : ` (${akun.length})`) : ''}
          </span>
          <button type="button" className="btn-p af-tambah" onClick={() => setTambahBuka(true)}>
            <IkonMenu d={IKON_TAMBAH} size={13} /> Tambah Akun
          </button>
        </div>
        <div className="panel-b">
          {galat && <p className="af-err" style={{ marginTop: 0 }}>{galat}</p>}
          {akun === null && !galat && <p className="muted">Memuat…</p>}
          {akun && akun.length === 0 && <p className="muted">Belum ada akun.</p>}
          {akun && akun.length > 0 && (
            <div className="aa-kontrol">
              <div className="af-cari aa-cari">
                <IkonMenu d={IKON_CARI} size={13} />
                <input
                  className="inp" value={cari} type="search" autoComplete="off"
                  placeholder="Cari email atau alias…" aria-label="Cari akun"
                  onChange={(e) => setCari(e.target.value)}
                />
              </div>
              <Dropdown opsi={URUT_OPSI} nilai={urut} ariaLabel="Urutkan akun"
                onGanti={(v) => setUrut(v as KunciUrut)} />
            </div>
          )}
          {akun && akun.length > 0 && tampil.length === 0 && (
            <p className="muted">Tak ada akun yang cocok dengan "{cari.trim()}".</p>
          )}
          {tampil.length > 0 && (
            <div className="af-gulir aa-tbl-wrap">
              <table className="tbl aa-tbl aa-tbl-akun">
                {/* Lebar kolom dipatok px, bukan dibiarkan auto (§172 SAKTI):
                    dengan auto, "Tanpa jenjang" dan dropdown "Ikut jenjang"
                    pecah dua baris dan tinggi tiap baris jadi berbeda-beda.
                    Email sengaja jadi kolom penyerap — satu-satunya yang
                    panjangnya tak terduga. Σ kolom tetap = 1.026px (aksi
                    120→156 sejak tombol Reset akurasi jadi ikon ke-4), plus
                    jatah minimum Email 190px → min-width tabel 1.216px
                    (lihat .aa-tbl di AkunAdmin.css; kalau kolom di sini
                    berubah, angka itu WAJIB dihitung ulang, kalau tidak
                    kolom penyerap kolaps di layar sempit). */}
                <colgroup>
                  <col />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 156 }} />
                </colgroup>
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
                  {tampil.map((a) => {
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
                          {/* Jenjang bisa disetel langsung (bukan lagi teks mati):
                              kontributor baru kerap pantas mulai di atas Pemula, dan
                              menunggu perhitungan otomatis mengejar itu menghukum
                              orang yang sudah terbukti. Server tetap wasit kuotanya. */}
                          {berjenjang ? (
                            <>
                              <Dropdown
                                opsi={jenjangOpsi}
                                nilai={String(tier)}
                                ariaLabel={`Jenjang — ${a.email}`}
                                disabled={sedangProses || jenjangOpsi.length === 0}
                                onGanti={(n) => ubahProfil(a, { tier: Number(n) })}
                              />
                              {/* Akurasi direset (pendidikan, bukan hukuman): jendela
                                  hitung akurasi dimulai ulang dari tanggal ini, tapi
                                  jumlah setoran disetujui TETAP sepanjang masa —
                                  caption ini satu-satunya tempat yang menyebutkannya
                                  di tabel. */}
                              {a.akurasi_sejak && (
                                <div
                                  className="muted aa-nowrap"
                                  style={{ fontSize: 10, marginTop: 2 }}
                                  title={`Akurasi dihitung ulang sejak ${waktuManusiawi(a.akurasi_sejak)} — setoran disetujui sebelumnya tetap dihitung.`}
                                >
                                  akurasi sejak {waktuManusiawi(a.akurasi_sejak).split(',')[0]}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="muted aa-nowrap" title="Superadmin tidak dibatasi jenjang maupun kuota harian">
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
                        {/* Aksi jadi ikon saja: tiga tombol berteks memakan 300px per
                            baris dan membuat tabel menggulir sangat jauh di telepon.
                            Nama aksinya tetap terbaca lewat title (tetikus) dan
                            aria-label (pembaca layar) — yang hilang cuma lebarnya. */}
                        <td className="af-aksi">
                          <div className="aa-aksi ti-grup">
                            <TombolIkon
                              d={IKON_SURAT} ukuranIkon={13} disabled={sedangProses}
                              label="Ubah email" ariaLabel={`Ubah email — ${a.email}`}
                              onClick={() => setEmailTarget(a)}
                            />
                            <TombolIkon
                              d={IKON_KUNCI} ukuranIkon={13} disabled={sedangProses}
                              label="Atur ulang sandi" ariaLabel={`Atur ulang sandi — ${a.email}`}
                              onClick={() => setResetTarget(a)}
                            />
                            {/* Reset/batalkan akurasi — kontributor saja (superadmin
                                tidak berjenjang, tidak berarti apa-apa untuknya).
                                Satu tombol, dua aksi tergantung status: mereset
                                (wajib lewat modal konfirmasi, lihat FormResetAkurasi)
                                atau membatalkan reset yang sudah ada (langsung, sama
                                seperti sakelar Aktif/Beku di sebelah — reversibel,
                                tidak butuh konfirmasi). */}
                            {berjenjang && (
                              <TombolIkon
                                d={IKON_ULANG} ukuranIkon={13} disabled={sedangProses}
                                label={a.akurasi_sejak ? 'Batalkan reset akurasi' : 'Reset akurasi'}
                                ariaLabel={`${a.akurasi_sejak ? 'Batalkan reset akurasi' : 'Reset akurasi'} — ${a.email}`}
                                onClick={() => (a.akurasi_sejak ? ubahProfil(a, { akurasi_sejak: null }) : setResetAkurasiTarget(a))}
                              />
                            )}
                            <TombolIkon
                              d={IKON_TONG} nada="merah" ukuranIkon={13} disabled={sedangProses}
                              label="Hapus akun" ariaLabel={`Hapus akun — ${a.email}`}
                              onClick={() => setHapusTarget(a)}
                            />
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

      {resetAkurasiTarget && (
        <FormResetAkurasi
          akun={resetAkurasiTarget}
          onClose={() => setResetAkurasiTarget(null)}
          onSukses={(pesan) => {
            setToast({ ok: true, pesan })
            setResetAkurasiTarget(null)
            setMuat((m) => m + 1)
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
  const [lokal, setLokal] = useState('')
  const email = lokal ? `${lokal}${DOMAIN_AKUN}` : ''
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
      setErr(pesanGalat(e, 'Gagal membuat akun.'))
    } finally {
      setKirim(false)
    }
  }

  return (
    <ModalKecil className="af-form-modal" label="Tambah akun" onClose={() => { if (!kirim) onClose() }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <span className="lbl">Email</span>
          {/* Domainnya tempelan tetap, BUKAN teks yang ikut diketik. Menyisipkan
              "@papan.id" ke nilai input tiap ketikan akan melompatkan kursor ke
              ujung setiap kali orang membetulkan satu huruf di tengah. Yang
              diketik cuma bagian lokal; alamat utuhnya dirakit saat dikirim. */}
          <div className="aa-email">
            <input
              className="inp" required value={lokal} autoComplete="off"
              // Menempel alamat utuh tetap bekerja: bagian setelah @ dibuang,
              // karena domainnya toh sudah ditentukan.
              onChange={(e) => setLokal(e.target.value.split('@')[0].replace(/\s/g, ''))}
              placeholder="nama"
              aria-label={`Bagian nama email, sebelum ${DOMAIN_AKUN}`}
            />
            <span className="aa-email-dom">{DOMAIN_AKUN}</span>
            <TombolSalin teks={email} judul="Salin alamat email lengkap" />
          </div>
        </div>
        <KolomSandi label="Sandi awal" nilai={sandi} onGanti={setSandi}
          placeholder="Minimal 8 karakter" autoComplete="new-password" />
        {/* Sandi awal dibacakan lewat WhatsApp, jadi bentuknya harus bisa
            diucapkan: <Nama><4 digit>. Nama diambil dari alias kalau sudah
            diisi, kalau belum dari bagian lokal email. */}
        <BarisBuatkanSandi
          nama={alias.trim() || lokal}
          onBuat={setSandi}
          disabled={kirim}
        />
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
  /** null = angka dampak belum sampai; tombol hapus ditahan sampai ada, supaya
   *  keputusan tak pernah diambil tanpa tahu berapa yang ikut terbawa. */
  const [dampak, setDampak] = useState<{ total: number; disetujui: number } | null>(null)

  useEffect(() => {
    let batal = false
    hitungSetoranAkun(akun.id)
      .then((d) => !batal && setDampak(d))
      .catch(() => !batal && setDampak({ total: -1, disetujui: -1 }))
    return () => {
      batal = true
    }
  }, [akun.id])

  async function hapus() {
    setKirim(true)
    setErr('')
    try {
      const hasil = await hapusAkun(akun.id)
      onSukses(`Akun ${hasil.email} dihapus.`)
    } catch (e) {
      setErr(pesanGalat(e, 'Gagal menghapus akun.'))
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
      {/* Yang hilang bersama akunnya tidak bisa ditebak dari kalimat
          "dihapus permanen" — rantai `on delete cascade` di basis data
          membawa lebih banyak daripada yang orang bayangkan. */}
      <div className="aa-dampak">
        <span className="lbl">Yang ikut terhapus</span>
        <ul>
          <li>
            <b>
              {dampak === null ? 'menghitung…' : dampak.total < 0 ? 'gagal dihitung' : `${dampak.total} setoran`}
            </b>
            {dampak !== null && dampak.total > 0 && ` (${dampak.disetujui} sudah disetujui)`} — seluruh riwayat
            kontribusinya, termasuk yang sudah masuk edisi terbit
          </li>
          <li>Notifikasi & akses khusus yang pernah diberikan ke akun ini</li>
          <li>Kredit jenjang dan akurasinya — tak bisa dipulihkan dengan membuat akun bernama sama</li>
        </ul>
        <span className="lbl" style={{ marginTop: 6 }}>Yang TETAP tinggal</span>
        <ul>
          <li>Berkas screenshot di penyimpanan — jadi yatim, tanpa baris yang merujuknya</li>
          <li>Tulisannya di Forum dan jejak aksesnya — tetap ada, cuma kehilangan nama penulis</li>
          <li>PDF edisi yang sudah terbit — dirakit dari angka hasil transkripsi, bukan dari akun ini</li>
        </ul>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 11 }}>
          Kalau tujuannya cuma menghentikan akses, <b>nonaktifkan</b> saja — semua di atas tetap utuh.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn-p af-btn-keluar" disabled={kirim || dampak === null} onClick={hapus}>
          {kirim ? 'Menghapus…' : 'Ya, Hapus Permanen'}
        </button>
        <button type="button" className="dd-btn" disabled={kirim} onClick={onClose}>Batal</button>
      </div>
      {err && <p className="af-err" style={{ margin: 0 }}>{err}</p>}
    </ModalKecil>
  )
}

/**
 * Modal konfirmasi "Reset akurasi" (pendidikan, bukan hukuman — permintaan
 * Johan: kontributor bisa belajar dari kesalahan dan naik jenjang lagi lewat
 * kurasi yang baik). Berbeda dari FormHapusAkun, tindakan ini REVERSIBEL —
 * tombol "Batalkan reset" di baris tabel mengembalikannya kapan pun — jadi
 * modalnya menegaskan itu, bukan menakut-nakuti seperti modal hapus.
 */
function FormResetAkurasi({ akun, onClose, onSukses }: { akun: AkunRow; onClose: () => void; onSukses: (pesan: string) => void }) {
  const [kirim, setKirim] = useState(false)
  const [err, setErr] = useState('')

  async function konfirmasi() {
    setKirim(true)
    setErr('')
    try {
      await setProfil(akun.id, { akurasi_sejak: new Date().toISOString() })
      onSukses(`Akurasi ${akun.alias || akun.email} dihitung ulang.`)
    } catch (e) {
      setErr(pesanGalat(e, 'Gagal mereset akurasi.'))
    } finally {
      setKirim(false)
    }
  }

  return (
    <ModalKecil label={`Reset akurasi — ${akun.alias || akun.email}`} onClose={() => { if (!kirim) onClose() }}>
      <p style={{ margin: 0, fontSize: 12.5 }}>
        Akurasi <b>{akun.alias || akun.email}</b> akan dihitung ulang <b>mulai sekarang</b> — kontributor akan
        dikabari lewat notifikasi bahwa catatan lamanya tidak lagi membebani.
      </p>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text2)', display: 'grid', gap: 3 }}>
        <li>Riwayat setoran <b>tidak dihapus</b> — semuanya tetap tersimpan apa adanya.</li>
        <li>Jumlah setoran <b>disetujui tetap dihitung penuh</b>, sepanjang masa — kerja yang sudah diakui tidak hilang.</li>
        <li>Tindakan ini <b>bisa dibatalkan</b> kapan pun lewat tombol "Batalkan reset" di baris yang sama.</li>
      </ul>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn-p" disabled={kirim} onClick={konfirmasi}>
          {kirim ? 'Menyimpan…' : 'Ya, Reset Akurasi'}
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
      setErr(pesanGalat(e, 'Gagal mengatur ulang sandi.'))
    } finally {
      setKirim(false)
    }
  }

  return (
    <ModalKecil label={`Atur ulang sandi — ${akun.email}`} onClose={() => { if (!kirim) onClose() }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <KolomSandi label="Sandi baru" nilai={sandi} onGanti={setSandi}
          placeholder="Minimal 8 karakter" autoComplete="new-password" />
        {/* Mengisi kedua kolom sekaligus: konfirmasi yang diketik ulang manual
            dari sandi yang baru saja dibuatkan tidak menguji apa pun. */}
        <BarisBuatkanSandi
          nama={akun.alias?.trim() || akun.email.split('@')[0]}
          onBuat={(s) => { setSandi(s); setKonfirmasi(s) }}
          disabled={kirim}
        />
        <KolomSandi label="Konfirmasi sandi" nilai={konfirmasi} onGanti={setKonfirmasi}
          autoComplete="new-password" />
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
      setErr(pesanGalat(e, 'Gagal mengubah email.'))
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
