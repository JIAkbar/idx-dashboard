import { useDataHarian } from '../../lib/dasbor/dataHarian'

/**
 * Pita kurs berjalan di kepala halaman. Isinya IHSG + Top Gainer & Top Loser
 * saham hari itu dari berkas harian yang sedang dibuka — angka nyata, bukan
 * hiasan. Tanpa lencana teks di ujung kiri: lencana statis duduk tepat di
 * jalur teks bergerak dan justru menghalangi bacaan.
 *
 * Deretnya digandakan dua kali karena animasinya menggeser -50%; tanpa salinan
 * kedua, pita akan terlihat kosong di separuh putaran.
 */
export function PitaKurs() {
  const { hari } = useDataHarian()

  if (!hari) return <div className="dasbor-pita" aria-hidden="true" />

  const topGainers = (hari.gainers ?? []).slice(0, 5)
  const topLosers = (hari.losers ?? []).slice(0, 5)

  const isi = [
    { nama: 'IHSG', nilai: hari.ihsg_value, delta: hari.ihsg_pct },
    ...topGainers.map((g) => ({ nama: g.c, nilai: g.td, delta: g.p })),
    ...topLosers.map((l) => ({ nama: l.c, nilai: l.td, delta: l.p })),
  ]

  const deret = isi.map((x, i) => (
    <span className="dasbor-tk" key={i}>
      <b>{x.nama}</b>
      <span className="dasbor-num">
        {x.nilai.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className={'dasbor-num ' + (x.delta >= 0 ? 'up' : 'dn')}>
        {x.delta >= 0 ? '▲' : '▼'} {x.delta >= 0 ? '+' : '−'}
        {Math.abs(x.delta).toFixed(2).replace('.', ',')}%
      </span>
      <span className="dasbor-tk-sep">|</span>
    </span>
  ))

  return (
    <div className="dasbor-pita" aria-hidden="true">
      <div className="dasbor-pita-mid">
        <div className="dasbor-pita-track">
          {deret}
          {deret}
        </div>
      </div>
    </div>
  )
}
