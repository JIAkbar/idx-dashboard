import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type RefObject } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProfilSaya, type ProfilSaya } from '../../lib/profilSaya'
import { useAdminTanggal } from '../../context/AdminTanggalContext'
import { namaTampil } from '../../lib/namaTampil'
import { daftarJenjang, hitungRingkasanSetoranSaya, ringkasanJenjang, type JenjangRow } from '../../lib/jenjang'
import { ambilKuotaSaya } from '../../lib/kuotaSaya'
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
} from '../../components/dasbor/IkonMenu'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { LightboxGambar, type GambarLightbox } from '../../components/dasbor/LightboxGambar'
import { AlasanField } from '../../components/dasbor/AlasanField'
import { ModalKecil } from '../../components/dasbor/ModalKecil'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { ALASAN_MIN, alasanValid } from '../../lib/alasanValidasi'
import { rangkumBerkas, type Baris as BarisDasar } from '../../lib/dasbor/screenshotBaris'
import {
  daftarScreenshot,
  daftarSetoran,
  daftarTanggalUnggahan,
  hapusScreenshot,
  hitungSetoranSaya,
  kurasiSetoran,
  pernahMenyetor,
  ubahAlasanSetoran,
  unggahScreenshot,
  urlScreenshots,
  type SetoranRow,
  type StatusSetoran,
} from '../../lib/supabaseEdisi'
import { useBulletinList } from '../../lib/dasbor/bulletin'
import { TolakModal } from './KurasiSetoran'
import { PanduanScreenshot } from './PanduanScreenshot'
import './AdminShared.css'
import { pesanGalat } from '../../lib/pesanGalat'

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

interface Baris extends BarisDasar {
  /** Baris `setoran` (Fase 3) utk orderbook/chart di atas, kalau ada — unggahan
   *  dari sebelum Fase 3 tidak punya padanan, jadi ini bisa undefined. */
  setoranOb?: SetoranRow
  setoranCh?: SetoranRow
}

/** Status gabungan orderbook+chart satu emiten — ditolak menang (paling perlu
 *  perhatian), lalu menunggu, baru disetujui. undefined kalau kedua baris
 *  setoran-nya tidak ada (unggahan lama, sebelum Fase 3). */
function statusGabungan(b: Baris): StatusSetoran | undefined {
  const s = [b.setoranOb?.status, b.setoranCh?.status].filter((x): x is StatusSetoran => x !== undefined)
  if (s.includes('ditolak')) return 'ditolak'
  if (s.includes('menunggu')) return 'menunggu'
  if (s.includes('disetujui')) return 'disetujui'
  return undefined
}

/**
 * Sel berkas: thumbnail kalau URL-nya sudah ada, centang kalau belum.
 *
 * Gambar kecil menjawab pertanyaan yang centang tak bisa jawab — "yang
 * terunggah tadi benar screenshot orderbook, atau salah berkas?". Menemukan
 * salah unggah butuh membuka lightbox satu per satu; dengan thumbnail,
 * kekeliruan terlihat sambil lalu.
 *
 * Centang tetap jadi keadaan awal (dan cadangan kalau URL gagal) supaya
 * tabelnya tidak terlihat rusak selama URL bertanda tangan masih diambil.
 */
function SelBerkas({ path, url, judul, onBuka }: {
  path?: string; url?: string; judul: string; onBuka: (p: string) => void
}) {
  if (!path) return <>—</>
  return (
    <button
      type="button"
      className={url ? 'af-thumb' : 'af-centang af-lihat'}
      title={`Lihat screenshot ${judul}`}
      aria-label={`Lihat screenshot ${judul}`}
      onClick={() => onBuka(path)}
    >
      {url
        ? <img src={url} alt="" loading="lazy" />
        : <><IkonMenu d={IKON_CENTANG} size={13} /><span className="lihat-lbl">Lihat</span></>}
    </button>
  )
}

const LABEL_STATUS: Record<StatusSetoran, string> = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' }
const KELAS_STATUS: Record<StatusSetoran, string> = { menunggu: 'warn', disetujui: 'up', ditolak: 'dn' }

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

/** Galat RLS/kebijakan storage (backend Fase 1, #100) datang sebagai teks
 *  generik Postgres ("new row violates row-level security policy…") tanpa
 *  sebutkan alasan spesifik — server sengaja tak membocorkan detail kebijakan.
 *  Di sini diterjemahkan jadi kalimat yang menyebut semua kemungkinan
 *  penyebab (kuota habis / emiten sudah ada / tanggal masa depan / tanpa
 *  izin) alih-alih menampilkan istilah teknis mentah ke pengguna. */
