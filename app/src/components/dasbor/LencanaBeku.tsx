import './LencanaBeku.css'

/** Ambang: di bawah ini dianggap jeda biasa, bukan berhenti diperdagangkan.
 *  20 hari bursa ≈ sebulan. Terukur 25 Agu 2026: 119 dari 963 emiten melewati
 *  ambang ini, dan yang di bawahnya berekor panjang sampai 1 hari — angka
 *  kecil itu hal biasa di saham tipis dan tak layak diberi peringatan. */
export const AMBANG_BEKU = 20

export function bekunya(k: { beku?: number } | null | undefined): number {
  return k?.beku ?? 0
}

export function tidakDiperdagangkan(k: { beku?: number } | null | undefined): boolean {
  return bekunya(k) >= AMBANG_BEKU
}

function tanggalPendek(iso?: string | null): string | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const i = Number(m) - 1
  return i >= 0 && i < 12 ? `${Number(d)} ${bulan[i]} ${y}` : iso
}

/**
 * Lencana "tidak diperdagangkan".
 *
 * ## Kenapa bukan "disuspensi"
 *
 * Data kita membuktikan harganya tak bergerak dan volumenya nol — bukan
 * ALASANNYA. Suspensi BEI, proses delisting, dan penghentian sukarela
 * meninggalkan jejak yang sama persis di deret harga. Menyebut "disuspensi"
 * berarti mengarang sebab yang tak kita punya datanya; kalau nanti
 * pengumuman suspensi IDX ikut dipanen, barulah alasannya bisa disebut.
 *
 * ## Kenapa emitennya tetap ditampilkan
 *
 * Lencana, bukan penyaring. Menyembunyikan emiten dari daftar mengulang
 * kesalahan yang sudah pernah dibayar: 582 emiten lenyap dari halaman karena
 * ambang statistik dipakai menyaring tampilan, dan tak seorang pun tahu
 * sampai Johan menemukannya dari luar produk.
 */
export function LencanaBeku({ beku, sejak }: { beku?: number; sejak?: string | null }) {
  if ((beku ?? 0) < AMBANG_BEKU) return null
  const t = tanggalPendek(sejak)
  return (
    <span
      className="lb-lencana"
      title={`Tidak ada transaksi selama ${beku!.toLocaleString('id-ID')} hari bursa berturut-turut. Harga yang tampil adalah harga transaksi terakhir, bukan harga hari ini.`}
    >
      Tidak diperdagangkan{t ? ` sejak ${t}` : ''}
    </span>
  )
}
