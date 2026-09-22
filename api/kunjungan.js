/**
 * Penghitung pengunjung PAPAN (#112 A, Johan 8 Sep 2026: "sudah kmu pasang
 * soal setiap hari pengunjung PAPAN berapa orang ?").
 *
 * ## Apa yang dihitung, dan apa yang TIDAK disimpan
 *
 * POST menyimpan SATU baris per (tanggal, sidik), dengan
 *   sidik = sha256(ip + user-agent + tanggal WIB + garam)
 * dihitung di sini dan langsung dilupakan bahan bakunya. Yang mendarat di
 * basis data cuma tanggal + sidik: tak ada IP, tak ada user-agent, tak ada
 * cookie, tak ada id perangkat. Sidik hari ini tak bisa disambung ke sidik
 * besok karena TANGGAL ikut di-hash — jadi tabel ini tak bisa dipakai
 * melacak seseorang lintas hari, sekalipun oleh kita sendiri.
 *
 * Yang TIDAK pernah dicetak ke log: ip, user-agent, garam, sidik. Kegagalan
 * dilaporkan sebagai nama tahap, sama seperti `live-harga.js`.
 *
 * ## Negara (#213)
 *
 * Kolom `negara` diisi dari kepala `x-vercel-ip-country` (dua huruf ISO
 * 3166-1) yang dipasang Vercel. Itu satu-satunya turunan IP yang disimpan,
 * dan ia tak cukup untuk mengenali siapa pun. VPN menggeser negaranya; baris
 * sebelum 22 Sep 2026 tak punya negara dan tampil "tak diketahui".
 *
 * ## Kejujuran angkanya
 *
 * "Unik per hari" di sini = perangkat + jaringan, BUKAN orang. Satu orang
 * dengan ponsel dan laptop terhitung dua; satu kantor ber-NAT dengan peramban
 * seragam bisa terhitung satu. Batas itu wajib ikut tampil di layar (tooltip
 * kartunya), karena angka pengunjung paling gampang dibaca lebih besar
 * daripada yang sebenarnya diukur.
 *
 * ## Garam
 *
 * `KUNJUNGAN_GARAM` di env server. Kalau belum dipasang, dipakai turunan
 * sha256(SUPABASE_SERVICE_ROLE_KEY + 'kunjungan') supaya penghitung tetap
 * jalan tanpa menunggu tangan — konsekuensinya tercatat: mengganti kunci
 * server kelak mengganti garam, dan sidik hari-hari sebelumnya jadi tak
 * sebanding (hitungan lama tetap benar sebagai angka harian; yang hilang cuma
 * kesinambungan bila kelak ingin menghitung "pengunjung berulang").
 */

import { createHash } from 'node:crypto'
import { periksaPagar, ipPemanggil, tglWib } from './_pagar.js'

const TABEL = 'kunjungan_harian'

