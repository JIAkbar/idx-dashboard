import { describe, expect, it } from 'vitest'
import { rangkumHari } from './ringkasHarian'
import type { DataHarian } from './dataHarian'

function hari(p: Partial<DataHarian>): DataHarian {
  return {
    date_id: 'Jumat, 14 Agustus 2026',
    trading_day: 145,
    ihsg_value: 6401.89,
    ihsg_pct: 1.59,
    ihsg_prev: 6301.77,
    ...p,
  } as DataHarian
}

const sektor = (naik: number, turun: number) => [
  ...Array.from({ length: naik }, (_, i) => ({ n: `Naik${i}`, v: 100, d: 3 - i * 0.1, ytd: 0 })),
  ...Array.from({ length: turun }, (_, i) => ({ n: `Turun${i}`, v: 100, d: -1 - i * 0.1, ytd: 0 })),
]

describe('rangkumHari — headline', () => {
  it('menyebut arah, besaran, dan lebar sektornya', () => {
    const r = rangkumHari(hari({ sectors: sektor(11, 0) }))
    expect(r.headline).toContain('IHSG menguat kuat +1,59% ke 6.401,89')
    expect(r.headline).toContain('seluruh sektor hijau')
  })

  it('gerak di bawah 0,25% disebut nyaris datar, bukan menguat', () => {
    expect(rangkumHari(hari({ ihsg_pct: 0.1 })).headline).toContain('nyaris datar')
    expect(rangkumHari(hari({ ihsg_pct: -0.1 })).headline).toContain('nyaris datar')
  })

  it('sebagian sektor naik dilaporkan apa adanya', () => {
    const r = rangkumHari(hari({ sectors: sektor(7, 4) }))
    expect(r.headline).toContain('7 dari 11 sektor menguat')
  })
})

describe('rangkumHari — divergensi asing', () => {
  it('indeks NAIK tapi asing net sell disebut ditopang dana domestik', () => {
    const r = rangkumHari(hari({ ihsg_pct: 1.59, nf_today_idr: -1034.66 }))
    expect(r.ringkasan).toContain('ditopang dana domestik')
    expect(r.katalis.some((k) => k.judul === 'Divergensi asing vs harga')).toBe(true)
  })

  it('indeks naik DAN asing net buy tidak dianggap divergensi', () => {
    const r = rangkumHari(hari({ ihsg_pct: 1.59, nf_today_idr: 800 }))
    expect(r.ringkasan).toContain('searah dengan indeks')
    expect(r.katalis.some((k) => k.judul === 'Divergensi asing vs harga')).toBe(false)
  })

  it('arus asing kecil tidak disebut sama sekali — angka receh bukan cerita', () => {
    const r = rangkumHari(hari({ nf_today_idr: 50 }))
    expect(r.ringkasan).not.toContain('net sell')
    expect(r.ringkasan).not.toContain('net buy')
  })

  it('nilai ≥ 1.000 miliar ditulis dalam triliun', () => {
    const r = rangkumHari(hari({ nf_today_idr: -1034.66 }))
    expect(r.ringkasan).toContain('Rp1,03 triliun')
  })
})

describe('rangkumHari — chip & katalis', () => {
  it('tiap chip menunjuk halaman yang membuktikan angkanya', () => {
    const r = rangkumHari(hari({ nf_today_idr: -1034.66, sectors: sektor(11, 0), val_idr_today: 12431 }))
    expect(r.chips.length).toBeGreaterThanOrEqual(3)
    expect(r.chips.every((c) => c.ke)).toBe(true)
  })

  it('lonjakan saham hanya disebut kalau melewati ambang', () => {
    const kecil = rangkumHari(hari({ gainers: [{ c: 'AAAA', pr: 100, td: 5, p: 5 }] }))
    expect(kecil.katalis.some((k) => k.judul.startsWith('AAAA'))).toBe(false)

    const besar = rangkumHari(hari({
      gainers: [
        { c: 'BYAN', pr: 14400, td: 2400, p: 20 },
        { c: 'SRAJ', pr: 100, td: 10, p: 11 },
      ],
    }))
    const k = besar.katalis.find((x) => x.judul.startsWith('BYAN'))
    expect(k?.judul).toContain('+20,00%')
    expect(k?.isi).toContain('SRAJ')
  })

  it('katalis dibatasi empat — kartu yang panjang berhenti dibaca', () => {
    const r = rangkumHari(hari({
      sectors: sektor(11, 0),
      nf_today_idr: -1034.66,
      gainers: [{ c: 'BYAN', pr: 14400, td: 2400, p: 20 }],
      leaders_today: [{ c: 'BBCA', p: 9000, ih: 12.4 }],
      mkt_per: 12.83,
      mkt_pbv: 1.7,
    }))
    expect(r.katalis).toHaveLength(4)
  })

  it('data minimal tidak membuatnya pecah — cuma menghasilkan lebih sedikit', () => {
    const r = rangkumHari(hari({}))
    expect(r.headline).toContain('IHSG')
    expect(r.katalis.length).toBeLessThanOrEqual(4)
  })
})
