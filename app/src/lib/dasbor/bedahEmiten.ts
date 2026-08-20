import type { StockFundamental, YearMap, QuarterMap } from './stockDetailData'

/**
 * Hitungan halaman **Bedah Emiten** (backlog A2 / #153) — semuanya fungsi
 * murni supaya bisa diuji vitest dan dibantah pembaca. Yang di sini menghitung;
 * yang merender ada di `views/dasbor/BedahEmiten.tsx`.
 *
 * ## Tiga jebakan yang sudah pernah merusak angka di proyek ini
 *
 * 1. **`keuangan/` (yfinance) DISKRET, `keuangan_idx/` (XBRL bursa) KUMULATIF**,
 *    keduanya berkunci tanggal yang sama. Halaman ini karena itu **tidak pernah
 *    menggabungkan** keduanya untuk ruas ARUS (pendapatan, laba, arus kas):
 *    seluruh angka arus di sini datang dari SATU sumber saja —
 *    `fundamental/{KODE}.json` (`ttm_*`, `hist_*`, `q_*`, semuanya turunan
 *    yfinance yang sudah diskret). Penggabungan dua sumber cuma dilakukan di
 *    panel Laporan Keuangan yang memang sudah punya aturannya sendiri
 *    (`fundamentalGabungan.ts`).
 *
 * 2. **Skala rasio berbeda-beda di berkas yang SAMA** — dan namanya tak
 *    memberi tahu. Terukur langsung dari berkas BBCA/TLKM/ASII 20 Agu 2026:
 *
 *    | Ruas | Skala | Contoh BBCA |
 *    |---|---|---|
 *    | `roe`, `roa`, `npm`, `gpm`, `opm`, `roic`, `roce`, `payout_ratio` | RASIO | `roe` 0,21818 |
 *    | `hist_roe` | **PERSEN** | 2024 → 20,88 |
 *    | `der` | **PERSEN** | 0,81 |
 *    | `der_q` | RASIO | 0,0081 |
 *    | `dividend_yield`, `float_pct`, `rev_yoy`, `ni_yoy`, `pe_vs_sector_pct` | PERSEN | `dividend_yield` 5,61 |
 *
 *    `roe` dan `hist_roe` beda skala **100×** walau namanya sekeluarga —
 *    menurunkan salah satu dari yang lain tanpa mengukur dulu memberi angka
 *    yang salah seratus kali lipat tanpa satu pun galat.
 *
 * 3. **Emiten berdata kurang tak diberi vonis.** Tiap fungsi di bawah
 *    mengembalikan `null` + `alasan` yang bisa dibaca, tak pernah 0.
 */

/* ────────────────────────────── satuan ────────────────────────────── */

/** Angka yang benar-benar bisa dipakai; `0` yang berarti "tak dilaporkan"
 *  disaring di pemanggilnya, bukan di sini. */
export function ada(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v)
}

/** Rasio (0,218) → persen (21,8). */
export function keP(v: number | null | undefined): number | null {
  return ada(v) ? v * 100 : null
}

/**
 * Marjin yang dilaporkan tepat `0` diperlakukan sebagai TAK ADA, bukan nol.
 * Bank tidak melaporkan laba kotor sama sekali (BBCA `gpm` 0,0 dan
 * `ebitda_margin` 0,0) — memajangnya sebagai "0,0%" memberi tahu pembaca
 * sesuatu yang tidak benar tentang emitennya.
 */
export function marjin(v: number | null | undefined): number | null {
  return ada(v) && v !== 0 ? v * 100 : null
}

/**
 * DER selalu dikembalikan dalam **persen**. `der` sudah persen; `der_q` rasio
 * dan karena itu dikali 100. Terukur beda 99,4× median di 514 emiten — memilih
 * salah satunya tanpa mengubah skala memberi angka yang terlihat wajar.
 */
export function derPersen(fd: StockFundamental): { nilai: number | null; sumber: 'ttm' | 'kuartal' | null } {
  if (ada(fd.der)) return { nilai: fd.der, sumber: 'ttm' }
  if (ada(fd.der_q)) return { nilai: fd.der_q * 100, sumber: 'kuartal' }
  return { nilai: null, sumber: null }
}

