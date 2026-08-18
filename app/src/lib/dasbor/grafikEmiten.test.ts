import { beforeAll, describe, expect, it } from 'vitest'
import {
  keDataLilinVolume, batasBawahRentang, potongRentang, RENTANG_GRAFIK, RENTANG_BAWAAN,
  hitungMA, hitungEMA, hitungRSI, hitungMACD, hitungBollinger, keSeriGaris,
  SPEK_INDIKATOR, buatInstans, galatNilaiParam, galatInstans, labelInstansIndikator,
  hitungInstans, PALET_INDIKATOR,
  hitungATR, cariPivotRendah, cariPivotTinggi, cariDoubleBottom,
  hitungOBV, cariLonjakanVolume, cariMusiman, SPEK_POLA, labelInstansPola,
  VERSI_TEMPLATE, uraiTemplate, simpanTemplate, hapusTemplate, tandaiBawaan, ubahNamaTemplate,
  penandaDiSekitar,
  type InstansIndikator, type SpekParam, type LilinData, type ParamDoubleBottom,
  type TemplateGrafik, type ParamLonjakanVolume,
} from './grafikEmiten'
import { muatKatalog, keSpekParam, keMasukanPustaka, ID_SUDAH_ADA, KATEGORI } from './katalogIndikator'
import type { BarisOhlc } from './ihsgOhlc'

const baris: BarisOhlc[] = [
  ['2024-01-02', 100, 110, 95, 105, 1000], // tutup >= buka -> naik
  ['2024-01-03', 105, 108, 90, 90, 2000], // tutup < buka -> turun
  ['2025-06-10', 90, 95, 88, 92, 3000],
]

describe('keDataLilinVolume', () => {
  it('memisah lilin & volume, warna volume ikut arah lilin hari itu', () => {
    const { lilin, volume } = keDataLilinVolume(baris, 'HIJAU', 'MERAH')
    expect(lilin).toEqual([
      { time: '2024-01-02', open: 100, high: 110, low: 95, close: 105 },
      { time: '2024-01-03', open: 105, high: 108, low: 90, close: 90 },
      { time: '2025-06-10', open: 90, high: 95, low: 88, close: 92 },
    ])
    expect(volume).toEqual([
      { time: '2024-01-02', value: 1000, color: 'HIJAU' },
      { time: '2024-01-03', value: 2000, color: 'MERAH' },
      { time: '2025-06-10', value: 3000, color: 'HIJAU' },
    ])
  })
})

describe('batasBawahRentang', () => {
  it('dihitung mundur dari akhir DATA, bukan dari hari ini', () => {
    expect(batasBawahRentang('2026-08-14', 1)).toBe('2025-08-14')
    expect(batasBawahRentang('2026-08-14', 5)).toBe('2021-08-14')
  })
  it('null (Semua) -> string kosong, tak ada batas', () => {
    expect(batasBawahRentang('2026-08-14', null)).toBe('')
  })
  it('akhirData kosong -> string kosong (belum ada data)', () => {
    expect(batasBawahRentang('', 1)).toBe('')
  })
})

describe('potongRentang', () => {
  const seri = [{ time: '2024-01-01' }, { time: '2024-06-01' }, { time: '2025-01-01' }]
  it('batas kosong -> seluruh data lolos', () => {
    expect(potongRentang(seri, '')).toEqual(seri)
  })
  it('memotong ke tanggal >= batas', () => {
    expect(potongRentang(seri, '2024-06-01')).toEqual([{ time: '2024-06-01' }, { time: '2025-01-01' }])
  })
  it('batas di atas seluruh data -> array kosong', () => {
    expect(potongRentang(seri, '2099-01-01')).toEqual([])
  })
})

describe('hari tanpa perdagangan', () => {
  const N = '#0f0'
  const T = '#f00'

  it('membuang baris volume 0 yang harganya tak bergerak', () => {
    const { lilin, volume } = keDataLilinVolume(
      [
        ['2026-05-13', 6100, 6150, 6050, 6125, 1_000],
        ['2026-05-14', 6125, 6125, 6125, 6125, 0],
        ['2026-05-15', 6125, 6200, 6100, 6180, 2_000],
      ],
      N,
      T,
    )
    expect(lilin.map((l) => l.time)).toEqual(['2026-05-13', '2026-05-15'])
    expect(volume.map((v) => v.time)).toEqual(['2026-05-13', '2026-05-15'])
  })

  it('MEMPERTAHANKAN hari datar yang volumenya besar — auto-reject tetap hari bursa', () => {
    const { lilin } = keDataLilinVolume([['2026-05-14', 6100, 6100, 6100, 6100, 9_000_000]], N, T)
    expect(lilin).toHaveLength(1)
  })

  it('MEMPERTAHANKAN hari bervolume nol yang harganya bergerak — yang salah ruas volumenya', () => {
    const { lilin } = keDataLilinVolume([['2026-05-14', 6100, 6200, 6050, 6150, 0]], N, T)
    expect(lilin).toHaveLength(1)
  })
})

