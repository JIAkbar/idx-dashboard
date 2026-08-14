import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  IkonMenu,
  IKON_CENTANG,
  IKON_GAMBAR,
  IKON_KOTAK_ARSIP,
  IKON_PAPAN_KLIP,
  IKON_PERINGATAN,
  IKON_SILANG,
  IKON_TAMBAH,
  IKON_TONG,
} from '../components/dasbor/IkonMenu'
import { DatePicker } from '../components/dasbor/DatePicker'
import { StockAutocomplete } from '../components/dasbor/StockAutocomplete'
import { LightboxGambar, type GambarLightbox } from '../components/dasbor/LightboxGambar'
import { useStockIndex } from '../lib/dasbor/stockDetailData'
import {
  daftarScreenshot,
  daftarTanggalUnggahan,
  hapusScreenshot,
  unggahScreenshot,
  urlScreenshots,
} from '../lib/supabaseEdisi'
import { useBulletinList } from '../lib/dasbor/bulletin'
import './AdminHome.css'

/** Kunci sessionStorage modal sambutan — nilai = user.id supaya login akun
 *  lain (atau login ulang setelah keluar) memunculkan sambutan lagi. */
const KUNCI_SAMBUTAN = 'papan-sambutan'

/** Sapaan menurut jam lokal — dipakai header modal sambutan. */
function sapaan(): string {
  const j = new Date().getHours()
  if (j < 11) return 'Selamat pagi'
  if (j < 15) return 'Selamat siang'
  if (j < 19) return 'Selamat sore'
  return 'Selamat malam'
}

function tanggalHariIni(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** ISO `YYYY-MM-DD` → "Kamis, 13 Agu 2026" (judul panggung utama). */
function tanggalManusiawi(iso: string): string {
  const [t, b, d] = iso.split('-').map(Number)
  if (!t || !b || !d) return iso
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(t, b - 1, d).getDay()]
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][b - 1]
  return `${hari}, ${d} ${bulan} ${t}`
}

/** Jumlah kartu Kotak Masuk yang tampil sebelum tombol "Tampilkan semua". */
const BATAS_KARTU = 8

/** Ukuran berkas manusiawi — "348 KB", "1,2 MB". */
function ukuranBerkas(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

interface Baris {
  ticker: string
  /** Path lengkap di bucket ({tanggal}/{TICKER}-orderbook.ext) — dipakai tombol hapus. */
  orderbook?: string
  chart?: string
}

/** Keterangan aksi saat emiten yang dipilih di form sudah punya unggahan
 *  (upsert eksplisit, #100) — orderbook selalu wajib dipilih ulang tiap
 *  submit (validasi tak berubah) jadi selalu dianggap diganti; chart cuma
 *  disebut kalau memang ada perubahan (dipilih baru / dipertahankan). */
function pesanAksiDuplikat(existing: Baris, chartFile: File | null): string {
  if (chartFile) {
    return existing.chart
      ? 'unggahan baru akan MENGGANTIKAN yang lama.'
      : 'orderbook lama akan diganti, chart baru akan melengkapi (bukan mengganti orderbook).'
  }
  return existing.chart
    ? 'orderbook lama akan diganti; chart lama tetap dipertahankan.'
    : 'unggahan baru akan MENGGANTIKAN yang lama.'
}

function rangkumBerkas(paths: string[]): Baris[] {
  const map = new Map<string, Baris>()
  for (const p of paths) {
    const nama = p.split('/').pop() ?? ''
    const m = /^([A-Z0-9]+)-(orderbook|chart)\./.exec(nama)
    if (!m) continue
    const [, ticker, jenis] = m
    const baris = map.get(ticker) ?? { ticker }
    if (jenis === 'orderbook') baris.orderbook = p
    else baris.chart = p
    map.set(ticker, baris)
  }
  return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker))
}

/** Blok kosong seragam utk panel tanpa isi — pola fd-empty StockDetail.tsx,
 *  padding diperkecil karena di sini dia hidup di dalam panel, bukan satu
 *  halaman penuh. */