/* ─────────────────────── deret tahunan & kuartalan ─────────────────────── */

export interface TitikTahun {
  tahun: string
  nilai: number
}

/** Deret tahunan terurut NAIK. Kunci di berkasnya tidak terurut (BBCA
 *  `hist_roe` datang sebagai 2023, 2022, 2024) — membacanya apa adanya
 *  membuat grafik dan CAGR menghitung mundur tanpa satu pun galat. */
export function deretTahun(map: YearMap | undefined, ambil = 5): TitikTahun[] {
  if (!map) return []
  return Object.entries(map)
    .filter(([, v]) => ada(v))
    .map(([tahun, nilai]) => ({ tahun, nilai }))
    .sort((a, b) => a.tahun.localeCompare(b.tahun))
    .slice(-ambil)
}

export interface TitikKuartal {
  /** `"2026-Q2"` — bisa diurut sebagai teks. */
  kunci: string
  tahun: string
  q: string
  nilai: number
}

/** Deret kuartal terurut naik, `ambil` kuartal terakhir. */
export function deretKuartal(map: QuarterMap | undefined, ambil = 8): TitikKuartal[] {
  if (!map) return []
  const out: TitikKuartal[] = []
  for (const [tahun, isi] of Object.entries(map)) {
    for (const [q, nilai] of Object.entries(isi ?? {})) {
      if (ada(nilai)) out.push({ kunci: `${tahun}-${q}`, tahun, q, nilai })
    }
  }
  return out.sort((a, b) => a.kunci.localeCompare(b.kunci)).slice(-ambil)
}

/**
 * CAGR persen dari titik pertama ke titik terakhir sebuah deret.
 *
 * `null` kalau titik awal **atau** akhir tidak positif. Emiten yang berbalik
 * dari rugi ke laba secara matematis tak punya CAGR (akar pangkat dari angka
 * negatif), dan memaksakan angka di situ — mis. memakai nilai mutlak —
 * menghasilkan "pertumbuhan 40%/tahun" untuk emiten yang justru baru pulih
 * dari kerugian.
 */
export function cagr(deret: TitikTahun[]): number | null {
  if (deret.length < 2) return null
  const awal = deret[0].nilai
  const akhir = deret[deret.length - 1].nilai
  const n = deret.length - 1
  if (awal <= 0 || akhir <= 0) return null
  return (Math.pow(akhir / awal, 1 / n) - 1) * 100
}

/** Perubahan persen dua titik terakhir deret tahunan. */
export function yoyDeret(deret: TitikTahun[]): number | null {
  if (deret.length < 2) return null
  const sebelum = deret[deret.length - 2].nilai
  const kini = deret[deret.length - 1].nilai
  if (sebelum === 0) return null
  return ((kini - sebelum) / Math.abs(sebelum)) * 100
}

/* ────────────────────── seksi 4 · Money Flow 5 langkah ────────────────────── */

export type SatuanLangkah = 'uang' | 'perlembar'

export interface LangkahFlow {
  id: 'revenue' | 'laba' | 'eps' | 'cfo' | 'dps'
  label: string
  /** Apa yang dijawab langkah ini — kalimat, bukan singkatan. */
  arti: string
  nilai: number | null
  satuan: SatuanLangkah
  /** Persen; `null` = pembandingnya tak tersedia, bukan 0%. */
  yoy: number | null
  /** Periode angkanya, ditulis apa adanya di layar. */
  periode: string
}

/**
 * Lima langkah uang berjalan: penjualan → laba → laba per lembar → kas yang
 * benar-benar masuk → yang dibagikan ke pemegang saham. Yang membuatnya
 * berguna bukan kelima angkanya, melainkan **rasio antar langkah** (lihat
 * `sambunganFlow`): laba yang tak diikuti kas, atau dividen yang melampaui
 * laba, hanya terlihat kalau dua langkah disandingkan.
 *
 * Semua dari `fundamental/` (TTM yfinance) — satu sumber, tak dicampur dengan
 * XBRL kumulatif.
 */
