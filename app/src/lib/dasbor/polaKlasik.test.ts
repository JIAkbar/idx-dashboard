import { describe, expect, it } from 'vitest'
import type { LilinData } from './grafikEmiten'
import {
  PARAM_POLA_KLASIK_BAWAAN, cariPolaKlasik, type ParamPolaKlasik,
} from './polaKlasik'

/** Lilin dari deret penutupan — rentang tiap lilin ±1 supaya ATR-nya hidup
 *  tapi kecil, dan pivot jatuh persis di angka yang dirancang uji. */
function lilinDari(tutup: number[]): LilinData[] {
  return tutup.map((c, i) => ({
    time: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
    open: c, high: c + 1, low: c - 1, close: c,
  }))
}

/** Deret linier `dari` → `ke` sepanjang `n` titik (ujung awal TIDAK ikut —
 *  enak dirangkai: [...naik(50,100,10), ...turun(100,85,5)]). */
function jalan(dari: number, ke: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => dari + ((ke - dari) * (i + 1)) / n)
}

const P: ParamPolaKlasik = { jendela: 2, ayunMin: 5, atr: 5, toleransi: 1, tunggu: 25, tiang: 20, tiangAtr: 4 }

describe('cariPolaKlasik — bentuk sintetis yang dirancang', () => {
  it('Double Top: dua puncak setara, selesai saat leher patah', () => {
    const tutup = [50, ...jalan(50, 100, 15), ...jalan(100, 85, 6), ...jalan(85, 100, 6),
      ...jalan(100, 80, 8), ...jalan(80, 78, 6)]
    const pola = cariPolaKlasik(lilinDari(tutup), P)
    const dt = pola.find((q) => q.nama === 'double-top')
    expect(dt).toBeDefined()
    expect(dt!.arah).toBe('bearish')
    // Sinyal = penutupan PERTAMA di bawah lembah antar puncak (85) yang
    // sudah melewati konfirmasi pivot — bukan lilin puncak keduanya.
    expect(dt!.hargaSinyal).toBeLessThan(85)
  })

  it('Double Bottom: cermin persisnya', () => {
    const tutup = [150, ...jalan(150, 100, 15), ...jalan(100, 115, 6), ...jalan(115, 100, 6),
      ...jalan(100, 120, 8), ...jalan(120, 122, 6)]
    const db = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'double-bottom')
    expect(db).toBeDefined()
    expect(db!.arah).toBe('bullish')
    expect(db!.hargaSinyal).toBeGreaterThan(115)
  })

  it('Head & Shoulders: kepala menjulang, bahu setara, leher miring patah', () => {
    const tutup = [50,
      ...jalan(50, 100, 10),   // bahu kiri 100
      ...jalan(100, 80, 5),
      ...jalan(80, 130, 8),    // kepala 130
      ...jalan(130, 82, 8),
      ...jalan(82, 101, 6),    // bahu kanan ~101
      ...jalan(101, 70, 10),   // patah leher
      ...jalan(70, 68, 6)]
    const hs = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'head-shoulders')
    expect(hs).toBeDefined()
    expect(hs!.arah).toBe('bearish')
    // Lima pivot: H-L-H-L-H, kepala = pivot ketiga.
    expect(hs!.pivot).toHaveLength(5)
    expect(hs!.pivot[2].harga).toBeGreaterThan(hs!.pivot[0].harga)
    expect(hs!.pivot[2].harga).toBeGreaterThan(hs!.pivot[4].harga)
    // Garis: kerangka pivot + leher (dua garis).
    expect(hs!.garis.length).toBe(2)
    expect(hs!.garis[0]).toHaveLength(5)
  })

  it('Triple Bottom: tiga lembah setara, selesai menembus puncak antar lembah', () => {
    // Puncak antarlembah SENGAJA beda jelas (112 vs 104): kalau keduanya
    // ikut setara, polanya memang Rectangle — dan Rectangle menang atas
    // Triple (lihat komentar `cobaRectangle`). Uji ini tentang Triple murni.
    const tutup = [150,
      ...jalan(150, 100, 10),
      ...jalan(100, 112, 5), ...jalan(112, 100.5, 5),
      ...jalan(100.5, 104, 5), ...jalan(104, 99.5, 5),
      ...jalan(99.5, 118, 8), ...jalan(118, 120, 6)]
    const tb = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'triple-bottom')
    expect(tb).toBeDefined()
    expect(tb!.arah).toBe('bullish')
    expect(tb!.hargaSinyal).toBeGreaterThan(112)
  })

  it('Rising Wedge: dua garis naik menyempit, selesai jatuh dari garis bawah', () => {
    // Puncak: 110→114→117 (melambat), lembah: 100→106→112 (lebih curam) —
    // menyempit; lalu penutupan jatuh menembus garis lembah.
    const tutup = [95,
      ...jalan(95, 110, 6), ...jalan(110, 100, 4),
      ...jalan(100, 114, 5), ...jalan(114, 106, 4),
      ...jalan(106, 117, 5), ...jalan(117, 112, 4),
      ...jalan(112, 95, 8), ...jalan(95, 93, 6)]
    const rw = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'rising-wedge')
    expect(rw).toBeDefined()
    expect(rw!.arah).toBe('bearish')
    // Tiga garis: kerangka + garis atas + garis bawah.
    expect(rw!.garis.length).toBe(3)
  })

  it('Expanding Triangle: puncak meninggi & lembah merendah, arah dari patahan', () => {
    const tutup = [100,
      ...jalan(100, 110, 5), ...jalan(110, 95, 5),
      ...jalan(95, 118, 6), ...jalan(118, 88, 6),
      ...jalan(88, 126, 7),
      ...jalan(126, 70, 12), ...jalan(70, 68, 6)]
    const ex = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'expanding-triangle')
    expect(ex).toBeDefined()
    // Patahan yang datang: jatuh menembus garis lembah — bearish.
    expect(ex!.arah).toBe('bearish')
  })

  it('Bullish Flag: tiang naik tajam lalu kanal turun sejajar, patah ke atas', () => {
    const tutup = [50,
      ...jalan(50, 150, 20),  // tiang: naik tajam ≥4×ATR, berakhir di pivot pertama jendela
      ...jalan(150, 135, 4), ...jalan(135, 144, 3),  // kanal turun sejajar
      ...jalan(144, 128, 4), ...jalan(128, 136, 3),
      ...jalan(136, 120, 4),  // jeda sebelum patah
      ...jalan(120, 160, 8)]  // patah ke atas garis kanal
    const bf = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'bullish-flag')
    expect(bf).toBeDefined()
    expect(bf!.arah).toBe('bullish')
    expect(bf!.garis.length).toBe(3)
  })

  it('Ascending Triangle: atap datar, lantai naik, tanpa syarat tiang', () => {
    const tutup = [95,
      ...jalan(95, 85, 6),    // pivot pertama jendela — indeksnya kecil, tiang otomatis gagal
      ...jalan(85, 100, 6),
      ...jalan(100, 90, 5),
      ...jalan(90, 100, 5),
      ...jalan(100, 94, 5),
      ...jalan(94, 105, 6)]   // patah ke atas atap 100
    const at = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'ascending-triangle')
    expect(at).toBeDefined()
    expect(at!.arah).toBe('bullish')
    expect(at!.hargaSinyal).toBeGreaterThan(100)
  })

  it('Symmetrical Triangle: puncak menurun & lembah menaik tanpa tiang, patah ke bawah', () => {
    const tutup = [90,
      ...jalan(90, 112, 5),
      ...jalan(112, 82, 5),
      ...jalan(82, 104, 4),
      ...jalan(104, 94, 4),
      ...jalan(94, 100, 4),   // pivot kelima jendela: puncak 112→104→100, lembah 82→94
      ...jalan(100, 70, 8)]   // patah ke bawah garis lembah, bukan garis puncak
    const st = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'symmetrical-triangle')
    expect(st).toBeDefined()
    expect(st!.arah).toBe('bearish')
  })
})

