import { describe, it, expect } from 'vitest'
import {
  agregasiBroker, avgHarga, kumulatifBroker, topNet,
  kalenderBrokerHarian, stalkerAgregasi, kodeBrokerUnik,
  zScoreBergerak, rsRatioMomentum, porsiBergerak,
  musimanHari, musimanBulan, moneyFlowAsing, pilihKandidatSektor,
  groupScoreHarian,
} from './neoPapan'
import type { BarHarga, BrokerHarianEmiten, HariBroker } from './neoPapanData'
import type { KategoriBroker } from './kategoriBroker'

function hari(broker: Array<[string, number, number, number, number]>): HariBroker {
  return {
    ringkas: null,
    broker: broker.map(([kode, beliLot, beliNilai, jualLot, jualNilai]) => ({ kode, beliLot, beliNilai, jualLot, jualNilai })),
  }
}

describe('agregasiBroker', () => {
  it('menjumlah dua hari untuk broker yang sama', () => {
    const h = {
      '2026-01-01': hari([['AK', 100, 10_000, 50, 5_000]]),
      '2026-01-02': hari([['AK', 20, 2_000, 0, 0], ['BK', 10, 1_000, 10, 1_000]]),
    }
    const agg = agregasiBroker(h, ['2026-01-01', '2026-01-02'])
    const ak = agg.find((a) => a.kode === 'AK')!
    expect(ak.beliLot).toBe(120)
    expect(ak.beliNilai).toBe(12_000)
    expect(ak.jualNilai).toBe(5_000)
    expect(ak.net).toBe(12_000 - 5_000)
    const bk = agg.find((a) => a.kode === 'BK')!
    expect(bk.net).toBe(0)
  })

  it('mengabaikan tanggal yang tak ada di berkas', () => {
    const h = { '2026-01-01': hari([['AK', 1, 100, 0, 0]]) }
    const agg = agregasiBroker(h, ['2026-01-01', '2026-01-99'])
    expect(agg).toHaveLength(1)
  })
})

describe('avgHarga', () => {
  it('nol lot -> null, bukan Infinity/NaN', () => {
    expect(avgHarga(1000, 0)).toBeNull()
  })
  it('lot dikali 100 (lembar per lot)', () => {
    expect(avgHarga(20_000, 1)).toBe(200)
  })
})

describe('kumulatifBroker & topNet', () => {
  const h = {
    '2026-01-01': hari([['AK', 10, 1000, 0, 0], ['BK', 0, 0, 10, 1000]]),
    '2026-01-02': hari([['AK', 10, 1000, 0, 0], ['BK', 0, 0, 5, 500]]),
  }
  it('kumulatif berjalan menaik tiap hari untuk net buyer', () => {
    const r = kumulatifBroker(['2026-01-01', '2026-01-02'], h, ['AK', 'BK'])
    const ak = r.seri.find((s) => s.broker === 'AK')!
    expect(ak.nilai).toEqual([1000, 2000])
    const bk = r.seri.find((s) => s.broker === 'BK')!
    expect(bk.nilai).toEqual([-1000, -1500])
  })
  it('topNet memilah pembeli/penjual terbesar', () => {
    const agg = agregasiBroker(h, ['2026-01-01', '2026-01-02'])
    const { pembeli, penjual } = topNet(agg, 1)
    expect(pembeli[0].kode).toBe('AK')
    expect(penjual[0].kode).toBe('BK')
  })
})

