/**
 * Proksi lilin intraday Yahoo Finance — dipakai HANYA oleh Grafik Emiten
 * (`app/src/lib/dasbor/kerangkaWaktu.ts`).
 *
 * Kenapa ada sama sekali: Yahoo tidak mengirim header CORS, jadi peramban
 * menolak permintaan langsung dari halaman. Data harian PAPAN sendiri
 * (`data-idx/json/ohlc/`) tak butuh ini — yang butuh cuma kerangka 5m/15m/
 * 30m/1h/4h, yang memang tak ada di repo sama sekali.
 *
 * Kenapa BUKAN proxy CORS publik (jalur yang dipakai `hargaTerakhir.ts`):
 * terukur 18 Agustus 2026, keempat yang dicoba gagal — corsproxy.io,
 * allorigins, codetabs, dan thingproxy semuanya dibalas 429/520 oleh Yahoo.
 * Pembedanya ternyata User-Agent, bukan alamat IP: permintaan yang sama
 * dengan UA peramban dibalas 200, dengan UA bawaan curl dibalas 429. Karena
 * itu header UA di bawah bukan hiasan — tanpa ia, fungsi ini ikut kena 429.
 *
 * Padanan dev-server-nya ada di `app/vite.config.ts` (`server.proxy`), dengan
 * bentuk URL yang PERSIS SAMA supaya kode klien tak perlu tahu ia sedang
 * berjalan di mana.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  + ' (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

/** Interval & rentang yang boleh diminta — daftar tertutup, bukan diteruskan
 *  apa adanya. Ruas ini masuk ke URL pihak ketiga, dan meneruskan apa pun yang
 *  dikirim berarti mengubah fungsi ini jadi proksi terbuka untuk siapa saja. */
const INTERVAL = new Set(['5m', '15m', '30m', '60m'])
const RENTANG = new Set(['1mo', '2y'])

export default async function handler(req, res) {
  const { simbol = '', interval = '', rentang = '' } = req.query ?? {}
  // Simbol dibatasi ke bentuk kode emiten IDX (`BBCA.JK`) — sekali lagi:
  // daftar tertutup, bukan teruskan-apa-adanya.
  if (!/^[A-Z0-9]{1,10}\.JK$/.test(String(simbol))) {
    return res.status(400).json({ galat: 'Simbol harus berbentuk KODE.JK.' })
  }
  if (!INTERVAL.has(String(interval)) || !RENTANG.has(String(rentang))) {
    return res.status(400).json({ galat: 'Interval atau rentang tidak dikenal.' })
  }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${simbol}`
    + `?interval=${interval}&range=${rentang}`
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!r.ok) return res.status(r.status).json({ galat: `Yahoo membalas HTTP ${r.status}.` })
    // Lilin intraday berubah tiap beberapa menit; disimpan sebentar di tepi
    // supaya membuka emiten yang sama dua kali tak menembak Yahoo dua kali,
    // tapi tidak selama sampai harga terakhirnya terasa basi.
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600')
    return res.status(200).json(await r.json())
  } catch (e) {
    return res.status(502).json({ galat: `Gagal menghubungi Yahoo: ${String(e)}` })
  }
}
