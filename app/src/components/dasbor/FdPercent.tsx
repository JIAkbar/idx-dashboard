/**
 * Persentase berwarna hijau/merah, abu-abu "—" kalau null — port helper
 * lokal `fp` di dalam fdRender() index_live.html baris 4036-4040. Dipakai
 * di beberapa kolom Stock Detail (Profitabilitas, Growth, Dividen, overview).
 */
export function FdPercent({ v, d = 2 }: { v: number | null | undefined; d?: number }) {
  if (v == null) return <span style={{ color: 'var(--text3)' }}>—</span>
  return (
    <span className={v >= 0 ? 'green' : 'red'}>
      {v >= 0 ? '+' : ''}{Number(v).toFixed(d)}%
    </span>
  )
}
