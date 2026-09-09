import { describe, expect, it } from 'vitest'
import {
  dariEpoch, keEpoch, keWaktuChart, dariWaktuChart, dariYahoo,
  rakitBar, kunci4Jam, kunciPekan, kunciBulan, KERANGKA, intraday,
} from './kerangkaWaktu'
import { cariMusiman, tutupSampai, type LilinData, type VolumeData } from './grafikEmiten'

const HIJAU = '#0f0'
const MERAH = '#f00'

/* ---------------- Waktu ---------------- */

describe('waktu intraday sebagai string WIB', () => {
  it('epoch -> string WIB, dan kembali PERSIS', () => {
    // 2026-08-18 02:30 UTC = 09:30 WIB. Bolak-baliknya wajib persis: nilai
    // inilah yang diserahkan ke kanvas dan yang dikembalikan crosshair, dan
    // selisih satu detik saja membuat pencarian nilai indikator di legenda
    // meleset ke titik yang tak ada.
    const epoch = Date.UTC(2026, 7, 18, 2, 30) / 1000
    expect(dariEpoch(epoch)).toBe('2026-08-18 09:30')
    expect(keEpoch('2026-08-18 09:30')).toBe(epoch)
  })

  it('harian tetap string tanggal, intraday jadi angka', () => {
    // lightweight-charts cuma mengenal string berformat tanggal; '2026-08-18
    // 09:30' akan ditolaknya, jadi yang berjam WAJIB berangkat sebagai epoch.
    expect(keWaktuChart('2026-08-18')).toBe('2026-08-18')
    expect(typeof keWaktuChart('2026-08-18 09:30')).toBe('number')
  })

  it('kembalinya dari kanvas menghasilkan waktu internal yang sama', () => {
    for (const w of ['2026-08-18', '2026-08-18 09:30', '2026-01-01 00:00']) {
      expect(dariWaktuChart(keWaktuChart(w))).toBe(w)
    }
  })
})

/* ---------------- Perakitan ---------------- */

/** Deret lilin 1 jam buatan, jam 09:00–16:00 satu hari. */
function lilinJam(tanggal: string, jam: number[]): { lilin: LilinData[]; volume: VolumeData[] } {
  const lilin = jam.map((j, i) => ({
    time: `${tanggal} ${String(j).padStart(2, '0')}:00`,
    open: 100 + i, high: 110 + i, low: 90 + i, close: 105 + i,
  }))
  return { lilin, volume: lilin.map((l) => ({ time: l.time, value: 10, color: HIJAU })) }
}

describe('rakitBar — 4 jam dari 1 jam', () => {
  const { lilin, volume } = lilinJam('2026-08-18', [9, 10, 11, 12, 13, 14, 15])

  it('mengelompokkan menurut JAM DINDING, bukan tiap empat lilin', () => {
    const h = rakitBar(lilin, volume, kunci4Jam, HIJAU, MERAH)
    // 09–11 masuk ember 08:00; 12–15 masuk ember 12:00.
    expect(h.lilin.map((l) => l.time)).toEqual(['2026-08-18 08:00', '2026-08-18 12:00'])
    expect(h.lilin.length).toBe(2)
  })

  it('buka dari lilin pertama, tutup dari terakhir, tinggi/rendah ekstremnya', () => {
    const h = rakitBar(lilin, volume, kunci4Jam, HIJAU, MERAH)
    const [ember1] = h.lilin
    expect(ember1.open).toBe(lilin[0].open)
    expect(ember1.close).toBe(lilin[2].close)
    expect(ember1.high).toBe(Math.max(...lilin.slice(0, 3).map((l) => l.high)))
    expect(ember1.low).toBe(Math.min(...lilin.slice(0, 3).map((l) => l.low)))
  })

  it('volume DIJUMLAH, bukan diambil salah satu', () => {
    // Volume yang cuma mengambil lilin terakhir adalah kegagalan senyap
    // sempurna: grafiknya tetap tergambar, batangnya cuma jadi seperempatnya,
    // dan RVOL yang dihitung darinya ikut salah tanpa satu pun galat.
    const h = rakitBar(lilin, volume, kunci4Jam, HIJAU, MERAH)
    expect(h.volume.map((v) => v.value)).toEqual([30, 40])
  })

  it('hari yang perdagangannya terpotong tetap masuk ember yang benar', () => {
    // Sesi setengah hari (libur, gangguan bursa): hitungan "tiap empat lilin"
    // akan menggeser seluruh sisa harinya ke ember yang salah.
    const pendek = lilinJam('2026-08-19', [9, 10])
    const h = rakitBar(
      [...lilin, ...pendek.lilin], [...volume, ...pendek.volume], kunci4Jam, HIJAU, MERAH,
    )
    expect(h.lilin.map((l) => l.time)).toEqual([
      '2026-08-18 08:00', '2026-08-18 12:00', '2026-08-19 08:00',
    ])
  })
})

