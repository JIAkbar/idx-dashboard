import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Dasbor publik fetch berkas statis dari folder-folder di root repo (mis.
 * `data-idx/json/` 186MB, di-refresh harian oleh GitHub Actions — dan `arus-pasar/
 * keluaran/` berisi PDF+manifest bulletin, dibuat `generate_index.py`).
 * Saat produksi, hosting nanti serve folder-folder itu apa adanya (sama
 * seperti index_live.html lama, dan sesuai path relatifnya di repo). Untuk
 * dev server Vite (yang cuma serve dari app/), middleware ini serve
 * `../<dir>/*` di path `/<mount>/*` on-demand — TIDAK menyalin berkas ke
 * app/public.
 */
function serveRepoDir(mount: string, ...dirParts: string[]): Plugin {
  const dir = path.resolve(__dirname, '..', ...dirParts)
  const tipe: Record<string, string> = { '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png' }
  return {
    name: `serve-repo-dir${mount}`,
    configureServer(server) {
      server.middlewares.use(mount, (req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split('?')[0])
        const filePath = path.join(dir, url)
        if (!filePath.startsWith(dir)) return next()
        fs.stat(filePath, (err, stat) => {
          if (err || !stat.isFile()) return next()
          const ct = tipe[path.extname(filePath)]
          if (ct) res.setHeader('Content-Type', ct)
          fs.createReadStream(filePath).pipe(res)
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    serveRepoDir('/data-idx/json', 'data-idx', 'json'),
    serveRepoDir('/data-idx/radar', 'data-idx', 'radar'),
    serveRepoDir('/arus-pasar/keluaran', 'arus-pasar', 'keluaran'),
  ],
  // ChangelogAdmin.tsx imports docs/CHANGELOG.md (?raw) dari luar akar app/ —
  // izinkan Vite dev server melayani berkas di luar root proyek (Task 13).
  server: {
    fs: { allow: ['..', '../..'] },
    /**
     * Lilin INTRADAY Grafik Emiten (`lib/dasbor/kerangkaWaktu.ts`) — padanan
     * dev dari fungsi `api/yahoo.js` yang dipakai di produksi. Bentuk URL-nya
     * dibuat PERSIS SAMA di kedua tempat (`/api/yahoo?simbol=&interval=&rentang=`)
     * supaya kode klien tak perlu tahu ia sedang berjalan di mana.
     *
     * Kenapa harus lewat sini sama sekali: Yahoo tidak mengirim header CORS,
     * jadi peramban menolak permintaan langsung. Dan kenapa BUKAN proxy CORS
     * publik seperti `hargaTerakhir.ts` — terukur 18 Agu 2026, keempatnya
     * (corsproxy.io, allorigins, codetabs, thingproxy) gagal: Yahoo membalas
     * 429/520 ke server mereka. Pembedanya ternyata User-Agent, bukan IP —
     * permintaan yang sama dengan UA peramban dibalas 200. Karena itu UA di
     * bawah bukan hiasan; tanpa ia, jalur ini ikut kena 429.
     */
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
        rewrite: (jalur: string) => {
          const u = new URL(jalur, 'http://x')
          const q = u.searchParams
          return `/v8/finance/chart/${encodeURIComponent(q.get('simbol') ?? '')}`
            + `?interval=${encodeURIComponent(q.get('interval') ?? '')}`
            + `&range=${encodeURIComponent(q.get('rentang') ?? '')}`
        },
      },
    },
  },
})
