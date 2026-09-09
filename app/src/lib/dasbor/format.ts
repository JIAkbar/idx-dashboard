/** Port 1:1 dari index_live.html baris 2698-2705 — format angka & badge dasbor lama. */

export function fN(v: number | null | undefined, d = 2): string {
  return (v ?? 0).toLocaleString('id-ID', { maximumFractionDigits: d })
}

/**
 * ISO `YYYY-MM-DD` -> "5 Agu 2026". Tinggal di sini bersama pemformat angka
 * lain supaya tak lahir salinan ketiga: sebelumnya bentuk ini hanya ada di
 * modul Statistik Berkala dan modul arsip Radar, dan halaman ketiga yang
 * membutuhkannya akan menulis versinya sendiri.
 *
 * Jam 12.00 dipakai, bukan tengah malam: `new Date('2026-08-05')` diurai
 * sebagai UTC lalu ditampilkan di zona lokal, sehingga di zona barat
 * tanggalnya mundur satu hari.
 */
export function tanggalRingkas(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fp(v: number | null | undefined, d = 2): string {
  // `null` WAJIB dijaga di sini, bukan cuma di pemanggil: `null >= 0` bernilai
  // true di JS, jadi cabang tanda lolos lalu `.toFixed` meledak dan SELURUH
  // halaman jadi layar kosong tanpa satu pun galat yang terbaca pembaca.
  // Terjadi 21 Agu 2026 di tab Semua Kartu Analisa begitu populasinya naik
  // 381 -> 963 emiten: emiten yang riwayatnya baru sehari punya `chg` null,
  // keadaan yang mustahil selama daftarnya masih disaring ambang 250 lilin.
  if (v == null || !Number.isFinite(v)) return '—'
  // Koma, bukan titik (#123). Seluruh angka lain di layar sudah berkoma
  // (`6.343,21`), jadi persen bertitik membuat satu baris memuat dua
  // konvensi desimal sekaligus — dan di angka ribuan, titik desimal jadi
  // tak terbedakan dari titik pemisah ribuan.
  return (v >= 0 ? '+' : '') + v.toLocaleString('id-ID', {
    minimumFractionDigits: d, maximumFractionDigits: d,
  }) + '%'
}

/**
 * Persen TANPA tanda plus — pasangan `fp()` untuk angka yang tandanya tak
 * berarti (rasio, pangsa, akurasi, jarak ke level).
 *
 * Ada karena 111 tempat menulis `${x.toFixed(2)}%` sendiri-sendiri dan
 * semuanya bertitik, sementara seluruh angka lain di layar berkoma (#123).
 */
export function persen(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'
}

export function cls(v: number): 'green' | 'red' {
  return v >= 0 ? 'green' : 'red'
}

/** Kembalikan markup badge sebagai string, sama seperti sumber asli. */
export function bdg(v: number): string {
  return `<span class="bdg ${v >= 0 ? 'bdg-g' : 'bdg-r'}">${fp(v)}</span>`
}

export function fmtNF(v: number): string {
  return (v >= 0 ? '+' : '') + v.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