describe('Rectangle & Cup and Handle — pola penutup daftar TradingView (B37)', () => {
  it('Rectangle: atap & lantai datar, arah dari patahan yang datang lebih dulu', () => {
    // Kotak 100/85 (lima pivot berseling setara), lalu jatuh menembus lantai.
    const tutup = [92,
      ...jalan(92, 100, 4), ...jalan(100, 85, 5), ...jalan(85, 99.5, 5),
      ...jalan(99.5, 85.5, 5), ...jalan(85.5, 100.3, 5),
      ...jalan(100.3, 78, 8), ...jalan(78, 76, 6)]
    const rk = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'rectangle')
    expect(rk).toBeDefined()
    expect(rk!.arah).toBe('bearish')
    // Tiga garis: kerangka + atap + lantai.
    expect(rk!.garis.length).toBe(3)
  })

  it('Cup & Handle: cangkir >= 20 bar berbibir setara + handle di paruh atas, tembus bibir', () => {
    // Bibir kiri 100 -> dasar 80 (turun-naik landai >= 20 bar) -> bibir kanan
    // 100 -> handle ke 93 (paruh atas) -> tembus 100.
    const tutup = [70, ...jalan(70, 100, 6),
      ...jalan(100, 80, 12), ...jalan(80, 99.5, 12),
      ...jalan(99.5, 93, 4), ...jalan(93, 106, 6), ...jalan(106, 107, 4)]
    const ch = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'cup-handle')
    expect(ch).toBeDefined()
    expect(ch!.arah).toBe('bullish')
    expect(ch!.hargaSinyal).toBeGreaterThan(100)
    // Target = kedalaman cangkir diproyeksikan dari bibir.
    expect(ch!.target).toBeGreaterThan(ch!.hargaSinyal)
  })

  it('cangkir yang lebarnya < 20 bar DITOLAK — spek TradingView', () => {
    const tutup = [70, ...jalan(70, 100, 4),
      ...jalan(100, 80, 5), ...jalan(80, 99.5, 5),
      ...jalan(99.5, 93, 3), ...jalan(93, 106, 5)]
    expect(cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'cup-handle')).toBeUndefined()
  })
})

