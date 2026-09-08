import { describe, expect, it } from 'vitest'
import { gabungBarBerjalan, WARNA_VOL_NAIK, WARNA_VOL_TURUN, type DataCandle } from './candleStockbit'
import type { HargaLive } from './hargaLive'

const arsip: DataCandle = {
  lilin: [
    { time: '2026-09-04', open: 100, high: 104, low: 99, close: 102 },
    { time: '2026-09-07', open: 102, high: 103, low: 98, close: 100 },
  ],
  volume: [
    { time: '2026-09-04', value: 1000, color: WARNA_VOL_NAIK },
    { time: '2026-09-07', value: 900, color: WARNA_VOL_TURUN },
  ],
}
const live = (isi: Partial<HargaLive>): HargaLive => ({
  kode: 'BNBR', tanggal: '2026-09-08', close: 101, prev: 100, pct: 1, diambilPada: 0,
  open: 100, high: 103, low: 99, volume: 500, value: 50_000_000, frequency: 42,
  ...isi,
})

describe('gabungBarBerjalan', () => {
  it('menempelkan bar hari berjalan yang lebih baru dari arsip, tanpa mengubah deret asli', () => {
    const hasil = gabungBarBerjalan(arsip, live({}))
    expect(hasil.lilin).toHaveLength(3)
    expect(hasil.lilin[2]).toEqual({ time: '2026-09-08', open: 100, high: 103, low: 99, close: 101 })
    expect(hasil.volume[2]).toEqual({ time: '2026-09-08', value: 500, color: WARNA_VOL_NAIK })
    expect(arsip.lilin).toHaveLength(2) // deret asli utuh
  })

  it('tanggal live sama atau lebih tua dari arsip: arsip menang, tak ada yang ditimpa', () => {
    expect(gabungBarBerjalan(arsip, live({ tanggal: '2026-09-07', close: 999 }))).toBe(arsip)
    expect(gabungBarBerjalan(arsip, live({ tanggal: '2026-09-01' }))).toBe(arsip)
  })

  it('null, tanggal cacat, atau OHLC tak konsisten: dibuang, bukan digambar', () => {
    expect(gabungBarBerjalan(arsip, null)).toBe(arsip)
    expect(gabungBarBerjalan(arsip, live({ tanggal: '8 Sep 2026' }))).toBe(arsip)
    expect(gabungBarBerjalan(arsip, live({ open: null }))).toBe(arsip)
    expect(gabungBarBerjalan(arsip, live({ low: 102 }))).toBe(arsip) // low di atas open
    expect(gabungBarBerjalan(arsip, live({ high: 100.5 }))).toBe(arsip) // high di bawah close
  })

  it('volume kosong menjadi 0, candle turun memakai warna turun', () => {
    const hasil = gabungBarBerjalan(arsip, live({ open: 102, close: 100, high: 103, low: 99, volume: null }))
    expect(hasil.volume[2]).toEqual({ time: '2026-09-08', value: 0, color: WARNA_VOL_TURUN })
  })

  it('hariIni diberikan: hanya bar bertanggal hari itu yang ditempel (kemarin/besok ditolak)', () => {
    expect(gabungBarBerjalan(arsip, live({}), '2026-09-08').lilin).toHaveLength(3)
    // arsip tertinggal (berhenti 4 Sep) dan proxy masih mengirim bar 7 Sep: bukan hari ini, tolak
    const tertinggal: DataCandle = { lilin: arsip.lilin.slice(0, 1), volume: arsip.volume.slice(0, 1) }
    expect(gabungBarBerjalan(tertinggal, live({ tanggal: '2026-09-07' }), '2026-09-08')).toBe(tertinggal)
    expect(gabungBarBerjalan(arsip, live({ tanggal: '2026-09-09' }), '2026-09-08')).toBe(arsip)
  })

  it('arsip kosong: bar berjalan tetap boleh berdiri sendiri', () => {
    const hasil = gabungBarBerjalan({ lilin: [], volume: [] }, live({}))
    expect(hasil.lilin).toHaveLength(1)
  })
})
