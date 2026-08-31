/**
 * Penanda "dua skor, sengaja berbeda" — dipasang di tab Screener dan tab
 * Harian, yang sejak peleburan menu (30 pintu jadi 9) duduk BERSEBELAHAN di
 * menu Sinyal.
 *
 * Kenapa ini ada. Kedua halaman memberi vonis yang bisa berbeda untuk emiten
 * yang SAMA — BBCA bisa "Buy" di satu tab dan "Strong Buy" di tab sebelahnya.
 * Sebelum peleburan keduanya terpisah dua menu dan perbedaannya jarang
 * terlihat; sekarang mereka satu klik berjauhan, jadi pemakai pertama yang
 * menyadarinya akan melaporkannya sebagai cacat. Ia BUKAN cacat: perbedaannya
 * disengaja, dan yang paling menentukan adalah arah pembacaan osilator —
 * satu membaca jenuh secara kontrarian, satu lagi sebagai momentum. Arah
 * momentum itu yang lolos uji terhadap 83 label acuan.
 *
 * Teksnya sengaja tak menyebut nama berkas, fungsi, atau ambang angka —
 * halaman ini publik, dan aturan proyek melarang istilah mesin tayang. Yang
 * dijelaskan APA ARTINYA bagi pembaca, bukan bagaimana mesinnya bekerja.
 */
export function BedaSkor({ halaman }: { halaman: 'screener' | 'harian' }) {
  const lawan = halaman === 'screener' ? 'Harian' : 'Screener'
  const cara =
    halaman === 'screener'
      ? 'Skor di sini membaca indikator jenuh secara berlawanan arah — saham yang jenuh jual dibaca berpeluang naik.'
      : 'Skor di sini membaca indikator jenuh sebagai momentum — saham yang sudah kuat dibaca berpeluang lanjut menguat, dan arah itu yang cocok dengan data acuan kami.'
  return (
    <span className="sub beda-skor">
      Dua indikator berbeda, bukan dua versi angka yang sama. {cara} Karena itu
      satu emiten bisa dapat vonis berbeda di tab {lawan} — itu disengaja, bukan
      kekeliruan. Bacalah keduanya sebagai dua sudut pandang.
    </span>
  )
}
