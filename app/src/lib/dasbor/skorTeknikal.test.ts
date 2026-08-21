import { describe, expect, it } from 'vitest'
import type { BarisOhlc } from './ihsgOhlc'
import {
  MOMENTUM_HARI, cci, emaAkhir, labelSkor, macd, momentumPersen, rakitPeriode,
  rsi, skorTeknikal, skorTigaKerangka, sma, stochK, williamsR,
} from './skorTeknikal'

/** Deret harian buatan. `naik` positif = tren naik. */
function deret(n: number, awal = 100, naik = 0, lebar = 4): BarisOhlc[] {
  const mulai = Date.UTC(2024, 0, 1)
  return Array.from({ length: n }, (_, i) => {
    const c = awal + naik * i
    const t = new Date(mulai + i * 86400_000).toISOString().slice(0, 10)
    return [t, c, c + lebar, c - lebar, c, 1000 + i] as BarisOhlc
  })
}

describe('rumus dasar', () => {
  it('SMA & EMA null kalau deret lebih pendek dari periodenya', () => {
    expect(sma([1, 2], 5)).toBeNull()
    expect(emaAkhir([1, 2], 5)).toBeNull()
  })

  it('SMA nilai tetap = nilainya sendiri', () => {
    expect(sma(new Array(20).fill(7), 20)).toBe(7)
    expect(emaAkhir(new Array(40).fill(7), 20)).toBeCloseTo(7, 9)
  })

  it('RSI: naik terus mendekati 100, turun terus mendekati 0', () => {
    expect(rsi(Array.from({ length: 60 }, (_, i) => 100 + i))!).toBeGreaterThan(95)
    expect(rsi(Array.from({ length: 60 }, (_, i) => 200 - i))!).toBeLessThan(5)
  })

  it('RSI deret datar = 50, bukan pembagian nol', () => {
    expect(rsi(new Array(40).fill(100))).toBe(50)
  })

  it('Stochastic: tutup di puncak rentang = 100, di dasar = 0', () => {
    const atas: BarisOhlc[] = Array.from({ length: 20 }, (_, i) => ['t', 0, 110, 90, i === 19 ? 110 : 100, 0])
    const bawah: BarisOhlc[] = Array.from({ length: 20 }, (_, i) => ['t', 0, 110, 90, i === 19 ? 90 : 100, 0])
    expect(stochK(atas)).toBe(100)
    expect(stochK(bawah)).toBe(0)
  })

  it('Stochastic rentang nol = 50 (netral), bukan NaN', () => {
    const rata: BarisOhlc[] = Array.from({ length: 20 }, () => ['t', 100, 100, 100, 100, 0])
    expect(stochK(rata)).toBe(50)
  })

  it('Williams %R adalah Stochastic digeser ke -100..0', () => {
    const b = deret(40, 100, 1)
    expect(williamsR(b)!).toBeCloseTo(stochK(b)! - 100, 9)
  })

  it('CCI deret datar = 0, bukan pembagian nol', () => {
    const rata: BarisOhlc[] = Array.from({ length: 30 }, () => ['t', 100, 100, 100, 100, 0])
    expect(cci(rata)).toBe(0)
  })

  it('MACD null kalau deret terlalu pendek; pada tren yang MEMPERCEPAT garis di atas sinyal', () => {
    expect(macd(Array.from({ length: 20 }, (_, i) => i))).toBeNull()
    // Sengaja mempercepat (i²), bukan lurus: pada garis lurus sempurna MACD
    // konstan, garis dan sinyalnya praktis sama, dan tandanya ditentukan
    // pembulatan — deret uji yang tak pernah terjadi di pasar sungguhan.
    const m = macd(Array.from({ length: 150 }, (_, i) => 100 + i * i * 0.02))!
    expect(m[0]).toBeGreaterThan(m[1])
  })
})

describe('labelSkor — ambang sama dengan Technical Rating', () => {
  it.each([
    [1, 'Strong Buy'], [0.5, 'Strong Buy'], [0.49, 'Buy'], [0.1, 'Buy'],
    [0.09, 'Neutral'], [0, 'Neutral'], [-0.09, 'Neutral'],
    [-0.1, 'Sell'], [-0.49, 'Sell'], [-0.5, 'Strong Sell'], [-1, 'Strong Sell'],
  ])('skor %s -> %s', (skor, label) => {
    expect(labelSkor(skor as number)).toBe(label)
  })
})

