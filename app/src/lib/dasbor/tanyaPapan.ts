import type { DataHarian, TanggalIndex } from './dataHarian'
import { muatSektor, sektorEmiten, type DaftarSektor } from './sektorIdx'
import type { EdisiBulletin } from './bulletin'
import type { KabarItem } from './kabar'
import { rangkumHari, ASAL_AMBANG } from './ringkasHarian'
import type { KamusEmiten, EmitenEntry, GrupEntry } from './kamusEmiten'
import type { StockFundamental } from './stockDetailData'
import type { InvestorMapEntry } from './petaInvestorData'
import { holderType } from './petaInvestorData'
import type { BarisOhlc } from './ihsgOhlc'
import { cariPengetahuan, PENGETAHUAN } from './pengetahuan'
import { cariGlosarium } from './glosarium'
import { normalTanya } from './teksTanya'
import { HOLIDAYS, todayIsoJakarta } from '../../components/dasbor/Kalender'

/**
 * Mesin jawab "Tanya PAPAN" — tahap pertama: **menjawab dari data, bukan dari
 * model bahasa**.
 *
 * Ini sengaja dibangun sebelum LLM disambungkan, bukan sebagai penambal
 * sementara. Alasannya: begitu jalur tanya-jawab ada, pertanyaan yang paling
 * sering ditanyakan ternyata pertanyaan FAKTA ("IHSG hari ini berapa?",
 * "asing net sell berapa?") — dan pertanyaan fakta lebih baik dijawab dengan
 * angka yang ditarik langsung daripada dengan model yang menyusun ulang angka
 * itu. LLM nanti menambah yang memang tak bisa dilakukan di sini: pertanyaan
 * bebas yang tak cocok dengan pola mana pun.
 *
 * Fungsi MURNI: konteks dioper dari pemanggil, tak ada fetch di dalam. Untuk
 * pertanyaan yang butuh berkas PER-EMITEN (fundamental/ohlc/investor — bisa
 * ratusan KB, tak boleh diborong ke semua pemuatan), `jawab()` mengembalikan
 * `{ butuh: {...} }` alih-alih fetch sendiri. Lihat `Jawaban.butuh` dan
 * `KonteksTanya.data` — pemanggil (TanyaPapan.tsx) yang mengambil berkasnya
 * lalu memanggil `jawab()` lagi dengan hasilnya terisi.
 */

/** Ringkas `data-idx/json/ohlc/{KODE}.json` — cuma `d` yang dipakai di sini. */
export interface OhlcRingkas {
  kode: string
  d: BarisOhlc[]
}

/** Hasil fetch tahap-2 (lihat `Jawaban.butuh`). `payload: null` = fetch
 *  selesai tapi datanya memang tak ada (404 — emiten tak punya berkas itu),
 *  BEDA dengan "belum dicoba" (kalau itu, field ini simply tak cocok kode
 *  yang sedang ditanya, dan `jawab()` akan minta `butuh` lagi). */
export type DataButuh =
  | { jenis: 'fundamental'; kode: string; payload: StockFundamental | null }
  | { jenis: 'ohlc'; kode: string; payload: OhlcRingkas | null }
  | { jenis: 'investor'; kode: string; payload: InvestorMapEntry | null }

export interface KonteksTanya {
  hari: DataHarian | null
  /** Seri penutupan IHSG per hari bursa (index.json) — bahan pertanyaan
   *  lintas waktu: sepekan, sebulan, beruntun berapa hari. */
  seri: TanggalIndex[] | null
  edisi: EdisiBulletin[] | null
  kabar: KabarItem[] | null
  /** Topik jawaban SEBELUMNYA. Tanpa ini, "kenapa?" dan "berapa?" tak punya
   *  rujukan — dan pertanyaan susulan sependek itu justru yang paling wajar
   *  diketik orang setelah membaca satu jawaban. */
  topik?: Topik | null
  /** SUBJEK jawaban sebelumnya — kode emiten, kalau jawabannya memang tentang
   *  satu emiten. Topik saja cuma menyimpan JENIS ("hargaEmiten"), jadi tanpa
   *  ruas ini "berapa?" sesudah "harga BBCA" tak tahu emiten mana yang
   *  dimaksud dan terpaksa mengaku bingung — padahal orang jelas masih
   *  membicarakan BBCA. */
  subjek?: string | null
  /** Kamus KECIL (harga cadangan, daftar emiten, grup konglomerat) — dimuat
   *  sekali lewat `useKamusEmiten`, dioper murni di sini (tanpa fetch
   *  tambahan). `null`/`undefined` = belum termuat; pertanyaan yang
   *  membutuhkannya dijawab jujur, bukan dipaksakan. */
  kamus?: KamusEmiten | null
  /** Hasil fetch tahap-2 untuk pertanyaan yang butuh berkas PER-EMITEN.
   *  Lihat `DataButuh`/`Jawaban.butuh`. */
  data?: DataButuh | null
}

/** Topik yang bisa dilanjutkan pertanyaan susulan. Topik per-emiten & kalender
 *  SENGAJA tak masuk peta susulan (`balik` di bawah) — lihat catatannya di
 *  sana. */
export type Topik = 'ihsg' | 'asing' | 'sektor' | 'gainer' | 'loser' | 'penggerak' | 'broker'
  | 'valuasi' | 'edisi' | 'kabar' | 'ambang' | 'lintasWaktu' | 'kalender' | 'grup'
  | 'hargaEmiten' | 'valuasiEmiten' | 'sektorEmiten' | 'kinerjaEmiten' | 'pemilikEmiten'
  | null

export interface Jawaban {
  teks: string
  /** Topik jawaban ini — dikembalikan supaya pertanyaan berikutnya bisa
   *  menyambung ("kenapa?", "berapa?"). */
  topik?: Topik
  /** Emiten yang sedang dibicarakan — dikembalikan bersama `topik` supaya
   *  susulan "berapa?" tetap tahu emitennya. Lihat `KonteksTanya.subjek`. */
  subjek?: string
  /** Halaman yang membuktikan jawaban — tiap jawaban WAJIB bisa ditelusuri. */
  ke?: string
  keLabel?: string
  /** true = tak ada pola yang cocok. Dipisah supaya antarmuka bisa menawarkan
   *  jalan lain, dan supaya kelak gampang dialihkan ke LLM. */
  takPaham?: boolean
  /** Jawaban ini butuh berkas PER-EMITEN yang belum ada di `KonteksTanya.data`
   *  — `jawab()` TIDAK fetch sendiri (tetap fungsi murni). Pemanggil
   *  mengambil berkasnya lalu memanggil `jawab()` lagi dengan pertanyaan yang
   *  SAMA dan `data` terisi. */
  butuh?: { jenis: DataButuh['jenis']; kode: string }
  /** Pertanyaan lanjutan yang wajar ditawarkan sebagai CHIP — bukan ditebak
   *  otomatis. Diisi TERPUSAT di `jawab()` dari `topik`/`subjek` HASIL AKHIR
   *  (lihat `saranUntuk`), bukan per fungsi `jawabX` — supaya daftarnya tak
   *  bercabang jadi banyak versi. */
  saran?: string[]
}

const rp = (n: number, des = 2) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: des, maximumFractionDigits: des })

const pct = (n: number) => `${n >= 0 ? '+' : '−'}${rp(Math.abs(n))}%`

const miliar = (n: number) =>
  Math.abs(n) >= 1000 ? `Rp${rp(Math.abs(n) / 1000)} triliun` : `Rp${rp(Math.abs(n), 0)} miliar`

const bersih = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')

/**
 * Kata pemicu dicocokkan dari AWAL kata, bukan sebagai potongan bebas.
 *
 * `includes()` polos membuat pemicu pendek nyangkut di tengah kata lain, dan
 * hasilnya jawaban yang percaya diri untuk pertanyaan yang sama sekali lain —
 * tiga yang terukur: "asing" di dalam "masing-masing" ("berapa PER
 * masing-masing sektor" dijawab arus asing se-pasar), "siapa" di dalam
 * "persiapan" ("apa saja persiapan sebelum bursa buka" dijawab "belum ada data
 * personalia"), dan "buka" di dalam "pembukaan" ("besok harga pembukaan IHSG
 * berapa" dijawab kalender bursa).
 *
 * Yang dipakai batas AWAL saja (`\bkata`, bukan `\bkata\b`) — bukan kelalaian:
 * bahasa Indonesia menempelkan akhiran, jadi "sektornya", "kabarnya", dan
 * "gainers" harus tetap kena pemicu "sektor", "kabar", "gainer".
 */