describe('stalkerAgregasi', () => {
  const peta = new Map<string, BrokerHarianEmiten>([
    ['BUMI', { kode: 'BUMI', jendelaHari: 2, hari: { '2026-01-01': hari([['AK', 100, 10_000, 0, 0]]), '2026-01-02': hari([['AK', 50, 5_000, 0, 0]]) } }],
    ['DEWA', { kode: 'DEWA', jendelaHari: 1, hari: { '2026-01-02': hari([['AK', 0, 0, 200, 20_000]]) } }],
    ['ANTM', { kode: 'ANTM', jendelaHari: 1, hari: { '2026-01-02': hari([['BK', 10, 1_000, 0, 0]]) } }],
  ])

  it('kalender gabungan = union tanggal seluruh emiten', () => {
    expect(kalenderBrokerHarian(peta)).toEqual(['2026-01-01', '2026-01-02'])
  })

  it('menjumlah net broker terpilih lintas emiten, memisah net buy/sell', () => {
    const r = stalkerAgregasi(peta, ['AK'], 2)
    expect(r.jendela).toEqual(['2026-01-01', '2026-01-02'])
    expect(r.netBuy).toHaveLength(1)
    expect(r.netBuy[0]).toMatchObject({ emiten: 'BUMI', net: 15_000, cakupanHari: 2 })
    expect(r.netSell).toHaveLength(1)
    expect(r.netSell[0]).toMatchObject({ emiten: 'DEWA', net: -20_000, cakupanHari: 1 })
    // ANTM tak punya baris AK sama sekali -> tak muncul di kedua daftar.
    expect(r.netBuy.find((x) => x.emiten === 'ANTM')).toBeUndefined()
    expect(r.netSell.find((x) => x.emiten === 'ANTM')).toBeUndefined()
  })

  it('cakupanHari mencatat emiten yang arsipnya belum menutupi seluruh jendela', () => {
    const r = stalkerAgregasi(peta, ['AK'], 2)
    // DEWA cuma punya 1 dari 2 hari jendela.
    expect(r.netSell[0].cakupanHari).toBe(1)
  })

  it('kodeBrokerUnik mengumpulkan seluruh kode broker yang muncul', () => {
    expect(kodeBrokerUnik(peta)).toEqual(['AK', 'BK'])
  })

  it('brokerAktif mencatat broker terpilih yang benar-benar transaksi di baris itu', () => {
    const r = stalkerAgregasi(peta, ['AK', 'BK'], 2)
    expect(r.netBuy.find((x) => x.emiten === 'BUMI')?.brokerAktif).toEqual(['AK'])
    expect(r.netBuy.find((x) => x.emiten === 'ANTM')?.brokerAktif).toEqual(['BK'])
  })
})

describe('zScoreBergerak & rsRatioMomentum', () => {
  it('deret konstan -> z-score 100 (stdev nol)', () => {
    expect(zScoreBergerak([5, 5, 5, 5], 3)).toEqual([100, 100, 100, 100])
  })
  it('nilai di atas rata-rata jendela -> di atas 100', () => {
    const z = zScoreBergerak([1, 1, 1, 10], 4)
    expect(z[3]).toBeGreaterThan(100)
  })
  it('rsRatioMomentum menghasilkan dua deret sepanjang input', () => {
    const { rsRatio, rsMomentum } = rsRatioMomentum([100, 101, 99, 103, 98], 3)
    expect(rsRatio).toHaveLength(5)
    expect(rsMomentum).toHaveLength(5)
  })
})

describe('porsiBergerak', () => {
  it('porsi grup terhadap total, rata-rata bergerak', () => {
    const grup = [10, 10, 10, 10]
    const total = [100, 100, 100, 100]
    const p = porsiBergerak(grup, total, 2)
    expect(p[0]).toBeCloseTo(0.1)
    expect(p[3]).toBeCloseTo(0.1)
  })
  it('total nol pada satu hari tak melempar galat (jadi porsi nol)', () => {
    const p = porsiBergerak([5], [0], 5)
    expect(p[0]).toBe(0)
  })
})

describe('musimanHari & musimanBulan', () => {
  function bar(t: string, c: number): BarHarga {
    return { t, o: c, h: c, l: c, c, v: 0, val: 0, freq: 0, fb: 0, fs: 0, so: 0 }
  }
  it('membagi return harian ke 5 hari kerja', () => {
    // Senin 2026-01-05 .. Jumat 2026-01-09 (2026-01-01 itu Kamis, aman diabaikan).
    const bars = [
      bar('2026-01-05', 100), // Senin
      bar('2026-01-06', 110), // Selasa: +10%
      bar('2026-01-07', 99),  // Rabu: -10%
    ]
    const stat = musimanHari(bars)
    expect(stat).toHaveLength(5)
    // Selasa (index 1) naik 100%, n=1
    expect(stat[1].naikPersen).toBe(100)
    expect(stat[1].n).toBe(1)
    // Rabu (index 2) turun 100%
    expect(stat[2].turunPersen).toBe(100)
  })

  it('membagi return akhir bulan ke 12 bulan', () => {
    const bars = [
      bar('2026-01-31', 100),
      bar('2026-02-27', 105),
      bar('2026-03-31', 100),
    ]
    const stat = musimanBulan(bars)
    expect(stat).toHaveLength(12)
    expect(stat[1].n).toBe(1) // Februari
    expect(stat[1].naikPersen).toBe(100)
  })

  it('kurang dari 2 bar -> statistik kosong, bukan galat', () => {
    expect(musimanHari([bar('2026-01-01', 100)])).toHaveLength(5)
    expect(musimanHari([bar('2026-01-01', 100)])[0].n).toBe(0)
  })
})

