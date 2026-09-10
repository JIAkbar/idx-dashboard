// Akar arsip mentah — SATU sumber kebenaran untuk sisi JS, sejajar dengan
// `scripts/arsip_mentah.py` di sisi Python (#165 B2, 10 Sep 2026).
//
// Kenapa berkas sekecil ini ada: empat pembangun di sini membaca
// `_arsip-mentah/asing`, direktori yang DITULIS `panen_asing.py`. Sejak
// ketiga alur self-hosted memindahkan akar arsip ke luar ruang kerja runner
// (checkout menjalankan `git clean -ffdx` dan menyapunya), penulis Python
// dan pembaca JS harus menunjuk tempat yang sama — kalau tidak, keduanya
// "berhasil" tanpa galat sementara pembacanya selamanya membaca folder
// kosong. Menyalin satu baris `process.env...` ke empat berkas akan
// menyimpang satu per satu; satu berkas ini tidak.
//
// Bawaannya `<akar repo>/_arsip-mentah` dan itu TIDAK berubah.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR_REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const AKAR_ARSIP = process.env.PAPAN_ARSIP_AKAR || join(AKAR_REPO, '_arsip-mentah')
