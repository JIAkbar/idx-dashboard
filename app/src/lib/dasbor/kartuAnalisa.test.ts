import { describe, expect, it } from 'vitest'
import { ambilKartu, ambilIndeksKartu, pembatalDalamAtr } from './kartuAnalisa'

describe('ambilKartu', () => {
  it('berkas tak ada (404) -> null, bukan galat dan bukan objek kosong', async () => {
    const fetch404 = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch
    await expect(ambilKartu('ZZZZ', fetch404)).resolves.toBeNull()
  })

  it('jaringan gagal -> null, tidak melempar', async () => {
    const fetchGagal = (async () => { throw new Error('network down') }) as unknown as typeof fetch
    await expect(ambilKartu('ARCI', fetchGagal)).resolves.toBeNull()
  })

  it('200 dengan JSON -> objek kartu apa adanya', async () => {
    const fetchOk = (async () => new Response(JSON.stringify({ kode: 'ARCI', harga: 1320 }), { status: 200 })) as unknown as typeof fetch
    const hasil = await ambilKartu('ARCI', fetchOk)
    expect(hasil).toEqual({ kode: 'ARCI', harga: 1320 })
  })
})

describe('ambilIndeksKartu', () => {
  it('berkas tak ada -> null', async () => {
    const fetch404 = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch
    await expect(ambilIndeksKartu(fetch404)).resolves.toBeNull()
  })
})

describe('pembatalDalamAtr', () => {
  it('WIFI 18 Agu 2026 — jarak pembatal 3,30% < ATR 4,57% -> peringatan muncul', () => {
    expect(pembatalDalamAtr({ stop_pct: 3.2955, atr_pct: 4.5697 })).toBe(true)
  })

  it('BUMI 18 Agu 2026 — jarak pembatal 14,67% > ATR 5,04% -> peringatan tidak muncul', () => {
    expect(pembatalDalamAtr({ stop_pct: 14.6667, atr_pct: 5.0359 })).toBe(false)
  })

  it('ATR belum bisa dihitung (riwayat < 15 lilin) -> tidak memaksakan peringatan', () => {
    expect(pembatalDalamAtr({ stop_pct: 5, atr_pct: null })).toBe(false)
  })
})
