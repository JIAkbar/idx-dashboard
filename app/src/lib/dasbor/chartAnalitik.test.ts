import { describe, expect, it } from 'vitest'
import {
  hitungPivot, hitungCpr, klasifikasiLebarCpr, posisiCpr, relasiCpr,
  hitungRR, jarakKeLevel, returnMultiHorizon, klasifikasiVolumeSurge,
  cekGating, placeholderGating, offsetHorizon, offsetIntraday, OFFSET_HARIAN,
} from './chartAnalitik'
import type { Pivot } from '../skor/types'

describe('hitungPivot', () => {
  it('kasus hitung-tangan H=110 L=90 C=100', () => {
    const p = hitungPivot(110, 90, 100)
    expect(p).toEqual({ P: 100, R1: 110, S1: 90, R2: 120, S2: 80, R3: 130, S3: 70 })
  })
})

describe('hitungCpr', () => {
  it('tukar label kalau hitungan mentah BC>TC (Close di bawah tengah H/L)', () => {
    // P=310/3=103.33; BC mentah=(110+100)/2=105; TC mentah=2P-105=101.67 -> tertukar
    const cpr = hitungCpr(110, 100, 100)
    expect(cpr.tc).toBeGreaterThan(cpr.bc)
    expect(cpr.bc).toBeCloseTo(101.667, 2)
    expect(cpr.tc).toBeCloseTo(105, 2)
  })

  it('tak perlu tukar kalau sudah TC>BC', () => {
    // H=110 L=90 C=100 -> P=100, BC=(110+90)/2=100, TC=2*100-100=100 (BC==TC, batas)
    const cpr = hitungCpr(110, 90, 100)
    expect(cpr.bc).toBeCloseTo(100, 6)
    expect(cpr.tc).toBeCloseTo(100, 6)
  })
})

describe('klasifikasiLebarCpr', () => {
  it('fallback ambang tetap kalau riwayat <30 sesi', () => {
    const riwayat = Array(10).fill(1)
    expect(klasifikasiLebarCpr(0.4, riwayat)).toMatchObject({ klasifikasi: 'Sempit', pakaiFallback: true })
    expect(klasifikasiLebarCpr(0.4, riwayat).label).toContain('(ambang default, riwayat kurang)')
    expect(klasifikasiLebarCpr(1.3, riwayat)).toMatchObject({ klasifikasi: 'Lebar', pakaiFallback: true })
    expect(klasifikasiLebarCpr(0.8, riwayat)).toMatchObject({ klasifikasi: 'Normal', pakaiFallback: true })
  })

  it('batas 0.7x/1.3x tepat di batasnya -> Normal (strict <, strict >)', () => {
    const riwayat = Array(30).fill(2) // m60 = 2
    expect(klasifikasiLebarCpr(1.4, riwayat)).toMatchObject({ klasifikasi: 'Normal', m60: 2 }) // 0.7*2
    expect(klasifikasiLebarCpr(2.6, riwayat)).toMatchObject({ klasifikasi: 'Normal', m60: 2 }) // 1.3*2
    expect(klasifikasiLebarCpr(1.39, riwayat).klasifikasi).toBe('Sempit')
    expect(klasifikasiLebarCpr(2.61, riwayat).klasifikasi).toBe('Lebar')
  })
})

describe('posisiCpr', () => {
  it('tiga posisi', () => {
    expect(posisiCpr(120, 110, 100)).toBe('di-atas')
    expect(posisiCpr(90, 110, 100)).toBe('di-bawah')
    expect(posisiCpr(105, 110, 100)).toBe('di-dalam')
  })
})

