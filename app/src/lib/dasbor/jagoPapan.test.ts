import { describe, expect, it } from 'vitest'
import {
  hitungBarisJagoPapan, saringTab, konfigTab, keCsvJagoPapan,
  TAB_JAGO_PAPAN, TAB_JAGO_PAPAN_BAWAAN, AMBANG_JAGO_PAPAN,
  type BarChartbit, type RowJagoPapan,
} from './jagoPapan'
// Arsip mentah diimpor sebagai modul JSON (resolveJsonModule) — bukan
// node:fs/path, tak dikenal tsconfig.app.json (browser-only types), sama
// pola harianPapan.test.ts. Regresi terhadap DATA NYATA, bukan fixture
// yang diketik ulang — "berjangkar pada mentahnya".
import packRaw from '../../../../data-idx/json/ohlcv_stockbit/PACK.json'
import pipaRaw from '../../../../data-idx/json/ohlcv_stockbit/PIPA.json'
import jarrRaw from '../../../../data-idx/json/ohlcv_stockbit/JARR.json'
import csmiRaw from '../../../../data-idx/json/ohlcv_stockbit/CSMI.json'
import viciRaw from '../../../../data-idx/json/ohlcv_stockbit/VICI.json'
import inetRaw from '../../../../data-idx/json/ohlcv_stockbit/INET.json'
import mejaRaw from '../../../../data-idx/json/ohlcv_stockbit/MEJA.json'
import niclRaw from '../../../../data-idx/json/ohlcv_stockbit/NICL.json'
import trinRaw from '../../../../data-idx/json/ohlcv_stockbit/TRIN.json'

const ARSIP: Record<string, unknown> = {
  PACK: packRaw, PIPA: pipaRaw, JARR: jarrRaw, CSMI: csmiRaw, VICI: viciRaw,
  INET: inetRaw, MEJA: mejaRaw, NICL: niclRaw, TRIN: trinRaw,
}

function bacaBar(kode: string): BarChartbit[] {
  return (ARSIP[kode] as { bar: BarChartbit[] }).bar
}

/** Potong deret sampai (termasuk) satu tanggal — sama pola pemanggil
 *  `bangunBarisHarianPapan` (bar terakhir larik = tanggal target). */
function sampaiTanggal(bar: BarChartbit[], tanggal: string): BarChartbit[] {
  const idx = bar.findIndex((b) => b[0] === tanggal)
  if (idx === -1) throw new Error(`tanggal ${tanggal} tak ada di arsip`)
  return bar.slice(0, idx + 1)
}

describe('hitungBarisJagoPapan — regresi Strong Uptrend 21 Agu 2026 (spek §Bukti)', () => {
  // PACK, PIPA, JARR, CSMI, VICI × 8 kolom = 40 angka, semua diverifikasi
  // manual terhadap arsip sebelum ditulis di sini (lihat laporan tugas).
  const acuan: Record<string, {
    harga: number; chg_1d: number; ma5: number; ma20: number
    mcap: number; value: number; volume: number; vol_ma20: number
  }> = {
    PACK: { harga: 386, chg_1d: 9.66, ma5: 335.6, ma20: 269.6, mcap: 13_162_506_578_350, value: 290_045_045_800, volume: 767_834_600, vol_ma20: 204_387_375 },
    PIPA: { harga: 179, chg_1d: 16.99, ma5: 144.6, ma20: 125.85, mcap: 613_271_397_010, value: 193_236_576_200, volume: 1_086_574_500, vol_ma20: 163_719_300 },
    JARR: { harga: 3070, chg_1d: 3.37, ma5: 2588.0, ma20: 2069.25, mcap: 28_338_141_703_500, value: 143_882_907_000, volume: 44_825_500, vol_ma20: 10_098_210 },
    CSMI: { harga: 167, chg_1d: 34.68, ma5: 133.8, ma20: 96.7, mcap: 136_282_270_500, value: 44_588_214_700, volume: 288_849_300, vol_ma20: 78_586_030 },
    VICI: { harga: 705, chg_1d: 4.44, ma5: 638.0, ma20: 601.75, mcap: 4_729_140_000_000, value: 5_448_322_500, volume: 7_717_500, vol_ma20: 1_579_700 },
  }

  for (const [kode, a] of Object.entries(acuan)) {
    it(`${kode} 2026-08-21 — 8 kolom cocok persis`, () => {
      const bar = sampaiTanggal(bacaBar(kode), '2026-08-21')
      const row = hitungBarisJagoPapan(kode, null, bar)
      expect(row).not.toBeNull()
      expect(row!.harga).toBe(a.harga)
      expect(row!.chg_1d).toBeCloseTo(a.chg_1d, 1)
      expect(row!.ma5).toBeCloseTo(a.ma5, 6)
      expect(row!.ma20).toBeCloseTo(a.ma20, 6)
      expect(row!.mcap).toBe(a.mcap)
      expect(row!.value).toBe(a.value)
      expect(row!.volume).toBe(a.volume)
      expect(row!.vol_ma20).toBeCloseTo(a.vol_ma20, 6)
    })
  }
})

