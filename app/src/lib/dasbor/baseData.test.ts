import { afterEach, describe, expect, it, vi } from 'vitest'
import { urlData } from './baseData'

// #175 A1: seluruh alamat data kini lewat urlData. Uji ini mengunci aturan
// pencocokannya supaya A1 terbukti nol perubahan perilaku, dan supaya A2
// (pindah tuan rumah data) punya pagar yang merah kalau aturannya bergeser.
const PAGES = 'https://jiakbar.github.io/idx-dashboard'

describe('urlData', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('DEV: semua jalur apa adanya, termasuk yang di produksi diambil dari luar', () => {
    vi.stubEnv('PROD', false)
    expect(urlData('/data-idx/json/broker_tahunan/BBCA/2026.json')).toBe('/data-idx/json/broker_tahunan/BBCA/2026.json')
    expect(urlData('/data-idx/json/kabar.json')).toBe('/data-idx/json/kabar.json')
    expect(urlData('/data-idx/json/ohlc/BBCA.json')).toBe('/data-idx/json/ohlc/BBCA.json')
  })

  it('PROD: broker_tahunan, kabar.json, dan snips.json diambil dari Pages', () => {
    vi.stubEnv('PROD', true)
    expect(urlData('/data-idx/json/broker_tahunan/BBCA/2026.json')).toBe(`${PAGES}/data-idx/json/broker_tahunan/BBCA/2026.json`)
    expect(urlData('/data-idx/json/broker_tahunan/BBCA/index.json')).toBe(`${PAGES}/data-idx/json/broker_tahunan/BBCA/index.json`)
    expect(urlData('/data-idx/json/kabar.json')).toBe(`${PAGES}/data-idx/json/kabar.json`)
    expect(urlData('/data-idx/json/snips.json')).toBe(`${PAGES}/data-idx/json/snips.json`)
  })

  it('PROD: jalur lain tetap sedomain, termasuk bentuk yang dibungkus A1', () => {
    vi.stubEnv('PROD', true)
    const tetap = [
      '/data-idx/json/ohlc/BBCA.json',
      '/data-idx/json/ds_260911.json',
      '/data-idx/json/index_weekly.json',
      '/data-idx/json/keuangan',
      '/data-idx/json/seasonality',
      '/data-idx/radar/rbu/2026-09-11/BBCA.png',
      '/arus-pasar/keluaran/index.json',
      '/arus-pasar/keluaran/AP-110926-E01.pdf',
    ]
    for (const j of tetap) expect(urlData(j)).toBe(j)
  })

  it('PROD: berkas harus sama persis, dan folder harus berakhiran garis miring', () => {
    vi.stubEnv('PROD', true)
    expect(urlData('/data-idx/json/kabar.json?v=1')).toBe('/data-idx/json/kabar.json?v=1')
    expect(urlData('/data-idx/json/arsip/kabar.json')).toBe('/data-idx/json/arsip/kabar.json')
    // Akar tanpa garis miring penutup TIDAK cocok: catatan untuk A2 (#176),
    // yang akan memindah seluruh /data-idx/ dan karena itu wajib mengubah aturan ini.
    expect(urlData('/data-idx/json/broker_tahunan')).toBe('/data-idx/json/broker_tahunan')
  })
})
