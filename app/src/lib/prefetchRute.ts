/**
 * Unduh chunk halaman SEBELUM diklik.
 *
 * Halaman berat dipecah dari bundle utama (App.tsx, React.lazy) supaya muat
 * pertama cepat. Ongkosnya pindah ke klik pertama: chunk baru diunduh saat
 * halaman diminta, dan selama itu layar cuma menampilkan pemuat. Di jaringan
 * lambat jeda itu terasa persis seperti aplikasi yang menggantung.
 *
 * Mengarahkan penunjuk ke sebuah menu hampir selalu mendahului mengkliknya —
 * beberapa ratus milidetik yang selama ini terbuang. Di situ chunk-nya
 * diunduh, jadi saat kliknya datang berkasnya sudah ada dan pemuatnya sering
 * tak sempat muncul sama sekali.
 *
 * Importer di sini HARUS sama persis dengan yang dipakai `lazy()` di App.tsx.
 * Vite memetakan tiap spesifier ke satu chunk, dan modul yang sudah diunduh
 * tak diunduh lagi — kalau spesifiernya beda, yang terjadi malah dua chunk
 * dengan isi sama.
 */
const PETA: Record<string, () => Promise<unknown>> = {
  '/chart': () => import('../views/dasbor/ChartIndeks'),
  '/broker-summary': () => import('../views/dasbor/BrokerSummary'),
  '/stock-detail': () => import('../views/dasbor/StockDetail'),
  '/peta-investor': () => import('../views/dasbor/PetaInvestor'),
  '/bulletin': () => import('../views/dasbor/Bulletin'),
  '/radar': () => import('../views/dasbor/Radar'),
  '/seasonality': () => import('../views/dasbor/Seasonality'),
  '/admin': () => import('../views/admin/AdminLayout'),
}

/** Rute yang sudah pernah disentuh — cukup sekali per sesi. */
const sudah = new Set<string>()

export function prefetchRute(path: string): void {
  if (sudah.has(path)) return
  const muat = PETA[path]
  if (!muat) return
  sudah.add(path)
  // Gagal unduh di sini tidak boleh terlihat: ini cuma tebakan bahwa halaman
  // akan dibuka. Kalau meleset, klik sungguhannya memuat ulang seperti biasa.
  void muat().catch(() => sudah.delete(path))
}