const punya = (t: string, ...kata: string[]) =>
  kata.some((k) => new RegExp(`\\b${escapeRegex(k)}`).test(t))

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const BULAN_PANJANG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** "2026-08-13 21:13" (bentuk `updated` di fundamental/*.json) → "13 Agu 2026". */
function fmtUpdated(s?: string | null): string {
  if (!s) return '—'
  const [tgl] = s.split(' ')
  const [y, m, d] = tgl.split('-').map(Number)
  if (!y || !m || !d) return s
  return `${d} ${BULAN_PENDEK[m - 1]} ${y}`
}

/** "2026-08" (bentuk `bulan` di harga_terakhir.json) → "Agustus 2026". */
function labelBulan(ym?: string): string {
  if (!ym) return '—'
  const [y, m] = ym.split('-').map(Number)
  return m ? `${BULAN_PANJANG[m - 1]} ${y}` : ym
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** "PT Bank Central Asia Tbk." → "bank central asia" — badan hukum (pt/tbk/
 *  persero) dibuang supaya cocok dengan cara orang menyebut nama perusahaan
 *  sehari-hari ("bank central asia", bukan "pt bank central asia tbk"). */
function normalisasiNama(s: string): string {
  return bersih(s).replace(/\b(tbk|pt|persero)\b/g, '').replace(/\s+/g, ' ').trim()
}

/** Cari kode emiten dari NAMA yang disebut di pertanyaan (`t` sudah `bersih()`
 *  ). Dicocokkan sebagai kata utuh (`\b...\b`), bukan potongan bebas — supaya
 *  "bank" saja (kata umum) tak asal menempel ke emiten pertama yang namanya
 *  memuat "bank". Kalau beberapa nama cocok, menang yang PALING PANJANG
 *  (paling spesifik). O(n) atas daftar emiten (~960) — cukup murah untuk
 *  dijalankan sekali per pertanyaan, tak perlu index tambahan. */
function cariKodeDariNama(daftar: EmitenEntry[], t: string): string | null {
  let terbaik: { kode: string; panjang: number } | null = null
  for (const e of daftar) {
    const nama = normalisasiNama(e.nama)
    if (nama.length < 4) continue
    if (new RegExp(`\\b${escapeRegex(nama)}\\b`).test(t) && (!terbaik || nama.length > terbaik.panjang)) {
      terbaik = { kode: e.kode, panjang: nama.length }
    }
  }
  return terbaik?.kode ?? null
}

/** SEMUA kode saham yang disebut, urut kemunculan, tanpa kembar. "IHSG"
 *  dikecualikan: bentuk hurufnya kebetulan cocok tapi itu indeks, bukan
 *  emiten. Dulu cuma yang PERTAMA diambil, dan sisanya hilang tanpa jejak —
 *  "harga BBCA sama BBRI berapa" dijawab BBCA saja, seolah BBRI tak ada. */
function kodeDisebut(pertanyaan: string, kamus?: KamusEmiten | null): string[] {
  const semua = pertanyaan.match(/\b[A-Z]{4}\b/g) ?? []
  const kandidat = [...new Set(semua)].filter((x) => x !== 'IHSG')
  // Kalau SELURUH pertanyaan diketik kapital, "diketik kapital" berhenti jadi
  // penanda ticker — dan tiap kata empat huruf ikut terbaca sebagai kode.
  // Terukur: "SEKTOR APA YANG PALING LEMAH???" dijawab "Data sektor YANG belum
  // ada". Di situ kodenya wajib benar-benar ada di daftar emiten; kalau daftar
  // itu belum termuat, lebih baik tak ada kode sama sekali daripada kode
  // karangan.
  if (/[a-z]/.test(pertanyaan)) return kandidat
  return kandidat.filter((x) => kamus?.emiten.some((e) => e.kode === x))
}

/** Perubahan setahun + kisaran 52 minggu dari baris OHLC mentah — dihitung
 *  dari harga sungguhan, bukan dipercaya begitu saja dari ruas siap-pakai
 *  manapun. Jendela 365 hari KALENDER ke belakang dari baris terakhir
 *  (bukan hitung mundur N baris) supaya tetap benar walau ada hari libur
 *  panjang yang membuat jumlah baris per tahun tak selalu sama. */
function ringkasKinerja1Thn(rows: BarisOhlc[]) {
  const last = rows[rows.length - 1]
  const akhir = last[4]
  const akhirTgl = last[0]
  const cutoff = new Date(akhirTgl)
  cutoff.setDate(cutoff.getDate() - 365)
  const jendela = rows.filter((r) => new Date(r[0]) >= cutoff)
  if (jendela.length < 2) return null
  const awal = jendela[0][4]
  const awalTgl = jendela[0][0]
  const hi = Math.max(...jendela.map((r) => r[2]))
  const hiTgl = jendela.find((r) => r[2] === hi)?.[0] ?? akhirTgl
  const lo = Math.min(...jendela.map((r) => r[3]))
  return {
    pct: awal ? ((akhir - awal) * 100) / awal : 0,
    awal, awalTgl, akhir, akhirTgl, hi, hiTgl, lo,
    jarakPuncak: hi ? ((akhir - hi) * 100) / hi : 0,
  }
}

/** Besok (WIB) libur bursa? Cuma dua sumber yang JUJUR ada: akhir pekan
 *  (selalu benar) dan `HOLIDAYS` — daftar tanggal merah manual yang sama
 *  dipakai Kalender.tsx (lihat catatan ponytail-nya: libur nasional yang
 *  belum ditambahkan ke situ tidak akan terdeteksi di sini juga). */
function besokLiburBursa(): { iso: string; libur: boolean; alasan: string | null } {
  const d = new Date(`${todayIsoJakarta()}T12:00:00`)
  d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return { iso, libur: true, alasan: 'akhir pekan' }
  if (HOLIDAYS[iso]) return { iso, libur: true, alasan: HOLIDAYS[iso] }
  return { iso, libur: false, alasan: null }
}

/** Tautan bukti + SUBJEK sekaligus: tiap jawaban per-emiten membawa kodenya,
 *  supaya susulan "berapa?" tahu emiten mana yang sedang dibicarakan. */
const linkEmiten = (kode: string) => ({ ke: `/stock-detail?sym=${kode}`, keLabel: 'Buka Stock Detail', subjek: kode })

function jawabHarga(kode: string, fd: StockFundamental | null, kamus?: KamusEmiten | null): Jawaban {
  if (fd?.last_price != null) {
    const prev = fd.prev_close
    const bag = prev ? ` (${pct(((fd.last_price - prev) * 100) / prev)} dari penutupan sebelumnya)` : ''
    return { teks: `${kode}: Rp${rp(fd.last_price, 0)}${bag}, per ${fmtUpdated(fd.updated)}.`, topik: 'hargaEmiten', ...linkEmiten(kode) }
  }
  // Cadangan bulanan (harga_terakhir.json) — dipakai kalau harga langsung tak
  // ada di berkas fundamental. Berkas itu sendiri bilang ini "cadangan", jadi
  // jangan disebut sebagai harga langsung.
  const cad = kamus?.harga[kode]
  if (cad != null) {
    return {
      teks: `${kode}: Rp${rp(cad, 0)} — penutupan cadangan bulanan ${labelBulan(kamus?.hargaBulan)} (harga langsung tak tersedia untuk emiten ini).`,
      topik: 'hargaEmiten', ...linkEmiten(kode),
    }
  }
  return { teks: `Harga ${kode} tidak ditemukan.`, takPaham: true, ...linkEmiten(kode) }
}

function jawabValuasi(kode: string, fd: StockFundamental | null): Jawaban {
  if (!fd || (fd.pe == null && fd.pb == null && fd.roe == null)) {
    return { teks: `Data valuasi ${kode} belum ada.`, takPaham: true, topik: 'valuasiEmiten', ...linkEmiten(kode) }
  }
  return {
    teks: `${kode}: PER ${fd.pe != null ? `${rp(fd.pe)}×` : '—'}, PBV ${fd.pb != null ? `${rp(fd.pb)}×` : '—'}, ROE ${fd.roe != null ? `${rp(fd.roe * 100)}%` : '—'}.`,
    topik: 'valuasiEmiten', ...linkEmiten(kode),
  }
}

// Peta sektor IDX-IC dimuat sekali saat modul hidup (berkas kecil, ~250 KB)
// — jawabSektor sinkron, jadi daftar disiapkan lebih dulu; sebelum tiba,
// fallback fd.sector (Yahoo) berlaku sesaat dan tergantikan di tanya
// berikutnya.
let daftarSektorIdx: DaftarSektor | null = null
void muatSektor().then((d) => { daftarSektorIdx = d }).catch(() => { /* fallback Yahoo tetap jalan */ })

function jawabSektor(kode: string, fd: StockFundamental | null): Jawaban {
  // IDX-IC resmi (_en), BUKAN Yahoo — dua-duanya Inggris jadi cacatnya tak
  // terlihat mata, tapi taksonominya beda (BBCA Yahoo: 'Financial Services /
  // Banks - Regional'; IDX-IC: 'Financials / Bank'). Spek sektor EN 27 Agu.
  const se = sektorEmiten(daftarSektorIdx, kode)
  const sek = se?.sektor_en ?? se?.sektor ?? fd?.sector
  const ind = se?.industri_en ?? fd?.industry
  if (!sek) return { teks: `Data sektor ${kode} belum ada.`, takPaham: true, topik: 'sektorEmiten', ...linkEmiten(kode) }
  return { teks: `${kode} — sektor ${sek}${ind ? `, industri ${ind}` : ''}.`, topik: 'sektorEmiten', ...linkEmiten(kode) }
}

function jawabKinerja(kode: string, od: OhlcRingkas | null): Jawaban {
  const rk = od && od.d.length > 1 ? ringkasKinerja1Thn(od.d) : null
  if (!rk) return { teks: `Riwayat harga ${kode} belum cukup untuk dihitung.`, takPaham: true, topik: 'kinerjaEmiten', ...linkEmiten(kode) }
  return {
    teks:
      `${kode} setahun terakhir ${rk.pct >= 0 ? 'naik' : 'turun'} ${rp(Math.abs(rk.pct))}%, ` +
      `dari Rp${rp(rk.awal, 0)} (${rk.awalTgl}) ke Rp${rp(rk.akhir, 0)} (${rk.akhirTgl}). ` +
      `Kisaran 52 minggu Rp${rp(rk.lo, 0)}–Rp${rp(rk.hi, 0)}, sekarang ${pct(rk.jarakPuncak)} dari puncak (${rk.hiTgl}).`,
    topik: 'kinerjaEmiten', ...linkEmiten(kode),
  }
}

const linkBroker = { ke: '/broker', keLabel: 'Top Broker' }

/**
 * Top Broker — broker paling aktif SE-PASAR hari itu, DIURUT NILAI transaksi.
 * Beda dari Broker Summary PER EMITEN (lihat RUAS_BELUM di bawah): data ini
 * sudah termuat di `h.broker_val` lewat fetch harian biasa (sama field yang
 * dipakai halaman /broker), jadi TANPA fetch tahap-2.
 *
 * ponytail: cuma ranking nilai transaksi. "Broker volume terbesar"/"frekuensi
 * terbesar" belum dicabangkan ke `h.broker_vol`/`h.broker_freq` — tambahkan
 * kalau memang ada yang menanyakannya secara eksplisit.
 */
function jawabBroker(h: DataHarian): Jawaban {
  const top = (h.broker_val ?? []).slice(0, 3)
  if (top.length === 0) return { teks: 'Data Top Broker hari ini belum ada.', takPaham: true, ...linkBroker }
  return {
    teks: `Broker paling aktif hari ini (nilai transaksi): ${top.map((x) => `${x.nm} ${rp(x.p)}%`).join(', ')}.`,
    topik: 'broker', ...linkBroker,
  }
}

const linkInvestor = { ke: '/peta-investor', keLabel: 'Peta Investor' }

/** Komposisi kepemilikan KSEI ≥1% — DIRINGKAS jadi persentase per kelompok,
 *  TANPA menyebut nama satu pun pemegang saham (individu maupun korporasi).
 *  Ini permintaan eksplisit, bukan sekadar konservatif: chatbot publik yang
 *  menyorot nama pemilik saham per pertanyaan berisiko disalahgunakan untuk
 *  memantau orang, walau datanya sendiri publik (KSEI). */
function jawabPemilik(kode: string, entry: InvestorMapEntry | null): Jawaban {
  if (!entry || entry.holders.length === 0) {
    return { teks: `${kode} tak punya data pemegang saham ≥1% di KSEI yang tercatat di sini.`, takPaham: true, topik: 'pemilikEmiten', subjek: kode, ...linkInvestor }
  }
  let asing = 0, domestik = 0, korporasi = 0, individu = 0, lain = 0, total = 0
  for (const h of entry.holders) {
    total += h.pct
    if (h.lf === 'F') asing += h.pct
    else domestik += h.pct
    const tipe = holderType(h.cls)
    if (tipe === 'CORP') korporasi += h.pct
    else if (tipe === 'IND') individu += h.pct
    else lain += h.pct
  }
  return {
    teks:
      `Dari pemegang saham KSEI ≥1% ${kode} (${rp(total)}% tercatat, sisanya tersebar di bawah ambang per pemegang): ` +
      `domestik ${rp(domestik)}%, asing ${rp(asing)}%. Berdasar jenis: korporasi ${rp(korporasi)}%` +
      (individu > 0 ? `, individu ${rp(individu)}%` : '') +
      (lain > 0 ? `, lainnya ${rp(lain)}%` : '') + '.',
    topik: 'pemilikEmiten', subjek: kode, ...linkInvestor,
  }
}

function jawabGrupNama(nama: string, g: GrupEntry): Jawaban {
  const anggota = g.anggota.map((a) => a.kode)
  return {
    teks: `Grup ${nama}: ${anggota.length} emiten — ${anggota.slice(0, 12).join(', ')}${anggota.length > 12 ? ', dan lainnya' : ''}.`,
    topik: 'grup', ...linkInvestor,
  }
}

/**
 * Jawaban dari dua basis TEKS (bukan angka hari berjalan): `pengetahuan.ts`
 * untuk "bagaimana platform ini bekerja", `glosarium.json` untuk "apa arti
 * kata ini".
 *
 * Urutannya sengaja: pengetahuan dulu. Keduanya bisa sama-sama memuat kata
 * "ARA", tapi pengetahuan menjawabnya lengkap dengan aturan bursanya,
 * sementara glosarium cuma memberi definisi sebaris. Yang lebih lengkap
 * menang; glosarium jadi jaring di bawahnya, yang justru jauh lebih lebar
 * (75 istilah, ditambang dari terbitan PAPAN sendiri).
 */
/**
 * Saring kebocoran sebelum teks basis dikirim ke pembaca.
 *
 * Bukan kehati-hatian teoretis: catatan glosarium PCD ditutup dengan "(lihat
 * `arus-pasar/pcd.py`)" — jalur berkas di dalam repo yang tak berarti apa-apa
 * bagi pembaca dan tak sepatutnya keluar dari panel tanya-jawab. Isinya
 * ditambang otomatis dari korpus PAPAN, jadi rujukan seperti itu akan lahir
 * lagi tiap kali glosarium dibangun ulang — karena itu saringnya dipasang di
 * TITIK KELUAR (satu-satunya tempat teks basis jadi jawaban), bukan
 * ditambal satu per satu di datanya.
 */
/** Nama ruas internal: huruf kecil ber-garis-bawah — `operating_cf`,
 *  `ttm_net_income`, `nf_ytd_idr`. Bentuk ini tak pernah berarti apa pun bagi
 *  pembaca; ia nama kolom di berkas kami. */
const RUAS_INTERNAL = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/

function saring(s: string): string {
  const bersihkan = (x: string) => x
    // Kurung yang memuat nama berkas: "(lihat `arus-pasar/pcd.py`)".
    .replace(/\s*\([^)]*\.(?:py|ts|tsx|js|mjs|json|md|sql|ya?ml)\b[^)]*\)/gi, '')
    .replace(/`/g, '')
    .replace(/\s+([.,;])/g, '$1')
    .trim()

  // Kalimat yang menyebut nama ruas internal dibuang UTUH. Menghapus katanya
  // saja meninggalkan kalimat cacat ("… tercatat 80% kosong di sumber Yahoo"),
  // dan kalimat cacat lebih membingungkan daripada kalimat yang tak ada.
  // Ketahuan waktu sapuan kebocoran diperlebar ke SELURUH korpus, bukan cuma
  // ke basis teks: catatan glosarium "arus kas" mencetak `operating_cf`.
  const kalimat = bersihkan(s).split(/(?<=\.)\s+/).filter((x) => !RUAS_INTERNAL.test(x))
  return kalimat.length > 0
    ? kalimat.join(' ')
    : bersihkan(s).replace(new RegExp(RUAS_INTERNAL.source, 'g'), '').replace(/\s+/g, ' ').trim()
}

function jawabTeks(pertanyaan: string): Jawaban | null {
  const p = cariPengetahuan(pertanyaan)
  if (p) return { teks: saring(`${p.judul}. ${p.isi}`), ke: p.ke, keLabel: p.keLabel }

  const g = cariGlosarium(pertanyaan)
  if (g) {
    // Catatan dibawa serta kalau ada — di situlah koreksi istilah tinggal
    // (mis. "orderbook" yang sebenarnya broker summary, atau PCD yang cuma
    // aproksimasi dari OHLCV). Definisi tanpa catatannya bisa menyesatkan
    // justru pada istilah yang paling perlu diluruskan.
    const bagian = [`${g.istilah}: ${g.definisi}`]
    if (g.catatan) bagian.push(g.catatan)
    if (g.contoh) bagian.push(`Contoh pemakaian di terbitan PAPAN: "${g.contoh}"`)
    return { teks: saring(bagian.join(' ')), ke: g.ke, keLabel: g.ke ? 'Buka halaman terkait' : undefined }
  }
  return null
}

/** Pertanyaan yang jelas MINTA DEFINISI, bukan angka. Dicek lebih dulu supaya
 *  "apa itu IHSG" dijawab artinya, bukan angkanya hari ini. Dicocokkan ke teks
 *  yang sudah dinormalkan, jadi bentuk tak baku ("apasih itu ARA") ikut kena. */
const MINTA_ARTI =
  /\b(apa itu|apa arti|apa sih|apasih|apa yang dimaksud|arti|artinya|maksudnya|definisi|istilah|singkatan dari|kepanjangan)\b/i

/**
 * Pertanyaan yang meminta REKOMENDASI atau RAMALAN.
 *
 * Diperiksa paling awal, sebelum blok data mana pun. Bukan sekadar rapi:
 * kalimat seperti "saham apa yang layak dibeli minggu ini" memuat kata
 * "minggu", dan blok lintas waktu dengan senang hati menjawabnya dengan angka
 * IHSG sepekan — pertanyaannya soal rekomendasi, jawabannya soal indeks, dan
 * pembaca tak punya cara tahu pertanyaannya tak dijawab. Yang benar: sebut
 * terus terang PAPAN tak memberi rekomendasi.
 */
const MINTA_REKOMENDASI =
  /\b(rekomendasi|layak (di)?beli|saham bagus|bagus (ga|gak|tidak|enggak)|bagus mana|mana yang (lebih )?bagus|lebih bagus|pilih mana|mending(an)? mana|beli apa\b(?! saja)|harus beli|jual apa|prediksi|ramalan|prospek besok|gorengan|tips (trading|saham|beli)|saran (portofolio|saham|investasi)|saham (murah|potensial|multibagger)|worth it|waktu yang tepat|sebaiknya (beli|jual|masuk)|beli sekarang|menjanjikan|prospektif)\b/

/**
 * Minta TARGET/level keputusan — bentuk rekomendasi yang menyamar jadi
 * pertanyaan angka. "target harga BBCA berapa" dulu dijawab harga hari ini:
 * angkanya benar sebagai harga, tapi yang ditanya angka MASA DEPAN, dan
 * jawaban itu terbaca seolah PAPAN punya targetnya.
 *
 * Pengecualian `cara/rumus/hitung` disengaja: "bagaimana cara menghitung
 * target harga setelah ARA" menanyakan METODE, dan metode itu memang kami
 * jelaskan (aturan auto rejection) — yang ditolak keputusannya, bukan
 * aritmetikanya.
 */
const MINTA_TARGET =
  /\b(target (harga|jual|beli|profit)|cut ?loss|stop ?loss|take profit|entry (di|point|nya)|masuk di harga)\b/

/**
 * Pertanyaan tentang HARI YANG BELUM BERJALAN. Wajib ditolak, bukan dijawab
 * angka hari ini: "IHSG besok naik atau turun" dan "kapan IHSG naik lagi"
 * sama-sama dijawab ringkasan hari berjalan — pembaca tak punya satu pun
 * penanda bahwa yang dibacanya bukan jawaban pertanyaannya.
 *
 * "halaman depan" sengaja tak kena karena "depan" hanya dihitung sebagai
 * pasangan satuan waktu ("pekan depan", "bulan depan").
 */
const MASA_DEPAN =
  /\b(besok|esok|lusa|nanti|mendatang)\b|\b(hari|pekan|minggu|bulan|kuartal|tahun) depan\b|\bke depan\b|\bakhir (tahun|bulan|pekan)\b|\b(sehari|sepekan|seminggu|sebulan|setahun|beberapa hari) lagi\b|\bkapan\b[^?]*\b(naik|turun|rebound|pulih|balik|bangkit|datang|tiba|mulai)\b|\b(mau|akan|arah\w*) ke ?mana\b/

/**
 * Pertanyaan tentang TANGGAL LAIN di masa lalu. Dipisah dari "kemarin" (yang
 * memang bisa dijawab dari seri) karena riwayat per tanggal sembarang tak
 * diindeks di sini — dan menjawabnya dengan angka hari berjalan atau dengan
 * persentase rentang adalah bentuk kesalahan yang sama: benar sebagai angka,
 * bukan jawaban pertanyaannya. Terukur: "harga BBCA bulan lalu berapa"
 * dijawab harga hari ini, "IHSG pekan lalu ditutup di berapa" dijawab
 * persentase sepekan.
 */
const MASA_LALU = /\b(pekan|minggu|bulan|kuartal|tahun|hari) lalu\b|\btanggal \d/

/**
 * Perhitungan ANDAI — skenario harga. Wajib memuat angka: tanpa syarat itu
 * "kalau setoran saya perlu revisi apakah akurasi saya ikut turun" (kalimat
 * yang sudah ada di korpus) ikut tersapu, padahal itu pertanyaan kebijakan.
 */
const ANDAI = /\b(kalau|kalo|jika|seandainya|misal(kan|nya)?|andai)\b/

/**
 * Pertanyaan KAPABILITAS — "apakah ada", "punya tidak", "bisa tidak".
 * Jawabannya harus ya/tidak beserta batasnya, bukan brosur: "apakah PAPAN
 * punya data intraday" dulu dijawab profil PAPAN, yang tak memuat kata
 * "intraday" sama sekali dan membuat penanya menyimpulkan sendiri.
 */
const TANYA_KAPABILITAS =
  /\b(apakah|adakah|bisakah|punya|ada|bisa|support|mendukung|tersedia|menyediakan)\b/

/** Yang memang TIDAK ada di PAPAN — dijawab "tidak" berikut batasnya. */
const ABSEN: [RegExp, string][] = [
  [/\b(intraday|real ?time|realtime|tick by tick|per menit|per detik|streaming)\b/,
    'Belum ada. Angka di PAPAN adalah data HARIAN yang diperbarui setelah bursa tutup — proses utamanya sekitar ' +
    '18:30 WIB. Tidak ada harga intraday, real-time, maupun streaming di sini.'],
  [/\b(notifikasi|notif|alert|alarm|pemberitahuan)\b/,
    'Belum ada notifikasi atau alert harga. Yang tersedia halaman data yang dibuka sendiri, dan Radar Watchlist ' +
    'yang syarat penyaringnya terbuka.'],
  [/\b(kripto|crypto|bitcoin|forex|valas|reksa ?dana|obligasi|komoditas)\b/,
    'Tidak ada. PAPAN hanya menyajikan pasar saham Indonesia (BEI), ditambah penutupan indeks dunia di halaman ' +
    'Indeks Dunia. Instrumen di luar itu tidak dikumpulkan di sini.'],
]

/**
 * Ruas PER EMITEN yang belum dihitung di panel ini.
 *
 * Ini penutup lubang paling besar yang terukur: blok "emiten disebut
 * langsung" adalah keranjang untuk SETIAP kalimat yang memuat kode saham,
 * jadi "volume BBCA hari ini berapa", "EPS BBCA berapa", dan "market cap BBCA
 * berapa" semuanya dijawab profil peringkat harian yang sama — "naik +1,10%
 * … peringkat 1 nilai transaksi terbesar". Tak satu pun ruas yang ditanya ada
 * di jawabannya, dan tak ada satu pun penanda bahwa pertanyaannya tak
 * terjawab. Ditambal di akar (sebelum keranjangnya), bukan per kalimat.
 */
const RUAS_BELUM: [RegExp, string][] = [
  [/\b(volume|lembar|frekuensi|freq)\b/, 'volume dan frekuensi per emiten'],
  [/\b(market ?cap|kapitalisasi)\b/, 'kapitalisasi pasar per emiten'],
  [/\b(eps|der|roa|dar|nilai buku|book value|laba bersih|pendapatan|revenue|arus kas|saham beredar|jumlah saham|shares)\b/, 'ruas laporan keuangan itu'],
  [/\b(dividen|dividend|yield)\b/, 'jadwal dan besaran dividen'],
  [/\b(nilai transaksi|turnover)\b/, 'nilai transaksi per emiten'],
  [/\b(bid|offer|antrian|order ?book)\b/, 'antrian bid/offer'],
  // Top Broker yang kita punya (`h.broker_val`, lihat jawabBroker) itu
  // MARKET-WIDE, bukan per emiten — "broker BBCA" tak ada jawabannya di sini.
  [/\bbroker\b/, 'rincian broker per emiten'],
  [/\b(fee|komisi|biaya (transaksi|beli|jual)|pajak)\b/, 'biaya transaksi dan pajak'],
]

/** Rekor sepanjang riwayat — jendela yang dihitung di sini cuma 365 hari,
 *  jadi "harga tertinggi BBCA sepanjang masa" tak boleh dijawab harga
 *  terakhir (yang dilakukannya sebelum ini, tanpa penanda apa pun). */
const REKOR_PENUH = /\bsepanjang masa\b|\ball ?time\b|\bath\b|\bsejak ipo\b|\bsepanjang sejarah\b|\btertinggi sepanjang\b/

/**
 * "PER" si rasio, bukan "per" kata depan.
 *
 * `\bper\b` polos ikut kena "per emiten", "per hari", "per lembar" — dan
 * frasa itu justru sangat lazim di pertanyaan pasar. Terukur: "apakah ada
 * data broker per emiten untuk semua saham" dijawab "PER pasar 14,20×".
 * Ronde sebelumnya sudah menyempitkan `includes('per')` jadi kata utuh;
 * ternyata kata utuhnya sendiri masih dua arti.
 */
const RASIO_PER =
  /\bper\b(?! (emiten|saham|hari|tanggal|lembar|bulan|tahun|pekan|minggu|kuartal|unit|orang|broker|sektor|kode|baris|halaman))/

/** Membandingkan dua emiten — belum dikerjakan, dan menjawab salah satunya
 *  diam-diam membuat yang satunya terbaca "tidak ada". */
const BANDING = /\b(vs|versus|dibanding(kan)?|banding|antara|lebih (likuid|murah|mahal|besar|kecil|untung|bagus|baik|rendah|tinggi)|mana yang|\batau\b)\b/i

/** Kata TUNGGAL yang menunjuk lebih dari satu hal di PAPAN. Menebak salah satu
 *  cabangnya sama saja menjawab pertanyaan yang tak ditanyakan — jadi
 *  cabangnya ditawarkan, bukan dipilihkan. */
const CABANG: Record<string, string> = {
  broker: 'Kata "broker" menunjuk tiga hal berbeda di sini: (1) Broker Summary — rekap transaksi broker ' +
    'per emiten dari setoran kontributor; (2) Top Broker — broker paling aktif se-pasar per hari; ' +
    '(3) bandarmologi — cara membaca pola broker besar. Mana yang kamu maksud?',
  emiten: 'Soal emiten saya bisa menjawab: harga dan valuasi (PER/PBV/ROE), sektor dan industrinya, ' +
    'kinerja setahun terakhir, komposisi pemegang saham KSEI, dan grup konglomeratnya. ' +
    'Sebut kodenya, misalnya "harga BBCA" atau "BBCA sektor apa".',
  saham: 'Soal saham saya bisa menjawab: yang paling naik/turun hari ini, harga dan valuasi satu emiten, ' +
    'kinerja setahun terakhir, dan arti istilahnya. Sebut yang mana — misalnya "saham paling naik" ' +
    'atau "harga BBCA".',
  harga: 'Soal harga ada tiga arah: harga satu emiten (sebut kodenya, misalnya "harga BBCA"), ' +
    'aturan fraksi harga bursa, atau batas auto rejection (ARA/ARB). Mana yang kamu maksud?',
  data: 'Soal data saya bisa menjawab: dari mana sumbernya, kapan diperbarui, dan kenapa sebagian data ' +
    '(mis. broker summary per emiten) cuma tersedia sebagian. Mana yang kamu maksud?',
  grup: 'Grup konglomerat bisa ditanya dua arah: isi sebuah grup ("grup Salim isinya apa") atau grup ' +
    'sebuah emiten ("ICBP grup apa").',
  investor: 'Soal investor ada dua: komposisi pemegang saham KSEI per emiten ("siapa pemilik BBCA") ' +
    'atau arus dana asing hari ini ("asing net buy atau net sell").',
}

/** Pertanyaan contoh — ditawarkan di antarmuka supaya pengguna tahu batas
 *  kemampuannya tanpa harus menebak-nebak. */
export const CONTOH_TANYA = [
  'IHSG hari ini berapa?',
  'IHSG sepekan terakhir bagaimana?',
  'Asing net buy atau net sell?',
  'Sektor apa yang paling kuat?',
  'Harga BBCA berapa?',
  'PER BBCA berapa?',
]

/** Pertanyaan susulan yang terlalu pendek untuk berdiri sendiri. Dicocokkan
 *  UTUH, bukan sebagai potongan: "kenapa naik" adalah pertanyaan penuh yang
 *  tak boleh diperlakukan sebagai sambungan. */
const SUSULAN =
  /^(kenapa|mengapa|berapa|kok|detail(nya)?|lanjut(kan|in)?|jelaskan|contoh(nya)?|misalnya|gimana|bagaimana|terus|trus|lalu|apa lagi|lainnya|selanjutnya|terus gimana)\??$/

/** Perubahan persen antara dua titik seri. */
function ubah(seri: TanggalIndex[], mundur: number): number | null {
  if (seri.length < mundur + 1) return null
  const kini = seri[seri.length - 1].ihsg
  const lalu = seri[seri.length - 1 - mundur].ihsg
  return lalu ? ((kini - lalu) * 100) / lalu : null
}

/** Berapa hari bursa beruntun indeks bergerak ke arah yang sama. */
function beruntun(seri: TanggalIndex[]): { arah: 'naik' | 'turun'; hari: number } | null {
  if (seri.length < 3) return null
  const arah = seri[seri.length - 1].ihsg >= seri[seri.length - 2].ihsg ? 'naik' : 'turun'
  let n = 0
  for (let i = seri.length - 1; i > 0; i--) {
    const naikHariItu = seri[i].ihsg >= seri[i - 1].ihsg
    if ((arah === 'naik') !== naikHariItu) break
    n++
  }
  return { arah, hari: n }
}

/** Pertanyaan lanjutan yang wajar sesudah tiap TOPIK PASAR (market-wide) —
 *  ditawarkan sebagai chip, jangan ditebak otomatis (beda dari
 *  SUSULAN/RUAS_SUSULAN yang langsung MENJAWAB kalau orangnya benar-benar
 *  mengetik susulannya). Kalimatnya sengaja sama persis dengan yang sudah
 *  dikenali mesin di tempat lain (CONTOH_TANYA, RUAS_SUSULAN) — bukan gaya
 *  baru yang harus dikenali lagi dari nol. */
const SARAN_PASAR: Partial<Record<Exclude<Topik, null>, string[]>> = {
  ihsg: ['Asing net buy atau net sell?', 'Sektor apa yang paling kuat?'],
  asing: ['IHSG hari ini bagaimana?', 'Sektor apa yang paling kuat?'],
  sektor: ['Saham apa yang paling naik?', 'Asing net buy atau net sell?'],
  gainer: ['Saham apa yang paling turun?', 'Sektor apa yang paling kuat?'],
  loser: ['Saham apa yang paling naik?', 'Sektor apa yang paling kuat?'],
  penggerak: ['IHSG hari ini bagaimana?', 'Saham apa yang paling naik?'],
  valuasi: ['Sektor apa yang paling kuat?', 'IHSG hari ini bagaimana?'],
  broker: ['IHSG hari ini bagaimana?', 'Saham apa yang paling naik?'],
}

/** Ruas per-emiten LAIN yang belum ditanyakan — dipetik dari RUAS yang SAMA
 *  dengan `RUAS_SUSULAN` di atas (bukan daftar baru), supaya kalau ruasnya
 *  nanti bertambah cukup diubah SATU tempat. */
const RUAS_EMITEN: [Exclude<Topik, null>, (kd: string) => string][] = [
  ['hargaEmiten', (kd) => `Harga ${kd}`],
  ['valuasiEmiten', (kd) => `Valuasi ${kd}`],
  ['sektorEmiten', (kd) => `Sektor ${kd}`],
  ['kinerjaEmiten', (kd) => `${kd} setahun terakhir`],
  ['pemilikEmiten', (kd) => `Siapa pemilik ${kd}`],
]

function saranUntuk(topik: Topik | undefined, subjek?: string): string[] | undefined {
  if (topik && subjek && RUAS_EMITEN.some(([tp]) => tp === topik)) {
    return RUAS_EMITEN.filter(([tp]) => tp !== topik).map(([, teks]) => teks(subjek))
  }
  return topik ? SARAN_PASAR[topik] : undefined
}

/**
 * Satu pertanyaan bisa menyebut lebih dari satu emiten, dan mesin ini hanya
 * menjawab yang pertama. Itu boleh — yang tak boleh MENDIAMKANNYA: "harga
 * BBCA sama BBRI berapa" dijawab harga BBCA saja, dan dari layar terbaca
 * seolah BBRI tak punya data.
 *
 * Catatan ditempel di pembungkus, bukan di tiap blok: emiten dijawab dari
 * belasan cabang berbeda dan menambahkannya satu per satu berarti ada yang
 * terlewat sejak hari pertama. Chip `saran` ditempel di sini juga, dari
 * TOPIK/SUBJEK HASIL AKHIR — sama alasannya.
 */
export function jawab(pertanyaan: string, k: KonteksTanya): Jawaban {
  const j = jawabInti(pertanyaan, k)
  if (j.butuh || j.takPaham) return j
  const disebut = kodeDisebut(pertanyaan, k.kamus)
  const lain = disebut.filter((x) => x !== (j.subjek ?? disebut[0]))
  const hasil = lain.length === 0
    ? j
    : { ...j, teks: `${j.teks} (Saya menjawab satu emiten per pertanyaan — untuk ${lain.join(', ')} tanyakan terpisah.)` }
  const saran = saranUntuk(hasil.topik, hasil.subjek)
  return saran ? { ...hasil, saran } : hasil
}

function jawabInti(pertanyaan: string, k: KonteksTanya): Jawaban {
  // Normalisasi dipusatkan di `teksTanya.ts` — sama persis dengan yang dipakai
  // pengetahuan & glosarium, supaya "brp"/"hijau" dikenali ketiganya.
  let t = normalTanya(pertanyaan)
  const h = k.hari

  if (!t.trim()) return { teks: 'Tanyakan sesuatu tentang data pasar hari ini.', takPaham: true }

  // Pertanyaan susulan ("kenapa?", "berapa?") diterjemahkan jadi pertanyaan
  // penuh memakai topik jawaban sebelumnya. Kalau belum ada topiknya, jangan
  // menebak — tanya balik, karena menjawab topik yang salah lebih buruk
  // daripada mengaku tak tahu maksudnya.
  if (SUSULAN.test(t.trim())) {
    if (!k.topik) {
      return { teks: 'Susulan dari yang mana? Tanyakan dulu satu hal — misalnya IHSG, arus asing, atau sektor.', takPaham: true }
    }
    const balik: Record<string, string> = {
      ihsg: 'ihsg', asing: 'asing', sektor: 'sektor', gainer: 'gainer', loser: 'loser',
      penggerak: 'penggerak', valuasi: 'valuasi', edisi: 'edisi', kabar: 'kabar',
      ambang: 'kenapa kuat ambang', lintasWaktu: 'ihsg sepekan',
    }
    // "kenapa" atas topik IHSG artinya: apa yang menggerakkannya hari itu.
    const keIhsgPenggerak = k.topik === 'ihsg' && /kenapa|mengapa|kok/.test(pertanyaan.toLowerCase())
    const lanjut = keIhsgPenggerak ? 'penggerak' : balik[k.topik]

    // Topik PER-EMITEN disambung lewat `subjek` — pertanyaan penuhnya dirakit
    // ulang lalu dijawab dari awal (kodenya kapital, jadi deteksi kode di
    // bawah mengenalinya seperti pertanyaan biasa). `topik: null` mematikan
    // kemungkinan berputar: hasil rakitan tak pernah berupa susulan lagi.
    // Tanpa `subjek` tetap tak ditebak — lihat cabang di bawahnya.
    const perEmiten: Record<string, (kode: string) => string> = {
      hargaEmiten: (kd) => `harga ${kd}`,
      valuasiEmiten: (kd) => `PER PBV ${kd}`,
      sektorEmiten: (kd) => `sektor ${kd}`,
      kinerjaEmiten: (kd) => `${kd} setahun terakhir`,
      pemilikEmiten: (kd) => `siapa pemilik ${kd}`,
      grup: (kd) => `${kd} grup apa`,
    }
    const rakit = k.topik && k.subjek ? perEmiten[k.topik] : undefined
    if (rakit && k.subjek) return jawab(rakit(k.subjek), { ...k, topik: null })

    // Topik per-emiten TANPA subjek: sambungan generik seperti "kenapa?" tak
    // punya cukup konteks untuk tahu emiten mana yang dimaksud. Mengaku tak
    // tahu di sini lebih jujur daripada menjawab emiten yang salah.
    if (!lanjut) {
      return { teks: 'Susulan dari yang mana? Tanyakan dulu satu hal — misalnya IHSG, arus asing, atau sektor.', takPaham: true }
    }
    t = lanjut
  }

  // ── Susulan yang MEMBAWA maksud baru: ganti ruas, atau ganti emiten ──────
  // Dua bentuk yang paling wajar diketik setelah satu jawaban per-emiten, dan
  // dua-duanya dulu meleset: "sektornya?" dijawab sektor SE-PASAR (bukan
  // sektor emiten yang sedang dibahas), dan "kalau BBRI?" dijawab profil
  // peringkat BBRI (bukan ruas yang sedang dibahas). Keduanya dirakit ulang
  // jadi pertanyaan penuh, persis seperti susulan biasa di atas.
  // Awalan tanya opsional ("bagaimana", "gimana", "berapa") — TANPA ini
  // "bagaimana valuasinya?" tak dikenali sebagai susulan sama sekali (cuma
  // "valuasinya?" polos yang cocok), lalu jatuh ke blok valuasi PASAR di
  // bawah dan menjawab PER pasar, bukan PER emiten yang sedang dibahas.
  // ponytail: cuma awalan DI DEPAN yang ditangkap, bukan di belakang
  // ("sektornya bagaimana?") — tambahkan kalau memang ada yang menanyakannya.
  const RUAS_SUSULAN: [RegExp, (kd: string) => string][] = [
    [/^(bagaimana|gimana|berapa)?\s*(harga|harganya)\??$/, (kd) => `harga ${kd}`],
    [/^(bagaimana|gimana|berapa)?\s*(valuasi|valuasinya|per pbv|pe|pernya)\??$/, (kd) => `PER PBV ${kd}`],
    [/^(bagaimana|gimana|berapa)?\s*(sektor|sektornya|industrinya)\??$/, (kd) => `sektor ${kd}`],
    [/^(bagaimana|gimana|berapa)?\s*(pemilik|pemiliknya|pemegang sahamnya)\??$/, (kd) => `siapa pemilik ${kd}`],
    [/^(bagaimana|gimana|berapa)?\s*(grup|grupnya)\??$/, (kd) => `${kd} grup apa`],
    [/^(bagaimana|gimana|berapa)?\s*(setahun|kinerjanya|setahun terakhir)\??$/, (kd) => `${kd} setahun terakhir`],
  ]
  if (k.subjek) {
    const ruas = RUAS_SUSULAN.find(([pola]) => pola.test(t.trim()))
    if (ruas) return jawab(ruas[1](k.subjek), { ...k, topik: null, subjek: null, data: k.data })
  }
  // "kalau BBRI?" — emiten baru, ruas yang sama. Dibatasi kalimat pendek
  // supaya kalimat penuh yang kebetulan memuat kode tak ikut tersapu.
  const gantiSubjek = t.trim().split(' ').length <= 3 ? kodeDisebut(pertanyaan, k.kamus)[0] : undefined
  if (gantiSubjek && gantiSubjek !== k.subjek && k.topik) {
    const perRuas: Record<string, (kd: string) => string> = {
      hargaEmiten: (kd) => `harga ${kd}`,
      valuasiEmiten: (kd) => `PER PBV ${kd}`,
      sektorEmiten: (kd) => `sektor ${kd}`,
      kinerjaEmiten: (kd) => `${kd} setahun terakhir`,
      pemilikEmiten: (kd) => `siapa pemilik ${kd}`,
    }
    const rakitBaru = perRuas[k.topik]
    if (rakitBaru) return jawab(rakitBaru(gantiSubjek), { ...k, topik: null, subjek: null, data: k.data })
  }

  // ── Minta ARTI, bukan angka ──────────────────────────────────────────────
  // "apa itu IHSG" harus dijawab definisinya, bukan angkanya hari ini — jadi
  // blok ini duluan. Kalau ternyata istilahnya tak dikenal, jangan berhenti:
  // jatuh terus ke blok-blok data di bawah, karena "apa itu" juga dipakai
  // orang untuk menanyakan hal yang memang berupa angka.
  if (MINTA_ARTI.test(t)) {
    const j = jawabTeks(pertanyaan)
    if (j) return j
    // Istilahnya tak dikenal. Dulu blok ini jatuh terus ke blok data, dan
    // hasilnya "apa itu indeks sektoral" dijawab angka IHSG hari ini —
    // pertanyaan ARTI dijawab ANGKA. Yang boleh jatuh terus sekarang hanya
    // kalimat yang memang ikut meminta angka.
    if (!punya(t, 'berapa', 'hari ini', 'sekarang')) {
      return {
        teks: 'Istilah itu belum ada di glosarium PAPAN, jadi saya tak mau mengarang artinya. '
          + 'Coba istilah lain, atau tanyakan angkanya langsung.',
        takPaham: true, ke: '/metodologi', keLabel: 'Metodologi & Glosarium',
      }
    }
  }

  // ── Minta rekomendasi/ramalan — dijawab terus terang, bukan dialihkan ─────
  // Lihat catatan MINTA_REKOMENDASI: tanpa blok ini pertanyaan "saham apa yang
  // layak dibeli minggu ini" dijawab angka IHSG sepekan.
  const mintaMetode = /\b(cara|rumus|hitung|menghitung|dihitung)\b/.test(t)
  if (MINTA_REKOMENDASI.test(t) || (MINTA_TARGET.test(t) && !mintaMetode)) {
    const e = PENGETAHUAN.find((x) => x.id === 'bukan-saran-investasi')
    if (e) return { teks: `${e.judul}. ${e.isi}`, ke: e.ke, keLabel: e.keLabel }
  }

  // ── Pertanyaan kapabilitas — dijawab ya/tidak berikut batasnya ────────────
  if (TANYA_KAPABILITAS.test(t)) {
    const absen = ABSEN.find(([pola]) => pola.test(t))
    if (absen) return { teks: absen[1], takPaham: true, ke: '/', keLabel: 'Lihat halaman yang ada' }
  }

  // ── Kenapa disebut kuat/tipis — pertanyaan tentang METODE, bukan angka ───
  if (punya(t, 'kenapa', 'mengapa') && punya(t, 'kuat', 'tipis', 'datar', 'ambang')) {
    return {
      teks:
        `Ambangnya dihitung dari sejarah IHSG, bukan ditebak. Dari ${ASAL_AMBANG.hari_bursa} hari bursa ` +
        `(${ASAL_AMBANG.mulai} sampai ${ASAL_AMBANG.akhir}), gerak ≥ ${rp(ASAL_AMBANG.gerakBesar)}% cuma terjadi ` +
        `di 15% hari teratas — itu yang disebut "kuat". Di bawah ${rp(ASAL_AMBANG.gerakTipis)}% masuk 30% hari ` +
        `paling adem, disebut "nyaris datar".`,
      topik: 'ambang', ke: '/indeks', keLabel: 'Lihat papan IHSG',
    }
  }

  // ── Kalender bursa — "besok libur?" ──────────────────────────────────────
  // Cuma dua sumber jujur: akhir pekan (selalu benar) dan daftar tanggal
  // merah manual (HOLIDAYS di Kalender.tsx) — jadi jawabannya ikut menyebut
  // batasannya sendiri, bukan berpura-pura tahu SELURUH kalender libur
  // nasional.
  if (punya(t, 'besok') && punya(t, 'libur', 'buka', 'bursa')) {
    const { iso, libur, alasan } = besokLiburBursa()
    const label = new Date(`${iso}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
    return {
      teks: libur
        ? `Besok (${label}) bursa tutup — ${alasan}.`
        : `Besok (${label}) bursa buka seperti biasa (kalau tak ada libur nasional mendadak yang belum tercatat di sini).`,
      topik: 'kalender', ke: '/indeks', keLabel: 'Lihat Kalender Bursa',
    }
  }

  // ── Hari yang belum berjalan — tak ada angkanya, dan itu yang dikatakan ───
  // Diperiksa SESUDAH kalender (yang memang boleh menjawab "besok libur?")
  // tapi SEBELUM blok data mana pun, karena hampir semua blok di bawah dengan
  // senang hati menjawabnya memakai angka hari berjalan.
  if (MASA_DEPAN.test(t)) {
    return {
      teks:
        'Belum terjadi, jadi belum ada angkanya. PAPAN menyajikan angka yang sudah tercatat dan metode ' +
        'menghitungnya — tidak ada prakiraan harga, indeks, maupun arah pasar untuk hari yang belum berjalan.',
      takPaham: true, ke: '/chart', keLabel: 'Lihat riwayat di Chart',
    }
  }

  // ── Deteksi kode emiten — dipakai banyak blok di bawah ───────────────────
  // Regex atas TEKS ASLI (bukan `.toUpperCase()`) — kode dianggap disebut
  // HANYA kalau memang diketik kapital, seperti orang menulis ticker
  // ("BBCA", bukan "bbca"). Ini bukan sekadar gaya: kalau teks di-uppercase
  // dulu, kata umum 4 huruf apa pun ("kuat", "data", "atas"...) ikut cocok
  // regex — dan karena blok-blok baru di bawah ini dicek SEBELUM blok
  // market-wide (harus, supaya "PER BBCA" tak dibajak blok valuasi pasar),
  // kata umum yang salah dikira kode akan membajak jawaban market-wide juga
  // ("sektor apa yang kuat?" nyaris terbaca sebagai "sektor emiten KUAT").
  // "IHSG" dikecualikan eksplisit: itu indeks, bukan kode saham, tapi bentuk
  // hurufnya kebetulan cocok kalau memang diketik kapital (lazim) — tanpa
  // pengecualian ini "IHSG sepekan terakhir?" akan dibajak jadi pertanyaan
  // kinerja emiten bernama IHSG.
  // Nama emiten dicoba HANYA kalau regex gagal DAN kamus sudah termuat —
  // pencarian nama (di ~960 emiten) baru jalan waktu benar-benar perlu, dan
  // dicocokkan sebagai FRASA nama perusahaan (bukan kata tunggal), jadi jauh
  // lebih kecil peluang nyangkut ke kalimat yang tak terkait.
  const semuaKode = kodeDisebut(pertanyaan, k.kamus)
  let kode: string | null = semuaKode[0] ?? null
  if (!kode && k.kamus) kode = cariKodeDariNama(k.kamus.emiten, t)

  // ── Membandingkan dua emiten — dikatakan, bukan didiamkan ────────────────
  // "antara BBCA dan BBRI mana yang lebih likuid" dulu dijawab profil BBCA
  // saja. Yang membaca tak punya cara tahu BBRI diabaikan, dan pertanyaannya
  // justru soal perbandingannya.
  if (semuaKode.length > 1 && BANDING.test(t)) {
    return {
      teks: `Saya belum membandingkan dua emiten. Tanyakan satu per satu — ${semuaKode.join(' lalu ')} — ` +
        `atau bandingkan sendiri lewat Stock Detail.`,
      takPaham: true, ke: '/stock-detail', keLabel: 'Buka Stock Detail',
    }
  }

  // ── Skenario "kalau … turun sekian" — itu pekerjaan Kalkulator ───────────
  // Syarat angka melekat di ANDAI: lihat catatannya. Tanpa blok ini "kalau
  // BBCA turun 5% jadi berapa" dijawab profil peringkat harian BBCA.
  if ((ANDAI.test(t) || punya(t, 'berapa lot')) && /\d/.test(t)
    && punya(t, 'harga', 'turun', 'naik', 'beli', 'jual', 'rugi', 'untung', 'tembus', 'sentuh', 'average', 'rata rata', 'lot')) {
    return {
      teks:
        'Skenario harga tidak saya hitung di panel ini. Kalkulator PAPAN menghitungnya: average down, target ' +
        'ARA/ARB, risk-reward, dividen, dan titik pulih — hasilnya dibulatkan ke fraksi harga bursa.',
      takPaham: true, ke: '/kalkulator', keLabel: 'Buka Kalkulator',
    }
  }

  // ── Kepemilikan — "siapa pemilik BBCA?" ──────────────────────────────────
  // Diperiksa SEBELUM blok "siapa" generik: pertanyaan ini juga memuat kata
  // "siapa", tapi TIDAK menanyakan identitas orang seperti direksi/komisaris
  // — ini menanyakan KOMPOSISI kepemilikan publik KSEI, yang datanya memang
  // kita punya (lihat catatan privasi di jawabPemilik: agregat saja, tanpa
  // nama).
  if (kode && /\bsiapa(kah)?\b/.test(t) && punya(t, 'pemilik', 'pemegang saham', 'kepemilikan')) {
    if (k.data && k.data.jenis === 'investor' && k.data.kode === kode) {
      return jawabPemilik(kode, k.data.payload)
    }
    return { butuh: { jenis: 'investor', kode }, teks: `Mengambil data pemegang saham ${kode}…` }
  }

  // ── Pertanyaan tentang ORANG (siapa direktur, siapa komisaris, dst) ─────
  // "siapa" menanyakan identitas, bukan data pasar — dan tahap ini tak punya
  // data personalia sama sekali. Diperiksa SEBELUM blok kode emiten karena
  // pertanyaan macam ini sering ikut menyebut kode ("siapa direktur BBCA?"),
  // dan sekadar menyebut kode tak membuatnya jadi pertanyaan data pasar.
  // `\bsiapa\b` UTUH, bukan awalan: "siapapun bisa jadi kontributor?" bukan
  // pertanyaan personalia, tapi dulu dijawab "belum ada data direksi".
  if (/\bsiapa(kah)?\b/.test(t)) {
    return { teks: 'Belum ada data personalia (direksi/komisaris) di tahap ini — coba tanya soal data pasar.', takPaham: true }
  }

  // ── Grup konglomerat — "grup Salim isinya apa?" / "BBCA grup apa?" ──────
  if (punya(t, 'grup', 'konglomerat') && k.kamus) {
    const namaGrup = Object.keys(k.kamus.grup).find((nm) => t.includes(bersih(nm)))
    if (namaGrup) return jawabGrupNama(namaGrup, k.kamus.grup[namaGrup])
    if (kode) {
      const entry = Object.entries(k.kamus.grup).find(([, g]) => g.kode === kode || g.anggota.some((a) => a.kode === kode))
      if (entry) {
        const [nm, g] = entry
        return { teks: `${kode} bagian dari grup ${nm} (${g.anggota.length} emiten).`, topik: 'grup', subjek: kode, ...linkInvestor }
      }
      return {
        teks: `${kode} tidak teridentifikasi masuk grup konglomerat mana pun (ambang kepemilikan ≥1%).`,
        topik: 'grup', subjek: kode, ...linkInvestor, takPaham: true,
      }
    }
  }

  // ── Harga / valuasi / sektor SATU emiten — dari fundamental/{KODE}.json ──
  // Ketiganya berbagi SATU fetch (jenis 'fundamental') karena satu berkas itu
  // memuat ketiganya sekaligus — tak ada gunanya minta tiga kali.
  if (kode) {
    const sebutHarga = punya(t, 'harga')
    const sebutValuasi = RASIO_PER.test(t) || punya(t, 'pbv', 'valuasi', 'roe')
    const sebutSektor = punya(t, 'sektor', 'industri')
    // Harga & valuasi TERIKAT WAKTU: yang saya punya angka terakhir, bukan
    // arsip per tanggal. "harga BBCA bulan lalu berapa" dijawab harga hari ini
    // — benar sebagai angka, salah sebagai jawaban, dan tak ada penandanya.
    // Sektor sengaja tak ikut: sektor emiten tak berubah harian.
    if ((sebutHarga || sebutValuasi) && (MASA_LALU.test(t) || punya(t, 'kemarin') || REKOR_PENUH.test(t))) {
      return {
        teks: `Saya menjawab dari angka terakhir ${kode}, bukan arsip per tanggal. Riwayat harga per hari ada di ` +
          `Stock Detail dan Chart.`,
        takPaham: true, ...linkEmiten(kode),
      }
    }
    if (sebutHarga || sebutValuasi || sebutSektor) {
      if (k.data && k.data.jenis === 'fundamental' && k.data.kode === kode) {
        const fd = k.data.payload
        if (sebutHarga) return jawabHarga(kode, fd, k.kamus)
        if (sebutValuasi) return jawabValuasi(kode, fd)
        return jawabSektor(kode, fd)
      }
      return { butuh: { jenis: 'fundamental', kode }, teks: `Mengambil data ${kode}…` }
    }
  }

  // ── Kinerja setahun SATU emiten — dari ohlc/{KODE}.json ──────────────────
  if (kode && punya(t, 'setahun', '52 minggu', 'tahun terakhir', '1 tahun')) {
    if (k.data && k.data.jenis === 'ohlc' && k.data.kode === kode) {
      return jawabKinerja(kode, k.data.payload)
    }
    return { butuh: { jenis: 'ohlc', kode }, teks: `Mengambil data ${kode}…` }
  }

  // ── Ruas per emiten yang memang belum dihitung di sini ───────────────────
  // Lihat catatan RUAS_BELUM: tanpa blok ini semuanya jatuh ke keranjang
  // "emiten disebut langsung" dan dijawab profil peringkat yang sama.
  if (kode) {
    // Kinerja per emiten cuma dihitung untuk jendela 365 hari. "sejak awal
    // tahun" adalah jendela LAIN, dan menjawabnya dengan perubahan hari ini
    // (yang dilakukan keranjang di bawah) meleset dua kali: periodenya salah,
    // ruasnya pun bukan yang ditanya.
    if (punya(t, 'sejak awal tahun', 'ytd', 'year to date', 'sejak januari', 'tahun berjalan')) {
      return {
        teks: `Kinerja ${kode} yang saya hitung jendelanya 365 hari terakhir, bukan sejak awal tahun. ` +
          `Tanyakan "${kode} setahun terakhir", atau lihat rentang bebas di Stock Detail.`,
        takPaham: true, ...linkEmiten(kode),
      }
    }
    if (REKOR_PENUH.test(t)) {
      return {
        teks: `Rekor sepanjang masa ${kode} tidak saya hitung di sini — jendela yang saya punya 365 hari `
          + `terakhir (kisaran 52 minggu). Riwayat penuhnya ada di Stock Detail.`,
        takPaham: true, ...linkEmiten(kode),
      }
    }
    const belum = RUAS_BELUM.find(([pola]) => pola.test(t))
    if (belum) {
      return {
        teks: `${belum[1].charAt(0).toUpperCase()}${belum[1].slice(1)} belum saya hitung di panel ini — ` +
          `yang saya punya untuk ${kode}: harga, valuasi (PER/PBV/ROE), sektor, kinerja setahun, dan komposisi ` +
          `pemegang saham KSEI. Angka selengkapnya ada di Stock Detail.`,
        takPaham: true, ...linkEmiten(kode),
      }
    }
  }

  if (!h) {
    return { teks: 'Data hari ini belum termuat. Coba lagi sebentar lagi.', takPaham: true }
  }
  const r = rangkumHari(h)

  // ── Lintas waktu (sepekan, sebulan, beruntun) ───────────────────────────
  // Diperiksa SEBELUM blok "IHSG" karena "IHSG sepekan" memuat kata ihsg juga
  // — kalau urutannya terbalik, pertanyaan rentang selalu dijawab data harian.
  // Blok ini dulu cuma melihat kata rentangnya, dan itu membuat kalimat yang
  // KEBETULAN memuat "minggu"/"berturut" dijawab angka indeks — "cara
  // menghitung target harga setelah ARA tiga hari berturut-turut" dijawab
  // "IHSG naik 29 hari beruntun". Karena itu sekarang pertanyaannya juga harus
  // memang tentang indeks: menyebut pasar/indeks, atau cukup pendek sehingga
  // tak mungkin membawa maksud lain.
  const soalIndeks = !kode && (punya(t, 'ihsg', 'indeks', 'pasar', 'bursa') || t.split(' ').length <= 5)

  // ── Tanggal lain di masa lalu — bukan rentang "sampai sekarang" ──────────
  // "IHSG pekan lalu ditutup di berapa" dijawab "sepekan +0,80%": itu
  // PERUBAHAN, bukan penutupan, dan bukan pekan yang dimaksud. Dipisah lebih
  // dulu supaya blok rentang di bawahnya tetap boleh menjawab "sepekan
  // terakhir" — yang memang rentang sampai hari ini.
  if (soalIndeks && MASA_LALU.test(t)) {
    return {
      teks: `Saya menjawab dari hari bursa terakhir; penutupan per tanggal tertentu tidak saya indeks di sini. ` +
        `Riwayat lengkapnya ada di halaman Chart.`,
      takPaham: true, ke: '/chart', keLabel: 'Lihat chart',
    }
  }

  if (soalIndeks && punya(t, 'pekan', 'minggu', 'bulan', 'beruntun', 'berturut', 'sebulan', 'sepekan', 'ytd', 'tahun berjalan')) {
    const seri = k.seri ?? []
    if (seri.length < 6) {
      return { teks: 'Riwayat indeks belum termuat cukup untuk menghitung rentang.', takPaham: true }
    }
    const sepekan = ubah(seri, 5)
    const sebulan = ubah(seri, 21)
    const ytd = seri.length > 1 ? ((seri[seri.length - 1].ihsg - seri[0].ihsg) * 100) / seri[0].ihsg : null
    const run = beruntun(seri)
    const puncak = seri.reduce((a, b) => (b.ihsg > a.ihsg ? b : a), seri[0])
    const jarak = ((seri[seri.length - 1].ihsg - puncak.ihsg) * 100) / puncak.ihsg

    if (punya(t, 'beruntun', 'berturut') && run) {
      return {
        teks: `IHSG ${run.arah} ${run.hari} hari bursa beruntun sampai penutupan terakhir.`,
        topik: 'lintasWaktu', ke: '/chart', keLabel: 'Lihat chart',
      }
    }
    const bagian = [
      sepekan != null ? `sepekan (5 hari bursa) ${pct(sepekan)}` : null,
      sebulan != null ? `sebulan (21 hari bursa) ${pct(sebulan)}` : null,
      ytd != null ? `tahun berjalan ${pct(ytd)}` : null,
    ].filter(Boolean)
    return {
      teks:
        `IHSG ${bagian.join(', ')}. ` +
        (run ? `Terakhir ${run.arah} ${run.hari} hari beruntun. ` : '') +
        `Sekarang ${pct(jarak)} dari puncak tahun ini (${rp(puncak.ihsg)}, ${puncak.date_id}).`,
      topik: 'lintasWaktu', ke: '/chart', keLabel: 'Lihat chart',
    }
  }

  // ── "IHSG kemarin berapa" — hari LAIN, bukan hari berjalan ───────────────
  // Dulu dijawab ringkasan hari berjalan: angkanya benar, harinya bukan yang
  // ditanya, dan tak ada satu pun penanda bahwa harinya berbeda. Hari
  // sebelumnya diambil dari seri dengan MENCOCOKKAN tanggal hari berjalan
  // dulu — kalau tak ketemu (format tanggal berbeda), lebih baik menunjuk
  // Chart daripada menebak baris mana yang "kemarin".
  if (punya(t, 'kemarin', 'hari sebelumnya')) {
    const s = k.seri ?? []
    const i = s.findIndex((x) => x.date_id === h.date_id)
    const lalu = i > 0 ? s[i - 1] : null
    return lalu
      ? {
        teks: `Penutupan hari bursa sebelumnya (${lalu.date_id}): ${rp(lalu.ihsg)}. ` +
          `Hari berjalan (${h.date_id}) ${rp(h.ihsg_value)}.`,
        topik: 'lintasWaktu', ke: '/chart', keLabel: 'Lihat chart',
      }
      : {
        teks: `Saya menjawab dari hari bursa terakhir (${h.date_id}); penutupan per tanggal lain ada di halaman Chart.`,
        takPaham: true, ke: '/chart', keLabel: 'Lihat chart',
      }
  }

  // ── IHSG / indeks / kondisi pasar ────────────────────────────────────────
  // "bagaimana kondisi pasar sekarang?" adalah pertanyaan pertama yang
  // wajar diketik orang, tapi sempat jatuh ke "belum bisa saya jawab" karena
  // tak menyebut kata "IHSG" sama sekali. Jawabannya sama persis dengan
  // pertanyaan IHSG — ringkasan hari itu memang jawaban untuk keduanya.
  // Pertanyaan kabar sengaja dikecualikan: "berita hari ini tentang IHSG apa"
  // memuat kata IHSG, dan blok ini berdiri lebih dulu — jadi permintaan berita
  // dijawab ringkasan indeks tanpa satu pun berita di dalamnya.
  // Blok ini pemicunya paling lebar di seluruh mesin, dan karena berdiri
  // paling awal ia menyerap pertanyaan yang sebenarnya milik blok lain di
  // bawahnya. Tiga yang terukur: "berita hari ini tentang IHSG apa" (kabar),
  // "brp pbv pasar skrg" — "pasar sekarang" persis salah satu pemicunya —
  // (valuasi), dan "berapa poin BBCA menyumbang ke IHSG" (penggerak).
  const soalKabar = punya(t, 'kabar', 'berita', 'news', 'pengumuman')
  const soalValuasiPasar = RASIO_PER.test(t) || punya(t, 'pbv', 'valuasi')
  const soalPenggerak = punya(t, 'penggerak', 'penyumbang', 'menyumbang', 'sumbangan') || /\bleaders?\b/.test(t)
  if (!soalKabar && !soalValuasiPasar && !soalPenggerak
    && (/\bindeks\b/.test(t) || punya(t, 'ihsg', 'pasar hari ini', 'penutupan', 'kondisi pasar', 'pasar sekarang', 'pasar gimana', 'pasar bagaimana'))) {
    // Ringkasan harian tak memuat volume/frekuensi/kapitalisasi. Menyodorkan
    // ringkasan untuk pertanyaan ruas itu memberi angka yang tak ditanyakan —
    // "berapa volume IHSG hari ini" dijawab "IHSG menguat kuat +1,59%".
    if (punya(t, 'volume', 'frekuensi', 'lembar', 'kapitalisasi', 'market cap')) {
      return {
        teks: 'Volume, frekuensi, dan kapitalisasi tidak ada di ringkasan harian yang saya pakai — yang saya punya ' +
          'penutupan indeks, perubahannya, arus asing, sektor, dan papan peringkat. Angka aktivitas ada di Top Stocks.',
        takPaham: true, ke: '/stocks', keLabel: 'Buka Top Stocks',
      }
    }
    return { teks: `${r.headline}. ${r.ringkasan}`, topik: 'ihsg', ke: '/indeks', keLabel: 'Papan IHSG' }
  }

  // ── Arus asing ───────────────────────────────────────────────────────────
  if (punya(t, 'asing', 'foreign', 'net buy', 'net sell')) {
    // "net buy asing di BBCA berapa" dulu dijawab angka SE-PASAR tanpa satu
    // kata pun yang menandai bedanya — pembaca wajar mengiranya angka BBCA.
    // Angka tingkat pasar bukan jawaban untuk pertanyaan tingkat emiten.
    if (kode) {
      return {
        teks: `Arus asing per emiten belum saya hitung di sini — angka yang saya punya arus asing tingkat pasar, ` +
          `bukan ${kode}. Rincian asing per emiten ada di halaman Stock Detail.`,
        takPaham: true, ...linkEmiten(kode),
      }
    }
    // Kepemilikan asing (persen, dari KSEI) dan ARUS asing (rupiah, harian)
    // adalah dua besaran berbeda yang sama-sama disebut "asing". "berapa
    // persen kepemilikan asing di seluruh pasar" dijawab "net sell Rp1,03
    // triliun" — satuannya pun berbeda.
    if (punya(t, 'kepemilikan', 'pemilik', 'pemegang saham', 'porsi')) {
      return {
        teks: 'Kepemilikan asing (persen, dari KSEI) beda dengan arus asing (rupiah, harian) yang saya punya di '
          + 'sini. Komposisi kepemilikan ada di Peta Investor.',
        takPaham: true, ...linkInvestor,
      }
    }
    // Sama persoalannya satu tingkat di atas: arus asing yang saya punya
    // angka SE-PASAR, bukan per sektor. Menjawabnya tanpa penanda membuat
    // angka pasar terbaca sebagai angka sektor yang ditanya.
    if (punya(t, 'sektor', 'sector')) {
      return {
        teks: 'Arus asing per sektor belum saya hitung — angka yang saya punya arus asing tingkat pasar. ' +
          'Kinerja per sektor ada di halaman Sektor & Indeks.',
        takPaham: true, ke: '/sector', keLabel: 'Sektor & Indeks',
      }
    }
    if (punya(t, 'apa saja', 'saham apa', 'emiten apa', 'yang mana')) {
      return {
        teks: 'Rincian asing beli/jual per emiten belum saya hitung — yang saya punya angka bersihnya di tingkat '
          + 'pasar. Rincian per emiten ada di halaman Stock Detail.',
        takPaham: true, ke: '/stock-detail', keLabel: 'Buka Stock Detail',
      }
    }
    const nf = h.nf_today_idr
    if (nf == null) return { teks: 'Data arus asing hari ini belum ada di berkas harian.', takPaham: true }
    const ytd = h.nf_ytd_idr
    return {
      teks:
        `Asing ${nf < 0 ? 'net sell' : 'net buy'} ${miliar(nf)} hari ini` +
        (ytd != null ? `, dan ${ytd < 0 ? 'net sell' : 'net buy'} ${miliar(ytd)} sepanjang tahun berjalan.` : '.'),
      topik: 'asing', ke: '/indeks', keLabel: 'Lihat Net Foreign',
    }
  }

  // ── Sektor ───────────────────────────────────────────────────────────────
  if (punya(t, 'sektor', 'sector')) {
    // Yang saya punya per sektor cuma perubahan harganya. "PBV sektor
    // healthcare berapa" dijawab daftar sektor terkuat/terlemah — ruas yang
    // ditanya tak ada di dalamnya.
    if (soalValuasiPasar) {
      return {
        teks: 'Valuasi per sektor (PER/PBV) belum saya hitung di sini — yang saya punya perubahan harga per '
          + 'sektor hari ini, dan PER/PBV di tingkat pasar. Rinciannya ada di halaman Sektor & Indeks.',
        takPaham: true, ke: '/sector', keLabel: 'Sektor & Indeks',
      }
    }
    const s = [...(h.sectors ?? [])].sort((a, b) => b.d - a.d)
    if (s.length === 0) return { teks: 'Data sektor hari ini belum ada.', takPaham: true }
    const rapi = (n: string) => n.replace(/^\[[A-Z]\]\s*/, '')
    const naik = s.filter((x) => x.d > 0).length
    return {
      teks:
        `${naik} dari ${s.length} sektor menguat. Terkuat ${rapi(s[0].n)} ${pct(s[0].d)}, ` +
        `terlemah ${rapi(s[s.length - 1].n)} ${pct(s[s.length - 1].d)}.`,
      topik: 'sektor', ke: '/sector', keLabel: 'Sektor & Indeks',
    }
  }

  // ── Saham naik / turun ───────────────────────────────────────────────────
  if (punya(t, 'gainer', 'paling naik', 'top naik', 'naik tertinggi', 'saham naik')) {
    const g = (h.gainers ?? []).slice(0, 3)
    if (g.length === 0) return { teks: 'Daftar gainers hari ini belum ada.', takPaham: true }
    return {
      teks: `Top gainers: ${g.map((x) => `${x.c} ${pct(x.p)}`).join(', ')}.`,
      topik: 'gainer', ke: '/stocks', keLabel: 'Top Stocks',
    }
  }
  if (punya(t, 'loser', 'paling turun', 'turun terdalam', 'saham turun')) {
    const l = (h.losers ?? []).slice(0, 3)
    if (l.length === 0) return { teks: 'Daftar losers hari ini belum ada.', takPaham: true }
    return {
      teks: `Top losers: ${l.map((x) => `${x.c} ${pct(x.p)}`).join(', ')}.`,
      topik: 'loser', ke: '/stocks', keLabel: 'Top Stocks',
    }
  }

  // ── Top Broker — broker paling aktif SE-PASAR (lihat jawabBroker) ────────
  // Dibedakan dari bare "broker" (ditangani CABANG di ujung fungsi kalau tak
  // ada kata rangking): di sini pertanyaannya sudah cukup spesifik untuk
  // dijawab langsung, bukan ditawari cabang tiga arah.
  if (punya(t, 'broker') && punya(t, 'paling aktif', 'teraktif', 'top broker', 'terbesar', 'tersibuk', 'paling banyak')) {
    return jawabBroker(h)
  }

  // ── Penggerak indeks ─────────────────────────────────────────────────────
  // 'kontribusi' TIDAK lagi berdiri sendiri: "cara kontribusi" (soal jadi
  // kontributor) dijawab "Penyumbang terbesar ke IHSG" — benar sebagai angka,
  // sama sekali bukan pertanyaannya. Kata itu baru dihitung kalau memang
  // menunjuk indeks.
  if (soalPenggerak || /kontribusi[^.]*\b(indeks|ihsg)\b/.test(t)) {
    const p = (h.leaders_today ?? []).slice(0, 3)
    if (p.length === 0) return { teks: 'Data penggerak indeks hari ini belum ada.', takPaham: true }
    return {
      teks: `Penyumbang terbesar ke IHSG: ${p.map((x) => `${x.c} ${rp(x.ih)} poin`).join(', ')}.`,
      topik: 'penggerak', ke: '/stocks', keLabel: 'Top Stocks',
    }
  }

  // ── Valuasi pasar ────────────────────────────────────────────────────────
  // `\bper\b`, bukan potongan: dengan `includes('per')` setiap kalimat yang
  // memuat "perlu", "persen", atau "diperbarui" dijawab valuasi pasar.
  if (soalValuasiPasar) {
    if (h.mkt_per == null && h.mkt_pbv == null) return { teks: 'Data valuasi pasar hari ini belum ada.', takPaham: true }
    return {
      teks: `PER pasar ${h.mkt_per == null ? '—' : `${rp(h.mkt_per)}×`}, PBV ${h.mkt_pbv == null ? '—' : `${rp(h.mkt_pbv)}×`} pada penutupan ${h.date_id}.`,
      topik: 'valuasi', ke: '/sector', keLabel: 'Sektor & Indeks',
    }
  }

  // ── Edisi PAPAN ──────────────────────────────────────────────────────────
  if (punya(t, 'edisi', 'bulletin', 'buletin', 'arus pasar', 'pdf')) {
    const e = (k.edisi ?? [])[0]
    if (!e) return { teks: 'Belum ada edisi terbit.', takPaham: true }
    return {
      teks: `Edisi terakhir ${e.kode} — ${e.tanggal_id}, membahas ${e.emiten.length} emiten${e.emiten.length ? `: ${e.emiten.slice(0, 6).join(', ')}${e.emiten.length > 6 ? ', dan lainnya' : ''}` : ''}.`,
      topik: 'edisi', ke: '/bulletin', keLabel: 'Buka Bulletin',
    }
  }

  // ── Kabar ────────────────────────────────────────────────────────────────
  if (punya(t, 'kabar', 'berita', 'news', 'pengumuman')) {
    const b = (k.kabar ?? []).slice(0, 3)
    if (b.length === 0) return { teks: 'Kabar belum termuat.', takPaham: true }
    return {
      teks: `Tiga kabar terbaru: ${b.map((x) => `"${x.judul}" (${x.sumber})`).join('; ')}.`,
      topik: 'kabar', ke: '/kabar', keLabel: 'Semua kabar',
    }
  }

  // ── Emiten disebut langsung (kode ATAU nama, sudah dideteksi di atas) ────
  if (kode) {
    // Satu emiten dijawab dari SEMUA sudut yang kita punya hari itu: posisinya
    // di papan peringkat, kontribusinya ke indeks, edisi yang membahasnya, dan
    // kabar yang menyebutnya. Versi pertama cuma menghitung kemunculan — benar,
    // tapi tak menjawab "bagaimana dia hari ini".
    const bagian: string[] = []
    const g = (h.gainers ?? []).find((x) => x.c === kode)
    const l = (h.losers ?? []).find((x) => x.c === kode)
    if (g) bagian.push(`naik ${pct(g.p)} (Rp${rp(Math.abs(g.td), 0)}) ke ${rp(g.pr, 0)} — masuk top gainers hari ini`)
    if (l) bagian.push(`turun ${pct(l.p)} (Rp${rp(Math.abs(l.td), 0)}) ke ${rp(l.pr, 0)} — masuk top losers hari ini`)

    const lead = (h.leaders_today ?? []).find((x) => x.c === kode)
    const lag = (h.laggards_today ?? []).find((x) => x.c === kode)
    if (lead) bagian.push(`menyumbang ${rp(lead.ih)} poin ke IHSG`)
    if (lag) bagian.push(`menekan IHSG ${rp(Math.abs(lag.ih))} poin`)

    const nilai = (h.top_val ?? []).findIndex((x) => x.c === kode)
    if (nilai >= 0) bagian.push(`peringkat ${nilai + 1} nilai transaksi terbesar`)

    const dariEdisi = (k.edisi ?? []).filter((e) => e.emiten.includes(kode))
    if (dariEdisi.length) bagian.push(`dibahas di ${dariEdisi.length} edisi (terakhir ${dariEdisi[0].kode})`)
    const dariKabar = (k.kabar ?? []).filter((x) => x.emiten.includes(kode) || x.judul.toUpperCase().includes(kode))
    if (dariKabar.length) bagian.push(`disebut di ${dariKabar.length} kabar terbaru`)

    if (bagian.length === 0) {
      return {
        teks: `${kode} tidak masuk papan peringkat hari ini, dan tak disebut di edisi maupun kabar yang termuat. ` +
          `Data lengkap per emiten ada di Stock Detail.`,
        ke: '/stock-detail', keLabel: 'Buka Stock Detail', takPaham: true,
      }
    }
    return { teks: `${kode}: ${bagian.join('; ')}.`, ke: '/stock-detail', keLabel: 'Buka Stock Detail' }
  }

  // ── Jaring terakhir sebelum menyerah: basis teks ─────────────────────────
  // Ditaruh di SINI, bukan di atas, supaya pertanyaan berangka selalu dijawab
  // angka hari berjalan lebih dulu. Baru kalau tak ada blok data yang
  // mengenali pertanyaannya, kata-katanya dicoba dicocokkan ke pengetahuan
  // platform dan glosarium istilah.
  const teks = jawabTeks(pertanyaan)
  if (teks) return teks

  // ── Kata tunggal yang ambigu: TAWARKAN cabangnya, jangan menebak ─────────
  // Ditaruh paling akhir supaya tak pernah membajak pertanyaan yang sudah
  // dikenali blok mana pun. Menebak satu cabang ("broker" → Top Broker) berarti
  // menjawab pertanyaan yang tak ditanyakan, dan pembaca tak punya cara tahu.
  const kataT = t.split(' ').filter(Boolean)
  if (kataT.length <= 3) {
    const ambigu = kataT.find((w) => CABANG[w])
    if (ambigu) return { teks: CABANG[ambigu], takPaham: true }
  }

  // ── Kapabilitas yang tak masuk daftar ABSEN: jawab batas kemampuannya ────
  // "apakah PAPAN bisa X" untuk X yang tak dikenali lebih baik dijawab dengan
  // daftar apa yang bisa dan tak bisa, daripada dengan "belum bisa saya jawab"
  // yang tak memberi tahu apa pun tentang batasnya.
  if (TANYA_KAPABILITAS.test(t) && punya(t, 'papan', 'kamu', 'situs ini', 'aplikasi ini', 'di sini', 'fitur')) {
    const e = PENGETAHUAN.find((x) => x.id === 'batas-kemampuan')
    if (e) return { teks: `${e.judul}. ${e.isi}`, takPaham: true }
  }

  return {
    teks:
      'Belum bisa saya jawab. Tahap ini menjawab dari data yang sudah dihitung — ' +
      'coba tanya soal IHSG, arus asing, sektor, saham yang naik/turun, valuasi, edisi, atau kabar.',
    takPaham: true,
  }
}
