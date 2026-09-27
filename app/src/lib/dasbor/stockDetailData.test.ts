import { describe, it, expect, afterEach } from 'vitest'
import { vi } from 'vitest'
import { fetchAsing } from './stockDetailData'

// #253: baris asing/<KODE>.json bisa punya kolom ke-7 "stockbit" (isian
// taksiran saat IDX tertinggal). Parser tak boleh rusak oleh kolom tambahan
// itu, dan baris isian wajib membawa `sumber: 'stockbit'` sementara baris
// resmi bursa (6 kolom) tidak.
describe('fetchAsing (#253 — kolom ke-7 "stockbit")', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('baris 6 kolom (resmi) tanpa sumber, baris 7 kolom (isian) bertanda stockbit', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({
        kode: 'ZTEST', mulai: '2026-09-01', akhir: '2026-09-25', n: 2,
        d: [
          ['2026-09-23', 100, 90, 1000, 5000000, 50],
          ['2026-09-24', 60, 59, 1200, 6000000, 60, 'stockbit'],
        ],
      }),
    }))
    const data = await fetchAsing('ZTEST')
    expect(data?.d).toHaveLength(2)
    expect(data?.d[0]).toEqual({ tanggal: '2026-09-23', beli: 100, jual: 90, volume: 1000, value: 5000000, frekuensi: 50 })
    expect(data?.d[0].sumber).toBeUndefined()
    expect(data?.d[1].sumber).toBe('stockbit')
  })
})