describe('relasiCpr', () => {
  const prev = { tc: 110, bc: 100, p: 105 }

  it('Higher Value: BC >= TC_prev', () => {
    const r = relasiCpr({ tc: 130, bc: 115, p: 120 }, prev)
    expect(r).toEqual({ kelas: 'Higher Value', bias: 'Rentang CPR bergeser naik penuh dari sesi lalu' })
  })

  it('Lower Value: TC <= BC_prev', () => {
    const r = relasiCpr({ tc: 95, bc: 80, p: 88 }, prev)
    expect(r).toEqual({ kelas: 'Lower Value', bias: 'Rentang CPR bergeser turun penuh dari sesi lalu' })
  })

  it('Outside Value: TC>TC_prev dan BC<BC_prev', () => {
    const r = relasiCpr({ tc: 120, bc: 90, p: 105 }, prev)
    expect(r).toEqual({ kelas: 'Outside Value', bias: 'Rentang CPR melebar melampaui sesi lalu' })
  })

  it('Inside Value: TC<TC_prev dan BC>BC_prev', () => {
    const r = relasiCpr({ tc: 108, bc: 102, p: 105 }, prev)
    expect(r).toEqual({ kelas: 'Inside Value', bias: 'Rentang CPR menyempit di dalam sesi lalu' })
  })

  it('Overlapping Higher: overlap, P>P_prev', () => {
    const r = relasiCpr({ tc: 115, bc: 105, p: 110 }, prev)
    expect(r).toEqual({ kelas: 'Overlapping Higher', bias: 'Rentang CPR tumpang tindih, pivot lebih tinggi' })
  })

  it('Overlapping Lower: overlap, P<=P_prev', () => {
    const r = relasiCpr({ tc: 115, bc: 105, p: 100 }, prev)
    expect(r).toEqual({ kelas: 'Overlapping Lower', bias: 'Rentang CPR tumpang tindih, pivot lebih rendah' })
  })
})

describe('hitungRR', () => {
  it('contoh spek: Reward% 2.0 / Risk% 3.3 -> "1 : 0.6"', () => {
    // Close=1000, R1=1020 (reward 2.0%), S1=967 (risk 3.3%)
    const pivot: Pivot = { P: 1000, R1: 1020, R2: 0, R3: 0, S1: 967, S2: 0, S3: 0 }
    const rr = hitungRR(1000, pivot)
    expect(rr.rewardPct).toBeCloseTo(2.0, 6)
    expect(rr.riskPct).toBeCloseTo(3.3, 6)
    expect(rr.label).toBe('Risk : Reward = 1 : 0.6')
  })
})

describe('jarakKeLevel', () => {
  it('persen jarak tiap level ke close', () => {
    const j = jarakKeLevel(100, { r1: 110, s1: 90, tc: 105, bc: 95 })
    expect(j).toEqual({ r1: 10, s1: -10, tc: 5, bc: -5 })
  })
})

describe('returnMultiHorizon', () => {
  it('1W = C_t vs C_{t-5}, off-by-one dijaga', () => {
    const closes = [100, 101, 102, 103, 104, 110] // 6 bar, index terakhir = t
    const r = returnMultiHorizon(closes)
    expect(r.r1d).toBeCloseTo(((110 - 104) / 104) * 100, 6)
    expect(r.r1w).toBeCloseTo(((110 - 100) / 100) * 100, 6)
    expect(r.r1m).toBeNull()
    expect(r.r3m).toBeNull()
  })

  it('bar kurang -> null, bukan galat', () => {
    const r = returnMultiHorizon([100, 101, 102, 103, 104]) // 5 bar, 1W butuh 6
    expect(r.r1w).toBeNull()
    expect(r.r1d).not.toBeNull()
  })
})

