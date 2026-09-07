import { describe, it, expect } from 'vitest'
import {
  LEBAR_GARIS_PENUH,
  MAKS_GARIS,
  MAKS_GARIS_SEMPIT,
  maksGaris,
  PALET_GARIS,
  brokerAktif,
  pilihGarisBroker,
  sisiBroker,
} from './pilihGarisBroker'
import type { AgregatBroker, HariBroker } from './brokerEmiten'

/** sRGB hex → CIE Lab (D65). Dipakai hanya oleh uji palet. */
function lab(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const kanal = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = kanal.map(lin)
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const [fx, fy, fz] = [f(X), f(Y), f(Z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function deltaE(a: string, b: string): number {
  const [la, lb] = [lab(a), lab(b)]
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2])
}

/** Warna lilin naik & turun — sudah punya arti di kanvas yang sama. */
const HIJAU_LILIN = '#38B77E'
const MERAH_LILIN = '#E6635A'

function ag(broker: string, netNilai: number, beliAvg: number | null = 100): AgregatBroker {
  return {
    broker,
    beliLot: 1000, beliNilai: Math.max(netNilai, 0) + 1_000_000,
    jualLot: 0, jualNilai: 0,
    netLot: 0, netNilai,
    beliAvg, jualAvg: null,
  }
}

function hari(tgl: string, kode: string[]): [string, HariBroker] {
  return [tgl, {
    ringkas: {} as HariBroker['ringkas'],
    broker: kode.map((k) => [k, 1, 1, 0, 0] as HariBroker['broker'][number]),
  }]
}

describe('palet garis AVG broker (#46)', () => {
  it('delapan warnanya saling terbedakan — ΔE ≥ 30 untuk tiap pasangan', () => {
    // Ini kriteria terima yang Johan bisa jalankan sendiri, dan alasan palet
    // lama gugur: warna dari kelompok identitas membuat dua broker sekelompok
    // ber-ΔE NOL.
    let terdekat = Infinity
    let pasangan = ''
    for (let i = 0; i < PALET_GARIS.length; i++) {
      for (let j = i + 1; j < PALET_GARIS.length; j++) {
        const d = deltaE(PALET_GARIS[i], PALET_GARIS[j])
        if (d < terdekat) { terdekat = d; pasangan = `${PALET_GARIS[i]}/${PALET_GARIS[j]}` }
      }
    }
    expect(terdekat, `pasangan terdekat ${pasangan}`).toBeGreaterThanOrEqual(30)
  })

  it('tak satu pun mendekati hijau/merah lilin — warna arah harga tak boleh dipinjam', () => {
    for (const w of PALET_GARIS) {
      expect(deltaE(w, HIJAU_LILIN), w).toBeGreaterThanOrEqual(30)
      expect(deltaE(w, MERAH_LILIN), w).toBeGreaterThanOrEqual(30)
    }
  })

  it('palet memuat cukup warna untuk batas garis tampak', () => {
    expect(PALET_GARIS.length).toBeGreaterThanOrEqual(MAKS_GARIS)
  })
})

describe('sisiBroker', () => {
  it('kelompok asing terkurasi jadi sisi asing', () => {
    for (const k of ['AK', 'BK', 'ZP', 'YU']) expect(sisiBroker(k)).toBe('asing')
  })

  it('BB LOKAL — Verdhana 100% domestik walau namanya terdengar asing', () => {
    expect(sisiBroker('BB')).toBe('lokal')
  })

  it('kode yang belum dikurasi terbaca lokal, bukan galat', () => {
    expect(sisiBroker('ZZZ')).toBe('lokal')
  })
})

describe('brokerAktif', () => {
  it('hanya melihat jendela hari bursa TERAKHIR, bukan seluruh rentang', () => {
    const deret = [
      hari('2026-01-05', ['GW', 'XL']),
      hari('2026-08-03', ['XL']),
      hari('2026-08-04', ['XL', 'AK']),
    ]
    const aktif = brokerAktif(deret, 2)
    expect(aktif.has('XL')).toBe(true)
    expect(aktif.has('AK')).toBe(true)
    // GW berhenti bertransaksi Januari — garisnya akan berdiri di kanvas
    // seolah ada yang mengakumulasi hari ini.
    expect(aktif.has('GW')).toBe(false)
  })
})

describe('pilihGarisBroker', () => {
  const semuaAktif = new Set(['XL', 'PD', 'YP', 'SQ', 'LG', 'AK', 'BK', 'ZP', 'YU', 'RX'])

  it('dua peringkat terpisah — asing tidak tenggelam oleh nilai ritel', () => {
    const agg = [
      ag('XL', 900), ag('PD', 800), ag('YP', 700), ag('SQ', 600), ag('LG', 500),
      ag('AK', 40), ag('BK', 30), ag('ZP', 20),
    ]
    const g = pilihGarisBroker(agg, semuaAktif)
    const asing = g.filter((x) => x.sisi === 'asing').map((x) => x.broker)
    expect(asing).toEqual(['AK', 'BK', 'ZP'])
  })

  it('potongan 8 berselang — bukan lima lokal lalu sisa asing', () => {
    const agg = [
      ag('XL', 900), ag('PD', 800), ag('YP', 700), ag('SQ', 600), ag('LG', 500),
      ag('AK', 40), ag('BK', 30), ag('ZP', 20), ag('YU', 10), ag('RX', 5),
    ]
    const g = pilihGarisBroker(agg, semuaAktif)
    expect(g).toHaveLength(MAKS_GARIS)
    expect(g.filter((x) => x.sisi === 'lokal')).toHaveLength(4)
    expect(g.filter((x) => x.sisi === 'asing')).toHaveLength(4)
  })

  it('warna tak pernah berulang selama garisnya ≤ batas', () => {
    const agg = [
      ag('XL', 900), ag('PD', 800), ag('YP', 700), ag('SQ', 600), ag('LG', 500),
      ag('AK', 40), ag('BK', 30), ag('ZP', 20), ag('YU', 10), ag('RX', 5),
    ]
    const g = pilihGarisBroker(agg, semuaAktif)
    expect(new Set(g.map((x) => x.warna)).size).toBe(g.length)
  })

  it('broker tak aktif dibuang walau net belinya terbesar', () => {
    const agg = [ag('GW', 9_999), ag('XL', 100)]
    const g = pilihGarisBroker(agg, new Set(['XL']))
    expect(g.map((x) => x.broker)).toEqual(['XL'])
  })

  it('penjual bersih dan broker tanpa harga rata-rata tidak menggambar garis', () => {
    const agg = [ag('XL', -500), ag('PD', 300, null), ag('YP', 100)]
    const g = pilihGarisBroker(agg, new Set(['XL', 'PD', 'YP']))
    expect(g.map((x) => x.broker)).toEqual(['YP'])
  })

  it('persen memakai penyebut SELURUH broker — bukan yang terpilih saja', () => {
    // Kalau penyebutnya yang terpilih, jumlah persennya selalu 100% dan
    // angka itu berhenti memberi tahu seberapa besar brokernya.
    const agg = [ag('XL', 100), ag('PD', 90), ag('YP', 80)]
    const g = pilihGarisBroker(agg, new Set(['XL']))
    const total = agg.reduce((s, a) => s + a.beliNilai, 0)
    expect(g[0].pct).toBeCloseTo(agg[0].beliNilai / total, 10)
    expect(g[0].pct).toBeLessThan(0.5)
  })

  it('saklar sisi menyaring, bukan menyusun ulang peringkat', () => {
    const agg = [ag('XL', 900), ag('PD', 800), ag('AK', 40), ag('BK', 30)]
    expect(pilihGarisBroker(agg, semuaAktif, 'asing').map((x) => x.broker)).toEqual(['AK', 'BK'])
    expect(pilihGarisBroker(agg, semuaAktif, 'lokal').map((x) => x.broker)).toEqual(['XL', 'PD'])
  })
})

describe('batas garis mengikuti lebar layar (#67)', () => {
  it('layar lebar dapat batas penuh, layar sempit dapat batas kecil', () => {
    expect(maksGaris(1536)).toBe(MAKS_GARIS)
    expect(maksGaris(LEBAR_GARIS_PENUH)).toBe(MAKS_GARIS)
    expect(maksGaris(LEBAR_GARIS_PENUH - 1)).toBe(MAKS_GARIS_SEMPIT)
    expect(maksGaris(412)).toBe(MAKS_GARIS_SEMPIT)
  })

  it('batas benar-benar memotong daftar, bukan cuma dilaporkan', () => {
    // Delapan pill menutup ~40% tinggi kanvas di 412 px (diukur saat #46
    // diverifikasi), dan lilin di belakangnya jadi tak terbaca.
    const agg = [
      ag('XL', 900), ag('PD', 800), ag('YP', 700), ag('SQ', 600), ag('LG', 500),
      ag('AK', 40), ag('BK', 30), ag('ZP', 20), ag('YU', 10), ag('RX', 5),
    ]
    const aktif = new Set(['XL', 'PD', 'YP', 'SQ', 'LG', 'AK', 'BK', 'ZP', 'YU', 'RX'])
    expect(pilihGarisBroker(agg, aktif, 'semua', 5, maksGaris(1536))).toHaveLength(8)
    expect(pilihGarisBroker(agg, aktif, 'semua', 5, maksGaris(412))).toHaveLength(5)
  })

  it('di layar sempit kedua sisi tetap terwakili — bukan lima lokal saja', () => {
    const agg = [
      ag('XL', 900), ag('PD', 800), ag('YP', 700), ag('SQ', 600), ag('LG', 500),
      ag('AK', 40), ag('BK', 30), ag('ZP', 20), ag('YU', 10), ag('RX', 5),
    ]
    const aktif = new Set(['XL', 'PD', 'YP', 'SQ', 'LG', 'AK', 'BK', 'ZP', 'YU', 'RX'])
    const g = pilihGarisBroker(agg, aktif, 'semua', 5, maksGaris(412))
    expect(g.filter((x) => x.sisi === 'lokal').length).toBeGreaterThan(0)
    expect(g.filter((x) => x.sisi === 'asing').length).toBeGreaterThan(0)
  })
})