describe('pilihKandidatSektor', () => {
  it('mengurutkan tiap sektor by nilai desc dan memotong ke perSektor', () => {
    const baris = [
      { kode: 'A', sektor: 'Energi', nilai: 100 },
      { kode: 'B', sektor: 'Energi', nilai: 300 },
      { kode: 'C', sektor: 'Energi', nilai: 200 },
      { kode: 'D', sektor: 'Keuangan', nilai: 50 },
    ]
    const r = pilihKandidatSektor(baris, 2)
    expect(r.Energi).toEqual(['B', 'C'])
    expect(r.Keuangan).toEqual(['D'])
  })
  it('mengabaikan baris tanpa sektor atau nilai', () => {
    const r = pilihKandidatSektor([{ kode: 'A', sektor: '', nilai: 10 }, { kode: 'B', sektor: 'X', nilai: null }], 5)
    expect(r).toEqual({})
  })
})

describe('moneyFlowAsing', () => {
  it('selisih beli-jual asing', () => {
    expect(moneyFlowAsing({ t: '', o: 0, h: 0, l: 0, c: 0, v: 0, val: 0, freq: 0, fb: 300, fs: 120, so: 0 })).toBe(180)
  })
})

// ── RRG V2 (spek_neo_papan_revisi.md §1.8) ──────────────────────────────────
import {
  domainSimetris, kuadranRrg, rsRatioMomentumV2, warmUpRrg,
  zScoreBergerakN, type RrgParam,
} from './neoPapan'

const P4: RrgParam = { n: 4, smoothLen: 3, skala: 1.5 }

describe('zScoreBergerakN', () => {
  it('warm-up = null (bukan 100 palsu), dan deret flat = null (sd 0)', () => {
    const flat = zScoreBergerakN(new Array(12).fill(5), 4)
    expect(flat.slice(0, 3).every((v) => v === null)).toBe(true)
    // §1.8.3: flat sempurna → sd 0 → null, bukan titik menggumpal di pusat
    expect(flat.every((v) => v === null)).toBe(true)
  })

  it('gap di tengah membuat window yang menyentuhnya null — TIDAK dijahit', () => {
    const xs: (number | null)[] = [1, 2, 3, 4, null, 6, 7, 8, 9, 10]
    const z = zScoreBergerakN(xs, 3)
    // window [3,4,null], [4,null,6], [null,6,7] semuanya null
    expect(z[4]).toBeNull()
    expect(z[5]).toBeNull()
    expect(z[6]).toBeNull()
    // window [6,7,8] bersih lagi
    expect(z[7]).not.toBeNull()
  })

  it('SD sampel, bukan populasi: z ujung [1,2,3] = (3-2)/1 = 1', () => {
    const z = zScoreBergerakN([1, 2, 3], 3)
    expect(z[2]).toBeCloseTo(1, 10) // sd sampel = 1; sd populasi 0.816 akan memberi 1.2247
  })
})