export function langkahMoneyFlow(fd: StockFundamental): LangkahFlow[] {
  const eps = deretTahun(fd.hist_eps)
  const dps = deretTahun(fd.hist_dps)
  return [
    {
      id: 'revenue', label: 'Pendapatan', arti: 'Uang masuk dari penjualan, sebelum biaya apa pun.',
      nilai: ada(fd.ttm_revenue) ? fd.ttm_revenue : null, satuan: 'uang',
      yoy: ada(fd.rev_yoy) ? fd.rev_yoy : null, periode: 'TTM (12 bulan terakhir)',
    },
    {
      id: 'laba', label: 'Laba Bersih', arti: 'Sisa setelah seluruh biaya, bunga, dan pajak.',
      nilai: ada(fd.ttm_net_income) ? fd.ttm_net_income : null, satuan: 'uang',
      yoy: ada(fd.ni_yoy) ? fd.ni_yoy : null, periode: 'TTM (12 bulan terakhir)',
    },
    {
      id: 'eps', label: 'EPS', arti: 'Bagian laba untuk tiap satu lembar saham.',
      nilai: ada(fd.eps) ? fd.eps : null, satuan: 'perlembar',
      yoy: yoyDeret(eps), periode: 'TTM · pembanding dari laporan tahunan',
    },
    {
      id: 'cfo', label: 'Arus Kas Operasi', arti: 'Kas yang benar-benar diterima dari operasi — laba di atas kertas belum tentu jadi kas.',
      nilai: ada(fd.ttm_ocf) ? fd.ttm_ocf : null, satuan: 'uang',
      yoy: null, periode: 'TTM (12 bulan terakhir)',
    },
    {
      id: 'dps', label: 'Dividen per Saham', arti: 'Yang benar-benar sampai ke rekening pemegang saham.',
      nilai: ada(fd.dividend_ttm) ? fd.dividend_ttm : ada(fd.dividend) ? fd.dividend : null, satuan: 'perlembar',
      yoy: yoyDeret(dps), periode: 'TTM · pembanding dari riwayat dividen',
    },
  ]
}

export interface SambunganFlow {
  id: string
  label: string
  /** Persen. */
  nilai: number | null
  /** Kalimat penilaian; `null` kalau nilainya tak tersedia. */
  baca: string | null
}

/**
 * Rasio antar langkah — inilah yang membuat lima angka jadi satu cerita.
 *
 * `kas/laba` di bawah 100% berarti laba belum sepenuhnya jadi kas. Itu
 * PERTANYAAN, bukan tuduhan: piutang yang menumpuk dan pertumbuhan yang
 * dibiayai modal kerja sama-sama menghasilkan angka rendah.
 */
export function sambunganFlow(fd: StockFundamental): SambunganFlow[] {
  const rev = ada(fd.ttm_revenue) ? fd.ttm_revenue : null
  const ni = ada(fd.ttm_net_income) ? fd.ttm_net_income : null
  const ocf = ada(fd.ttm_ocf) ? fd.ttm_ocf : null
  const eps = ada(fd.eps) ? fd.eps : null
  const dps = ada(fd.dividend_ttm) ? fd.dividend_ttm : ada(fd.dividend) ? fd.dividend : null

  const npm = rev != null && ni != null && rev !== 0 ? (ni / rev) * 100 : null
  const kasLaba = ni != null && ocf != null && ni > 0 ? (ocf / ni) * 100 : null
  const payout = eps != null && dps != null && eps > 0 ? (dps / eps) * 100 : null

  return [
    {
      id: 'npm', label: 'Pendapatan → Laba (marjin bersih)', nilai: npm,
      baca: npm == null ? null
        : npm < 0 ? 'Rugi — pendapatan tidak menutup biaya.'
        : npm < 5 ? 'Tipis — sedikit kenaikan biaya sudah menghapus labanya.'
        : npm < 15 ? 'Wajar untuk usaha bervolume.'
        : 'Tebal — laba bertahan besar dari tiap rupiah penjualan.',
    },
    {
      id: 'kas_laba', label: 'Laba → Kas Operasi', nilai: kasLaba,
      baca: kasLaba == null ? null
        : kasLaba < 60 ? 'Laba belum jadi kas — periksa piutang & persediaan.'
        : kasLaba < 100 ? 'Sebagian laba masih tertahan di modal kerja.'
        : 'Kas masuk melampaui laba akuntansi — kualitas laba baik.',
    },
    {
      id: 'payout', label: 'EPS → Dividen (payout)', nilai: payout,
      baca: payout == null ? null
        : payout <= 0 ? 'Belum membagi dividen dari laba periode ini.'
        : payout < 30 ? 'Sebagian besar laba ditahan untuk tumbuh.'
        : payout <= 100 ? 'Dibagi dari laba periode berjalan.'
        : 'Dibagi melebihi laba — sumbernya laba ditahan atau kas lama, tak bisa berlanjut selamanya.',
    },
  ]
}