describe('hitungMA', () => {
  it('periode 3 atas [1,2,3,4,5] -> hitungan tangan (1+2+3)/3=2, (2+3+4)/3=3, (3+4+5)/3=4', () => {
    expect(hitungMA([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
  })
})

describe('hitungEMA', () => {
  it('periode 3 atas [1,2,3,4,5]: bibit SMA=2, k=0.5 -> EMA berikutnya 3, lalu 4', () => {
    // Bibit: (1+2+3)/3 = 2. k = 2/(3+1) = 0.5.
    // EMA[3] = (4-2)*0.5+2 = 3. EMA[4] = (5-3)*0.5+3 = 4.
    expect(hitungEMA([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
  })
})

describe('hitungRSI', () => {
  // periode 3 atas [10,11,12,11,12,13] — selisih harian: +1,+1,-1,+1,+1
  // (untung: 1,1,0,1,1 / rugi: 0,0,1,0,0).
  // Bibit (3 selisih pertama): avgUntung=(1+1+0)/3=2/3, avgRugi=(0+0+1)/3=1/3
  //   -> RS=2 -> RSI = 100-100/3 = 66.6667 (di indeks 3, closes[3]=11).
  // Berikutnya (selisih ke-4, +1): avgUntung=(2/3*2+1)/3=7/9, avgRugi=(1/3*2+0)/3=2/9
  //   -> RS=3.5 -> RSI = 100-100/4.5 = 77.7778 (indeks 4, closes[4]=12).
  // Berikutnya (selisih ke-5, +1): avgUntung=(7/9*2+1)/3=23/27, avgRugi=(2/9*2+0)/3=4/27
  //   -> RS=5.75 -> RSI = 100-100/6.75 = 85.1852 (indeks 5, closes[5]=13).
  it('cocok dengan hitungan tangan (pemulusan Wilder, periode 3)', () => {
    const rsi = hitungRSI([10, 11, 12, 11, 12, 13], 3)
    expect(rsi[0]).toBeNull()
    expect(rsi[1]).toBeNull()
    expect(rsi[2]).toBeNull()
    expect(rsi[3]).toBeCloseTo(200 / 3, 6)
    expect(rsi[4]).toBeCloseTo(100 - 100 / 4.5, 6)
    expect(rsi[5]).toBeCloseTo(100 - 100 / 6.75, 6)
  })

  it('seluruh selisih untung (rugi selalu 0) -> RSI 100, bukan NaN dari pembagian nol', () => {
    const rsi = hitungRSI([10, 11, 12, 13], 3)
    expect(rsi[3]).toBe(100)
  })
})

describe('hitungMACD', () => {
  // Deret [10,11,12,11,13,14,16], cepat=2 (k=2/3), lambat=3 (k=0.5), sinyal=2 (k=2/3).
  // EMA cepat (bibit SMA 2 titik pertama = 10.5 di indeks 1):
  //   idx2: (12-10.5)*2/3+10.5=11.5, idx3: (11-11.5)*2/3+11.5=11.166667,
  //   idx4: (13-11.166667)*2/3+11.166667=12.388889,
  //   idx5: (14-12.388889)*2/3+12.388889=13.462963,
  //   idx6: (16-13.462963)*2/3+13.462963=15.154321.
  // EMA lambat (bibit SMA 3 titik pertama = 11 di indeks 2):
  //   idx3: (11-11)*0.5+11=11, idx4: (13-11)*0.5+11=12,
  //   idx5: (14-12)*0.5+12=13, idx6: (16-13)*0.5+13=14.5.
  // MACD = cepat-lambat, mulai idx2: 0.5, 0.166667, 0.388889, 0.462963, 0.654321.
  // Sinyal = EMA periode2 dari deret MACD (bibit SMA 2 titik pertama = (0.5+0.166667)/2=0.333333 di idx3):
  //   idx4: (0.388889-0.333333)*2/3+0.333333=0.370370,
  //   idx5: (0.462963-0.370370)*2/3+0.370370=0.432099,
  //   idx6: (0.654321-0.432099)*2/3+0.432099=0.580247.
  // Histogram = MACD-sinyal, mulai idx3: -0.166667, 0.018519, 0.030864, 0.074074.
  it('cocok dengan hitungan tangan (EMA 2/3/2 di atas [10,11,12,11,13,14,16])', () => {
    const { macd, sinyal, histogram } = hitungMACD([10, 11, 12, 11, 13, 14, 16], 2, 3, 2)
    expect(macd[2]).toBeCloseTo(0.5, 5)
    expect(macd[3]).toBeCloseTo(0.166667, 5)
    expect(macd[6]).toBeCloseTo(0.654321, 5)
    expect(sinyal[3]).toBeCloseTo(0.333333, 5)
    expect(sinyal[6]).toBeCloseTo(0.580247, 5)
    expect(histogram[3]).toBeCloseTo(-0.166667, 5)
    expect(histogram[6]).toBeCloseTo(0.074074, 5)
    // Sebelum bibitnya siap, masih null (bukan 0 atau NaN).
    expect(macd[1]).toBeNull()
    expect(sinyal[2]).toBeNull()
    expect(histogram[2]).toBeNull()
  })
})

describe('hitungBollinger', () => {
  // periode 3, k=2, atas [10,12,11,15,13,14].
  // idx2 (10,12,11): rata=11, variansi populasi=((1)^2+(1)^2+0^2)/3=2/3,
  //   stddev=√(2/3)=0.81650 -> atas=11+1.63299=12.63299, bawah=9.36701.
  // idx3 (12,11,15): rata=38/3=12.66667, variansi=((-0.66667)^2+(-1.66667)^2+(2.33333)^2)/3=2.88889,
  //   stddev=1.69967 -> atas=16.06600, bawah=9.26734.
  it('cocok dengan hitungan tangan (simpangan baku populasi, periode 3)', () => {
    const { tengah, atas, bawah } = hitungBollinger([10, 12, 11, 15, 13, 14], 3, 2)
    expect(tengah[2]).toBeCloseTo(11, 6)
    expect(atas[2]).toBeCloseTo(12.63299, 4)
    expect(bawah[2]).toBeCloseTo(9.36701, 4)
    expect(tengah[3]).toBeCloseTo(38 / 3, 6)
    expect(atas[3]).toBeCloseTo(16.06600, 3)
    expect(bawah[3]).toBeCloseTo(9.26734, 3)
    expect(tengah[0]).toBeNull()
    expect(atas[1]).toBeNull()
  })
})

describe('keSeriGaris', () => {
  it('memasangkan waktu+nilai dan membuang posisi null', () => {
    const waktu = ['2024-01-01', '2024-01-02', '2024-01-03']
    expect(keSeriGaris(waktu, [null, 5, 7])).toEqual([
      { time: '2024-01-02', value: 5 },
      { time: '2024-01-03', value: 7 },
    ])
  })
})

describe('RENTANG_BAWAAN', () => {
  it('bawaannya "Semua" dan label itu benar-benar ada di RENTANG_GRAFIK', () => {
    expect(RENTANG_BAWAAN).toBe('Semua')
    const cocok = RENTANG_GRAFIK.find(([label]) => label === RENTANG_BAWAAN)
    expect(cocok).toBeDefined()
    // Bawaan harus yang TIDAK memotong data — kalau ini berubah jadi angka,
    // chip yang tersorot dan data yang tergambar mulai bercerita beda.
    expect(cocok?.[1]).toBeNull()
  })
})

/* ---------------- Instans indikator (tahap 5) ---------------- */

const spekPeriode = SPEK_INDIKATOR.ma.param[0]

describe('buatInstans', () => {
  it('mengisi seluruh parameter dengan nilai bawaan jenisnya', () => {
    const inst = buatInstans('macd', SPEK_INDIKATOR.macd.param, 'x1', 0)
    expect(inst).toEqual({
      id: 'x1', jenis: 'macd', tampil: true,
      warna: PALET_INDIKATOR[0],
      param: { cepat: 12, lambat: 26, sinyal: 9 },
    })
  })
  it('warna berputar mengikuti urutan, tak pernah keluar dari palet', () => {
    const n = PALET_INDIKATOR.length
    expect(buatInstans('ma', SPEK_INDIKATOR.ma.param, 'a', n).warna).toBe(PALET_INDIKATOR[0])
    expect(buatInstans('ma', SPEK_INDIKATOR.ma.param, 'b', n + 2).warna).toBe(PALET_INDIKATOR[2])
  })
})

describe('galatNilaiParam', () => {
  it('kosong ditolak — Number("") itu 0, bukan "belum diisi"', () => {
    expect(galatNilaiParam(spekPeriode, '', 500)).toBe('Wajib diisi.')
    expect(galatNilaiParam(spekPeriode, '   ', 500)).toBe('Wajib diisi.')
  })
  it('bukan angka ditolak', () => {
    expect(galatNilaiParam(spekPeriode, '12abc', 500)).toBe('Bukan angka.')
  })
  it('nol & negatif ditolak lewat batas minimum', () => {
    expect(galatNilaiParam(spekPeriode, '0', 500)).toBe('Minimum 2.')
    expect(galatNilaiParam(spekPeriode, '-5', 500)).toBe('Minimum 2.')
  })
  it('pecahan ditolak untuk ruas yang harus bulat', () => {
    expect(galatNilaiParam(spekPeriode, '20.5', 500)).toBe('Harus bilangan bulat.')
  })
  it('periode lebih panjang dari jumlah lilin ditolak — itu garis yang lenyap senyap', () => {
    expect(galatNilaiParam(spekPeriode, '300', 250))
      .toBe('Lebih besar dari jumlah lilin (250) — garisnya tak akan muncul.')
  })
  it('jumlah lilin 0 (data belum dimuat) tak dipakai membatasi apa pun', () => {
    expect(galatNilaiParam(spekPeriode, '300', 0)).toBeNull()
  })
  it('pengali simpangan baku boleh pecahan', () => {
    const k = SPEK_INDIKATOR.bb.param[1]
    expect(galatNilaiParam(k, '2.5', 500)).toBeNull()
    expect(galatNilaiParam(k, '0', 500)).toBe('Minimum 0.1.')
  })
  it('di atas batas atas ditolak', () => {
    expect(galatNilaiParam(spekPeriode, '5000', 0)).toBe('Maksimum 1000.')
  })
})

describe('galatInstans', () => {
  it('instans sehat tak menghasilkan galat sama sekali', () => {
    expect(galatInstans(SPEK_INDIKATOR.macd.param, { cepat: '12', lambat: '26', sinyal: '9' }, 500)).toEqual({})
  })
  it('MACD cepat >= lambat ditolak di kolom cepat', () => {
    const g = galatInstans(SPEK_INDIKATOR.macd.param, { cepat: '26', lambat: '26', sinyal: '9' }, 500)
    expect(g.cepat).toBe('Harus lebih kecil dari periode lambat.')
  })
  it('aturan antar-kolom tak menimpa galat kolomnya sendiri', () => {
    const g = galatInstans(SPEK_INDIKATOR.macd.param, { cepat: '', lambat: '26', sinyal: '9' }, 500)
    expect(g.cepat).toBe('Wajib diisi.')
  })
  it('jarak min > jarak maks ditolak (dipakai parameter pola)', () => {
    const spek: SpekParam[] = [
      { kunci: 'jarakMin', label: 'Min', bawaan: 10, min: 2, maks: 500, bulat: true },
      { kunci: 'jarakMaks', label: 'Maks', bawaan: 120, min: 3, maks: 500, bulat: true },
    ]
    expect(galatInstans(spek, { jarakMin: '200', jarakMaks: '100' }, 0).jarakMin)
      .toBe('Harus lebih kecil dari jarak maksimum.')
  })
})

describe('labelInstansIndikator', () => {
  const inst = (jenis: InstansIndikator['jenis'], param: Record<string, number>): InstansIndikator =>
    ({ id: 'i', jenis, param, warna: '--amber', tampil: true })
  it('menyebut parameternya — "MA 200", bukan "MA"', () => {
    expect(labelInstansIndikator(inst('ma', { periode: 200 }))).toBe('MA 200')
    expect(labelInstansIndikator(inst('ema', { periode: 9 }))).toBe('EMA 9')
    expect(labelInstansIndikator(inst('rsi', { periode: 14 }))).toBe('RSI 14')
    expect(labelInstansIndikator(inst('bb', { periode: 20, k: 2 }))).toBe('BB 20±2')
    expect(labelInstansIndikator(inst('macd', { cepat: 12, lambat: 26, sinyal: 9 }))).toBe('MACD 12/26/9')
  })
  it('dua instans jenis sama berbeda periode punya label berbeda', () => {
    expect(labelInstansIndikator(inst('ma', { periode: 20 })))
      .not.toBe(labelInstansIndikator(inst('ma', { periode: 50 })))
  })
})

describe('hitungInstans', () => {
  const tutup = [10, 11, 12, 11, 13, 14, 16]
  it('MA menghasilkan satu deret, isinya sama dengan hitungMA langsung', () => {
    const inst = buatInstans('ma', SPEK_INDIKATOR.ma.param, 'i', 0)
    inst.param.periode = 3
    const garis = hitungInstans(inst, tutup)
    expect(garis).toHaveLength(1)
    expect(garis[0].nama).toBe('MA 3')
    expect(garis[0].nilai).toEqual(hitungMA(tutup, 3))
  })
  it('BB menghasilkan tiga pita, dua di antaranya ditandai garis bantu', () => {
    const inst = buatInstans('bb', SPEK_INDIKATOR.bb.param, 'i', 0)
    inst.param.periode = 3
    const garis = hitungInstans(inst, tutup)
    expect(garis.map((g) => g.bantu)).toEqual([undefined, true, true])
    expect(garis[0].nilai).toEqual(hitungBollinger(tutup, 3, 2).tengah)
  })
  it('MACD menghasilkan dua garis + satu histogram', () => {
    const inst = buatInstans('macd', SPEK_INDIKATOR.macd.param, 'i', 0)
    inst.param = { cepat: 2, lambat: 3, sinyal: 2 }
    const garis = hitungInstans(inst, tutup)
    expect(garis.map((g) => g.histogram)).toEqual([undefined, undefined, true])
    expect(garis[2].nilai).toEqual(hitungMACD(tutup, 2, 3, 2).histogram)
  })
  it('tiga instans MA berbeda periode hidup bersamaan tanpa saling menimpa', () => {
    const hasil = [20, 50, 200].map((periode, i) => {
      const inst = buatInstans('ma', SPEK_INDIKATOR.ma.param, `ma${i}`, i)
      inst.param.periode = periode
      return hitungInstans(inst, Array.from({ length: 300 }, (_, j) => j + 1))[0]
    })
    expect(hasil.map((g) => g.nama)).toEqual(['MA 20', 'MA 50', 'MA 200'])
    // Deret naik 1..300: MA di titik terakhir = rata-rata `periode` angka
    // terakhir = 300 - (periode-1)/2.
    expect(hasil.map((g) => g.nilai[299])).toEqual([290.5, 275.5, 200.5])
  })
})

/* ---------------- Pola: Double Bottom (tahap 5) ---------------- */

/** Deret buatan: satu harga per hari, buka=tinggi=rendah=tutup. Bentuk paling
 *  polos yang mungkin — dengan begitu True Range tiap hari persis sama dengan
 *  besar langkahnya, jadi ATR-nya bisa dihitung tangan dan tiap penolakan bisa
 *  ditelusuri ke satu syarat tertentu, bukan ke bayangan tinggi/rendah. */
function lilinDari(harga: number[]): LilinData[] {
  return harga.map((h, i) => ({
    time: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
    open: h, high: h, low: h, close: h,
  }))
}

/** Tangga lurus dari `dari` ke `sampai` (inklusif) berlangkah `langkah`. */
function ramp(dari: number, sampai: number, langkah = 2): number[] {
  const arah = sampai >= dari ? 1 : -1
  const out: number[] = []
  for (let v = dari; arah > 0 ? v <= sampai : v >= sampai; v += arah * langkah) out.push(v)
  return out
}

const P: ParamDoubleBottom = {
  jendela: 2, atr: 5, toleransi: 1, jarakMin: 5, jarakMaks: 40, kedalamanMin: 2,
}

// Turun 100->80 (lembah 1 di indeks 10), naik ke 96 (leher di indeks 18),
// turun ke 81 (lembah 2 di indeks 26), lalu naik sampai 95 — tak pernah
// menutup di atas leher, tak pernah jatuh di bawah 80.
const HARGA_TERBENTUK = [...ramp(100, 80), ...ramp(82, 96), ...ramp(94, 82), 81, ...ramp(83, 95)]

describe('hitungATR', () => {
  it('deret berlangkah tetap 2 -> ATR 2 (True Range = besar langkahnya)', () => {
    const atr = hitungATR(lilinDari(ramp(100, 80)), 5)
    expect(atr[4]).toBeNull() // bibit baru siap di indeks = periode
    expect(atr[5]).toBeCloseTo(2, 10)
    expect(atr[10]).toBeCloseTo(2, 10)
  })
  it('lompatan pembukaan ikut terhitung — TR bukan cuma tinggi-rendah', () => {
    // Tutup 100 lalu esoknya seluruh lilin ada di 120: tinggi-rendah = 0,
    // tapi |tinggi - tutup kemarin| = 20.
    const l: LilinData[] = [
      { time: '2024-01-01', open: 100, high: 100, low: 100, close: 100 },
      { time: '2024-01-02', open: 120, high: 120, low: 120, close: 120 },
      { time: '2024-01-03', open: 120, high: 120, low: 120, close: 120 },
    ]
    expect(hitungATR(l, 2)[2]).toBeCloseTo(10, 10) // (20 + 0) / 2
  })
  it('data lebih pendek dari periode -> seluruhnya null, bukan NaN', () => {
    expect(hitungATR(lilinDari([1, 2, 3]), 10)).toEqual([null, null, null])
  })
})

describe('cariPivotRendah / cariPivotTinggi', () => {
  it('menemukan dasar & puncak lembah tunggal', () => {
    expect(cariPivotRendah([...ramp(10, 2), ...ramp(4, 10)], 2)).toEqual([4])
    expect(cariPivotTinggi([...ramp(2, 10), ...ramp(8, 2)], 2)).toEqual([4])
  })
  it('dataran datar menghasilkan SATU pivot (yang pertama), bukan sederet', () => {
    // Tanpa aturan pemutus, [5,5,5] di dasar jadi tiga "lembah" yang saling
    // berpasangan jadi pola palsu.
    expect(cariPivotRendah([9, 8, 7, 5, 5, 5, 7, 8, 9], 2)).toEqual([3])
  })
  it('jendela penuh diwajibkan — lilin terakhir tak pernah jadi pivot', () => {
    // 1 di indeks terakhir jelas paling rendah, tapi belum terbukti berbalik.
    expect(cariPivotRendah([9, 8, 7, 6, 5, 1], 2)).toEqual([])
  })
})

describe('cariDoubleBottom', () => {
  it('TERBENTUK: dua lembah + leher lengkap, harga belum menembus leher', () => {
    const hasil = cariDoubleBottom(lilinDari(HARGA_TERBENTUK), [], P)
    expect(hasil).toHaveLength(1)
    const db = hasil[0]
    expect(db.status).toBe('terbentuk')
    expect(db.iKonfirmasi).toBeNull()
    expect([db.iLembah1, db.iLeher, db.iLembah2]).toEqual([10, 18, 26])
    expect([db.hargaLembah1, db.hargaLeher, db.hargaLembah2]).toEqual([80, 96, 81])
    expect(db.waktuLembah1).toBe('2024-01-11')
    expect(db.waktuLembah2).toBe('2024-01-27')
    // ATR di lembah kedua = 1,8 (langkah 2 selama 4 hari, lalu 1 hari
    // berlangkah 1: (2*4 + 1)/5). Kedalaman 96-81 = 15 -> 8,33 ATR.
    expect(db.kedalamanAtr).toBeCloseTo(15 / 1.8, 6)
  })

  it('TERKONFIRMASI: ada penutupan di atas leher sesudah lembah kedua', () => {
    const harga = [...ramp(100, 80), ...ramp(82, 96), ...ramp(94, 82), 81, ...ramp(83, 97)]
    const hasil = cariDoubleBottom(lilinDari(harga), [], P)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].status).toBe('terkonfirmasi')
    expect(hasil[0].iKonfirmasi).toBe(34)
    expect(hasil[0].waktuKonfirmasi).toBe('2024-02-04')
    expect(harga[34]).toBe(97) // memang di atas leher 96
  })

  it('BATAL: harga jatuh di bawah lembah terendah sebelum menembus leher', () => {
    const harga = [...ramp(100, 80), ...ramp(82, 96), ...ramp(94, 82), 81, 83, 85, 84, 82, 79, 77, 75]
    const hasil = cariDoubleBottom(lilinDari(harga), [], P)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].status).toBe('batal')
    expect(hasil[0].iKonfirmasi).toBeNull()
  })

  it('DITOLAK: bentuknya mirip tapi kedalamannya kurang', () => {
    // Lembah 80 dan 81 dengan leher cuma 86 — kedalaman 5 = 2,78 ATR.
    const harga = [...ramp(100, 80), ...ramp(82, 86), 84, 82, 81, ...ramp(83, 95)]
    expect(cariDoubleBottom(lilinDari(harga), [], { ...P, kedalamanMin: 4 })).toEqual([])
    // Data yang SAMA lolos begitu ambangnya diturunkan — membuktikan yang
    // menolak memang syarat kedalaman, bukan syarat lain yang kebetulan ikut
    // gagal di deret ini.
    const longgar = cariDoubleBottom(lilinDari(harga), [], { ...P, kedalamanMin: 2 })
    expect(longgar).toHaveLength(1)
    expect(longgar[0].kedalamanAtr).toBeCloseTo(5 / 1.8, 6)
  })

  it('DITOLAK: kedua lembah terlalu berjauhan', () => {
    // Jarak 26-10 = 16 lilin.
    expect(cariDoubleBottom(lilinDari(HARGA_TERBENTUK), [], { ...P, jarakMaks: 10 })).toEqual([])
    expect(cariDoubleBottom(lilinDari(HARGA_TERBENTUK), [], { ...P, jarakMaks: 40 })).toHaveLength(1)
  })

  it('DITOLAK: kedua lembah terlalu berdekatan — satu ayunan yang sama', () => {
    expect(cariDoubleBottom(lilinDari(HARGA_TERBENTUK), [], { ...P, jarakMin: 20 })).toEqual([])
  })

  it('DITOLAK: harga kedua lembah terlalu jauh berbeda untuk toleransi ATR', () => {
    // Lembah 80 dan 88 — selisih 8, ATR di lembah kedua 2 -> 4 ATR.
    const harga = [...ramp(100, 80), ...ramp(82, 96), ...ramp(94, 88), ...ramp(90, 98)]
    expect(cariDoubleBottom(lilinDari(harga), [], { ...P, toleransi: 1 })).toEqual([])
    expect(cariDoubleBottom(lilinDari(harga), [], { ...P, toleransi: 5 })).toHaveLength(1)
  })

  it('volume menguat itu PENANDA, bukan syarat: tanpa volume pola tetap ditemukan', () => {
    const harga = [...ramp(100, 80), ...ramp(82, 96), ...ramp(94, 82), 81, ...ramp(83, 97)]
    const lilin = lilinDari(harga)
    const sepi = cariDoubleBottom(lilin, harga.map(() => 1_000), P)
    expect(sepi[0].status).toBe('terkonfirmasi')
    expect(sepi[0].volumeMenguat).toBe(false)
    // Volume melonjak persis di lilin penembus leher (indeks 34).
    const ramai = harga.map((_, i) => (i === 34 ? 9_000_000 : 1_000))
    expect(cariDoubleBottom(lilin, ramai, P)[0].volumeMenguat).toBe(true)
  })

  it('data kosong / terlalu pendek -> tak ada temuan, bukan galat', () => {
    expect(cariDoubleBottom([], [], P)).toEqual([])
    expect(cariDoubleBottom(lilinDari([1, 2, 3]), [], P)).toEqual([])
  })
})

/* ---------------- Template (tahap 5) ---------------- */

const instMA = (periode: number): InstansIndikator =>
  ({ id: `ma-${periode}`, jenis: 'ma', param: { periode }, warna: '--amber', tampil: true })

const templateContoh = (nama: string, bawaan = false): TemplateGrafik => ({
  versi: VERSI_TEMPLATE, nama, bawaan, indikator: [instMA(20), instMA(200)], pola: [],
})

describe('uraiTemplate', () => {
  it('bolak-balik utuh: yang ditulis sama dengan yang dibaca', () => {
    const asli = [templateContoh('Harian', true), templateContoh('Mingguan')]
    expect(uraiTemplate(JSON.stringify(asli))).toEqual(asli)
  })
  it('penyimpanan kosong / JSON rusak -> daftar kosong, bukan lemparan galat', () => {
    expect(uraiTemplate(null)).toEqual([])
    expect(uraiTemplate('')).toEqual([])
    expect(uraiTemplate('{bukan json')).toEqual([])
    expect(uraiTemplate('{"bukan":"array"}')).toEqual([])
  })
  it('versi tak dikenal DILEWATI dengan sopan, yang sezaman tetap terbaca', () => {
    const campur = [
      { ...templateContoh('Masa depan'), versi: 99 },
      { ...templateContoh('Purba'), versi: 0 },
      templateContoh('Sekarang'),
    ]
    expect(uraiTemplate(JSON.stringify(campur)).map((t) => t.nama)).toEqual(['Sekarang'])
  })
  it('jenis indikator yang tak dikenal ditolak — kalau lewat, ia meledak jauh kemudian', () => {
    const rusak = [{ ...templateContoh('Rusak'), indikator: [{ ...instMA(20), jenis: 'ichimoku' }] }]
    expect(uraiTemplate(JSON.stringify(rusak))).toEqual([])
  })
  it('parameter bukan angka (atau NaN) ditolak', () => {
    const teks = [{ ...templateContoh('Teks'), indikator: [{ ...instMA(20), param: { periode: '20' } }] }]
    expect(uraiTemplate(JSON.stringify(teks))).toEqual([])
  })
  it('nama kosong ditolak — template tanpa nama tak bisa dipilih lagi', () => {
    expect(uraiTemplate(JSON.stringify([{ ...templateContoh('x'), nama: '  ' }]))).toEqual([])
  })
})

describe('simpanTemplate', () => {
  it('nama baru ditambahkan di ujung', () => {
    const hasil = simpanTemplate([templateContoh('A')], 'B', { indikator: [instMA(50)], pola: [] })
    expect(hasil.map((t) => t.nama)).toEqual(['A', 'B'])
  })
  it('nama yang sudah ada DITIMPA, bukan menumpuk kembaran', () => {
    const hasil = simpanTemplate([templateContoh('A')], 'A', { indikator: [instMA(50)], pola: [] })
    expect(hasil).toHaveLength(1)
    expect(hasil[0].indikator).toEqual([instMA(50)])
  })
  it('menimpa tak menghilangkan tanda bawaan yang sudah ada', () => {
    expect(simpanTemplate([templateContoh('A', true)], 'A', { indikator: [], pola: [] })[0].bawaan).toBe(true)
  })
  it('nama kosong / spasi saja tak menyimpan apa pun', () => {
    const awal = [templateContoh('A')]
    expect(simpanTemplate(awal, '   ', { indikator: [], pola: [] })).toBe(awal)
  })
  it('spasi di ujung nama dirapikan', () => {
    expect(simpanTemplate([], '  Harian  ', { indikator: [], pola: [] })[0].nama).toBe('Harian')
  })
})

describe('tandaiBawaan', () => {
  it('cuma satu yang boleh jadi bawaan', () => {
    const hasil = tandaiBawaan([templateContoh('A', true), templateContoh('B')], 'B')
    expect(hasil.map((t) => t.bawaan)).toEqual([false, true])
  })
  it('menandai yang sudah bawaan melepasnya — tak ada bawaan sama sekali', () => {
    expect(tandaiBawaan([templateContoh('A', true)], 'A').map((t) => t.bawaan)).toEqual([false])
  })
})

describe('ubahNamaTemplate & hapusTemplate', () => {
  it('mengganti nama', () => {
    expect(ubahNamaTemplate([templateContoh('A')], 'A', 'Z').map((t) => t.nama)).toEqual(['Z'])
  })
  it('nama yang bentrok ditolak — dua template senama tak bisa dibedakan lagi', () => {
    const awal = [templateContoh('A'), templateContoh('B')]
    expect(ubahNamaTemplate(awal, 'A', 'B')).toBe(awal)
  })
  it('nama kosong ditolak', () => {
    const awal = [templateContoh('A')]
    expect(ubahNamaTemplate(awal, 'A', '  ')).toBe(awal)
  })
  it('menghapus menurut nama', () => {
    expect(hapusTemplate([templateContoh('A'), templateContoh('B')], 'A').map((t) => t.nama)).toEqual(['B'])
  })
})

describe('template tak pernah membawa kode emiten', () => {
  it('ruas kode di berkas lama diabaikan saat dibaca', () => {
    const berkode = [{ ...templateContoh('Modelku'), kode: 'BBCA', emiten: 'BBCA' }]
    const dibaca = uraiTemplate(JSON.stringify(berkode))[0] as unknown as Record<string, unknown>
    expect(dibaca.kode).toBeUndefined()
    expect(dibaca.emiten).toBeUndefined()
    expect(dibaca.nama).toBe('Modelku')
  })
  it('jenis chart & rentang ikut disimpan dan terbaca kembali', () => {
    const disimpan = simpanTemplate([], 'Modelku',
      { indikator: [instMA(20)], pola: [], jenisChart: 'garis', rentang: '3 thn' })
    const bolakBalik = uraiTemplate(JSON.stringify(disimpan))[0]
    expect(bolakBalik.jenisChart).toBe('garis')
    expect(bolakBalik.rentang).toBe('3 thn')
  })
  it('template lama tanpa jenisChart/rentang tetap terbaca — bukan ditolak', () => {
    const lama = uraiTemplate(JSON.stringify([templateContoh('Lama')]))
    expect(lama).toHaveLength(1)
    expect(lama[0].jenisChart).toBeUndefined()
    expect(lama[0].rentang).toBeUndefined()
  })
})

/* ---------------- OBV ---------------- */

describe('hitungOBV', () => {
  it('menambah volume saat tutup naik, mengurangi saat turun, diam saat sama', () => {
    //        10   11(+)  11(=)  9(-)   12(+)
    // vol:  100   200    300    400    500
    // obv:    0   200    200   -200     300
    expect(hitungOBV([10, 11, 11, 9, 12], [100, 200, 300, 400, 500]))
      .toEqual([0, 200, 200, -200, 300])
  })
  it('titik pertama 0, bukan volume hari itu — arah hari pertama tak bisa ditentukan', () => {
    expect(hitungOBV([10, 9], [999, 100])).toEqual([0, -100])
  })
  it('deret kosong -> array kosong, bukan lemparan galat', () => {
    expect(hitungOBV([], [])).toEqual([])
  })
  it('lewat hitungInstans: OBV tak berparameter dan memakai volume', () => {
    const inst = buatInstans('obv', SPEK_INDIKATOR.obv.param, 'o', 0)
    expect(inst.param).toEqual({})
    expect(labelInstansIndikator(inst)).toBe('OBV')
    const garis = hitungInstans(inst, [10, 11, 9], [100, 200, 300])
    expect(garis).toHaveLength(1)
    expect(garis[0].nilai).toEqual([0, 200, -100])
  })
})

/* ---------------- Pola: Lonjakan Volume ---------------- */

const PV: ParamLonjakanVolume = { periode: 5, ambang: 1.5, ambangKuat: 3, naikMin: 2 }

/** Deret datar: harga 100 tiap hari, volume 1.000 tiap hari — pembagi RVOL
 *  jadi persis 1.000 dan tiap angka di bawah bisa dihitung tangan. */
function dasarVolume(n: number) {
  const harga = new Array(n).fill(100)
  const volume = new Array(n).fill(1_000)
  return { harga, volume }
}

describe('cariLonjakanVolume', () => {
  it('TERKONFIRMASI: harga naik >= ambang persen dan RVOL >= ambang', () => {
    const { harga, volume } = dasarVolume(10)
    harga[7] = 103 // +3% dari 100
    volume[7] = 2_000 // RVOL 2,0
    const hasil = cariLonjakanVolume(lilinDari(harga), volume, PV)
    expect(hasil.map((x) => x.status)).toEqual(['terkonfirmasi'])
    expect(hasil[0].rvol).toBeCloseTo(2, 6)
    expect(hasil[0].ubahPersen).toBeCloseTo(3, 6)
    expect(hasil[0].rataVolume).toBeCloseTo(1_000, 6)
    expect(hasil[0].waktu).toBe('2024-01-08')
  })

  it('KUAT: RVOL >= ambang kuat ditandai berbeda dari terkonfirmasi biasa', () => {
    const { harga, volume } = dasarVolume(10)
    harga[7] = 103
    volume[7] = 4_000 // RVOL 4,0
    const hasil = cariLonjakanVolume(lilinDari(harga), volume, PV)
    expect(hasil.map((x) => x.status)).toEqual(['kuat'])
    expect(hasil[0].rvol).toBeCloseTo(4, 6)
  })

  it('TAK TERKONFIRMASI: harga naik tapi volumenya di BAWAH rata-rata', () => {
    const { harga, volume } = dasarVolume(10)
    harga[7] = 105 // +5%
    volume[7] = 400 // RVOL 0,4 — naik tanpa dukungan volume
    const hasil = cariLonjakanVolume(lilinDari(harga), volume, PV)
    expect(hasil.map((x) => x.status)).toEqual(['takTerkonfirmasi'])
    expect(hasil[0].rvol).toBeCloseTo(0.4, 6)
  })

  it('DITOLAK: volume melonjak tapi harga TURUN — itu keadaan lain', () => {
    const { harga, volume } = dasarVolume(10)
    // Turunnya BERTAHAN sampai ujung deret. Kalau cuma satu hari, hari
    // berikutnya memantul balik ke 100 dan pantulan itu sendiri kenaikan
    // 6,4% yang sah — yang tertangkap bukan lagi kasus yang sedang diuji.
    for (let i = 7; i < harga.length; i++) harga[i] = 94 // -6% lalu datar
    volume[7] = 9_000 // RVOL 9,0
    expect(cariLonjakanVolume(lilinDari(harga), volume, PV)).toEqual([])
  })

  it('DITOLAK: kenaikan di bawah ambang persen, sebesar apa pun volumenya', () => {
    const { harga, volume } = dasarVolume(10)
    harga[7] = 100.5 // +0,5%, di bawah naikMin 2
    volume[7] = 9_000
    expect(cariLonjakanVolume(lilinDari(harga), volume, PV)).toEqual([])
  })

  it('DITOLAK: naik, volume di atas rata-rata tapi belum sampai ambang', () => {
    const { harga, volume } = dasarVolume(10)
    harga[7] = 103
    volume[7] = 1_200 // RVOL 1,2 — antara 1 dan ambang 1,5
    expect(cariLonjakanVolume(lilinDari(harga), volume, PV)).toEqual([])
  })

  it('hari bervolume nol TIDAK merusak rata-rata — ia tak pernah sampai ke sini', () => {
    // Dibangun dari baris OHLC MENTAH lalu disaring keDataLilinVolume, persis
    // seperti jalur di komponen. Baris ke-4 hari tanpa perdagangan (volume 0,
    // harga tak bergerak); kalau ikut terhitung, pembagi RVOL turun dari 1.000
    // jadi 800 dan RVOL 2,0 di bawah akan terbaca 2,5 — pola yang angkanya
    // meyakinkan tapi salah.
    const mentah: BarisOhlc[] = []
    for (let i = 0; i < 12; i++) {
      const tgl = `2024-02-${String(i + 1).padStart(2, '0')}`
      if (i === 3) mentah.push([tgl, 100, 100, 100, 100, 0]) // tanpa perdagangan
      else mentah.push([tgl, 99, 101, 98, 100, 1_000])
    }
    // Hari lonjakan: +3% dengan volume 2.000.
    mentah[10] = ['2024-02-11', 100, 104, 100, 103, 2_000]
    const { lilin, volume } = keDataLilinVolume(mentah, 'H', 'M')
    expect(lilin).toHaveLength(11) // satu baris terbuang
    const hasil = cariLonjakanVolume(lilin, volume.map((v) => v.value), PV)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].rvol).toBeCloseTo(2, 6)
    expect(hasil[0].rataVolume).toBeCloseTo(1_000, 6)
  })

  it('rata-rata pembagi TIDAK memasukkan hari itu sendiri', () => {
    // Kalau hari itu ikut, pembagi jadi (5*1.000 + 6.000)/6 = 1.833 dan RVOL
    // 6,0 akan terbaca 3,27 — lonjakan diredam oleh dirinya sendiri.
    const { harga, volume } = dasarVolume(10)
    harga[7] = 103
    volume[7] = 6_000
    expect(cariLonjakanVolume(lilinDari(harga), volume, PV)[0].rvol).toBeCloseTo(6, 6)
  })

  it('panjang lilin & volume tak sama -> tak ada temuan, bukan angka ngawur', () => {
    expect(cariLonjakanVolume(lilinDari([1, 2, 3]), [1, 2], PV)).toEqual([])
  })
})

