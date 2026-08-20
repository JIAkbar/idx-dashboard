import { describe, expect, it } from 'vitest'
import type { BarisOhlc } from './ihsgOhlc'
import { HORIZON, MIN_SAMPEL, hitungEma, posisiEma, sandiKeadaan } from './emaWatchlist'

/** Deret buatan: satu baris OHLC dengan `tutup` yang ditentukan. */
function deret(tutup: number[]): BarisOhlc[] {
  return tutup.map((c, i) => [`2020-01-${String(i + 1).padStart(2, '0')}`, c, c, c, c, 1000] as BarisOhlc)
}

describe('hitungEma', () => {
  it('null sampai periodenya penuh — bukan angka kasar', () => {
    const e = hitungEma([1, 2, 3, 4, 5], 3)
    expect(e.slice(0, 2)).toEqual([null, null])
    expect(e[2]).toBe(2) // rata-rata semai (1+2+3)/3
  })

  it('deret lebih pendek dari periode: semuanya null', () => {
    expect(hitungEma([1, 2], 5)).toEqual([null, null])
  })

  it('nilai tetap: EMA sama dengan nilainya', () => {
    const e = hitungEma(new Array(30).fill(7), 10)
    expect(e[29]).toBeCloseTo(7, 10)
  })

  it('EMA bergerak ke arah harga terbaru, lebih cepat dari rata-rata sederhana', () => {
    const naik = hitungEma([...new Array(20).fill(100), 200], 20)
    expect(naik[20]!).toBeGreaterThan(100)
    expect(naik[20]!).toBeLessThan(200)
  })
})

describe('sandiKeadaan', () => {
  it('satu digit per EMA, urut 50/100/200', () => {
    expect(sandiKeadaan(100, [90, 110, 95])).toBe('101')
  })

  it('EMA belum ada = keadaan tak diketahui, BUKAN "di bawah"', () => {
    expect(sandiKeadaan(100, [90, null, 95])).toBeNull()
  })
})

describe('posisiEma', () => {
  it('deret kosong tak melempar', () => {
    expect(posisiEma([]).sandi).toBeNull()
  })

  it('deret pendek: EMA200 belum ada, jadi sandinya null dan peluang tak dilaporkan', () => {
    const p = posisiEma(deret(new Array(120).fill(0).map((_, i) => 100 + i)))
    expect(p.sandi).toBeNull()
    expect(p.peluang).toBeNull()
  })

  it('tren naik lurus: harga di atas ketiga EMA', () => {
    const p = posisiEma(deret(new Array(400).fill(0).map((_, i) => 100 + i)))
    expect(p.sandi).toBe('111')
  })

  it('tren naik lurus: peluang naik 100% karena setiap kejadian memang naik', () => {
    const p = posisiEma(deret(new Array(400).fill(0).map((_, i) => 100 + i)))
    expect(p.peluang).not.toBeNull()
    expect(p.peluang!.persen).toBe(100)
    expect(p.peluang!.naik).toBe(p.peluang!.n)
  })

  it('tren turun lurus: harga di bawah ketiga EMA dan peluang naik 0%', () => {
    const p = posisiEma(deret(new Array(400).fill(0).map((_, i) => 900 - i)))
    expect(p.sandi).toBe('000')
    expect(p.peluang!.persen).toBe(0)
  })

  it('sampel di bawah ambang tidak dilaporkan — lebih baik "—" daripada persen dari segelintir kejadian', () => {
    // 210 baris: EMA200 baru ada di 10 baris terakhir, jadi kejadian dengan
    // sandi lengkap jauh lebih sedikit dari MIN_SAMPEL.
    const p = posisiEma(deret(new Array(210).fill(0).map((_, i) => 100 + i)))
    expect(p.sandi).toBe('111')
    expect(p.peluang).toBeNull()
    expect(MIN_SAMPEL).toBeGreaterThan(10)
  })

  it('hari-hari terakhir yang hasilnya belum diketahui tak ikut jadi penyebut', () => {
    // Kalau HORIZON hari terakhir ikut dihitung sebagai "belum naik", deret
    // naik lurus tak akan pernah mencapai 100%.
    const tutup = new Array(400).fill(0).map((_, i) => 100 + i)
    const p = posisiEma(deret(tutup))
    const maksimal = tutup.length - 1 - HORIZON
    expect(p.peluang!.n).toBeLessThanOrEqual(maksimal)
    expect(p.peluang!.persen).toBe(100)
  })
})
