import { describe, expect, it } from 'vitest'
import { CHIP_BAWAAN, SARINGAN, keBarisTabel, saring, type BarisRingkas, type BarisTabel } from './kartuRingkas'

function barisDasar(over: Partial<BarisRingkas> = {}): BarisRingkas {
  return {
    kode: 'AAAA', tgl: '2026-08-18', harga: 1000, chg: 1, n: 600, ma20: 950,
    atr_pct: 2, s1: 950, r1: 1050, er_persentil: 50, likuiditas: 2e9, stop_pct: 3,
    ...over,
  }
}

describe('SARINGAN', () => {
  it('tiap label memuat operator pembanding — nama sifat menyembunyikan aturannya', () => {
    for (const s of SARINGAN) expect(s.label).toMatch(/[≥<>≤]/)
  })
})

describe('CHIP_BAWAAN', () => {
  it('kosong — nol chip menyala saat halaman dibuka', () => {
    expect(CHIP_BAWAAN).toEqual([])
  })
})

describe('keBarisTabel', () => {
  it('s1/r1/atr_pct kosong menghasilkan null, bukan 0', () => {
    const b = keBarisTabel(barisDasar({ s1: null, r1: null, atr_pct: null }))
    expect(b.s1_pct).toBeNull()
    expect(b.s1_atr).toBeNull()
    expect(b.r1_pct).toBeNull()
    expect(b.r1_atr).toBeNull()
    expect(b.dekat_atr).toBeNull()
  })

  it('menghitung jarak persen & ATR saat data lengkap', () => {
    const b = keBarisTabel(barisDasar())
    expect(b.s1_pct).toBeCloseTo(5, 5) // (1000-950)/1000*100
    expect(b.r1_pct).toBeCloseTo(5, 5) // (1050-1000)/1000*100
    expect(b.s1_atr).toBeCloseTo(2.5, 5) // 5/2
    expect(b.dekat_atr).toBeCloseTo(2.5, 5)
  })
})

describe('saring', () => {
  const baris: BarisTabel[] = [barisDasar({ kode: 'AAAA' }), barisDasar({ kode: 'BBBB' })].map(keBarisTabel)

  it('nol chip aktif mengembalikan seluruh baris', () => {
    expect(saring(baris, [], '')).toHaveLength(2)
  })
})
