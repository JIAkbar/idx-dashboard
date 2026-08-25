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
  label_accdist: null,
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