function PanelKosong({ ikon, pesan, petunjuk }: { ikon: string; pesan: string; petunjuk?: string }) {
  return (
    <div className="fd-empty" style={{ padding: '28px 16px' }}>
      <p style={{ marginBottom: 8 }}><IkonMenu d={ikon} size={26} /></p>
      <p>{pesan}</p>
      {petunjuk && <p style={{ fontSize: 10, marginTop: 6 }}>{petunjuk}</p>}
    </div>
  )
}

/**
 * Kontrol unggah gambar pengganti input file native ("Choose File" tidak ikut
 * tema). Input aslinya disembunyikan, tombol bergaya Lantai memicunya; setelah
 * berkas terpilih tampil thumbnail + nama + tombol buang. Validasi jenis
 * berkas di sini (batas kepercayaan form): non-gambar ditolak dengan error
 * inline, parent hanya pernah menerima File gambar valid atau null.
 *
 * Heuristik orientasi (non-blokir): orderbook Stockbit umumnya memanjang ke
 * bawah, chart TradingView melebar — kalau orientasinya kebalik, tampil
 * peringatan kuning tapi unggah tetap boleh (heuristik bisa salah; isi gambar
 * sesungguhnya diverifikasi di tahap transkripsi).
 */
function PilihGambar({ label, jenis, file, onFile, onPratinjau }: {
  label: string
  jenis: 'orderbook' | 'chart'
  file: File | null
  onFile: (f: File | null) => void
  /** Klik thumbnail → lightbox pratinjau besar (object URL lokal, pra-unggah). */
  onPratinjau: (g: GambarLightbox) => void
}) {
  const [err, setErr] = useState('')
  const [warn, setWarn] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) {
      setUrl(null)
      setWarn('')
      return
    }
    const u = URL.createObjectURL(file)
    setUrl(u)
    // ponytail: heuristik cuma rasio lebar/tinggi — deteksi konten beneran
    // terjadi di tahap transkripsi, bukan di client.
    const img = new Image()
    img.onload = () => {
      const melebar = img.naturalWidth > img.naturalHeight
      if (jenis === 'orderbook' && melebar) {
        setWarn('Gambar ini melebar — screenshot orderbook Stockbit biasanya memanjang ke bawah. Periksa lagi; tetap bisa diunggah.')
      } else if (jenis === 'chart' && !melebar) {
        setWarn('Gambar ini memanjang ke bawah — chart TradingView biasanya melebar. Periksa lagi; tetap bisa diunggah.')
      } else {
        setWarn('')
      }
    }
    img.src = u
    return () => URL.revokeObjectURL(u)
  }, [file, jenis])

  function pilih(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (f && !f.type.startsWith('image/')) {
      setErr('Berkas harus berupa gambar (PNG/JPG/WebP).')
      e.target.value = ''
      onFile(null)
      return
    }
    setErr('')
    onFile(f)
  }

  function buang() {
    if (inputRef.current) inputRef.current.value = ''
    setErr('')
    onFile(null)
  }

  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={pilih} />
      {!file ? (
        <button type="button" className="dd-btn af-pilih" onClick={() => inputRef.current?.click()}>
          <IkonMenu d={IKON_GAMBAR} size={14} /> Pilih gambar…
        </button>
      ) : (
        <div className="af-file">
          {url && (
            <button
              type="button"
              className="af-file-thumb"
              title="Klik untuk pratinjau besar"
              onClick={() => onPratinjau({
                src: url,
                keterangan: `${jenis === 'orderbook' ? 'Orderbook' : 'Chart'} · ${file.name} (belum diunggah)`,
              })}
            >
              <img src={url} alt={`Pratinjau ${jenis}: ${file.name}`} />
            </button>
          )}
          <div className="af-file-baris">
            <span className="nama" title={file.name}>{file.name}</span>
            <span className="uk">{ukuranBerkas(file.size)}</span>
            <button type="button" className="buang" aria-label="Buang pilihan" onClick={buang}>
              <IkonMenu d={IKON_SILANG} size={12} />
            </button>
          </div>
        </div>
      )}
      {err && <p className="af-err">{err}</p>}
      {warn && <p className="af-warn"><IkonMenu d={IKON_PERINGATAN} size={12} /> {warn}</p>}
    </div>
  )
}

