// Salin data statis dari luar app/ (repo root) ke app/public/ sebelum build,
// supaya Vite ikut menyalinnya ke dist/ dan ter-serve di production persis
// seperti middleware dev (vite.config.ts serveRepoDir) melayaninya saat dev.
// Sumber (../data-idx/json, ../arus-pasar/keluaran) tetap satu-satunya lokasi
// asli — folder ini cuma salinan build artifact, jangan di-commit (lihat
// app/.gitignore).
import { cpSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const appDir = path.resolve(fileURLToPath(import.meta.url), '..', '..')
const repoRoot = path.resolve(appDir, '..')

const targets = [
  { src: path.join(repoRoot, 'data-idx', 'json'), dest: path.join(appDir, 'public', 'data-idx', 'json') },
  { src: path.join(repoRoot, 'arus-pasar', 'keluaran'), dest: path.join(appDir, 'public', 'arus-pasar', 'keluaran') },
]

for (const { src, dest } of targets) {
  if (!existsSync(src)) {
    console.warn(`[copy-static-data] lewati, sumber tidak ada: ${src}`)
    continue
  }
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
  console.log(`[copy-static-data] ${path.relative(repoRoot, src)} -> ${path.relative(repoRoot, dest)}`)
}