function terjemahkanGalatUnggah(pesan: string): string {
  const p = pesan.toLowerCase()
  if (p.includes('row-level security') || p.includes('violates') || p.includes('policy') || p.includes('permission denied') || p.includes('403')) {
    return 'Unggahan ditolak server — kemungkinan kuota harian sudah habis, emiten ini sudah disetor akun lain, tanggalnya di masa depan, atau kamu tidak punya izin untuk jenis unggahan ini.'
  }
  return pesan
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

/**
 * Kurasi cepat kolom Status (superadmin saja, #item2) — badge chip jadi
 * tombol pemicu popover Setujui/Tolak, beroperasi atas SEMUA baris `setoran`
 * (orderbook+chart) emiten ini. Pola klik-luar-menutup sama dengan
 * Dropdown.tsx, tapi ditulis lokal karena Dropdown itu pemilih NILAI —
 * di sini tombolnya memicu AKSI, bukan mengganti state terpilih.
 */
function StatusAksi({ status, catatan, paths, onSetujui, onTolak }: {
  status: StatusSetoran
  catatan?: string
  paths: string[]
  onSetujui: (paths: string[]) => void
  onTolak: (paths: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className={`dd af-status-dd${open ? ' open' : ''}`} ref={ref}>
      <button
        type="button"
        className="af-status-trigger"
        title={status === 'ditolak' ? catatan || 'Ditolak kurator (tanpa catatan).' : 'Klik untuk kurasi cepat'}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`chip ${KELAS_STATUS[status]}`}>{LABEL_STATUS[status]}</span>
      </button>
      <div className="dd-menu" role="menu">
        <button type="button" className="dd-it" role="menuitem" style={{ gap: 6 }} onClick={() => { setOpen(false); onSetujui(paths) }}>
          <IkonMenu d={IKON_CENTANG} size={12} /> Setujui
        </button>
        <button type="button" className="dd-it merah" role="menuitem" style={{ gap: 6 }} onClick={() => { setOpen(false); onTolak(paths) }}>
          <IkonMenu d={IKON_SILANG} size={12} /> Tolak
        </button>
      </div>
    </div>
  )
}

/** Modal "Ubah alasan" — kontributor menyunting alasan barisnya sendiri
 *  selama status masih `menunggu` (server jadi wasit sesungguhnya, ini cuma
 *  UX). `entries` = baris `setoran` yang ikut diperbarui (orderbook & chart
 *  emiten yang sama biasanya disetor bersamaan dgn alasan yang sama). */
function EditAlasanModal({ ticker, entries, onClose, onSukses }: {
  ticker: string
  entries: SetoranRow[]
  onClose: () => void
  onSukses: () => void
}) {
  const [nilai, setNilai] = useState(entries[0]?.alasan ?? '')
  const [kirim, setKirim] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!alasanValid(nilai, false)) {
      setErr(`Alasan minimal ${ALASAN_MIN} karakter.`)
      return
    }
    setKirim(true)
    setErr('')
    try {
      await Promise.all(entries.map((s) => ubahAlasanSetoran(s.path, nilai.trim())))
      onSukses()
    } catch (e) {
      setErr(pesanGalat(e, 'Gagal menyimpan alasan.'))
    } finally {
      setKirim(false)
    }
  }

  return (
    <ModalKecil label={`Ubah alasan — ${ticker}`} onClose={() => { if (!kirim) onClose() }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <AlasanField value={nilai} onChange={setNilai} superadmin={false} />
        <button type="submit" className="btn-p" disabled={kirim}>{kirim ? 'Menyimpan…' : 'Simpan'}</button>
        {err && <p className="af-err" style={{ margin: 0 }}>{err}</p>}
      </form>
    </ModalKecil>
  )
}

/**
 * Kartu ringkas jenjang kontributor (Fase 6) — jenjang sekarang, kuota
 * efektif, jumlah setoran disetujui, akurasi (disetujui ÷ dikurasi), dan
 * sisa setoran menuju jenjang berikutnya. Angka setoran dari tabel `setoran`
 * MILIK SENDIRI (RLS sudah membatasi) — tak ada parameter tanggal, ini
 * rekap SEMUA WAKTU, beda dari tabel "Sudah Diunggah" di bawah yang per
 * tanggal panggung.
 */
