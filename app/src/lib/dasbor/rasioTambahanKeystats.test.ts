import { describe, it, expect } from 'vitest'
import { angka } from './rasioTambahanKeystats'

describe('angka (parser rasio keystats)', () => {
  it('persen biasa', () => {
    expect(angka('5.32%')).toBeCloseTo(5.32, 6)
  })
  it('kosong ("-") -> null', () => {
    expect(angka('-')).toBeNull()
    expect(angka(undefined)).toBeNull()
    expect(angka(null)).toBeNull()
    expect(angka('')).toBeNull()
  })
  it('ribuan dengan koma', () => {
    expect(angka('1,234.56')).toBeCloseTo(1234.56, 6)
  })
  it('negatif dalam kurung', () => {
    expect(angka('(16,348 B)'.replace(' B', ''))).toBeCloseTo(-16348, 6)
  })
  it('angka murni (number)', () => {
    expect(angka(21.47)).toBeCloseTo(21.47, 6)
  })
})
