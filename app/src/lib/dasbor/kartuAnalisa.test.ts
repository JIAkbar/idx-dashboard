import { describe, expect, it } from 'vitest'
import { ambilKartu, ambilIndeksKartu, bangunTesis, pembatalDalamAtr, takKeduanya, tingkatBasi, type KartuEmiten } from './kartuAnalisa'

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

describe('bangunTesis', () => {
  // Aturan pembatal diuji dari LOW/HIGH intraday (first_passage() Python), bukan
  // dari harga penutupan — kalimatnya wajib bilang itu, jangan "penutupan".
  const kartu = {
    harga: 2120, chg: 9.56, ma20: 1984, ma50: 1802.4, ma200: 2522.125,
    fundamental: {}, er_persentil: null, er_n_populasi: null,
    support: [{ level: 2050, sentuhan: 8, terakhir: '2026-04-06', dalam_atr: true, harga: 2050 }],
    stop: 2050, stop_pct: 3.3, atr_pct: 4.57,
    musiman: { n: 6 },
  } as unknown as KartuEmiten

  it('kalimat pembatal menyebut "tersentuh intraday", bukan "penutupan"', () => {
    const t = bangunTesis(kartu)
    expect(t.membatalkan.join(' ')).toMatch(/tersentuh intraday/i)
    expect(t.membatalkan.join(' ')).not.toMatch(/penutupan/i)
  })
})

describe('takKeduanya', () => {
  it('kena+stop == total (lewat 0) tapi float mendarat sedikit di atas 100 -> dijepit 0, bukan negatif', () => {
    // WIFI R1 18 Agu 2026: p_kena 48.31460674157304 + p_stop 51.68539325842697
    // = 100.00000000000001 — noise float khas pembagian/penjumlahan desimal.
    expect(takKeduanya({ n: 1335, p_kena: 48.31460674157304, p_stop: 51.68539325842697 })).toBe(0)
  })

  it('lewat > 0 -> sisa positif apa adanya', () => {
    expect(takKeduanya({ n: 100, p_kena: 20, p_stop: 30 })).toBe(50)
  })

  it('n = 0 -> null (belum ada bukti sama sekali)', () => {
    expect(takKeduanya({ n: 0, p_kena: 0, p_stop: 0 })).toBeNull()
  })
})

describe('tingkatBasi', () => {
  it('0 hari atau kurang -> segar', () => {
    expect(tingkatBasi(0)).toBe('segar')
    expect(tingkatBasi(-1)).toBe('segar')
  })
  it('1-4 hari -> agak', () => {
    expect(tingkatBasi(1)).toBe('agak')
    expect(tingkatBasi(4)).toBe('agak')
  })
  it('5+ hari -> basi', () => {
    expect(tingkatBasi(5)).toBe('basi')
    expect(tingkatBasi(30)).toBe('basi')
  })
})
