/**
 * Statistik berkala IDX — rekap satu PEKAN bursa (dan nanti satu BULAN),
 * dipanen dari terbitan resmi IDX Weekly Statistics.
 *
 * Kenapa halaman sendiri, bukan ditempel ke halaman harian: seluruh isi
 * berkas ini berpasangan "periode lalu vs periode ini" — rata-rata harian,
 * IHSG, net asing, gainers/losers, indeks global semuanya sudah membawa
 * pembandingnya sendiri dari sumbernya. Pembandingan itulah nilai tambahnya,
 * dan ia tak ada di layar harian mana pun.
 *
 * PENTING — pembanding TIDAK dihitung ulang di sini. `minggu_lalu` di dalam
 * berkas adalah pembanding versi IDX sendiri; arsip kita punya lubang (mis.
 * pekan 16-17 Maret cuma dua hari bursa), jadi "edisi sebelumnya di daftar"
 * belum tentu sama dengan "minggu lalu" menurut IDX. Menghitung ulang dari
 * berkas tetangga akan memberi angka yang berbeda dari terbitan resminya —
 * tanpa satu pun galat.
 *
 * Bulanan: arsip bulanan mendarat 18 Agu 2026 dan ternyata BUKAN cerminan
 * mingguan seperti yang diduga saat halaman ini dirancang. Terukur dari
 * berkas pertamanya: pasangan nilainya `bulan_ini`/`bulan_lalu` (+ `tahun_lalu`,
 * `mom`, `yoy` — mingguan tak punya pembanding tahunan sama sekali), gainers
 * memakai `sebelumnya`/`penutupan` bukan `minggu_lalu`/`minggu_ini`, dan ada
 * blok yang tak ada padanannya di mingguan (`sektor`, `syariah`,
 * `sekuritas_tercatat`, `indeks_kinerja` dengan kolom m1..y10).
 *
 * Karena itu PEMUATNYA dibuat tahan bentuk (jalur berkas + pembacaan indeks
 * sudah generik), tapi LAYARNYA belum: merender berkas bulanan lewat komponen
 * mingguan akan menghasilkan panel-panel kosong yang terbaca sebagai rusak,
 * dan menebak arti ruasnya berarti memajang angka karangan. Pilihan Bulanan
 * sengaja dibiarkan mati sampai bentuk itu dibaca dengan benar.
 */
import { useCallback, useEffect, useState } from 'react'

export type JenisPeriode = 'minggu' | 'bulan'

/** Sepasang nilai periode-lalu/periode-ini apa adanya dari sumber. Semua ruas
 *  boleh hilang: edisi lama kadang tak memuat salah satunya, dan yang hilang
 *  WAJIB tampil "—", bukan 0. */
export interface Banding {
  minggu_lalu?: number | null
  minggu_ini?: number | null
  perubahan?: number | null
  persen?: number | null
}

export interface BarisPeringkat {
  kode: string
  nama?: string
  nilai?: number | null
  persen?: number | null
}

export interface BarisGerak extends Banding {
  kode: string
}

export interface BarisIndeksGlobal extends Banding {
  wilayah?: string
  negara?: string
  indeks?: string
}

export interface BarisIndeksLokal {
  nama: string
  tertinggi?: number | null
  terendah?: number | null
  penutupan?: number | null
  persen?: number | null
}

export interface BarisMover {
  kode: string
  harga_persen?: number | null
  mcff_triliun?: number | null
  poin_indeks?: number | null
}

export interface HariInvestor {
  tanggal_iso: string
  volume_juta_lembar?: Record<string, number | null>
  nilai_miliar_idr?: Record<string, number | null>
  frekuensi_ribu_kali?: Record<string, number | null>
}

export interface RekapPapan {
  volume?: number | null
  volume_persen?: number | null
  nilai?: number | null
  nilai_persen?: number | null
  frekuensi?: number | null
  frekuensi_persen?: number | null
}

export interface RuasInstrumen {
  volume_lembar?: number | null
  nilai_idr?: number | null
  frekuensi_kali?: number | null
}

/** Satu edisi (satu pekan / satu bulan). Ruas ber-awalan `_` di berkas sumber
 *  (jejak halaman PDF asalnya) SENGAJA tidak didaftarkan — ia catatan panen,
 *  bukan data pembaca, dan tak boleh sampai ke layar. */
