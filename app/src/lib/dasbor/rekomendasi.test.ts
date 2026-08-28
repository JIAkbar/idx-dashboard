import { describe, it, expect } from 'vitest'
import { hasilSahamPreset, kodeUnikPreset, type HariRekomendasi } from './rekomendasi'
import type { BarWinRate } from './winRate'

const sahamKosong = { close: null, entry: null, tp1: null, tp2: null, sl: null, skor: null,
  ringkas: { freq: null, ukuran_order: null, fd: null, bandar_top1_kode: null, bandar_top1_avg: null, label_accdist: null } }

const hari: HariRekomendasi = {
  tanggal: '2026-08-20',
  dibangun: '2026-08-20T10:00:00Z',
  backtest: false,
  presets: [
    {
      preset: 'scalping',
      saham: [
        { ...sahamKosong, kode: 'AAAA', skor: 0.8, tp1: 113, sl: 97 },
        { ...sahamKosong, kode: 'BBBB', skor: 0.5, tp1: null, sl: null },
      ],
    },
  ],
}

const barsAaaa: BarWinRate[] = [
  { tanggal: '2026-08-20', open: 100, high: 105, low: 98, close: 102 },
  { tanggal: '2026-08-21', open: 102, high: 116, low: 101, close: 108 }, // high>=tp1(113) -> menang H+5; high>open -> menang H+1; close naik
]

describe('kodeUnikPreset', () => {
  it('kode unik dari preset yang diminta, terurut', () => {
    expect(kodeUnikPreset([hari], 'scalping')).toEqual(['AAAA', 'BBBB'])
  })
  it('array kosong kalau preset tak ada hari itu', () => {
    expect(kodeUnikPreset([hari], 'swing')).toEqual([])
  })
})

describe('hasilSahamPreset', () => {
  it('menggabungkan skor + tiga definisi menang per saham', () => {
    const peta = new Map([['AAAA', barsAaaa]])
    const hasil = hasilSahamPreset(hari, 'scalping', peta)
    expect(hasil).toHaveLength(2)
    const a = hasil.find((h) => h.kode === 'AAAA')!
    expect(a.skor).toBe(0.8)
    expect(a.openHigh).toBe('menang')
    expect(a.closeClose).toBe('menang')
    expect(a.closeClosePersen).toBeCloseTo(5.882, 2)
    expect(a.tpSl).toBe('menang')
  })
  it('tak-terukur seluruhnya kalau bar emiten itu tak dimuat (peta kosong)', () => {
    const hasil = hasilSahamPreset(hari, 'scalping', new Map())
    const a = hasil.find((h) => h.kode === 'AAAA')!
    expect(a.openHigh).toBe('tak-terukur')
    expect(a.closeClose).toBe('tak-terukur')
    expect(a.tpSl).toBe('tak-terukur')
  })
  it('tpSl tak-terukur kalau tp1/sl saham itu null (fallback ATR tak tersedia)', () => {
    const peta = new Map([['BBBB', barsAaaa]])
    const hasil = hasilSahamPreset(hari, 'scalping', peta)
    expect(hasil.find((h) => h.kode === 'BBBB')!.tpSl).toBe('tak-terukur')
  })
  it('array kosong kalau preset tak ada di hari itu', () => {
    expect(hasilSahamPreset(hari, 'swing', new Map())).toEqual([])
  })
})