describe('rakitBar — pekanan & bulanan dari harian', () => {
  // Senin 17 Agu 2026 s.d. Senin 24 Agu 2026.
  const tgl = ['2026-08-17', '2026-08-18', '2026-08-20', '2026-08-24', '2026-09-01']
  const lilin: LilinData[] = tgl.map((t, i) => ({
    time: t, open: 100, high: 120 + i, low: 80 - i, close: 110,
  }))
  const volume: VolumeData[] = tgl.map((t) => ({ time: t, value: 5, color: HIJAU }))

  it('ember pekanan = tanggal Senin pekan itu', () => {
    expect(kunciPekan('2026-08-20')).toBe('2026-08-17')
    // Minggu digeser 6 hari MUNDUR, bukan nol: getUTCDay-nya 0, dan rumus
    // naif akan melemparnya ke pekan berikutnya.
    expect(kunciPekan('2026-08-23')).toBe('2026-08-17')
    const h = rakitBar(lilin, volume, kunciPekan, HIJAU, MERAH)
    expect(h.lilin.map((l) => l.time)).toEqual(['2026-08-17', '2026-08-24', '2026-08-31'])
  })

  it('ember bulanan = tanggal 1 bulan itu', () => {
    expect(kunciBulan('2026-08-20')).toBe('2026-08-01')
    const h = rakitBar(lilin, volume, kunciBulan, HIJAU, MERAH)
    expect(h.lilin.map((l) => l.time)).toEqual(['2026-08-01', '2026-09-01'])
    expect(h.volume.map((v) => v.value)).toEqual([20, 5])
  })
})

/* ---------------- Yahoo ---------------- */

describe('dariYahoo', () => {
  const j = {
    chart: {
      result: [{
        timestamp: [Date.UTC(2026, 7, 18, 2, 0) / 1000, Date.UTC(2026, 7, 18, 2, 5) / 1000],
        indicators: {
          quote: [{
            open: [100, null], high: [110, 120], low: [95, 90], close: [105, 115], volume: [7, 9],
          }],
        },
      }],
    },
  }

  it('titik yang salah satu ruas OHLC-nya null DIBUANG, bukan ditambal', () => {
    // Yahoo menaruh null di menit tanpa transaksi. Menambalnya menghasilkan
    // lilin datar yang mengaku ada perdagangan — kesalahan yang sama persis
    // dengan `hariTanpaPerdagangan` di jalur harian.
    const h = dariYahoo(j, HIJAU, MERAH)
    expect(h.lilin.map((l) => l.time)).toEqual(['2026-08-18 09:00'])
    expect(h.volume[0].value).toBe(7)
  })

  it('respons kosong -> dua array kosong, bukan lemparan', () => {
    expect(dariYahoo({}, HIJAU, MERAH)).toEqual({ lilin: [], volume: [] })
    expect(dariYahoo({ chart: { result: [] } }, HIJAU, MERAH)).toEqual({ lilin: [], volume: [] })
  })
})

/* ---------------- Daftar kerangka ---------------- */

describe('KERANGKA', () => {
  it('tidak menawarkan 1 menit', () => {
    // Yahoo cuma menyimpan ±5 hari untuk interval satu menit; menu yang
    // menjanjikan "1 menit" lalu memberi seminggu data lebih buruk daripada
    // tak ada menunya.
    expect(KERANGKA.some((k) => k.id === ('1m' as string))).toBe(false)
  })

  it('tiap kerangka menyebut batas riwayatnya di judul tombolnya', () => {
    for (const k of KERANGKA) expect(k.judul).toMatch(/riwayat/i)
  })

  it('yang intraday persis 5m/15m/30m/1h/4h', () => {
    expect(KERANGKA.filter((k) => intraday(k.id)).map((k) => k.id))
      .toEqual(['5m', '15m', '30m', '1h', '4h'])
  })

  it('4h dirakit dari 1h — Yahoo tak punya interval empat jam', () => {
    expect(KERANGKA.find((k) => k.id === '4h')?.rakitDari).toBe('1h')
  })
})

/* ---------------- Musiman tidak boleh diam-diam salah di intraday ------- */

describe('cariMusiman pada lilin intraday', () => {
  it('menolak menghitung, bukan menghasilkan angka yang salah', () => {
    // Perhitungannya berkunci TANGGAL: 78 lilin lima menit di hari yang sama
    // saling menimpa di satu kunci dan yang tersisa cuma lilin terakhir tiap
    // hari. Angkanya tetap keluar dan tetap terlihat masuk akal — persis
    // kegagalan senyap yang dilarang CLAUDE.md.
    const lilin: LilinData[] = []
    for (const t of ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20']) {
      for (const jam of ['09:00', '10:00', '11:00']) {
        lilin.push({ time: `${t} ${jam}`, open: 100, high: 105, low: 95, close: 102 })
      }
    }
    expect(cariMusiman(lilin, 1)).toBeNull()
  })
})

