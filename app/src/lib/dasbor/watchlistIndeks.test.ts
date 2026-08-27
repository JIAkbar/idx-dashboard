import { describe, expect, it } from 'vitest'
import type { BarisOhlc } from './ihsgOhlc'
import { tanggalUmumWatchlist, hitungIndeksWatchlist, type AnggotaIndeks } from './watchlistIndeks'

const bar = (tanggal: string, tutup: number): BarisOhlc => [tanggal, tutup, tutup, tutup, tutup, 1000]

describe('tanggalUmumWatchlist', () => {
  it('irisan penuh: tanggal yang tak dipunyai SATU anggota pun dibuang', () => {
    const a: AnggotaIndeks = { kode: 'A', saham: null, bars: [bar('2026-01-01', 100), bar('2026-01-02', 101), bar('2026-01-03', 102)] }
    const b: AnggotaIndeks = { kode: 'B', saham: null, bars: [bar('2026-01-02', 50), bar('2026-01-03', 51)] } // tak listing di 01-01
    const ihsg = [bar('2026-01-01', 7000), bar('2026-01-02', 7010), bar('2026-01-03', 7020)]
    expect(tanggalUmumWatchlist([a, b], ihsg)).toEqual(['2026-01-02', '2026-01-03'])
  })

  it('anggota tanpa satu pun bar diabaikan dari perhitungan (bukan mengosongkan semua)', () => {
    const a: AnggotaIndeks = { kode: 'A', saham: null, bars: [bar('2026-01-01', 100)] }
    const kosong: AnggotaIndeks = { kode: 'B', saham: null, bars: [] }
    const ihsg = [bar('2026-01-01', 7000)]
    expect(tanggalUmumWatchlist([a, kosong], ihsg)).toEqual(['2026-01-01'])
  })

  it('watchlist kosong -> tanggal kosong', () => {
    expect(tanggalUmumWatchlist([], [bar('2026-01-01', 7000)])).toEqual([])
  })
})

describe('hitungIndeksWatchlist — sintetis (angka dihitung tangan)', () => {
  // Dua anggota, 3 hari: return harian A = [+10%, -10%(dari 110->99)],
  // B = [+20%, 0%]. Setara hari-1 = (10+20)/2=15%, hari-2 = (-10+0)/2=-5%.
  // Rebased: 100 -> 115 -> 109.25. Total return = 9,25%.
  const a: AnggotaIndeks = { kode: 'A', saham: null, bars: [bar('2026-01-01', 100), bar('2026-01-02', 110), bar('2026-01-03', 99)] }
  const b: AnggotaIndeks = { kode: 'B', saham: null, bars: [bar('2026-01-01', 50), bar('2026-01-02', 60), bar('2026-01-03', 60)] }
  const ihsg = [bar('2026-01-01', 7000), bar('2026-01-02', 7070), bar('2026-01-03', 7070)] // IHSG: +1%, 0%
  const tgl = tanggalUmumWatchlist([a, b], ihsg)

  it('rebasedSetara & totalReturn cocok hitungan tangan', () => {
    const h = hitungIndeksWatchlist([a, b], ihsg, tgl)!
    expect(h).not.toBeNull()
    expect(h.rebasedSetara[0]).toBe(100)
    expect(h.rebasedSetara[1]).toBeCloseTo(115, 6) // 100*(1+0.15)
    expect(h.rebasedSetara[2]).toBeCloseTo(109.25, 6) // 115*(1-0.05)
    expect(h.metrikSetara.totalReturn).toBeCloseTo(9.25, 6)
  })

  it('winRateHarian: hari-1 setara(15%) > ihsg(1%) menang, hari-2 setara(-5%) > ihsg(0%) kalah -> 50%', () => {
    const h = hitungIndeksWatchlist([a, b], ihsg, tgl)!
    expect(h.metrikSetara.winRateHarian).toBeCloseTo(50, 6)
    expect(h.metrikSetara.nHari).toBe(2)
  })

  it('vsIhsg = totalReturn indeks − totalReturn IHSG', () => {
    const h = hitungIndeksWatchlist([a, b], ihsg, tgl)!
    // IHSG: 7000 -> 7070 -> 7070 => total return = 1%
    expect(h.metrikSetara.vsIhsg).toBeCloseTo(9.25 - 1, 6)
  })

  it('maxDrawdown: puncak 115 di hari-1, lembah 109,25 di hari-2 -> −5%', () => {
    const h = hitungIndeksWatchlist([a, b], ihsg, tgl)!
    expect(h.metrikSetara.maxDrawdown).toBeCloseTo(-5, 6)
  })

  it('rebasedAnggota membawa garis tiap kode, rebased 100 di tgl[0]', () => {
    const h = hitungIndeksWatchlist([a, b], ihsg, tgl)!
    const garisA = h.rebasedAnggota.find((x) => x.kode === 'A')!
    expect(garisA.nilai[0]).toBe(100)
    expect(garisA.nilai[1]).toBeCloseTo(110, 6) // 110/100*100
    expect(garisA.nilai[2]).toBeCloseTo(99, 6) // 99/100*100
  })

  it('bobot Kap.pasar: anggota tanpa saham SAMA-SAMA jadi bobot setara -> rebasedKap = rebasedSetara', () => {
    const h = hitungIndeksWatchlist([a, b], ihsg, tgl)!
    expect(h.rebasedKap[1]).toBeCloseTo(h.rebasedSetara[1], 6)
    expect(h.tanpaKap.sort()).toEqual(['A', 'B'])
  })

  it('bobot Kap.pasar dominan ke anggota bercap besar', () => {
    const besar: AnggotaIndeks = { ...a, saham: 1_000_000 } // cap awal = 100 * 1jt = 100jt
    const kecil: AnggotaIndeks = { ...b, saham: 10 } // cap awal = 50 * 10 = 500 (jauh lebih kecil)
    const h = hitungIndeksWatchlist([besar, kecil], ihsg, tgl)!
    // Hari-1: return besar(A)=+10%, kecil(B)=+20%. Bobot Kap didominasi besar
    // -> returnKap hari-1 harus JAUH lebih dekat ke +10% daripada rata-rata setara (+15%).
    const returnKapHari1 = h.rebasedKap[1] / 100 - 1
    expect(returnKapHari1).toBeCloseTo(0.10, 3)
    expect(h.tanpaKap).toEqual([])
  })

  it('jendela < 3 hari -> null', () => {
    expect(hitungIndeksWatchlist([a, b], ihsg, tgl.slice(0, 2))).toBeNull()
  })

  it('watchlist kosong -> null', () => {
    expect(hitungIndeksWatchlist([], ihsg, tgl)).toBeNull()
  })
})

