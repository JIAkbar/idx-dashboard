import { describe, expect, it } from 'vitest'
import {
  fDec, kelasArah, kelasPosisi, kelasSss, LABEL_SSS, ringkasLembarBertanda, saring, sektorUnik,
  type BarisScreener,
} from './screener'

function baris(over: Partial<BarisScreener> = {}): BarisScreener {
  return {
    kode: 'AAAA', nama: 'Contoh Tbk.', sektor: 'Energy', harga: 1000, tdm_persen: 1,
    volume: 1000, rvol10: 1, nilai: 1e9, sss_d: 'Buy', sss_w: 'Buy', sss_m: 'Buy',
    free_float: 30, ma20_arah: 'naik', close_gap: 0, chg_1d: 1, chg_wtd: 1, chg_mtd: 1,
    posisi_ema5: 'atas', posisi_ma10: 'atas', posisi_ma20: 'atas', net_asing_lembar: 1000,
    ...over,
  }
}

describe('LABEL_SSS', () => {
  it('lima label tetap, urut kuat→lemah→kuat', () => {
    expect(LABEL_SSS).toEqual(['Strong Buy', 'Buy', 'Neutral', 'Sell', 'Strong Sell'])
  })
})

describe('sektorUnik', () => {
  it('distinct + urut abjad id-ID, termasuk "-" kalau memang ada barisnya', () => {
    const b = [baris({ sektor: 'Technology' }), baris({ sektor: 'Energy' }), baris({ sektor: 'Energy' }), baris({ sektor: '-' })]
    expect(sektorUnik(b)).toEqual(['-', 'Energy', 'Technology'])
  })
})

describe('saring', () => {
  const data = [
    baris({ kode: 'AAAA', nama: 'Alpha Tbk.', sektor: 'Energy', sss_d: 'Strong Buy' }),
    baris({ kode: 'BBBB', nama: 'Beta Tbk.', sektor: 'Technology', sss_d: 'Sell' }),
    baris({ kode: 'CCCC', nama: 'Gamma Tbk.', sektor: 'Energy', sss_d: null }),
  ]

  it('kosong semua = lolos semua', () => {
    expect(saring(data, [], [], '')).toHaveLength(3)
  })

  it('kata cari cocok kode ATAU nama, case-insensitive', () => {
    expect(saring(data, [], [], 'bbbb').map((b) => b.kode)).toEqual(['BBBB'])
    expect(saring(data, [], [], 'gamma').map((b) => b.kode)).toEqual(['CCCC'])
  })

  it('chip SSS: OR di dalam kelompok', () => {
    const hasil = saring(data, ['Strong Buy', 'Sell'], [], '')
    expect(hasil.map((b) => b.kode).sort()).toEqual(['AAAA', 'BBBB'])
  })

  it('sss_d null tak pernah lolos saringan SSS aktif — "tak diketahui" bukan "netral"', () => {
    const hasil = saring(data, ['Neutral'], [], '')
    expect(hasil.find((b) => b.kode === 'CCCC')).toBeUndefined()
  })

  it('chip sektor: OR di dalam kelompok', () => {
    expect(saring(data, [], ['Technology'], '').map((b) => b.kode)).toEqual(['BBBB'])
  })

  it('SSS dan sektor AND lintas kelompok', () => {
    const hasil = saring(data, ['Strong Buy'], ['Technology'], '')
    expect(hasil).toHaveLength(0)
  })
})

describe('kelasSss', () => {
  it('Strong Buy: hijau + kuat', () => {
    expect(kelasSss('Strong Buy')).toEqual({ warna: 'up', kuat: true })
  })
  it('Buy: hijau, tak kuat', () => {
    expect(kelasSss('Buy')).toEqual({ warna: 'up', kuat: false })
  })
  it('Neutral & null: tanpa warna', () => {
    expect(kelasSss('Neutral')).toEqual({ warna: '', kuat: false })
    expect(kelasSss(null)).toEqual({ warna: '', kuat: false })
  })
  it('Sell/Strong Sell: merah', () => {
    expect(kelasSss('Sell')).toEqual({ warna: 'dn', kuat: false })
    expect(kelasSss('Strong Sell')).toEqual({ warna: 'dn', kuat: true })
  })
})

describe('kelasArah & kelasPosisi', () => {
  it('naik/atas = up, turun/bawah = dn, sisanya kosong', () => {
    expect(kelasArah('naik')).toBe('up')
    expect(kelasArah('turun')).toBe('dn')
    expect(kelasArah('datar')).toBe('')
    expect(kelasArah(null)).toBe('')
    expect(kelasPosisi('atas')).toBe('up')
    expect(kelasPosisi('bawah')).toBe('dn')
    expect(kelasPosisi(null)).toBe('')
  })
})

describe('fDec', () => {
  it('null -> em dash, bukan 0 — nol persen ≠ tak diketahui', () => {
    expect(fDec(null)).toBe('—')
  })
  it('angka -> id-ID 2 desimal bawaan', () => {
    expect(fDec(1.5)).toBe('1,50')
    expect(fDec(1.234, 1)).toBe('1,2')
  })
})

describe('ringkasLembarBertanda', () => {
  it('null -> em dash', () => {
    expect(ringkasLembarBertanda(null)).toBe('—')
  })
  it('tanda mengikuti arah, ambang jt/M', () => {
    expect(ringkasLembarBertanda(89094700)).toBe('+89,1 jt')
    expect(ringkasLembarBertanda(-1500000000)).toBe('−1,5 M')
    expect(ringkasLembarBertanda(0)).toBe('0')
  })
})
