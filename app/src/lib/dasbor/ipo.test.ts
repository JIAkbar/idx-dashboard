import { describe, it, expect } from 'vitest'
import { agregatPerTahun, agregatKeseluruhan, tahunUnik, type BarisIpo } from './ipo'

/** Fixture 3 emiten, 2 tahun — angka horizon dihitung ulang TANGAN di komentar
 *  tiap `it`, bukan cuma dibandingkan ke dirinya sendiri. */
function baris(o: Partial<BarisIpo> & { kode: string; tahun: number }): BarisIpo {
  return {
    nama: null, tanggal_listing: `${o.tahun}-01-01`,
    harga_ipo: 100, lembar: null, dana: null, underwriters: [],
    close_1d: null, return_1d: null, close_1w: null, return_1w: null,
    close_1m: null, return_1m: null, close_kini: null, return_kini: null,
    ...o,
  }
}

const FIXTURE: BarisIpo[] = [
  baris({ kode: 'AAAA', tahun: 2020, return_1d: 10, return_kini: 50 }), // win 1d & kini
  baris({ kode: 'BBBB', tahun: 2020, return_1d: -5, return_kini: -20 }), // kalah keduanya
  baris({ kode: 'CCCC', tahun: 2021, return_1d: 20, return_kini: null }), // return_kini belum ada
]

describe('agregatPerTahun', () => {
  const hasil = agregatPerTahun(FIXTURE)

  it('urut tahun menurun, satu baris per tahun', () => {
    expect(hasil.map((h) => h.tahun)).toEqual([2021, 2020])
  })

  it('2020: n=2, win 1D = 1/2 = 0.5, median return_1d = (10 + -5)/2 = 2.5', () => {
    const y2020 = hasil.find((h) => h.tahun === 2020)!
    expect(y2020.n).toBe(2)
    expect(y2020.h1d.n).toBe(2)
    expect(y2020.h1d.win).toBeCloseTo(0.5)
    expect(y2020.h1d.median).toBeCloseTo(2.5)
  })

  it('2020 Kini: win 1/2, median (50 + -20)/2 = 15', () => {
    const y2020 = hasil.find((h) => h.tahun === 2020)!
    expect(y2020.hkini.n).toBe(2)
    expect(y2020.hkini.win).toBeCloseTo(0.5)
    expect(y2020.hkini.median).toBeCloseTo(15)
  })

  it('2021: return_kini null tak dihitung — n=0, win & median null', () => {
    const y2021 = hasil.find((h) => h.tahun === 2021)!
    expect(y2021.hkini).toEqual({ n: 0, win: null, median: null })
    expect(y2021.h1d).toEqual({ n: 1, win: 1, median: 20 })
  })
})

describe('agregatKeseluruhan', () => {
  it('n = seluruh baris, win 1D gabungan = 2/3', () => {
    const a = agregatKeseluruhan(FIXTURE)
    expect(a.n).toBe(3)
    expect(a.h1d.n).toBe(3)
    expect(a.h1d.win).toBeCloseTo(2 / 3)
  })
})

describe('tahunUnik', () => {
  it('tahun yang benar-benar ada, urut menurun', () => {
    expect(tahunUnik(FIXTURE)).toEqual([2021, 2020])
  })
})
