import { describe, it, expect } from 'vitest'
import { ringkasLikuid, labelLikuiditas } from './berkasLikuiditas'
import type { HariLikuid } from './berkasLikuiditas'

function h(tanggal: string, volume: number, close: number, regulerLot?: number, negoLot?: number): HariLikuid {
  return { tanggal, volume, close, regulerLot, negoLot }
}

describe('ringkasLikuid', () => {
  it('hari sepi = volume nol', () => {
    const r = ringkasLikuid([h('a', 0, 100), h('b', 500, 100), h('c', 0, 100)])
    expect(r.hariSepi).toBe(2)
  })

  it('hari beku = ADA transaksi tapi close sama — hari sepi tak ikut dihitung', () => {
    const r = ringkasLikuid([
      h('a', 100, 50),
      h('b', 100, 50),   // beku: bertransaksi, close sama
      h('c', 0, 50),     // sepi: tak dihitung beku walau closenya juga sama
      h('d', 100, 60),
    ])
    expect(r.hariBeku).toBe(1)
    expect(r.hariSepi).toBe(1)
  })

  it('median volume hanya dari hari yang bertransaksi', () => {
    const r = ringkasLikuid([h('a', 0, 10), h('b', 100, 10), h('c', 300, 10), h('d', 200, 10)])
    expect(r.medianVolume).toBe(200)
  })

  it('porsi nego null bila varian nego tak ada di satu hari pun', () => {
    expect(ringkasLikuid([h('a', 100, 10, 50)]).porsiNego).toBeNull()
  })

  it('porsi nego hanya menjumlah hari yang PUNYA variannya', () => {
    const r = ringkasLikuid([
      h('a', 100, 10, 100, 100),   // punya: reg 100, nego 100
      h('b', 100, 10, 900),        // tak punya varian nego -> diabaikan penuh
    ])
    expect(r.porsiNego).toBeCloseTo(0.5, 5)
  })

  it('peringatan hari sepi muncul di >= 25%', () => {
    const hari = [h('a', 0, 10), h('b', 0, 10), h('c', 100, 10), h('d', 100, 10)]
    expect(ringkasLikuid(hari).peringatan.some((p) => p.includes('berpindah tangan'))).toBe(true)
  })

  it('peringatan harga beku menyebut sebabnya, bukan cuma angkanya', () => {
    const hari = Array.from({ length: 8 }, (_, i) => h(`d${i}`, 100, 50))
    const p = ringkasLikuid(hari).peringatan.find((x) => x.includes('jalan di tempat'))
    expect(p).toContain('cuma tidak bergerak')
  })

  it('peringatan nego muncul di >= 30% lot', () => {
    const r = ringkasLikuid([h('a', 100, 10, 60, 40)])
    expect(r.peringatan.some((p) => p.includes('negosiasi'))).toBe(true)
  })

  it('daftar kosong tak melempar', () => {
    const r = ringkasLikuid([])
    expect(r.nHari).toBe(0)
    expect(r.peringatan).toEqual([])
    expect(labelLikuiditas(r)).toBeNull()
  })
})

describe('labelLikuiditas', () => {
  it('tidur bila >= 50% hari sepi', () => {
    expect(labelLikuiditas(ringkasLikuid([h('a', 0, 1), h('b', 0, 1), h('c', 9, 2), h('d', 9, 3)]))).toBe('tidur')
  })
  it('tipis bila harganya banyak beku walau bertransaksi', () => {
    const hari = Array.from({ length: 10 }, (_, i) => h(`d${i}`, 100, 50))
    expect(labelLikuiditas(ringkasLikuid(hari))).toBe('tipis')
  })
  it('likuid bila bergerak dan tak sepi', () => {
    const hari = Array.from({ length: 10 }, (_, i) => h(`d${i}`, 100, 50 + i))
    expect(labelLikuiditas(ringkasLikuid(hari))).toBe('likuid')
  })
})
