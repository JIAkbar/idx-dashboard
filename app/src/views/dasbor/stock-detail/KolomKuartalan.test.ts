import { describe, expect, it } from 'vitest'
import { fmtCell, ytdKuartal, jumlahYtd, hitungTtm, nilaiSetahun, labelSetahun } from './KolomKuartalan'

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

/**
 * D6 — 98 emiten pelapor USD dulu punya baris "Setahun (audit)" kosong
 * seluruhnya, karena laporan resminya dolar sementara kolom kuartal sudah
 * rupiah. Yang diuji di sini bukan "barisnya terisi", melainkan **angka
 * agregator tak pernah menyamar jadi auditan**: kalau suatu hari fallback-nya
 * dipakai tanpa mengganti label, uji ini yang gagal.
 */
describe('nilaiSetahun + labelSetahun (D6)', () => {
  const fd = {
    ticker: 'X',
    hist_net_income: { '2025': 900, '2024': 800 },
    hist_eps: { '2025': 72.13 },
    hist_revenue: { '2025': 5000 },
  } as unknown as Parameters<typeof nilaiSetahun>[0]

  const per = (net: number) => ({ net_income: net } as never)

  it('laporan rupiah -> auditan yang menang, label menyebut audit', () => {
    const kd = { currency: 'IDR', tahunan: { '2025-12-31': per(1000) } } as never
    expect(nilaiSetahun(fd, kd, 'ni', 2025)).toEqual({ v: 1000, asal: 'audit' })
    expect(labelSetahun(['audit'])).toBe('Setahun (audit)')
  })

  it('laporan dolar -> hist_* (SUDAH rupiah), dan labelnya BUKAN audit', () => {
    const kd = { currency: 'USD', tahunan: { '2025-12-31': per(0.056) } } as never
    expect(nilaiSetahun(fd, kd, 'ni', 2025)).toEqual({ v: 900, asal: 'agregator' })
    expect(labelSetahun(['agregator'])).toBe('Setahun (agregator)')
  })

  it('mata uang dibaca PER PERIODE, bukan dari ringkasan berkas (CDIA)', () => {
    // `currency` berkas bilang USD, tapi tahun buku 2024 dilaporkan rupiah.
    const kd = {
      currency: 'USD',
      mata_uang: { '2025-12-31': 'USD', '2024-12-31': 'IDR' },
      tahunan: { '2025-12-31': per(0.056), '2024-12-31': per(1200) },
    } as never
    expect(nilaiSetahun(fd, kd, 'ni', 2025).asal).toBe('agregator')
    expect(nilaiSetahun(fd, kd, 'ni', 2024)).toEqual({ v: 1200, asal: 'audit' })
    // Campuran: label tak boleh mengklaim salah satunya untuk seluruh baris.
    expect(labelSetahun(['agregator', 'audit'])).toBe('Setahun')
  })

  it('tak ada auditan DAN tak ada hist_* -> tetap kosong, bukan 0', () => {
    const kd = { currency: 'IDR', tahunan: {} } as never
    expect(nilaiSetahun(fd, kd, 'ni', 2019)).toEqual({ v: null, asal: null })
    expect(labelSetahun([null, null])).toBe('Setahun')
  })

  it('berkas keuangan_idx tak ada sama sekali -> jatuh ke hist_*', () => {
    expect(nilaiSetahun(fd, null, 'eps', 2025)).toEqual({ v: 72.13, asal: 'agregator' })
    expect(nilaiSetahun(fd, null, 'rev', 2025)).toEqual({ v: 5000, asal: 'agregator' })
  })
})