describe('skorTeknikal', () => {
  it('deret terlalu pendek = null, bukan skor dari data yang tak ada', () => {
    expect(skorTeknikal(deret(10))).toBeNull()
  })

  it('tren naik panjang: SELURUH rata-rata bergerak bullish, skor positif', () => {
    const h = skorTeknikal(deret(300, 100, 1))!
    expect(h.ma).toBe(1)
    expect(h.skor).toBeGreaterThan(0)
    expect(['Buy', 'Strong Buy']).toContain(h.label)
  })

  it('osilator MENAHAN skor saat tren naik — dan itu perilaku yang benar', () => {
    // Diukur, bukan diasumsikan: pada tren naik lurus panjang, 12 rata-rata
    // bergerak semuanya +1 sementara RSI/Stoch/W%R/CCI jenuh beli dan
    // menyumbang -1. Skor jatuh ke 0,444 (Buy), bukan Strong Buy.
    //
    // Itu memang cara Technical Rating bekerja dan alasannya masuk akal:
    // osilator mengukur kelelahan, bukan arah. Tren yang sudah jauh berjalan
    // TIDAK boleh terbaca sekuat tren yang baru mulai. Uji ini ada supaya
    // perilaku itu tak "diperbaiki" jadi Strong Buy oleh orang yang mengira
    // ini bug.
    const h = skorTeknikal(deret(300, 100, 1))!
    expect(h.osilator).toBeLessThan(0)
    expect(h.ma).toBe(1)
  })

  it('tren turun panjang: seluruh rata-rata bergerak bearish', () => {
    const h = skorTeknikal(deret(300, 500, -1))!
    expect(h.ma).toBe(-1)
    expect(h.skor).toBeLessThan(0)
    expect(['Sell', 'Strong Sell']).toContain(h.label)
  })

  it('komponen yang datanya belum cukup DIBUANG dari penyebut, bukan dihitung netral', () => {
    // 60 lilin: SMA/EMA 100 & 200 mustahil. Kalau keempatnya dihitung netral,
    // skor emiten baru akan selalu tertarik ke nol — itu keadaan DATANYA,
    // bukan keadaan pasarnya.
    const pendek = skorTeknikal(deret(60, 100, 1))!
    const panjang = skorTeknikal(deret(300, 100, 1))!
    expect(pendek.komponen.some((k) => k.nama === 'SMA 200')).toBe(false)
    expect(panjang.komponen.some((k) => k.nama === 'SMA 200')).toBe(true)
    expect(pendek.ma).toBe(1)
  })

  it('tiap komponen hanya bernilai -1, 0, atau 1', () => {
    for (const k of skorTeknikal(deret(300, 100, 1))!.komponen) {
      expect([-1, 0, 1]).toContain(k.bias)
    }
  })
})

describe('rakitPeriode', () => {
  it('pekanan: lima hari kerja jadi satu lilin, high/low/volume digabung', () => {
    const b = deret(5, 100, 1) // 2024-01-01 Senin .. 01-05 Jumat
    const p = rakitPeriode(b, 'pekan')
    expect(p).toHaveLength(1)
    expect(p[0][1]).toBe(b[0][1])
    expect(p[0][4]).toBe(b[4][4])
    expect(p[0][2]).toBe(Math.max(...b.map((x) => x[2])))
    expect(p[0][3]).toBe(Math.min(...b.map((x) => x[3])))
    expect(p[0][5]).toBe(b.reduce((a, x) => a + (x[5] ?? 0), 0))
  })

  it('pekan dikelompokkan menurut TANGGAL, bukan tiap 5 lilin', () => {
    // 8 hari beruntun melintasi akhir pekan -> 2 pekan, bukan 1 pekan + sisa.
    const p = rakitPeriode(deret(8, 100, 1), 'pekan')
    expect(p.length).toBe(2)
  })

  it('bulanan mengelompokkan per YYYY-MM', () => {
    const b = deret(70, 100, 1) // 1 Jan .. ~10 Mar
    const m = rakitPeriode(b, 'bulan')
    expect(m.length).toBe(3)
  })

  it('deret kosong tak melempar', () => {
    expect(rakitPeriode([], 'pekan')).toEqual([])
  })
})

describe('skorTigaKerangka & momentum', () => {
  it('tiga kerangka terisi pada deret panjang', () => {
    const t = skorTigaKerangka(deret(900, 100, 1))
    expect(t.harian).not.toBeNull()
    expect(t.pekanan).not.toBeNull()
    expect(t.bulanan).not.toBeNull()
  })

  it('kerangka bulanan null kalau lilin bulanannya belum cukup — bukan skor palsu', () => {
    const t = skorTigaKerangka(deret(120, 100, 1))
    expect(t.harian).not.toBeNull()
    expect(t.bulanan).toBeNull()
  })

  it('momentum = perubahan 10 hari bursa, null kalau deret lebih pendek', () => {
    const b = deret(MOMENTUM_HARI + 1, 100, 10)
    expect(momentumPersen(b)).toBeCloseTo((b.at(-1)![4] / b[0][4] - 1) * 100, 9)
    expect(momentumPersen(deret(5))).toBeNull()
  })
})
