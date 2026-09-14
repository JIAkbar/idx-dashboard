#!/bin/sh
# Ignored Build Step Vercel (antrean #177 B, perbaikan #192). Keluar 0 = lewati build, 1 = bangun.
#
# Bangun hanya kalau ada yang berubah di luar data-idx/, arus-pasar/, dan docs/ sejak deployment
# SUKSES terakhir (VERCEL_GIT_PREVIOUS_SHA), bukan sejak commit sebelumnya: satu push bisa membawa
# banyak commit, dan commit teratasnya belum tentu mewakili isinya.
#
# Vercel meng-clone dangkal (git clone --depth=10). Kalau deployment sukses terakhir tertinggal
# 10 commit atau lebih, commit itu tidak ada di clone. Sampai 14 Sep 2026 kasus itu selalu
# berakhir membangun: commit data 46bfd385b dibangun karena ia commit ke-10 sesudah build
# terakhir. Sekarang commit itu diambil sendiri, satu commit tanpa riwayat. SHA kosong atau
# fetch gagal tetap berarti bangun.
export GIT_TERMINAL_PROMPT=0
cd "$(git rev-parse --show-toplevel)" || exit 1
P="$VERCEL_GIT_PREVIOUS_SHA"
[ -n "$P" ] || exit 1
if ! git cat-file -e "$P^{commit}" 2>/dev/null; then
  git fetch -q --depth=1 origin "$P" 2>/dev/null || git fetch -q --depth=1 "https://github.com/$VERCEL_GIT_REPO_OWNER/$VERCEL_GIT_REPO_SLUG.git" "$P" 2>/dev/null || exit 1
fi
git diff --quiet "$P" HEAD -- . ':(exclude)data-idx' ':(exclude)arus-pasar' ':(exclude)docs' && exit 0
exit 1
