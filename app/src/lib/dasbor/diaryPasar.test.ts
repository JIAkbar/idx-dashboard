import { describe, expect, it } from 'vitest'
import type { BarisOhlc } from './ihsgOhlc'
import { bulanDiary, performaIhsg, selDiary, tallyDiary } from './diaryPasar'
import ihsg from './__fixtures__/ihsg-250-hari.json'

/**
 * Data IHSG SUNGGUHAN — salinan `data-idx/json/ihsg_ohlc_ringkas.json` per
 * 20 Agustus 2026, bukan deret karangan. Uji yang datanya dibuat sendiri tak
 * bisa menangkap asumsi yang salah tentang bentuk berkas yang akan dibaca
 * halaman.
 *
 * Disalin ke `__fixtures__/`, tidak dibaca lewat `node:fs`: tsconfig aplikasi
 * ini sengaja tak memuat tipe Node (`types: ["vite/client"]`), dan
 * melonggarkannya demi satu uji berarti membuka API Node untuk seluruh kode
 * yang berjalan di peramban.
 *
 * Memperbaruinya kalau kelak perlu:
 * `cp data-idx/json/ihsg_ohlc_ringkas.json app/src/lib/dasbor/__fixtures__/ihsg-250-hari.json`
 * — tapi perhatikan uji kalibrasi RTI di bawah berjangkar pada tanggal
 * tertentu (21 Juli-20 Agustus 2026); menyalin data yang lebih baru akan
 * menggeser jendelanya dan uji itu harus ikut disesuaikan.
 */
const NYATA = (ihsg as unknown as { d: BarisOhlc[] }).d

const bar = (tanggal: string, tutup: number): BarisOhlc => [tanggal, tutup, tutup, tutup, tutup, 0]

describe('selDiary', () => {
  it('baris pertama dibuang — tanpa hari sebelumnya, perubahannya tak ada', () => {
    const sel = selDiary([bar('2026-01-05', 100), bar('2026-01-06', 110)])
    expect(sel).toHaveLength(1)
    expect(sel[0].tanggal).toBe('2026-01-06')
    expect(sel[0].persen).toBeCloseTo(10, 6)
    expect(sel[0].poin).toBeCloseTo(10, 6)
  })

  it('hari yang tercetak 0,00% dihitung DATAR, bukan dipaksa naik/turun', () => {
    const sel = selDiary([bar('2026-01-05', 10000), bar('2026-01-06', 10000.3)])
    expect(sel[0].persen).toBeLessThan(0.005)
    expect(sel[0].arah).toBe('datar')
  })

  it('naik & turun dibedakan dari tanda perubahannya', () => {
    const sel = selDiary([bar('2026-01-05', 100), bar('2026-01-06', 101), bar('2026-01-07', 99)])
    expect(sel.map((s) => s.arah)).toEqual(['naik', 'turun'])
  })

  it('data IHSG nyata: tiap sel punya arah dan tanggalnya urut', () => {
    const sel = selDiary(NYATA)
    expect(sel.length).toBe(NYATA.length - 1)
    for (let i = 1; i < sel.length; i++) expect(sel[i].tanggal > sel[i - 1].tanggal).toBe(true)
    for (const s of sel) expect(['naik', 'turun', 'datar']).toContain(s.arah)
  })
})

describe('tallyDiary', () => {
  it('jumlah hari naik + turun + datar = jumlah hari bursa di jendela', () => {
    const t = tallyDiary(selDiary(NYATA), 30)!
    // Jendelanya KALENDER, jadi jumlah hari bursanya tak tetap — 30 hari
    // kalender berisi 20-22 hari bursa tergantung liburnya.
    expect(t.hari).toBeGreaterThan(15)
    expect(t.hari).toBeLessThanOrEqual(23)
    expect(t.hariNaik + t.hariTurun + t.hariDatar).toBe(t.hari)
  })

  it('cocok dengan panel RTI 21 Agu 2026 — kalibrasi silang, bukan angka karangan', () => {
    // Panel acuan (`data ide/`, 21 Agu 13.54) menyebut sisi turun
    // "12 days −527,254". Data kita berhenti 20 Agustus, jadi jendela yang
    // setara diambil dari tanggal itu: 21 Juli s/d 20 Agustus.
    const sel = selDiary(NYATA).filter((s) => s.tanggal <= '2026-08-20')
    const t = tallyDiary(sel, 29)!
    expect(t.hariTurun).toBe(12)
    expect(t.poinTurun).toBeCloseTo(-527.25, 2)
  })

  it('poin turun bertanda NEGATIF, dan bersih = naik + turun', () => {
    const t = tallyDiary(selDiary(NYATA), 30)!
    expect(t.poinNaik).toBeGreaterThanOrEqual(0)
    expect(t.poinTurun).toBeLessThanOrEqual(0)
    expect(t.poinBersih).toBeCloseTo(t.poinNaik + t.poinTurun, 6)
  })

  it('bersih cocok dengan perubahan tutup selama jendela — pemeriksaan silang', () => {
    // Kalau tally dan harga tak sepakat, salah satunya salah.
    const sel = selDiary(NYATA)
    const t = tallyDiary(sel, 30)!
    const potong = sel.slice(-t.hari)
    const dasar = potong[0].tutup - potong[0].poin
    expect(t.poinBersih).toBeCloseTo(potong[potong.length - 1].tutup - dasar, 6)
  })

  it('jendela lebih panjang dari datanya memakai apa yang ada, bukan melempar', () => {
    const t = tallyDiary(selDiary(NYATA), 10_000)!
    expect(t.hari).toBe(NYATA.length - 1)
  })

  it('deret kosong = null, bukan angka nol yang menyesatkan', () => {
    expect(tallyDiary([], 30)).toBeNull()
  })
})

