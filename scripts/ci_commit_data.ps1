# Commit + push data-idx/json kalau ada perubahan, dengan pesan yang membawa -Label.
#
# Diekstrak dari langkah "Commit kalau ada perubahan" di
# panen-harian-rumah.yml (27 Sep 2026, antrean #239/#241/#242) supaya bisa
# dipanggil DUA kali dalam satu job: sekali sesudah data harian non-broker
# (-Label "penuh"), sekali lagi sesudah broker (-Label "broker"). Dulu commit
# cuma di ujung job, jadi kalau job mati kena timeout di tengah broker (run
# 21/24/25 Sep 2026, CANCELLED), harga hari itu ikut tak pernah tayang.
#
# Perilaku identik dengan versi lama, kecuali satu perbaikan: `git diff
# --quiet` tak melihat berkas BARU yang belum terlacak (untracked) - dipakai
# `git status --porcelain` yang melihat keduanya.
param(
    [Parameter(Mandatory = $true)]
    [string]$Label
)

$berkas = 'data-idx/json'

$status = git status --porcelain -- $berkas
if (-not $status) { Write-Host 'Tidak ada perubahan.'; exit 0 }

git config user.name  'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add $berkas
$stempel = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm')
git commit -m "data: panen harian $Label $stempel UTC"

# TANPA tarik-lalu-rebase (#163 di CI, ralat 12 Sep 2026). Panennya
# berjam-jam, bukan sepuluh detik, jadi: GABUNG, dan untuk berkas yang baru
# saja dibangun dari sumber, versi kita yang menang - ia memang keluaran
# panen atas isi cakram terbaru.
#
# Batasnya keras: konflik DI LUAR `data-idx/` MENGHENTIKAN langkah. Mesin tak
# pernah menggabung dokumen manusia (pelajaran #163: `stash pop` pernah
# menulis penanda konflik ke dalam dokumen antrean).
git push origin "HEAD:$env:GITHUB_REF_NAME"
if ($LASTEXITCODE -ne 0) {
    Write-Host "push ditolak - remote maju di tengah jalan, menggabung"
    git fetch origin $env:GITHUB_REF_NAME
    git merge --no-edit "origin/$env:GITHUB_REF_NAME"
    if ($LASTEXITCODE -ne 0) {
        $bentrok = @(git diff --name-only --diff-filter=U)
        $luar = @($bentrok | Where-Object { $_ -notlike 'data-idx/*' })
        if ($luar.Count -gt 0) {
            Write-Host ("::error::konflik DI LUAR data-idx: " + ($luar -join ', ') +
                        " - berhenti, dokumen manusia tak disentuh")
            git merge --abort
            exit 1
        }
        Write-Host ("konflik hanya di data-idx (" + $bentrok.Count +
                    " berkas) - dimenangkan versi yang baru dibangun")
        # Daftar berkas lewat BERKAS, bukan argumen (28 Sep 2026): run 36342684759
        # bentrok di +-1.600 berkas broker_harian, dan satu perintah berisi 1.600
        # jalur melampaui batas panjang baris perintah Windows - checkout gagal,
        # berkas tetap 'unmerged', commit ditolak, push gagal.
        $daftar = Join-Path $(if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }) 'bentrok.txt'
        [System.IO.File]::WriteAllLines($daftar, [string[]]$bentrok)
        git checkout --ours --pathspec-from-file=$daftar
        git add --pathspec-from-file=$daftar
        git commit --no-edit
    }
    git push origin "HEAD:$env:GITHUB_REF_NAME"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "::error::push masih ditolak sesudah gabung - berhenti"
        exit 1
    }
}
exit 0
