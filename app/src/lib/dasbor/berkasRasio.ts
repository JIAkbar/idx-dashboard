/**
 * Blok F — pengelompokan 94 rasio fundamental jadi layar yang bisa dibaca.
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
 * ## Yang TIDAK dilakukan di sini
 *
 * Rasio yang kosong DIBIARKAN kosong. Rancangan menyebut kemungkinan menambal
 * dari sumber cadangan, tapi menjahit dua sumber angka keuangan menuntut
 * keputusan pemilik data lebih dulu — lengkap dengan tabel pembanding — dan
 * itu belum diambil. Kosong yang terlihat lebih murah daripada angka dari
 * sumber lain yang menyamar jadi angka sumber utama.
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
}

export interface KelompokTerisi {
  kunci: string
  judul: string
  baris: BarisRasio[]
  /** Berapa rasio di kelompok ini yang sumbernya tak punya nilainya. */
  kosong: number
}

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
export function susunRasio(rasio: Record<string, unknown> | null | undefined): {
  kelompok: KelompokTerisi[]
  totalTerisi: number
  totalKosong: number
} {
  const r = rasio ?? {}
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
      if (adaNilai(v)) baris.push({ nama, nilai: String(v) })
      else kosong += 1
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

  return { kelompok, totalTerisi, totalKosong }
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
