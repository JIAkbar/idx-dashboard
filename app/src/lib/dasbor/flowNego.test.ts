import { describe, expect, it } from 'vitest'
import { ekstrakHariFlow, pilihJendela, JENDELA_HARIAN, taksiranNetAsing } from './flowNego'
import type { DataHarian } from './dataHarian'
import type { AsingHarian } from './stockDetailData'

const dsDasar = { date_id: 'x', trading_day: 1, ihsg_value: 0, ihsg_pct: 0 }

describe('ekstrakHariFlow', () => {
  it('ambil nf + baris papan NG dari trading_recap', () => {
    const d: DataHarian = {
      ...dsDasar,
      nf_today_idr: -1413.24,
      trading_recap: [
        { n: 'RG', v: 1, va: 2, f: 3 },
        { n: 'NG', v: 3126543840, va: 1172400102058, f: 496 },
      ],
    }
    expect(ekstrakHariFlow('2026-08-13', d)).toEqual({
      iso: '2026-08-13',
      nf: -1413.24,
      ngVal: 1172400102058,
      ngVol: 3126543840,
      ngFrek: 496,
    })
  })

  it('nf hilang di sumber → null (bukan 0 palsu); tanpa recap → NG 0', () => {
    const h = ekstrakHariFlow('2026-01-20', { ...dsDasar })
    expect(h.nf).toBeNull()
    expect(h.ngVal).toBe(0)
    expect(h.ngFrek).toBe(0)
  })
})

describe('taksiranNetAsing', () => {
  const baris = (tanggal: string, beli: number, jual: number, volume: number, value: number): AsingHarian => (
    { tanggal, beli, jual, volume, value, frekuensi: 1 }
  )

  it('net lembar + taksiran rupiah dari harga rata-rata tertimbang jendela', () => {
    const d: AsingHarian[] = [
      baris('2026-08-10', 100, 40, 1000, 5000), // harga 5/lembar
      baris('2026-08-11', 50, 30, 500, 2500), // harga 5/lembar
    ]
    const r = taksiranNetAsing(d, 5)
    expect(r).toEqual({ netLembar: (100 - 40) + (50 - 30), rupiah: 80 * 5, hariTersedia: 2 })
  })

  it('jendela lebih pendek dari histori tersedia → potong ke histori, hariTersedia < hari', () => {
    const d: AsingHarian[] = [baris('2026-08-10', 10, 4, 100, 500)]
    const r = taksiranNetAsing(d, 10)
    expect(r?.hariTersedia).toBe(1)
    expect(r?.netLembar).toBe(6)
  })

  it('volume 0 di jendela → rupiah null (bukan Infinity/NaN)', () => {
    const d: AsingHarian[] = [baris('2026-08-10', 10, 4, 0, 0)]
    expect(taksiranNetAsing(d, 5)?.rupiah).toBeNull()
  })

  it('riwayat kosong → null', () => {
    expect(taksiranNetAsing([], 5)).toBeNull()
  })
})

describe('pilihJendela', () => {
  const iso = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09']

  it('mode rentang: hari ds di dalam [mulai, akhir]', () => {
    expect(pilihJendela(iso, null, { mulai: '2026-01-06', akhir: '2026-01-08' }))
      .toEqual(['2026-01-06', '2026-01-07', '2026-01-08'])
  })

  it('mode harian: jendela s.d. tanggal aktif, maksimal JENDELA_HARIAN', () => {
    expect(pilihJendela(iso, '2026-01-07', null)).toEqual(['2026-01-05', '2026-01-06', '2026-01-07'])
    const banyak = Array.from({ length: 40 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`)
    expect(pilihJendela(banyak, '2026-03-40', null)).toHaveLength(JENDELA_HARIAN)
  })

  it('tanggal aktif sebelum cakupan ds / tanpa tanggal → kosong', () => {
    expect(pilihJendela(iso, '2024-05-05', null)).toEqual([])
    expect(pilihJendela(iso, null, null)).toEqual([])
  })
})
