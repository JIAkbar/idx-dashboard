import { describe, expect, it } from 'vitest'
import { binFootprint } from './footprintHarian'
import type { BarisBroker } from './whalesPapan'

// tickFn tetap (10) di seluruh uji — determinisme, terpisah dari tabel
// fraksi BEI asli (yang sudah diuji sendiri di fraksiHarga.test.ts).
const TICK10 = () => 10

describe('binFootprint', () => {
  it('rentang sempit (< 1 tick) menjadi SATU sel selebar tick', () => {
    const broker: BarisBroker[] = [['AA', 100, 100 * 100 * 102, 0, 0]] // avg beli 102
    const sel = binFootprint(broker, 100, 105, TICK10)
    expect(sel).toHaveLength(1)
    expect(sel[0].hargaBawah).toBe(100)
    expect(sel[0].hargaAtas).toBe(110)
    expect(sel[0].beliLot).toBe(100)
  })

  it('rentang lebar dibatasi maksimal 12 bin', () => {
    const broker: BarisBroker[] = [['AA', 10, 10 * 100 * 500, 0, 0]]
    const sel = binFootprint(broker, 0, 1000, TICK10) // 100 tick jika tanpa batas
    expect(sel).toHaveLength(12)
    // 12 bin sama rata menutupi seluruh rentang.
    expect(sel[0].hargaBawah).toBe(0)
    expect(sel[11].hargaAtas).toBeCloseTo(1000, 6)
  })

  it('avg di luar low–high dijepit ke sel tepi', () => {
    const broker: BarisBroker[] = [
      ['AA', 10, 10 * 100 * 95, 0, 0],   // avg 95, di bawah low=100
      ['BB', 0, 0, 10, 10 * 100 * 205],  // avg 205, di atas high=200
    ]
    const sel = binFootprint(broker, 100, 200, TICK10)
    expect(sel[0].beliLot).toBe(10) // AA terjepit ke sel pertama
    expect(sel[sel.length - 1].jualLot).toBe(10) // BB terjepit ke sel terakhir
  })

  it('satu broker muncul di dua sel berbeda saat avg beli ≠ avg jual', () => {
    const broker: BarisBroker[] = [
      ['XC', 100, 100 * 100 * 105, 50, 50 * 100 * 195], // avg beli 105, avg jual 195
    ]
    const sel = binFootprint(broker, 100, 200, TICK10)
    const selBeli = sel.find((s) => s.broker.some((b) => b.kode === 'XC' && b.beliLot > 0))
    const selJual = sel.find((s) => s.broker.some((b) => b.kode === 'XC' && b.jualLot > 0))
    expect(selBeli).toBeDefined()
    expect(selJual).toBeDefined()
    expect(selBeli).not.toBe(selJual)
    expect(selBeli!.broker.find((b) => b.kode === 'XC')!.jualLot).toBe(0)
    expect(selJual!.broker.find((b) => b.kode === 'XC')!.beliLot).toBe(0)
  })

  it('rentang kosong (low===high, hari tanpa transaksi) tak melempar galat', () => {
    const sel = binFootprint([], 150, 150, TICK10)
    expect(sel).toHaveLength(1)
    expect(sel[0].beliLot).toBe(0)
    expect(sel[0].jualLot).toBe(0)
  })
})
