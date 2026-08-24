import { describe, expect, it } from 'vitest'
import { keBarisKaya } from './ohlcvKaya'

describe('keBarisKaya', () => {
  it('memetakan indeks kolom chartbit ke ruas bernama', () => {
    // tanggal,unixdate,o,h,l,c,volume,value,frequency,foreignbuy,foreignsell,foreignflow,dividend,shareoutstanding
    const bar = ['2026-08-21', 1787245200, 6400, 6475, 6400, 6450, 100684300,
      648871165000, 23357, 515049425000, 245956022500, -54740952267010, 0, 123275050000]
    const [tanggal, k] = keBarisKaya(bar)
    expect(tanggal).toBe('2026-08-21')
    expect(k).toEqual({
      nilai: 648871165000,
      frekuensi: 23357,
      foreignBeli: 515049425000,
      foreignJual: 245956022500,
      sahamBeredar: 123275050000,
    })
  })
})
