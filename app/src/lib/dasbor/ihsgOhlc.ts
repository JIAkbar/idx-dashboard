import { useEffect, useState } from 'react'

/** Satu baris candle: [tanggal, buka, tinggi, rendah, tutup, volume]. */
export type BarisOhlc = [string, number, number, number, number, number]

/**
 * Harga BUKA IHSG untuk satu tanggal (#108).
 *
 * Membaca `ihsg_ohlc_ringkas.json` (250 hari bursa terakhir, ±13 KB) — BUKAN
 * `ihsg_harian.json` yang 36 tahun/354 KB: halaman depan cuma butuh satu angka
 * untuk menggambar lilin hari ini.
 *
 * `null` = belum termuat ATAU tanggalnya tak ada di berkas (hari yang belum
 * dipanen). Pemanggil harus tetap punya jalan mundur — panen Yahoo berjalan
 * sore hari, jadi pagi-pagi tanggal hari ini memang belum ada.
 */
export function useIhsgBuka(tanggalIso: string | undefined): number | null {
  const [buka, setBuka] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    let batal = false
    fetch('/data-idx/json/ihsg_ohlc_ringkas.json')
      .then((r) => r.json())
      .then((j: { d: BarisOhlc[] }) => {
        if (!batal) setBuka(Object.fromEntries(j.d.map((b) => [b[0], b[1]])))
      })
      .catch(() => {})
    return () => { batal = true }
  }, [])
  return tanggalIso ? (buka?.[tanggalIso] ?? null) : null
}

/**
 * Seluruh baris OHLC IHSG (250 hari bursa terakhir) — bahan grafik lilin.
 *
 * Berkas yang sama dengan `useIhsgBuka`, jadi tak ada unduhan tambahan kalau
 * keduanya dipakai di satu halaman. Riwayat yang lebih panjang
 * (`ihsg_harian.json`, 36 tahun) sengaja TIDAK dipakai di sini: isinya cuma
 * penutupan — tanpa buka/tinggi/rendah, lilin tak bisa digambar, dan
 * menggambarnya dari satu angka berarti mengarang tiga angka lainnya.
 */
export function useIhsgOhlc(): BarisOhlc[] | null {
  const [baris, setBaris] = useState<BarisOhlc[] | null>(null)
  useEffect(() => {
    let batal = false
    fetch('/data-idx/json/ihsg_ohlc_ringkas.json')
      .then((r) => r.json())
      .then((j: { d: BarisOhlc[] }) => !batal && setBaris(j.d))
      .catch(() => {})
    return () => { batal = true }
  }, [])
  return baris
}

