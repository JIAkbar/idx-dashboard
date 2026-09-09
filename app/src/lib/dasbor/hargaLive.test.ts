import { describe, it, expect } from 'vitest'
import { umurLiveDetik, type HargaLive } from './hargaLive'

const h = (diambilPada: number, umurSumber: number): HargaLive => ({
  kode: 'BIPI', tanggal: '2026-09-09', close: 160, prev: 158, pct: 1.27,
  diambilPada, umurSumber,
})

describe('umurLiveDetik', () => {
  it('menjumlahkan umur di peramban DAN umur di singgahan', () => {
    // Inti #156 C: angka yang baru tiba 2 detik lalu bisa saja sudah 12 detik
    // umurnya, karena yang dikirim salinan singgahan. Melaporkan 2 detik saja
    // adalah kebohongan yang menyenangkan — arah sebaliknya dari "≤ 2 menit",
    // tapi sama-sama bukan keadaan sebenarnya.
    expect(umurLiveDetik(h(1_000_000, 10), 1_002_000)).toBe(12)
  })

  it('tanpa singgahan, umurnya murni jarak sejak tiba', () => {
    expect(umurLiveDetik(h(1_000_000, 0), 1_007_400)).toBe(7)
  })

  it('jam perangkat yang mundur tidak menghasilkan umur negatif', () => {
    expect(umurLiveDetik(h(1_000_000, 3), 999_000)).toBe(3)
  })

  it('umurSumber yang hilang dibaca nol, bukan NaN', () => {
    const tanpa = { ...h(1_000_000, 0) } as HargaLive & { umurSumber?: number }
    delete tanpa.umurSumber
    expect(umurLiveDetik(tanpa as HargaLive, 1_005_000)).toBe(5)
  })
})
