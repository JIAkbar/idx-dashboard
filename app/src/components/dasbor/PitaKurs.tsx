import { useDataHarian } from '../../lib/dasbor/dataHarian'

/**
 * Pita kurs berjalan di kepala halaman. Isinya IHSG + indeks dunia dari berkas
 * harian yang sedang dibuka — angka nyata, bukan hiasan. Tanpa lencana teks di
 * ujung kiri: lencana statis duduk tepat di jalur teks bergerak dan justru
 * menghalangi bacaan.
 *
 * Deretnya digandakan dua kali karena animasinya menggeser -50%; tanpa salinan
 * kedua, pita akan terlihat kosong di separuh putaran.
 */
export function PitaKurs() {
  const { hari } = useDataHarian()
  const world = hari?.world ?? []

  if (!hari) return <div className="dasbor-pita" aria-hidden="true" />

  const isi = [
    { nama: 'IHSG', nilai: hari.ihsg_value, delta: hari.ihsg_pct },
    ...world.filter((w) => !w.is_idx).slice(0, 9).map((w) => ({ nama: w.c, nilai: w.v, delta: w.d })),
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
