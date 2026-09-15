import { describe, expect, it } from 'vitest'
import { cariTanggalPembanding, hitungPeriodePct, jendelaBaku, opsiRentangBaku, rentangBaku } from './periode'
import { agregatBrokerRows } from './brokerHarian'

const tanggal = [
  { stem: 'ds_260107', date_iso: '2026-01-07', ihsg: 8000, ihsg_pct: 0.1, trading_day: 4 },
  { stem: 'ds_260108', date_iso: '2026-01-08', ihsg: 8100, ihsg_pct: 1.2, trading_day: 5 },
  { stem: 'ds_260109', date_iso: '2026-01-09', ihsg: 8050, ihsg_pct: -0.6, trading_day: 6 },
  { stem: 'ds_260212', date_iso: '2026-02-12', ihsg: 8300, ihsg_pct: 0.4, trading_day: 26 },
  // entri tambahan buat cakupan tes 3 bulan (hariMundur=91) — preset b3 di rentangPreset
  { stem: 'ds_260409', date_iso: '2026-04-09', ihsg: 8500, ihsg_pct: 0.3, trading_day: 65 },
] as never[]

describe('cariTanggalPembanding', () => {
  it('ambil hari bursa terakhir yang <= tanggal target (bukan pas 30 hari)', () => {
    // target = 2026-02-12 - 30 hari = 2026-01-13, terdekat <= itu = 2026-01-09
    expect(cariTanggalPembanding(tanggal, '2026-02-12', 30)?.stem).toBe('ds_260109')
  })

  it('null kalau tanggal aktif ada di awal riwayat data — bukan 0', () => {
    expect(cariTanggalPembanding(tanggal, '2026-01-08', 30)).toBeNull()
  })

  it('null kalau daftar tanggal kosong', () => {
    expect(cariTanggalPembanding([], '2026-02-12', 30)).toBeNull()
  })

  it('ambil hari bursa terakhir yang <= tanggal target (91 hari, 3 Bulan)', () => {
    // target = 2026-04-09 - 91 hari = 2026-01-08, pas kena entri itu
    expect(cariTanggalPembanding(tanggal, '2026-04-09', 91)?.stem).toBe('ds_260108')
  })

  it('null kalau mundur 91 hari lewat awal riwayat data — bukan 0 atau tanggal terdekat', () => {
    // target = 2026-01-08 - 91 hari = 2025-10-09, jauh sebelum entri paling awal (2026-01-07)
    expect(cariTanggalPembanding(tanggal, '2026-01-08', 91)).toBeNull()
  })
})

describe('hitungPeriodePct', () => {
  it('menghitung persen sekarang vs pembanding', () => {
    expect(hitungPeriodePct(8300, 8000)).toBeCloseTo(3.75, 6)
  })

  it('memberi null kalau data pembanding tidak ada — jangan diam-diam jadi 0', () => {
    expect(hitungPeriodePct(8300, undefined)).toBeNull()
    expect(hitungPeriodePct(8300, null)).toBeNull()
  })

  it('memberi null kalau nilai pembanding nol', () => {
    expect(hitungPeriodePct(8300, 0)).toBeNull()
  })
})

