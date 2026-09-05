import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { useJamBursa } from './Kalender'

/**
 * Pita kurs berjalan di kepala halaman. Isinya IHSG + Top Gainer & Top Loser
 * saham hari itu dari berkas harian yang sedang dibuka — angka nyata, bukan
 * hiasan. Tanpa lencana teks di ujung kiri: lencana statis duduk tepat di
 * jalur teks bergerak dan justru menghalangi bacaan.
 *
 * Deretnya digandakan dua kali karena animasinya menggeser -50%; tanpa salinan
 * kedua, pita akan terlihat kosong di separuh putaran.
 *
 * Status bursa duduk di ujung KANAN, di luar jalur bergerak. Pindah ke sini
 * dari hero kalender (keputusan Johan 2 Sep 2026, "D + E digabung"): ia
 * keadaan seluruh situs, jadi tempatnya di kepala yang tampil di semua
 * halaman — bukan di empat halaman yang kebetulan punya hero. Saat bursa
 * buka ia menyebut sesinya dan jam berjalan; saat tutup, kapan buka lagi.
 */
/** Diekspor sejak 5 Sep 2026 supaya kepala halaman bisa menampilkannya
 *  TANPA pita berjalan. Johan minta pita hanya di Beranda; chip ini keputusan
 *  terpisah (2 Sep, "D + E digabung") yang justru menaruhnya di kepala supaya
 *  tampil di semua halaman. Mengekspornya menjaga kedua keputusan sekaligus,
 *  alih-alih yang baru diam-diam membatalkan yang lama. */
export function StatusBursa() {
  const { buka, sesi, jam, labelTutup } = useJamBursa()
  return (
    <span className={'dasbor-pita-status' + (buka ? ' buka' : '')} aria-live="off">
      <span className="dasbor-pita-titik" aria-hidden="true" />
      {buka ? `${sesi?.[0] ?? 'Bursa buka'} · ${jam}` : `Bursa tutup · ${labelTutup}`}
    </span>
  )
}

export function PitaKurs() {
  const { hari } = useDataHarian()

  if (!hari) return <div className="dasbor-pita dasbor-pita-solo"><StatusBursa /></div>

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
    <div className="dasbor-pita">
      <div className="dasbor-pita-mid" aria-hidden="true">
        <div className="dasbor-pita-track">
          {deret}
          {deret}
        </div>
      </div>
      <StatusBursa />
    </div>
  )
}
