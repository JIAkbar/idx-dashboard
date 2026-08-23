import { describe, it, expect } from 'vitest'
import { kelompokBroker, namaBroker, warnaBroker, kelasBroker, LABEL_KELOMPOK } from './kelompokBroker'

describe('kelompokBroker', () => {
  it('mengenali kode terkurasi tiap kelompok (kurasi mockup 22 Agu 2026)', () => {
    expect(kelompokBroker('AK')).toBe('asing')
    expect(kelompokBroker('NI')).toBe('bumn')
    expect(kelompokBroker('LG')).toBe('smart')
    expect(kelompokBroker('PD')).toBe('ritel')
  })

  it('kode tak dikurasi jatuh ke lain', () => {
    expect(kelompokBroker('XX')).toBe('lain')
    expect(kelompokBroker('')).toBe('lain')
  })

  it('afiliasi ada sebagai kelompok walau kosong untuk BUMI', () => {
    expect(LABEL_KELOMPOK.afiliasi).toBe('Afiliasi grup / bandar')
  })

  it('enam kelompok semuanya punya label', () => {
    expect(Object.keys(LABEL_KELOMPOK).sort()).toEqual(
      ['afiliasi', 'asing', 'bumn', 'lain', 'ritel', 'smart'],
    )
  })

  it('namaBroker mengembalikan nama sekuritas, atau "belum dikurasi"', () => {
    expect(namaBroker('AK')).toBe('UBS')
    expect(namaBroker('ZZZ')).toBe('belum dikurasi')
  })

  it('warnaBroker & kelasBroker jalan pintas dari kelompok', () => {
    expect(warnaBroker('AK')).toBe('var(--k-asing)')
    expect(warnaBroker('ZZZ')).toBe('var(--k-lain)')
    expect(kelasBroker('NI')).toBe('k-bumn')
  })
})
