import { afterEach, describe, expect, it, vi } from 'vitest'
import { jawab, type DataButuh, type KonteksTanya, type OhlcRingkas } from './tanyaPapan'
import type { DataHarian, TanggalIndex } from './dataHarian'
import type { KamusEmiten } from './kamusEmiten'
import type { StockFundamental } from './stockDetailData'
import type { InvestorMapEntry } from './petaInvestorData'
import { GLOSARIUM } from './glosarium'
import { PENGETAHUAN } from './pengetahuan'

const hari = {
  date_id: 'Jumat, 14 Agustus 2026',
  trading_day: 145,
  ihsg_value: 6401.89,
  ihsg_pct: 1.59,
  ihsg_prev: 6301.77,
  nf_today_idr: -1034.66,
  nf_ytd_idr: -72870,
  mkt_per: 14.2,
  mkt_pbv: 1.8,
  gainers: [{ c: 'TEBE', pr: 1375, td: 275, p: 25 }, { c: 'BBCA', pr: 9000, td: 100, p: 1.1 }],
  losers: [{ c: 'BAIK', pr: 390, td: -68, p: -14.85 }],
  leaders_today: [{ c: 'BYAN', p: 14400, ih: 39.11 }],
  top_val: [{ c: 'BBCA', v: 900, p: 9000 }],
  sectors: [
    { n: '[F] Healthcare', v: 100, d: 3.09, ytd: 0 },
    { n: '[G] Properti', v: 100, d: 2.99, ytd: 0 },
  ],
} as unknown as DataHarian

/** Seri menaik 30 hari — cukup untuk sepekan (5) dan sebulan (21). */
const seri: TanggalIndex[] = Array.from({ length: 30 }, (_, i) => ({
  stem: `d${i}`, date_iso: `2026-07-${String(i + 1).padStart(2, '0')}`,
  date_id: `${i + 1} Jul`, date_raw: '', ihsg: 6000 + i * 10, ihsg_pct: 0.16, trading_day: i + 1,
}))

const konteks = (p: Partial<KonteksTanya> = {}): KonteksTanya =>
  ({ hari, seri, edisi: null, kabar: null, ...p })

describe('jawab — fakta harian', () => {
  it('IHSG dijawab dengan headline + ringkasan', () => {
    const j = jawab('IHSG hari ini berapa?', konteks())
    expect(j.teks).toContain('6.401,89')
    expect(j.topik).toBe('ihsg')
    expect(j.ke).toBe('/indeks')
  })

  it('arus asing menyebut hari ini DAN tahun berjalan', () => {
    const j = jawab('asing net buy atau net sell?', konteks())
    expect(j.teks).toContain('net sell Rp1,03 triliun')
    expect(j.teks).toContain('Rp72,87 triliun')
  })

  it('nama sektor dibersihkan dari awalan kode papan', () => {
    const j = jawab('sektor apa yang kuat?', konteks())
    expect(j.teks).toContain('Healthcare')
    expect(j.teks).not.toContain('[F]')
  })
})

describe('jawab — pertanyaan lintas waktu', () => {
  it('rentang dijawab sebelum data harian — "IHSG sepekan" bukan pertanyaan harian', () => {
    const j = jawab('IHSG sepekan terakhir bagaimana?', konteks())
    expect(j.topik).toBe('lintasWaktu')
    expect(j.teks).toContain('sepekan')
    expect(j.teks).toContain('sebulan')
  })

  it('beruntun dihitung dari seri, bukan dikarang', () => {
    const j = jawab('IHSG naik beruntun berapa hari?', konteks())
    expect(j.teks).toMatch(/naik 29 hari bursa beruntun/)
  })

  it('seri terlalu pendek dijawab jujur, bukan dipaksakan', () => {
    const j = jawab('IHSG sebulan terakhir?', konteks({ seri: seri.slice(0, 3) }))
    expect(j.takPaham).toBe(true)
    expect(j.teks).toContain('belum termuat cukup')
  })
})

describe('jawab — pertanyaan susulan', () => {
  it('"kenapa?" setelah topik IHSG dialihkan ke penggerak indeks', () => {
    const j = jawab('kenapa?', konteks({ topik: 'ihsg' }))
    expect(j.teks).toContain('BYAN')
    expect(j.topik).toBe('penggerak')
  })

  it('"berapa?" setelah topik asing mengulang topik yang sama', () => {
    const j = jawab('berapa?', konteks({ topik: 'asing' }))
    expect(j.teks).toContain('net sell')
  })

  it('susulan tanpa topik sebelumnya TIDAK ditebak', () => {
    const j = jawab('kenapa?', konteks({ topik: null }))
    expect(j.takPaham).toBe(true)
    expect(j.teks).toContain('Susulan dari yang mana')
  })

  it('"kenapa naik" adalah pertanyaan penuh, bukan susulan', () => {
    // Kalau pola susulan dicocokkan sebagai potongan (bukan utuh), kalimat ini
    // akan dibajak jadi sambungan topik sebelumnya.
    const j = jawab('kenapa naik', konteks({ topik: 'asing' }))
    expect(j.teks).not.toContain('net sell Rp1,03 triliun hari ini, dan')
  })
})

