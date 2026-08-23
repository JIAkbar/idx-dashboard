/**
 * Sparkline batang kecil — port `miniBars()` mockup (canvas) sebagai SVG,
 * lebih pas dipola React (tak perlu ref+effect per baris tabel). Dipakai
 * Market Flow & Broker Analysis (Overview): batang naik dari tengah untuk
 * nilai positif, turun untuk negatif — warna beli/jual dari token tema.
 */
export function Sparkline({ nilai }: { nilai: number[] }) {
  if (nilai.length === 0) return <svg className="bs2-spark" />
  const w = 100, h = 28, mid = h / 2
  const maks = Math.max(1, ...nilai.map(Math.abs))
  const lebarBatang = Math.max(1, (w / nilai.length) * 0.6)
  return (
    <svg className="bs2-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {nilai.map((v, i) => {
        const x = (w * (i + 0.5)) / nilai.length - lebarBatang / 2
        const tinggi = (Math.abs(v) / maks) * (mid - 2)
        return (
          <rect
            key={i}
            x={x}
            y={v >= 0 ? mid - tinggi : mid}
            width={lebarBatang}
            height={Math.max(0.5, tinggi)}
            fill={v >= 0 ? 'var(--green)' : 'var(--red)'}
          />
        )
      })}
    </svg>
  )
}
