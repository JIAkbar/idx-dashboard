import type { DataHarian, TanggalIndex } from './dataHarian'
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
export type Topik = 'ihsg' | 'asing' | 'sektor' | 'gainer' | 'loser' | 'penggerak'
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
}

const rp = (n: number, des = 2) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: des, maximumFractionDigits: des })

const pct = (n: number) => `${n >= 0 ? '+' : '−'}${rp(Math.abs(n))}%`

const miliar = (n: number) =>
  Math.abs(n) >= 1000 ? `Rp${rp(Math.abs(n) / 1000)} triliun` : `Rp${rp(Math.abs(n), 0)} miliar`

const bersih = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
const punya = (t: string, ...kata: string[]) => kata.some((k) => t.includes(k))

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

function jawabSektor(kode: string, fd: StockFundamental | null): Jawaban {
  if (!fd || !fd.sector) return { teks: `Data sektor ${kode} belum ada.`, takPaham: true, topik: 'sektorEmiten', ...linkEmiten(kode) }
  return { teks: `${kode} — sektor ${fd.sector}${fd.industry ? `, industri ${fd.industry}` : ''}.`, topik: 'sektorEmiten', ...linkEmiten(kode) }
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
function saring(s: string): string {
  return s
    // Kurung yang memuat nama berkas: "(lihat `arus-pasar/pcd.py`)".
    .replace(/\s*\([^)]*\.(?:py|ts|tsx|js|mjs|json|md|sql|ya?ml)\b[^)]*\)/gi, '')
    .replace(/`/g, '')
    .replace(/\s+([.,;])/g, '$1')
    .trim()
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
  /\b(rekomendasi|layak (di)?beli|saham bagus|bagus (ga|gak|tidak|enggak)|beli apa|harus beli|jual apa|prediksi|ramalan|prospek besok|gorengan)\b/i

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

export function jawab(pertanyaan: string, k: KonteksTanya): Jawaban {
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

  // ── Minta ARTI, bukan angka ──────────────────────────────────────────────
  // "apa itu IHSG" harus dijawab definisinya, bukan angkanya hari ini — jadi
  // blok ini duluan. Kalau ternyata istilahnya tak dikenal, jangan berhenti:
  // jatuh terus ke blok-blok data di bawah, karena "apa itu" juga dipakai
  // orang untuk menanyakan hal yang memang berupa angka.
  if (MINTA_ARTI.test(t)) {
    const j = jawabTeks(pertanyaan)
    if (j) return j
  }

  // ── Minta rekomendasi/ramalan — dijawab terus terang, bukan dialihkan ─────
  // Lihat catatan MINTA_REKOMENDASI: tanpa blok ini pertanyaan "saham apa yang
  // layak dibeli minggu ini" dijawab angka IHSG sepekan.
  if (MINTA_REKOMENDASI.test(t)) {
    const e = PENGETAHUAN.find((x) => x.id === 'bukan-saran-investasi')
    if (e) return { teks: `${e.judul}. ${e.isi}`, ke: e.ke, keLabel: e.keLabel }
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
  let kode = pertanyaan.match(/\b[A-Z]{4}\b/)?.[0] ?? null
  if (kode === 'IHSG') kode = null
  if (!kode && k.kamus) kode = cariKodeDariNama(k.kamus.emiten, t)

  // ── Kepemilikan — "siapa pemilik BBCA?" ──────────────────────────────────
  // Diperiksa SEBELUM blok "siapa" generik: pertanyaan ini juga memuat kata
  // "siapa", tapi TIDAK menanyakan identitas orang seperti direksi/komisaris
  // — ini menanyakan KOMPOSISI kepemilikan publik KSEI, yang datanya memang
  // kita punya (lihat catatan privasi di jawabPemilik: agregat saja, tanpa
  // nama).
  if (kode && punya(t, 'siapa') && punya(t, 'pemilik', 'pemegang saham', 'kepemilikan')) {
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
  if (punya(t, 'siapa')) {
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
    const sebutValuasi = /\bper\b/.test(t) || punya(t, 'pbv', 'valuasi', 'roe')
    const sebutSektor = punya(t, 'sektor', 'industri')
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

  // ── IHSG / indeks / kondisi pasar ────────────────────────────────────────
  // "bagaimana kondisi pasar sekarang?" adalah pertanyaan pertama yang
  // wajar diketik orang, tapi sempat jatuh ke "belum bisa saya jawab" karena
  // tak menyebut kata "IHSG" sama sekali. Jawabannya sama persis dengan
  // pertanyaan IHSG — ringkasan hari itu memang jawaban untuk keduanya.
  if (punya(t, 'ihsg', 'indeks', 'pasar hari ini', 'penutupan', 'kondisi pasar', 'pasar sekarang', 'pasar gimana', 'pasar bagaimana')) {
    return { teks: `${r.headline}. ${r.ringkasan}`, topik: 'ihsg', ke: '/indeks', keLabel: 'Papan IHSG' }
  }

  // ── Arus asing ───────────────────────────────────────────────────────────
  if (punya(t, 'asing', 'foreign', 'net buy', 'net sell')) {
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

  // ── Penggerak indeks ─────────────────────────────────────────────────────
  // 'kontribusi' TIDAK lagi berdiri sendiri: "cara kontribusi" (soal jadi
  // kontributor) dijawab "Penyumbang terbesar ke IHSG" — benar sebagai angka,
  // sama sekali bukan pertanyaannya. Kata itu baru dihitung kalau memang
  // menunjuk indeks.
  if (punya(t, 'penggerak', 'leader', 'penyumbang') || /kontribusi[^.]*\b(indeks|ihsg)\b/.test(t)) {
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
  if (/\bper\b/.test(t) || punya(t, 'pbv', 'valuasi')) {
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
    if (g) bagian.push(`naik ${pct(g.p)} ke ${rp(g.pr, 0)} — masuk top gainers hari ini`)
    if (l) bagian.push(`turun ${pct(l.p)} ke ${rp(l.pr, 0)} — masuk top losers hari ini`)

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

  return {
    teks:
      'Belum bisa saya jawab. Tahap ini menjawab dari data yang sudah dihitung — ' +
      'coba tanya soal IHSG, arus asing, sektor, saham yang naik/turun, valuasi, edisi, atau kabar.',
    takPaham: true,
  }
}
