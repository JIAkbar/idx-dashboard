import { describe, expect, it } from 'vitest'
import { keBarisKaya, jumlahEmber } from './ohlcvKaya'

describe('keBarisKaya', () => {
  it('memetakan indeks kolom chartbit ke ruas bernama', () => {
    // tanggal,unixdate,o,h,l,c,volume,value,frequency,foreignbuy,foreignsell,foreignflow,dividend,shareoutstanding
    const bar = ['2026-08-21', 1787245200, 6400, 6475, 6400, 6450, 100684300,
      648871165000, 23357, 515049425000, 245956022500, -54740952267010, 0, 123275050000]
    const [tanggal, k] = keBarisKaya(bar)
    expect(tanggal).toBe('2026-08-21')
    expect(k).toEqual({
      nilai: 648871165000,
      frekuensi: 23357,
      foreignBeli: 515049425000,
      foreignJual: 245956022500,
      sahamBeredar: 123275050000,
    })
  })
})

describe('jumlahEmber — ruas kaya per EMBER bar, bukan per tanggal', () => {
  /** Lima hari bursa, Senin 1 Sep 2026 sampai Jumat 5 Sep. */
  const peta = new Map([
    ['2026-09-01', { nilai: 100, frekuensi: 10, foreignBeli: 50, foreignJual: 20, sahamBeredar: 1000 }],
    ['2026-09-02', { nilai: 200, frekuensi: 20, foreignBeli: 60, foreignJual: 30, sahamBeredar: 1000 }],
    ['2026-09-03', { nilai: 300, frekuensi: 30, foreignBeli: 70, foreignJual: 40, sahamBeredar: 1000 }],
    ['2026-09-04', { nilai: 400, frekuensi: 40, foreignBeli: 80, foreignJual: 50, sahamBeredar: 2000 }],
    ['2026-09-07', { nilai: 500, frekuensi: 50, foreignBeli: 90, foreignJual: 60, sahamBeredar: 2000 }],
  ])

  it('ember SEHARI (kerangka harian) sama persis dengan lookup satu tanggal', () => {
    const e = jumlahEmber(peta, '2026-09-02', '2026-09-03')!
    expect(e.hari).toBe(1)
    expect(e.nilai).toBe(200)
    expect(e.frekuensi).toBe(20)
  })

  it('ember SEPEKAN menjumlah arusnya — inti cacat yang diperbaiki', () => {
    // Sebelum ini, bar pekanan berkunci Senin memberi 100 (nilai hari Senin
    // saja) padahal pekannya bernilai 1.000.
    const e = jumlahEmber(peta, '2026-09-01', '2026-09-07')!
    expect(e.hari).toBe(4)
    expect(e.nilai).toBe(100 + 200 + 300 + 400)
    expect(e.frekuensi).toBe(10 + 20 + 30 + 40)
    expect(e.foreignBeli - e.foreignJual).toBe((50 + 60 + 70 + 80) - (20 + 30 + 40 + 50))
  })

  it('saham beredar TIDAK dijumlah — ia posisi, diambil dari hari terakhir ember', () => {
    const e = jumlahEmber(peta, '2026-09-01', '2026-09-07')!
    expect(e.sahamBeredar).toBe(2000)          // 4 Sep, bukan 1000+1000+1000+2000
  })

  it('batas atas EKSKLUSIF — hari pertama ember berikutnya tak ikut', () => {
    const e = jumlahEmber(peta, '2026-09-01', '2026-09-04')!
    expect(e.hari).toBe(3)
    expect(e.nilai).toBe(600)
  })

  it('tanpa batas atas = sampai habis (bar terakhir)', () => {
    expect(jumlahEmber(peta, '2026-09-04', null)!.nilai).toBe(900)
  })

  it('ember yang jatuh di hari libur mengembalikan null, bukan nol', () => {
    // Nol akan terbaca sebagai 'tak ada transaksi hari itu'; null membuat
    // pemanggil memilih kalimat 'datanya tak ada', dua hal yang berbeda.
    expect(jumlahEmber(peta, '2026-09-05', '2026-09-07')).toBeNull()
  })
})