describe('penandaDiSekitar', () => {
  // Empat lilin berurutan; hari libur SENGAJA ada di tengah (5 lalu 8 Jan)
  // supaya terlihat bahwa jangkauannya indeks lilin, bukan hari kalender.
  const waktu = ['2024-01-03', '2024-01-04', '2024-01-05', '2024-01-08', '2024-01-09']
  const indeks = new Map(waktu.map((t, i) => [t, i]))
  const penanda = [
    { time: '2024-01-03', teks: 'Lembah 1' },
    { time: '2024-01-05', teks: 'Leher' },
    { time: '2024-01-08', teks: 'Lembah 2' },
  ]

  it('menyebut DUA penanda berdempetan, bukan salah satu saja', () => {
    // Kursor di 5 Jan: lehernya sendiri + Lembah 2 yang cuma satu lilin di
    // kanannya. Inilah tumpukan yang dulu jadi label saling tembus.
    expect(penandaDiSekitar(penanda, indeks, '2024-01-05').map((p) => p.teks))
      .toEqual(['Leher', 'Lembah 2'])
  })

  it('radius 0 cuma penanda di lilin itu sendiri', () => {
    expect(penandaDiSekitar(penanda, indeks, '2024-01-05', 0).map((p) => p.teks)).toEqual(['Leher'])
  })

  it('lilin tanpa penanda di sekitarnya -> kosong, tooltip tak muncul', () => {
    expect(penandaDiSekitar(penanda, indeks, '2024-01-09', 0)).toEqual([])
  })

  it('libur bursa tak melebarkan jangkauan — jaraknya indeks lilin', () => {
    // 8 Jan berjarak 3 HARI dari 5 Jan tapi cuma 1 LILIN; keduanya harus ikut.
    expect(penandaDiSekitar(penanda, indeks, '2024-01-08').map((p) => p.teks))
      .toEqual(['Leher', 'Lembah 2'])
  })

  it('waktu di luar rentang yang tergambar -> kosong, bukan galat', () => {
    expect(penandaDiSekitar(penanda, indeks, '2023-12-31')).toEqual([])
  })
})

