import { describe, it, expect } from 'vitest'
import {
  agregatArea,
  batasKanvas,
  dariBerkasTahunan,
  hariTerpilih,
  profilHarga,
  tahunDibutuhkan,
  type HariBroker,
} from './whalesPapan'

/** Empat hari dengan harga rata-rata yang sengaja mengangkangi batas seleksi,
 *  supaya uji batas inklusif punya arti. */
const HARI: HariBroker[] = [
  { tanggal: '2026-01-02', avg: 185, totalLot: 1000, broker: [['CC', 600, 60_000, 100, 10_000]] },
  { tanggal: '2026-01-05', avg: 190, totalLot: 2000, broker: [['CC', 500, 50_000, 200, 20_000], ['YU', 100, 10_000, 700, 70_000]] },
  { tanggal: '2026-01-06', avg: 200, totalLot: 3000, broker: [['CC', 300, 30_000, 300, 30_000], ['XL', 900, 90_000, 100, 10_000]] },
  { tanggal: '2026-01-07', avg: 205, totalLot: 500, broker: [['XL', 400, 40_000, 0, 0]] },
]

describe('hariTerpilih', () => {
  it('inklusif di kedua ujung harga dan tanggal', () => {
    const p = hariTerpilih(HARI, { hargaMin: 190, hargaMax: 200, tglMulai: '2026-01-05', tglAkhir: '2026-01-06' })
    expect(p.map((h) => h.tanggal)).toEqual(['2026-01-05', '2026-01-06'])
  })

  it('menerima seleksi yang diseret terbalik (min>max, akhir<mulai)', () => {
    const p = hariTerpilih(HARI, { hargaMin: 200, hargaMax: 190, tglMulai: '2026-01-06', tglAkhir: '2026-01-05' })
    expect(p).toHaveLength(2)
  })

  it('membuang hari tanpa harga rata-rata — tak bisa ditempatkan di sumbu', () => {
    const dgnNull: HariBroker[] = [...HARI, { tanggal: '2026-01-08', avg: null, totalLot: 0, broker: [['ZZ', 9, 9, 0, 0]] }]
    const p = hariTerpilih(dgnNull, { hargaMin: 0, hargaMax: 9999, tglMulai: '2026-01-01', tglAkhir: '2026-12-31' })
    expect(p.some((h) => h.tanggal === '2026-01-08')).toBe(false)
  })
})

describe('agregatArea', () => {
  const sel = { hargaMin: 185, hargaMax: 205, tglMulai: '2026-01-01', tglAkhir: '2026-12-31' }

  it('menjumlahkan net lintas hari per broker', () => {
    const h = agregatArea(HARI, sel)
    // CC: (600-100) + (500-200) + (300-300) = 800
    const cc = h.netBeli.find((r) => r.kode === 'CC')
    expect(cc?.netLot).toBe(800)
    // XL: (900-100) + (400-0) = 1200
    const xl = h.netBeli.find((r) => r.kode === 'XL')
    expect(xl?.netLot).toBe(1200)
  })

  it('memisahkan sisi jual dan mengurutkannya dari yang terbesar', () => {
    const h = agregatArea(HARI, sel)
    expect(h.netJual.map((r) => r.kode)).toEqual(['YU'])
    expect(h.netJual[0].netLot).toBe(-600)
    expect(h.netBeli[0].netLot).toBeGreaterThanOrEqual(h.netBeli[1].netLot)
  })

  it('membuang broker yang net-nya persis nol — bertransaksi tapi tak berpindah posisi', () => {
    const rata: HariBroker[] = [
      { tanggal: '2026-02-02', avg: 100, totalLot: 10, broker: [['AA', 500, 50, 500, 50]] },
    ]
    const h = agregatArea(rata, { hargaMin: 0, hargaMax: 999, tglMulai: '2026-01-01', tglAkhir: '2026-12-31' })
    expect(h.netBeli).toHaveLength(0)
    expect(h.netJual).toHaveLength(0)
    expect(h.nBroker).toBe(1) // tetap dihitung hadir
  })

  it('net beli dan net jual saling meniadakan kalau seluruh pasar ikut', () => {
    const h = agregatArea(HARI, sel)
    // Total beli lot = total jual lot di data broker summary yang utuh,
    // jadi jumlah net seluruh broker harus nol.
    expect(h.totalNetBeliLot + h.totalNetJualLot).toBe(
      HARI.flatMap((d) => d.broker).reduce((s, b) => s + b[1] - b[3], 0),
    )
  })

  it('seleksi kosong memberi hasil kosong, bukan galat', () => {
    const h = agregatArea(HARI, { hargaMin: 1, hargaMax: 2, tglMulai: '2026-01-01', tglAkhir: '2026-12-31' })
    expect(h.nHari).toBe(0)
    expect(h.netBeli).toEqual([])
  })
})

describe('batasKanvas', () => {
  it('memberi napas di atas & bawah supaya titik terluar tak menempel bingkai', () => {
    const b = batasKanvas(HARI)!
    expect(b.hargaMin).toBeLessThan(185)
    expect(b.hargaMax).toBeGreaterThan(205)
    expect(b.tglMulai).toBe('2026-01-02')
    expect(b.tglAkhir).toBe('2026-01-07')
  })

  it('null kalau tak ada satu pun hari berharga', () => {
    expect(batasKanvas([{ tanggal: '2026-01-02', avg: null, totalLot: 0, broker: [] }])).toBeNull()
    expect(batasKanvas([])).toBeNull()
  })

  it('harga tak pernah jatuh di bawah nol walau napasnya lebih besar dari harganya', () => {
    const murah: HariBroker[] = [{ tanggal: '2026-01-02', avg: 1, totalLot: 1, broker: [] }]
    expect(batasKanvas(murah)!.hargaMin).toBeGreaterThanOrEqual(0)
  })
})

describe('profilHarga', () => {
  it('menempatkan seluruh lot satu hari ke satu pita', () => {
    const p = profilHarga(HARI, 4)
    expect(p).toHaveLength(4)
    expect(p.reduce((s, x) => s + x.lot, 0)).toBe(6500) // 1000+2000+3000+500
    expect(p.reduce((s, x) => s + x.nHari, 0)).toBe(4)
  })

  it('larik kosong kalau tak ada data, bukan pita nol', () => {
    expect(profilHarga([], 10)).toEqual([])
  })
})

describe('tahunDibutuhkan', () => {
  it('menutup rentang lintas tahun', () => {
    expect(tahunDibutuhkan('2024-11-01', '2026-02-01')).toEqual([2024, 2025, 2026])
  })
  it('satu tahun kalau rentangnya di dalam satu tahun', () => {
    expect(tahunDibutuhkan('2026-01-01', '2026-12-31')).toEqual([2026])
  })
})

describe('dariBerkasTahunan', () => {
  it('mengurutkan hari dan menandai avg tak sah sebagai null', () => {
    const d = dariBerkasTahunan({
      hari: {
        '2026-01-05': { ringkas: { avg: 190, total_lot: 20 }, broker: [['CC', 1, 1, 0, 0]] },
        '2026-01-02': { ringkas: { avg: 0, total_lot: 0 }, broker: [] },
      },
    })
    expect(d.map((h) => h.tanggal)).toEqual(['2026-01-02', '2026-01-05'])
    expect(d[0].avg).toBeNull() // avg 0 bukan harga yang sah
    expect(d[1].avg).toBe(190)
  })

  it('berkas kosong/null memberi larik kosong', () => {
    expect(dariBerkasTahunan(null)).toEqual([])
    expect(dariBerkasTahunan({})).toEqual([])
  })
})
