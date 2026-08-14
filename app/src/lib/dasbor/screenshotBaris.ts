/** Satu baris ringkas per emiten (orderbook + chart digabung) — dipakai
 *  UnggahHarian (tabel "Sudah Diunggah") dan AdminLayout (stat modal
 *  sambutan). Diekstrak dari AdminHome.tsx lama supaya keduanya tidak
 *  menduplikasi regex pemetaan nama berkas. */
export interface Baris {
  ticker: string
  /** Path lengkap di bucket ({tanggal}/{TICKER}-orderbook.ext) — dipakai tombol hapus. */
  orderbook?: string
  chart?: string
}

/** Kelompokkan daftar path storage ({tanggal}/{TICKER}-orderbook|chart.ext)
 *  jadi satu baris per emiten. */
export function rangkumBerkas(paths: string[]): Baris[] {
  const map = new Map<string, Baris>()
  for (const p of paths) {
    const nama = p.split('/').pop() ?? ''
    const m = /^([A-Z0-9]+)-(orderbook|chart)\./.exec(nama)
    if (!m) continue
    const [, ticker, jenis] = m
    const baris = map.get(ticker) ?? { ticker }
    if (jenis === 'orderbook') baris.orderbook = p
    else baris.chart = p
    map.set(ticker, baris)
  }
  return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker))
}