describe('deret pembanding wajib dirakit ke kerangka yang sama (#57)', () => {
  /**
   * Kunci lilin pekanan jatuh di hari SENIN, tetapi TUTUP-nya tutup hari
   * terakhir ember itu. Membaca deret harian pada tanggal kunci karena itu
   * mengambil tutup pekan SEBELUMNYA - pergeseran satu ember penuh, tanpa
   * satu pun galat. Dua arahnya diuji sekaligus supaya yang salah tetap
   * terbaca sebagai salah kalau seseorang mengembalikannya nanti.
   */
  const harian: LilinData[] = [
    { time: '2026-08-17', open: 100, high: 101, low: 99, close: 100 },   // Senin
    { time: '2026-08-18', open: 100, high: 106, low: 99, close: 105 },
    { time: '2026-08-21', open: 105, high: 111, low: 104, close: 110 },  // Jumat
    { time: '2026-08-24', open: 110, high: 121, low: 109, close: 120 },  // Senin
    { time: '2026-08-28', open: 120, high: 131, low: 119, close: 130 },  // Jumat
  ]

  it('deret HARIAN dibaca di tanggal kunci memberi tutup ember SEBELUMNYA', () => {
    expect(kunciPekan('2026-08-28')).toBe('2026-08-24')
    // Tutup pekan 24 Agu yang sebenarnya 130 (tutup 28 Agu), bukan 120.
    expect(tutupSampai(harian, '2026-08-24')).toBe(120)
  })

  it('deret yang DIRAKIT dengan kunci yang sama memberi tutup ember itu sendiri', () => {
    const pekanan = rakitBar(harian, [], kunciPekan, HIJAU, MERAH).lilin
    expect(pekanan.map((l) => l.time)).toEqual(['2026-08-17', '2026-08-24'])
    expect(tutupSampai(pekanan, '2026-08-24')).toBe(130)
    expect(tutupSampai(pekanan, '2026-08-17')).toBe(110)
  })

  it('rakitBar tak mengubah deret masukan - pembanding dipakai ulang antar kerangka', () => {
    const salinan = harian.map((l) => ({ ...l }))
    rakitBar(harian, [], kunciPekan, HIJAU, MERAH)
    rakitBar(harian, [], kunciBulan, HIJAU, MERAH)
    expect(harian).toEqual(salinan)
  })
})

describe('dariYahoo — bar semu kutipan (#150 B)', () => {
  // 02:00Z = 09:00 WIB. Deret satu jam: dua bar sejam, lalu kutipan 09:10:50
  // yang stempelnya BUKAN kelipatan jam, volumenya 0, dan O=H=L=C.
  const jam = (h: number, m = 0, d = 0) => Date.UTC(2026, 8, 9, h, m, d) / 1000
  const deret = {
    chart: { result: [{
      timestamp: [jam(2), jam(3), jam(3, 10, 50)],
      indicators: { quote: [{
        open: [6700, 6600, 6575], high: [6700, 6650, 6575],
        low: [6575, 6560, 6575], close: [6600, 6580, 6575],
        volume: [12_200_000, 4_100_000, 0],
      }] },
    }] },
  }

  it('tanpa panjang slot, perilakunya persis seperti dulu — tiga lilin', () => {
    expect(dariYahoo(deret, HIJAU, MERAH).lilin).toHaveLength(3)
  })

  it('dengan panjang slot, kutipan dilebur ke bar jamnya — bukan lilin sendiri', () => {
    const h = dariYahoo(deret, HIJAU, MERAH, 3600)
    expect(h.lilin).toHaveLength(2)
    const akhir = h.lilin[1]
    expect(akhir.close).toBe(6575)   // harga terkini ikut
    expect(akhir.open).toBe(6600)    // pembukaan slotnya tak berubah
    expect(akhir.low).toBe(6560)     // low slot tetap menang
    expect(h.volume[1].value).toBe(4_100_000)
  })

  it('kutipan yang melebarkan kisaran menaikkan high slotnya', () => {
    const naik = structuredClone(deret)
    naik.chart.result[0].indicators.quote[0].open[2] = 6800
    naik.chart.result[0].indicators.quote[0].high[2] = 6800
    naik.chart.result[0].indicators.quote[0].low[2] = 6800
    naik.chart.result[0].indicators.quote[0].close[2] = 6800
    const h = dariYahoo(naik, HIJAU, MERAH, 3600)
    expect(h.lilin[1].high).toBe(6800)
  })

  it('kutipan milik slot LAIN dibuang, tidak dipindah ke jam yang salah', () => {
    const jauh = structuredClone(deret)
    jauh.chart.result[0].timestamp[2] = jam(5, 10, 50)
    const h = dariYahoo(jauh, HIJAU, MERAH, 3600)
    expect(h.lilin).toHaveLength(2)
    expect(h.lilin[1].close).toBe(6580)   // bar jam 10 tak tersentuh
  })

  it('bar yang stempelnya pas di slot tidak diapa-apakan', () => {
    const rapi = structuredClone(deret)
    rapi.chart.result[0].timestamp[2] = jam(4)
    expect(dariYahoo(rapi, HIJAU, MERAH, 3600).lilin).toHaveLength(3)
  })
})