export interface EdisiBerkala {
  tanggal_edisi_id?: string
  tanggal_edisi_iso: string
  rentang_minggu?: string
  minggu_ini?: {
    volume_juta_lembar?: number | null
    nilai_miliar_idr?: number | null
    nilai_juta_usd?: number | null
  }
  rata_rata_harian?: Record<string, Banding>
  ihsg?: Record<string, Banding>
  net_asing?: {
    minggu_ini?: { arah?: string; miliar_idr?: number | null; juta_usd?: number | null }
    minggu_lalu?: { arah?: string; miliar_idr?: number | null; juta_usd?: number | null }
  }
  transaksi_investor?: HariInvestor[]
  top_saham?: Record<string, BarisPeringkat[]>
  top_broker?: Record<string, BarisPeringkat[]>
  rekap_transaksi?: Record<string, RekapPapan>
  top_gainers?: BarisGerak[]
  top_losers?: BarisGerak[]
  index_movers?: Record<string, { top_leaders?: BarisMover[]; top_laggards?: BarisMover[] }>
  ringkasan_perdagangan?: {
    instrumen?: Record<string, RuasInstrumen>
    futures?: { volume_kontrak?: number | null; nilai_idr?: number | null; frekuensi_kali?: number | null }
    transaksi_asing?: Record<string, RuasInstrumen>
  }
  indeks_mingguan?: BarisIndeksLokal[]
  indeks_global?: BarisIndeksGlobal[]
  dana_dihimpun?: Record<string, number | null>
}

/** Satu baris daftar edisi. Mingguan dan bulanan TIDAK sebangun: mingguan
 *  memberi `tanggal_edisi_iso` + `rentang_minggu`, bulanan memberi `periode`
 *  ("2026-07") + `periode_id` ("Juli 2026"). Keduanya didaftarkan di sini
 *  sebagai opsional dan dibaca lewat `kunciUrut`/`labelEdisi` — bukan
 *  diasumsikan sama, karena asumsi itu sudah terbukti salah begitu berkas
 *  bulanan pertama muncul. */
export interface EntriIndeks {
  stem: string
  tanggal_edisi_iso?: string
  rentang_minggu?: string
  periode?: string
  periode_id?: string
}

/** Kunci pengurutan edisi — apa pun bentuk indeksnya. `stem` jadi jaring
 *  terakhir: penamaannya sendiri (ws_YYMMDD / ms_YYMM) sudah urut kronologis. */
export function kunciUrut(e: EntriIndeks): string {
  return e.tanggal_edisi_iso ?? e.periode ?? e.stem
}

const BERKAS_INDEKS: Record<JenisPeriode, string> = {
  minggu: '/data-idx/json/index_weekly.json',
  bulan: '/data-idx/json/index_monthly.json',
}

const BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const BULAN_EN = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/** ISO → "14 Agu 2026". String yang tak berbentuk ISO dikembalikan apa adanya
 *  — lebih baik menampilkan yang tertulis di sumber daripada menebak. */
export function tanggalPendek(iso: string): string {
  const [t, b, d] = (iso ?? '').split('-').map(Number)
  if (!t || !b || !d || b > 12) return iso ?? '—'
  return `${d} ${BULAN_ID[b - 1]} ${t}`
}

/**
 * Label satu edisi untuk pemilih & judul panel.
 *
 * Sumbernya menulis rentang dalam bahasa Inggris ("August 10-14, 2026"); di
 * layar berbahasa Indonesia itu janggal, jadi diterjemahkan — TAPI hanya kalau
 * bentuknya benar-benar dikenali. Bentuk asing (mis. rentang yang menyeberang
 * bulan) dikembalikan apa adanya, bukan dipaksa masuk pola.
 *
 * Tiga edisi tidak punya `rentang_minggu` sama sekali (2 Jan, 2 Apr, 3 Jul
 * 2026 — halaman rentangnya tak terbaca saat panen). Untuk itu dipakai
 * tanggal edisi dengan awalan "s.d.", supaya terbaca sebagai "pekan yang
 * berakhir di tanggal ini" dan bukan sebagai satu hari.
 */
export function labelEdisi(e: Partial<EntriIndeks> & Partial<EdisiBerkala>): string {
  const rentang = (e.rentang_minggu ?? '').trim()
  const cocok = /^([A-Za-z]+)\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})$/.exec(rentang)
  if (cocok) {
    const bulan = BULAN_EN.indexOf(cocok[1].toLowerCase())
    if (bulan >= 0) return `${cocok[2]}–${cocok[3]} ${BULAN_ID[bulan]} ${cocok[4]}`
  }
  if (rentang) return rentang
  if (e.periode_id) return e.periode_id
  if (e.tanggal_edisi_iso) return `s.d. ${tanggalPendek(e.tanggal_edisi_iso)}`
  return e.periode ?? e.stem ?? '—'
}

/**
 * Persen perubahan kalau sumbernya tidak mencantumkannya. null (→ "—") kalau
 * pembandingnya hilang ATAU nol — bukan 0%, karena "tidak berubah" dan "tidak
 * diketahui" adalah dua pernyataan yang berbeda dan yang satu bisa salah.
 */
export function persenBanding(b: Banding | null | undefined): number | null {
  if (!b) return null
  if (b.persen != null) return b.persen
  const lalu = b.minggu_lalu
  const ini = b.minggu_ini
  if (lalu == null || ini == null || lalu === 0) return null
  return (ini / lalu - 1) * 100
}

/** Selisih periode, ikut sumbernya kalau ada. null kalau salah satu ujungnya hilang. */
export function selisihBanding(b: Banding | null | undefined): number | null {
  if (!b) return null
  if (b.perubahan != null) return b.perubahan
  if (b.minggu_lalu == null || b.minggu_ini == null) return null
  return b.minggu_ini - b.minggu_lalu
}