describe('klasifikasiVolumeSurge', () => {
  it('MA20 TIDAK memuat V_t — lonjakan besar tak meredam pembaginya sendiri', () => {
    const hasil = klasifikasiVolumeSurge(250, Array(20).fill(100))
    expect(hasil?.ma20).toBe(100) // kalau vT ikut masuk, ma20 jadi (100*20+250)/21 != 100
    expect(hasil?.surgePct).toBeCloseTo(150, 6)
    expect(hasil?.klasifikasi).toBe('sangat-tinggi')
  })

  it('ambang tepat di 100/50/-30', () => {
    expect(klasifikasiVolumeSurge(200, Array(20).fill(100))?.klasifikasi).toBe('sangat-tinggi') // +100%
    expect(klasifikasiVolumeSurge(150, Array(20).fill(100))?.klasifikasi).toBe('tinggi') // +50%
    expect(klasifikasiVolumeSurge(149, Array(20).fill(100))?.klasifikasi).toBe('normal') // +49%
    expect(klasifikasiVolumeSurge(70, Array(20).fill(100))?.klasifikasi).toBe('rendah') // -30%
    expect(klasifikasiVolumeSurge(71, Array(20).fill(100))?.klasifikasi).toBe('normal') // -29%
  })
})

describe('cekGating', () => {
  it('teks banner & daftar metrik gagal persis format', () => {
    const g = cekGating(10)
    expect(g.gagal.map((m) => m.kunci)).toEqual(['volume_surge', 'return_1m', 'return_3m'])
    expect(g.banner).toBe('Periode 10 sesi belum cukup untuk: Volume Surge, Return 1M, Return 3M. Perpanjang rentang tanggal.')
  })

  it('semua lolos -> banner null', () => {
    const g = cekGating(64)
    expect(g.gagal).toEqual([])
    expect(g.banner).toBeNull()
  })

  it('placeholder format persis', () => {
    expect(placeholderGating(21, 10)).toBe('— (butuh 21 sesi, tersedia 10)')
  })
})

describe('offsetHorizon — arti 1D/1W/1M/3M per kerangka (#51)', () => {
  it('harian tetap 1/5/21/63 sesi', () => {
    expect(offsetHorizon('D')).toEqual(OFFSET_HARIAN)
    expect(offsetHorizon('D')).toEqual({ d1: 1, w1: 5, m1: 21, m3: 63 })
  })

  it('pekanan: "1 hari" tak punya wujud, dan 3M = 13 bar bukan 63', () => {
    expect(offsetHorizon('W')).toEqual({ d1: null, w1: 1, m1: 4, m3: 13 })
  })

  it('bulanan: hanya 1M dan 3M yang bisa dinyatakan', () => {
    expect(offsetHorizon('M')).toEqual({ d1: null, w1: null, m1: 1, m3: 3 })
  })

})

describe('offsetIntraday — jangkar dari TANGGAL, bukan perkalian bar-per-hari', () => {
  /** Deret intraday sintetis: `perHari` bar untuk tiap tanggal berurutan. */
  const deret = (perHari: number[]) => {
    const keluar: string[] = []
    perHari.forEach((n, hari) => {
      const tgl = `2026-09-${String(hari + 1).padStart(2, '0')}`
      for (let i = 0; i < n; i++) keluar.push(`${tgl} ${String(9 + i).padStart(2, '0')}:00`)
    })
    return keluar
  }

  it('1D = jarak ke bar TERAKHIR hari bursa sebelumnya', () => {
    // 3 bar/hari, dua hari: bar terakhir index 5, tutup kemarin index 2 -> 3 bar.
    expect(offsetIntraday(deret([3, 3])).d1).toBe(3)
  })

  it('sesi PENDEK tidak menggeser jangkarnya — inti kenapa perkalian modus salah', () => {
    // Kamis 7 bar, Jumat 6 bar (sesi Jumat IDX lebih pendek). Perkalian modus
    // 7 akan mendarat SATU JAM SEBELUM tutup Kamis; jangkar-tanggal tepat.
    const w = deret([7, 7, 7, 7, 6])
    expect(offsetIntraday(w).d1).toBe(6)                      // 6 bar Jumat, bukan 7
    expect(w[w.length - 1 - 6]).toBe('2026-09-04 15:00')      // tutup Kamis, bar terakhirnya
  })

  it('bar hilang di tengah hari juga tak menggeser apa pun', () => {
    expect(offsetIntraday(deret([2, 9, 4])).d1).toBe(4)
  })

  it('hari kurang -> null, bukan angka yang dipaksakan', () => {
    const sehari = offsetIntraday(deret([20]))
    expect(sehari).toEqual({ d1: null, w1: null, m1: null, m3: null })
    expect(offsetIntraday(deret([5, 5, 5])).w1).toBeNull()    // 1W butuh 6 tanggal
  })

  it('jendela yang membelah DUA hari terpotong tetap benar — dulu memberi return 75 menit', () => {
    // Separuh belakang Senin + separuh depan Selasa. Perkalian modus memberi
    // d1 = 30 (setengah hari) dan gatingnya ikut menyusut sehingga lolos.
    const w = [...deret([30]).map((x) => x), ...deret([0, 30])]
    expect(offsetIntraday(w).d1).toBe(30)                     // tetap: tutup Senin memang 30 bar ke belakang
    expect(offsetIntraday(w).w1).toBeNull()
  })

  it('deret kosong -> semua null', () => {
    expect(offsetIntraday([])).toEqual({ d1: null, w1: null, m1: null, m3: null })
  })
})