describe('performaIhsg', () => {
  it('tujuh periode, urut, dan 1D sama dengan perubahan hari terakhir', () => {
    const p = performaIhsg(NYATA)
    expect(p.map((x) => x.id)).toEqual(['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y'])
    const sel = selDiary(NYATA)
    expect(p[0].persen).toBeCloseTo(sel[sel.length - 1].persen, 6)
  })

  it('YTD berjangkar ke penutupan TAHUN LALU, bukan 1 Januari tahun ini', () => {
    const deret: BarisOhlc[] = [
      bar('2025-12-29', 1000), bar('2025-12-30', 1100),
      bar('2026-01-02', 1210), bar('2026-01-05', 1320),
    ]
    // Titik nol = 1100 (penutupan terakhir 2025), jadi 1320/1100 - 1 = 20%.
    expect(performaIhsg(deret).find((x) => x.id === 'YTD')!.persen).toBeCloseTo(20, 6)
  })

  it('periode yang riwayatnya belum cukup = null, bukan 0%', () => {
    const p = performaIhsg([bar('2026-08-19', 100), bar('2026-08-20', 101)])
    expect(p.find((x) => x.id === '1D')!.persen).toBeCloseTo(1, 6)
    expect(p.find((x) => x.id === '1Y')!.persen).toBeNull()
    expect(p.find((x) => x.id === '5D')!.persen).toBeNull()
  })

  it('data nyata: seluruh periode terisi (250 hari bursa melampaui 1 tahun)', () => {
    for (const p of performaIhsg(NYATA)) expect(p.persen).not.toBeNull()
  })

  it('1M memakai bulan KALENDER, bukan 20 lilin', () => {
    // Deret dengan hari bursa yang jarang: 20 lilin ke belakang akan melompat
    // jauh melewati satu bulan kalender.
    const deret: BarisOhlc[] = []
    for (let i = 0; i < 40; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i * 3))
      deret.push(bar(d.toISOString().slice(0, 10), 100 + i))
    }
    const akhir = deret[deret.length - 1]
    const sebulanLalu = new Date(`${akhir[0]}T00:00:00Z`)
    sebulanLalu.setUTCMonth(sebulanLalu.getUTCMonth() - 1)
    const patokan = deret.filter((b) => b[0] <= sebulanLalu.toISOString().slice(0, 10)).at(-1)!
    expect(performaIhsg(deret).find((x) => x.id === '1M')!.persen)
      .toBeCloseTo((akhir[4] / patokan[4] - 1) * 100, 6)
  })
})

describe('bulanDiary', () => {
  it('lima kolom Senin-Jumat, akhir pekan tak pernah jadi kotak', () => {
    const b = bulanDiary(selDiary(NYATA), 2026, 8)
    for (const m of b.minggu) expect(m).toHaveLength(5)
    for (const k of b.minggu.flat()) {
      if (!k?.sel) continue
      const hari = new Date(`${k.sel.tanggal}T00:00:00Z`).getUTCDay()
      expect(hari).toBeGreaterThanOrEqual(1)
      expect(hari).toBeLessThanOrEqual(5)
    }
  })

  it('bulan yang mulai di tengah pekan tetap sejajar kolomnya', () => {
    // 1 Juli 2026 = Rabu, jadi kolom 0 (Senin) & 1 (Selasa) baris pertama
    // harus kosong — bukan tergeser ke kiri.
    const b = bulanDiary(selDiary(NYATA), 2026, 7)
    expect(b.minggu[0][0]).toBeNull()
    expect(b.minggu[0][1]).toBeNull()
    expect(b.minggu[0][2]?.sel?.tanggal).toBe('2026-07-01')
  })

  it('bulan yang tanggal 1-nya AKHIR PEKAN tidak kehilangan pekan pertamanya', () => {
    // 1 Agustus 2026 = Sabtu. Baris nol harus berisi 3-7 Agustus, bukan
    // kosong — versi pertama menghitung tanggalnya ulang dari (baris, kolom)
    // dan mengosongkan seluruh pekan itu tanpa satu pun galat.
    const b = bulanDiary(selDiary(NYATA), 2026, 8)
    expect(b.minggu[0].map((k) => k?.hari)).toEqual([3, 4, 5, 6, 7])
    expect(b.minggu[0][0]?.sel?.tanggal).toBe('2026-08-03')
  })

  it('tiap kotak membawa tanggalnya sendiri, dan tanggalnya urut menaik', () => {
    const b = bulanDiary(selDiary(NYATA), 2026, 8)
    const hari = b.minggu.flat().filter((k) => k !== null).map((k) => k!.hari)
    for (let i = 1; i < hari.length; i++) expect(hari[i]).toBeGreaterThan(hari[i - 1])
  })

  it('hari libur bursa jadi kotak BERNOMOR tanpa data, bukan hilang', () => {
    // 17 Agustus 2026 (Senin) libur — tak ada di data, tapi kotaknya tetap.
    const b = bulanDiary(selDiary(NYATA), 2026, 8)
    const pekan17 = b.minggu.find((m) => m.some((k) => k?.sel?.tanggal === '2026-08-18'))!
    expect(pekan17[0]?.hari).toBe(17)
    expect(pekan17[0]?.sel).toBeNull()
    expect(pekan17[1]?.sel?.tanggal).toBe('2026-08-18')
  })

  it('bulan tanpa data sama sekali tetap memberi kerangka bernomor', () => {
    const b = bulanDiary([], 2026, 8)
    expect(b.minggu.length).toBeGreaterThan(0)
    const isi = b.minggu.flat().filter((k) => k !== null)
    expect(isi.length).toBe(21) // hari kerja Agustus 2026
    expect(isi.every((k) => k!.sel === null)).toBe(true)
  })
})