describe('hitungIndeksWatchlist — data NYATA BBCA/BBRI/TLKM vs IHSG (b3, 63 hari bursa)', () => {
  // Angka pembanding dihitung ULANG independen pakai Python langsung dari
  // `data-idx/json/ohlc/{BBCA,BBRI,TLKM,IHSG}.json` (bukan lewat kode TS
  // ini) — kriteria terima §E: "total return & win rate cocok". Kalau
  // berkas OHLC-nya diperbarui, angka ini bergeser dan harus dihitung ulang
  // (pola sama `grafikEmiten.test.ts` "BBCA: temuannya ada...").
  //
  //   n tanggal umum (BBCA∩BBRI∩TLKM∩IHSG): 5486, 2004-01-02 -> 2026-08-26
  //   window b3 (63 hari terakhir): 2026-05-22 -> 2026-08-26
  //   total return EQ (b3)  : 0.21875153335118114 %
  //   win rate harian EQ (b3): 46.774193548387096 % (n=62, win=29)
  //   return IHSG (b3)      : 3.953882193330358 %
  //   vs IHSG EQ (b3)       : -3.735130659979177 %
  //   max drawdown EQ (b3)  : -19.374430778570495 %
  //   volatilitas EQ (b3)   : 41.15290476809792 %
  //
  // `?raw` (bukan impor JSON biasa, bukan node:fs) — pola sama
  // grafikEmiten.test.ts: impor JSON langsung membuat tsc menyimpulkan tipe
  // literal untuk ribuan baris, dan node:fs butuh @types/node yang sengaja
  // tak dipasang di tsconfig app.
  async function muat(kode: string): Promise<BarisOhlc[]> {
    const mentah = (await import(`../../../../data-idx/json/ohlc/${kode}.json?raw`)).default as string
    return (JSON.parse(mentah) as { d: BarisOhlc[] }).d
  }

  it('total return & win rate EQ cocok hitungan Python independen', async () => {
    const [bbca, bbri, tlkm, ihsg] = await Promise.all([muat('BBCA'), muat('BBRI'), muat('TLKM'), muat('IHSG')])
    const anggota: AnggotaIndeks[] = [
      { kode: 'BBCA', bars: bbca, saham: null },
      { kode: 'BBRI', bars: bbri, saham: null },
      { kode: 'TLKM', bars: tlkm, saham: null },
    ]
    const tglUmum = tanggalUmumWatchlist(anggota, ihsg)
    expect(tglUmum.length).toBe(5486)
    expect(tglUmum[0]).toBe('2004-01-02')

    const windowB3 = tglUmum.slice(-63)
    expect(windowB3[0]).toBe('2026-05-22')
    expect(windowB3.length).toBe(63)

    const h = hitungIndeksWatchlist(anggota, ihsg, windowB3)!
    expect(h).not.toBeNull()
    expect(h.metrikSetara.totalReturn).toBeCloseTo(0.21875153335118114, 6)
    expect(h.metrikSetara.winRateHarian).toBeCloseTo(46.774193548387096, 6)
    expect(h.metrikSetara.nHari).toBe(62)
    expect(h.metrikSetara.vsIhsg).toBeCloseTo(-3.735130659979177, 6)
    expect(h.metrikSetara.maxDrawdown).toBeCloseTo(-19.374430778570495, 6)
    expect(h.metrikSetara.volatilitas).toBeCloseTo(41.15290476809792, 6)
  })
})
