/**
 * Harga live per emiten — proxy server-side ke arsip harga Stockbit memakai
 * token AKUN KEDUA (nganggur) milik Johan (keputusan 28 Agu 2026: "boleh kita
 * bangun saja"; akun utama TETAP khusus panen, dua rantai tak saling sentuh).
 *
 * Empat syarat desain yang membuat ini layak (lihat percakapan keputusannya):
 * 1. Token hanya hidup di server — dibaca dari tabel privat `live_token`
 *    (RLS tanpa policy; hanya service_role) lewat env server Vercel. Yang
 *    sampai ke peramban pengunjung cuma angka hasil.
 * 2. Cache CDN 30 detik + stale 90 detik — seribu pengunjung ≠ seribu
 *    permintaan keluar; pola trafik tetap sekecil satu pengguna.
 * 3. Fungsi ini TIDAK PERNAH me-refresh token (rotasi sekali-pakai +
 *    serverless concurrent = resep pencabutan sesi). Rotasi milik satu
 *    pelaku: cron `/api/live-refresh` tiap 12 jam.
 * 4. Degradasi anggun: token mati/limit → 503 {galat:'tertunda'} — klien
 *    jatuh diam-diam ke arsip EOD berlabel jujur, bukan error di layar.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  + ' (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

/** Cache access token per instance fungsi — 5 menit, jauh di bawah umurnya
 *  (24 jam), supaya tiap permintaan tak memukul Supabase. */
let singgahan = { access: null, sampai: 0 }

async function accessToken() {
  if (singgahan.access && Date.now() < singgahan.sampai) return singgahan.access
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const r = await fetch(`${url}/rest/v1/live_token?id=eq.1&select=access`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!r.ok) return null
  const rows = await r.json()
  const access = rows?.[0]?.access ?? null
  if (access) singgahan = { access, sampai: Date.now() + 5 * 60 * 1000 }
  return access
}

/** Larik bar di dalam balasan — dicari dari bentuknya (list-of-object ber-
 *  `close`), bukan diasumsikan dari nama pembungkusnya. */
function cariBar(j) {
  const tumpukan = [j]
  while (tumpukan.length) {
    const x = tumpukan.pop()
    if (Array.isArray(x)) {
      if (x.length && typeof x[0] === 'object' && x[0] && 'close' in x[0]) return x
      tumpukan.push(...x.slice(0, 3))
    } else if (x && typeof x === 'object') {
      tumpukan.push(...Object.values(x))
    }
  }
  return []
}

export default async function handler(req, res) {
  const kode = String((req.query ?? {}).kode ?? '')
  // Daftar tertutup bentuk kode — ruas ini masuk URL pihak ketiga.
  if (!/^[A-Z0-9]{2,6}$/.test(kode)) {
    return res.status(400).json({ galat: 'Kode tidak dikenal.' })
  }
  const access = await accessToken()
  if (!access) return res.status(503).json({ galat: 'tertunda' })
  try {
    const r = await fetch(
      `https://exodus.stockbit.com/chartbit/${kode}/price/daily?limit=3`,
      {
        headers: {
          Authorization: `Bearer ${access}`,
          Origin: 'https://stockbit.com',
          Referer: 'https://stockbit.com/',
          'User-Agent': UA,
        },
      },
    )
    if (!r.ok) {
      // 401 = rantai akun live mati — klien jatuh ke arsip, cron berikutnya
      // (atau semai ulang) yang menghidupkan lagi. Bukan error pengunjung.
      return res.status(503).json({ galat: 'tertunda' })
    }
    const bar = cariBar(await r.json())
    if (bar.length === 0) return res.status(503).json({ galat: 'tertunda' })
    // Urutan balasan tak diasumsikan — bar terbaru dipilih dari tanggalnya.
    const urut = [...bar].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))
    const kini = urut[urut.length - 1]
    const sebelum = urut.length > 1 ? urut[urut.length - 2] : null
    const close = Number(kini.close)
    const prev = sebelum ? Number(sebelum.close) : null
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=90')
    return res.status(200).json({
      kode,
      tanggal: kini.date ?? null,
      close,
      prev,
      pct: prev ? Math.round(((close - prev) / prev) * 10000) / 100 : null,
    })
  } catch (e) {
    // Galat asli dicatat, tak dikirim (pass kebocoran, CLAUDE.md 18 Agu).
    console.error('live-harga gagal:', e)
    return res.status(503).json({ galat: 'tertunda' })
  }
}
