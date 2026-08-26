import { describe, expect, it } from 'vitest'
import { KODE_SEKTOR_EN, SEKTOR_IDX_EN } from './sektorIdx'

/**
 * Penjaga EJAAN nama sektor Inggris resmi IDX (catatan pengawas 27 Agu):
 * `Properties` JAMAK, `Logistic` TUNGGAL. Satu huruf salah memutus tiga
 * join sekaligus — kunci pill RRG, SYM_SEKTOR SektorIndeks, dan pencocokan
 * `hari.sectors` sesudah awalan "[X] " dilucuti — TANPA satu pun galat.
 */
describe('SEKTOR_IDX_EN', () => {
  it('sebelas nama, ejaan persis lang=en (Properties jamak, Logistic tunggal)', () => {
    expect([...SEKTOR_IDX_EN].sort()).toEqual([
      'Basic Materials', 'Consumer Cyclicals', 'Consumer Non-Cyclicals',
      'Energy', 'Financials', 'Healthcare', 'Industrials', 'Infrastructures',
      'Properties & Real Estate', 'Technology', 'Transportation & Logistic',
    ])
    expect(SEKTOR_IDX_EN).toContain('Properties & Real Estate')
    expect(SEKTOR_IDX_EN).not.toContain('Property & Real Estate')
    expect(SEKTOR_IDX_EN).toContain('Transportation & Logistic')
    expect(SEKTOR_IDX_EN).not.toContain('Transportation & Logistics')
  })
  it('KODE_SEKTOR_EN menutup persis kesebelas nama itu', () => {
    expect(Object.keys(KODE_SEKTOR_EN).sort()).toEqual([...SEKTOR_IDX_EN].sort())
    expect(new Set(Object.values(KODE_SEKTOR_EN)).size).toBe(11)
  })
})
