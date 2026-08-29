/**
 * Blok F — pengelompokan rasio fundamental jadi layar yang bisa dibaca.
 *
 * JUMLAHNYA BERBEDA ANTAR EMITEN. Peta di bawah memuat 94 nama (semua yang
 * pernah muncul), tapi satu emiten belum tentu punya semuanya — META, PLIN,
 * dan SMCB masing-masing 91. Karena itu layar memakai `totalTerisi` yang
 * dihitung per emiten, bukan angka tetap; menulis "94 rasio" di teks mana pun
 * akan salah untuk sebagian emiten.
 *
 * Rancangan (artifact "Berkas Emiten", blok F): *"94 rasio fundamental,
 * dikelompokkan: valuasi · profitabilitas · utang · pertumbuhan"*.
 *
 * ## Kenapa pengelompokannya ditulis tangan, bukan ditebak dari namanya
 *
 * Nama rasio tak cukup memberi tahu ia milik kelompok mana. "Free cash flow
 * (Quarter)" ada di kelompok utang-likuiditas sementara "Free cash flow (TTM)"
 * di kelompok ukuran; "Rank (P/B)" itu valuasi walau namanya peringkat. Peta
 * yang ditebak dari kata kunci akan salah di belasan tempat tanpa ada yang
 * sadar — dan rasio yang salah kelompok dibaca sebagai jawaban atas pertanyaan
 * yang berbeda.
 *
 * ## Rasio bank dipisah, dan itu bukan kosmetik
 *
 * NPL, CAR, LDR, CASA, NIM, dan Cost of Credit tak punya arti untuk emiten
 * non-bank — di sana nilainya kosong. Menyebarnya ke kelompok umum membuat
 * setiap emiten manufaktur memajang enam baris kosong. Dikelompokkan sendiri,
 * kelompoknya cukup disembunyikan.
 *
 * ## Tambalan dari sumber cadangan — tiga ruas, dan cuma tiga
 *
 * Johan 29 Agu 2026: *"rasio kosong di tambal data dari mana perlu di sebutkan
 * itu penting sumber nya"*. Izin menambal diberikan dengan satu syarat yang
 * dipenuhi di sini: angka tambalan SELALU membawa nama sumbernya.
 *
 * Yang boleh ditambal ditentukan pengukuran, bukan ketersediaan. Dibandingkan
 * pada emiten yang KEDUA sumbernya punya nilainya:
 *
 *     rasio                          n     median   dalam ±5%
 *     Dividend (TTM)               410     1,0000     88%   → ditambal
 *     Current Book Value Per Share 954     1,0000     83%   → ditambal
 *     Dividend                     406     1,0000     78%   → ditambal
 *     Return on Equity ×100        957     0,979      42%   → DITOLAK
 *     Payout Ratio ×100            287     0,962      15%   → DITOLAK
 *     Return on Assets ×100        888     1,010       7%   → DITOLAK
 *
 * Tiga yang ditolak bukan soal satuan — sesudah dikali 100 pun sebarannya
 * tetap lebar, karena keduanya menghitung periode yang berbeda (TTM vs
 * kuartal, tanggal laporan tak sama). Angka yang median-nya mendekati satu
 * tapi meleset di enam dari sepuluh emiten bukan pengganti; ia tebakan yang
 * kebetulan benar separuh waktu.
 *
 * Sisanya tetap DIBIARKAN kosong. Kosong yang terlihat lebih murah daripada
 * angka sumber lain yang menyamar jadi angka sumber utama.
 */

export interface KelompokRasio {
  kunci: string
  judul: string
  /** Nama rasio APA ADANYA dari sumber, urut tampil. */
  isi: string[]
  /** Kelompok yang hanya berlaku untuk sebagian emiten — disembunyikan utuh
   *  saat semua isinya kosong, bukan dipajang sebagai deretan garis. */
  bersyarat?: boolean
}