describe('target & status — spek TradingView (docs/riset/spek-pola-tradingview.md)', () => {
  it('Double Top: target = jangkar leher − tinggi pola, dan deret yang jatuh dalam mencapainya', () => {
    // Puncak ±100, leher 85 → tinggi ±15, target ±70. Deret lalu jatuh ke 66:
    // target TERSENTUH.
    const tutup = [50, ...jalan(50, 100, 15), ...jalan(100, 85, 6), ...jalan(85, 100, 6),
      ...jalan(100, 66, 14), ...jalan(66, 65, 6)]
    const dt = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'double-top')!
    expect(dt.target).toBeLessThan(dt.hargaSinyal)
    // Tinggi pola = rentang pivot (puncak − leher), diproyeksikan turun.
    const maksP = Math.max(...dt.pivot.map((x) => x.harga))
    const minP = Math.min(...dt.pivot.map((x) => x.harga))
    expect(dt.target).toBeCloseTo(minP - (maksP - minP), 0)
    expect(dt.status).toBe('tercapai')
    expect(dt.iStatus).not.toBeNull()
  })

  it('GAGAL saat penutupan melewati puncak lagi sebelum target', () => {
    // Patah leher sedikit, lalu berbalik NAIK melewati kedua puncak.
    const tutup = [50, ...jalan(50, 100, 15), ...jalan(100, 85, 6), ...jalan(85, 100, 6),
      ...jalan(100, 82, 8), ...jalan(82, 112, 10), ...jalan(112, 113, 4)]
    const dt = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'double-top')!
    expect(dt.status).toBe('gagal')
    // Pembatalnya ekstrem pola: melewati puncak tertinggi.
    expect(dt.batal).toBeCloseTo(Math.max(...dt.pivot.map((x) => x.harga)), 6)
  })

  it('MENUNGGU selagi belum menyentuh target dan belum melewati pembatal', () => {
    // Patah leher lalu bergerak datar — tak sampai target, tak membatalkan.
    const tutup = [50, ...jalan(50, 100, 15), ...jalan(100, 85, 6), ...jalan(85, 100, 6),
      ...jalan(100, 82, 8), ...jalan(82, 81, 8)]
    const dt = cariPolaKlasik(lilinDari(tutup), P).find((q) => q.nama === 'double-top')!
    expect(dt.status).toBe('menunggu')
    expect(dt.iStatus).toBeNull()
  })

  it('arah target konsisten untuk SEMUA pola: bearish di bawah sinyal, bullish di atas', () => {
    const pola = cariPolaKlasik(ombakUji(), { ...PARAM_POLA_KLASIK_BAWAAN, jendela: 3, ayunMin: 2 })
    expect(pola.length).toBeGreaterThan(0)
    for (const q of pola) {
      if (q.arah === 'bearish') {
        expect(q.target).toBeLessThan(q.hargaSinyal)
        expect(q.batal).toBeGreaterThanOrEqual(Math.max(...q.pivot.map((x) => x.harga)) - 1e-9)
      } else {
        expect(q.target).toBeGreaterThan(q.hargaSinyal)
      }
      // iStatus, kalau ada, selalu SESUDAH sinyal — status tak pernah lahir
      // dari lilin yang mendahului polanya sendiri.
      if (q.iStatus !== null) expect(q.iStatus).toBeGreaterThan(q.iSinyal)
    }
  })
})

