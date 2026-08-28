import { useMemo, useState } from 'react'

/**
 * Perbandingan satu pasang baris berdasar satu kunci. Fungsi murni supaya bisa
 * diuji tanpa merender React — useUrut di bawah cuma menyimpan state di atasnya.
 */
/** Peringkat sinyal rekomendasi, dari paling bullish ke paling bearish.
 *
 * Nilai-nilai ini string, dan pembanding umum di bawah mengurut string secara
 * ALFABET — yang untuk skor menghasilkan urutan tak bermakna: Buy, Neutral,
 * Sell, Strong Buy, Strong Sell. "Strong Buy" dan "Strong Sell" berdampingan
 * di dasar daftar padahal keduanya berlawanan arti (temuan Johan 29 Agu 2026:
 * "jadikan yang utama di sorting itu bukan alfabet tapi strong buy, buy,
 * netral, dst").
 *
 * Ditulis huruf kecil supaya cocok apa pun kapitalisasi sumbernya. */
const PERINGKAT_SINYAL: Record<string, number> = {
  'strong buy': 5,
  buy: 4,
  neutral: 3,
  netral: 3,
  sell: 2,
  'strong sell': 1,
}

/** Nilai peringkat sinyal, atau null kalau string ini bukan sinyal. */
function peringkatSinyal(v: unknown): number | null {
  if (typeof v !== 'string') return null
  return PERINGKAT_SINYAL[v.trim().toLowerCase()] ?? null
}

export function bandingkanBaris<T extends object>(
  a: T,
  b: T,
  kunci: keyof T,
  arah: 'naik' | 'turun',
): number {
  const x = a[kunci]
  const y = b[kunci]
  // Ruas kosong SELALU di bawah, di kedua arah — dibalik bersama yang lain,
  // "urut naik" menaruh sebelas emiten tanpa R1 di puncak daftar seolah
  // merekalah yang terdekat. Tak ada nilai berarti "tak diketahui", bukan nol.
  if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1

  // Kolom sinyal diurut menurut ARTINYA, bukan hurufnya. Diperiksa lebih dulu
  // daripada cabang angka/teks di bawah karena keduanya string.
  const px = peringkatSinyal(x)
  const py = peringkatSinyal(y)
  if (px != null && py != null) {
    // Sengaja dibalik: "naik" pada kolom sinyal berarti yang paling bullish di
    // atas, bukan peringkat angka terkecil di atas.
    const cs = py - px
    return arah === 'naik' ? cs : -cs
  }

  const c =
    typeof x === 'number' && typeof y === 'number'
      ? x - y
      : String(x ?? '').localeCompare(String(y ?? ''), 'id')
  return arah === 'naik' ? c : -c
}

/**
 * Pengurutan tabel oleh klik judul kolom. Dipakai bersama 6 tabel Top Broker dan
 * 6 tabel Top Stocks — satu helper, bukan satu keadaan per tabel per berkas.
 */
export function useUrut<T extends object>(baris: T[], awal: keyof T, arahAwal: 'naik' | 'turun' = 'turun') {
  const [kunci, setKunci] = useState<keyof T>(awal)
  const [arah, setArah] = useState<'naik' | 'turun'>(arahAwal)

  const urut = useMemo(
    () => [...baris].sort((a, b) => bandingkanBaris(a, b, kunci, arah)),
    [baris, kunci, arah],
  )

  function klik(k: keyof T) {
    if (k === kunci) setArah((a) => (a === 'naik' ? 'turun' : 'naik'))
    else {
      setKunci(k)
      setArah('turun')
    }
  }

  return { urut, kunci, arah, klik }
}