describe('near52w — 4 emiten 2026-08-20 (spek §Bukti, kolom "kita")', () => {
  // Layar (alat lain) vs "kita": INET 0,46(0,46) · MEJA 0,72(0,75) ·
  // NICL 0,24(0,25) · TRIN 0,18(0,20) — kolom "kita" itu acuan uji ini,
  // formula close÷maxclose250 SENGAJA tak dibuat sama dgn layar (spek: sudah
  // dibandingkan 3 formula lain, close-vs-close paling dekat, dipakai apa
  // adanya + didokumentasikan bedanya, bukan dipaksa cocok).
  const acuan: Record<string, number> = { INET: 0.46, MEJA: 0.75, NICL: 0.25, TRIN: 0.20 }

  for (const [kode, target] of Object.entries(acuan)) {
    it(`${kode} 2026-08-20`, () => {
      const bar = sampaiTanggal(bacaBar(kode), '2026-08-20')
      const row = hitungBarisJagoPapan(kode, null, bar)
      expect(row!.near52w).not.toBeNull()
      expect(row!.near52w!).toBeCloseTo(target, 2)
    })
  }
})

describe('hitungBarisJagoPapan — kasus dasar', () => {
  it('null kalau deret kosong', () => {
    expect(hitungBarisJagoPapan('XXXX', null, [])).toBeNull()
  })

  it('beku = true kalau volume hari ini 0', () => {
    const bar: BarChartbit[] = [
      ['2026-08-24', 0, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 1000, 100000, 0, 0],
    ]
    const row = hitungBarisJagoPapan('XXXX', null, bar)
    expect(row!.beku).toBe(true)
  })

  it('ma20/vol_ma20 null kalau riwayat < 20 bar, chg_1d null kalau cuma 1 bar', () => {
    const bar: BarChartbit[] = [
      ['2026-08-24', 0, 100, 105, 99, 100, 1000, 100000, 10, 60, 40, 20, 0, 1000, 100000, 0, 10],
    ]
    const row = hitungBarisJagoPapan('XXXX', null, bar)
    expect(row!.ma20).toBeNull()
    expect(row!.vol_ma20).toBeNull()
    expect(row!.chg_1d).toBeNull()
    expect(row!.net_asing).toBe(20) // fb 60 - fs 40
    expect(row!.net_asing_streak).toBe(1) // 1 hari net beli
  })

  it('tembus_ma20_hari_ini: close > MA20 hari ini, kemarin close ≤ MA20 kemarin', () => {
    // 21 bar close datar 100, lalu bar terakhir naik ke 120 — MA20(kemarin,
    // 20 bar pertama)=100, close kemarin=100 (≤ MA20 kemarin) → tembus.
    const bar: BarChartbit[] = []
    for (let i = 0; i < 20; i++) {
      bar.push([`d${i}`, 0, 100, 100, 100, 100, 1000, 100000, 10, 0, 0, 0, 0, 1000, 100000, 0, 10])
    }
    bar.push(['d20', 0, 100, 120, 100, 120, 1000, 100000, 10, 0, 0, 0, 0, 1000, 100000, 0, 10])
    const row = hitungBarisJagoPapan('XXXX', null, bar)
    expect(row!.tembus_ma20_hari_ini).toBe(true)
  })

  it('net_asing_streak bertanda: beruntun jual = negatif', () => {
    const bar: BarChartbit[] = [
      ['d0', 0, 100, 100, 100, 100, 1000, 100000, 10, 10, 50, -40, 0, 1000, 100000, 0, 10], // net -40
      ['d1', 0, 100, 100, 100, 100, 1000, 100000, 10, 10, 60, -100, 0, 1000, 100000, 0, 10], // net -50
      ['d2', 0, 100, 100, 100, 100, 1000, 100000, 10, 30, 20, -90, 0, 1000, 100000, 0, 10], // net +10 (memutus streak)
    ]
    expect(hitungBarisJagoPapan('X', null, [bar[0]])!.net_asing_streak).toBe(-1)
    expect(hitungBarisJagoPapan('X', null, bar.slice(0, 2))!.net_asing_streak).toBe(-2)
    expect(hitungBarisJagoPapan('X', null, bar)!.net_asing_streak).toBe(1)
  })
})

