/**
 * Pivot broker → emiten (#30) — "broker ini bergerak di saham apa saja".
 *
 * Johan, di Top Broker: *"dan misal broker itu di klik bisa kita lihat aslinya
 * oh XL lagi akumulasi di saham apa saja, CC, dan lain sebagainya"*.
 *
 * Arsip broker kita disusun per EMITEN, jadi pertanyaan ini arah kebalikannya.
 * Pembalikannya dikerjakan sekali di luar peramban (`bangun_broker_pivot.py`)
 * dan hasilnya satu berkas kecil per broker — menjawabnya di sini berarti
 * mengunduh 963 arsip tahunan untuk satu klik.
 *
 * ## Yang WAJIB ikut tampil di layar
 *
 * `terpotong` membawa fakta yang tak boleh hilang: daftar broker harian per
 * emiten dipotong 50 teratas TIAP SISI oleh sumbernya. Broker yang tiap hari
 * duduk di peringkat 51 karena itu tak terhitung di emiten tersebut. Untuk
 * pertanyaan "di saham apa broker ini bergerak besar" potongan itu tepat
 * sasaran, tapi halaman yang memajangnya wajib menyebutnya — kalau tidak,
 * daftar ini terbaca sebagai rekap lengkap dan itu salah.
 */
import { useEffect, useState } from 'react'
import { urlData } from './baseData'

/** Kunci preset — sama persis dengan yang ditulis skrip pembangunnya. */
export type PresetPivot = 'h5' | 'b1' | 'b3'

export interface BarisPivot {
  kode: string
  net_nilai: number
  net_lot: number
  beli_nilai: number
  jual_nilai: number
  /** Berapa hari bursa broker ini muncul di daftar emiten tersebut. */
  hari: number
  /** |net| ÷ nilai transaksi emiten pada periode yang sama. null = penyebutnya
   *  tak ada; "tak diketahui" bukan "nol". */
  pangsa: number | null
}

export interface SisiPivot {
  beli: BarisPivot[]
  jual: BarisPivot[]
  /** Berapa emiten yang broker ini sentuh di periode itu — konteks untuk
   *  membaca "20 teratas" sebagai potongan dari apa. */
  n_emiten: number
}

export interface BrokerPivot {
  broker: string
  akhir: string
  dibangun: string
  terpotong: number
  periode: Record<PresetPivot, { mulai: string; akhir: string }>
  data: Record<PresetPivot, SisiPivot>
}

const cache = new Map<string, Promise<BrokerPivot | null>>()

export function muatBrokerPivot(kode: string): Promise<BrokerPivot | null> {
  const k = kode.toUpperCase()
  let p = cache.get(k)
  if (!p) {
    p = fetch(urlData(`/data-idx/json/broker_pivot/${k}.json`))
      // Server SPA membalas berkas yang tak ada dengan index.html berstatus
      // 200, jadi `r.ok` saja tidak cukup — parse yang gagal = tak ada.
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && typeof j === 'object' && 'data' in j ? (j as BrokerPivot) : null))
      .catch(() => null)
    cache.set(k, p)
  }
  return p
}

export function useBrokerPivot(kode: string | null): {
  data: BrokerPivot | null
  memuat: boolean
} {
  const [data, setData] = useState<BrokerPivot | null>(null)
  const [memuat, setMemuat] = useState(false)
  useEffect(() => {
    if (!kode) { setData(null); return }
    let batal = false
    setMemuat(true)
    muatBrokerPivot(kode).then((d) => {
      if (batal) return
      setData(d)
      setMemuat(false)
    })
    return () => { batal = true }
  }, [kode])
  return { data, memuat }
}
