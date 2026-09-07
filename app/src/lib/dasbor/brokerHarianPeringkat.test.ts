import { describe, expect, it } from 'vitest'
import { peringkatBroker } from './brokerHarian'
import type { BrokerRow } from './brokerSummaryData'

const baris = (kode: string, vol: number, nilai: number, freq: number): BrokerRow =>
  ({ kode, nama: `Sekuritas ${kode}`, vol, nilai, freq, rn: 0, rf: 0 })

describe('peringkatBroker — kontrak satuan & porsi (#66 A)', () => {
  it('lembar dibagi sejuta, rupiah dibagi semiliar, frekuensi apa adanya', () => {
    // Judul kolomnya berbunyi "Juta Saham" dan "Miliar IDR". Angka mentah di
    // kolom itu benar nilainya dan salah labelnya — bentuk kesalahan yang tak
    // membuat siapa pun curiga.
    const rows = [baris('XL', 14_159_000_000, 3_200_000_000_000, 1_234)]
    expect(peringkatBroker(rows, 'vol')[0].v).toBe(14159)
    expect(peringkatBroker(rows, 'val')[0].v).toBe(3200)
    expect(peringkatBroker(rows, 'freq')[0].v).toBe(1234)
  })

  it('porsi dihitung dari SELURUH broker, bukan dari sepuluh besar', () => {
    // 12 broker dengan volume sama: tiap broker 1/12 = 8,33%. Kalau
    // penyebutnya sepuluh besar, angkanya jadi 10% — dan jumlah kolom persen
    // di layar tepat 100%, yang justru membuatnya terlihat benar.
    const rows = Array.from({ length: 12 }, (_, i) => baris(`B${i}`, 1e6, 1e9, 1))
    const hasil = peringkatBroker(rows, 'vol')
    expect(hasil).toHaveLength(10)
    expect(hasil[0].p).toBe(8.33)
  })

  it('urut menurun per metrik yang diminta, bukan per nilai rupiah', () => {
    const rows = [
      baris('A', 1e6, 9e9, 5),
      baris('B', 9e6, 1e9, 1),
    ]
    expect(peringkatBroker(rows, 'vol').map((x) => x.cd)).toEqual(['B', 'A'])
    expect(peringkatBroker(rows, 'val').map((x) => x.cd)).toEqual(['A', 'B'])
    expect(peringkatBroker(rows, 'freq').map((x) => x.cd)).toEqual(['A', 'B'])
  })

  it('daftar kosong tidak melempar dan tidak membagi nol', () => {
    expect(peringkatBroker([], 'vol')).toEqual([])
  })

  it('dua desimal, sama seperti rollup rentang', () => {
    const rows = [baris('A', 1_234_567, 1_234_567_890, 3), baris('B', 1e6, 1e9, 1)]
    expect(peringkatBroker(rows, 'vol')[0].v).toBe(1.23)
    expect(peringkatBroker(rows, 'val')[0].v).toBe(1.23)
  })
})
