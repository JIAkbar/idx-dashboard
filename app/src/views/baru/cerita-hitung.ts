/** Helper murni #231 Layar Emiten — susun fakta harian dari OHLC + asing +
 *  broker_puncak, dan ringkas fase broker. Tak ada I/O, tak ada JSX: mudah
 *  diuji dan dipakai LayarEmiten.tsx untuk merakit kalimat (format angka
 *  Indonesia dilakukan di komponen lewat data.ts, bukan di sini). */

export type BarisOhlc = [string, number, number, number, number, number]
/** [tanggal, beli, jual, volume, value, frekuensi] — beli/jual dalam LEMBAR. */
export type BarisAsing = [string, number, number, number, number, number]

export interface HariBrokerPuncak {
  tanggal: string
  accdist: string
  total_nilai: number
  beli: [string, number][]
  jual: [string, number][]
}

export interface FaktaHari {
  tanggal: string
  close: number
  chgPct: number | null
  netAsingLembar: number | null
  broker: HariBrokerPuncak | null
}

/** Fakta harian untuk `n` hari bursa terakhir (urut tanggal naik). `chgPct`
 *  dihitung terhadap penutupan hari bursa sebelumnya di seluruh riwayat
 *  `ohlc` (bukan cuma dalam potongan `n`), jadi hari pertama yang ditampilkan
 *  tetap punya perubahan yang benar. */
export function susunFaktaHarian(
  ohlc: BarisOhlc[],
  asing: BarisAsing[] | null,
  brokerHari: HariBrokerPuncak[] | null,
  n = 10,
): FaktaHari[] {
  const asingByTgl = new Map((asing ?? []).map((b) => [b[0], b]))
  const brokerByTgl = new Map((brokerHari ?? []).map((h) => [h.tanggal, h]))
  const potong = ohlc.slice(-n)
  const mulaiIdx = ohlc.length - potong.length

  return potong.map((baris, i) => {
    const [tanggal, , , , close] = baris
    const idxPenuh = mulaiIdx + i
    const prevClose = idxPenuh > 0 ? ohlc[idxPenuh - 1][4] : null
    const chgPct = prevClose ? ((close - prevClose) / prevClose) * 100 : null
    const a = asingByTgl.get(tanggal)
    const netAsingLembar = a ? a[1] - a[2] : null
    return { tanggal, close, chgPct, netAsingLembar, broker: brokerByTgl.get(tanggal) ?? null }
  })
}

/** Hitung berapa dari `n` hari broker_puncak TERAKHIR yang berstatus 'Dist'
 *  (distribusi). `total` bisa < n kalau datanya lebih pendek. */
export function susunFaseBroker(brokerHari: HariBrokerPuncak[] | null, n = 5): { dist: number; total: number } {
  const potong = (brokerHari ?? []).slice(-n)
  return { dist: potong.filter((h) => h.accdist === 'Dist').length, total: potong.length }
}
