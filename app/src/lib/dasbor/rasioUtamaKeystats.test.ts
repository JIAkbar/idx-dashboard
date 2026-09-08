import { describe, expect, it } from 'vitest'
import { pilihRasio, PETA_KEYSTATS, JUDUL_ASAL } from './rasioUtamaKeystats'

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

  it('hanya lima ruas yang dirotasi — enam yang ditahan tidak boleh ikut', () => {
    // pe/eps/roe/der_q/price_fcf/f_score sengaja TIDAK di peta ini: dua sumber
    // memakai laba TTM yang berbeda (UNVR eps 2,26x), dan memilih yang salah
    // menggandakan laba di layar tanpa satu pun galat.
    expect(Object.keys(PETA_KEYSTATS).sort())
      .toEqual(['altman_z', 'asset_turnover', 'dividend_yield', 'pb', 'ps'])
  })

  it('tiap asal punya keterangan hover — angka tanpa penjelasan asalnya tak boleh tayang', () => {
    expect(JUDUL_ASAL.keystats).toBeTruthy()
    expect(JUDUL_ASAL['cadangan-lama']).toContain('cadangan')
  })
})