/* ─────────────────── seksi 7 · kualitas laba ─────────────────── */

export interface KualitasLaba {
  /** Persen. */
  roe: number | null
  /** Rerata `hist_roe` (yang di berkasnya SUDAH persen), maks 5 tahun. */
  roeRerata: number | null
  roeTahun: number
  /** Persen. */
  der: number | null
  derSumber: 'ttm' | 'kuartal' | null
  /** Persen. */
  divYield: number | null
  /** Kas operasi ÷ laba bersih, persen. */
  akrual: number | null
  /** Persen. */
  marjinBersih: number | null
}

export function kualitasLaba(fd: StockFundamental): KualitasLaba {
  const roeHist = deretTahun(fd.hist_roe, 5)
  const der = derPersen(fd)
  const ni = ada(fd.ttm_net_income) ? fd.ttm_net_income : null
  const ocf = ada(fd.ttm_ocf) ? fd.ttm_ocf : null
  return {
    roe: keP(fd.roe),
    // hist_roe SUDAH persen — jangan dikali 100 lagi walau `roe` di berkas
    // yang sama berupa rasio.
    roeRerata: roeHist.length ? roeHist.reduce((s, t) => s + t.nilai, 0) / roeHist.length : null,
    roeTahun: roeHist.length,
    der: der.nilai,
    derSumber: der.sumber,
    divYield: ada(fd.dividend_yield) ? fd.dividend_yield : null,
    akrual: ni != null && ocf != null && ni > 0 ? (ocf / ni) * 100 : null,
    marjinBersih: marjin(fd.npm),
  }
}

/* ─────────────────── seksi 8 · valuasi dua sumbu ─────────────────── */

export type Sumbu = 'murah' | 'wajar' | 'mahal'

/**
 * Sumbu kedua: posisi terhadap median sektornya sendiri.
 * `pe_vs_sector_pct` = (rasio ÷ median sektor − 1) × 100 — diverifikasi ulang
 * ke berkasnya, bukan ditebak dari namanya.
 *
 * Ambang ±25% sengaja lebar: median sektor dihitung dari emiten yang jumlahnya
 * berbeda-beda per sektor (`sector_stock_count`), dan selisih 10% terhadap
 * median dari sepuluh emiten bukan informasi.
 */
export const AMBANG_SEKTOR = 25

export function sumbuSektor(vsPct: number | null | undefined): Sumbu | null {
  if (!ada(vsPct)) return null
  if (vsPct < -AMBANG_SEKTOR) return 'murah'
  if (vsPct > AMBANG_SEKTOR) return 'mahal'
  return 'wajar'
}

/**
 * Dua sumbu dibaca bersama. Kalau **berlawanan arah** (murah vs sejarahnya
 * sendiri tapi mahal vs sektornya, atau sebaliknya), konfliknya WAJIB disebut —
 * memilih salah satu diam-diam menyembunyikan justru bagian yang paling
 * memberi tahu: emiten itu bergerak berbeda dari sektornya.
 */
