import { useMemo, useState } from 'react'

/**
 * Perbandingan satu pasang baris berdasar satu kunci. Fungsi murni supaya bisa
 * diuji tanpa merender React — useUrut di bawah cuma menyimpan state di atasnya.
 */
export function bandingkanBaris<T extends object>(
  a: T,
  b: T,
  kunci: keyof T,
  arah: 'naik' | 'turun',
): number {
  const x = a[kunci]
  const y = b[kunci]
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
export function useUrut<T extends object>(baris: T[], awal: keyof T) {
  const [kunci, setKunci] = useState<keyof T>(awal)
  const [arah, setArah] = useState<'naik' | 'turun'>('turun')

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