/* ------------------------------------------------------------------ *
 * Empat indikator dari pustaka + uji SILANG RSI.
 * ------------------------------------------------------------------ */

/** Deret lilin harian buatan yang deterministik (bukan Math.random — uji yang
 *  datanya berubah tiap jalan tak bisa dipakai membandingkan apa pun). Mulai
 *  1 Jan 2024 (Senin), maju satu hari kalender per lilin. */
function lilinUji(n: number): LilinData[] {
  const out: LilinData[] = []
  let p = 1000
  for (let i = 0; i < n; i++) {
    const r = Math.sin(i * 1.7) * 12 + Math.cos(i * 0.4) * 5
    p = Math.max(50, p + r)
    const t = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10)
    out.push({ time: t, open: p - r / 2, high: p + 6, low: p - 7, close: p })
  }
  return out
}

describe('uji silang RSI: kode PAPAN vs pustaka lightweight-charts-indicators', () => {
  it('keduanya sepakat sampai batas ketelitian bilangan pecahan', async () => {
    // Kalau uji ini gagal, JANGAN diam-diam memilih salah satunya — itu berarti
    // salah satu dari keduanya keliru dan kita belum tahu yang mana.
    const { RSI } = await import('lightweight-charts-indicators')
    const lilin = lilinUji(200)
    const bars = lilin.map((l) => ({
      time: Math.floor(Date.parse(`${l.time}T00:00:00Z`) / 1000),
      open: l.open, high: l.high, low: l.low, close: l.close, volume: 1000,
    }))
    const pustaka = RSI.calculate(bars, { length: 14 }).plots.plot0.map((x) => x.value)
    const kita = hitungRSI(lilin.map((l) => l.close), 14)

    // Titik pertama yang berisi harus sama — beda satu lilin saja berarti salah
    // satunya memakai konvensi bibit yang berbeda.
    const adaNilai = (v: number | null) => v !== null && Number.isFinite(v)
    expect(pustaka.findIndex(adaNilai)).toBe(kita.findIndex(adaNilai))

    let selisihMaks = 0
    let dibandingkan = 0
    for (let i = 0; i < lilin.length; i++) {
      if (!adaNilai(pustaka[i]) || !adaNilai(kita[i])) continue
      dibandingkan++
      selisihMaks = Math.max(selisihMaks, Math.abs((pustaka[i] as number) - (kita[i] as number)))
    }
    expect(dibandingkan).toBeGreaterThan(180)
    // 1e-9 pada skala 0-100: jauh lebih ketat dari yang bisa dilihat mata, tapi
    // longgar terhadap urutan penjumlahan pecahan yang memang boleh berbeda.
    expect(selisihMaks).toBeLessThan(1e-9)
  })
})

