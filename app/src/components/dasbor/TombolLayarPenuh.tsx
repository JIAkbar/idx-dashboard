import { IkonMenu, IKON_PERLUAS, IKON_SILANG } from './IkonMenu'

/**
 * Tombol Layar Penuh — satu komponen untuk tiga tempat yang dulu menulisnya
 * sendiri-sendiri (#170, audit §3.1.6): Chart & Heatmap di ChartIndeks,
 * Kuadran di Broker Summary, dan Grafik Jaringan di Peta Investor. Ketiganya
 * memanggil Fullscreen API yang sama dan berganti label ke "Keluar" dengan
 * cara yang sama, tapi dua di antaranya memakai `.bchip` (badge kepemilikan
 * saham, bukan tombol) plus gaya inline, dan yang ketiga punya kelas sendiri.
 *
 * Layar penuh lewat Fullscreen API bawaan peramban, bukan simulasi lewat kelas
 * CSS: Escape-menutup, ukuran layar telepon, dan urutan tumpuk semua ditangani
 * peramban. Satu-satunya glue yang masih perlu ditulis ada di
 * `.lantai .panel:fullscreen` (lantai.css), supaya anak yang tinggi pikselnya
 * tetap ikut melebar mengisi layar.
 */
export function TombolLayarPenuh({
  target,
  aktif,
  labelKeluar = 'Keluar Layar Penuh',
  className = '',
}: {
  /** Elemen yang dijadikan layar penuh. */
  target: React.RefObject<HTMLElement | null>
  /** Apakah elemen INI yang sedang layar penuh — dihitung pemanggil, karena
   *  satu halaman bisa punya beberapa panel yang bisa dilayarpenuhkan dan
   *  hanya satu yang sedang aktif. */
  aktif: boolean
  /** Sebagian tempat cuma muat kata "Keluar" karena bilahnya sempit. */
  labelKeluar?: string
  className?: string
}) {
  const judul = aktif ? 'Keluar layar penuh' : 'Layar penuh'
  return (
    <button
      type="button"
      className={['dd-btn', 'tlp', className].filter(Boolean).join(' ')}
      title={judul}
      onClick={() => {
        if (aktif) document.exitFullscreen?.().catch(() => {})
        else target.current?.requestFullscreen?.()?.catch(() => {})
      }}
    >
      <IkonMenu d={aktif ? IKON_SILANG : IKON_PERLUAS} size={12} />
      <span>{aktif ? labelKeluar : 'Layar Penuh'}</span>
    </button>
  )
}