describe('empat tab — default state & saring (spek §Halaman)', () => {
  it('tab bawaan = Strong Uptrend (tab pertama sesuai tangkapan layar)', () => {
    expect(TAB_JAGO_PAPAN_BAWAAN).toBe('strong-uptrend')
    expect(TAB_JAGO_PAPAN[0].id).toBe('strong-uptrend')
  })

  it('urutan & urut-bawaan 4 tab persis spek', () => {
    expect(TAB_JAGO_PAPAN.map((t) => t.id)).toEqual([
      'strong-uptrend', 'breakout', 'early-breakout', 'foreign-flow-uptrend',
    ])
    expect(konfigTab('strong-uptrend').urutBawaan).toBe('value')
    expect(konfigTab('breakout').urutBawaan).toBe('volume')
    expect(konfigTab('early-breakout').urutBawaan).toBe('volume')
    expect(konfigTab('foreign-flow-uptrend').urutBawaan).toBe('foreign_flow_kum')
  })

  function baris(o: Partial<RowJagoPapan>): RowJagoPapan {
    return {
      kode: 'X', nama: null, harga: 100, chg_1d: 1, ma5: 90, ma20: 90, mcap: 2_000_000_000_000,
      value: 3_000_000_000, volume: 1000, vol_ma20: 500, near52w: 0.9, net_asing: 100,
      net_asing_ma10: 50, net_asing_streak: 3, foreign_flow_kum: 1000, foreign_flow_ma20: 500,
      tembus_ma20_hari_ini: true, beku: false, ...o,
    }
  }

  it('Strong Uptrend: lolos syarat close>MA20, value>2M, mcap>1T; gagal salah satu = tersaring', () => {
    const lolos = baris({})
    expect(saringTab([lolos], 'strong-uptrend')).toHaveLength(1)
    expect(saringTab([baris({ value: 1_000_000_000 })], 'strong-uptrend')).toHaveLength(0)
    expect(saringTab([baris({ mcap: 500_000_000_000 })], 'strong-uptrend')).toHaveLength(0)
    expect(saringTab([baris({ harga: 80 })], 'strong-uptrend')).toHaveLength(0) // close < MA20
    expect(saringTab([baris({ beku: true })], 'strong-uptrend')).toHaveLength(0)
  })

  it('Breakout: butuh tembus hari ini + volume>volMA20 + return positif', () => {
    expect(saringTab([baris({})], 'breakout')).toHaveLength(1)
    expect(saringTab([baris({ tembus_ma20_hari_ini: false })], 'breakout')).toHaveLength(0)
    expect(saringTab([baris({ volume: 400 })], 'breakout')).toHaveLength(0) // < vol_ma20
    expect(saringTab([baris({ chg_1d: -1 })], 'breakout')).toHaveLength(0)
  })

  it('Early Breakout: volume harus > 2x volume MA20 (strict), tepat 2x belum lolos', () => {
    expect(saringTab([baris({ volume: 1000, vol_ma20: 500 })], 'early-breakout')).toHaveLength(0) // tepat 2x, strict >
    expect(saringTab([baris({ volume: 1001, vol_ma20: 500 })], 'early-breakout')).toHaveLength(1)
    expect(saringTab([baris({ volume: 999, vol_ma20: 500 })], 'early-breakout')).toHaveLength(0)
    expect(AMBANG_JAGO_PAPAN.multipel_early_breakout).toBe(2)
  })

  it('Foreign Flow Uptrend: butuh net>0, net>MA10, kumulatif>MA20-nya, streak>=2', () => {
    expect(saringTab([baris({})], 'foreign-flow-uptrend')).toHaveLength(1)
    expect(saringTab([baris({ net_asing: -1 })], 'foreign-flow-uptrend')).toHaveLength(0)
    expect(saringTab([baris({ net_asing: 40, net_asing_ma10: 50 })], 'foreign-flow-uptrend')).toHaveLength(0)
    expect(saringTab([baris({ foreign_flow_kum: 400, foreign_flow_ma20: 500 })], 'foreign-flow-uptrend')).toHaveLength(0)
    expect(saringTab([baris({ net_asing_streak: 1 })], 'foreign-flow-uptrend')).toHaveLength(0)
    expect(AMBANG_JAGO_PAPAN.streak_min).toBe(2)
  })
})

describe('keCsvJagoPapan', () => {
  it('header + satu baris, koma-dipisah', () => {
    const row: RowJagoPapan = {
      kode: 'BUMI', nama: 'Bumi Resources', harga: 100, chg_1d: 1.5, ma5: 95, ma20: 90,
      mcap: 1_000_000_000_000, value: 2_000_000_000, volume: 1000, vol_ma20: 500,
      near52w: 0.8, net_asing: 100, net_asing_ma10: 50, net_asing_streak: 3,
      foreign_flow_kum: 1000, foreign_flow_ma20: 500, tembus_ma20_hari_ini: true, beku: false,
    }
    const csv = keCsvJagoPapan([row])
    const [header, baris1] = csv.split('\n')
    expect(header).toBe('kode,nama,harga,chg_1d,ma5,ma20,mcap,value,volume,vol_ma20,near52w,net_asing,net_asing_ma10,net_asing_streak,foreign_flow_kum,foreign_flow_ma20')
    expect(baris1).toBe('BUMI,Bumi Resources,100,1.5,95,90,1000000000000,2000000000,1000,500,0.8,100,50,3,1000,500')
  })
})
