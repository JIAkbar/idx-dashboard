import { describe, expect, it } from 'vitest'
import { fmtCell } from './KolomKuartalan'

/**
 * Sesi 18 Agu 2026 (bug q_eps ARCI, CLAUDE.md): backend-nya yang salah
 * (0.0 dipaksakan padahal bahannya ada), TAPI kalau titik render tak
 * pernah diuji terpisah, regresi berikutnya di titik ini (mis. null
 * dicoalesce ke 0 sebelum sampai fmtCell) bisa lolos tanpa ketahuan.
 */
describe('fmtCell', () => {
  it('null/undefined (bahan tak ada) selalu "—", tak peduli mode', () => {
    expect(fmtCell(null, 'eps')).toBe('—')
    expect(fmtCell(undefined, 'eps')).toBe('—')
    expect(fmtCell(null, 'ni')).toBe('—')
    expect(fmtCell(null, 'rev')).toBe('—')
  })

  it('nol SUNGGUHAN dirender "0", bukan "—" — beda dari bahan tak ada', () => {
    expect(fmtCell(0, 'eps')).toBe('0')
    expect(fmtCell(0, 'ni')).toBe('0')
    expect(fmtCell(0, 'rev')).toBe('0')
  })

  it('mode eps: angka apa adanya (IDR/saham, bukan miliaran)', () => {
    expect(fmtCell(21.11, 'eps')).toBe('21')
    expect(fmtCell(-42.15, 'eps')).toBe('-42')
  })

  it('mode ni/rev: dibagi 1 miliar (tampil dalam B IDR)', () => {
    expect(fmtCell(532585084428, 'ni')).toBe('533')
    expect(fmtCell(2447361187152, 'rev')).toBe('2.447')
  })
})