describe('jawab — per emiten', () => {
  it('menjawab dari SEMUA sudut yang tersedia hari itu', () => {
    const j = jawab('bagaimana TEBE?', konteks())
    expect(j.teks).toContain('TEBE')
    expect(j.teks).toContain('top gainers')
  })

  it('emiten yang tak muncul di mana pun dijawab jujur', () => {
    const j = jawab('bagaimana ZZZZ?', konteks())
    expect(j.takPaham).toBe(true)
    expect(j.ke).toBe('/stock-detail')
  })

  it('kontribusi indeks ikut disebut kalau emiten itu penggerak', () => {
    const j = jawab('BYAN gimana?', konteks())
    expect(j.teks).toContain('poin ke IHSG')
  })
})

describe('jawab — batas kemampuan', () => {
  it('pertanyaan di luar pola ditandai takPaham, bukan dikarang', () => {
    const j = jawab('siapa presiden direktur BBCA?', konteks())
    expect(j.takPaham).toBe(true)
  })

  it('tanpa data hari ini tak memaksakan jawaban', () => {
    const j = jawab('IHSG berapa?', konteks({ hari: null }))
    expect(j.takPaham).toBe(true)
  })
})

describe('jawab — basis teks (pengetahuan + glosarium)', () => {
  it('istilah dari glosarium dijawab, bukan ditolak', () => {
    const j = jawab('apa itu big dist?', konteks())
    expect(j.takPaham).toBeFalsy()
    expect(j.teks.toLowerCase()).toContain('dist')
  })

  it('"apa itu IHSG" dijawab ARTINYA, bukan angka hari ini', () => {
    // Tanpa blok MINTA_ARTI yang dicek lebih dulu, blok IHSG akan membajak
    // pertanyaan ini dan menjawab "6.401,89" — angkanya benar, pertanyaannya
    // yang salah dijawab.
    const j = jawab('apa itu IHSG?', konteks())
    expect(j.teks).not.toContain('6.401,89')
  })

  it('"IHSG hari ini berapa" TETAP dijawab angka — blok arti tak boleh serakah', () => {
    const j = jawab('IHSG hari ini berapa?', konteks())
    expect(j.teks).toContain('6.401,89')
  })

  it('"kondisi pasar sekarang" dijawab ringkasan hari itu, bukan ditolak', () => {
    const j = jawab('bagaimana kondisi pasar sekarang?', konteks())
    expect(j.takPaham).toBeFalsy()
    expect(j.topik).toBe('ihsg')
  })

  it('kunci pendek tak ikut cocok di tengah kata lain', () => {
    // "ara" pernah cocok di dalam "sekarang" — jebakan yang sudah sekali
    // menggigit di `pengetahuan.ts` dan tak boleh lahir lagi lewat glosarium.
    const j = jawab('bagaimana kondisi pasar sekarang?', konteks())
    expect(j.teks.toLowerCase()).not.toContain('auto reject')
  })
})

// ── Kamus emiten (harga/nama/grup) — bahan pertanyaan per-emiten baru ──────
const kamus: KamusEmiten = {
  harga: { BBCA: 6300 },
  hargaBulan: '2026-08',
  emiten: [
    { kode: 'BBCA', nama: 'Bank Central Asia Tbk.' },
    { kode: 'ICBP', nama: 'Indofood CBP Sukses Makmur Tbk.' },
  ],
  grup: {
    Salim: { kode: 'SLM', anggota: [{ kode: 'ICBP', lewat: 'INDOFOOD SUKSES MAKMUR TBK', pct: 80.53, kelas: 'Corporate', harga: 7600, pct1d: 0.66 }] },
  },
}

const fd: StockFundamental = {
  ticker: 'BBCA', name: 'Bank Central Asia Tbk.', sector: 'Financial Services', industry: 'Banks - Regional',
  updated: '2026-08-13 21:13', last_price: 6375, prev_close: 6350, pe: 13.51, pb: 2.8957, roe: 0.21818,
}