describe('indikator pustaka', () => {
  const lilin = lilinUji(120)
  const volume = lilin.map((_, i) => 1000 + i)
  const buat = (jenis: 'stoch' | 'stochrsi' | 'wpr' | 'vwap') =>
    buatInstans(jenis, SPEK_INDIKATOR[jenis].param, `i-${jenis}`, 0)
  // Katalog dimuat sekali untuk seluruh blok — di peramban ia datang lewat
  // impor dinamis, di sini lewat fungsi yang sama persis.
  let katalog: Awaited<ReturnType<typeof muatKatalog>>
  beforeAll(async () => { katalog = await muatKatalog() })

  it('Stochastic: dua deret (%K dan %D), keduanya 0-100', () => {
    const garis = hitungInstans(buat('stoch'), lilin.map((l) => l.close), volume, lilin, katalog)
    expect(garis.map((g) => g.nama)).toEqual(['Stoch 14/1/3 %K', 'Stoch 14/1/3 %D'])
    expect(garis[1].bantu).toBe(true)
    const isi = garis[0].nilai.filter((v): v is number => v !== null)
    expect(isi.length).toBeGreaterThan(100)
    expect(Math.min(...isi)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...isi)).toBeLessThanOrEqual(100)
  })

  it('StochRSI: dua deret, panjangnya sejajar lilin', () => {
    const garis = hitungInstans(buat('stochrsi'), lilin.map((l) => l.close), volume, lilin, katalog)
    expect(garis).toHaveLength(2)
    expect(garis[0].nilai).toHaveLength(lilin.length)
    expect(garis[0].nilai.filter((v) => v !== null).length).toBeGreaterThan(50)
  })

  it('Williams %R: satu deret, seluruhnya di antara -100 dan 0', () => {
    const garis = hitungInstans(buat('wpr'), lilin.map((l) => l.close), volume, lilin, katalog)
    expect(garis).toHaveLength(1)
    const isi = garis[0].nilai.filter((v): v is number => v !== null)
    expect(isi.length).toBeGreaterThan(100)
    expect(Math.min(...isi)).toBeGreaterThanOrEqual(-100)
    expect(Math.max(...isi)).toBeLessThanOrEqual(0)
  })

  it('VWAP: jangkar pekan dan bulan menghasilkan garis yang BERBEDA', () => {
    // Kalau keduanya sama, jangkarnya tak terbaca sama sekali — yang persis
    // terjadi kalau waktunya dikirim sebagai nomor urut lilin, bukan tanggal.
    const bulan = buat('vwap')
    const pekan = buat('vwap')
    pekan.param.jangkar = 1
    const gB = hitungInstans(bulan, lilin.map((l) => l.close), volume, lilin, katalog)[0]
    const gP = hitungInstans(pekan, lilin.map((l) => l.close), volume, lilin, katalog)[0]
    expect(gB.nama).toBe('VWAP bulan')
    expect(gP.nama).toBe('VWAP pekan')
    expect(gB.nilai).not.toEqual(gP.nilai)
    // VWAP dimulai sejak lilin pertama (tak ada warm-up) dan selalu berada di
    // sekitar harga — kalau ia jatuh ke nol, pemetaan waktunya yang meleset.
    const isi = gB.nilai.filter((v): v is number => v !== null)
    expect(isi).toHaveLength(lilin.length)
    expect(Math.min(...isi)).toBeGreaterThan(0)
  })

  it('tanpa lilin: deret kosong, bukan angka tebakan', () => {
    expect(hitungInstans(buat('wpr'), [10, 11, 12], [], [], katalog)[0].nilai).toEqual([])
  })

  it('tanpa katalog (belum termuat): deret kosong, bukan galat', () => {
    // Keadaan nyata di peramban selama unduhan katalog berjalan.
    const garis = hitungInstans(buat('stoch'), lilin.map((l) => l.close), volume, lilin, null)
    expect(garis).toHaveLength(1)
    expect(garis[0].nilai).toEqual([])
  })
})

