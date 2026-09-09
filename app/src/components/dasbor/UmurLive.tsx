/**
 * Umur angka live dalam detik, berdetak sendiri (#156 C).
 *
 * Menggantikan label "tertunda ≤ 2 menit" yang dulu terpasang di empat tempat.
 * Kalimat itu menyebut batas TERBURUK, bukan keadaan nyata: saat angkanya baru
 * tiba 3 detik lalu ia tetap berbunyi "≤ 2 menit", dan Johan membacanya persis
 * sebagai janji dua menit (9 Sep 2026: "terlalu lama tertunda 2 menit").
 *
 * Komponen TERSENDIRI karena ia berdetak tiap detik: kalau detaknya tinggal di
 * halaman, seluruh Grafik/Whales — kanvas dan semuanya — ikut dirender ulang
 * 60× semenit demi satu angka kecil. Di sini yang dirender ulang hanya span ini.
 */
import { useEffect, useState } from 'react'
import { jamDetikJakarta } from '../../lib/tanggalBursa'
import { umurLiveDetik, type HargaLive } from '../../lib/dasbor/hargaLive'

/** Di atas ini, tarikan dianggap gagal — bukan sekadar tertunda.
 *
 *  60 detik, bukan 150 seperti saat jeda tarikan masih 45 (#156 A): dengan
 *  tarikan 10 detik dan singgahan tepi paling lama 15, umur normal terburuk
 *  ada di 25 detik. Ambang yang tak ikut mengetat berarti enam tarikan bisa
 *  hilang berturut-turut sementara layar tetap berkata "baru saja". */
const AMBANG_BASI = 60

export function UmurLive({ live, kelas }: { live: HargaLive; kelas?: string }) {
  const [, detak] = useState(0)
  useEffect(() => {
    const t = setInterval(() => detak((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const detik = umurLiveDetik(live)
  if (detik >= AMBANG_BASI) {
    return <span className={kelas}>basi {Math.round(detik / 60)} menit, tarikan gagal</span>
  }
  // Stempelnya jam DITERIMA, umurnya menghitung singgahan server juga — angka
  // yang sampai 6 detik lalu bisa saja sudah 12 detik umurnya di sumber.
  return (
    <span className={kelas}>
      diterima {jamDetikJakarta(new Date(live.diambilPada))} · {detik} dtk lalu
    </span>
  )
}
