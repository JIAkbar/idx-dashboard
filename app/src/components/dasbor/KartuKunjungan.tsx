import { BATAS_KUNJUNGAN, useKunjungan } from '../../lib/dasbor/kunjungan'

/**
 * Kartu "Pengunjung" (#112 A, Johan 8 Sep 2026: "sudah kmu pasang soal setiap
 * hari pengunjung PAPAN berapa orang ?").
 *
 * Dua aturan yang membentuk komponen ini:
 *
 * 1. **Angkanya disertai batasnya.** "Unik per hari" di sini perangkat +
 *    jaringan, bukan orang — dan angka pengunjung adalah jenis angka yang
 *    paling gampang dibaca lebih besar daripada yang sebenarnya diukur. Batas
 *    itu tinggal di `lib/dasbor/kunjungan.ts` supaya dua tempat yang kelak
 *    menampilkannya tak bisa menjelaskan dengan dua cara berbeda.
 * 2. **Gagal = tak tampil.** Kalau endpoint diam (503, jaringan putus, pagar
 *    laju), kartunya HILANG, bukan menampilkan nol. Nol yang dikarang lebih
 *    buruk daripada tak ada angka — dan di halaman yang seluruh isinya angka
 *    terukur, satu nol palsu meracuni yang lain.
 */
export function KartuKunjungan() {
  const k = useKunjungan()
  if (!k) return null
  const f = (n: number) => n.toLocaleString('id-ID')
  return (
    <div className="kjg" title={BATAS_KUNJUNGAN}>
      <span className="kjg-l">Pengunjung</span>
      <span className="kjg-a num">{f(k.hari_ini)}</span>
      <span className="kjg-s">hari ini</span>
      <span className="kjg-p" aria-hidden="true">·</span>
      <span className="kjg-a num">{f(k.bulan_ini)}</span>
      <span className="kjg-s">bulan ini</span>
      <span className="kjg-s kjg-batas">unik per perangkat + jaringan, bukan orang</span>
    </div>
  )
}
