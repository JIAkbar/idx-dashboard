import { describe, expect, it } from 'vitest'
import { fmtCell, ytdKuartal, jumlahYtd, hitungTtm } from './KolomKuartalan'

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

/**
 * Data nyata 19 Agu 2026 — BBCA (2025 bolong Q3) dan TLKM (2025 bolong Q1).
 * Dipakai apa adanya supaya uji ini gagal kalau aturannya berubah diam-diam,
 * bukan cuma kalau angkanya berubah.
 */
const BBCA_NI = {
  '2026': { Q1: 14684123000000, Q2: 14850323000000 },
  '2025': { Q1: 14146131000000, Q2: 14870283000000, Q4: 14139872000000 },
}
const TLKM_NI = {
  '2026': { Q1: 4344000000000, Q2: 6279000000000 },
  '2025': { Q2: 5165000000000, Q3: 4809000000000, Q4: 1702000000000 },
}

describe('ytdKuartal + jumlahYtd — YTD apa adanya, bukan "annualised"', () => {
  it('n = kuartal pertama berturut-turut di tahun terbaru', () => {
    expect(ytdKuartal(BBCA_NI)).toBe(2)
    expect(ytdKuartal({})).toBe(0)
    // Q1 belum ada -> tak ada YTD yang bisa dieja, bukan "1 kuartal".
    expect(ytdKuartal({ '2026': { Q2: 5 } })).toBe(0)
  })

  it('jumlah Q1..Qn, dan tahun yang bolong TIDAK menyamar jadi YTD', () => {
    expect(jumlahYtd(BBCA_NI, 2026, 2)).toBe(29534446000000)
    expect(jumlahYtd(BBCA_NI, 2025, 2)).toBe(29016414000000)
    expect(jumlahYtd(TLKM_NI, 2025, 2)).toBeNull() // Q1 2025 tak ada
    expect(jumlahYtd(BBCA_NI, 2024, 2)).toBeNull() // tahunnya tak ada
    expect(jumlahYtd(BBCA_NI, 2026, 0)).toBeNull()
  })
})

describe('hitungTtm — keterurutan, bukan sekadar empat nilai', () => {
  it('4 nilai tapi ada celah -> null (inilah bug lamanya)', () => {
    // BBCA: 2026Q2, 2026Q1, 2025Q4, 2025Q2 — merentang 5 kuartal.
    expect(hitungTtm(BBCA_NI)).toEqual({ sum: null, tersedia: 3 })
  })

  it('4 kuartal berurutan berakhir di kuartal terlapor terakhir -> jumlahnya', () => {
    // TLKM: 2026Q2, 2026Q1, 2025Q4, 2025Q3 — rapat.
    expect(hitungTtm(TLKM_NI)).toEqual({ sum: 17134000000000, tersedia: 4 })
  })

  it('runtun panjang tetap dipotong 4 TERAKHIR, bukan 4 pertama', () => {
    const q = { '2025': { Q1: 1, Q2: 2, Q3: 4, Q4: 8 }, '2026': { Q1: 16, Q2: 32 } }
    expect(hitungTtm(q)).toEqual({ sum: 4 + 8 + 16 + 32, tersedia: 4 })
  })

  it('kurang dari 4 kuartal -> null + jumlah yang benar-benar ada', () => {
    expect(hitungTtm({ '2026': { Q1: 1, Q2: 2 } })).toEqual({ sum: null, tersedia: 2 })
    expect(hitungTtm({})).toEqual({ sum: null, tersedia: 0 })
  })

  it('nol sungguhan ikut dihitung, null tidak', () => {
    const q = { '2025': { Q3: 0, Q4: 5 }, '2026': { Q1: 5, Q2: 5 } }
    expect(hitungTtm(q)).toEqual({ sum: 15, tersedia: 4 })
  })
})