describe('rsRatioMomentumV2 — uji rotasi (§1.8.1)', () => {
  // Catatan atas spek: fixture "linier mulus" DEGENERATE — tren tetap membuat
  // z-ratio konstan, ROC-nya nol konstan, sd nol → momentum null (bukan >100).
  // Yang membuktikan mekanismenya adalah AKSELERASI lalu melandai; diukur
  // empiris sebelum angka di bawah dibekukan.
  it('akselerasi: momentum > 100 konsisten; melandai: momentum jatuh ≤100 SAAT ratio masih ≥100 (de-coupling)', () => {
    const n = P4.n
    const naik = 40
    const rs: number[] = []
    for (let i = 0; i < naik; i++) rs.push(100 + 0.05 * i * i) // naik berakselerasi
    for (let i = 0; i < 4 * n; i++) rs.push(rs[naik - 1]) // melandai (flat)
    const t = rsRatioMomentumV2(rs, P4)
    for (let i = warmUpRrg(n, P4.smoothLen); i < naik; i++) {
      expect(t[i].rsMomentum, `i=${i}`).not.toBeNull()
      expect(t[i].rsMomentum as number, `i=${i}`).toBeGreaterThan(100)
    }
    const jatuh = t.findIndex((p, i) => i >= naik && p.rsMomentum != null && (p.rsMomentum as number) <= 100)
    expect(jatuh).toBeGreaterThan(-1)
    expect(t[jatuh].rsRatio as number).toBeGreaterThanOrEqual(100) // momentum memimpin
  })

  it('warm-up kompoun TERMASUK EMA: titik valid pertama di 3n+smoothLen-3 (koreksi atas 3n-2 spek)', () => {
    const rs = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 5 + i * 0.3)
    const t = rsRatioMomentumV2(rs, P4)
    const pertama = t.findIndex((p) => p.rsRatio != null && p.rsMomentum != null)
    expect(pertama).toBe(warmUpRrg(P4.n, P4.smoothLen))
    expect(pertama).toBe(12) // n=4, smoothLen=3
  })

  it('kasus tetap 15 bar hitung-tangan (§1.8.4) — beku, toleransi 1e-6', () => {
    const rs = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114]
    const p: RrgParam = { n: 3, smoothLen: 3, skala: 1.5 }
    const t = rsRatioMomentumV2(rs, p)
    // EMA(3) deret aritmetik +1/bar konvergen ke x[i]-1 → z-window aritmetik
    // sempurna: z = (x-mean)/sd_sampel = 1 → ratio = 101.5 konstan → ROC(3)=0
    // konstan → sd 0 → momentum null. Terhitung tangan, bukan disalin dari
    // keluaran; membekukan perilaku sd<epsilon → null sekaligus.
    expect(t[7].rsRatio).not.toBeNull()
    expect(t[7].rsRatio as number).toBeCloseTo(101.5, 6)
    expect(t[14].rsRatio as number).toBeCloseTo(101.5, 6)
    expect(t[14].rsMomentum).toBeNull()
  })

  it('jumlah titik valid n=12 dalam window fetch dinamis ≥ TRAIL 6 (§1.8.5)', () => {
    const TRAIL = 6
    const maxN = 12
    const lebar = warmUpRrg(maxN, 3) + TRAIL + 5 // rumus fetch window (koreksi §1.3)
    const rs = Array.from({ length: lebar }, (_, i) => 100 + Math.sin(i / 3) * 4 + i * 0.2)
    const t = rsRatioMomentumV2(rs, { n: maxN, smoothLen: 3, skala: 1.5 })
    const valid = t.filter((p) => p.rsRatio != null && p.rsMomentum != null).length
    expect(valid).toBeGreaterThanOrEqual(TRAIL)
  })
})

describe('domainSimetris + kuadranRrg', () => {
  it('X=Y sama lebar, pusat 100 (§1.8.2)', () => {
    const d = domainSimetris([96, 103.5, null, 100.2])
    expect(d.max - 100).toBeCloseTo(100 - d.min, 10)
    expect((d.max + d.min) / 2).toBeCloseTo(100, 10)
    expect(d.max).toBeCloseTo(100 + 4 * 1.1, 10) // deviasi terbesar |96-100|=4
  })
  it('deviasi kecil dijaga minimum supaya chart tak zoom ekstrem', () => {
    const d = domainSimetris([100.1, 99.9])
    expect(d.max).toBe(103)
  })
  it('nama kuadran per definisi RRG', () => {
    expect(kuadranRrg(99, 101)).toBe('Improving')
    expect(kuadranRrg(101, 101)).toBe('Outperform')
    expect(kuadranRrg(101, 99)).toBe('Weakening')
    expect(kuadranRrg(99, 99)).toBe('Underperform')
  })
})

// ── Broker Stalker V2 (spek §2 + penajaman #1) ──────────────────────────────
import { konsistensiNet, stalkerAgregasiV2, type HariStalkerV2 } from './neoPapan'

function hV2(broker: Array<[string, number, number, number, number]>, asing?: HariStalkerV2, totalLot?: number): HariStalkerV2 {
  return {
    ringkas: totalLot != null ? { totalLot } : null,
    broker: broker.map(([kode, beliLot, beliNilai, jualLot, jualNilai]) => ({ kode, beliLot, beliNilai, jualLot, jualNilai })),
    asing,
  }
}

describe('stalkerAgregasiV2', () => {
  const peta = new Map([
    ['BUMI', { hari: {
      '2026-01-01': hV2([['AK', 100, 10_000, 0, 0]], hV2([['AK', 40, 4_000, 0, 0]]), 1_000),
      '2026-01-02': hV2([['AK', 50, 5_000, 20, 2_000]], undefined, 500),
    } }],
  ])

  it('jendela eksplisit: tanggal di luar jendela tak dihitung', () => {
    const r = stalkerAgregasiV2(peta, ['AK'], ['2026-01-01'], 'all')
    expect(r.netBuy[0].beli).toBe(10_000)
    expect(r.netBuy[0].seriHarian).toEqual([{ t: '2026-01-01', net: 10_000 }])
  })

  it('all: dua hari terjumlah + seriHarian + porsiVol dirata', () => {
    const r = stalkerAgregasiV2(peta, ['AK'], ['2026-01-01', '2026-01-02'], 'all')
    const b = r.netBuy[0]
    expect(b.net).toBe(13_000)
    expect(b.seriHarian.map((s) => s.net)).toEqual([10_000, 3_000])
    // porsi: (100/1000 + 50/500)/2 = 0.1
    expect(b.porsiVol).toBeCloseTo(0.1, 10)
    expect(b.cakupanInvestor).toBe(2)
  })

  it('asing: hanya hari ber-varian asing yang terhitung, cakupanInvestor jujur', () => {
    const r = stalkerAgregasiV2(peta, ['AK'], ['2026-01-01', '2026-01-02'], 'asing')
    const b = r.netBuy[0]
    expect(b.beli).toBe(4_000)
    expect(b.cakupanHari).toBe(2)
    expect(b.cakupanInvestor).toBe(1)
  })

  it('domestik = ALL − ASING per broker; hari tanpa asing dilewati (bukan disamakan ALL)', () => {
    const r = stalkerAgregasiV2(peta, ['AK'], ['2026-01-01', '2026-01-02'], 'domestik')
    const b = r.netBuy[0]
    expect(b.beli).toBe(6_000) // 10.000 − 4.000; hari kedua dilewati
    expect(b.cakupanInvestor).toBe(1)
  })
})