export const KELOMPOK_RASIO: KelompokRasio[] = [
  {
    kunci: 'valuasi',
    judul: 'Valuasi — mahal atau murah',
    isi: [
      'Current PE Ratio (TTM)', 'Current PE Ratio (Annualised)', 'Forward PE Ratio',
      'IHSG PE Ratio TTM (Median)', 'PEG Ratio', 'PEG Ratio (3yr)', 'PEG (Forward)',
      'Current Price to Book Value', 'Current Price to Sales (TTM)',
      'Current Price To Cashflow (TTM)', 'Current Price To Free Cashflow (TTM)',
      'EV to EBIT (TTM)', 'EV to EBITDA (TTM)', 'Earnings Yield (TTM)',
    ],
  },
  {
    kunci: 'persaham',
    judul: 'Per saham',
    isi: [
      'Current EPS (TTM)', 'Current EPS (Annualised)', 'Current Book Value Per Share',
      'Revenue Per Share (TTM)', 'Cash Per Share (Quarter)', 'Free Cashflow Per Share (TTM)',
    ],
  },
  {
    kunci: 'profit',
    judul: 'Profitabilitas — seberapa untung',
    isi: [
      'Return on Equity (TTM)', 'Return on Assets (TTM)',
      'Return on Capital Employed (TTM)', 'Return On Invested Capital (TTM)',
      'Gross Profit Margin (Quarter)', 'Operating Profit Margin (Quarter)',
      'Net Profit Margin (Quarter)',
    ],
  },
  {
    kunci: 'utang',
    judul: 'Utang & likuiditas — seberapa tahan',
    isi: [
      'Debt to Equity Ratio (Quarter)', 'LT Debt/Equity (Quarter)',
      'Total Liabilities/Equity (Quarter)', 'Total Debt/Total Assets (Quarter)',
      'Financial Leverage (Quarter)', 'Interest Coverage (TTM)',
      'Current Ratio (Quarter)', 'Quick Ratio (Quarter)',
      'Free cash flow (Quarter)', 'Altman Z-Score (Modified)',
    ],
  },
  {
    kunci: 'tumbuh',
    judul: 'Pertumbuhan — arah tahun ke tahun',
    isi: [
      'Revenue (Quarter YoY Growth)', 'Gross Profit (Quarter YoY Growth)',
      'Net Income (Quarter YoY Growth)',
    ],
  },
  {
    kunci: 'bank',
    judul: 'Khusus bank & lembaga keuangan',
    bersyarat: true,
    isi: [
      'NPL - Gross', 'NPL - Coverage', 'Capital Adequacy Ratio',
      'Loan to Deposit Ratio', 'CASA Ratio', 'Net Interest Margin (NIM)',
      'Cost of Credit',
    ],
  },
  {
    kunci: 'efisiensi',
    judul: 'Efisiensi modal kerja',
    bersyarat: true,
    isi: [
      'Asset Turnover (TTM)', 'Inventory Turnover (TTM)', 'Receivables Turnover (Quarter)',
      'Days Sales Outstanding (Quarter)', 'Days Inventory (Quarter)',
      'Days Payables Outstanding (Quarter)', 'Cash Conversion Cycle (Quarter)',
    ],
  },
  {
    kunci: 'dividen',
    judul: 'Dividen',
    bersyarat: true,
    isi: [
      'Dividend Yield', 'Dividend (TTM)', 'Dividend', 'Payout Ratio',
      'Latest Dividend Ex-Date',
    ],
  },
  {
    kunci: 'skor',
    judul: 'Skor & peringkat penyedia data',
    isi: [
      'Piotroski F-Score', 'Altman Z-Score (Modified)', 'EPS Rating',
      'Relative Strength Rating', 'Rank (Market Cap)', 'Rank (Current PE Ratio TTM)',
      'Rank (Earnings Yield)', 'Rank (P/S)', 'Rank (P/B)', 'Rank (Near 52 Weeks High)',
    ],
  },
  {
    kunci: 'ukuran',
    judul: 'Ukuran — angka mutlak',
    isi: [
      'Revenue (TTM)', 'Gross Profit (TTM)', 'EBITDA (TTM)', 'Net Income (TTM)',
      'Total Assets (Quarter)', 'Total Liabilities (Quarter)', 'Total Equity',
      'Common Equity', 'Cash (Quarter)', 'Working Capital (Quarter)',
      'Cash From Operations (TTM)', 'Cash From Investing (TTM)',
      'Cash From Financing (TTM)', 'Capital expenditure (TTM)', 'Free cash flow (TTM)',
    ],
  },
  {
    kunci: 'return',
    judul: 'Return harga',
    isi: [
      '1 Week Price Returns', '1 Month Price Returns', '3 Month Price Returns',
      '6 Month Price Returns', 'Year to Date Price Returns', '1 Year Price Returns',
      '3 Year Price Returns', '5 Year Price Returns', '10 Year Price Returns',
      '52 Week High', '52 Week Low',
    ],
  },
]

