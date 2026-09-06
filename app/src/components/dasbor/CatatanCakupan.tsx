import { IkonMenu, IKON_INFO } from './IkonMenu'
import { TAHUN_AWAL } from '../../lib/dasbor/brokerEmitenV2'

/**
 * Keterangan cakupan data (27 Agu 2026 — broker dibuka ke 2016, ketetapan
 * Johan "gpp sampai 2016"; sebelumnya 2020)
 * — satu kalimat dipakai ulang di tiap halaman yang membaca harga
 * harian (OHLC/OHLCV) dan/atau rincian broker, supaya pembaca tahu batas
 * kepercayaan angkanya tanpa perlu menebak. Sengaja TIDAK menyebut
 * proses/sumber di baliknya (dilarang proyek) — hanya apa artinya bagi
 * pembaca. Satu tempat, satu suntingan kalau kalimatnya berubah.
 */
export function CatatanCakupan({ inline = false }: { inline?: boolean } = {}) {
  // `inline` (Johan 28 Agu: "teks di header itu apakah bisa di jadikan 1
  // baris saja ... misal Whales Papan .... (Rincian broker tersedia ...)"):
  // duduk SEBARIS dengan judul di dalam .vhead, dalam kurung — hemat satu
  // baris header, ruangnya jatuh ke chart/tabel.
  // Kalimat kedua ("Riwayat harga tersedia sejak emiten tercatat di bursa")
  // DIBUANG 6 Sep 2026 atas contoh Johan di kepala Indeks Dunia: ia berlaku
  // untuk emiten mana pun di bursa mana pun, jadi ia tak memberi tahu apa pun
  // tentang data PAPAN. Yang tinggal memuat ANGKA — tahun awal rincian broker —
  // dan itu justru batas cakupan yang perlu dibaca sebelum menilai angkanya.
  const teks = `Rincian broker tersedia dan tervalidasi sejak ${TAHUN_AWAL}.`
  if (inline) {
    return <span className="catatan-cakupan catatan-inline muted">({teks})</span>
  }
  return (
    <p className="catatan-cakupan muted">
      <IkonMenu d={IKON_INFO} size={12} />
      {teks}
    </p>
  )
}
