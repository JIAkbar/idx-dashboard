import { useEffect, useState } from 'react'

/**
 * Uji Aturan — hasil benchmark cara menentukan area beli, target, dan batas
 * rugi (`scripts/riset/benchmark_aturan.py`, 1 Sep 2026).
 *
 * ## Kenapa angka utamanya BUKAN win rate
 *
 * Win rate mengabaikan besar menang dan besar kalah. Aturan yang dipakai
 * sekarang memasang target lebih DEKAT daripada batas ruginya, jadi ia menang
 * sering tapi kecil dan kalah jarang tapi besar — win rate-nya terlihat bagus
 * sementara hasil bersihnya tipis. Yang dipakai di sini `eksR`: ekspektansi
 * dibagi risiko rata-rata yang benar-benar ditanggung, jadi aturan dengan
 * batas rugi lebar dan sempit bisa dibandingkan dalam satuan yang sama.
 *
 * ## Yang WAJIB ikut tampil, bukan opsional
 *
 * `beliTahan` — hasil beli-lalu-tahan tanpa target dan tanpa batas rugi, pada
 * hari sinyal yang sama persis. Tanpa angka ini, aturan mana pun akan terlihat
 * berhasil di periode pasar yang sedang naik. Terukur: membeli apa saja lalu
 * menahan 5 hari memberi +0,87%, dan membeli saham bertren rapi +2,61% —
 * dua-duanya tanpa aturan sama sekali. Halaman yang memajang ekspektansi
 * aturan tanpa memajang angka ini menyesatkan pembacanya.
 *
 * `ketahanan.rho` — korelasi peringkat antara paruh awal dan paruh akhir
 * rentang uji. 644 sel diuji; yang terbaik dari sekian ratus akan terlihat
 * bagus semata karena kebetulan, dan rho inilah yang membedakan temuan dari
 * undian. Terukur +0,566: ada sinyal nyata, tapi tidak cukup tajam untuk
 * menunjuk SATU sel sebagai juara (jarak juara ke runner-up cuma 0,26
 * simpangan baku). Karena itu tampilan wajib menekankan KELUARGA aturan,
 * bukan baris tunggal.
 *
 * ## Kelas buktinya
 *
 * Seluruh angka ini dari sinyal yang DIREKONSTRUKSI — aturan diterapkan mundur
 * ke harga lama. Ia menjawab "aturan mana yang bekerja pada masa lalu", bukan
 * "apa yang sudah terjadi di PAPAN". Catatan harian yang sungguh ditulis pada
 * harinya ada di tab Riwayat, dan untuk menilai kelayakan produk itulah yang
 * berbobot, betapapun kecil sampelnya.
 */

export interface AturanUji {
  id: string
  /** Kalimat yang dibaca pengguna — bukan nama ruas mesin. */
  nama: string
  keluarga: string
  wr: number
  tuntas: number
  risiko: number
  eks: number
  eksR: number
  /** eksR sesudah biaya transaksi 0,40% pulang-pergi. `null` kalau tak terhitung. */
  eksR_biaya: number | null
}

export interface KeluargaUji {
  nama: string
  n: number
  median: number
  lama: number
  baru: number
}

export interface BenchmarkAturan {
  dibuat: string
  cakupan: { emiten: number; sinyal: number; sel: number; horizon: number[] }
  ketahanan: {
    rho: number
    kokohPct: number
    jarakSD: number
    sebaran: { min: number; q25: number; median: number; q75: number; max: number; sd: number }
  }
  keluarga: KeluargaUji[]
  aturan: AturanUji[]
  produksi: { horizon: number; wr: number; tuntas: number; eks: number; eksR: number }[]
  beliTahan: { saringan: string; horizon: number; rata: number; median: number }[]
}

const cache = new Map<string, Promise<BenchmarkAturan | null>>()

export function muatBenchmarkAturan(): Promise<BenchmarkAturan | null> {
  let p = cache.get('x')
  if (!p) {
    p = fetch('/data-idx/json/benchmark_aturan.json')
      .then((r) => (r.ok ? (r.json() as Promise<BenchmarkAturan>) : null))
      .catch(() => null)
    cache.set('x', p)
  }
  return p
}

export function useBenchmarkAturan(): BenchmarkAturan | null {
  const [d, setD] = useState<BenchmarkAturan | null>(null)
  useEffect(() => {
    let batal = false
    void muatBenchmarkAturan().then((x) => { if (!batal) setD(x) })
    return () => { batal = true }
  }, [])
  return d
}

/** Beli-lalu-tahan pada horizon & saringan tertentu — pembanding wajib.
 *  `null` kalau kombinasinya tak diukur (jangan diam-diam jatuh ke nol:
 *  nol terbaca sebagai "pasar datar", padahal artinya "belum diukur"). */
export function beliTahan(d: BenchmarkAturan, saringan: string, horizon: number): number | null {
  return d.beliTahan.find((x) => x.saringan === saringan && x.horizon === horizon)?.rata ?? null
}

/** Selisih ekspektansi aturan terhadap beli-lalu-tahan pada horizon yang sama.
 *  INI angka yang menjawab "aturannya menambah apa" — bukan `eks` sendirian. */
export function lebihDariBeliTahan(d: BenchmarkAturan, eks: number, horizon: number): number | null {
  const bt = beliTahan(d, 'semua', horizon)
  return bt == null ? null : eks - bt
}

/** Penurunan paruh akhir terhadap paruh awal, dalam persen. Dipakai untuk
 *  menandai bahwa SELURUH keluarga melemah — yang berubah pasarnya, bukan
 *  aturannya, dan pembaca perlu tahu itu sebelum memakai angka periode penuh. */
export function pelemahanPct(k: KeluargaUji): number | null {
  return k.lama > 0 ? Math.round((1 - k.baru / k.lama) * 100) : null
}
