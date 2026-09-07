import { describe, expect, it } from 'vitest'
import { petaTinjauan, ringkasTinjauan, muatTinjauanDeepDive, type TinjauanTerbitan } from './tinjauanDeepDive'

const dasar = (o: Partial<TinjauanTerbitan> = {}): TinjauanTerbitan => ({
  edisi: 'BA-BUMI-140826-E01',
  kode: 'BUMI',
  tanggal: '2026-08-14',
  harga_acuan: 181,
  level_bull: [185, 191],
  level_invalid: [176],
  urutan_tersentuh: [{ tanggal: '2026-08-18', level: 185, arah: 'atas' }],
  harga_h5: 194,
  tertinggi_h5: 202,
  gerak_pct: 7.18,
  status: 'terbukti',
  ...o,
})

describe('tinjauan H+5 Deep Dive (#20 B)', () => {
  it('peta berkunci edisi — cocok verbatim dengan kode terbitan', () => {
    const p = petaTinjauan({ diperbarui: '', horizon_hari: 5, n: 1, terbitan: [dasar()] })
    expect(p.get('BA-BUMI-140826-E01')?.kode).toBe('BUMI')
  })

  it('berkas tak termuat = peta kosong, bukan galat', () => {
    // Halamannya tetap memajang daftar terbitan; yang hilang cuma kolom hasil.
    expect(petaTinjauan(null).size).toBe(0)
  })

  it('terbitan DITAHAN tak ikut tampil karena penggabungan berangkat dari manifest', () => {
    // BA-INET-180826-E01 ada di tinjauan tapi ditahan atas permintaan Johan
    // (19 Agu 2026, `_tahan.json`) — ia tak pernah masuk manifest, jadi
    // halaman yang menyusuri manifest tak akan pernah menyentuhnya. Uji ini
    // mengunci ARAH penggabungan, bukan sekadar isi petanya.
    const p = petaTinjauan({
      diperbarui: '', horizon_hari: 5, n: 2,
      terbitan: [dasar(), dasar({ edisi: 'BA-INET-180826-E01', kode: 'INET' })],
    })
    const manifest = ['BA-BUMI-140826-E01']
    expect(manifest.map((k) => p.get(k)?.kode)).toEqual(['BUMI'])
    expect(manifest.some((k) => k.includes('INET'))).toBe(false)
  })

  it('warna mengikuti STATUS, bukan tanda gerak harga', () => {
    // Terbitan yang levelnya tak pernah tersentuh tapi harganya kebetulan
    // naik bukan klaim yang terbukti; hijau di situ membaca sebaliknya.
    expect(ringkasTinjauan(dasar({ status: 'belum terjadi', gerak_pct: 4.79 })).warna).toBe('netral')
    expect(ringkasTinjauan(dasar({ status: 'terbukti' })).warna).toBe('naik')
    expect(ringkasTinjauan(dasar({ status: 'invalid', gerak_pct: -3.2 })).warna).toBe('turun')
  })

  it('label memuat tanda persen bertanda dan status apa adanya kalau gerak tak ada', () => {
    expect(ringkasTinjauan(dasar()).label).toBe('H+5 ✓ +7,2%')
    expect(ringkasTinjauan(dasar({ gerak_pct: null, status: 'belum terjadi' })).label).toBe('H+5 · belum terjadi')
  })

  it('judul hover menyebut level yang tersentuh beserta tanggalnya', () => {
    expect(ringkasTinjauan(dasar()).judul).toContain('185 (2026-08-18)')
    expect(ringkasTinjauan(dasar({ urutan_tersentuh: [] })).judul).toContain('belum ada level yang tersentuh')
  })

  it('404 dibaca sebagai belum ada tinjauan, bukan galat', async () => {
    const palsu = (() => Promise.resolve({ ok: false } as Response)) as unknown as typeof fetch
    expect(await muatTinjauanDeepDive(palsu)).toBeNull()
  })
})
