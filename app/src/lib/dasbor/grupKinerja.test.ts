import { describe, expect, it } from 'vitest'
import { deretIndeksGrup } from './grupKinerja'
import type { BarisOhlc } from './ihsgOhlc'

const bar = (t: string, tutup: number): BarisOhlc => [t, tutup, tutup, tutup, tutup, 0]

describe('deretIndeksGrup', () => {
  it('rebase 100 di hari pertama, rata-rata setara dua anggota', () => {
    const ihsg: BarisOhlc[] = [bar('2026-01-02', 100), bar('2026-01-03', 110), bar('2026-01-04', 99)]
    // A: +10% lalu -10%; B: -10% lalu +10% — rata-rata harian 0% tiap hari,
    // jadi indeks grup harus TETAP 100 walau IHSG bergerak.
    const a: BarisOhlc[] = [bar('2026-01-02', 100), bar('2026-01-03', 110), bar('2026-01-04', 99)]
    const b: BarisOhlc[] = [bar('2026-01-02', 100), bar('2026-01-03', 90), bar('2026-01-04', 99)]
    const r = deretIndeksGrup([a, b], ihsg, '2026-01-02', '2026-01-04')
    expect(r).not.toBeNull()
    expect(r!.tgl).toEqual(['2026-01-02', '2026-01-03', '2026-01-04'])
    expect(r!.grup[0]).toBeCloseTo(100, 6)
    expect(r!.grup[1]).toBeCloseTo(100, 6)
    expect(r!.grup[2]).toBeCloseTo(100, 6)
    expect(r!.ihsg[1]).toBeCloseTo(110, 6)
    expect(r!.ihsg[2]).toBeCloseTo(99, 6)
  })

  it('anggota suspend (bolong satu hari) melewati hari itu, bukan menghasilkan return palsu', () => {
    const ihsg: BarisOhlc[] = [bar('2026-01-02', 100), bar('2026-01-03', 105), bar('2026-01-04', 110)]
    const a: BarisOhlc[] = [bar('2026-01-02', 100), bar('2026-01-03', 120), bar('2026-01-04', 100)]
    const bSuspend: BarisOhlc[] = [bar('2026-01-02', 50), bar('2026-01-04', 55)] // bolong 01-03
    const r = deretIndeksGrup([a, bSuspend], ihsg, '2026-01-02', '2026-01-04')!
    // Hari 2: cuma a yang berkontribusi (+20%)
    expect(r.grup[1]).toBeCloseTo(120, 6)
    // Hari 3: a (100/120-1=-16.67%) + b (55/50-1=+10%) dirata-rata
    const returnHari3 = (100 / 120 - 1 + (55 / 50 - 1)) / 2
    expect(r.grup[2]).toBeCloseTo(r.grup[1] * (1 + returnHari3), 6)
  })

  it('null kalau rentang < 2 hari bursa atau tak ada anggota berdata', () => {
    const ihsg: BarisOhlc[] = [bar('2026-01-02', 100)]
    expect(deretIndeksGrup([[bar('2026-01-02', 10)]], ihsg, '2026-01-02', '2026-01-02')).toBeNull()
    const ihsg2: BarisOhlc[] = [bar('2026-01-02', 100), bar('2026-01-03', 101)]
    expect(deretIndeksGrup([null], ihsg2, '2026-01-02', '2026-01-03')).toBeNull()
  })
})
