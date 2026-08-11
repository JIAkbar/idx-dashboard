import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Dasbor publik fetch data statis dari folder `data/` di root repo (186MB,
 * di-refresh harian oleh GitHub Actions "Update IDX Dashboard" — bukan
 * Supabase). Saat produksi, hosting nanti serve folder itu apa adanya
 * (sama seperti index_live.html lama). Untuk dev server Vite (yang cuma
 * serve dari app/), middleware ini serve `../data/*` di path `/data/*`
 * on-demand — TIDAK menyalin 186MB ke app/public.
 */
function serveRepoData(): Plugin {
  const dataDir = path.resolve(__dirname, '..', 'data')
  return {
    name: 'serve-repo-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split('?')[0])
        const filePath = path.join(dataDir, url)
        if (!filePath.startsWith(dataDir)) return next()
        fs.stat(filePath, (err, stat) => {
          if (err || !stat.isFile()) return next()
          res.setHeader('Content-Type', 'application/json')
          fs.createReadStream(filePath).pipe(res)
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveRepoData()],
})
