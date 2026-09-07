import { describe, expect, it } from 'vitest'
import { cariRbs, paramRbs, PARAM_RBS_DASAR } from './polaRbs'
import type { LilinData } from './grafikEmiten'
// Arsip mentah diimpor sebagai modul JSON (resolveJsonModule) — sama pola
// dengan harianPapan.test.ts: regresi terhadap DATA NYATA, bukan fixture
// yang diketik ulang. Bentuknya {d:[[tanggal,open,high,low,close,volume],...]}
// (lihat app/scripts/backtest-struktur.ts yang membaca berkas sama).
import bbcaRaw from '../../../../data-idx/json/ohlc/BBCA.json'
// Fixture BERSAMA dengan mesin Python (#49) — kontrak "satu mesin".
import fixtureRbs from './__fixtures__/rbs-mesin.json'
import harapanRbs from './__fixtures__/rbs-mesin-harapan.json'

function tgl(i: number): string {
  const d = new Date(Date.UTC(2020, 0, 1))
  d.setUTCDate(d.getUTCDate() + i)
  return d.toISOString().slice(0, 10)
}

/** Bar nyaris-flat di sekitar satu harga — pengisi jeda antar kejadian yang
 *  diuji. Bukan benar-benar flat (high beda tipis dari close) supaya tak
 *  kebetulan sama persis dengan bar tetangga di titik-titik yang diuji. */
function tenang(i: number, harga: number): LilinData {
  return { time: tgl(i), open: harga, high: harga + 0.4, low: harga - 0.4, close: harga }
}

function custom(i: number, o: number, h: number, l: number, c: number): LilinData {
  return { time: tgl(i), open: o, high: h, low: l, close: c }
}

