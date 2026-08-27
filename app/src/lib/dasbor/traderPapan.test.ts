import { describe, it, expect } from 'vitest'
import { hariRentang, posisiBroker } from './traderPapan'
import type { HariBroker } from './whalesPapan'

/** Enam hari yang sengaja dirancang supaya tiap label status punya wakilnya:
 *  CC menampung sampai akhir, YU menampung lalu berhenti, XL melepas terus,
 *  RG melepas lalu berbalik. Harga naik dari 180 ke 210 supaya P&L punya arah. */
const H: HariBroker[] = [
  { tanggal: '2026-03-02', avg: 180, totalLot: 1000, broker: [['CC', 400, 7_200_000, 0, 0], ['XL', 0, 0, 400, 7_200_000], ['YU', 300, 5_400_000, 0, 0], ['RG', 0, 0, 300, 5_400_000]] },
  { tanggal: '2026-03-03', avg: 190, totalLot: 1000, broker: [['CC', 300, 5_700_000, 0, 0], ['XL', 0, 0, 300, 5_700_000], ['YU', 200, 3_800_000, 0, 0], ['RG', 0, 0, 200, 3_800_000]] },
  { tanggal: '2026-03-04', avg: 200, totalLot: 1000, broker: [['CC', 200, 4_000_000, 0, 0], ['XL', 0, 0, 200, 4_000_000], ['YU', 0, 0, 100, 2_000_000], ['RG', 100, 2_000_000, 0, 0]] },
  { tanggal: '2026-03-05', avg: 210, totalLot: 1000, broker: [['CC', 100, 2_100_000, 0, 0], ['XL', 0, 0, 100, 2_100_000], ['YU', 0, 0, 100, 2_100_000], ['RG', 100, 2_100_000, 0, 0]] },
]

describe('hariRentang', () => {
  it('inklusif di kedua ujung', () => {
    expect(hariRentang(H, '2026-03-03', '2026-03-04').map((h) => h.tanggal)).toEqual([
      '2026-03-03',
      '2026-03-04',
    ])
  })
  it('menerima rentang terbalik', () => {
    expect(hariRentang(H, '2026-03-04', '2026-03-03')).toHaveLength(2)
  })
})

describe('posisiBroker', () => {
  const r = posisiBroker(H)
  const cari = (k: string) => r.baris.find((b) => b.kode === k)!

  it('harga rata-rata dibagi 100 — nilai per lot, harga per lembar', () => {
    // CC: 19.000.000 / 1.000 lot = 19.000 per lot = 190 per lembar
    expect(cari('CC').avgBeli).toBeCloseTo(190, 6)
  })

  it('harga akhir diambil dari hari terakhir yang PUNYA harga', () => {
    const dgnKosong = [...H, { tanggal: '2026-03-06', avg: null, totalLot: 0, broker: [] as never[] }]
    expect(posisiBroker(dgnKosong).hargaAkhir).toBe(210)
  })

  it('floor hanya dari hari NET BELI — menjual murah bukan menampung murah', () => {
    expect(cari('CC').floor).toBe(180) // menampung sejak hari termurah
    expect(cari('RG').floor).toBe(200) // baru menampung setelah harga naik
    expect(cari('XL').floor).toBeNull() // tak pernah net beli
  })

  it('label status memisahkan arah keseluruhan dari arah terakhir', () => {
    expect(cari('CC').status).toBe('akumulasi')
    expect(cari('YU').status).toBe('akumulasi-mereda') // net + tapi ekor -
    expect(cari('XL').status).toBe('distribusi')
    expect(cari('RG').status).toBe('distribusi-berbalik') // net - tapi ekor +
  })

  it('P&L hanya untuk broker yang net-nya masih positif', () => {
    // avg beli CC 190, harga akhir 210 -> +10,53%
    expect(cari('CC').pnlPct).toBeCloseTo(((210 - 190) / 190) * 100, 6)
    expect(cari('XL').pnlPct).toBeNull() // net negatif: modalnya tak terbaca dari data harian
  })

  it('net harian sepanjang rentang, satu angka per hari', () => {
    expect(cari('CC').netHarian).toEqual([400, 300, 200, 100])
    expect(cari('XL').netHarian).toEqual([-400, -300, -200, -100])
  })

  it('menghitung hari aktif dan arahnya terpisah', () => {
    const yu = cari('YU')
    expect(yu.hariAktif).toBe(4)
    expect(yu.hariNetBeli).toBe(2)
    expect(yu.hariNetJual).toBe(2)
  })

  it('urut dari nilai net terbesar, tak peduli arahnya', () => {
    const n = r.baris.map((b) => Math.abs(b.netNilai))
    expect([...n].sort((a, b) => b - a)).toEqual(n)
  })

  it('rentang kosong memberi hasil kosong, bukan galat', () => {
    const k = posisiBroker([])
    expect(k.baris).toEqual([])
    expect(k.hargaAkhir).toBeNull()
    expect(k.tglMulai).toBeNull()
  })

  it('net seluruh broker saling meniadakan — pembilang dan penyebut satu rumah', () => {
    expect(r.baris.reduce((s, b) => s + b.netLot, 0)).toBe(0)
  })

  it('nilaiTotal = beli + jual (bukan net) — dasar Porsi', () => {
    // CC hanya beli sepanjang H: 7.200.000+5.700.000+4.000.000+2.100.000 = 19.000.000
    expect(cari('CC').nilaiTotal).toBeCloseTo(19_000_000, 6)
    // XL hanya jual: sama nilainya karena tiap hari CC beli persis sebesar XL jual
    expect(cari('XL').nilaiTotal).toBeCloseTo(19_000_000, 6)
  })

  it('totalNilaiPasar = jumlah nilaiTotal seluruh broker — penyebut Porsi', () => {
    const jumlah = r.baris.reduce((s, b) => s + b.nilaiTotal, 0)
    expect(r.totalNilaiPasar).toBeCloseTo(jumlah, 6)
    // Porsi CC pada rentang ini: 19.000.000 / totalNilaiPasar
    expect(cari('CC').nilaiTotal / r.totalNilaiPasar).toBeCloseTo(19_000_000 / jumlah, 6)
  })
})