export function konflikSumbu(sejarah: Sumbu | null, sektor: Sumbu | null): boolean {
  if (!sejarah || !sektor) return false
  return (sejarah === 'murah' && sektor === 'mahal') || (sejarah === 'mahal' && sektor === 'murah')
}

/* ─────────────────── seksi 10 · skor & pilar ─────────────────── */

export type IdPilar = 'growth' | 'profit' | 'quality' | 'valuation' | 'dividend'

export interface Pilar {
  id: IdPilar
  label: string
  /** 0–100; `null` = bahannya tak cukup, TIDAK sama dengan 0. */
  skor: number | null
  /** Kalimat aturan yang benar-benar dipakai — supaya skornya bisa dibantah. */
  alasan: string[]
  /** Kenapa skornya kosong. */
  kurang: string | null
}

/**
 * Skor satu ruas terhadap tangga ambang, 0–100. Tangga ditulis dari yang
 * TERBAIK ke terburuk; `[ambang, skor]`. Nilai di bawah semua ambang dapat 0.
 */
function tangga(v: number | null, ambang: [number, number][]): number | null {
  if (v == null) return null
  for (const [batas, skor] of ambang) if (v >= batas) return skor
  return 0
}

function rerata(xs: (number | null)[]): { skor: number | null; n: number } {
  const isi = xs.filter((x): x is number => x != null)
  return { skor: isi.length ? isi.reduce((a, b) => a + b, 0) / isi.length : null, n: isi.length }
}

/**
 * Rule-engine lima pilar — **bukan LLM**. Tiap pilar merata-ratakan beberapa
 * ruas yang sudah diberi skor lewat tangga ambang tetap, dan pilar yang tak
 * punya satu pun ruas terisi tetap kosong alih-alih diberi angka tengah.
 * Halaman WAJIB menyebut ini aturan, bukan penilaian model.
 */