export interface BarisRasio {
  nama: string
  nilai: string
  /** Diisi HANYA bila nilainya datang dari sumber cadangan. Kosong berarti
   *  angka sumber utama — dan penyaji wajib menampilkan ruas ini saat ada,
   *  bukan memilih menampilkannya. */
  sumber?: string
}

export interface KelompokTerisi {
  kunci: string
  judul: string
  baris: BarisRasio[]
  /** Berapa rasio di kelompok ini yang sumbernya tak punya nilainya. */
  kosong: number
}

/**
 * Rasio yang boleh ditambal → nama ruas di sumber cadangan.
 *
 * Daftar ini SENGAJA pendek. Menambahkannya menuntut pengukuran yang sama
 * dengan tiga yang sudah ada: median rasio hitung-ulang harus 1,0000 dan
 * setidaknya tiga dari empat emiten meleset kurang dari 5%.
 */
export const TAMBALAN: Record<string, string> = {
  'Dividend (TTM)': 'dividend_ttm',
  'Dividend': 'dividend',
  'Current Book Value Per Share': 'bv',
}

/** Nama sumber cadangan sebagaimana dicetak ke pembaca — nama penyedia,
 *  bukan nama berkas atau ruas internal.
 *
 *  Diukur 29 Agu 2026 atas 966 berkas cadangan (index.json tak dihitung):
 *
 *      bv            0 berkas tercatat turunan
 *      dividend      0
 *      dividend_ttm  3  — META, PLIN, SMCB
 *
 *  Jadi label ini benar untuk hampir semua emiten, TAPI bukan untuk semua —
 *  dan tiga emiten itulah alasan `NAMA_CADANGAN_TURUNAN` di bawah bukan
 *  jaga-jaga teoretis melainkan jalur yang benar-benar dipakai.
 *
 *  Versi pertama komentar ini menulis "tak satu pun", karena pengukurannya
 *  memotong daftar di 12 teratas dan `dividend_ttm` terdorong keluar potongan
 *  (ruas yang sama terpecah dua baris: dari-laporan-keuangan dan dihitung).
 *  Kelas cacat yang sama dengan komentar yang menyatakan sesuatu tentang data
 *  lalu datanya bergerak — di sini bahkan datanya tak bergerak, hitungannya
 *  yang terpotong. */
export const NAMA_CADANGAN = 'Yahoo Finance'

/** Dipakai saat ruas cadangan ternyata BUKAN angka penyedianya, melainkan
 *  hasil hitungan dari laporan keuangan. Menyebut nama penyedia untuk angka
 *  semacam itu adalah label yang bohong — dan label sumber yang salah lebih
 *  buruk daripada tak menyebut sumber sama sekali. */
export const NAMA_CADANGAN_TURUNAN = 'dihitung dari laporan keuangan'

/** Nilai yang berarti "tak ada", bukan nol. Sumbernya memakai beberapa bentuk
 *  untuk hal yang sama, dan membacanya sebagai teks apa adanya akan memajang
 *  "-" sebagai kalau itu angka. */
function adaNilai(v: unknown): boolean {
  if (v === null || v === undefined) return false
  const s = String(v).trim()
  return s !== '' && s !== '-' && s !== 'N/A' && s !== 'null'
}

