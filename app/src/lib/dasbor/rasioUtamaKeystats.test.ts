import { describe, expect, it } from 'vitest'
import { pilihRasio, petaRasio, PETA_KEYSTATS, JUDUL_ASAL } from './rasioUtamaKeystats'

const ks = (n: Partial<Record<string, number | null>>) => n as Record<string, number | null>

describe('rotasi rasio ke keystats (#36 A)', () => {
  it('keystats menang kalau angkanya ada', () => {
    const r = pilihRasio('pb', 2.9, ks({ [PETA_KEYSTATS.pb]: 3.02 }))
    expect(r).toEqual({ nilai: 3.02, asal: 'keystats' })
  })

  it('sumber lama dipakai APA ADANYA dan ditandai cadangan, bukan dibuang', () => {
    // Aturan 3c: yang lama jadi cadangan bertanda, bukan sampah.
    expect(pilihRasio('ps', 6.8, ks({}))).toEqual({ nilai: 6.8, asal: 'cadangan-lama' })
    expect(pilihRasio('ps', 6.8, null)).toEqual({ nilai: 6.8, asal: 'cadangan-lama' })
  })

  it('NOL dari keystats itu nilai yang sah, bukan "tak ada"', () => {
    // Rasio memang bisa nol. Membuangnya akan diam-diam memilih sumber lama
    // untuk emiten yang angkanya justru benar-benar nol.
    expect(pilihRasio('dividend_yield', 4.92, ks({ [PETA_KEYSTATS.dividend_yield]: 0 })))
      .toEqual({ nilai: 0, asal: 'keystats' })
  })

  it('dua-duanya kosong = tak ada yang ditandai', () => {
    expect(pilihRasio('altman_z', null, ks({}))).toEqual({ nilai: null, asal: null })
  })

  it('NaN diperlakukan sebagai kosong di kedua sisi', () => {
    expect(pilihRasio('asset_turnover', Number.NaN, ks({ [PETA_KEYSTATS.asset_turnover]: Number.NaN })))
      .toEqual({ nilai: null, asal: null })
  })

  it('sembilan ruas dirotasi — tiga yang ditahan tidak boleh ikut', () => {
    // #36 A (8 Sep) lima rasio, #36 opsi 1 (13 Sep 2026) kelompok laba TTM.
    // der_q/price_fcf/f_score tetap TIDAK di peta ini: skala, definisi arus
    // kas, dan implementasi Piotroski yang berbeda.
    expect(Object.keys(PETA_KEYSTATS).sort()).toEqual([
      'altman_z', 'asset_turnover', 'dividend_yield', 'earn_yield', 'eps', 'pb', 'pe', 'ps', 'roe',
    ])
  })

  it('tiap asal punya keterangan hover — angka tanpa penjelasan asalnya tak boleh tayang', () => {
    expect(JUDUL_ASAL.keystats).toBeTruthy()
    expect(JUDUL_ASAL['cadangan-lama']).toContain('cadangan')
  })

  it('ROE cadangan dikali 100 — sumber lama rasio, keystats persen (#36 opsi 1)', () => {
    const cadangan = pilihRasio('roe', 0.21818, null)
    expect(cadangan.asal).toBe('cadangan-lama')
    expect(cadangan.nilai).toBeCloseTo(21.818, 9)
    expect(pilihRasio('roe', 0.21818, ks({ [PETA_KEYSTATS.roe]: 21.47 }))).toEqual({ nilai: 21.47, asal: 'keystats' })
  })

  it('ROE 0 di keystats berarti tak dihitung, bukan laba nol — jatuh ke cadangan', () => {
    const r = pilihRasio('roe', 0.05, ks({ [PETA_KEYSTATS.roe]: 0 }))
    expect(r.asal).toBe('cadangan-lama')
    expect(r.nilai).toBeCloseTo(5, 9)
  })

  it('P/E dari laba negatif tampil kosong dan TIDAK jatuh ke P/E lama yang basi', () => {
    // AKKU 13 Sep 2026: keystats -9,34, sumber lama masih 336,28.
    expect(pilihRasio('pe', 336.28, ks({ [PETA_KEYSTATS.pe]: -9.34 }))).toEqual({ nilai: null, asal: 'keystats' })
    expect(pilihRasio('pe', 13.4, ks({ [PETA_KEYSTATS.pe]: 13.43 }))).toEqual({ nilai: 13.43, asal: 'keystats' })
  })

  it('EPS dan earnings yield negatif tetap tayang — rugi itu informasi', () => {
    expect(pilihRasio('eps', 12, ks({ [PETA_KEYSTATS.eps]: -6.27 }))).toEqual({ nilai: -6.27, asal: 'keystats' })
    expect(pilihRasio('earn_yield', 1, ks({ [PETA_KEYSTATS.earn_yield]: -20.9 })))
      .toEqual({ nilai: -20.9, asal: 'keystats' })
  })

  it('petaRasio membaca angka berbentuk teks dari kartu lama', () => {
    expect(petaRasio('pb', '2.88')).toEqual({ [PETA_KEYSTATS.pb]: 2.88 })
    expect(petaRasio('pb', '-17,434.73')).toEqual({ [PETA_KEYSTATS.pb]: -17434.73 })
    expect(petaRasio('pb', '-')).toBeNull()
    expect(petaRasio('roe', 21.47)).toEqual({ [PETA_KEYSTATS.roe]: 21.47 })
  })
})
