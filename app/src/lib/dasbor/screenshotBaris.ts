/** Satu baris ringkas per emiten (broker summary + chart digabung) — dipakai
 *  UnggahHarian (tabel "Sudah Diunggah") dan AdminLayout (stat modal
 *  sambutan). Diekstrak dari AdminHome.tsx lama supaya keduanya tidak
 *  menduplikasi regex pemetaan nama berkas. */
export interface Baris {
  ticker: string
  /** Path lengkap di bucket ({tanggal}/{TICKER}-broksum.ext) — dipakai tombol hapus.
   *  Unggahan sebelum 25 Agu 2026 bernama `-orderbook`; keduanya dipetakan
   *  ke ruas ini. */
  broksum?: string
  chart?: string
}

/** Kelompokkan daftar path storage ({tanggal}/{TICKER}-broksum|chart.ext)
 *  jadi satu baris per emiten.
 *
 *  Menerima `-orderbook` DAN `-broksum`. Berkas lama TIDAK dipindah: nama
 *  lama tetap terbaca, unggahan baru langsung memakai nama benar, dan nol
 *  objek storage perlu disentuh — memindahkan 106 berkas demi keseragaman
 *  nama berarti menukar risiko kehilangan gambar dengan kerapian. */
export function rangkumBerkas(paths: string[]): Baris[] {
  const map = new Map<string, Baris>()
  for (const p of paths) {
    const nama = p.split('/').pop() ?? ''
    const m = /^([A-Z0-9]+)-(broksum|orderbook|chart)\./.exec(nama)
    if (!m) continue
    const [, ticker, jenis] = m
    const baris = map.get(ticker) ?? { ticker }
    if (jenis === 'chart') baris.chart = p
    else baris.broksum = p
    map.set(ticker, baris)
  }
  return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker))
}
