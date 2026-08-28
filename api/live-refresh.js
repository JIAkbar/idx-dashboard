/**
 * Rotasi token akun-kedua Stockbit — SATU-SATUNYA pelaku refresh untuk rantai
 * live (syarat desain #3). Dipanggil Vercel Cron tiap 12 jam (access berumur
 * 24 jam — dua kali cadangan), atau manual dengan secret yang sama.
 *
 * Kenapa satu pelaku: refresh token sekali-pakai (rotasi). Dua pemutar pada
 * satu rantai = server mendeteksi pemakaian-ulang dan MENCABUT SATU KELUARGA
 * sesi — persis insiden yang mematikan rantai panen 24 & 28 Agu 2026.
 * Fungsi harga hanya MEMBACA access; hanya cron ini yang menulis.
 *
 * Auth: Vercel Cron mengirim `Authorization: Bearer ${CRON_SECRET}` otomatis
 * bila env CRON_SECRET diset. Pemanggilan tanpa secret ditolak.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  + ' (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

export default async function handler(req, res) {
  const rahasia = process.env.CRON_SECRET
  const kiriman = String(req.headers?.authorization ?? '')
  if (!rahasia || kiriman !== `Bearer ${rahasia}`) {
    return res.status(401).json({ galat: 'Tidak berwenang.' })
  }
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(500).json({ galat: 'Env belum lengkap.' })
  const sb = { apikey: key, Authorization: `Bearer ${key}` }

  try {
    const baca = await fetch(`${url}/rest/v1/live_token?id=eq.1&select=refresh`, { headers: sb })
    const refresh = (await baca.json())?.[0]?.refresh
    if (!refresh) return res.status(500).json({ galat: 'Belum disemai — sisipkan baris live_token lebih dulu.' })

    const r = await fetch('https://exodus.stockbit.com/login/refresh', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${refresh}`,
        Origin: 'https://stockbit.com',
        Referer: 'https://stockbit.com/',
        'User-Agent': UA,
      },
    })
    if (!r.ok) {
      console.error('refresh live ditolak HTTP', r.status)
      return res.status(502).json({ galat: `Refresh ditolak (${r.status}) — rantai live perlu disemai ulang.` })
    }
    const d = (await r.json())?.data ?? {}
    const accessBaru = d.access?.token
    const refreshBaru = d.refresh?.token
    if (!accessBaru || !refreshBaru) {
      return res.status(502).json({ galat: 'Balasan refresh tak memuat pasangan token.' })
    }
    const tulis = await fetch(`${url}/rest/v1/live_token?id=eq.1`, {
      method: 'PATCH',
      headers: { ...sb, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ access: accessBaru, refresh: refreshBaru, diputar_pada: new Date().toISOString() }),
    })
    if (!tulis.ok) {
      // Pasangan baru sudah terbit tapi gagal tersimpan = rantai putus di
      // tangan kita sendiri — keraskan, jangan telan.
      console.error('SIMPAN token live GAGAL HTTP', tulis.status)
      return res.status(500).json({ galat: 'Token baru terbit tapi gagal tersimpan — semai ulang.' })
    }
    return res.status(200).json({ ok: true, diputar_pada: new Date().toISOString() })
  } catch (e) {
    console.error('live-refresh gagal:', e)
    return res.status(502).json({ galat: 'Gagal menghubungi hulu.' })
  }
}
