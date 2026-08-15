/**
 * Satu lilin (candlestick) untuk sehari perdagangan.
 *
 * PAPAN belum memanen harga PEMBUKAAN (backlog #108), jadi badan lilin
 * digambar dari **penutupan kemarin ke penutupan hari ini**, bukan buka-tutup
 * sebenarnya. Untuk indeks selisihnya biasanya tipis — pembukaan hampir selalu
 * rapat ke penutupan sebelumnya — tapi di hari yang membuka dengan gap, badan
 * ini lebih panjang daripada lilin sungguhan.
 *
 * Karena itu labelnya menyebut "penutupan ke penutupan" dan tidak pernah
 * mengaku OHLC penuh. Begitu #108 selesai, cukup ganti `dasar` dengan harga
 * buka — bentuk dan seluruh perhitungan di bawah tidak berubah.
 */
export function LilinHarian({ dasar, tutup, tinggi, rendah, lebar = 34, tinggiPx = 76, judul }: {
  /** Penutupan kemarin (sementara berdiri sebagai harga buka). */
  dasar: number
  tutup: number
  tinggi: number
  rendah: number
  lebar?: number
  tinggiPx?: number
  judul?: string
}) {
  const naik = tutup >= dasar
  // Skala diambil dari KEEMPAT nilai, bukan cuma tinggi/rendah hari ini.
  //
  // Penutupan kemarin tidak dijamin berada di dalam rentang hari ini: hari
  // yang membuka dengan gap naik punya `rendah` di ATAS penutupan kemarin,
  // dan sebaliknya. Waktu skalanya cuma tinggi–rendah, badan lilin digambar
  // di luar kotaknya dan meluber menimpa teks di sekitarnya (terlihat 15 Agu
  // 2026 pada hari 6.201,89 → 6.236,62).
  //
  // Memakai min/max keempatnya membuat gap itu justru terbaca: badan yang
  // menjulur keluar rentang hari ADALAH gambaran yang benar dari gap.
  const atas = Math.max(tinggi, dasar, tutup)
  const bawah = Math.min(rendah, dasar, tutup)
  // Hari yang benar-benar datar akan membagi nol, jadi rentangnya dilantaikan
  // ke angka kecil — hasilnya lilin doji setipis garis, yang memang benar.
  const span = Math.max(atas - bawah, 1e-9)
  const y = (nilai: number) => ((atas - nilai) / span) * tinggiPx

  const atasBadan = y(Math.max(dasar, tutup))
  const bawahBadan = y(Math.min(dasar, tutup))
  // Badan setipis apa pun tetap digambar minimal 2px: badan setinggi 0,3px
  // hilang sama sekali di layar dan harinya terbaca seperti tak ada data.
  const tinggiBadan = Math.max(bawahBadan - atasBadan, 2)
  const x = lebar / 2
  const lebarBadan = Math.max(lebar * 0.62, 6)
  const warna = naik ? 'var(--green)' : 'var(--red)'

  return (
    <svg
      width={lebar} height={tinggiPx} viewBox={`0 0 ${lebar} ${tinggiPx}`}
      role="img" aria-label={judul ?? (naik ? 'Hari naik' : 'Hari turun')}
    >
      {judul && <title>{judul}</title>}
      <line x1={x} x2={x} y1={y(tinggi)} y2={y(rendah)} stroke={warna} strokeWidth="1.5" />
      {/* Naik dan turun sama-sama TERISI, dibedakan warna saja. Konvensi
          berongga-untuk-naik terbalik antar wilayah, dan di lilin sekecil ini
          rongga cuma terbaca sebagai lilin yang lebih pucat. */}
      <rect
        x={x - lebarBadan / 2} y={atasBadan} width={lebarBadan} height={tinggiBadan}
        fill={warna} stroke={warna} strokeWidth="1.5" rx="1"
      />
    </svg>
  )
}
