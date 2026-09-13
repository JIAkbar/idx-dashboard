import { describe, expect, it } from 'vitest'
import { angkaAtauPisah, isiTooltipBerjalan, MAKS_TAPE_TOOLTIP } from './tooltipBerjalan'
import type { HargaLive } from './hargaLive'
import type { BarisTape } from './tapeLive'

// #152 D — aturan tampil dan isi tooltip transaksi hari berjalan di Whales.
const LIVE: HargaLive = {
  kode: 'BBCA',
  tanggal: '2026-09-11',
  close: 6325,
  prev: 6300,
  pct: 0.4,
  open: 6300,
  high: 6350,
  low: 6275,
  volume: 2_000_000,
  value: 1_000_000_000,
  frequency: 4_000,
  diambilPada: 1_757_570_000_000,
  umurSumber: 3,
}

const tape = (n: number): BarisTape[] =>
  Array.from({ length: n }, (_, i) => ({ pada: 1000 + i, volume: 100, value: 1000, frequency: 1 }) as unknown as BarisTape)

describe('isiTooltipBerjalan (#152 D)', () => {
  it('tanpa angka live atau tanpa bar hari ini: tidak tampil', () => {
    expect(isiTooltipBerjalan(null, 'buka', true, [])).toBeNull()
    expect(isiTooltipBerjalan(LIVE, 'buka', false, [])).toBeNull()
    expect(isiTooltipBerjalan(LIVE, 'tutup', false, [])).toBeNull()
  })

  it('bursa buka: sepuluh isian terisi, tape paling banyak lima', () => {
    const isi = isiTooltipBerjalan(LIVE, 'buka', true, tape(7))!
    expect(isi.status).toBe('berjalan')
    expect(isi.diterimaPada).toBe(LIVE.diambilPada)
    for (const k of ['harga', 'pct', 'open', 'high', 'low', 'volumeLot', 'nilai', 'frekuensi', 'vwap', 'perTransaksi'] as const) {
      expect(isi[k], k).not.toBeNull()
    }
    expect(isi.tape).toHaveLength(MAKS_TAPE_TOOLTIP)
    expect(isi.tape.map((b) => b.pada)).toEqual([1000, 1001, 1002, 1003, 1004])
  })

  it('sesudah tutup dengan bar ditahan: TETAP tampil, berlabel penutupan, tanpa tape', () => {
    const isi = isiTooltipBerjalan(LIVE, 'tutup', true, tape(7))
    expect(isi).not.toBeNull()
    expect(isi!.status).toBe('penutupan sementara')
    expect(isi!.tape).toEqual([])
    expect(isi!.nilai).toBe(1_000_000_000)
  })

  it('VWAP, rata-rata per transaksi, volume lot, dan harga dihitung dari angka live', () => {
    const isi = isiTooltipBerjalan(LIVE, 'buka', true, [])!
    expect(isi.vwap).toBe(500)
    expect(isi.perTransaksi).toBe(250_000)
    expect(isi.volumeLot).toBe(20_000)
    expect(isi.harga).toBe(6325)
    expect([isi.open, isi.high, isi.low]).toEqual([6300, 6350, 6275])
  })

  it('ruas kosong atau rusak jadi null, bukan 0', () => {
    const isi = isiTooltipBerjalan(
      { ...LIVE, volume: null, value: Number.NaN, frequency: undefined, pct: null },
      'buka', true, [],
    )!
    expect(isi.volumeLot).toBeNull()
    expect(isi.nilai).toBeNull()
    expect(isi.frekuensi).toBeNull()
    expect(isi.vwap).toBeNull()
    expect(isi.perTransaksi).toBeNull()
    expect(isi.pct).toBeNull()
  })
})

describe('angkaAtauPisah', () => {
  const f = (n: number) => `#${n}`

  it('null, undefined, NaN, dan tak-hingga jadi tanda pisah', () => {
    for (const x of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) expect(angkaAtauPisah(x, f)).toBe('—')
  })

  it('nol tetap angka, bukan tanda pisah', () => {
    expect(angkaAtauPisah(0, f)).toBe('#0')
    expect(angkaAtauPisah(12.5, f)).toBe('#12.5')
  })
})