/** Angka untuk layar. null/undefined → "—" (pola bug berulang: 0 itu pernyataan). */
export function angka(v: number | null | undefined, desimal = 0): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('id-ID', { maximumFractionDigits: desimal, minimumFractionDigits: 0 })
}

/** Persen bertanda untuk layar. null → "—". Desimalnya koma seperti `angka()`
 *  — satu halaman tak boleh memakai dua gaya desimal sekaligus. */
export function persen(v: number | null | undefined, desimal = 2): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const abs = Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal })
  return `${v >= 0 ? '+' : '−'}${abs}%`
}

/**
 * PANGSA (bagian dari total), bukan perubahan — tanpa tanda + / −.
 *
 * Dua jenis persen hidup berdampingan di berkas ini dan gampang tertukar:
 * `top_saham[].persen` & `rekap_transaksi[].*_persen` adalah porsi dari total
 * pasar, sedangkan `top_gainers[].persen` & `indeks_mingguan[].persen` adalah
 * perubahan. Memakai `persen()` untuk yang pertama mencetak "+86,96%" pada
 * porsi pasar reguler — terbaca sebagai "naik 87%", padahal artinya "87% dari
 * seluruh volume". Salah baca yang mahal dan tak akan memunculkan galat apa pun.
 */
export function pangsa(v: number | null | undefined, desimal = 2): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toLocaleString('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal })}%`
}

/** Daftar edisi dari berkas indeks. Nama ruas larik di dalamnya berbeda antara
 *  mingguan (`minggu`) dan bulanan (kemungkinan `bulan`) — jadi diambil larik
 *  PERTAMA yang ditemukan, bukan ditebak namanya. */
export function bacaIndeks(json: unknown): EntriIndeks[] {
  if (!json || typeof json !== 'object') return []
  const larik = Object.values(json as Record<string, unknown>).find(Array.isArray) as EntriIndeks[] | undefined
  return (larik ?? [])
    .filter((e) => e && typeof e.stem === 'string')
    .slice()
    .sort((a, b) => kunciUrut(a).localeCompare(kunciUrut(b)))
}

/** Ambil JSON; null (bukan lempar) kalau berkasnya tak ada. Dev server Vite
 *  membalas index.html untuk berkas yang tak ada — status 200 dengan isi HTML —
 *  jadi `r.ok` saja TIDAK cukup, parse-nya yang jadi bukti. */
async function ambilJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

const cacheIndeks = new Map<JenisPeriode, EntriIndeks[]>()
const cacheEdisi = new Map<string, EdisiBerkala>()

/**
 * Muat daftar edisi + edisi terpilih. Sengaja TIDAK memuat seluruh arsip
 * sekaligus: satu edisi ±34KB, 33 edisi berarti 1,1MB untuk satu layar yang
 * cuma menampilkan satu edisi. Edisi yang sudah diambil di-cache di modul,
 * jadi menyusuri pekan maju-mundur cuma sekali unduh per pekan.
 */
export function useStatistikBerkala(jenis: JenisPeriode) {
  const [daftar, setDaftar] = useState<EntriIndeks[] | null>(cacheIndeks.get(jenis) ?? null)
  const [idx, setIdx] = useState<number | null>(null)
  const [edisi, setEdisi] = useState<EdisiBerkala | null>(null)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    let batal = false
    const tersimpan = cacheIndeks.get(jenis)
    if (tersimpan) {
      setDaftar(tersimpan)
      setIdx(tersimpan.length - 1)
      return
    }
    setDaftar(null)
    setEdisi(null)
    ambilJson(BERKAS_INDEKS[jenis]).then((json) => {
      if (batal) return
      const isi = bacaIndeks(json)
      if (isi.length === 0) { setGalat('Daftar edisi belum tersedia.'); return }
      cacheIndeks.set(jenis, isi)
      setGalat('')
      setDaftar(isi)
      setIdx(isi.length - 1)
    })
    return () => { batal = true }
  }, [jenis])

  const stem = daftar && idx != null ? daftar[idx]?.stem : undefined

  useEffect(() => {
    if (!stem) return
    let batal = false
    const tersimpan = cacheEdisi.get(stem)
    if (tersimpan) { setEdisi(tersimpan); return }
    ambilJson(`/data-idx/json/${stem}.json`).then((json) => {
      if (batal) return
      if (!json || typeof json !== 'object') { setGalat('Edisi ini gagal dimuat.'); return }
      const isi = json as EdisiBerkala
      cacheEdisi.set(stem, isi)
      setGalat('')
      setEdisi(isi)
    })
    return () => { batal = true }
  }, [stem])

  const pilih = useCallback((i: number) => {
    setIdx((lama) => {
      if (!daftar || i < 0 || i >= daftar.length) return lama
      return i
    })
  }, [daftar])

  return { daftar, idx, edisi, galat, pilih }
}
