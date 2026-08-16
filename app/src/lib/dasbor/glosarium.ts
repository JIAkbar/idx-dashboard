/**
 * Pencari istilah di glosarium PAPAN.
 *
 * Isinya (`glosarium.json`) ditambang dari korpus PAPAN sendiri — edisi,
 * analisa keluaran, bedah, tiga dokumen pedoman, dan kode radar/skor/fraksi —
 * oleh `scripts/bangun_glosarium.py`. Tiap istilah membawa `frekuensi` dan
 * kutipan `contoh` asli, jadi definisinya bisa ditelusuri balik ke tempat
 * istilah itu benar-benar dipakai, bukan ke ingatan siapa pun.
 *
 * Bedanya dengan `pengetahuan.ts`: itu menjawab "bagaimana platform ini
 * bekerja" (aturan bursa, kebijakan kontributor, isi tiap halaman); ini
 * menjawab "apa arti kata ini" untuk kosakata yang memang dipakai di terbitan
 * PAPAN.
 */

import data from './glosarium.json'

export interface EntriGlosarium {
  id: string
  istilah: string
  kunci: string[]
  definisi: string
  frekuensi: number
  contoh?: string
  catatan?: string
  ke?: string
}

export const GLOSARIUM = data.istilah as EntriGlosarium[]

/** Metakarakter regex — dipakai untuk memisahkan kunci berupa pola dari kunci berupa kata biasa. */
const META = /[\\()[\]|?*+^$]/

const cache = new Map<string, RegExp>()

/**
 * Kunci di berkasnya campur dua bentuk: kebanyakan kata biasa ("pivot",
 * "big acc"), sembilan di antaranya pola regex yang ditulis untuk tahap
 * penambangan (`\bvolume\b`, `hit.?rate`). Keduanya diperlakukan sama di sini
 * — yang berupa kata biasa dibungkus batas kata supaya tak ikut cocok di
 * tengah kata lain. Tanpa itu "ara" cocok di dalam "sekarang", jebakan yang
 * sudah sekali menggigit di `pengetahuan.ts`.
 */
function pola(kunci: string): RegExp {
  let r = cache.get(kunci)
  if (!r) {
    r = META.test(kunci)
      ? new RegExp(kunci, 'i')
      : new RegExp(`\\b${kunci.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    cache.set(kunci, r)
  }
  return r
}

/**
 * Cari istilah yang paling cocok dengan pertanyaan.
 *
 * Menang berdasarkan jumlah kunci yang cocok; kalau seri, yang kunci
 * cocoknya paling PANJANG yang menang — "big dist" harus mengalahkan "dist",
 * karena pertanyaan yang lebih spesifik pantas dijawab entri yang lebih
 * spesifik. Tak ada yang cocok → `null`, bukan tebakan terdekat.
 */
export function cariGlosarium(pertanyaan: string): EntriGlosarium | null {
  const t = pertanyaan.trim()
  if (!t) return null

  let terbaik: EntriGlosarium | null = null
  let skorTerbaik = 0
  let panjangTerbaik = 0

  for (const e of GLOSARIUM) {
    let skor = 0
    let panjang = 0
    for (const k of e.kunci) {
      if (pola(k).test(t)) {
        skor += 1
        panjang = Math.max(panjang, k.length)
      }
    }
    if (skor > skorTerbaik || (skor === skorTerbaik && skor > 0 && panjang > panjangTerbaik)) {
      skorTerbaik = skor
      panjangTerbaik = panjang
      terbaik = e
    }
  }
  return skorTerbaik > 0 ? terbaik : null
}
