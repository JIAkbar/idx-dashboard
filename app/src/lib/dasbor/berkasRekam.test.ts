import { describe, it, expect } from 'vitest'
import { ringkasRekam, MIN_SAMPEL_PERSEN, type Trade } from './berkasRekam'

const t = (kode: string, r: number): Trade => ({ kode, return: r })

describe('ringkasRekam', () => {
  it('"3 dari 4 bukan 75%" — sampel kecil TIDAK dipersenkan', () => {
    const r = ringkasRekam('rbs', [t('BBCA', 0.1), t('BBCA', 0.2), t('BBCA', 0.05), t('BBCA', -0.1)], 'BBCA')
    expect(r.n).toBe(4)
    expect(r.menang).toBe(3)
    expect(r.layakPersen).toBe(false)
    expect(r.label).toContain('3 menang')
    expect(r.label).not.toContain('%')
  })

  it('dipersenkan begitu sampelnya cukup', () => {
    const trades = Array.from({ length: MIN_SAMPEL_PERSEN }, (_, i) => t('BBCA', i < 12 ? 0.05 : -0.05))
    const r = ringkasRekam('rbs', trades, 'BBCA')
    expect(r.layakPersen).toBe(true)
    expect(r.label).toContain('60%')
  })

  it('tepat di bawah ambang masih tanpa persen', () => {
    const trades = Array.from({ length: MIN_SAMPEL_PERSEN - 1 }, () => t('BBCA', 0.01))
    expect(ringkasRekam('rbs', trades, 'BBCA').layakPersen).toBe(false)
  })

  it('kalah dan return terburuk selalu ikut, bukan hanya kemenangan', () => {
    const r = ringkasRekam('rbs', [t('BBCA', 0.3), t('BBCA', -0.22)], 'BBCA')
    expect(r.kalah).toBe(1)
    expect(r.terburuk).toBeCloseTo(-0.22)
    expect(r.terbaik).toBeCloseTo(0.3)
  })

  it('menyaring emiten lain, tak peduli besar-kecil hurufnya', () => {
    const r = ringkasRekam('rbs', [t('bbca', 0.1), t('TLKM', 0.9)], 'BBCA')
    expect(r.n).toBe(1)
    expect(r.terbaik).toBeCloseTo(0.1)
  })

  it('trade tanpa hasil diabaikan, bukan dihitung seri', () => {
    const r = ringkasRekam('rbs', [{ kode: 'BBCA' }, t('BBCA', 0.1)], 'BBCA')
    expect(r.n).toBe(1)
  })

  it('nol trade menjawab dengan kalimat, bukan angka kosong', () => {
    const r = ringkasRekam('rbs', [t('TLKM', 0.1)], 'BBCA')
    expect(r.n).toBe(0)
    expect(r.median).toBeNull()
    expect(r.label).toContain('Belum pernah')
  })

  it('return nol bukan menang dan bukan kalah', () => {
    const r = ringkasRekam('rbs', [t('BBCA', 0)], 'BBCA')
    expect(r.n).toBe(1)
    expect(r.menang).toBe(0)
    expect(r.kalah).toBe(0)
  })

  it('median genap = rata-rata dua tengah', () => {
    const r = ringkasRekam('rbs', [t('BBCA', 0.1), t('BBCA', 0.3)], 'BBCA')
    expect(r.median).toBeCloseTo(0.2)
  })
})