function kunciSupabase() {
  return {
    url: process.env.SUPABASE_URL,
    kunci: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

/** Garam efektif + dari mana asalnya (untuk laporan, bukan untuk ditayangkan). */
export function garamEfektif(env = process.env) {
  if (env.KUNJUNGAN_GARAM) return { garam: env.KUNJUNGAN_GARAM, asal: 'env' }
  const kunci = env.SUPABASE_SERVICE_ROLE_KEY
  if (!kunci) return { garam: null, asal: 'tidak ada' }
  return { garam: createHash('sha256').update(kunci + 'kunjungan').digest('hex'), asal: 'turunan-kunci-server' }
}

/** Sidik satu kunjungan. Murni: sama masuk = sama keluar, dan tak menyentuh
 *  apa pun di luar dirinya — supaya bisa diuji tanpa jaringan. */
export function sidikKunjungan(ip, userAgent, tanggal, garam) {
  return createHash('sha256')
    .update(`${ip}|${userAgent}|${tanggal}|${garam}`)
    .digest('hex')
}

/** Kode negara dua huruf dari kepala Vercel, atau null kalau tak ada/tak sah.
 *  Vercel memakai nilai non-ISO untuk alamat yang tak dikenalnya, jadi hanya
 *  dua huruf A-Z yang diterima. */
export function negaraDariKepala(req) {
  const v = String(req?.headers?.['x-vercel-ip-country'] ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(v) ? v : null
}

/** Hitungan per negara seluruh riwayat lewat fungsi SQL `kunjungan_per_negara`.
 *  null kalau gagal: kartu tetap menampilkan angka harian tanpa peta. */
async function perNegara(url, kunci) {
  const r = await fetch(`${url}/rest/v1/rpc/kunjungan_per_negara`, {
    method: 'POST',
    headers: { apikey: kunci, Authorization: `Bearer ${kunci}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dari: '2000-01-01' }),
  })
  if (!r.ok) return null
  const baris = await r.json()
  if (!Array.isArray(baris)) return null
  let tak_diketahui = 0
  const daftar = []
  for (const b of baris) {
    const n = Number(b?.n) || 0
    if (b?.negara) daftar.push({ kode: String(b.negara).trim(), n })
    else tak_diketahui += n
  }
  return { daftar, tak_diketahui }
}

/** Jumlah baris lewat PostgREST tanpa menarik isinya (`count=exact`, limit 0).
 *  `Content-Range` berbentuk `0-0/123`; angka sesudah garis miring yang dipakai. */
async function hitung(url, kunci, saring) {
  const r = await fetch(`${url}/rest/v1/${TABEL}?select=sidik&limit=0${saring}`, {
    headers: {
      apikey: kunci,
      Authorization: `Bearer ${kunci}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  })
  if (!r.ok) return null
  const rentang = r.headers.get('content-range') || ''
  const n = Number(rentang.split('/')[1])
  return Number.isFinite(n) ? n : null
}

export default async function handler(req, res) {
  const tolak = periksaPagar(req)
  if (tolak) return res.status(tolak.kode).json(tolak.badan)

  const { url, kunci } = kunciSupabase()
  if (!url || !kunci) return res.status(503).json({ galat: 'tertunda', tahap: 'env-server-kosong' })

  const hariIni = tglWib(0)

  if (req.method === 'POST') {
    const { garam, asal } = garamEfektif()
    if (!garam) return res.status(503).json({ galat: 'tertunda', tahap: 'garam-kosong' })
    const sidik = sidikKunjungan(
      ipPemanggil(req),
      String(req.headers?.['user-agent'] ?? ''),
      hariIni,
      garam,
    )
    try {
      const r = await fetch(`${url}/rest/v1/${TABEL}`, {
        method: 'POST',
        headers: {
          apikey: kunci,
          Authorization: `Bearer ${kunci}`,
          'Content-Type': 'application/json',
          // Idempoten: memuat ulang halaman di hari yang sama tak menambah baris.
          Prefer: 'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify({ tanggal: hariIni, sidik, negara: negaraDariKepala(req) }),
      })
      if (!r.ok) {
        console.error('kunjungan: tulis ditolak HTTP', r.status)
        return res.status(503).json({ galat: 'tertunda', tahap: `tabel-http-${r.status}` })
      }
      // Balasan sengaja tanpa isi: klien tak perlu tahu apa pun dari POST ini,
      // dan makin sedikit yang dikembalikan makin sedikit yang bisa disalahpakai.
      return res.status(204).end()
    } catch (e) {
      console.error('kunjungan: gagal menulis:', e?.name ?? 'galat')
      return res.status(503).json({ galat: 'tertunda', tahap: 'jaringan' })
    }
  }

  if (req.method === 'GET') {
    try {
      const bulan = hariIni.slice(0, 7)
      const [hari_ini, bulan_ini, total, negara] = await Promise.all([
        hitung(url, kunci, `&tanggal=eq.${hariIni}`),
        hitung(url, kunci, `&tanggal=gte.${bulan}-01`),
        hitung(url, kunci, ''),
        perNegara(url, kunci).catch(() => null),
      ])
      if (hari_ini === null || bulan_ini === null || total === null) {
        return res.status(503).json({ galat: 'tertunda', tahap: 'tabel-tak-terbaca' })
      }
      // Satu menit di CDN: angka pengunjung tak perlu lebih segar dari itu, dan
      // ini yang menjaga tiap pemuatan halaman tidak jadi satu kueri basis data.
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60')
      return res.status(200).json({ tanggal: hariIni, hari_ini, bulan_ini, total, negara })
    } catch (e) {
      console.error('kunjungan: gagal membaca:', e?.name ?? 'galat')
      return res.status(503).json({ galat: 'tertunda', tahap: 'jaringan' })
    }
  }

  return res.status(405).json({ galat: 'metode tidak didukung' })
}