describe('cariRbs', () => {
  it('level terbentuk dari 2 sentuhan pivot yang berklaster ±1,5%', () => {
    const b: LilinData[] = []
    for (let i = 0; i < 10; i++) b.push(tenang(i, 100))
    b.push(custom(10, 109, 110, 108, 109)) // pivot #1 @110
    for (let i = 11; i < 25; i++) b.push(tenang(i, 100))
    b.push(custom(25, 110, 111, 109, 110)) // pivot #2 @111 -> level resmi
    for (let i = 26; i < 60; i++) b.push(tenang(i, 100)) // tak pernah breakout

    const hasil = cariRbs(b)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].status).toBe('resistance')
    expect(hasil[0].sentuhan).toBe(2)
    expect(hasil[0].tanggalPivot).toEqual([tgl(10), tgl(25)])
    expect(hasil[0].level).toBeCloseTo(110.5, 5)
    expect(hasil[0].tanggalBreakout).toBeUndefined()
  })

  it('breakout → retest → sah (bertahan lalu terkonfirmasi ≤3 bar)', () => {
    const b: LilinData[] = []
    for (let i = 0; i < 10; i++) b.push(tenang(i, 100))
    b.push(custom(10, 109, 110, 108, 109))
    for (let i = 11; i < 25; i++) b.push(tenang(i, 100))
    b.push(custom(25, 110, 111, 109, 110)) // level ~110,5
    for (let i = 26; i < 40; i++) b.push(tenang(i, 100))
    b.push(custom(40, 111, 116, 111, 115)) // breakout: close 115 > 110,5×1,01=111,6
    b.push(custom(41, 115, 116, 114, 115)) // masih tinggi, low 114 > pita atas 112,16 -> belum retest
    b.push(custom(42, 114, 114, 111, 111.5)) // retest: low 111 masuk pita, close 111,5 >= level -> bertahan
    b.push(custom(43, 112, 114, 112, 112)) // belum konfirmasi (112 < level×1,02=112,71)
    b.push(custom(44, 112, 114, 112, 113.5)) // konfirmasi: close 113,5 >= 112,71

    const hasil = cariRbs(b)
    expect(hasil).toHaveLength(1)
    const l = hasil[0]
    expect(l.status).toBe('sah')
    expect(l.tanggalBreakout).toBe(tgl(40))
    expect(l.tanggalRetest).toBe(tgl(42))
    expect(l.tanggalKonfirmasi).toBe(tgl(44))
  })

  it("breakout tanpa retest ≤40 bar tetap berstatus 'breakout' (tak ada status kadaluarsa terpisah)", () => {
    const b: LilinData[] = []
    for (let i = 0; i < 10; i++) b.push(tenang(i, 100))
    b.push(custom(10, 109, 110, 108, 109))
    for (let i = 11; i < 25; i++) b.push(tenang(i, 100))
    b.push(custom(25, 110, 111, 109, 110))
    for (let i = 26; i < 40; i++) b.push(tenang(i, 100))
    b.push(custom(40, 111, 116, 111, 115)) // breakout
    // >40 bar sesudahnya harga tetap jauh di atas pita retest (112,16) —
    // retest tak pernah tersentuh dalam jendela.
    for (let i = 41; i < 41 + 45; i++) b.push(tenang(i, 130))

    const hasil = cariRbs(b)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].status).toBe('breakout')
    expect(hasil[0].tanggalBreakout).toBe(tgl(40))
    expect(hasil[0].tanggalRetest).toBeUndefined()
    expect(hasil[0].tanggalKonfirmasi).toBeUndefined()
  })

  it('gagal — close di bawah level saat retest (support palsu / bull trap)', () => {
    const b: LilinData[] = []
    for (let i = 0; i < 10; i++) b.push(tenang(i, 100))
    b.push(custom(10, 109, 110, 108, 109))
    for (let i = 11; i < 25; i++) b.push(tenang(i, 100))
    b.push(custom(25, 110, 111, 109, 110))
    for (let i = 26; i < 40; i++) b.push(tenang(i, 100))
    b.push(custom(40, 111, 116, 111, 115)) // breakout
    b.push(custom(41, 115, 116, 114, 115)) // bertahan tinggi dulu
    b.push(custom(42, 114, 114, 108, 109)) // retest: low 108 masuk pita, TAPI close 109 < level(110,5)

    const hasil = cariRbs(b)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].status).toBe('gagal')
    expect(hasil[0].tanggalRetest).toBe(tgl(42))
    expect(hasil[0].tanggalKonfirmasi).toBeUndefined()
  })

  it('data nyata BBCA — bentuk keluaran valid & level dalam rentang harga wajar', () => {
    const baris = (bbcaRaw as unknown as { d: [string, number, number, number, number, number][] }).d
    const bars: LilinData[] = baris.map(([time, open, high, low, close]) => (
      { time, open, high, low, close }
    ))
    const hasil = cariRbs(bars)

    // BBCA 22 tahun riwayat harian — kalau ini kosong, mesinnya rusak total,
    // bukan sekadar "kebetulan tak ada pola".
    expect(hasil.length).toBeGreaterThan(0)

    const waktuValid = new Set(bars.map((b) => b.time))
    const hargaMin = Math.min(...bars.map((b) => b.low))
    const hargaMax = Math.max(...bars.map((b) => b.high))

    for (const l of hasil) {
      expect(['resistance', 'breakout', 'retest', 'sah', 'gagal']).toContain(l.status)
      // Level itu rata-rata harga pivot NYATA — wajib jatuh di rentang harga
      // BBCA sepanjang riwayat (longgar ±10% untuk klaster dekat tepi).
      expect(l.level).toBeGreaterThan(hargaMin * 0.9)
      expect(l.level).toBeLessThan(hargaMax * 1.1)
      expect(l.sentuhan).toBeGreaterThanOrEqual(2)
      expect(l.tanggalPivot.length).toBe(l.sentuhan)
      for (const t of l.tanggalPivot) expect(waktuValid.has(t)).toBe(true)

      if (l.status === 'resistance') {
        expect(l.tanggalBreakout).toBeUndefined()
      }
      if (l.tanggalBreakout) expect(waktuValid.has(l.tanggalBreakout)).toBe(true)
      if (l.tanggalRetest) {
        expect(l.tanggalBreakout).toBeDefined()
        expect(waktuValid.has(l.tanggalRetest)).toBe(true)
      }
      if (l.tanggalKonfirmasi) {
        expect(l.status).toBe('sah')
        expect(l.tanggalRetest).toBeDefined()
      }
      if (l.status === 'gagal') {
        expect(l.tanggalRetest).toBeDefined()
        expect(l.tanggalKonfirmasi).toBeUndefined()
      }
    }

    // Keluaran terurut naik berdasar level — kontrak yang dipakai penggambar
    // (polaRbsChart.ts) untuk memotong 3 level terdekat ke harga terakhir.
    const level = hasil.map((l) => l.level)
    expect(level).toEqual([...level].sort((a, b) => a - b))
  })
})

