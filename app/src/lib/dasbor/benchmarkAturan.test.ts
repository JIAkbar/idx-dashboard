import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beliTahan, lebihDariBeliTahan, pelemahanPct, barisRezim, type BenchmarkAturan } from './benchmarkAturan'

/**
 * Penjaga panel Uji Aturan. Dua hal dijaga, dan keduanya pernah gagal senyap
 * di proyek ini:
 *
 * 1. **Pembanding beli-lalu-tahan tak boleh hilang dari data.** Tanpa angka
 *    itu, panel memajang "aturan ini memberi sekian" di periode pasar yang
 *    sedang naik dan pembacanya menyimpulkan aturannya berhasil. Uji ini
 *    memaksa angkanya ada, dan memaksa `beliTahan()` mengembalikan `null`
 *    (bukan 0) untuk kombinasi yang tak diukur — nol terbaca sebagai "pasar
 *    datar", padahal artinya "belum diukur".
 * 2. **Istilah mesin tak boleh tayang.** Halaman Metodologi pernah terbit
 *    dengan nama berkas internal tercetak di layar publik.
 */
const DIR = dirname(fileURLToPath(import.meta.url))
const AKAR = join(DIR, '..', '..', '..', '..')
const DATA: BenchmarkAturan = JSON.parse(
  readFileSync(join(AKAR, 'data-idx', 'json', 'benchmark_aturan.json'), 'utf8'),
)

describe('benchmark aturan — bentuk data', () => {
  it('memuat aturan produksi supaya ada acuan yang bisa dibandingkan', () => {
    expect(DATA.aturan.some((a) => a.id === 'atr-produksi')).toBe(true)
  })

  it('tiap aturan punya risiko > 0 — pembagi eksR tak boleh nol', () => {
    for (const a of DATA.aturan) expect(a.risiko).toBeGreaterThan(0)
  })

  it('eksR memang ekspektansi dibagi risiko, bukan angka lain', () => {
    for (const a of DATA.aturan) {
      expect(a.eksR).toBeCloseTo(a.eks / a.risiko, 2)
    }
  })

  it('win rate dan hasil-per-risiko memberi peringkat BERBEDA', () => {
    // Kalau keduanya sama urutannya, panel ini tak perlu ada — cukup pakai
    // win rate. Terukur berbeda, dan itu justru alasan panelnya dibuat.
    const urutWr = [...DATA.aturan].sort((a, b) => b.wr - a.wr).map((a) => a.id)
    const urutEks = [...DATA.aturan].sort((a, b) => b.eksR - a.eksR).map((a) => a.id)
    expect(urutWr).not.toEqual(urutEks)
  })
})

describe('pembanding beli-lalu-tahan — wajib ada', () => {
  it('terukur untuk saringan "semua" di tiap horizon', () => {
    for (const h of DATA.cakupan.horizon) {
      expect(beliTahan(DATA, 'semua', h)).not.toBeNull()
    }
  })

  it('POSITIF di periode ini — itu sebabnya ia wajib tampil', () => {
    // Pasar naik selama rentang uji. Aturan mana pun akan terlihat berhasil
    // kalau angka ini disembunyikan.
    expect(beliTahan(DATA, 'semua', 5)!).toBeGreaterThan(0)
    expect(beliTahan(DATA, 'tersusun', 5)!).toBeGreaterThan(beliTahan(DATA, 'semua', 5)!)
  })

  it('mengembalikan null (BUKAN 0) untuk kombinasi yang tak diukur', () => {
    expect(beliTahan(DATA, 'saringan-yang-tak-ada', 5)).toBeNull()
    expect(beliTahan(DATA, 'semua', 999)).toBeNull()
  })

  it('lebihDariBeliTahan mengurangkan, bukan membandingkan peringkat', () => {
    const prod = DATA.produksi.find((p) => p.horizon === 5)!
    const bt = beliTahan(DATA, 'semua', 5)!
    expect(lebihDariBeliTahan(DATA, prod.eks, 5)).toBeCloseTo(prod.eks - bt, 6)
  })
})

describe('ketahanan & pelemahan', () => {
  it('korelasi antar paruh tercatat — tanpa itu sel terbaik cuma undian', () => {
    expect(DATA.ketahanan.rho).toBeGreaterThan(0)
    expect(DATA.ketahanan.jarakSD).toBeGreaterThanOrEqual(0)
  })

  it('SELURUH keluarga melemah di paruh akhir — pasarnya yang berubah', () => {
    for (const k of DATA.keluarga) {
      const turun = pelemahanPct(k)
      expect(turun).not.toBeNull()
      expect(turun!).toBeGreaterThan(0)
    }
  })
})

describe('tak membocorkan istilah mesin ke layar', () => {
  it('nama aturan yang dibaca pengguna bebas istilah mesin', () => {
    const terlarang = /ATR\b|EMA\d|atr-|ema\d|pct-|low\d|_|\.json|\.ts\b/
    const bocor = DATA.aturan.map((a) => a.nama).filter((n) => terlarang.test(n))
    expect(bocor).toEqual([])
  })

  it('komponen panel tak menyebut nama berkas atau endpoint', () => {
    const src = readFileSync(join(DIR, '..', '..', 'components', 'dasbor', 'UjiAturan.tsx'), 'utf8')
    const jsx = src.slice(src.lastIndexOf('*/') + 2)
    for (const r of [/benchmark_aturan\.py/, /getstocksummary/i, /chartbit/i, /data-idx/]) {
      expect(jsx).not.toMatch(r)
    }
  })
})

// ── Selisih terhadap pasar ──────────────────────────────────────────────────
const SEL = JSON.parse(
  readFileSync(join(AKAR, 'data-idx', 'json', 'selisih_pasar.json'), 'utf8'),
) as import('./benchmarkAturan').SelisihPasar

describe('selisih terhadap pasar', () => {
  it('baris KONTROL nol — kalau tidak, pengukurannya yang rusak', () => {
    // Seluruh emiten dibanding mediannya sendiri harus nol menurut definisi.
    // Ini satu-satunya bukti bahwa angka di baris lain terkalibrasi; kalau ia
    // bergeser, temuan apa pun di baris lain tak boleh dipercaya.
    for (const b of SEL.baris.filter((x) => x.saringan === 'semua')) {
      expect(Math.abs(b.median)).toBeLessThan(0.05)
    }
  })

  it('tiap saringan punya ketiga rezim, bukan cuma yang enak dilihat', () => {
    for (const s of SEL.urutan) {
      const rz = barisRezim(SEL, s, 5).map((b) => b.rezim)
      expect(rz).toEqual(['turun', 'datar', 'naik'])
    }
  })

  it('tren tersusun unggul, dan paling unggul saat pasar TURUN', () => {
    const [turun, datar, naik] = barisRezim(SEL, 'tersusun', 5)
    expect(turun.median).toBeGreaterThan(0)
    expect(turun.median).toBeGreaterThan(naik.median)
    expect(datar.median).toBeGreaterThan(0)
  })

  it('vs IHSG dilaporkan APA ADANYA walau negatif', () => {
    // Ia negatif di data ini, dan itu justru wajib tampil: memilih hanya
    // pembanding yang menguntungkan adalah bentuk kebohongan yang paling
    // gampang lolos review.
    const b = barisRezim(SEL, 'tersusun', 5)[0]
    expect(b.vsIhsg).not.toBeNull()
    expect(typeof b.vsIhsg).toBe('number')
  })

  it('tiap sel membawa n-nya sendiri — angka tanpa penyebut tak sah', () => {
    for (const b of SEL.baris) expect(b.n).toBeGreaterThanOrEqual(100)
  })
})
