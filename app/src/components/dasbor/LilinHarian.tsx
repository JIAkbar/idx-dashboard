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
  // Rentang sumbu jadi skala gambar. Hari yang benar-benar datar (tinggi ==
  // rendah) akan membagi nol, jadi rentangnya dilantaikan ke angka kecil —
  // hasilnya lilin doji setipis garis, yang memang gambaran yang benar.
  const span = Math.max(tinggi - rendah, 1e-9)
  const y = (nilai: number) => ((tinggi - nilai) / span) * tinggiPx

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
      style={{ overflow: 'visible' }}
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