describe('jawab — mekanisme dua-langkah (berkas per-emiten)', () => {
  it('harga: minta butuh dulu, baru jawab setelah data terisi', () => {
    const j1 = jawab('harga BBCA berapa?', konteks({ kamus }))
    expect(j1.butuh).toEqual({ jenis: 'fundamental', kode: 'BBCA' })

    const j2 = jawab('harga BBCA berapa?', konteks({ kamus, data: { jenis: 'fundamental', kode: 'BBCA', payload: fd } }))
    expect(j2.teks).toContain('Rp6.375')
    expect(j2.teks).toContain('13 Agu 2026')
    expect(j2.topik).toBe('hargaEmiten')
  })

  it('harga: jatuh ke cadangan bulanan kalau fundamental tak punya last_price', () => {
    const j = jawab('harga BBCA berapa?', konteks({
      kamus, data: { jenis: 'fundamental', kode: 'BBCA', payload: { ...fd, last_price: null } },
    }))
    expect(j.teks).toContain('Rp6.300')
    expect(j.teks).toContain('cadangan bulanan')
    expect(j.teks).toContain('Agustus 2026')
  })

  it('nama perusahaan dikenali, bukan cuma kode', () => {
    const j = jawab('harga bank central asia berapa?', konteks({ kamus }))
    expect(j.butuh).toEqual({ jenis: 'fundamental', kode: 'BBCA' })
  })

  it('valuasi: PER/PBV/ROE dari fundamental', () => {
    const j = jawab('PER BBCA berapa?', konteks({ kamus, data: { jenis: 'fundamental', kode: 'BBCA', payload: fd } }))
    expect(j.teks).toContain('PER 13,51×')
    expect(j.teks).toContain('PBV 2,90×')
    expect(j.teks).toContain('ROE 21,82%')
    expect(j.topik).toBe('valuasiEmiten')
  })

  it('sektor per-emiten dijawab dari fundamental, bukan sektor pasar', () => {
    const j = jawab('BBCA sektor apa?', konteks({ kamus, data: { jenis: 'fundamental', kode: 'BBCA', payload: fd } }))
    expect(j.teks).toContain('Financial Services')
    expect(j.teks).toContain('Banks - Regional')
    expect(j.topik).toBe('sektorEmiten')
  })

  it('kinerja setahun dihitung dari OHLC, termasuk jarak dari puncak 52 minggu', () => {
    // Tanggal "awal" sengaja jauh dari batas 365 hari (bukan pas di pinggirnya)
    // — supaya hasil tak goyah kalau `new Date().setDate()` bergeser ±1 hari
    // gara-gara zona waktu mesin yang menjalankan tes.
    const ohlc = {
      kode: 'BBCA',
      d: [
        ['2025-09-01', 8000, 8000, 7900, 8000, 100],
        ['2026-02-01', 6000, 9000, 5900, 6000, 100],
        ['2026-08-14', 6300, 6350, 6275, 6350, 100],
      ] as [string, number, number, number, number, number][],
    }
    const j1 = jawab('BBCA setahun terakhir?', konteks({ kamus }))
    expect(j1.butuh).toEqual({ jenis: 'ohlc', kode: 'BBCA' })

    const j2 = jawab('BBCA setahun terakhir?', konteks({ kamus, data: { jenis: 'ohlc', kode: 'BBCA', payload: ohlc } }))
    expect(j2.teks).toContain('turun')
    expect(j2.teks).toContain('9.000')
    expect(j2.topik).toBe('kinerjaEmiten')
  })

  it('pemilik: agregat asing/domestik/korporasi/individu, TANPA nama pemegang saham', () => {
    const entry: InvestorMapEntry = {
      code: 'BBCA', issuer: 'BANK CENTRAL ASIA Tbk',
      holders: [
        { name: 'PT DWIMURIA INVESTAMA ANDALAN', cls: 'Corporate', lf: 'L', pct: 54.94 },
        { name: 'ANTHONI SALIM', cls: 'Individual', lf: 'L', pct: 1.15 },
        { name: 'GOVERNMENT OF NORWAY', cls: 'Sovereign Wealth Fund', lf: 'F', pct: 1.01 },
      ],
    }
    const j1 = jawab('siapa pemilik BBCA?', konteks({}))
    expect(j1.butuh).toEqual({ jenis: 'investor', kode: 'BBCA' })

    const j2 = jawab('siapa pemilik BBCA?', konteks({ data: { jenis: 'investor', kode: 'BBCA', payload: entry } }))
    expect(j2.teks).toContain('domestik 56,09%')
    expect(j2.teks).toContain('asing 1,01%')
    expect(j2.teks).not.toContain('ANTHONI SALIM')
    expect(j2.teks).not.toContain('DWIMURIA')
  })

  it('pertanyaan "siapa direktur" TETAP tak dijawab — bukan dibajak jadi pertanyaan pemilik', () => {
    const j = jawab('siapa direktur BBCA?', konteks({ kamus }))
    expect(j.takPaham).toBe(true)
    expect(j.butuh).toBeUndefined()
  })
})

