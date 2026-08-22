import { describe, expect, it } from 'vitest'
import { saringAliranAsing } from './aliranAsing'
import type { BarisScreener } from './screener'

function baris(over: Partial<BarisScreener> = {}): BarisScreener {
  return {
    kode: 'AAAA', nama: 'Contoh Tbk.', sektor: 'Energy', harga: 1000, tdm_persen: 1,
    volume: 1000, rvol10: 1, nilai: 1e9, likuiditas: 1e9, sss_d: 'Buy', sss_w: 'Buy', sss_m: 'Buy',
    free_float: 30, ma20_arah: 'naik', close_gap: 0, chg_1d: 1, chg_wtd: 1, chg_mtd: 1,
    posisi_ema5: 'atas', posisi_ma10: 'atas', posisi_ma20: 'atas', net_asing_lembar: 1000,
    ...over,
  }
}

describe('saringAliranAsing', () => {
  const data = [
    baris({ kode: 'AAAA', nama: 'Alpha Tbk.', likuiditas: 2e8, net_asing_lembar: 500 }),
    baris({ kode: 'BBBB', nama: 'Beta Tbk.', likuiditas: 2e9, net_asing_lembar: -300 }),
    baris({ kode: 'CCCC', nama: 'Gamma Tbk.', likuiditas: null, net_asing_lembar: null }),
  ]

  it('tanpa saringan = seluruh baris lolos', () => {
    expect(saringAliranAsing(data, '', 'semua').map((b) => b.kode)).toEqual(['AAAA', 'BBBB', 'CCCC'])
  })

  it('kata cari cocok kode atau nama, case-insensitive', () => {
    expect(saringAliranAsing(data, 'beta', 'semua').map((b) => b.kode)).toEqual(['BBBB'])
  })

  it('tingkat likuiditas ambang rupiah menyaring null ikut gugur', () => {
    expect(saringAliranAsing(data, '', 'mrd1').map((b) => b.kode)).toEqual(['BBBB'])
  })

  it('tingkat "semesta" (peringkat) menghitung ulang dari populasi yang diberikan', () => {
    // n=3, peringkat 150-teratas otomatis meloloskan seluruh baris ber-nilai
    expect(saringAliranAsing(data, '', 'semesta').map((b) => b.kode)).toEqual(['AAAA', 'BBBB'])
  })

  it('cari + likuiditas AND, bukan OR', () => {
    // 'alpha' cuma cocok AAAA, tapi likuiditas AAAA (2e8) di bawah ambang mrd1
    expect(saringAliranAsing(data, 'alpha', 'mrd1')).toEqual([])
  })
})