function KartuJenjang({ profil, superadmin }: { profil: ProfilSaya; superadmin: boolean }) {
  const [jenjang, setJenjang] = useState<JenjangRow[] | null>(null)
  const [angka, setAngka] = useState<{ disetujui: number; ditolak: number } | null>(null)

  useEffect(() => {
    let batal = false
    Promise.all([daftarJenjang(), hitungRingkasanSetoranSaya()])
      .then(([j, a]) => {
        if (!batal) {
          setJenjang(j)
          setAngka(a)
        }
      })
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [])

  if (!jenjang || jenjang.length === 0 || !angka) return null
  const r = ringkasanJenjang(profil.tier ?? 0, profil.kuota_manual ?? null, angka.disetujui, angka.ditolak, jenjang)

  return (
    <section className="panel">
      <div className="panel-h"><span className="lbl">Jenjang kontributor</span></div>
      <div className="panel-b" style={{ display: 'flex', flexWrap: 'wrap', gap: 22, fontSize: 12.5 }}>
        {/* Superadmin tidak berjenjang: `kuota_saya()` di server mengecualikannya,
            jadi menampilkan "Perunggu · 2/hari" untuknya menyebut angka yang tidak
            pernah dipakai — dan bertabrakan dengan "50/hari" di header halaman
            yang sama. Kolom tier di basis data tetap terisi (dihitung dari
            setorannya sendiri), cuma tidak berarti apa-apa untuk peran ini. */}
        <div>
          <span className="muted" style={{ fontSize: 10 }}>JENJANG</span><br />
          {superadmin ? (
            <span className="muted" title="Superadmin tidak dibatasi jenjang maupun kuota harian">Tanpa jenjang</span>
          ) : (
            <><b>{r.jenjangSaatIni.nama}</b> <span className="muted">(tier {r.jenjangSaatIni.tier})</span></>
          )}
        </div>
        <div>
          <span className="muted" style={{ fontSize: 10 }}>KUOTA EFEKTIF</span><br />
          <b>{superadmin ? Math.max(profil.kuota_harian, 50) : r.kuotaEfektif}/hari</b>
        </div>
        <div>
          <span className="muted" style={{ fontSize: 10 }}>SETORAN DISETUJUI</span><br />
          <b>{r.disetujui}</b>
        </div>
        <div>
          <span className="muted" style={{ fontSize: 10 }}>AKURASI</span><br />
          <b>{r.akurasiPersen == null ? '—' : `${Math.round(r.akurasiPersen)}%`}</b>
        </div>
        <div>
          <span className="muted" style={{ fontSize: 10 }}>MENUJU JENJANG BERIKUTNYA</span><br />
          {superadmin ? (
            <span className="muted">Jenjang tidak membatasi kuota superadmin.</span>
          ) : !r.berikutnya ? (
            <span className="muted">Sudah di jenjang tertinggi.</span>
          ) : (
            <b>
              {r.kurangSetoran > 0
                ? `${r.kurangSetoran} setoran disetujui lagi`
                : r.akurasiCukup
                  ? 'Syarat volume & akurasi terpenuhi'
                  : `Akurasi belum cukup (butuh ${r.berikutnya.min_akurasi}%)`}
              {' '}→ {r.berikutnya.nama}
            </b>
          )}
        </div>
      </div>
    </section>
  )
}

/** Berapa baris tabel yang tampak sebelum harus digulir. */
const BARIS_TAMPIL = 10

/**
 * Pangkas tinggi wadah tabel supaya persis memuat kepala kolom + sepuluh baris.
 *
 * Diukur dari baris yang benar-benar terender, bukan dari angka piksel tetap:
 * tinggi baris di tabel ini tidak seragam-tertebak — sel Alasan boleh
 * membungkus, dan ukuran huruf ikut zoom peramban serta setelan skala sistem.
 * Menebak "10 × 46px" benar di satu layar dan meleset di layar berikutnya.
 *
 * Batasnya dipasang sebagai maxHeight inline, jadi menang atas nilai cadangan
 * di CSS (yang tetap dipakai kalau JavaScript belum sempat mengukur).
 */
function useTinggiSepuluhBaris(
  wadah: RefObject<HTMLDivElement | null>,
  jumlahBaris: number
) {
  useLayoutEffect(() => {
    const el = wadah.current
    if (!el) return
    if (jumlahBaris <= BARIS_TAMPIL) {
      el.style.maxHeight = ''
      return
    }

    function ukur() {
      const w = wadah.current
      const tabel = w?.querySelector('table')
      if (!w || !tabel) return
      const kepala = tabel.tHead?.getBoundingClientRect().height ?? 0
      const baris = Array.from(tabel.tBodies[0]?.rows ?? []).slice(0, BARIS_TAMPIL)
      if (baris.length < BARIS_TAMPIL) return
      const tinggi = baris.reduce((n, r) => n + r.getBoundingClientRect().height, 0)
      // Bulatkan ke bawah: kelebihan setengah piksel memunculkan potongan
      // baris ke-11 di tepi bawah, persis yang mau dihindari.
      w.style.maxHeight = `${Math.floor(kepala + tinggi)}px`
    }

    ukur()
    // Lebar berubah -> sel Alasan bisa membungkus -> tinggi baris berubah.
    const pengamat = new ResizeObserver(ukur)
    pengamat.observe(el)
    return () => pengamat.disconnect()
  }, [wadah, jumlahBaris])
}

/**
 * Tab "Unggah" (/admin, index) — form Tambah Emiten (upload screenshot) +
 * tabel "Sudah Diunggah" tanggal aktif + Kotak Masuk (tanggal yang sudah
 * punya upload). Rak terbitan/Radar/Bedah/Kurasi/Akun sekarang tab
 * terpisah (#shell-tab) — header & tab bar dirender AdminLayout, di sini
 * cuma isi panelnya.
 */
export function UnggahHarian() {
  const { session } = useAuth()
  const { profil } = useProfilSaya()
  const { index } = useStockIndex()
  const { tanggal, setTanggal } = useAdminTanggal()
  const [searchParams, setSearchParams] = useSearchParams()

  // Kotak Masuk baca manifest publik keluaran/index.json (sumber sama dengan
  // halaman Bulletin) — dipakai cuma utk tandai tanggal "Selesai" vs
  // "Menunggu" (rak terbitannya sendiri sudah pindah ke tab Terbitan).
  const { daftar: edisi } = useBulletinList()
  const [tanggalUnggahan, setTanggalUnggahan] = useState<string[] | null>(null)

  const [ticker, setTicker] = useState('')
  const [orderbook, setOrderbook] = useState<File | null>(null)
  const [chart, setChart] = useState<File | null>(null)
  const [alasan, setAlasan] = useState('')
  const [sudah, setSudah] = useState<Baris[]>([])
  /** Baris `setoran` (Fase 3) tanggal aktif — digabung ke `sudah` (lihat
   *  `sudahMerged`) utk badge status & alasan di tabel "Sudah Diunggah". */
  const [setoranTanggal, setSetoranTanggal] = useState<SetoranRow[] | null>(null)
  const [formErr, setFormErr] = useState('')
  /** Modal form "Tambah Emiten" — aksi CRUD selalu modal (konsisten pola proyek). */
  const [formBuka, setFormBuka] = useState(false)
  const [mengunggah, setMengunggah] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  /** Counter pemicu muat ulang daftar (naik setelah unggah/hapus sukses). */
  const [muat, setMuat] = useState(0)

  const [toast, setToast] = useState<{ ok: boolean; pesan: string } | null>(null)
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
  /** Emiten yang alasannya sedang disunting (modal, Fase 3) — null = tertutup. */
  const [editAlasanTarget, setEditAlasanTarget] = useState<Baris | null>(null)
  /** Modal "kuota habis" (#item1) — angka dipakai isi pesan, null = tertutup. */
  const [kuotaHabis, setKuotaHabis] = useState<{ terpakai: number; batas: number } | null>(null)
  /** Kunci tombol "Tambah Emiten" selagi kuota dicek ke server. */
  const [cekKuota, setCekKuota] = useState(false)
  /** Path setoran yang sedang minta catatan penolakan (kurasi cepat, #item2) — null = tertutup. */
  const [tolakTarget, setTolakTarget] = useState<string[] | null>(null)
  /** Default buka/tutup panel "Cara screenshot orderbook" (Fase 5) — null
   *  selagi belum dicek (dianggap tertutup sampai jawabannya datang, tidak
   *  ada kedip terbuka-lalu-tertutup). true = akun ini belum pernah menyetor. */
  const [panduanDefaultBuka, setPanduanDefaultBuka] = useState<boolean | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  // Cuma dicek SEKALI saat mount — panel tak boleh melompat terbuka/tertutup
  // sendiri selagi pengguna sedang menyetor di sesi yang sama.
  useEffect(() => {
    let batal = false
    pernahMenyetor()
      .then((v) => !batal && setPanduanDefaultBuka(!v))
      .catch(() => !batal && setPanduanDefaultBuka(false))
    return () => {
      batal = true
    }
  }, [])

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

  // Baris `setoran` (Fase 3) tanggal aktif — badge status + alasan di tabel.
  // Unggahan sebelum Fase 3 tidak punya padanan setoran; sudahMerged
  // menangani itu (setoranOb/setoranCh jadi undefined, bukan galat).
  useEffect(() => {
    let batal = false
    daftarSetoran(tanggal)
      .then((rows) => !batal && setSetoranTanggal(rows))
      .catch(() => !batal && setSetoranTanggal([]))
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

  // Sinyal "buka form Tambah Emiten" dari modal peringatan hampir-beku
  // (AdminLayout.tsx, tombol "Setor sekarang") — query `?tambah=1` dibaca
  // sekali lalu dibuang dari URL supaya refresh/kembali tidak membuka form
  // lagi. klikTambahEmiten() tetap lewat jalur normal (cek kuota dulu).
  useEffect(() => {
    if (searchParams.get('tambah') !== '1') return
    setSearchParams({}, { replace: true })
    klikTambahEmiten()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- klikTambahEmiten stabil cukup lewat closure sekali render mount
  }, [searchParams])

  const tanggalSudahTerbit = new Set(edisi?.map((r) => r.tanggal))
  /** Emiten aktif di form yang sudah punya unggahan di tanggal ini — dasar
   *  afordans upsert (chip keterangan + label tombol PERBARUI). */
  const kodeAktif = ticker.trim().toUpperCase()
  const existingBaris = kodeAktif ? sudah.find((b) => b.ticker === kodeAktif) : undefined
  const hariIni = tanggalHariIni()
  /** Kontributor (bukan superadmin) TIDAK boleh menimpa emiten yang sudah
   *  disetor siapa pun untuk tanggal ini (#101) — beda dari perilaku lama
   *  (upsert bebas) yang cuma masuk akal selagi hanya ada satu admin.
   *  Superadmin tetap boleh menimpa/perbarui seperti sebelumnya. */
  const kontributor = profil?.peran === 'kontributor'
  const superadmin = profil?.peran === 'superadmin'

  // "Sudah Diunggah" digabung dgn baris setoran tanggal ini (Fase 3) — dasar
  // kolom Alasan & Status. Path tanpa padanan setoran (unggahan sebelum Fase
  // 3) tetap tampil, cuma tanpa badge (setoranOb/setoranCh undefined).
  const sudahMerged = useMemo<Baris[]>(() => {
    if (!setoranTanggal) return sudah
    const byPath = new Map(setoranTanggal.map((s) => [s.path, s]))
    return sudah.map((b) => ({
      ...b,
      setoranOb: b.orderbook ? byPath.get(b.orderbook) : undefined,
      setoranCh: b.chart ? byPath.get(b.chart) : undefined,
    }))
  }, [sudah, setoranTanggal])

  /** Thumbnail tabel. URL bertanda tangan kedaluwarsa satu jam, jadi disimpan
   *  per-tanggal dan ditarik ulang tiap tanggalnya berganti — bukan di-cache
   *  selamanya, yang akan berakhir sebagai deretan gambar rusak. */
  const [thumb, setThumb] = useState<Record<string, string>>({})
  useEffect(() => {
    let batal = false
    const paths = sudahMerged.flatMap((b) => [b.orderbook, b.chart].filter((p): p is string => !!p))
    if (paths.length === 0) { setThumb({}); return }
    urlScreenshots(paths)
      .then((u) => !batal && setThumb(u))
      // Gagal ambil URL bukan kondisi galat: tabelnya tetap berguna tanpa
      // gambar kecil, dan tombol "Lihat" punya jalurnya sendiri.
      .catch(() => !batal && setThumb({}))
    return () => { batal = true }
  }, [sudahMerged])

  const wadahTabel = useRef<HTMLDivElement>(null)
  useTinggiSepuluhBaris(wadahTabel, sudahMerged.length)

  /** Baris boleh dihapus/dicentang pengguna sekarang: superadmin selalu boleh;
   *  kontributor cuma kalau dia penyetor baris ini (orderbook diutamakan,
   *  chart jadi fallback). Server (policy storage `hapus_screenshots`) adalah
   *  wasit sesungguhnya — ini cuma UX supaya tabel tak menawarkan aksi yang
   *  pasti ditolak. Baris tanpa padanan setoran (unggahan sebelum Fase 3)
   *  diperlakukan sebagai BUKAN milik kontributor mana pun. */
  function bolehHapusBaris(b: Baris): boolean {
    if (superadmin) return true
    const penyetorId = b.setoranOb?.penyetor ?? b.setoranCh?.penyetor
    return penyetorId !== undefined && penyetorId === session?.user.id
  }
  const bolehHapusRows = sudahMerged.filter(bolehHapusBaris)

  /** Path setoran `menunggu` di antara baris tercentang — dasar tombol "Setujui/
   *  Tolak terpilih" (#item2, superadmin). Cuma entri berstatus menunggu yang
   *  ikut disentuh; entri emiten yang sama tapi sudah dikurasi dilewati. */
  const pathsPilihMenunggu = superadmin
    ? sudahMerged
        .filter((b) => pilih.has(b.ticker))
        .flatMap((b) => [b.setoranOb, b.setoranCh].filter((s): s is SetoranRow => !!s && s.status === 'menunggu').map((s) => s.path))
    : []

  function bersihkan() {
    setTicker('')
    setOrderbook(null)
    setChart(null)
    setAlasan('')
    setFormErr('')
    setResetKey((k) => k + 1)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ticker.trim() || !orderbook) {
      setFormErr('Emiten dan screenshot orderbook wajib diisi.')
      return
    }
    if (tanggal > hariIni) {
      setFormErr('Tanggal ini di masa depan — orderbook masa depan tidak diterima.')
      return
    }
    if (!alasanValid(alasan, superadmin)) {
      setFormErr(`Alasan wajib diisi, minimal ${ALASAN_MIN} karakter.`)
      return
    }
    const kode = ticker.trim().toUpperCase()
    const adaSebelum = sudah.some((b) => b.ticker === kode)
    if (kontributor && adaSebelum) {
      setFormErr(`${kode} sudah disetor akun lain untuk ${tanggalManusiawi(tanggal)} — pilih emiten lain.`)
      return
    }
    setMengunggah(true)
    setFormErr('')
    try {
      const alasanKirim = alasan.trim()
      await unggahScreenshot(orderbook, tanggal, kode, 'orderbook', alasanKirim)
      if (chart) await unggahScreenshot(chart, tanggal, kode, 'chart', alasanKirim)
      setToast({
        ok: true,
        pesan: adaSebelum ? `${kode} diperbarui · ${chart ? 2 : 1} gambar` : `${kode} · ${chart ? 2 : 1} gambar tersimpan`,
      })
      bersihkan()
      setFormBuka(false)
      setMuat((m) => m + 1)
    } catch (err) {
      setToast({ ok: false, pesan: terjemahkanGalatUnggah(pesanGalat(err, 'Gagal unggah.')) })
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
      setToast({ ok: false, pesan: pesanGalat(err, 'Gagal hapus.') })
    } finally {
      setMenghapus(false)
      setHapusTarget(null)
    }
  }

  /** Cek kuota SEBELUM buka form Tambah Emiten (#item1) — kontributor yang
   *  jatahnya habis dapat modal jelas di sini, bukan galat generik server
   *  sesudah isi form lengkap. Superadmin tidak pernah dicek (kuota 50 +
   *  server sudah mengecualikan superadmin dari batas ini). Gagal cek di
   *  client (mis. jaringan) tidak menghalangi — server tetap wasit akhir. */
  async function klikTambahEmiten() {
    if (superadmin) {
      setFormBuka(true)
      return
    }
    setCekKuota(true)
    try {
      // Batas dari server (kuota_saya()), BUKAN kolom kuota_harian: kolom itu
      // peninggalan Fase 1 dan sejak Fase 6 bukan lagi kuota efektif, jadi
      // memakainya di sini memblokir kontributor pada angka yang lebih rendah
      // daripada yang sebenarnya diizinkan server.
      const [batas, terpakai] = await Promise.all([ambilKuotaSaya(), hitungSetoranSaya(tanggal)])
      // batas null = server tidak menjawab; jangan tebak 0 — biarkan lanjut,
      // submit tetap ditolak server kalau memang habis.
      if (batas != null && terpakai >= batas) {
        setKuotaHabis({ terpakai, batas })
        return
      }
    } catch {
      // ponytail: gagal cek kuota di client — biarkan lanjut, submit tetap ditolak server kalau memang habis.
    } finally {
      setCekKuota(false)
    }
    setFormBuka(true)
  }

  /** Kurasi cepat dari tabel "Sudah Diunggah" (#item2, superadmin) — pakai
   *  ulang kurasiSetoran() yang sama dgn tab Kurasi, tak ada logika baru. */
  async function setujuiBaris(paths: string[]) {
    try {
      await kurasiSetoran(paths, 'disetujui')
      setToast({ ok: true, pesan: paths.length === 1 ? '1 setoran disetujui.' : `${paths.length} setoran disetujui.` })
      setPilih(new Set())
      setMuat((m) => m + 1)
    } catch (err) {
      setToast({ ok: false, pesan: pesanGalat(err, 'Gagal menyetujui.') })
    }
  }

  async function tolakBaris(paths: string[], catatan: string) {
    try {
      await kurasiSetoran(paths, 'ditolak', catatan)
      setToast({ ok: true, pesan: paths.length === 1 ? '1 setoran ditolak.' : `${paths.length} setoran ditolak.` })
      setPilih(new Set())
      setTolakTarget(null)
      setMuat((m) => m + 1)
    } catch (err) {
      setToast({ ok: false, pesan: pesanGalat(err, 'Gagal menolak.') })
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
    <>
      {profil && <KartuJenjang profil={profil} superadmin={superadmin} />}

      {panduanDefaultBuka !== null && <PanduanScreenshot superadmin={superadmin} defaultBuka={panduanDefaultBuka} />}

      <section className="panel">
        <div className="panel-h" style={{ alignItems: 'center' }}>
          <span className="af-judul">Sudah Diunggah — <b className="tgl">{tanggalManusiawi(tanggal)}</b></span>
          <button type="button" className="btn-p af-tambah" disabled={cekKuota} onClick={klikTambahEmiten}>
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
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {pathsPilihMenunggu.length > 0 && (
                      <>
                        <button type="button" className="dd-btn" onClick={() => setujuiBaris(pathsPilihMenunggu)}>
                          <IkonMenu d={IKON_CENTANG} size={12} /> Setujui terpilih
                        </button>
                        <button type="button" className="dd-btn merah" onClick={() => setTolakTarget(pathsPilihMenunggu)}>
                          <IkonMenu d={IKON_SILANG} size={12} /> Tolak terpilih
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="dd-btn merah"
                      onClick={() => setHapusTarget(sudah.filter((b) => pilih.has(b.ticker)))}
                    >
                      <IkonMenu d={IKON_TONG} size={12} /> Hapus
                    </button>
                  </div>
                </div>
              )}
              {/* Lebih dari 10 baris digulir di dalam wadahnya (kepala kolom
                  menempel) — tanggal ramai seperti 13 Agu punya 22 emiten dan
                  mendorong panel di bawahnya jauh ke luar layar. Tingginya
                  DIUKUR dari baris yang benar-benar tampil (lihat
                  useTinggiSepuluhBaris), bukan angka piksel tetap. */}
              <div
                ref={wadahTabel}
                className={`af-gulir af-gulir-flex${sudahMerged.length > 10 ? ' af-gulir-cap' : ''}`}
              >
                <table className="tbl af-tbl">
                  <colgroup>
                    <col style={{ width: '3%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '38%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '9%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="af-kolcek">
                        <input
                          type="checkbox"
                          className="af-cek"
                          aria-label="Pilih semua emiten yang bisa dihapus"
                          checked={bolehHapusRows.length > 0 && pilih.size === bolehHapusRows.length}
                          ref={(el) => { if (el) el.indeterminate = pilih.size > 0 && pilih.size < bolehHapusRows.length }}
                          onChange={(e) => setPilih(e.target.checked ? new Set(bolehHapusRows.map((b) => b.ticker)) : new Set())}
                        />
                      </th>
                      <th>Emiten</th>
                      <th>Penyetor</th>
                      <th>Alasan</th>
                      <th className="af-c">Orderbook</th>
                      <th className="af-c">Chart</th>
                      <th className="af-c">Status</th>
                      <th className="af-aksi">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sudahMerged.map((b) => {
                      const status = statusGabungan(b)
                      const catatan = b.setoranOb?.catatan_kurator || b.setoranCh?.catatan_kurator || undefined
                      const alasanTeks = (b.setoranOb?.alasan || b.setoranCh?.alasan || '').trim()
                      const entriesSendiri = [b.setoranOb, b.setoranCh].filter(
                        (s): s is SetoranRow => !!s && s.penyetor === session?.user.id && s.status === 'menunggu'
                      )
                      const boleh = bolehHapusBaris(b)
                      const judulKunci = 'Hanya penyetor berkas ini atau superadmin yang bisa menghapusnya.'
                      // Berkasnya ada tapi baris setorannya tidak sampai ke
                      // sini: bagi superadmin (yang RLS-nya melihat semua) itu
                      // benar-benar unggahan pra-Fase 3; bagi kontributor itu
                      // hampir pasti milik orang lain — RLS `setoran_baca`
                      // memang cuma memberi baris miliknya sendiri. Tanpa
                      // dibedakan, tiga kolom "—" berturut-turut terbaca
                      // sebagai data rusak, bukan sebagai batas kewenangan.
                      const milikOrangLain = !superadmin && !b.setoranOb && !b.setoranCh && !!b.orderbook
                      return (
                        <tr key={b.ticker}>
                          <td className="af-kolcek">
                            <input
                              type="checkbox"
                              className="af-cek"
                              aria-label={`Pilih ${b.ticker}`}
                              checked={pilih.has(b.ticker)}
                              disabled={!boleh}
                              title={boleh ? undefined : judulKunci}
                              onChange={() => togglePilih(b.ticker)}
                            />
                          </td>
                          <td className="tick">{b.ticker}</td>
                          <td className="muted" style={{ fontSize: 11 }}>
                            {milikOrangLain
                              ? <span className="af-lain" title="Nama penyetor hanya terlihat oleh dirinya sendiri dan superadmin.">Kontributor lain</span>
                              : namaTampil(b.setoranOb?.profil ?? b.setoranCh?.profil, null)}
                          </td>
                          <td className="af-alasan-sel">
                           <div className="af-alasan-bungkus">
                            <span
                              className="af-alasan-teks"
                              title={milikOrangLain ? 'Alasan hanya terlihat oleh penyetornya sendiri.' : alasanTeks || undefined}
                            >
                              {alasanTeks || '—'}
                            </span>
                            {entriesSendiri.length > 0 && (
                              <button
                                type="button"
                                className="af-alasan-edit"
                                title={`Ubah alasan ${b.ticker}`}
                                aria-label={`Ubah alasan ${b.ticker}`}
                                onClick={() => setEditAlasanTarget(b)}
                              >
                                Ubah
                              </button>
                            )}
                           </div>
                          </td>
                          <td className="af-c">
                            <SelBerkas path={b.orderbook} url={b.orderbook ? thumb[b.orderbook] : undefined}
                              judul={`orderbook ${b.ticker}`} onBuka={bukaPratinjau} />
                          </td>
                          <td className="af-c">
                            <SelBerkas path={b.chart} url={b.chart ? thumb[b.chart] : undefined}
                              judul={`chart ${b.ticker}`} onBuka={bukaPratinjau} />
                          </td>
                          <td className="af-c">
                            {status ? (
                              superadmin ? (
                                <StatusAksi
                                  status={status}
                                  catatan={catatan}
                                  paths={[b.setoranOb?.path, b.setoranCh?.path].filter((p): p is string => Boolean(p))}
                                  onSetujui={setujuiBaris}
                                  onTolak={(paths) => setTolakTarget(paths)}
                                />
                              ) : (
                                <span className={`chip ${KELAS_STATUS[status]}`} title={status === 'ditolak' ? catatan || 'Ditolak kurator (tanpa catatan).' : undefined}>
                                  {LABEL_STATUS[status]}
                                </span>
                              )
                            ) : milikOrangLain ? (
                              // Bukan "—". Yang perlu diketahui kontributor lain
                              // cuma satu: emiten ini sudah diambil, jangan
                              // dikerjakan lagi. Statusnya sendiri (menunggu /
                              // disetujui / ditolak) sengaja tak disebut — itu
                              // urusan penyetornya dengan kurator.
                              <span className="chip" title="Emiten ini sudah disetor kontributor lain untuk tanggal ini.">Sudah disetor</span>
                            ) : (
                              <span className="muted" style={{ fontSize: 10.5 }} title="Unggahan sebelum Fase 3 — tanpa data kurasi.">—</span>
                            )}
                          </td>
                          <td className="af-aksi">
                            <button
                              type="button"
                              className="af-hapus"
                              title={boleh ? `Hapus unggahan ${b.ticker}` : judulKunci}
                              aria-label={`Hapus unggahan ${b.ticker}`}
                              disabled={!boleh}
                              onClick={() => setHapusTarget([b])}
                            >
                              <IkonMenu d={IKON_TONG} size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
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

      {formBuka && (
        <ModalKecil className="af-form-modal" label="Tambah emiten — unggah screenshot" onClose={() => { if (!mengunggah) setFormBuka(false) }}>
          <p className="muted" style={{ margin: 0, fontSize: 11 }}>
            Orderbook wajib, chart opsional. Jenis berkas diperiksa saat dipilih;
            isi gambar diverifikasi saat transkripsi.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
            <div className="field">
              <span className="lbl">Tanggal</span>
              <DatePicker value={tanggal} onChange={setTanggal} maks={hariIni} />
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 10.5 }}>Orderbook masa depan tidak diterima.</p>
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
                labelTanda="sudah ada"
              />
              {existingBaris && (
                <p className="af-dup">
                  <IkonMenu d={IKON_PERINGATAN} size={12} />
                  <span>
                    {kontributor ? (
                      <>
                        <b>{existingBaris.ticker}</b> sudah disetor akun lain untuk {tanggalManusiawi(tanggal)} — pilih emiten lain.
                      </>
                    ) : (
                      <>
                        <b>{existingBaris.ticker}</b> sudah terunggah (orderbook {existingBaris.orderbook ? '✓' : '—'}, chart {existingBaris.chart ? '✓' : '—'}) — {pesanAksiDuplikat(existingBaris, chart)}
                      </>
                    )}
                  </span>
                </p>
              )}
            </div>
            <AlasanField value={alasan} onChange={setAlasan} superadmin={superadmin} />
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
            <button
              type="submit"
              className="btn-p"
              disabled={mengunggah || (kontributor && Boolean(existingBaris)) || !alasanValid(alasan, superadmin)}
            >
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

      {editAlasanTarget && (
        <EditAlasanModal
          ticker={editAlasanTarget.ticker}
          entries={[editAlasanTarget.setoranOb, editAlasanTarget.setoranCh].filter(
            (s): s is SetoranRow => !!s && s.penyetor === session?.user.id && s.status === 'menunggu'
          )}
          onClose={() => setEditAlasanTarget(null)}
          onSukses={() => {
            setToast({ ok: true, pesan: `Alasan ${editAlasanTarget.ticker} diperbarui.` })
            setEditAlasanTarget(null)
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

      {kuotaHabis && (
        <ModalKecil label="Jatah hari ini sudah habis" onClose={() => setKuotaHabis(null)}>
          <p style={{ margin: 0, fontSize: 12.5 }}>
            Kamu sudah menyetor <b>{kuotaHabis.terpakai} dari {kuotaHabis.batas}</b> orderbook untuk {tanggalManusiawi(tanggal)}.
          </p>
          <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>
            Jatah baru terbuka untuk tanggal berikutnya, atau minta tambahan ke superadmin.
          </p>
          <button type="button" className="btn-p" style={{ width: '100%' }} onClick={() => setKuotaHabis(null)}>Tutup</button>
        </ModalKecil>
      )}

      {tolakTarget && (
        <TolakModal
          jumlah={tolakTarget.length}
          onClose={() => setTolakTarget(null)}
          onKirim={(catatan) => tolakBaris(tolakTarget, catatan)}
        />
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
    </>
  )
}
