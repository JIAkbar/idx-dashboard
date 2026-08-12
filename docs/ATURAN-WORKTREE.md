# Aturan Kerja di Worktree — IDX Statistik

> Berkas ini **ter-track git**, jadi setiap worktree baru otomatis membawanya.
> Ditetapkan 12 Agustus 2026 setelah meninjau branch `claude/artifact-react-migration-c789ac`.
> Aturan umum lintas proyek: `AI Skill/03 - AI Kemampuan/kemampuan-workflow.md` §180.

## Aturan tunggal yang menjelaskan semuanya

**Worktree hanya berisi berkas yang DI-TRACK git.**

Yang di-`.gitignore` **tidak ada** di worktree: PDF sumber IDX (`data-idx/daily/`, `data-idx/weekly/`),
`data emiten/`, `data owner/`, `data ringkasan/`, `data referensi/`, `node_modules/`, `.env`, `CLAUDE.md`.

## 🚨 Larangan keras

**JANGAN PERNAH memindahkan berkas tak-ter-track ke dalam worktree.**

Pernah terjadi di repo ini: PDF sumber IDX dipindah ke worktree, lalu harus dikembalikan.
Bahayanya tidak terlihat — perpindahan berkas ber-`.gitignore`:

- tidak muncul di `git status`
- tidak masuk commit, tidak ikut `git merge`
- **musnah saat `git worktree remove`**

Kalau worktree butuh berkas mentah: **SALIN, jangan PINDAH**, dan perlakukan salinannya
sebagai sekali-pakai.

## Boleh dikerjakan di worktree

| Area | Alasan |
|---|---|
| `app/**` | React; hanya butuh JSON di `data-idx/json/` yang memang ter-track |
| `docs/**` | teks murni |

## WAJIB dikerjakan di folder utama, bukan worktree

| Area | Alasan |
|---|---|
| `scripts/parse_idx_pdf.py` | butuh PDF di `data-idx/daily/` — **tidak ada di worktree**, jadi tidak bisa diuji |
| `scripts/download_idx.py` | mengunduh ke folder ber-ignore |
| `scripts/fetch_fundamental.py` | menulis ke `data-idx/json/`, sumber kebenarannya folder utama |
| `arus-pasar/build.py` | membaca `edisi/` + `cache/`, menulis PDF keluaran |
| `.github/workflows/**` | dijalankan runner GitHub, diuji lewat push bukan lokal |
| `data-idx/**`, `data*/` | data, bukan kode |

## Templat perintah saat memulai sesi di worktree

> Kerjakan hanya di dalam `app/`. Jangan sentuh `scripts/`, `data-idx/`, `.github/`,
> `arus-pasar/`, atau `vercel.json`. Kalau ada yang perlu diubah di luar `app/`,
> **laporkan dulu — jangan langsung kerjakan.**
> Jangan memindahkan berkas apa pun dari folder utama ke worktree ini.

## Urutan menutup pekerjaan — mengikat, jangan diacak

```bash
# 1. folder utama harus bersih SEBELUM merge
git status --short

# 2. kalau tidak bersih, AMANKAN DULU (jangan dibuang)
git add -A && git commit -m "chore: ..."

# 3. baru merge
git merge <branch> --no-edit

# 4. push
git push origin main

# 5. terakhir, lepas worktree
git worktree remove .claude/worktrees/<nama>
```

Langkah 2 bukan formalitas. Pada 12 Agustus 2026, `main` ternyata menyimpan rename
~1.100 berkas yang belum di-commit **plus dua bulan data harian** (`ds_260611.json` …
`ds_260811.json`) berstatus untracked — satu-satunya salinan yang ada.

## Tiga perintah terlarang untuk "membersihkan dulu"

`git clean -fd` · `git reset --hard` · `git checkout .`

Ketiganya membuang pekerjaan yang belum di-commit, dan **berkas untracked adalah korban
pertamanya** — termasuk data hasil fetch yang belum sempat masuk git.

## Pola pipeline data repo ini (pertahankan)

Sumber mentah di-ignore, hasil olahan di-commit. GitHub Actions mengunduh PDF di runner,
mem-parse, meng-commit JSON-nya saja, PDF dibuang bersama runner. Berkas mentah tidak
pernah ada di dua tempat.

Tinjau ulang hanya kalau `data-idx/json/` menembus ratusan MB (per 12 Agustus 2026:
`.git` masih 8,7 MB, 1.066 berkas JSON).