describe('konsistensiNet', () => {
  it('beruntun dari terkini mundur, putus di net ≤ 0', () => {
    expect(konsistensiNet([{ net: 5 }, { net: -1 }, { net: 2 }, { net: 3 }])).toBe(2)
    expect(konsistensiNet([{ net: -1 }])).toBe(0)
    expect(konsistensiNet([])).toBe(0)
  })
})

describe('musiman tahunN (spek §7)', () => {
  function barT(t: string, c: number) {
    return { t, o: c, h: c, l: c, c, v: 0, val: 0, freq: 0, fb: 0, fs: 0, so: 0 }
  }
  it('tahunN=1 membuang bar yang lebih tua dari setahun', () => {
    const bars = [
      barT('2020-01-06', 100), barT('2020-01-07', 200), // Selasa lama: +100%
      barT('2026-01-05', 100), barT('2026-01-06', 110), // Selasa baru: +10%
    ]
    const semua = musimanHari(bars, 12)
    const setahun = musimanHari(bars, 1)
    expect(semua[1].n).toBe(2)
    expect(setahun[1].n).toBe(1)
    expect(setahun[1].naikPersen).toBe(100)
  })
})

describe('groupScoreHarian (spek_bandarmologi_c2.md §B.4)', () => {
  const kategori: Record<string, KategoriBroker> = { AK: 'whale', BK: 'whale', XL: 'ritel', YP: 'ritel' }

  it('skor = tanda net kategori × jumlah broker searah', () => {
    const hariData = {
      '2026-01-01': {
        broker: [
          { kode: 'AK', beliNilai: 100, jualNilai: 0 }, // whale net +100
          { kode: 'BK', beliNilai: 50, jualNilai: 0 },  // whale net +50, searah AK
          { kode: 'XL', beliNilai: 0, jualNilai: 30 },  // ritel net -30
        ],
      },
    }
    const [h] = groupScoreHarian(['2026-01-01'], hariData, kategori)
    // whale: net kategori = +150 (tanda +1), 2 broker searah (AK & BK sama-sama net>0) → skor 2
    expect(h.skor.whale).toBe(2)
    // ritel: hanya XL aktif, net kategori -30 (tanda -1), 1 broker searah → skor -1
    expect(h.skor.ritel).toBe(-1)
  })

  it('broker berlawanan arah dari kategorinya tidak ikut dihitung "searah"', () => {
    const hariData = {
      '2026-01-01': {
        broker: [
          { kode: 'AK', beliNilai: 100, jualNilai: 0 },  // whale net +100
          { kode: 'BK', beliNilai: 0, jualNilai: 20 },   // whale net -20 (berlawanan)
        ],
      },
    }
    const [h] = groupScoreHarian(['2026-01-01'], hariData, kategori)
    // net kategori whale = 80 (tanda +1), hanya AK yang searah → skor 1 (BK tak dihitung)
    expect(h.skor.whale).toBe(1)
  })

  it('kode broker yang belum terkategori diabaikan, bukan galat', () => {
    const hariData = { '2026-01-01': { broker: [{ kode: 'ZZZ', beliNilai: 10, jualNilai: 0 }] } }
    const [h] = groupScoreHarian(['2026-01-01'], hariData, kategori)
    expect(h.skor).toEqual({})
  })

  it('tanggal tanpa data → skor kosong, bukan galat', () => {
    const [h] = groupScoreHarian(['2026-02-01'], {}, kategori)
    expect(h.t).toBe('2026-02-01')
    expect(h.skor).toEqual({})
  })
})