describe('returnMultiHorizon dengan offset kerangka', () => {
  it('offset pekanan memakai bar ke-13 untuk 3M, bukan ke-63', () => {
    // 14 bar: index 0 dipakai 3M (13 bar ke belakang dari index 13).
    const closes = Array.from({ length: 14 }, (_, i) => 100 + i)
    const r = returnMultiHorizon(closes, offsetHorizon('W'))
    expect(r.r1d).toBeNull()                                    // 1 hari tak berlaku di chart pekanan
    expect(r.r1w).toBeCloseTo(((113 - 112) / 112) * 100, 6)
    expect(r.r1m).toBeCloseTo(((113 - 109) / 109) * 100, 6)
    expect(r.r3m).toBeCloseTo(((113 - 100) / 100) * 100, 6)
  })

  it('deret yang sama dengan offset harian memberi 3M null — bukti offsetnya benar-benar dipakai', () => {
    const closes = Array.from({ length: 14 }, (_, i) => 100 + i)
    expect(returnMultiHorizon(closes).r3m).toBeNull()
  })
})

describe('cekGating ikut kerangka (#51)', () => {
  it('satuan bar dipakai apa adanya di banner', () => {
    const g = cekGating(10, { satuan: 'candle 5 menit' })
    expect(g.banner).toContain('Periode 10 candle 5 menit belum cukup')
  })

  it('di chart pekanan 20 bar sudah cukup untuk 3M — dengan ambang lama ia gagal', () => {
    const pekan = cekGating(20, { satuan: 'pekan', offset: offsetHorizon('W') })
    expect(pekan.gagal.map((m) => m.kunci)).not.toContain('return_3m')
    expect(cekGating(20).gagal.map((m) => m.kunci)).toContain('return_3m')
  })

  it('horizon yang tak berlaku tidak ikut banner "belum cukup"', () => {
    const bulan = cekGating(120, { satuan: 'bulan', offset: offsetHorizon('M') })
    expect(bulan.gagal.map((m) => m.kunci)).toEqual(['return_1d', 'return_1w'])
    expect(bulan.banner).toBeNull()                             // data cukup; dua horizon itu memang tak ada wujudnya
  })
})

describe('placeholderGating membedakan dua sebab', () => {
  it('data kurang menyebut angkanya, dalam satuan kerangka', () => {
    expect(placeholderGating(14, 9, 'pekan')).toBe('— (butuh 14 pekan, tersedia 9)')
  })

  it('tak berlaku di kerangka ini bukan kalimat yang sama dengan data kurang', () => {
    expect(placeholderGating(null, 500, 'bulan')).toBe('— (tak berlaku di kerangka ini)')
  })
})
