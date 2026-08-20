# -*- coding: utf-8 -*-
"""Backup harian bucket Supabase `screenshots` — B16.

Screenshot setoran kontributor TIDAK reproducible kalau hilang (beda dari
data-idx/json/*.json yang bisa dibangun ulang dari `_arsip-mentah/`). Sampai
20 Agu 2026 tak ada backup sama sekali.

MEKANISME (diputuskan 20 Agu 2026)
-----------------------------------
Bucket `screenshots` PUBLIC — siapa pun bisa GET satu path kalau tahu
namanya persis (diverifikasi nyata: anon key berhasil mengunduh 776 KB
tanpa signed URL dan tanpa login). Tapi anon key TIDAK bisa men-DAFTAR isi
bucket (endpoint list mengikuti RLS `storage.objects`, cuma buka prefix
`contoh/`) atau membaca tabel `setoran` langsung (RLS `setoran_baca`:
`penyetor = auth.uid() OR saya_superadmin()`) — jadi skrip Python biasa tak
bisa menemukan sendiri APA SAJA yang perlu dibackup.

Jalan paling sederhana yang BENAR-BENAR JALAN hari ini, TANPA mengubah skema
Supabase: daftar path diambil lewat Supabase MCP (`execute_sql`, baca penuh
dari sesi Claude Code) dan ditulis sebagai manifest lokal
`_arsip-mentah/screenshots/manifest.json`. Skrip ini MEMBACA manifest itu,
BUKAN query Supabase sendiri — jadi TIDAK otomatis menemukan setoran baru
dengan sendirinya.

Sempat dicoba: RPC `SECURITY DEFINER` sempit (cuma expose path/tanggal/
ticker/jenis, bukan seluruh tabel) supaya Task Scheduler bisa memperbarui
manifest tanpa sesi Claude Code — DIBLOKIR classifier izin otomatis (ubah
skema + grant ke anon butuh persetujuan eksplisit). SQL-nya:

    create or replace function public.path_backup_screenshots()
    returns table(path text, tanggal date, ticker text, jenis text)
    language sql security definer set search_path = public as $$
      select path, tanggal, ticker, jenis from setoran
      where path is not null order by tanggal, ticker, jenis;
    $$;
    grant execute on function public.path_backup_screenshots() to anon;

Kalau Johan menyetujui & menjalankan migrasi itu, langkah lanjutannya:
ganti sumber manifest di sini dari berkas lokal ke panggilan
`POST {url}/rest/v1/rpc/path_backup_screenshots` — baru barulah backup ini
100% tanpa sesi Claude Code. Sampai itu terjadi: perbarui manifest lewat
Supabase MCP tiap sebelum menjalankan skrip ini.

Idempoten: berkas yang path lokalnya sudah ada & berukuran >0 TIDAK diunduh
ulang. Tidak pernah menghapus apa pun, di Supabase maupun lokal (ini
backup, bukan pemindahan).

Cara pakai:
  python scripts/backup_screenshot.py             # backup dari manifest
  python scripts/backup_screenshot.py --swauji     # uji idempoten, tanpa jaringan
"""
import argparse
import json
import sys
import time
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
MANIFEST = AKAR / "_arsip-mentah" / "screenshots" / "manifest.json"
TUJUAN = AKAR / "_arsip-mentah" / "screenshots" / "berkas"
ENV_LOCAL = AKAR / "app" / ".env.local"


def baca_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for baris in ENV_LOCAL.read_text(encoding="utf-8").splitlines():
        baris = baris.strip()
        if not baris or baris.startswith("#") or "=" not in baris:
            continue
        k, v = baris.split("=", 1)
        env[k] = v
    return env


def unduh_satu(url_dasar: str, key: str, path: str, dest: Path) -> int:
    """Kembalikan jumlah byte yang DITULIS kali ini (0 = dilewati atau gagal)."""
    if dest.exists() and dest.stat().st_size > 0:
        return 0  # sudah ada — idempoten, tak diunduh ulang, tak pernah ditimpa
    r = requests.get(
        f"{url_dasar}/storage/v1/object/screenshots/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=30,
    )
    if r.status_code != 200 or not r.content:
        print(f"  GAGAL {path}: HTTP {r.status_code}")
        return 0
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(r.content)
    return len(r.content)


def jalankan(manifest_path: Path = MANIFEST) -> None:
    if not manifest_path.exists():
        print(f"Manifest {manifest_path} tak ada — perbarui dulu lewat Supabase MCP (lihat docstring modul).")
        sys.exit(1)
    daftar = json.loads(manifest_path.read_text(encoding="utf-8"))
    env = baca_env()
    url, key = env["VITE_SUPABASE_URL"], env["VITE_SUPABASE_ANON_KEY"]

    mulai = time.time()
    byte_baru = 0
    baru = 0
    for row in daftar:
        n = unduh_satu(url, key, row["path"], TUJUAN / row["path"])
        if n:
            baru += 1
            byte_baru += n

    ada = [TUJUAN / row["path"] for row in daftar if (TUJUAN / row["path"]).exists()]
    total_mb = sum(p.stat().st_size for p in ada) / 1024 / 1024
    print(
        f"\n{len(daftar)} berkas di manifest · {len(ada)} ada di cakram · "
        f"{baru} baru diunduh kali ini ({byte_baru/1024/1024:.1f} MB) · "
        f"total cakram {total_mb:.1f} MB · {time.time()-mulai:.1f} dtk"
    )


def swauji() -> None:
    """Uji idempoten TANPA jaringan: berkas yang sudah ada tak boleh memicu
    `requests.get` sama sekali — dicoba lewat host yang pasti gagal DNS
    kalau (secara keliru) benar-benar dipanggil."""
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / "sudah-ada.jpg"
        dest.write_bytes(b"isi lama")
        n = unduh_satu("http://url-tak-valid.invalid", "kunci-palsu", "x/y.jpg", dest)
        assert n == 0, "berkas yang sudah ada tak boleh diunduh ulang"
        assert dest.read_bytes() == b"isi lama", "berkas lama tak boleh ditimpa"
    print("swauji lolos")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--swauji", action="store_true", help="uji idempoten saja, tanpa jaringan")
    ap.add_argument("--manifest", type=Path, default=MANIFEST)
    arg = ap.parse_args()
    if arg.swauji:
        swauji()
        return
    jalankan(arg.manifest)


if __name__ == "__main__":
    main()
