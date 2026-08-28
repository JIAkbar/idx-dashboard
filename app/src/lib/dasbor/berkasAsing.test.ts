import { describe, it, expect } from 'vitest'
import { ringkasAsing, bacaAliran, bacaPorsi } from './berkasAsing'
import type { HariAsing } from './berkasAsing'

function h(tanggal: string, beli: number, jual: number, volume = 1000): HariAsing {
  return { tanggal, beli, jual, volume }
}

describe('ringkasAsing', () => {
  it('net = beli − jual, dijumlahkan sepanjang jendela', () => {
    const r = ringkasAsing([h('2026-01-02', 100, 40), h('2026-01-05', 20, 50)])
    expect(r.netLembar).toBe(30)   // +60 lalu −30
    expect(r.nHari).toBe(2)
  })

  it('beruntun dihitung dari hari TERAKHIR mundur', () => {
    const r = ringkasAsing([
      h('2026-01-02', 0, 50),   // net −
      h('2026-01-05', 100, 0),  // net +
      h('2026-01-06', 100, 0),  // net +
      h('2026-01-07', 100, 0),  // net +
    ])
    expect(r.streak).toBe(3)
  })

  it('beruntun negatif dinyatakan sebagai angka negatif', () => {
    const r = ringkasAsing([h('2026-01-05', 0, 10), h('2026-01-06', 0, 10)])
    expect(r.streak).toBe(-2)
  })

  it('hari NETRAL memutus beruntun, tidak dianggap lanjutan', () => {
    const r = ringkasAsing([h('2026-01-05', 100, 0), h('2026-01-06', 50, 50)])
    expect(r.streak).toBe(0)
  })

  it('porsi volume dijepit ke ±1 dan null bila volume nol', () => {
    expect(ringkasAsing([h('2026-01-05', 100, 0, 50)]).porsiVolume).toBe(1)
    expect(ringkasAsing([h('2026-01-05', 0, 100, 50)]).porsiVolume).toBe(-1)
    expect(ringkasAsing([h('2026-01-05', 0, 0, 0)]).porsiVolume).toBeNull()
  })

  it('hari bervolume nol TIDAK dibuang — ia memutus beruntun secara sah', () => {
    const r = ringkasAsing([h('2026-01-05', 100, 0), h('2026-01-06', 0, 0, 0), h('2026-01-07', 100, 0)])
    expect(r.nHari).toBe(3)
    expect(r.streak).toBe(1)  // hari netral di tengah memutus
  })

  it('hanya n hari terakhir dipakai', () => {
    const hari = Array.from({ length: 40 }, (_, i) =>
      h(`2026-02-${String(i + 1).padStart(2, '0')}`, 10, 0))
    const r = ringkasAsing(hari, 5)
    expect(r.nHari).toBe(5)
    expect(r.netLembar).toBe(50)
    expect(r.deret).toHaveLength(5)
  })

  it('daftar kosong tak melempar', () => {
    const r = ringkasAsing([])
    expect(r.nHari).toBe(0)
    expect(r.streak).toBe(0)
    expect(r.porsiVolume).toBeNull()
  })
})

describe('kalimat', () => {
  it('menyebut angka lembar, bukan cuma arah', () => {
    const r = ringkasAsing([h('2026-01-05', 1000, 0)])
    expect(bacaAliran(r)).toContain('1.000 lembar')
    expect(bacaAliran(r)).toContain('menumpuk')
  })

  it('beruntun disebut hanya bila >= 3 hari', () => {
    const dua = ringkasAsing([h('2026-01-05', 10, 0), h('2026-01-06', 10, 0)])
    expect(bacaAliran(dua)).not.toContain('Beruntun')
    const tiga = ringkasAsing([h('2026-01-05', 10, 0), h('2026-01-06', 10, 0), h('2026-01-07', 10, 0)])
    expect(bacaAliran(tiga)).toContain('Beruntun 3 hari')
  })

  it('porsi null tak melahirkan kalimat', () => {
    expect(bacaPorsi(ringkasAsing([h('2026-01-05', 0, 0, 0)]))).toBeNull()
  })

  it('data kosong dikatakan terus terang', () => {
    expect(bacaAliran(ringkasAsing([]))).toContain('Belum ada data')
  })
})