describe('jawab — grup konglomerat', () => {
  it('grup disebut namanya → daftar anggota', () => {
    const j = jawab('grup Salim isinya apa?', konteks({ kamus }))
    expect(j.teks).toContain('ICBP')
    expect(j.topik).toBe('grup')
  })

  it('kode disebut → grup yang memuatnya', () => {
    const j = jawab('ICBP grup apa?', konteks({ kamus }))
    expect(j.teks).toContain('Salim')
  })

  it('kode tak masuk grup mana pun dijawab jujur', () => {
    const j = jawab('BBCA grup apa?', konteks({ kamus }))
    expect(j.takPaham).toBe(true)
    expect(j.teks).toContain('tidak teridentifikasi')
  })
})

describe('jawab — kalender bursa (besok libur?)', () => {
  afterEach(() => { vi.useRealTimers() })

  it('akhir pekan dijawab tutup', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T05:00:00Z')) // Jumat WIB — besok Sabtu
    const j = jawab('besok libur bursa?', konteks())
    expect(j.teks).toContain('tutup')
    expect(j.teks).toContain('akhir pekan')
    expect(j.topik).toBe('kalender')
  })

  it('hari kerja biasa dijawab buka', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-19T05:00:00Z')) // Rabu WIB — besok Kamis
    const j = jawab('besok bursa buka?', konteks())
    expect(j.teks).toContain('buka seperti biasa')
  })
})

describe('jawab — deteksi kode tak salah tangkap kata umum', () => {
  it('"sektor apa yang kuat" TETAP dijawab market-wide, bukan dibajak jadi sektor emiten KUAT', () => {
    const j = jawab('sektor apa yang kuat?', konteks({ kamus }))
    expect(j.teks).toContain('Healthcare')
    expect(j.butuh).toBeUndefined()
  })

  it('kode huruf kecil TIDAK dianggap disebut (harus kapital seperti ticker)', () => {
    const j = jawab('bagaimana bbca hari ini', konteks({ kamus }))
    // Tanpa "BBCA" kapital, deteksi jatuh ke pencarian nama — "bbca" bukan
    // nama perusahaan, jadi tetap tak ketemu kode.
    expect(j.butuh).toBeUndefined()
  })
})

