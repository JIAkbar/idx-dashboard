/**
 * Bantu grafik SVG untuk lapisan Peta pasar (L2-Indeks/Arus/Peringkat).
 * Lokal ke L2*, bukan komponen umum baru.tsx — dipakai berulang di L2Arus.
 */

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** "2026-09-22" -> "22 Sep", tanpa tahun (label sumbu grafik). */
export function tglSingkat(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${BLN[m - 1]}`
}

/**
 * Batang vertikal SVG (viewBox, lebar 100%). `pusatNol`: dipusatkan nol,
 * warna ikut arah (naik hijau / turun merah). Tanpa itu: dari dasar, biru
 * (nilai transaksi tak berarah), dengan garis putus rata-rata opsional.
 */
export function GrafikBatang({ data, tinggi = 120, pusatNol = false, rataRata }: {
  data: number[]
  tinggi?: number
  pusatNol?: boolean
  rataRata?: number
}) {
  const n = Math.max(data.length, 1)
  const W = n * 22
  const bw = W / n
  const maxAbs = Math.max(1, ...data.map((v) => Math.abs(v)))
  const base = pusatNol ? tinggi / 2 : tinggi
  const skala = pusatNol ? tinggi / 2 : tinggi
  return (
    <svg viewBox={`0 0 ${W} ${tinggi}`} className="bb-grafik" preserveAspectRatio="none">
      {pusatNol && <line x1={0} y1={base} x2={W} y2={base} style={{ stroke: 'var(--bb-garis)' }} strokeWidth={1} />}
      {rataRata != null && !pusatNol && (
        <line x1={0} y1={tinggi - (rataRata / maxAbs) * tinggi} x2={W} y2={tinggi - (rataRata / maxAbs) * tinggi} style={{ stroke: 'var(--bb-redup)' }} strokeWidth={1} strokeDasharray="6 5" />
      )}
      {data.map((v, i) => {
        const h = Math.max((Math.abs(v) / maxAbs) * skala, 1)
        const x = i * bw + bw * 0.18
        const w = bw * 0.64
        const y = pusatNol ? (v >= 0 ? base - h : base) : tinggi - h
        const warna = pusatNol ? (v >= 0 ? 'var(--bb-naik)' : 'var(--bb-turun)') : 'var(--bb-biru)'
        return <rect key={i} x={x} y={y} width={w} height={h} rx={1.5} style={{ fill: warna }} />
      })}
    </svg>
  )
}

/** Dua batang berdampingan per titik (beli hijau vs jual merah). */
export function GrafikBatangGanda({ a, b, tinggi = 90 }: { a: number[]; b: number[]; tinggi?: number }) {
  const n = Math.max(a.length, 1)
  const W = n * 22
  const bw = W / n
  const maxAbs = Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs))
  return (
    <svg viewBox={`0 0 ${W} ${tinggi}`} className="bb-grafik" preserveAspectRatio="none">
      {a.map((v, i) => {
        const ha = Math.max((Math.abs(v) / maxAbs) * tinggi, 1)
        const hb = Math.max((Math.abs(b[i]) / maxAbs) * tinggi, 1)
        const x = i * bw + bw * 0.14
        const w = bw * 0.36
        return (
          <g key={i}>
            <rect x={x} y={tinggi - ha} width={w} height={ha} rx={1.5} style={{ fill: 'var(--bb-naik)' }} />
            <rect x={x + w + 2} y={tinggi - hb} width={w} height={hb} rx={1.5} style={{ fill: 'var(--bb-turun)' }} />
          </g>
        )
      })}
    </svg>
  )
}

/** Garis kumulatif dengan titik puncak (hijau) & dasar (merah). */
export function GrafikGaris({ data, tinggi = 120 }: { data: number[]; tinggi?: number }) {
  const n = Math.max(data.length, 1)
  const W = Math.max((n - 1) * 10, 100)
  const lo = Math.min(...data, 0)
  const hi = Math.max(...data, 0)
  const rentang = Math.max(hi - lo, 1)
  const y = (v: number) => tinggi - ((v - lo) / rentang) * tinggi
  const x = (i: number) => (i / (n - 1 || 1)) * W
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  let iMax = 0, iMin = 0
  data.forEach((v, i) => { if (v > data[iMax]) iMax = i; if (v < data[iMin]) iMin = i })
  return (
    <svg viewBox={`0 0 ${W} ${tinggi}`} className="bb-grafik" preserveAspectRatio="none">
      <line x1={0} y1={y(0)} x2={W} y2={y(0)} style={{ stroke: 'var(--bb-garis)' }} strokeWidth={1} />
      <polyline points={pts} fill="none" style={{ stroke: 'var(--bb-biru)' }} strokeWidth={2} />
      <circle cx={x(iMax)} cy={y(data[iMax])} r={3} style={{ fill: 'var(--bb-naik)' }} />
      <circle cx={x(iMin)} cy={y(data[iMin])} r={3} style={{ fill: 'var(--bb-turun)' }} />
    </svg>
  )
}

/** Baris label sumbu tanggal jarang (tiap `setiap` indeks) di bawah grafik batang. */
export function LabelSumbu({ tanggal, setiap = 5 }: { tanggal: string[]; setiap?: number }) {
  return (
    <div style={{ display: 'flex' }}>
      {tanggal.map((t, i) => (
        <span key={t} className="bb-mono teks-11" style={{ flex: 1, textAlign: 'center', color: 'var(--bb-redup)' }}>
          {i % setiap === 0 ? tglSingkat(t) : ''}
        </span>
      ))}
    </div>
  )
}