/* ------------------------------------------------------------------ *
 * Pola Musiman.
 * ------------------------------------------------------------------ */

describe('cariMusiman', () => {
  // 300 hari kalender berturut-turut: akhir pekan ikut ada di dalamnya dan
  // HARUS tersaring sendiri, sama seperti ringkasHarian.
  const lilin = lilinUji(300)

  it('penanda jatuh PERSIS di hari yang dipilih', () => {
    for (let hari = 0; hari < 5; hari++) {
      const m = cariMusiman(lilin, hari)
      expect(m).not.toBeNull()
      expect(m!.waktu.length).toBeGreaterThan(30)
      for (const t of m!.waktu) {
        // getUTCDay: 1=Senin … 5=Jumat.
        expect(new Date(`${t}T00:00:00Z`).getUTCDay()).toBe(hari + 1)
      }
    }
  })

  it('jumlah penanda = n yang disebut tooltip — bukan dua hitungan berbeda', () => {
    for (let hari = 0; hari < 5; hari++) {
      const m = cariMusiman(lilin, hari)!
      expect(m.waktu).toHaveLength(m.ringkas.n)
    }
  })

  it('angkanya datang dari ringkasHarian, bukan hitungan kedua', async () => {
    const { ringkasHarian } = await import('../seasonality')
    const tutup = Object.fromEntries(lilin.map((l) => [l.time, l.close]))
    const acuan = ringkasHarian('X', tutup)!
    const m = cariMusiman(lilin, 2)!
    expect(m.ringkas).toEqual(acuan.perHari[2])
    expect(m.totalObservasi).toBe(acuan.totalObservasi)
  })

  it('rentang perhitungan mengikuti lilin yang dikirim', () => {
    // Potongan separuh terakhir harus menghasilkan n yang lebih kecil — bukti
    // angkanya benar-benar dihitung dari yang tergambar, bukan dari seluruh
    // riwayat yang kebetulan ada di berkas.
    const penuh = cariMusiman(lilin, 0)!
    const separuh = cariMusiman(lilin.slice(150), 0)!
    expect(separuh.ringkas.n).toBeLessThan(penuh.ringkas.n)
    expect(separuh.waktu[0] >= lilin[150].time).toBe(true)
  })

  it('lilin terlalu sedikit -> null, bukan angka dari udara', () => {
    expect(cariMusiman(lilin.slice(0, 1), 0)).toBeNull()
  })

  it('label instans menyebut harinya', () => {
    const inst = buatInstans('musiman', SPEK_POLA.musiman.param, 'i', 0)
    expect(labelInstansPola(inst)).toBe('Musiman · Senin')
    inst.param.hari = 4
    expect(labelInstansPola(inst)).toBe('Musiman · Jumat')
  })
})

