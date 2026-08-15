/**
 * Perakit sandi awal untuk akun kontributor yang dibuat superadmin.
 *
 * Bentuknya <Nama><4 digit> — mudah dibacakan lewat WhatsApp, dan pemiliknya
 * mengenali namanya sendiri sehingga tidak salah ketik saat pertama masuk.
 * Ini SANDI AWAL, bukan sandi permanen: kekuatannya sengaja dikorbankan demi
 * bisa disampaikan lewat kanal yang tidak aman, dan penggantiannya oleh
 * pemilik akun adalah pengaman sebenarnya.
 *
 * Angkanya diambil dari crypto.getRandomValues, bukan Math.random — untuk
 * apa pun yang menjaga akun, sumber acak yang bisa ditebak dari waktu jalan
 * program bukan pilihan yang pantas, walau ini cuma sandi sementara.
 */

/** Panjang minimal sandi yang diterima Edge Function admin-akun. */
export const SANDI_MIN = 8

/** Berapa digit angka yang ditempel di belakang nama. */
const DIGIT = 4

/**
 * Rakit sandi dari nama/alias + angka acak.
 *
 * Hanya kata pertama yang dipakai — "Budi Santoso" dan "budi.santoso" sama-sama
 * menghasilkan "Budi". Nama dibersihkan ke huruf Latin saja dan diawali
 * kapital; kalau setelah dibersihkan kosong atau terlalu pendek (mis. alias
 * berupa emoji atau satu huruf), dipakai kata cadangan "Papan" supaya hasilnya
 * tetap bisa dibacakan dan tetap memenuhi panjang minimum server.
 */
export function rakitSandi(nama: string): string {
  // Kata PERTAMA saja. Membuang pemisah lalu menyambung sisanya menghasilkan
  // "Ujicobauji" dari "ujicoba Uji" — lebih panjang dan justru lebih sulit
  // dibacakan lewat telepon, padahal bisa dibacakan adalah satu-satunya
  // alasan bentuk sandi ini dipilih.
  const kataPertama = nama.trim().split(/[\s._+-]+/)[0] ?? ''
  const bersih = kataPertama.replace(/[^A-Za-z]/g, '')
  const pokok = bersih.length >= 4
    ? bersih[0].toUpperCase() + bersih.slice(1, 10).toLowerCase()
    : 'Papan'
  const acak = new Uint32Array(1)
  crypto.getRandomValues(acak)
  const angka = String(acak[0] % 10 ** DIGIT).padStart(DIGIT, '0')
  return `${pokok}${angka}`
}