describe('rentangBaku (#209 tahap 2, pengganti rentangPreset #75)', () => {
  // Fikstur SAMA dengan `jendelaBaku` di bawah (bukan larik `tanggal` di
  // atas, yang sengaja renggang untuk menguji fencepost `cariTanggalPembanding`
  // — renggangnya membuat "1 Bulan" di situ kebetulan jatuh ke satu hari
  // saja, membingungkan untuk contoh). Jendelanya sudah diverifikasi lewat
  // `jendelaBaku`; yang diuji di sini cukup `rentangBaku` MEMBUANG
  // `pembanding` dengan benar — itu satu-satunya beda keduanya.
  const T = ['2025-12-30', '2025-12-31', '2026-01-02', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15']

  it('1 Minggu (w1)', () => {
    expect(rentangBaku(T, '2026-09-15', 'w1')).toEqual({ mulai: '2026-09-09', akhir: '2026-09-15' })
  })

  it('1 Hari (h1)', () => {
    expect(rentangBaku(T, '2026-09-15', 'h1')).toEqual({ mulai: '2026-09-15', akhir: '2026-09-15' })
  })

  it('Sejak 1 Jan (kunci sejakJan, dieja "YTD" sebagai pil)', () => {
    expect(rentangBaku(T, '2026-09-15', 'sejakJan')).toEqual({ mulai: '2026-01-02', akhir: '2026-09-15' })
  })

  it('Semua = seluruh riwayat, tanpa syarat panjang', () => {
    expect(rentangBaku(T, '2026-09-15', 'semua')).toEqual({ mulai: '2025-12-30', akhir: '2026-09-15' })
  })

  it('data tidak cukup (riwayat lebih pendek dari preset) → null, BUKAN dijepit ke hari berdata pertama seperti rentangPreset lama', () => {
    expect(rentangBaku(T, '2026-09-15', 'y2')).toBeNull()
    expect(rentangBaku([], '2026-01-07', 'sejakJan')).toBeNull()
  })
})

describe('agregatBrokerRows (#75)', () => {
  const hari1 = [
    { kode: 'YP', nama: 'Mirae', vol: 10, nilai: 100, freq: 5, rn: 1, rf: 1 },
    { kode: 'NI', nama: 'BNI', vol: 4, nilai: 40, freq: 9, rn: 2, rf: 2 },
  ]
  const hari2 = [
    { kode: 'NI', nama: 'BNI', vol: 6, nilai: 70, freq: 1, rn: 1, rf: 2 },
    { kode: 'CC', nama: 'Mandiri', vol: 1, nilai: 60, freq: 8, rn: 2, rf: 1 },
  ]

  it('SUM vol/nilai/freq per broker + ranking ulang atas totalnya', () => {
    const agg = agregatBrokerRows([hari1, hari2])
    // NI total nilai 110 > YP 100 > CC 60 — rank nilai ikut total, bukan harian
    expect(agg.map((b) => [b.kode, b.vol, b.nilai, b.freq, b.rn])).toEqual([
      ['NI', 10, 110, 10, 1],
      ['YP', 10, 100, 5, 2],
      ['CC', 1, 60, 8, 3],
    ])
    // rank frekuensi: NI 10 > CC 8 > YP 5
    expect(agg.find((b) => b.kode === 'NI')?.rf).toBe(1)
    expect(agg.find((b) => b.kode === 'CC')?.rf).toBe(2)
    expect(agg.find((b) => b.kode === 'YP')?.rf).toBe(3)
  })

  it('tidak memutasi baris harian sumber (baris itu dicache per tanggal)', () => {
    agregatBrokerRows([hari1, hari2])
    expect(hari1[0].nilai).toBe(100)
    expect(hari2[0].nilai).toBe(70)
  })
})

describe('opsiRentangBaku (#209)', () => {
  it('sepuluh opsi, urutan Johan, Semua di ujung', () => {
    const o = opsiRentangBaku({ b1: 'bulan', y1: 'tahun' })
    expect(o.map((x) => x.label)).toEqual(['1 Hari', '1 Minggu', '2 Minggu', '1 Bulan', '3 Bulan', '6 Bulan', 'YTD', '1 Tahun', '2 Tahun', 'Semua'])
  })
  it('kunci yang dipetakan aktif dengan id halaman, sisanya nonaktif', () => {
    const o = opsiRentangBaku({ b1: 'bulan', semua: 'max' })
    expect(o.find((x) => x.label === '1 Bulan')).toMatchObject({ id: 'bulan' })
    expect(o.find((x) => x.label === '1 Bulan')?.nonaktif).toBeUndefined()
    expect(o.find((x) => x.label === '1 Hari')?.nonaktif).toBe(true)
    expect(o.find((x) => x.label === 'Semua')).toMatchObject({ id: 'max' })
  })
  it('Semua nonaktif kalau halaman tak memetakannya', () => {
    expect(opsiRentangBaku({ b1: 'b1' }).at(-1)?.nonaktif).toBe(true)
  })
})

describe('jendelaBaku (#209 satu definisi)', () => {
  // Hari bursa contoh: akhir Des 2025, lalu 7-15 Sep 2026 tanpa akhir pekan.
  const T = ['2025-12-30', '2025-12-31', '2026-01-02', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15']
  it('1 Minggu dari Selasa: pembanding Selasa lalu, jendela Rabu-Selasa', () => {
    expect(jendelaBaku(T, '2026-09-15', 'w1')).toEqual({ pembanding: '2026-09-08', mulai: '2026-09-09', akhir: '2026-09-15' })
  })
  it('1 Hari: pembanding hari berdata sebelumnya, jendela hari aktif', () => {
    expect(jendelaBaku(T, '2026-09-15', 'h1')).toEqual({ pembanding: '2026-09-14', mulai: '2026-09-15', akhir: '2026-09-15' })
  })
  it('akhir di akhir pekan jatuh ke hari berdata terakhir', () => {
    expect(jendelaBaku(T, '2026-09-13', 'h1')).toEqual({ pembanding: '2026-09-10', mulai: '2026-09-11', akhir: '2026-09-11' })
  })
  it('YTD: pembanding hari berdata terakhir tahun lalu', () => {
    expect(jendelaBaku(T, '2026-09-15', 'sejakJan')).toEqual({ pembanding: '2025-12-31', mulai: '2026-01-02', akhir: '2026-09-15' })
  })
  it('Semua: tanpa pembanding, sejak hari berdata pertama', () => {
    expect(jendelaBaku(T, '2026-09-15', 'semua')).toEqual({ pembanding: null, mulai: '2025-12-30', akhir: '2026-09-15' })
  })
  it('data tidak cukup: null, bukan dipotong ke riwayat yang ada', () => {
    expect(jendelaBaku(T, '2026-09-15', 'y2')).toBeNull()
    expect(jendelaBaku(['2026-09-15'], '2026-09-15', 'h1')).toBeNull()
  })
})

describe('jendelaBaku: tanggal batas per label baku (#209, J20)', () => {
  // Hari kerja Senin-Jumat 2 Jan 2024 s.d. 15 Sep 2026 (libur bursa diabaikan: yang diuji aritmetika batasnya).
  const HARI: string[] = []
  for (let d = new Date('2024-01-02T00:00:00Z'); d <= new Date('2026-09-15T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay()
    if (w !== 0 && w !== 6) HARI.push(d.toISOString().slice(0, 10))
  }
  const AKHIR = '2026-09-15' // Selasa
  const kasus: Array<[Parameters<typeof jendelaBaku>[2], string, string | null, string]> = [
    // kunci, label, pembanding, mulai
    ['h1', '1 Hari: pembanding Senin 14 Sep', '2026-09-14', '2026-09-15'],
    ['w1', '1 Minggu: batas Selasa 8 Sep', '2026-09-08', '2026-09-09'],
    ['w2', '2 Minggu: batas Selasa 1 Sep', '2026-09-01', '2026-09-02'],
    ['b1', '1 Bulan: batas Minggu 16 Agu, pembanding Jumat 14 Agu', '2026-08-14', '2026-08-17'],
    ['b3', '3 Bulan: batas Selasa 16 Jun', '2026-06-16', '2026-06-17'],
    ['b6', '6 Bulan: batas Selasa 17 Mar', '2026-03-17', '2026-03-18'],
    ['sejakJan', 'YTD: pembanding Kamis 31 Des 2025', '2025-12-31', '2026-01-01'],
    ['y1', '1 Tahun: batas Senin 15 Sep 2025', '2025-09-15', '2025-09-16'],
    ['y2', '2 Tahun: batas Minggu 15 Sep 2024, pembanding Jumat 13 Sep 2024', '2024-09-13', '2024-09-16'],
    ['semua', 'Semua: sejak hari pertama', null, '2024-01-02'],
  ]
  for (const [kunci, judul, pembanding, mulai] of kasus) {
    it(judul, () => {
      expect(jendelaBaku(HARI, AKHIR, kunci)).toEqual({ pembanding, mulai, akhir: AKHIR })
    })
  }
})
