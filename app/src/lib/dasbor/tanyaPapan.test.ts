import { describe, expect, it } from 'vitest'
import { jawab, type KonteksTanya } from './tanyaPapan'
import type { DataHarian, TanggalIndex } from './dataHarian'

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