describe('jawab — susulan atas topik baru tak menebak (dan tak crash)', () => {
  it('"kenapa?" setelah topik hargaEmiten mengaku tak tahu, bukan lempar error', () => {
    const j = jawab('kenapa?', konteks({ topik: 'hargaEmiten' }))
    expect(j.takPaham).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// KORPUS LATIH — seluruh rentang panjang masukan
// ════════════════════════════════════════════════════════════════════════════
/**
 * Korpus permanen untuk melatih & mengukur mesin aturan, disusun atas
 * permintaan Johan 18 Agu 2026: *"coba kata per kata, 2 kata, 3 kata, banyak
 * kata, saling berkata"* — mesin harus diuji pada SELURUH rentang panjang
 * masukan, bukan cuma kalimat rapi.
 *
 * Tiap baris membawa `harus`: pola yang WAJIB ada di jawaban. Dari situ tiap
 * hasil digolongkan tiga:
 *   - `benar`   — `harus` cocok
 *   - `takTahu` — tak cocok tapi mesin mengaku tak tahu (`takPaham`)
 *   - `salah`   — tak cocok DAN mesin percaya diri menjawab topik lain
 * Golongan `salah` yang paling merusak: pembaca tak punya cara tahu
 * jawabannya keliru. Karena itu ia diuji satu per satu di bawah, sementara
 * `takTahu` cuma dibatasi jumlahnya.
 *
 * Ringkasan angkanya: `UKUR=1 npx vitest run tanyaPapan`
 */
export type Kelompok = '1 kata' | '2 kata' | '3 kata' | 'kalimat panjang' | 'salah ketik' | 'percakapan'

interface Kasus {
  q: string
  kel: Kelompok
  harus: RegExp
  ctx?: Partial<KonteksTanya>
}

const ohlcBBCA: OhlcRingkas = {
  kode: 'BBCA',
  d: [
    ['2025-09-01', 8000, 8000, 7900, 8000, 100],
    ['2026-02-01', 6000, 9000, 5900, 6000, 100],
    ['2026-08-14', 6300, 6350, 6275, 6350, 100],
  ],
}

const investorBBCA: InvestorMapEntry = {
  code: 'BBCA', issuer: 'BANK CENTRAL ASIA Tbk',
  holders: [
    { name: 'PT DWIMURIA INVESTAMA ANDALAN', cls: 'Corporate', lf: 'L', pct: 54.94 },
    { name: 'GOVERNMENT OF NORWAY', cls: 'Sovereign Wealth Fund', lf: 'F', pct: 1.01 },
  ],
}

/** Menjawab seperti antarmuka sungguhan: kalau `jawab()` minta berkas
 *  per-emiten (mekanisme dua-langkah), berkasnya disodorkan lalu `jawab()`
 *  dipanggil ulang — persis yang dikerjakan TanyaPapan.tsx. */
export function tanya(q: string, p: Partial<KonteksTanya> = {}) {
  const k = konteks({ kamus, ...p })
  const j1 = jawab(q, k)
  if (!j1.butuh) return j1
  const { jenis, kode } = j1.butuh
  const payload =
    jenis === 'fundamental' ? (kode === 'BBCA' ? fd : null)
      : jenis === 'ohlc' ? (kode === 'BBCA' ? ohlcBBCA : null)
        : (kode === 'BBCA' ? investorBBCA : null)
  return jawab(q, { ...k, data: { jenis, kode, payload } as DataButuh })
}

export const KORPUS: Kasus[] = [
  // ── 1 kata ────────────────────────────────────────────────────────────────
  { q: 'bandar', kel: '1 kata', harus: /bandar/i },
  { q: 'ara', kel: '1 kata', harus: /auto rejection/i },
  { q: 'arb', kel: '1 kata', harus: /auto rejection/i },
  { q: 'akumulasi', kel: '1 kata', harus: /akumulasi/i },
  { q: 'distribusi', kel: '1 kata', harus: /distribusi/i },
  { q: 'divergensi', kel: '1 kata', harus: /divergensi/i },
  { q: 'pcd', kel: '1 kata', harus: /PCD|distribusi/i },
  { q: 'radar', kel: '1 kata', harus: /radar/i },
  { q: 'jenjang', kel: '1 kata', harus: /jenjang/i },
  { q: 'kuota', kel: '1 kata', harus: /kuota|jenjang/i },
  { q: 'kurasi', kel: '1 kata', harus: /kurasi|setujui|revisi/i },
  { q: 'akurasi', kel: '1 kata', harus: /akurasi/i },
  { q: 'fraksi', kel: '1 kata', harus: /fraksi|kelipatan/i },
  { q: 'lot', kel: '1 kata', harus: /lot/i },
  { q: 'spread', kel: '1 kata', harus: /spread/i },
  { q: 'macd', kel: '1 kata', harus: /MACD/i },
  { q: 'breakout', kel: '1 kata', harus: /breakout/i },
  { q: 'likuiditas', kel: '1 kata', harus: /likuiditas/i },
  { q: 'seasonality', kel: '1 kata', harus: /musiman|seasonality/i },
  { q: 'ihsg', kel: '1 kata', harus: /6\.401,89|IHSG/i },
  { q: 'asing', kel: '1 kata', harus: /net sell|net buy/i },
  { q: 'broker', kel: '1 kata', harus: /broker/i },
  { q: 'emiten', kel: '1 kata', harus: /emiten/i },
  { q: 'harga', kel: '1 kata', harus: /harga/i },
  { q: 'dividen', kel: '1 kata', harus: /dividen/i },
  { q: 'gorengan', kel: '1 kata', harus: /rekomendasi|saran investasi/i },
  { q: 'kontributor', kel: '1 kata', harus: /kontributor/i },
  { q: 'login', kel: '1 kata', harus: /masuk|akun/i },
  { q: 'gratis', kel: '1 kata', harus: /biaya/i },
  { q: 'kalkulator', kel: '1 kata', harus: /kalkulator/i },

  // ── 2 kata ────────────────────────────────────────────────────────────────
  { q: 'apa bandar', kel: '2 kata', harus: /bandar/i },
  { q: 'arti ara', kel: '2 kata', harus: /auto rejection/i },
  { q: 'cara kontribusi', kel: '2 kata', harus: /kontributor/i },
  { q: 'broker summary', kel: '2 kata', harus: /broker summary/i },
  { q: 'saham gorengan', kel: '2 kata', harus: /rekomendasi|saran investasi/i },
  { q: 'net sell', kel: '2 kata', harus: /net sell|net buy/i },
  { q: 'top gainer', kel: '2 kata', harus: /gainers/i },
  { q: 'naik jenjang', kel: '2 kata', harus: /jenjang/i },
  { q: 'kenapa broker', kel: '2 kata', harus: /broker/i },
  { q: 'pasar nego', kel: '2 kata', harus: /nego/i },
  { q: 'laba bersih', kel: '2 kata', harus: /laba/i },
  { q: 'arus kas', kel: '2 kata', harus: /arus kas|CFO/i },
  { q: 'harga BBCA', kel: '2 kata', harus: /6\.375/ },
  { q: 'PER BBCA', kel: '2 kata', harus: /PER 13,51/ },
  { q: 'sektor terkuat', kel: '2 kata', harus: /Healthcare/ },
  { q: 'libur besok', kel: '2 kata', harus: /bursa (tutup|buka)/i },
  { q: 'grup Salim', kel: '2 kata', harus: /ICBP/ },
  { q: 'belum update', kel: '2 kata', harus: /diperbarui|16:15/i },
  { q: 'saham hijau', kel: '2 kata', harus: /gainers/i },
  { q: 'saham merah', kel: '2 kata', harus: /losers/i },

  // ── 3 kata ────────────────────────────────────────────────────────────────
  { q: 'apa itu akumulasi', kel: '3 kata', harus: /akumulasi/i },
  { q: 'bagaimana skor radar', kel: '3 kata', harus: /radar/i },
  { q: 'kenapa data kosong', kel: '3 kata', harus: /diperbarui|belum|sumber/i },
  { q: 'apa itu PCD', kel: '3 kata', harus: /PCD|distribusi/i },
  { q: 'cara jadi kontributor', kel: '3 kata', harus: /kontributor/i },
  { q: 'apa itu ARA', kel: '3 kata', harus: /auto rejection/i },
  { q: 'berapa fraksi harga', kel: '3 kata', harus: /kelipatan|fraksi/i },
  { q: 'siapa pemilik BBCA', kel: '3 kata', harus: /domestik/i },
  { q: 'IHSG hari ini', kel: '3 kata', harus: /6\.401,89/ },
  { q: 'asing net sell', kel: '3 kata', harus: /net sell/i },
  { q: 'sektor paling kuat', kel: '3 kata', harus: /Healthcare/ },
  { q: 'saham paling naik', kel: '3 kata', harus: /gainers/i },
  { q: 'apa itu bandar', kel: '3 kata', harus: /bandar/i },
  { q: 'data dari mana', kel: '3 kata', harus: /IDX|KSEI|sumber/i },
  { q: 'IHSG sepekan terakhir', kel: '3 kata', harus: /sepekan/i },
  { q: 'BBCA sektor apa', kel: '3 kata', harus: /Financial Services/ },
  { q: 'kenapa disebut kuat', kel: '3 kata', harus: /ambang|persentil|hari bursa/i },
  { q: 'apa itu jenjang', kel: '3 kata', harus: /jenjang/i },
  { q: 'data diperbarui kapan', kel: '3 kata', harus: /18:30|16:15|diperbarui/i },
  { q: 'PAPAN itu apa', kel: '3 kata', harus: /Bursa Efek Indonesia|Pusat Analisa/i },

  // ── kalimat panjang ───────────────────────────────────────────────────────
  {
    q: 'kenapa laporan keuangan emiten ini kosong padahal di aplikasi lain ada',
    kel: 'kalimat panjang', harus: /XBRL|IDX|sumber|laporan keuangan/i,
  },
  {
    q: 'bagaimana cara saya menjadi kontributor PAPAN dan apa saja syaratnya',
    kel: 'kalimat panjang', harus: /kontributor/i,
  },
  {
    q: 'apa bedanya broker summary dengan orderbook yang biasa saya lihat di aplikasi sekuritas',
    kel: 'kalimat panjang', harus: /broker summary/i,
  },
  {
    q: 'tolong jelaskan bagaimana PAPAN menghitung akurasi kontributor',
    kel: 'kalimat panjang', harus: /akurasi/i,
  },
  {
    q: 'kalau setoran saya perlu revisi apakah akurasi saya ikut turun',
    kel: 'kalimat panjang', harus: /revisi/i,
  },
  {
    q: 'berapa batas auto rejection atas untuk saham dengan harga acuan seribu rupiah',
    kel: 'kalimat panjang', harus: /35%|25%|20%/,
  },
  {
    q: 'apakah PAPAN bisa memberi rekomendasi saham yang layak dibeli minggu ini',
    kel: 'kalimat panjang', harus: /bukan saran investasi|rekomendasi|keputusan tetap/i,
  },
  {
    q: 'kenapa data hari ini belum ada padahal bursa sudah tutup sejak sore',
    kel: 'kalimat panjang', harus: /18:30|20:00|diperbarui/i,
  },
  {
    q: 'sektor mana yang paling menguat hari ini dan berapa persen kenaikannya',
    kel: 'kalimat panjang', harus: /Healthcare/,
  },
  {
    q: 'berapa harga saham Bank Central Asia sekarang',
    kel: 'kalimat panjang', harus: /6\.375|6\.300/,
  },
  {
    q: 'apakah besok bursa libur karena tanggal merah nasional',
    kel: 'kalimat panjang', harus: /bursa (tutup|buka)/i,
  },
  {
    q: 'apa saja keuntungan yang saya dapat kalau menjadi kontributor PAPAN',
    kel: 'kalimat panjang', harus: /jenjang|kuota|kontributor/i,
  },
  {
    q: 'bagaimana cara menghitung target harga setelah ARA tiga hari berturut-turut',
    kel: 'kalimat panjang', harus: /auto rejection|35%|25%/i,
  },
  {
    q: 'saya ingin tahu berapa kali BBCA disebut di edisi Arus Pasar terakhir',
    kel: 'kalimat panjang', harus: /BBCA|edisi/i,
  },
  {
    q: 'kenapa broker summary di PAPAN cuma tersedia untuk sebagian emiten saja',
    kel: 'kalimat panjang', harus: /setoran kontributor|endpoint publik|sebatas emiten/i,
  },

  // ── salah ketik & tak baku ────────────────────────────────────────────────
  { q: 'akumulsi', kel: 'salah ketik', harus: /akumulasi/i },
  { q: 'bandarmologi', kel: 'salah ketik', harus: /bandar|broker summary/i },
  { q: 'gmn cara naik jenjang', kel: 'salah ketik', harus: /jenjang/i },
  { q: 'apasih itu ARA', kel: 'salah ketik', harus: /auto rejection/i },
  { q: 'brp harga BBCA', kel: 'salah ketik', harus: /6\.375/ },
  { q: 'ihsg brp skrg', kel: 'salah ketik', harus: /6\.401,89/ },
  { q: 'apa itu fraksi hrga', kel: 'salah ketik', harus: /kelipatan|fraksi/i },
  { q: 'kontributr', kel: 'salah ketik', harus: /kontributor/i },
  { q: 'divergen', kel: 'salah ketik', harus: /divergensi/i },
  { q: 'seasonaliti', kel: 'salah ketik', harus: /musiman|seasonality/i },
  { q: 'asing net sel', kel: 'salah ketik', harus: /net sell|net buy/i },
  { q: 'apa itu akumulsi', kel: 'salah ketik', harus: /akumulasi/i },
  { q: 'jenjng kontributor', kel: 'salah ketik', harus: /jenjang/i },
  { q: 'broker sumary', kel: 'salah ketik', harus: /broker summary/i },
  { q: 'kalkultor', kel: 'salah ketik', harus: /kalkulator/i },

  // ── percakapan (menyambung jawaban sebelumnya) ────────────────────────────
  { q: 'kenapa?', kel: 'percakapan', harus: /BYAN/, ctx: { topik: 'ihsg' } },
  { q: 'berapa?', kel: 'percakapan', harus: /net sell/i, ctx: { topik: 'asing' } },
  { q: 'detailnya', kel: 'percakapan', harus: /Healthcare/, ctx: { topik: 'sektor' } },
  { q: 'kenapa?', kel: 'percakapan', harus: /Susulan dari yang mana/, ctx: { topik: null } },
  { q: 'contohnya?', kel: 'percakapan', harus: /gainers/i, ctx: { topik: 'gainer' } },
  { q: 'lanjut', kel: 'percakapan', harus: /kabar|termuat/i, ctx: { topik: 'kabar' } },
  { q: 'terus?', kel: 'percakapan', harus: /losers/i, ctx: { topik: 'loser' } },
  { q: 'apa lagi?', kel: 'percakapan', harus: /Healthcare/, ctx: { topik: 'sektor' } },
  { q: 'berapa?', kel: 'percakapan', harus: /6\.375/, ctx: { topik: 'hargaEmiten', subjek: 'BBCA' } },
  { q: 'detailnya', kel: 'percakapan', harus: /PER 13,51/, ctx: { topik: 'valuasiEmiten', subjek: 'BBCA' } },
  { q: 'kenapa?', kel: 'percakapan', harus: /Susulan dari yang mana/, ctx: { topik: 'hargaEmiten' } },
  { q: 'jelaskan', kel: 'percakapan', harus: /sepekan|sebulan/i, ctx: { topik: 'lintasWaktu' } },
]

/**
 * Set TAHAN-SIMPAN (hold-out): pertanyaan yang sengaja TIDAK dipakai menyetel
 * mesin. Korpus di atas dipakai memperbaiki, jadi angkanya pasti bagus — yang
 * benar-benar mengukur "mesinnya paham" cuma pertanyaan yang belum pernah
 * dilihat waktu memperbaiki. Angkanya dilaporkan terpisah, dan penurunan di
 * sini jauh lebih penting daripada kenaikan di korpus setelan.
 */
export const TAHAN_SIMPAN: Kasus[] = [
  { q: 'pivot', kel: '1 kata', harus: /pivot/i },
  { q: 'sponsor', kel: '1 kata', harus: /sponsor/i },
  { q: 'oscillator', kel: '1 kata', harus: /oscillator|RSI/i },
  { q: 'vonis', kel: '1 kata', harus: /vonis/i },
  { q: 'forum', kel: '1 kata', harus: /forum|diskusi/i },
  { q: 'privasi', kel: '1 kata', harus: /identitas|privasi/i },
  { q: 'apa ihsg', kel: '2 kata', harus: /IHSG/i },
  { q: 'top broker', kel: '2 kata', harus: /broker/i },
  { q: 'lupa sandi', kel: '2 kata', harus: /sandi|pengurus/i },
  { q: 'hari bursa', kel: '2 kata', harus: /hari bursa/i },
  { q: 'kapitalisasi pasar', kel: '2 kata', harus: /kapitalisasi/i },
  { q: 'akun beku', kel: '2 kata', harus: /beku|dibekukan/i },
  { q: 'apa itu pivot', kel: '3 kata', harus: /pivot/i },
  { q: 'kenapa akun dibekukan', kel: '3 kata', harus: /beku|dibekukan|setoran/i },
  { q: 'berapa PBV pasar', kel: '3 kata', harus: /PBV/i },
  { q: 'top gainers hari ini', kel: '3 kata', harus: /gainers/i },
  { q: 'kenapa harga di sini beda dengan aplikasi sekuritas saya', kel: 'kalimat panjang', harus: /fraksi|diperbarui|16:15|sumber/i },
  { q: 'bagaimana PAPAN memastikan angka yang ditampilkan benar', kel: 'kalimat panjang', harus: /sumber|telusuri|metode/i },
  { q: 'kalau akun saya dibekukan bagaimana cara mengaktifkannya lagi', kel: 'kalimat panjang', harus: /beku|setoran|pengurus/i },
  { q: 'berapa jumlah sektor yang menguat hari ini di bursa', kel: 'kalimat panjang', harus: /sektor menguat/i },
  { q: 'kapitalisas pasar', kel: 'salah ketik', harus: /kapitalisasi/i },
  { q: 'gmn cara login', kel: 'salah ketik', harus: /masuk|akun/i },
  { q: 'likuidits', kel: 'salah ketik', harus: /likuiditas/i },
  { q: 'brp per pasar', kel: 'salah ketik', harus: /PER pasar/i },
  { q: 'kenapa?', kel: 'percakapan', harus: /BYAN|poin/i, ctx: { topik: 'penggerak' } },
  { q: 'contohnya', kel: 'percakapan', harus: /edisi|terbit/i, ctx: { topik: 'edisi' } },
  { q: 'terus?', kel: 'percakapan', harus: /Financial Services/, ctx: { topik: 'sektorEmiten', subjek: 'BBCA' } },
]

type Hasil = 'benar' | 'takTahu' | 'salah'

export function nilaiKasus(k: Kasus): Hasil {
  const j = tanya(k.q, k.ctx)
  if (k.harus.test(j.teks)) return 'benar'
  return j.takPaham ? 'takTahu' : 'salah'
}

describe('korpus latih — tiap panjang masukan dijawab benar, tak ada yang salah sasaran', () => {
  // Diuji SATU PER SATU, bukan sebagai jumlah agregat: agregat yang turun dari
  // 139 ke 137 tetap hijau kalau ambangnya dilonggarkan, sedangkan baris merah
  // langsung menunjuk pertanyaan mana yang rusak.
  it.each([...KORPUS, ...TAHAN_SIMPAN])('[$kel] $q', (k) => {
    // Pesan gagalnya sengaja memuat jawaban sungguhan — yang perlu dibaca
    // kalau ini merah adalah apa yang DIJAWAB mesin, bukan sekadar "false".
    expect(`${nilaiKasus(k)} :: ${tanya(k.q, k.ctx).teks}`).toMatch(/^benar/)
  })
})

describe('tak ada kebocoran — jawaban tak menyebut isi dapur', () => {
  it('catatan glosarium yang merujuk berkas repo dibersihkan sebelum tampil', () => {
    // PCD adalah kasus nyatanya: catatannya berakhir "(lihat `arus-pasar/pcd.py`)".
    const j = tanya('apa itu PCD')
    expect(j.teks).toContain('PCD')
    expect(j.teks).not.toContain('.py')
    expect(j.teks).not.toContain('`')
  })

  it('SELURUH istilah glosarium aman ditampilkan, bukan cuma yang sudah ketahuan', () => {
    for (const e of GLOSARIUM) {
      const j = tanya(`apa itu ${e.istilah}`)
      expect(j.teks, `istilah ${e.id}`).not.toMatch(/\.(py|ts|tsx|json|md|sql|ya?ml)\b/i)
      expect(j.teks, `istilah ${e.id}`).not.toMatch(/https?:\/\/|localhost|supabase|_arsip|scripts\//i)
    }
  })

  it('SELURUH entri pengetahuan aman ditampilkan', () => {
    for (const e of PENGETAHUAN) {
      const j = tanya(e.kunci[0])
      expect(j.teks, `entri ${e.id}`).not.toMatch(/\.(py|ts|tsx|json|md|sql|ya?ml)\b/i)
      expect(j.teks, `entri ${e.id}`).not.toMatch(/https?:\/\/|localhost|supabase|_arsip|scripts\//i)
    }
  })
})
