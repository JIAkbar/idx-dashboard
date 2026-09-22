import { describe, expect, it } from 'vitest'
import { ringkasNegara } from './kunjungan'

describe('ringkasNegara (#213)', () => {
  it('urut menurun, persen dari yang diketahui', () => {
    const r = ringkasNegara([{ kode: 'US', n: 1 }, { kode: 'ID', n: 3 }])
    expect(r.map((b) => b.kode)).toEqual(['ID', 'US'])
    expect(r[0].persen).toBeCloseTo(75)
    expect(r[1].persen).toBeCloseTo(25)
  })
  it('sisa di atas batas jadi satu baris Lainnya', () => {
    const r = ringkasNegara([{ kode: 'ID', n: 5 }, { kode: 'US', n: 2 }, { kode: 'SG', n: 1 }, { kode: 'MY', n: 1 }], 2)
    expect(r).toHaveLength(3)
    expect(r[2]).toMatchObject({ kode: '', n: 2 })
    expect(r[2].nama).toContain('2 negara')
    expect(r.reduce((a, b) => a + b.persen, 0)).toBeCloseTo(100)
  })
  it('kosong atau nol -> tanpa baris', () => {
    expect(ringkasNegara([])).toEqual([])
    expect(ringkasNegara([{ kode: 'ID', n: 0 }])).toEqual([])
  })
})
