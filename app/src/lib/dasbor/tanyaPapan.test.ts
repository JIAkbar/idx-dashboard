import { afterEach, describe, expect, it, vi } from 'vitest'
import { jawab, type KonteksTanya } from './tanyaPapan'
import type { DataHarian, TanggalIndex } from './dataHarian'
import type { KamusEmiten } from './kamusEmiten'
import type { StockFundamental } from './stockDetailData'
import type { InvestorMapEntry } from './petaInvestorData'

const hari = {
  date_id: 'Jumat, 14 Agustus 2026',
  trading_day: 145,
  ihsg_value: 6401.89,
  ihsg_pct: 1.59,
  ihsg_prev: 6301.77,
  nf_today_idr: -1034.66,
  nf_ytd_idr: -72870,
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