export function skorPilar(fd: StockFundamental, sejarah: Sumbu | null, sektor: Sumbu | null): Pilar[] {
  const q = kualitasLaba(fd)
  const rev = deretTahun(fd.hist_revenue)
  const ni = deretTahun(fd.hist_net_income)
  const cagrRev = cagr(rev)
  const cagrNi = cagr(ni)

  const sVonis = (v: Sumbu | null) => (v === 'murah' ? 100 : v === 'wajar' ? 55 : v === 'mahal' ? 15 : null)

  const pilar: Pilar[] = [
    {
      id: 'growth', label: 'Pertumbuhan', ...bungkus(
        rerata([
          tangga(ada(fd.rev_yoy) ? fd.rev_yoy : null, [[15, 100], [8, 80], [3, 60], [0, 40]]),
          tangga(ada(fd.ni_yoy) ? fd.ni_yoy : null, [[20, 100], [10, 80], [3, 60], [0, 40]]),
          tangga(cagrRev, [[12, 100], [7, 80], [3, 60], [0, 40]]),
          tangga(cagrNi, [[15, 100], [8, 80], [3, 60], [0, 40]]),
        ]),
        [
          ada(fd.rev_yoy) ? `Pendapatan YoY ${fd.rev_yoy.toFixed(1)}%` : null,
          ada(fd.ni_yoy) ? `Laba bersih YoY ${fd.ni_yoy.toFixed(1)}%` : null,
          cagrRev != null ? `CAGR pendapatan ${rev.length} th ${cagrRev.toFixed(1)}%/th` : null,
          cagrNi != null ? `CAGR laba ${ni.length} th ${cagrNi.toFixed(1)}%/th` : null,
        ],
        'Pertumbuhan YoY dan riwayat tahunan belum tersedia.',
      ),
    },
    {
      id: 'profit', label: 'Profitabilitas', ...bungkus(
        rerata([
          tangga(q.roe, [[20, 100], [15, 85], [10, 65], [5, 45]]),
          tangga(q.marjinBersih, [[20, 100], [12, 80], [6, 60], [0, 40]]),
          tangga(keP(fd.roa), [[10, 100], [6, 80], [3, 60], [0, 40]]),
          tangga(marjin(fd.opm), [[20, 100], [12, 80], [5, 60], [0, 40]]),
        ]),
        [
          q.roe != null ? `ROE ${q.roe.toFixed(1)}%` : null,
          q.marjinBersih != null ? `Marjin bersih ${q.marjinBersih.toFixed(1)}%` : null,
          ada(fd.roa) ? `ROA ${keP(fd.roa)!.toFixed(1)}%` : null,
          marjin(fd.opm) != null ? `Marjin operasi ${marjin(fd.opm)!.toFixed(1)}%` : null,
        ],
        'ROE, marjin, dan ROA belum tersedia.',
      ),
    },
    {
      id: 'quality', label: 'Kualitas & Neraca', ...bungkus(
        rerata([
          // DER dibalik: makin kecil makin baik, jadi tangganya dari negatifnya.
          tangga(q.der != null ? -q.der : null, [[-50, 100], [-100, 80], [-200, 55], [-300, 30]]),
          tangga(q.akrual, [[100, 100], [80, 80], [60, 60], [0, 35]]),
          tangga(ada(fd.interest_coverage) ? fd.interest_coverage : null, [[8, 100], [4, 80], [2, 55], [1, 30]]),
          tangga(ada(fd.current_ratio) ? fd.current_ratio : null, [[2, 100], [1.5, 85], [1, 65], [0.7, 40]]),
        ]),
        [
          q.der != null ? `DER ${q.der.toFixed(1)}%` : null,
          q.akrual != null ? `Kas operasi ${q.akrual.toFixed(0)}% dari laba` : null,
          ada(fd.interest_coverage) ? `Bunga tertutup ${fd.interest_coverage.toFixed(1)}x laba operasi` : null,
          ada(fd.current_ratio) ? `Rasio lancar ${fd.current_ratio.toFixed(2)}x` : null,
        ],
        'Utang, arus kas, dan rasio likuiditas belum tersedia.',
      ),
    },
    {
      id: 'valuation', label: 'Valuasi', ...bungkus(
        rerata([sVonis(sejarah), sVonis(sektor)]),
        [
          sejarah ? `Vs sejarah sendiri: ${sejarah}` : null,
          sektor ? `Vs median sektor: ${sektor}` : null,
          konflikSumbu(sejarah, sektor) ? 'Dua sumbu BERLAWANAN — lihat seksi Valuasi.' : null,
        ],
        'Riwayat valuasi belum cukup panjang dan median sektor belum tersedia.',
      ),
    },
    {
      id: 'dividend', label: 'Dividen', ...bungkus(
        rerata([
          tangga(q.divYield, [[6, 100], [4, 85], [2, 65], [0.1, 45]]),
          tangga(keP(fd.payout_ratio), [[30, 80], [15, 65], [0.1, 50]]),
          tangga(ada(fd.div_years) ? fd.div_years : null, [[8, 100], [5, 80], [3, 60], [1, 40]]),
        ]),
        [
          q.divYield != null ? `Imbal hasil dividen ${q.divYield.toFixed(2)}%` : null,
          ada(fd.payout_ratio) ? `Payout ${keP(fd.payout_ratio)!.toFixed(0)}% dari laba` : null,
          ada(fd.div_years) ? `${fd.div_years} tahun tercatat membagi dividen` : null,
        ],
        'Riwayat dividen belum tersedia.',
      ),
    },
  ]
  return pilar
}

function bungkus(
  r: { skor: number | null; n: number },
  alasan: (string | null)[],
  kurang: string,
): { skor: number | null; alasan: string[]; kurang: string | null } {
  return {
    skor: r.skor,
    alasan: alasan.filter((a): a is string => a != null),
    kurang: r.skor == null ? kurang : null,
  }
}

/** Skor total = rerata pilar yang PUNYA skor. Pilar kosong tidak dihitung
 *  sebagai 0 — itu akan menghukum emiten yang datanya belum lengkap seolah
 *  fundamentalnya buruk. `n` ikut dikembalikan supaya layar bisa menyebut
 *  "dari 3 pilar", bukan memajang satu angka tanpa cakupannya. */