/**
 * Susun 94 rasio jadi kelompok siap tampil.
 *
 * Rasio yang TIDAK ada di peta tetap ikut, dikumpulkan di kelompok terakhir —
 * kalau sumbernya menambah ruas baru, ia muncul di layar alih-alih hilang
 * tanpa jejak. Peta yang diam-diam membuang ruas asing adalah cara paling
 * rapi kehilangan data baru.
 */
export function susunRasio(
  rasio: Record<string, unknown> | null | undefined,
  /** Sumber cadangan; dipakai HANYA untuk ruas di `TAMBALAN` yang sumber
   *  utamanya kosong, dan hasilnya selalu ditandai. */
  cadangan?: Record<string, unknown> | null,
): {
  kelompok: KelompokTerisi[]
  totalTerisi: number
  totalKosong: number
  /** Berapa nilai yang datang dari cadangan — dipakai penyaji untuk menyebut
   *  sumbernya sekali di kepala blok, bukan mengulanginya di tiap baris. */
  totalTambalan: number
} {
  const r = rasio ?? {}
  const cad = cadangan ?? {}
  let totalTambalan = 0
  const sudah = new Set<string>()
  const kelompok: KelompokTerisi[] = []
  let totalTerisi = 0
  let totalKosong = 0

  for (const k of KELOMPOK_RASIO) {
    const baris: BarisRasio[] = []
    let kosong = 0
    for (const nama of k.isi) {
      sudah.add(nama)
      const v = r[nama]
      if (adaNilai(v)) {
        baris.push({ nama, nilai: String(v) })
        continue
      }
      const ruasCad = TAMBALAN[nama]
      const vc = ruasCad ? cad[ruasCad] : undefined
      if (adaNilai(vc)) {
        // Sumber cadangan mencatat sendiri ruas mana yang bukan angka
        // penyedianya. Labelnya mengikuti catatan itu, bukan asumsi — kalau
        // suatu saat ruas ini jadi turunan, namanya ikut berubah sendiri.
        const asal = (cad.asal_turunan ?? {}) as Record<string, unknown>
        const turunan = ruasCad != null && asal[ruasCad] != null
        baris.push({
          nama,
          nilai: String(vc),
          sumber: turunan ? NAMA_CADANGAN_TURUNAN : NAMA_CADANGAN,
        })
        totalTambalan += 1
      } else {
        kosong += 1
      }
    }
    totalTerisi += baris.length
    totalKosong += kosong
    // Kelompok bersyarat yang kosong seluruhnya tak ditampilkan; kelompok
    // biasa tetap muncul supaya pembaca tahu ia diperiksa dan hasilnya nihil.
    if (baris.length === 0 && k.bersyarat) continue
    kelompok.push({ kunci: k.kunci, judul: k.judul, baris, kosong })
  }

  const sisa = Object.keys(r).filter((n) => !sudah.has(n) && adaNilai(r[n]))
  if (sisa.length > 0) {
    kelompok.push({
      kunci: 'lain',
      judul: 'Ruas lain dari sumber',
      baris: sisa.map((n) => ({ nama: n, nilai: String(r[n]) })),
      kosong: 0,
    })
    totalTerisi += sisa.length
  }

  return { kelompok, totalTerisi, totalKosong, totalTambalan }
}

/**
 * Muat 94 rasio mentah satu emiten.
 *
 * Berkas yang sama dibaca `rasioTambahanKeystats.ts`, tapi fungsi di sana
 * mengembalikan tiga bagian olahan (bank, peringkat, profil) — bukan peta
 * rasio mentahnya. Blok F butuh yang mentah, jadi pemuatnya sendiri; cache
 * peramban yang menyatukan keduanya, bukan kode.
 */
export async function muatRasio(kode: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`/data-idx/json/keystats_stockbit/${kode.toUpperCase()}.json`)
    if (!r.ok) return null
    const j = (await r.json()) as { rasio?: Record<string, unknown> }
    return j?.rasio ?? null
  } catch {
    // Sengaja diam: blok ini tambahan, dan halaman tetap berguna tanpanya.
    return null
  }
}