/* ------------------------------------------------------------------ *
 * Katalog pustaka (457 entri, dibaca dari registry).
 * ------------------------------------------------------------------ */

describe('katalogIndikator', () => {
  it('memuat ratusan entri, semuanya berkategori & punya deret keluaran', async () => {
    const k = await muatKatalog()
    expect(k.size).toBeGreaterThan(300)
    for (const e of k.values()) {
      expect(e.kategori).toBeTruthy()
      expect(e.judulPlot.length).toBeGreaterThan(0)
      expect(e.judulPlot).toHaveLength(e.kunciPlot.length)
      expect(typeof e.diPanelHarga).toBe('boolean')
    }
  })

  it('kategori registry semuanya punya terjemahan — kalau gagal, ada kategori BARU', async () => {
    // Bukan uji kosmetik: kategori yang tak dikenal masih tampil (dengan nama
    // Inggrisnya), dan uji inilah satu-satunya yang memberitahu bahwa versi
    // pustaka berikutnya menambah kelompok yang perlu diterjemahkan.
    const k = await muatKatalog()
    const dikenal = new Set(KATEGORI.map(([ing]) => ing))
    const asing = [...new Set([...k.values()].map((e) => e.kategori))].filter((c) => !dikenal.has(c))
    expect(asing).toEqual([])
  })

  it('yang rumusnya sudah kita punya tetap ADA di peta (dipakai empat kurasi), tapi ditandai', async () => {
    const k = await muatKatalog()
    // Peta menyimpan semuanya; menu yang menyaring — lihat catatan di
    // muatKatalog. Yang penting: id-id ini benar-benar ada, kalau tidak empat
    // indikator kurasi berhenti menggambar tanpa satu pun galat.
    for (const id of ID_SUDAH_ADA) expect(k.has(id)).toBe(true)
  })

  it('ruas masukan: angka jadi kolom, daftar pilihan jadi chip, sisanya dilewati', () => {
    expect(keSpekParam({ id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 }))
      .toMatchObject({ kunci: 'length', bawaan: 14, min: 1, bulat: true, bandingLilin: true })
    expect(keSpekParam({ id: 'mult', type: 'float', title: 'StdDev', defval: 2 }))
      .toMatchObject({ bulat: false, bandingLilin: false })
    const pilihan = keSpekParam({
      id: 'anchor', type: 'string', title: 'Anchor', defval: '1W', options: ['1D', '1W', '1M'],
    })
    // Bawaannya INDEKS pilihan, bukan teksnya.
    expect(pilihan).toMatchObject({ bawaan: 1, min: 0, maks: 2 })
    expect(pilihan?.pilihan?.map((o) => o.label)).toEqual(['1D', '1W', '1M'])
    expect(keSpekParam({ id: 'src', type: 'source', title: 'Source', defval: 'close' })).toBeNull()
    expect(keSpekParam({ id: 'show', type: 'bool', title: 'Show', defval: false })).toBeNull()
  })

  it('indeks pilihan dikembalikan jadi teks aslinya saat memanggil pustaka', () => {
    const ruas = [
      { id: 'anchor' as const, type: 'string' as const, title: 'A', defval: '1D', options: ['1D', '1W', '1M'] },
      { id: 'length' as const, type: 'int' as const, title: 'L', defval: 14 },
      { id: 'src' as const, type: 'source' as const, title: 'S', defval: 'close' },
    ]
    expect(keMasukanPustaka(ruas, { anchor: 2, length: 20, src: 0 }))
      .toEqual({ anchor: '1M', length: 20 })
  })

  it('entri katalog benar-benar menghitung: SuperTrend menggambar deret berisi', async () => {
    const k = await muatKatalog()
    const inst = buatInstans('p:supertrend', k.get('supertrend')!.param, 'i-st', 0)
    const lilin = lilinUji(120)
    const garis = hitungInstans(inst, lilin.map((l) => l.close), lilin.map(() => 1000), lilin, k)
    expect(garis.length).toBeGreaterThan(0)
    expect(garis[0].nilai.filter((v) => v !== null).length).toBeGreaterThan(50)
    // Label memakai nama PENDEK pustaka + nilai ruas angkanya ('ST 10/3').
    expect(labelInstansIndikator(inst, k)).toBe(`${k.get('supertrend')!.singkat} 10/3`)
  })

  it('instans katalog tanpa katalog: label jatuh ke id, deret kosong, tak melempar', () => {
    const inst = buatInstans('p:supertrend', [], 'i-st', 0)
    expect(labelInstansIndikator(inst)).toBe('supertrend')
    expect(hitungInstans(inst, [1, 2, 3], [], [], null)[0].nilai).toEqual([])
  })

  it('template berisi jenis `p:` tetap terbaca walau katalognya belum dimuat', () => {
    const t = [{
      versi: VERSI_TEMPLATE, nama: 'Punyaku', bawaan: false,
      indikator: [{ id: 'a', jenis: 'p:supertrend', param: { length: 10 }, warna: '--amber', tampil: true }],
      pola: [],
    }]
    expect(uraiTemplate(JSON.stringify(t))[0].indikator[0].jenis).toBe('p:supertrend')
    // Jenis karangan yang BUKAN `p:` tetap ditolak seperti sebelumnya.
    const palsu = JSON.stringify([{ ...t[0], indikator: [{ ...t[0].indikator[0], jenis: 'entahapa' }] }])
    expect(uraiTemplate(palsu)).toEqual([])
  })
})
