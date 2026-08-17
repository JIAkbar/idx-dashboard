import { describe, expect, it } from 'vitest'
import {
  keDataLilinVolume, batasBawahRentang, potongRentang, RENTANG_GRAFIK, RENTANG_BAWAAN,
  hitungMA, hitungEMA, hitungRSI, hitungMACD, hitungBollinger, keSeriGaris,
  SPEK_INDIKATOR, buatInstans, galatNilaiParam, galatInstans, labelInstansIndikator,
  hitungInstans, PALET_INDIKATOR,
  hitungATR, cariPivotRendah, cariPivotTinggi, cariDoubleBottom,
  type InstansIndikator, type SpekParam, type LilinData, type ParamDoubleBottom,
} from './grafikEmiten'
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
