/**
 * Deret waktu kinerja grup konglomerat (Paket J, audit gap panel
 * `GrupKonglomerat.tsx`: sebelumnya cuma chip snapshot h1/wtd/mtd, tak ada
 * bentuk deret). Fungsi murni di sini, komponennya cuma memanggil.
 *
 * Metode: indeks kumulatif BOBOT SETARA dari return harian anggota grup,
 * rebased ke 100 di hari pertama rentang — konvensi indeks harga sederhana
 * (mis. equal-weight index), bukan hitungan resmi bursa. IHSG dihitung
 * dengan cara yang sama (return harian tutup) supaya dua garis sebanding.
 *
 * Anggota yang tak berdata pada satu hari (suspend/belum listing) dilewati
 * hari itu — return terakhirnya "membeku" sampai muncul data berikutnya,
 * sama seperti indeks sungguhan menangani saham suspend.
 */
import type { BarisOhlc } from './ihsgOhlc'

export interface DeretIndeksGrup {
  tgl: string[]
  /** Indeks kumulatif grup, rebased 100 di tgl[0]. */
  grup: number[]
  /** IHSG rebased 100 di tgl[0] yang sama — pembanding. */
  ihsg: number[]
}

/**
 * `anggotaOhlc`: satu array `BarisOhlc[]` per anggota (boleh berisi entri
 * `null` untuk anggota yang gagal dimuat — dilewati). `ihsgOhlc` dipakai
 * SEKALIGUS sebagai kalender hari bursa (indeks sebuah anggota tak dipakai
 * sebagai kalender karena bisa berlubang oleh suspend) dan sebagai deret
 * pembanding. `mulai`/`akhir` inklusif, format ISO 'YYYY-MM-DD'.
 *
 * `null` kalau rentangnya < 2 hari bursa atau tak ada satu pun anggota
 * berdata di rentang itu.
 */
export function deretIndeksGrup(
  anggotaOhlc: Array<BarisOhlc[] | null>,
  ihsgOhlc: BarisOhlc[],
  mulai: string,
  akhir: string,
): DeretIndeksGrup | null {
  const iris = ihsgOhlc.filter((b) => b[0] >= mulai && b[0] <= akhir)
  if (iris.length < 2) return null

  const peta = anggotaOhlc
    .filter((b): b is BarisOhlc[] => b !== null)
    .map((bars) => new Map(bars.map((b) => [b[0], b[4]] as const)))
    .filter((p) => iris.some((b) => p.has(b[0])))
  if (!peta.length) return null

  const prevHarga: Array<number | null> = peta.map((p) => p.get(iris[0][0]) ?? null)
  const tgl: string[] = [iris[0][0]]
  const grup: number[] = [100]
  const ihsg: number[] = [100]

  for (let k = 1; k < iris.length; k++) {
    const [t, , , , tutupIhsg] = iris[k]
    const returns: number[] = []
    peta.forEach((p, i) => {
      const h = p.get(t)
      if (h == null) return
      if (prevHarga[i] != null) returns.push(h / (prevHarga[i] as number) - 1)
      prevHarga[i] = h
    })
    const avg = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0
    grup.push(grup[grup.length - 1] * (1 + avg))
    ihsg.push(ihsg[ihsg.length - 1] * (tutupIhsg / iris[k - 1][4]))
    tgl.push(t)
  }
  return { tgl, grup, ihsg }
}
