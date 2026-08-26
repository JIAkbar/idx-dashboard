import { describe, it, expect } from 'vitest'
import {
  PRESET,
  hitungUkuranOrderP25,
  jalankanPreset,
  nilaiPreset,
  type BarisPreset,
} from './presetScreener'

const KOSONG: BarisPreset = {
  kode: 'XXXX',
  harga: null,
  ma5: null,
  ma20: null,
  ma50: null,
  posisi_bb: null,
  di_atas_kumo: null,
  posisi_regresi: null,
  freq: null,
  ukuran_order: null,
  peringkat_value: null,
  net_asing_rp: null,
  porsi_asing: null,
  label_accdist: null,
  tiket_lonjakan: null,
  tiket_broker_maks: null,
  bval_maks: null,
  nego_blok_rp: null,
  asing_net_5h: null,
  asing_streak: null,
  top3_pct: null,
  number_broker_buysell: null,
}

function baris(o: Partial<BarisPreset>): BarisPreset {
  return { ...KOSONG, ...o }
}

const scalping = PRESET.find((p) => p.id === 'scalping')!
const swing = PRESET.find((p) => p.id === 'swing')!

describe('kriteria yang datanya belum ada', () => {
  it('bernilai tak-terukur, BUKAN gagal', () => {
    const h = nilaiPreset(KOSONG, scalping, { ukuranOrderP25: null })
    expect(h.rinci.every((r) => r.hasil === 'tak-terukur')).toBe(true)
    expect(h.terukur).toBe(0)
    expect(h.takTerukur).toBe(scalping.kriteria.length)
  })

  it('skor null kalau tak satu pun kriteria terukur — bukan nol', () => {
    // Nol berarti "diuji dan gagal semua"; null berarti "belum tahu apa-apa".
    // Membedakannya mencegah emiten tanpa data terbaca sebagai emiten buruk.
    expect(nilaiPreset(KOSONG, scalping, { ukuranOrderP25: null }).skor).toBeNull()
  })

  it('skor hanya dibagi kriteria yang terukur', () => {
    const b = baris({ harga: 200, peringkat_value: 10 }) // 2 terukur, 2 lolos
    const h = nilaiPreset(b, scalping, { ukuranOrderP25: null })
    expect(h.terukur).toBe(2)
    expect(h.lolos).toBe(2)
    expect(h.skor).toBe(1)
  })
})

describe('kriteria scalping', () => {
  it('peringkat nilai transaksi inklusif di 50', () => {
    const k = scalping.kriteria.find((x) => x.id === 'ramai')!
    expect(k.uji(baris({ peringkat_value: 50 }), { ukuranOrderP25: null })).toBe('lolos')
    expect(k.uji(baris({ peringkat_value: 51 }), { ukuranOrderP25: null })).toBe('gagal')
  })

  it('harga gocap tepat 50 ditolak, 51 diterima', () => {
    const k = scalping.kriteria.find((x) => x.id === 'bukan-gocap')!
    expect(k.uji(baris({ harga: 50 }), { ukuranOrderP25: null })).toBe('gagal')
    expect(k.uji(baris({ harga: 51 }), { ukuranOrderP25: null })).toBe('lolos')
  })

  it('ukuran order butuh persentil pasar — tanpa itu tak terukur, bukan gagal', () => {
    const k = scalping.kriteria.find((x) => x.id === 'order-kecil')!
    expect(k.uji(baris({ ukuran_order: 10 }), { ukuranOrderP25: null })).toBe('tak-terukur')
    expect(k.uji(baris({ ukuran_order: 10 }), { ukuranOrderP25: 20 })).toBe('lolos')
    expect(k.uji(baris({ ukuran_order: 30 }), { ukuranOrderP25: 20 })).toBe('gagal')
  })

  it('label arus broker cocok tanpa peduli huruf besar-kecil', () => {
    const k = scalping.kriteria.find((x) => x.id === 'arus-broker')!
    expect(k.uji(baris({ label_accdist: 'Big Acc' }), { ukuranOrderP25: null })).toBe('lolos')
    expect(k.uji(baris({ label_accdist: 'Normal Dist' }), { ukuranOrderP25: null })).toBe('gagal')
  })
})

describe('kriteria swing', () => {
  it('susunan rata-rata harus berurutan, bukan sekadar di atas satu garis', () => {
    const k = swing.kriteria.find((x) => x.id === 'susunan-ma')!
    expect(k.uji(baris({ harga: 100, ma20: 90, ma50: 80 }), { ukuranOrderP25: null })).toBe('lolos')
    // harga di atas ma20 tapi ma20 DI BAWAH ma50 — tren belum tersusun
    expect(k.uji(baris({ harga: 100, ma20: 90, ma50: 95 }), { ukuranOrderP25: null })).toBe('gagal')
  })

  it('nol bukan aliran masuk', () => {
    const k = swing.kriteria.find((x) => x.id === 'asing-masuk')!
    expect(k.uji(baris({ net_asing_rp: 0 }), { ukuranOrderP25: null })).toBe('gagal')
    expect(k.uji(baris({ net_asing_rp: 1 }), { ukuranOrderP25: null })).toBe('lolos')
  })

  it('posisi regresi tepat nol dihitung lolos (di garis tengah)', () => {
    const k = swing.kriteria.find((x) => x.id === 'tren-regresi')!
    expect(k.uji(baris({ posisi_regresi: 0 }), { ukuranOrderP25: null })).toBe('lolos')
  })
})