export function skorTotal(pilar: Pilar[]): { skor: number | null; n: number } {
  const isi = pilar.filter((p) => p.skor != null)
  if (isi.length === 0) return { skor: null, n: 0 }
  return { skor: isi.reduce((s, p) => s + p.skor!, 0) / isi.length, n: isi.length }
}

export function labelSkor(skor: number | null): string {
  if (skor == null) return 'Belum tersedia'
  if (skor >= 80) return 'Kuat'
  if (skor >= 65) return 'Baik'
  if (skor >= 50) return 'Sedang'
  if (skor >= 35) return 'Lemah'
  return 'Rapuh'
}

/** Pilar terbaik & terburuk yang PUNYA skor — bahan daftar kekuatan/risiko. */
export function kekuatanRisiko(pilar: Pilar[]): { kuat: Pilar[]; lemah: Pilar[] } {
  const isi = pilar.filter((p) => p.skor != null)
  return {
    kuat: isi.filter((p) => p.skor! >= 70).sort((a, b) => b.skor! - a.skor!),
    lemah: isi.filter((p) => p.skor! < 50).sort((a, b) => a.skor! - b.skor!),
  }
}

/* ─────────────────── seksi 11 · panel khas PAPAN ─────────────────── */

export type ZonaAltman = 'aman' | 'abu' | 'tertekan'

export const LABEL_ZONA_ALTMAN: Record<ZonaAltman, string> = {
  aman: 'Zona aman',
  abu: 'Zona abu-abu',
  tertekan: 'Zona tertekan',
}

/**
 * Altman Z-Score, ambang klasik model manufaktur publik (Altman 1968):
 * > 2,99 aman · 1,81–2,99 abu-abu · < 1,81 tertekan.
 *
 * `null` untuk emiten yang tak punya angkanya — 569 dari 966 berkas yang
 * punya (20 Agu 2026). Model ini memang **tidak berlaku untuk bank dan
 * lembaga keuangan** (neracanya tak punya modal kerja dalam arti yang sama),
 * dan justru di situlah `altman_z` paling sering kosong. Kosongnya jadi
 * informasi, bukan lubang yang perlu ditambal taksiran.
 */
export function zonaAltman(z: number | null | undefined): ZonaAltman | null {
  if (!ada(z)) return null
  if (z > 2.99) return 'aman'
  if (z >= 1.81) return 'abu'
  return 'tertekan'
}

export type BandFScore = 'kuat' | 'sedang' | 'lemah'

export const LABEL_BAND_FSCORE: Record<BandFScore, string> = {
  kuat: 'Sinyal kuat',
  sedang: 'Sinyal campuran',
  lemah: 'Sinyal lemah',
}

/**
 * Piotroski F-Score. Skala aslinya 0–9, tapi berkas kita membawa `f_score_n` =
 * berapa kriteria yang BENAR-BENAR bisa dinilai (BBCA cuma 6 dari 9). Karena
 * itu bandnya dihitung dari **proporsi**, bukan dari angka mentah: 4 dari 6
 * bukan hal yang sama dengan 4 dari 9, dan membandingkan keduanya di satu
 * skala memberi vonis yang salah untuk emiten yang datanya paling sedikit.
 */
export function bandFScore(skor: number | null | undefined, n: number | null | undefined): BandFScore | null {
  if (!ada(skor)) return null
  const dari = ada(n) && n > 0 ? n : 9
  const p = skor / dari
  if (p >= 0.7) return 'kuat'
  if (p >= 0.45) return 'sedang'
  return 'lemah'
}

export interface BarisKhas {
  label: string
  nilai: string
  /** Kalimat penjelas; `null` = tak ada angkanya. */
  baca: string | null
}

/**
 * Ruas yang tak dipunyai pembanding mana pun: Altman Z, F-Score, ROIC/ROCE,
 * dan siklus konversi kas. Yang kosong disebut kosong — tak pernah ditambal
 * taksiran (aturan A2).
 */
