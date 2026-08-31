import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

/**
 * Gerbang tutup sementara — SATU saklar, bukan pembongkaran.
 *
 * Perintah Johan 1 Sep 2026: *"karena masih tahap renovasi jadi lebih baik
 * papan di tutup dulu untuk sementara"*. Dinyalakan dengan menyetel
 * `VITE_PAPAN_TUTUP=1` di Vercel; dimatikan dengan menghapus var itu lalu
 * redeploy — NOL perubahan kode untuk membuka kembali.
 *
 * ## Kenapa di SINI, bukan di dalam App
 *
 * Versi pertama memasangnya di akar `App()` dan gerbangnya memang menutup —
 * tapi terukur MASIH ada dua permintaan data yang berangkat
 * (`index.json`, `emiten_sektor.json`). Sebabnya `App.tsx` mengimpor modul
 * halaman secara STATIS, jadi modul-modul itu dievaluasi saat berkasnya dimuat,
 * sebelum satu baris pun di dalam `App()` sempat berjalan. Pulang lebih awal
 * di dalam fungsi tak menolong: impornya sudah terlanjur jalan.
 *
 * Itu melanggar syarat yang paling penting dari halaman ini — ia satu-satunya
 * yang tayang publik selama renovasi, jadi ia juga satu-satunya yang bisa
 * membocorkan alamat sumber data ke siapa pun yang membuka panel jaringan.
 * Dengan `await import()` di bawah, `App` tak pernah dimuat saat gerbangnya
 * menyala, dan permintaan itu tak pernah lahir.
 *
 * ## Kenapa dibandingkan ke string '1'
 *
 * Vite menyulih env var sebagai STRING. Diuji apa adanya, 'false' dan '0'
 * dua-duanya bernilai benar — jebakan yang akan menutup situs tanpa ada yang
 * memintanya.
 */
const PAPAN_TUTUP = import.meta.env.VITE_PAPAN_TUTUP === '1'

const akar = createRoot(document.getElementById('root')!)

if (PAPAN_TUTUP) {
  const { Maintenance } = await import('./views/Maintenance')
  akar.render(
    <StrictMode>
      <Maintenance />
    </StrictMode>,
  )
} else {
  const { default: App } = await import('./App.tsx')
  akar.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