describe('hitungUkuranOrderP25', () => {
  it('mengabaikan nilai kosong', () => {
    const b = [10, 20, 30, 40, null].map((v, i) => baris({ kode: `K${i}`, ukuran_order: v }))
    expect(hitungUkuranOrderP25(b)).toBe(10)
  })
  it('null kalau tak ada satu pun nilai', () => {
    expect(hitungUkuranOrderP25([KOSONG])).toBeNull()
  })
})

describe('jalankanPreset', () => {
  const data = [
    baris({ kode: 'AAA', harga: 200, peringkat_value: 10, freq: 20_000, ma5: 11, ma20: 10, posisi_bb: 0.9 }),
    baris({ kode: 'BBB', harga: 200, peringkat_value: 900, freq: 100, ma5: 9, ma20: 10, posisi_bb: 0.1 }),
    baris({ kode: 'CCC' }), // nol ruas
  ]

  it('membuang emiten yang tak satu pun kriterianya terukur', () => {
    const h = jalankanPreset(data, scalping)
    expect(h.map((x) => x.kode)).not.toContain('CCC')
  })

  it('mengurutkan dari skor tertinggi', () => {
    const h = jalankanPreset(data, scalping)
    expect(h[0].kode).toBe('AAA')
    expect(h[0].skor!).toBeGreaterThan(h[1].skor!)
  })

  it('minLolos dihitung terhadap kriteria terukur, bukan total', () => {
    // AAA memenuhi 5 kriteria terukur walau 2 kriteria lain belum ada datanya.
    // Menuntut 5 harus tetap meloloskannya.
    expect(jalankanPreset(data, scalping, { minLolos: 5 }).map((x) => x.kode)).toEqual(['AAA'])
  })

  it('urutan stabil: skor sama diputus oleh kode', () => {
    const kembar = [
      baris({ kode: 'ZZZ', harga: 200, peringkat_value: 1 }),
      baris({ kode: 'AAA', harga: 200, peringkat_value: 1 }),
    ]
    expect(jalankanPreset(kembar, scalping).map((x) => x.kode)).toEqual(['AAA', 'ZZZ'])
  })
})

describe('preset Whale (adendum — tambahan, bukan pengganti)', () => {
  const K = { ukuranOrderP25: null }
  const tiket = PRESET.find((p) => p.id === 'whale-tiket')!
  const akdis = PRESET.find((p) => p.id === 'whale-akdis')!
  const asing = PRESET.find((p) => p.id === 'whale-asing')!

  it('Scalping & Swing tetap utuh — Whale menambah, tidak menimpa', () => {
    expect(PRESET.map((p) => p.id)).toEqual([
      'scalping', 'swing', 'whale-tiket', 'whale-akdis', 'whale-asing',
    ])
  })

  it('jejak tiket: empat pintu ATAU — satu pintu lolos sudah cukup', () => {
    const k = tiket.kriteria.find((x) => x.id === 'jejak-tiket')!
    expect(k.uji(baris({ nego_blok_rp: 5_000_000_000 }), K)).toBe('lolos')
    expect(k.uji(baris({ tiket_lonjakan: 2 }), K)).toBe('lolos')
    expect(k.uji(baris({ tiket_broker_maks: 249_999_999, bval_maks: 4_999_999_999 }), K)).toBe('gagal')
    // keempat ruas kosong = tak terukur, BUKAN gagal
    expect(k.uji(KOSONG, K)).toBe('tak-terukur')
  })

  it('nego_blok_rp 0 itu TERUKUR (hari tanpa blok), bukan tak-terukur', () => {
    const k = tiket.kriteria.find((x) => x.id === 'jejak-tiket')!
    expect(k.uji(baris({ nego_blok_rp: 0 }), K)).toBe('gagal')
  })

  it('akumulasi: label biner sumber — Acc lolos, Dist gagal, string kosong tak terukur', () => {
    const k = akdis.kriteria.find((x) => x.id === 'arus-akumulasi')!
    expect(k.uji(baris({ label_accdist: 'Acc' }), K)).toBe('lolos')
    expect(k.uji(baris({ label_accdist: 'Dist' }), K)).toBe('gagal')
    expect(k.uji(baris({ label_accdist: '' }), K)).toBe('tak-terukur')
  })

  it('konsentrasi top3 inklusif di 60; pembeli-sedikit inklusif di 0', () => {
    expect(akdis.kriteria.find((x) => x.id === 'terkonsentrasi')!.uji(baris({ top3_pct: 60 }), K)).toBe('lolos')
    expect(akdis.kriteria.find((x) => x.id === 'pembeli-sedikit')!.uji(baris({ number_broker_buysell: 0 }), K)).toBe('lolos')
    expect(akdis.kriteria.find((x) => x.id === 'pembeli-sedikit')!.uji(baris({ number_broker_buysell: 1 }), K)).toBe('gagal')
  })

  it('asing: streak bertanda — keluar beruntun (−3) GAGAL, bukan lolos', () => {
    const k = asing.kriteria.find((x) => x.id === 'asing-konsisten')!
    expect(k.uji(baris({ asing_streak: 3 }), K)).toBe('lolos')
    expect(k.uji(baris({ asing_streak: -3 }), K)).toBe('gagal')
  })

  it('asing: porsi tepat 20% lolos; net 5h nol gagal', () => {
    expect(asing.kriteria.find((x) => x.id === 'asing-berarti')!.uji(baris({ porsi_asing: 0.2 }), K)).toBe('lolos')
    expect(asing.kriteria.find((x) => x.id === 'asing-5h')!.uji(baris({ asing_net_5h: 0 }), K)).toBe('gagal')
  })
})
