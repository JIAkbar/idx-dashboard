import { useEffect, useRef, useState } from 'react'

/** Total durasi riak (delay tahap terakhir + durasi animasinya sendiri) —
 *  dipakai timer JS & disamakan komentar dgn nilai di CSS (.riak di lantai.css). */
const RIAK_STEP = 0.03
const RIAK_DUR = 0.28

/**
 * Papan split-flap — tiap karakter angka jadi satu kartu .flap, pemisah ribuan
 * dan koma memakai varian .sym. Port docs/design-lantai-bursa-reimagined.html
 * baris 121-129 (animasi flip + jeda bertahap per kartu ada di CSS).
 *
 * Riak (#3): saat `nilai` BERUBAH (bukan saat mount pertama — itu jatah
 * animasi .flip yang sudah ada), tiap kartu digit dapat sentuhan naik-turun
 * halus (transform+opacity, TANPA reflow) menjalar kiri→kanan lewat
 * animationDelay per-indeks — gelombang lembut, bukan flip 80° yang dipakai
 * animasi mount (itu terasa "kedip" kalau dipakai ulang tiap update harga).
 * Kelas 'riak' dilepas otomatis via timer sesudah gelombang kelar, supaya
 * animation restart bersih di perubahan nilai berikutnya (CSS tidak
 * memutar ulang animasi kalau classname-nya tidak sempat hilang & muncul lagi).
 */
export function Papan({ nilai }: { nilai: number }) {
  const teks = nilai.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const chars = [...teks]
  const nilaiSebelumnya = useRef(nilai)
  const [riak, setRiak] = useState(false)
  /** Flip 80° cuma untuk kemunculan pertama. Dilepas setelah animasinya
   *  selesai supaya tidak ada aturan animasi yang tertinggal menempel di
   *  elemen dan ikut terpicu ulang saat kelas riak dilepas. */
  const [masuk, setMasuk] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setMasuk(false), 900) // .5s animasi + delay digit terakhir
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (nilaiSebelumnya.current === nilai) return
    nilaiSebelumnya.current = nilai
    setRiak(true)
    const totalMs = (chars.length * RIAK_STEP + RIAK_DUR) * 1000
    const t = setTimeout(() => setRiak(false), totalMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nilai])

  return (
    <div className="flap-row">
      {chars.map((ch, i) => (
        <span
          key={i}
          className={`${/\d/.test(ch) ? 'flap' : 'flap sym'}${masuk ? ' masuk' : ''}${riak ? ' riak' : ''}`}
          style={riak ? { animationDelay: `${i * RIAK_STEP}s` } : undefined}
        >
          {ch}
        </span>
      ))}
    </div>
  )
}