export function panelKhas(fd: StockFundamental): BarisKhas[] {
  const z = ada(fd.altman_z) ? fd.altman_z : null
  const zona = zonaAltman(z)
  const band = bandFScore(fd.f_score, fd.f_score_n)
  const roic = keP(fd.roic)
  const roce = keP(fd.roce)
  const ccc = ada(fd.cash_conversion_cycle) ? fd.cash_conversion_cycle : null
  return [
    {
      label: 'Altman Z-Score',
      nilai: z != null ? z.toFixed(2) : 'Belum bisa dihitung',
      baca: zona
        ? `${LABEL_ZONA_ALTMAN[zona]} — ambang klasik 1,81 / 2,99.`
        : 'Ruas pembentuknya tak lengkap. Model ini memang tak berlaku untuk bank dan lembaga keuangan.',
    },
    {
      label: 'Piotroski F-Score',
      nilai: ada(fd.f_score) ? `${fd.f_score} / ${ada(fd.f_score_n) ? fd.f_score_n : 9}` : 'Belum bisa dihitung',
      baca: band
        ? `${LABEL_BAND_FSCORE[band]}${ada(fd.f_score_n) && fd.f_score_n < 9 ? ` — hanya ${fd.f_score_n} dari 9 kriteria bisa dinilai dari data yang ada.` : '.'}`
        : 'Kriteria pembentuknya belum bisa dinilai dari data yang ada.',
    },
    {
      label: 'ROIC',
      nilai: roic != null ? `${roic.toFixed(2)}%` : 'Belum tersedia',
      baca: roic != null ? 'Imbal hasil atas seluruh modal yang diinvestasikan — utang maupun ekuitas.' : null,
    },
    {
      label: 'ROCE',
      nilai: roce != null ? `${roce.toFixed(2)}%` : 'Belum tersedia',
      baca: roce != null ? 'Laba operasi terhadap modal yang dipakai; tak terpengaruh struktur pajak.' : null,
    },
    {
      label: 'Siklus konversi kas',
      nilai: ccc != null ? `${ccc.toFixed(0)} hari` : 'Belum tersedia',
      baca: ccc == null ? null
        : ccc < 0 ? 'Negatif — pemasok dibayar setelah uang pelanggan masuk; modal kerja dibiayai rantai pasok.'
        : `Butuh ${ccc.toFixed(0)} hari sejak kas keluar untuk persediaan sampai kembali sebagai tagihan tertagih.`,
    },
  ]
}

/* ─────────────────── seksi 2 · aktivitas transaksi ─────────────────── */

export interface RingkasTransaksi {
  tanggal: string
  volume: number
  value: number
  frekuensi: number
  /** Rerata volume harian 20 hari bursa terakhir. */
  volume20: number | null
  /** Volume hari terakhir dibagi rerata 20 hari, kali. */
  banding20: number | null
  /** Volume hari terakhir dibagi saham beredar, persen — "berapa persen
   *  perusahaan berpindah tangan hari itu". */
  turnover: number | null
}

/**
 * Ringkas aktivitas dari `asing/{KODE}.json` — berkas itu membawa volume,
 * nilai, dan frekuensi PASAR harian per emiten (bukan cuma ruas asing), jadi
 * tak perlu memuat `ds_*.json` sepasar hanya untuk satu emiten.
 *
 * `baris` wajib terurut naik tanggal (bentuk aslinya memang begitu).
 */
export function ringkasTransaksi(
  baris: { tanggal: string; volume: number; value: number; frekuensi: number }[],
  saham: number | null | undefined,
): RingkasTransaksi | null {
  if (baris.length === 0) return null
  const akhir = baris[baris.length - 1]
  const jendela = baris.slice(-20)
  const volume20 = jendela.length >= 5
    ? jendela.reduce((s, r) => s + r.volume, 0) / jendela.length
    : null
  return {
    tanggal: akhir.tanggal,
    volume: akhir.volume,
    value: akhir.value,
    frekuensi: akhir.frekuensi,
    volume20,
    banding20: volume20 != null && volume20 > 0 ? akhir.volume / volume20 : null,
    turnover: ada(saham) && saham > 0 ? (akhir.volume / saham) * 100 : null,
  }
}
