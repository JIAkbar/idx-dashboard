import { describe, expect, it } from 'vitest'
import {
  LABEL_GAYA, LABEL_KATEGORI, perilakuBroker,
  type DaftarKategoriBroker, type GayaBroker, type KategoriBroker,
} from './kategoriBroker'

const CONTOH: DaftarKategoriBroker = {
  dibangun: '2026-08-27T10:00:00+07:00',
  jendela: { mulai: '2026-02-18', akhir: '2026-08-24', n_hari: 120 },
  kalibrasi: {
    q3_share: 0.0097,
    median_directionality: 0.0322,
    median_konsistensi: 0.5625,
    per_kategori: {
      whale: { n: 12, rentang_share: [0.011, 0.127], median_directionality: 0.0475 },
      smart: { n: 33, rentang_share: [0.00001, 0.0065], median_directionality: 0.0984 },
      smart_ritel: { n: 34, rentang_share: [0.00001, 0.0093], median_directionality: 0.0149 },
      ritel: { n: 11, rentang_share: [0.0098, 0.1044], median_directionality: 0.0181 },
    },
    per_gaya: { akumulasi: 14, distribusi: 5, flip_beli: 4, flip_jual: 13, scalper: 45, campuran: 9 },
  },
  broker: {
    CC: {
      kategori: 'ritel', gaya: 'scalper', share: 0.1044, directionality: 0.0246,
      konsistensi: 0.575, net_nilai: 1.0e13, gross_nilai: 4.17e14, z_vol_terakhir: -0.39,
    },
  },
}

describe('LABEL_KATEGORI & LABEL_GAYA', () => {
  it('empat kategori, semua berlabel Indonesia tak kosong', () => {
    const kategori: KategoriBroker[] = ['whale', 'smart', 'smart_ritel', 'ritel']
    for (const k of kategori) expect(LABEL_KATEGORI[k]).toBeTruthy()
  })
  it('enam gaya, semua berlabel Indonesia tak kosong', () => {
    const gaya: GayaBroker[] = ['akumulasi', 'distribusi', 'flip_beli', 'flip_jual', 'scalper', 'campuran']
    for (const g of gaya) expect(LABEL_GAYA[g]).toBeTruthy()
  })
})

describe('perilakuBroker() — bentuk keluaran kategori_broker.json', () => {
  it('mengembalikan entri broker yang ada, kode tak peka huruf besar/kecil', () => {
    expect(perilakuBroker(CONTOH, 'CC')).toEqual(CONTOH.broker.CC)
    expect(perilakuBroker(CONTOH, 'cc')).toEqual(CONTOH.broker.CC)
  })
  it('broker tak dikenal atau daftar belum termuat -> null, bukan galat', () => {
    expect(perilakuBroker(CONTOH, 'XX')).toBeNull()
    expect(perilakuBroker(null, 'CC')).toBeNull()
  })
  it('jendela & kalibrasi ikut termuat sebagai bagian bentuk yang sama', () => {
    expect(CONTOH.jendela.n_hari).toBe(120)
    expect(CONTOH.kalibrasi.per_kategori.whale.n).toBe(12)
    expect(Object.keys(CONTOH.kalibrasi.per_gaya).sort()).toEqual(
      ['akumulasi', 'campuran', 'distribusi', 'flip_beli', 'flip_jual', 'scalper'].sort(),
    )
  })
})
