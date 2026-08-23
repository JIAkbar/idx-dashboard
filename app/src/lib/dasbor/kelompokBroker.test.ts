import { describe, it, expect } from 'vitest'
import { kelompokBroker, warnaBroker, WARNA_KELOMPOK, LABEL_KELOMPOK } from './kelompokBroker'

describe('kelompokBroker', () => {
  it('mengenali kode terkurasi tiap kelompok', () => {
    expect(kelompokBroker('BK')).toBe('asing')
    expect(kelompokBroker('NI')).toBe('institusi')
    expect(kelompokBroker('YP')).toBe('ritel')
    expect(kelompokBroker('MG')).toBe('mix')
  })

  it('kode tak dikurasi jatuh ke lain', () => {
    expect(kelompokBroker('XX')).toBe('lain')
    expect(kelompokBroker('')).toBe('lain')
  })

  it('tiap kelompok punya warna & label, dan warnanya bukan hijau/merah beli-jual', () => {
    for (const k of Object.keys(LABEL_KELOMPOK) as (keyof typeof LABEL_KELOMPOK)[]) {
      expect(WARNA_KELOMPOK[k]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
    expect(WARNA_KELOMPOK.asing).not.toBe('#22C55E')
    expect(WARNA_KELOMPOK.asing).not.toBe('#EF4444')
  })

  it('warnaBroker = jalan pintas warna kelompok dari kode', () => {
    expect(warnaBroker('BK')).toBe(WARNA_KELOMPOK.asing)
    expect(warnaBroker('ZZZ')).toBe(WARNA_KELOMPOK.lain)
  })
})
