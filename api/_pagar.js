/**
 * Pagar pemakaian bersama untuk fungsi server PAPAN (#109 A, dipakai ulang #112).
 *
 * Dipisah dari `live-harga.js` saat endpoint kedua lahir: menyalin pagarnya
 * berarti dua salinan yang bisa diam-diam berbeda, dan pagar yang berbeda per
 * endpoint adalah pagar yang tak bisa diaudit sekali jalan.
 *
 * Dua lapis, sengaja lemah pada hal yang berbeda:
 *
 * 1. ASAL — permintaan yang MEMBAWA `Origin`/`Referer` milik situs lain
 *    ditolak. Menutup pemakaian dari halaman web orang lain, bukan penyalin
 *    yang memakai skrip. Permintaan TANPA asal (bilah alamat, curl, pemantau)
 *    tetap dilayani: memblokirnya cuma melukai pemeriksaan kita sendiri,
 *    sementara penyalin tinggal menghapus header.
 * 2. BATAS LAJU per IP — yang benar-benar menahan pemakaian bervolume. Jendela
 *    luncur 60 detik, per instans fungsi (instans tak dibagi antar-wilayah,
 *    jadi angkanya "per instans", bukan global). Cukup menahan hantaman
 *    beruntun satu IP, tidak cukup menahan botnet — dan itu memang batasnya.
 */

// SEMPIT, bukan `*.vercel.app`: uji pertama pagar ini menunjukkan pola lebar
// itu meloloskan situs Vercel milik SIAPA PUN — pagar yang terbaca ketat tapi
// praktis terbuka.
const ASAL_SAH = /^papan-idx\.vercel\.app$|^papan-idx-[a-z0-9-]+\.vercel\.app$|-johan-iriawan-akbar-s-projects\.vercel\.app$|^localhost$|^127\.0\.0\.1$/

/** Host dari `Origin`/`Referer`; null kalau permintaan tak membawa keduanya. */
export function asalPermintaan(headers) {
  const h = headers ?? {}
  const mentah = h.origin || h.referer || h.Referer || ''
  if (!mentah) return null
  try {
    return new URL(mentah).hostname
  } catch {
    return null
  }
}

/** true = boleh dilayani. Tanpa asal = boleh (lihat catatan di atas). */
export function asalDiizinkan(headers) {
  const host = asalPermintaan(headers)
  return host === null || ASAL_SAH.test(host)
}

const JENDELA_MS = 60_000
const BATAS_PER_IP = 40
/** IP -> stempel waktu permintaan di dalam jendela. Milik satu instans. */
const jejakIp = new Map()

/** Catat satu permintaan; balikkan sisa jatah (negatif = melewati batas).
 *  Dipisah dari handler supaya bisa diuji tanpa jaringan. */
export function catatLaju(ip, kini, batas = BATAS_PER_IP, jendela = JENDELA_MS) {
  const lama = jejakIp.get(ip) ?? []
  const hidup = lama.filter((t) => kini - t < jendela)
  hidup.push(kini)
  jejakIp.set(ip, hidup)
  // Peta dibersihkan sesekali supaya instans yang hidup lama tak menumpuk IP
  // yang sudah tak pernah datang lagi.
  if (jejakIp.size > 500) {
    for (const [k, v] of jejakIp) if (v.every((t) => kini - t >= jendela)) jejakIp.delete(k)
  }
  return batas - hidup.length
}

/** IP pemanggil menurut header proxy Vercel; 'tak-dikenal' kalau tak terbaca. */
export function ipPemanggil(req) {
  const h = req?.headers ?? {}
  const maju = String(h['x-forwarded-for'] || '')
  return maju.split(',')[0].trim() || String(h['x-real-ip'] || '') || 'tak-dikenal'
}

/** Tanggal WIB `YYYY-MM-DD`, `geser` hari ke belakang. Server berjalan di UTC,
 *  jadi tanggalnya digeser +7 jam dulu — tanpa itu, tiap hari antara 00:00 dan
 *  07:00 WIB jatuh ke tanggal kemarin. */
export function tglWib(geser = 0, kini = Date.now()) {
  return new Date(kini + 7 * 3600e3 - geser * 86400e3).toISOString().slice(0, 10)
}

/** Pagar lengkap untuk satu permintaan. Balikkan null kalau boleh lanjut, atau
 *  {kode, badan} yang siap dikirim kalau ditolak — supaya tiap handler menolak
 *  dengan bentuk yang sama persis. */
export function periksaPagar(req, kini = Date.now()) {
  if (!asalDiizinkan(req?.headers)) {
    return { kode: 403, badan: { galat: 'asal tidak diizinkan' } }
  }
  if (catatLaju(ipPemanggil(req), kini) < 0) {
    return { kode: 429, badan: { galat: 'terlalu sering', coba_lagi_detik: 60 } }
  }
  return null
}
