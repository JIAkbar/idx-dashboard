import { useEffect, useState } from 'react'
import { dariBerkasTahunan, tahunDibutuhkan, type HariBroker } from './whalesPapan'

/**
 * Muat seluruh arsip broker harian satu emiten.
 *
 * Dipisah dari komponen karena DUA halaman membacanya — Whales Papan (sumbu
 * masuk harga) dan Trader Papan (sumbu masuk pelaku). Versi pertama menyalin
 * blok ini ke halaman kedua; salinan itu dibuang. Bentuk berkasnya sudah
 * pernah berubah sekali, dan satu-satunya cara perubahan berikutnya tak
 * menyisakan halaman yang membaca bentuk lama adalah kalau cuma ada satu
 * pembaca.
 *
 * `galat` sengaja tiga keadaan yang berbeda, bukan satu boolean: emiten yang
 * arsipnya belum dipanen ('belum-ada') tak sama dengan emiten yang arsipnya
 * ada tapi kosong ('kosong'), dan halaman perlu mengatakannya dengan kalimat
 * yang berbeda.
 */
export type GalatBroker = 'belum-ada' | 'kosong' | null

export function useBrokerTahunan(kode: string): {
  hari: HariBroker[]
  tahunAda: number[]
  muat: boolean
  galat: GalatBroker
} {
  const [hari, setHari] = useState<HariBroker[]>([])
  const [tahunAda, setTahunAda] = useState<number[]>([])
  const [muat, setMuat] = useState(false)
  const [galat, setGalat] = useState<GalatBroker>(null)

  useEffect(() => {
    let batal = false
    setMuat(true)
    setGalat(null)
    ;(async () => {
      try {
        const ri = await fetch(`/data-idx/json/broker_tahunan/${kode}/index.json`)
        if (!ri.ok) throw new Error('belum-ada')
        const idx = (await ri.json()) as { tahun?: number[] }
        const tahun = (idx.tahun ?? []).slice().sort((a, b) => a - b)
        if (batal) return
        setTahunAda(tahun)
        if (tahun.length === 0) {
          setHari([])
          setGalat('kosong')
          return
        }
        const perlu = tahunDibutuhkan(
          `${tahun[0]}-01-01`,
          `${tahun[tahun.length - 1]}-12-31`,
        ).filter((t) => tahun.includes(t))
        const bagian = await Promise.all(
          perlu.map(async (t) => {
            const r = await fetch(`/data-idx/json/broker_tahunan/${kode}/${t}.json`)
            return r.ok ? dariBerkasTahunan(await r.json()) : []
          }),
        )
        if (batal) return
        const semua = bagian.flat().sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1))
        setHari(semua)
        if (semua.length === 0) setGalat('kosong')
      } catch {
        if (!batal) {
          setHari([])
          setTahunAda([])
          setGalat('belum-ada')
        }
      } finally {
        if (!batal) setMuat(false)
      }
    })()
    return () => {
      batal = true
    }
  }, [kode])

  return { hari, tahunAda, muat, galat }
}