/** Kerangka modal kecil — pola visual sama dengan LoginModal (.dasbor-modal-bg
 *  + .dasbor-modal + .panel), Escape & klik latar menutup. */
function ModalKecil({ label, onClose, className, children }: { label: string; onClose: () => void; className?: string; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dasbor-modal-bg" onClick={onClose}>
      <div className={`lantai dasbor-modal${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="panel">
          <div className="panel-h"><span className="lbl">{label}</span></div>
          <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Halaman admin Arus Pasar — SATU halaman (route /admin), gabungan bekas
 * AdminHome + Unggah (#39): upload screenshot, kotak masuk (tanggal yang
 * sudah punya upload), dan rak terbitan tampil sekaligus, tanpa sub-page.
 *
 * Sejak #41 dirender DI DALAM <DasborLayout> (rail kiri tetap tampil, entri
 * Admin di kaki rail menyala saat aktif) — jadi tak perlu lagi bungkus
 * .dasbor-shell sendiri ataupun tombol "← Dasbor". Guard auth tetap di
 * App.tsx (ProtectedRoute membungkus route ini di dalam grup layout).
 *
 * Tata letak: .admin-view (cap lebar, lantai.css — pola .kalkulator-view),
 * grid2 dua kolom di layar lebar (kiri form unggah, kanan status hari ini),
 * rak terbitan lebar penuh di bawah. grid2 fluid, jatuh satu kolom di telepon.
 */
export function AdminHome() {
  const { session, signOut } = useAuth()
  const { index } = useStockIndex()

  // Rak terbitan baca manifest publik keluaran/index.json (sumber sama dengan
  // halaman Bulletin) — BUKAN tabel Supabase `edisi` (alur lama, kosong):
  // edisi dirakit dari repo, tabel itu tidak pernah diisi pipeline sekarang.
  const { daftar: edisi, error: err } = useBulletinList()
  const [tanggalUnggahan, setTanggalUnggahan] = useState<string[] | null>(null)

  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const [ticker, setTicker] = useState('')
  const [orderbook, setOrderbook] = useState<File | null>(null)
  const [chart, setChart] = useState<File | null>(null)
  const [sudah, setSudah] = useState<Baris[]>([])
  const [formErr, setFormErr] = useState('')
  /** Modal form "Tambah Emiten" — aksi CRUD selalu modal (konsisten pola proyek). */
  const [formBuka, setFormBuka] = useState(false)
  const [mengunggah, setMengunggah] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  /** Counter pemicu muat ulang daftar (naik setelah unggah/hapus sukses). */
  const [muat, setMuat] = useState(0)

  const [toast, setToast] = useState<{ ok: boolean; pesan: string } | null>(null)
  const [sambut, setSambut] = useState(false)
  const [konfirmKeluar, setKonfirmKeluar] = useState(false)
  /** Baris yang sedang minta konfirmasi hapus (modal) — satu atau banyak (hapus massal). */
  const [hapusTarget, setHapusTarget] = useState<Baris[] | null>(null)
  const [menghapus, setMenghapus] = useState(false)
  /** Ticker tercentang utk hapus massal di tabel "Sudah diunggah". */
  const [pilih, setPilih] = useState<Set<string>>(new Set())
  /** Jumlah emiten terunggah per tanggal — kartu ringkasan Kotak Masuk. */
  const [jumlahEmiten, setJumlahEmiten] = useState<Record<string, number>>({})
  /** Kotak Masuk: tampilkan semua kartu (default hanya BATAS_KARTU terbaru). */
  const [semuaKartu, setSemuaKartu] = useState(false)
  /** Lightbox pratinjau gambar (#94) — items + posisi; null = tertutup. */
  const [lightbox, setLightbox] = useState<{ items: GambarLightbox[]; index: number } | null>(null)

  // Modal sambutan sekali per sesi login: kunci sessionStorage berisi user.id,
  // dihapus saat keluar — login ulang (atau akun lain) menyambut lagi,
  // navigasi bolak-balik ke /admin dalam sesi sama tidak.
  useEffect(() => {
    if (session && sessionStorage.getItem(KUNCI_SAMBUTAN) !== session.user.id) setSambut(true)
  }, [session])

  // Escape menutup modal sambutan (markup-nya custom, tidak lewat ModalKecil).
  useEffect(() => {
    if (!sambut) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (session) sessionStorage.setItem(KUNCI_SAMBUTAN, session.user.id)
        setSambut(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sambut, session])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    let batal = false
    daftarTanggalUnggahan()
      .then((tgl) => !batal && setTanggalUnggahan(tgl))
      .catch(() => !batal && setTanggalUnggahan([]))
    return () => {
      batal = true
    }
  }, [muat])

  useEffect(() => {
    let batal = false
    setPilih(new Set())
    daftarScreenshot(tanggal)
      .then((paths) => !batal && setSudah(rangkumBerkas(paths)))
      .catch(() => !batal && setSudah([]))
    return () => {
      batal = true
    }
  }, [tanggal, muat])

  // Anti-basi (#101): tiap kali modal "Tambah Emiten" dibuka, muat ulang
  // daftar unggahan tanggal ini — supaya chip duplikat & badge saran
  // selalu berdasar kondisi server terkini, termasuk unggahan admin lain.
  useEffect(() => {
    if (!formBuka) return
    let batal = false
    daftarScreenshot(tanggal)
      .then((paths) => !batal && setSudah(rangkumBerkas(paths)))
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [formBuka, tanggal])

  // Jumlah emiten per tanggal utk kartu Kotak Masuk.
  // ponytail: satu request list per tanggal (jumlah folder masih kecil);
  // ganti agregat sisi server kalau tanggalnya sudah puluhan.
  useEffect(() => {
    if (!tanggalUnggahan || tanggalUnggahan.length === 0) {
      setJumlahEmiten({})
      return
    }
    let batal = false
    Promise.all(
      tanggalUnggahan.map(async (tgl) => {
        const paths = await daftarScreenshot(tgl).catch(() => [] as string[])
        return [tgl, rangkumBerkas(paths).length] as const
      })
    ).then((pairs) => !batal && setJumlahEmiten(Object.fromEntries(pairs)))
    return () => {
      batal = true
    }
  }, [tanggalUnggahan])

  const tanggalSudahTerbit = new Set(edisi?.map((r) => r.tanggal))
  /** Emiten aktif di form yang sudah punya unggahan di tanggal ini — dasar
   *  afordans upsert (chip keterangan + label tombol PERBARUI). */
  const kodeAktif = ticker.trim().toUpperCase()
  const existingBaris = kodeAktif ? sudah.find((b) => b.ticker === kodeAktif) : undefined

  function tutupSambutan() {
    if (session) sessionStorage.setItem(KUNCI_SAMBUTAN, session.user.id)
    setSambut(false)
  }

  async function keluar() {
    sessionStorage.removeItem(KUNCI_SAMBUTAN)
    await signOut()
  }

  function bersihkan() {
    setTicker('')
    setOrderbook(null)
    setChart(null)
    setFormErr('')
    setResetKey((k) => k + 1)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ticker.trim() || !orderbook) {
      setFormErr('Emiten dan screenshot orderbook wajib diisi.')
      return
    }
    setMengunggah(true)
    setFormErr('')
    try {
      const kode = ticker.trim().toUpperCase()
      const adaSebelum = sudah.some((b) => b.ticker === kode)
      await unggahScreenshot(orderbook, tanggal, kode, 'orderbook')
      if (chart) await unggahScreenshot(chart, tanggal, kode, 'chart')
      setToast({
        ok: true,
        pesan: adaSebelum ? `${kode} diperbarui · ${chart ? 2 : 1} gambar` : `${kode} · ${chart ? 2 : 1} gambar tersimpan`,
      })
      bersihkan()
      setFormBuka(false)
      setMuat((m) => m + 1)
    } catch (err) {
      setToast({ ok: false, pesan: err instanceof Error ? err.message : 'Gagal unggah.' })
    } finally {
      setMengunggah(false)
    }
  }

  async function jalankanHapus(target: Baris[]) {
    setMenghapus(true)
    try {
      await hapusScreenshot(target.flatMap((b) => [b.orderbook, b.chart].filter((p): p is string => Boolean(p))))
      setToast({
        ok: true,
        pesan: target.length === 1
          ? `${target[0].ticker} dihapus dari ${tanggal}`
          : `${target.length} emiten dihapus dari ${tanggal}`,
      })
      setMuat((m) => m + 1)
    } catch (err) {
      setToast({ ok: false, pesan: err instanceof Error ? err.message : 'Gagal hapus.' })
    } finally {
      setMenghapus(false)
      setHapusTarget(null)
    }
  }

  /**
   * Buka lightbox dari tabel "Sudah Diunggah": kumpulkan SEMUA gambar tanggal
   * ini (urut per emiten, orderbook lalu chart) supaya ‹ › bisa jalan antar
   * gambar emiten yang sama maupun antar emiten, lalu minta signed URL batch
   * (bucket privat) dan mulai dari gambar yang diklik.
   */
  async function bukaPratinjau(path: string) {
    const tglPendek = tanggalManusiawi(tanggal).replace(/^[^,]+, /, '')
    const entri = sudah.flatMap((b) =>
      [
        b.orderbook ? { path: b.orderbook, ket: `${b.ticker} · Orderbook · ${tglPendek}` } : null,
        b.chart ? { path: b.chart, ket: `${b.ticker} · Chart · ${tglPendek}` } : null,
      ].filter((x): x is { path: string; ket: string } => x !== null)
    )
    try {
      const urls = await urlScreenshots(entri.map((e) => e.path))
      const ada = entri.filter((e) => urls[e.path])
      if (ada.length === 0) throw new Error('URL gambar tidak tersedia.')
      setLightbox({
        items: ada.map((e) => ({ src: urls[e.path], keterangan: e.ket })),
        index: Math.max(0, ada.findIndex((e) => e.path === path)),
      })
    } catch {
      setToast({ ok: false, pesan: 'Gagal memuat pratinjau gambar.' })
    }
  }

  function togglePilih(ticker: string) {
    setPilih((p) => {
      const q = new Set(p)
      if (q.has(ticker)) q.delete(ticker)
      else q.add(ticker)
      return q
    })
  }

  return (
    <div className="lantai admin-view">
      <div className="vhead" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Arus Pasar</h1>
          <span className="sub">Area admin — unggah &amp; kelola edisi</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          <span className="muted">{session?.user.email}</span>
          <button type="button" className="dd-btn" onClick={() => setKonfirmKeluar(true)}>Keluar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <section className="panel">
          <div className="panel-h" style={{ alignItems: 'center' }}>
            <span className="af-judul">Sudah Diunggah — <b className="tgl">{tanggalManusiawi(tanggal)}</b></span>
            <button type="button" className="btn-p af-tambah" onClick={() => setFormBuka(true)}>
              <IkonMenu d={IKON_TAMBAH} size={13} /> Tambah Emiten
            </button>
          </div>
          <div className="panel-b">
              {sudah.length === 0 && (
                <PanelKosong
                  ikon={IKON_PAPAN_KLIP}
                  pesan={`Belum ada unggahan untuk ${tanggal}.`}
                  petunjuk="Klik tombol Tambah Emiten untuk mengunggah screenshot orderbook tanggal ini."
                />
              )}
              {sudah.length > 0 && (
                <>
                  <p className="muted" style={{ marginTop: 0, fontSize: 11 }}>
                    {sudah.length} emiten terunggah untuk tanggal ini.
                  </p>
                  {pilih.size > 0 && (
                    <div className="af-aksibar">
                      <span>{pilih.size} emiten dipilih</span>
                      <button
                        type="button"
                        className="dd-btn merah"
                        onClick={() => setHapusTarget(sudah.filter((b) => pilih.has(b.ticker)))}
                      >
                        <IkonMenu d={IKON_TONG} size={12} /> Hapus
                      </button>
                    </div>
                  )}
                  <div className="af-gulir">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th className="af-kolcek">
                            <input
                              type="checkbox"
                              className="af-cek"
                              aria-label="Pilih semua emiten"
                              checked={sudah.length > 0 && pilih.size === sudah.length}
                              ref={(el) => { if (el) el.indeterminate = pilih.size > 0 && pilih.size < sudah.length }}
                              onChange={(e) => setPilih(e.target.checked ? new Set(sudah.map((b) => b.ticker)) : new Set())}
                            />
                          </th>
                          <th>Emiten</th>
                          <th>Orderbook</th>
                          <th>Chart</th>
                          <th className="af-aksi">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sudah.map((b) => (
                          <tr key={b.ticker}>
                            <td className="af-kolcek">
                              <input
                                type="checkbox"
                                className="af-cek"
                                aria-label={`Pilih ${b.ticker}`}
                                checked={pilih.has(b.ticker)}
                                onChange={() => togglePilih(b.ticker)}
                              />
                            </td>
                            <td className="tick">{b.ticker}</td>
                            <td>
                              {b.orderbook ? (
                                <button
                                  type="button"
                                  className="af-centang af-lihat"
                                  title={`Lihat screenshot orderbook ${b.ticker}`}
                                  aria-label={`Lihat screenshot orderbook ${b.ticker}`}
                                  onClick={() => bukaPratinjau(b.orderbook!)}
                                >
                                  <IkonMenu d={IKON_CENTANG} size={13} />
                                  <span className="lihat-lbl">Lihat</span>
                                </button>
                              ) : '—'}
                            </td>
                            <td>
                              {b.chart ? (
                                <button
                                  type="button"
                                  className="af-centang af-lihat"
                                  title={`Lihat screenshot chart ${b.ticker}`}
                                  aria-label={`Lihat screenshot chart ${b.ticker}`}
                                  onClick={() => bukaPratinjau(b.chart!)}
                                >
                                  <IkonMenu d={IKON_CENTANG} size={13} />
                                  <span className="lihat-lbl">Lihat</span>
                                </button>
                              ) : '—'}
                            </td>
                            <td className="af-aksi">
                              <button
                                type="button"
                                className="af-hapus"
                                title={`Hapus unggahan ${b.ticker}`}
                                aria-label={`Hapus unggahan ${b.ticker}`}
                                onClick={() => setHapusTarget([b])}
                              >
                                <IkonMenu d={IKON_TONG} size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-h"><span className="lbl">Kotak masuk</span></div>
            <div className="panel-b">
              <p className="muted" style={{ marginTop: 0, fontSize: 11 }}>
                Antrean tanggal yang punya unggahan &amp; menunggu dirakit jadi edisi —
                klik kartu untuk pindah ke tanggal itu.
              </p>
              {tanggalUnggahan === null && <p className="muted">Memuat…</p>}
              {tanggalUnggahan && tanggalUnggahan.length === 0 && (
                <PanelKosong
                  ikon={IKON_KOTAK_ARSIP}
                  pesan="Belum ada tanggal dengan unggahan."
                  petunjuk="Tanggal yang sudah punya screenshot akan berbaris di sini."
                />
              )}
              {tanggalUnggahan && tanggalUnggahan.length > 0 && (() => {
                // Menunggu didahulukan (tanggal terbaru dulu), Selesai belakangan;
                // default cuma BATAS_KARTU kartu supaya puluhan hari tidak
                // memenuhi layar — sisanya di balik "Tampilkan semua".
                const urut = [...tanggalUnggahan].sort((a, b) => {
                  const sa = tanggalSudahTerbit.has(a) ? 1 : 0
                  const sb = tanggalSudahTerbit.has(b) ? 1 : 0
                  return sa - sb || b.localeCompare(a)
                })
                const tampil = semuaKartu ? urut : urut.slice(0, BATAS_KARTU)
                return (
                  <>
                    <div className="af-kartu-wrap">
                      {tampil.map((tgl) => (
                        <button
                          key={tgl}
                          type="button"
                          className={`vcard af-kartu${tgl === tanggal ? ' aktif' : ''}`}
                          onClick={() => setTanggal(tgl)}
                          title="Pilih tanggal ini sebagai panggung unggahan"
                        >
                          <span className="v-num" style={{ fontSize: 15 }}>{tgl}</span>
                          <span className="v-note">
                            {jumlahEmiten[tgl] !== undefined ? `${jumlahEmiten[tgl]} emiten · ` : ''}
                            {tanggalSudahTerbit.has(tgl) ? 'Selesai' : 'Menunggu'}
                          </span>
                        </button>
                      ))}
                    </div>
                    {urut.length > BATAS_KARTU && (
                      <button
                        type="button"
                        className="dd-btn"
                        style={{ marginTop: 10 }}
                        onClick={() => setSemuaKartu((v) => !v)}
                      >
                        {semuaKartu ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${urut.length})`}
                      </button>
                    )}
                  </>
                )
              })()}
            </div>
          </section>

          <section className="panel">
        <div className="panel-h"><span className="lbl">Rak terbitan</span></div>
        <div className="panel-b">
          <p className="muted" style={{ marginTop: 0, fontSize: 11 }}>
            Arsip edisi bulletin yang sudah dirakit dari unggahan.
          </p>
          {err && <p className="muted" style={{ color: 'var(--red)' }}>Gagal memuat daftar: {err}</p>}
          {edisi && edisi.length === 0 && (
            <PanelKosong
              ikon={IKON_KOTAK_ARSIP}
              pesan="Belum ada edisi terbit."
              petunjuk="Edisi yang sudah dirakit dari unggahan akan tampil di rak ini."
            />
          )}
          {edisi && edisi.length > 0 && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th className="r">Emiten</th>
                  <th className="r">PDF</th>
                </tr>
              </thead>
              <tbody>
                {edisi.map((r) => (
                  <tr key={r.kode}>
                    <td>
                      <span className="tick">{r.kode}</span>
                      {r.update_dari != null && r.emiten.length > r.update_dari && (
                        <span
                          className="bchip"
                          title={`Dirilis ulang: ${r.update_dari} menjadi ${r.emiten.length} emiten`}
                          style={{
                            marginLeft: 6, fontFamily: 'var(--mono)', fontWeight: 700,
                            background: 'var(--amber-dim)', color: 'var(--amber)', borderColor: 'var(--amber)',
                          }}
                        >
                          Update {r.update_dari}→{r.emiten.length}
                        </span>
                      )}
                    </td>
                    <td>{r.tanggal_id}</td>
                    <td><span className="chip up">terbit</span></td>
                    <td className="r num">{r.emiten.length}</td>
                    <td className="r">
                      <a
                        className="blt-dl"
                        href={`/arus-pasar/keluaran/${r.pdf}`}
                        target="_blank"
                        rel="noopener"
                        title={`Buka ${r.pdf}`}
                      >
                        Lihat
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
        </section>
      </div>

      {formBuka && (
        <ModalKecil className="af-form-modal" label="Tambah emiten — unggah screenshot" onClose={() => { if (!mengunggah) setFormBuka(false) }}>
          <p className="muted" style={{ margin: 0, fontSize: 11 }}>
            Orderbook wajib, chart opsional. Jenis berkas diperiksa saat dipilih;
            isi gambar diverifikasi saat transkripsi.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
            <div className="field">
              <span className="lbl">Tanggal</span>
              <DatePicker value={tanggal} onChange={setTanggal} />
            </div>
            <div className="field">
              <span className="lbl">Emiten</span>
              <StockAutocomplete
                stocks={index?.stocks ?? []}
                value={ticker}
                onChange={setTicker}
                onSelect={setTicker}
                placeholder="Ketik kode / nama emiten…"
                tandai={new Set(sudah.map((b) => b.ticker))}
              />
              {existingBaris && (
                <p className="af-dup">
                  <IkonMenu d={IKON_PERINGATAN} size={12} />
                  <span>
                    <b>{existingBaris.ticker}</b> sudah terunggah (orderbook {existingBaris.orderbook ? '✓' : '—'}, chart {existingBaris.chart ? '✓' : '—'}) — {pesanAksiDuplikat(existingBaris, chart)}
                  </span>
                </p>
              )}
            </div>
            <PilihGambar
              key={`ob-${resetKey}`}
              label="Orderbook (Stockbit) — wajib"
              jenis="orderbook"
              file={orderbook}
              onFile={setOrderbook}
              onPratinjau={(g) => setLightbox({ items: [g], index: 0 })}
            />
            <PilihGambar
              key={`ch-${resetKey}`}
              label="Chart (TradingView) — opsional"
              jenis="chart"
              file={chart}
              onFile={setChart}
              onPratinjau={(g) => setLightbox({ items: [g], index: 0 })}
            />
            <button type="submit" className="btn-p" disabled={mengunggah}>
              {mengunggah ? (existingBaris ? 'Memperbarui…' : 'Mengunggah…') : (existingBaris ? 'Perbarui' : 'Unggah')}
            </button>
            {formErr && <p className="af-err" style={{ margin: 0 }}>{formErr}</p>}
          </form>
        </ModalKecil>
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
                {session?.user.email && (
                  <p style={{ margin: 0, fontSize: 12.5 }}>
                    Masuk sebagai <b>{session.user.email}</b>.
                  </p>
                )}
                <div className="af-sambut-stat">
                  <div>
                    <span className="num">{tanggalUnggahan === null ? '—' : tanggalUnggahan.filter((t) => !tanggalSudahTerbit.has(t)).length}</span>
                    <span className="lbl">Tanggal menunggu</span>
                  </div>
                  <div>
                    <span className="num">{sudah.length}</span>
                    <span className="lbl">Emiten hari ini</span>
                  </div>
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55 }}>
                  Unggah screenshot orderbook harian, pantau antrean di kotak masuk,
                  dan kelola rak terbitan Arus Pasar dari halaman ini.
                </p>
                <button type="button" className="btn-p" style={{ width: '100%' }} onClick={tutupSambutan}>Mulai</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {hapusTarget && hapusTarget.length > 0 && (
        <ModalKecil
          label={hapusTarget.length === 1 ? `Hapus unggahan ${hapusTarget[0].ticker}?` : `Hapus ${hapusTarget.length} unggahan?`}
          onClose={() => { if (!menghapus) setHapusTarget(null) }}
        >
          <p style={{ margin: 0, fontSize: 12.5 }}>
            {hapusTarget.length === 1 ? (
              <>
                Screenshot {hapusTarget[0].orderbook && hapusTarget[0].chart ? 'orderbook & chart' : hapusTarget[0].orderbook ? 'orderbook' : 'chart'}{' '}
                <b>{hapusTarget[0].ticker}</b> untuk {tanggal} akan dihapus permanen dari penyimpanan.
              </>
            ) : (
              <>
                Screenshot <b>{hapusTarget.map((b) => b.ticker).join(', ')}</b> untuk {tanggal} akan
                dihapus permanen dari penyimpanan.
              </>
            )}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-p af-btn-keluar" disabled={menghapus} onClick={() => jalankanHapus(hapusTarget)}>
              {menghapus ? 'Menghapus…' : 'Hapus'}
            </button>
            <button type="button" className="dd-btn" disabled={menghapus} onClick={() => setHapusTarget(null)}>Batal</button>
          </div>
        </ModalKecil>
      )}

      {konfirmKeluar && (
        <ModalKecil label="Akhiri sesi?" onClose={() => setKonfirmKeluar(false)}>
          <p style={{ margin: 0, fontSize: 12.5 }}>
            Keluar dari akun <b>{session?.user.email}</b>?
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
