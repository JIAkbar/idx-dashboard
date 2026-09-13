import { afterEach, describe, expect, it, vi } from 'vitest'
import { urlData } from './baseData'

// #176 A2: di produksi seluruh /data-idx/ dan /arus-pasar/ diambil dari GitHub
// Pages. Uji ini mengunci aturannya: kalau ada jalur data yang tertinggal di
// domain Vercel, build tak lagi membawa berkasnya dan halaman mendapat 404.
const PAGES = 'https://jiakbar.github.io/idx-dashboard'

describe('urlData', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('DEV: semua jalur apa adanya', () => {
    vi.stubEnv('PROD', false)
    for (const j of ['/data-idx/json/broker_tahunan/BBCA/2026.json', '/data-idx/json/kabar.json',
      '/data-idx/json/ohlc/BBCA.json', '/arus-pasar/keluaran/index.json']) {
      expect(urlData(j)).toBe(j)
    }
  })

  it('PROD: seluruh /data-idx/ dan /arus-pasar/ diambil dari Pages', () => {
    vi.stubEnv('PROD', true)
    const luar = [
      '/data-idx/json/broker_tahunan/BBCA/2026.json',
      '/data-idx/json/kabar.json',
      '/data-idx/json/snips.json',
      '/data-idx/json/ohlc/BBCA.json',
      '/data-idx/json/ds_260911.json',
      '/data-idx/json/index_weekly.json',
      '/data-idx/json/keuangan',
      '/data-idx/json/broker_tahunan',
      '/data-idx/radar/rbu/2026-09-11/BBCA.png',
      '/arus-pasar/keluaran/index.json',
      '/arus-pasar/keluaran/AP-110926-E01.pdf',
    ]
    for (const j of luar) expect(urlData(j)).toBe(`${PAGES}${j}`)
  })

  it('PROD: jalur di luar kedua awalan tetap sedomain', () => {
    vi.stubEnv('PROD', true)
    const tetap = [
      '/api/live-harga?kode=BBCA',
      '/og-papan.png',
      '/assets/index-abc.js',
      'data-idx/json/index.json',
      '/data-idxx/json/index.json',
      '/arus-pasarx/keluaran/index.json',
    ]
    for (const j of tetap) expect(urlData(j)).toBe(j)
  })
})