/** Deret gelombang deterministik yang cukup kaya untuk memunculkan
 *  beberapa pola sekaligus — bahan uji invarian, bukan uji bentuk. */
function ombakUji(): LilinData[] {
    const tutup: number[] = []
    let p = 1000
    for (let i = 0; i < 500; i++) {
      p = Math.max(100, p + Math.sin(i / 6) * 24 + Math.cos(i / 17) * 15 + Math.sin(i / 43) * 9)
      tutup.push(p)
    }
  return lilinDari(tutup)
}

describe('cariPolaKlasik — invarian yang menjaga kejujurannya', () => {
  const ombak = ombakUji

  it('bebas bocor masa depan: sinyal selalu >= pivot terakhir + jendela', () => {
    const lilin = ombak()
    for (const jendela of [2, 3, 5]) {
      const pola = cariPolaKlasik(lilin, { ...PARAM_POLA_KLASIK_BAWAAN, jendela, ayunMin: 2 })
      for (const q of pola) {
        const akhir = q.pivot[q.pivot.length - 1]
        expect(q.iSinyal).toBeGreaterThanOrEqual(akhir.i + jendela)
      }
    }
  })

  it('sinyal tak pernah lebih jauh dari `tunggu` sesudah konfirmasi', () => {
    const p = { ...PARAM_POLA_KLASIK_BAWAAN, jendela: 3, ayunMin: 2, tunggu: 15 }
    for (const q of cariPolaKlasik(ombak(), p)) {
      const akhir = q.pivot[q.pivot.length - 1]
      expect(q.iSinyal).toBeLessThan(akhir.i + p.jendela + p.tunggu)
    }
  })

  it('garis pertama selalu kerangka pivotnya sendiri', () => {
    const pola = cariPolaKlasik(ombak(), { ...PARAM_POLA_KLASIK_BAWAAN, jendela: 3, ayunMin: 2 })
    expect(pola.length).toBeGreaterThan(0)
    for (const q of pola) {
      expect(q.garis[0].map((t) => t.i)).toEqual(q.pivot.map((x) => x.i))
      // Tiap garis minimal dua titik — garis satu titik tak tergambar.
      for (const g of q.garis) expect(g.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('urut menurut lilin sinyal, dan pivot pola 5-titik tak dipakai double lagi', () => {
    const pola = cariPolaKlasik(ombak(), { ...PARAM_POLA_KLASIK_BAWAAN, jendela: 3, ayunMin: 2 })
    for (let i = 1; i < pola.length; i++) expect(pola[i].iSinyal).toBeGreaterThanOrEqual(pola[i - 1].iSinyal)
    const lima = new Set(pola.filter((q) => q.pivot.length === 5).flatMap((q) => q.pivot.map((x) => x.i)))
    for (const q of pola.filter((x) => x.pivot.length === 3)) {
      for (const x of q.pivot) expect(lima.has(x.i)).toBe(false)
    }
  })

  it('deret kosong & deret pendek tak melempar', () => {
    expect(cariPolaKlasik([], PARAM_POLA_KLASIK_BAWAAN)).toEqual([])
    expect(cariPolaKlasik(lilinDari([100, 101, 102]), PARAM_POLA_KLASIK_BAWAAN)).toEqual([])
  })
})
