import { describe, expect, it } from 'vitest'
import { ALASAN_MIN, alasanValid } from './alasanValidasi'

describe('alasanValid', () => {
  it('superadmin selalu valid — termasuk kosong', () => {
    expect(alasanValid('', true)).toBe(true)
    expect(alasanValid('   ', true)).toBe(true)
  })

  it('kontributor wajib minimal ALASAN_MIN karakter setelah trim', () => {
    const pas = 'a'.repeat(ALASAN_MIN)
    const kurang = 'a'.repeat(ALASAN_MIN - 1)
    expect(alasanValid(pas, false)).toBe(true)
    expect(alasanValid(kurang, false)).toBe(false)
  })

  it('spasi pinggir tidak dihitung (trim dulu, sama seperti server)', () => {
    const pasDenganSpasi = `  ${'a'.repeat(ALASAN_MIN)}  `
    expect(alasanValid(pasDenganSpasi, false)).toBe(true)
    // Isinya cuma spasi sepanjang ALASAN_MIN — setelah trim jadi 0 karakter.
    expect(alasanValid(' '.repeat(ALASAN_MIN + 5), false)).toBe(false)
  })

  it('kontributor dengan alasan kosong ditolak', () => {
    expect(alasanValid('', false)).toBe(false)
  })
})