/* ------------------------------------------------------------------ *
 * Paritas dengan mesin Python (#49).
 *
 * Sebelum ini ada DUA mesin RBS yang berbeda diam-diam: yang ini untuk
 * garis di chart, `deteksi_rbs` di `bt_papan.py` untuk backtest. Angka
 * backtest karena itu tak pernah benar-benar menggambarkan garis yang
 * dilihat orang. Uji ini pasangan dari `scripts/riset/uji_rbs_mesin.py`:
 * dua bahasa, satu fixture, satu berkas harapan.
 * ------------------------------------------------------------------ */

describe('paritas mesin RBS TypeScript <-> Python', () => {
  const bar: LilinData[] = (fixtureRbs.d as Array<[string, number, number, number, number, number]>)
    .map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))

  it('keluarannya sama persis dengan kontrak bersama', () => {
    const hasil = cariRbs(bar, paramRbs(fixtureRbs.kerangka))
    const bentukSamaDenganPython = hasil.map((lv) => ({
      level: lv.level,
      status: lv.status,
      tanggal_pivot: lv.tanggalPivot,
      tanggal_breakout: lv.tanggalBreakout ?? null,
      tanggal_retest: lv.tanggalRetest ?? null,
      tanggal_konfirmasi: lv.tanggalKonfirmasi ?? null,
      sentuhan: lv.sentuhan,
    }))
    expect(bentukSamaDenganPython).toEqual(harapanRbs.level)
  })

  it('BBCA harian: satu level sah di 6.588, breakout 2 Sep, retest 3 Sep', () => {
    // Angka yang bisa dicocokkan langsung ke layar — kriteria terima #49.
    const sah = cariRbs(bar, PARAM_RBS_DASAR).filter((lv) => lv.status === 'sah')
    expect(sah).toHaveLength(1)
    expect(Math.round(sah[0].level)).toBe(6588)
    expect(sah[0].tanggalBreakout).toBe('2026-09-02')
    expect(sah[0].tanggalRetest).toBe('2026-09-03')
  })
})

describe('level BEKU sesudah lahir — kebocoran masa depan yang ditutup #49', () => {
  it('sentuhan ketiga dicatat tapi TIDAK menggeser harga level', () => {
    // Dua puncak 100 dan 101 (level lahir 100,5), lalu puncak ketiga 99.
    // Mesin lama memakai rata-rata SELURUH sentuhan, jadi harga yang dipakai
    // memutuskan breakout ikut ditentukan bar yang belum terjadi.
    const tinggi = [
      ...Array(6).fill(90), 100, ...Array(11).fill(90), 101,
      ...Array(11).fill(90), 99, ...Array(10).fill(90),
    ]
    const b: LilinData[] = tinggi.map((h, i) => custom(i, 88, h, 87, 88))
    const hasil = cariRbs(b, { ...PARAM_RBS_DASAR, pivotN: 3, klasterPct: 0.05, jendelaKlaster: 200 })
    expect(hasil).toHaveLength(1)
    expect(hasil[0].level).toBeCloseTo(100.5, 9)
    expect(hasil[0].sentuhan).toBe(3)
  })
})
