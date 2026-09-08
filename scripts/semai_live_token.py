# -*- coding: utf-8 -*-
"""Semai pasangan token AKUN KEDUA ke tabel `live_token` — rantai live, bukan panen.

Asal: proxy `/api/live-harga` menjawab 503 untuk SEMUA kode karena tabel
`live_token` berisi 0 baris (temuan 8 Sep 2026, antrean #92/#97). Angka hari
berjalan di Diary Pasar, Indeks, dan Whales baru hidup sesudah baris id=1 ada.

## Dua rantai, jangan pernah bersentuhan

* **Akun utama** — khusus panen. Berkas `~/.papan/stockbit-token.json`,
  disemai `cek_token.py --semai`, diputar skrip panen.
* **Akun kedua** — khusus tayangan live. Baris `live_token` id=1 di Supabase,
  disemai skrip INI, diputar HANYA cron `/api/live-refresh`.

Refresh token Stockbit sekali pakai: memutarnya dari dua tempat mencabut satu
keluarga sesi (insiden 23–24 Agu 2026). Karena itu skrip ini membaca kunci
`STOCKBIT_LIVE_TOKEN` / `STOCKBIT_LIVE_REFRESH_TOKEN` — BUKAN
`STOCKBIT_TOKEN`/`STOCKBIT_REFRESH_TOKEN` yang dipakai rantai panen. Kalau
keduanya memakai nama yang sama, satu tempelan salah kamar akan menukar rantai
tanpa satu pun galat. Sebagai sabuk kedua, skrip menolak menulis kalau pemilik
token yang mau disemai SAMA dengan pemilik token rantai panen (`--paksa`
melewatinya, dan itu keputusan sadar, bukan bawaan).

## Yang TIDAK pernah dicetak

Isi token — tidak di layar, tidak di log, tidak di pesan galat. Yang boleh:
tanggal terbit/kedaluwarsa, sidik pendek (8 aksara SHA-256), kode HTTP.

## Pakai (SOP lengkap ada di docs/referensi_idx-statistik.md, section proxy live)

    python scripts/semai_live_token.py            # semai + uji hidup
    python scripts/semai_live_token.py --periksa   # cek keadaan saja, nol tulis
    python scripts/semai_live_token.py --swauji    # uji murni, nol jaringan

Prasyarat: `app/.env.local` memuat `STOCKBIT_LIVE_TOKEN`,
`STOCKBIT_LIVE_REFRESH_TOKEN`, `VITE_SUPABASE_URL`, dan
`SUPABASE_SERVICE_ROLE_KEY` (kunci server — boleh juga dari variabel
lingkungan bernama sama; berkas .env.local tak pernah masuk git).
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).resolve().parents[1]
ENV_LOCAL = AKAR / "app" / ".env.local"
TOKEN_PANEN = Path(os.environ.get("PAPAN_STOCKBIT_TOKEN_FILE")
                   or (Path.home() / ".papan" / "stockbit-token.json"))
WIB = timezone(timedelta(hours=7))
TABEL = "live_token"
URL_UJI = "https://papan-idx.vercel.app/api/live-harga?kode=BNBR"


def baca_env(teks: str) -> dict:
    """Baris `KUNCI=nilai` jadi dict; komentar dan tanda kutip dilepas.
    Sama bentuknya dengan `tarik_tesis.baca_env` — sengaja, supaya satu
    kebiasaan berkas env berlaku di semua skrip."""
    hasil = {}
    for baris in teks.splitlines():
        baris = baris.strip()
        if not baris or baris.startswith("#") or "=" not in baris:
            continue
        k, v = baris.split("=", 1)
        hasil[k.strip()] = v.strip().strip('"').strip("'")
    return hasil


def klaim(token: str | None) -> dict:
    """Muatan JWT tanpa memverifikasi tanda tangan — cuma untuk membaca
    iat/exp/pemilik. Token rusak atau bukan JWT balik sebagai dict kosong."""
    try:
        p = token.split(".")[1]
        p += "=" * (-len(p) % 4)
        return json.loads(base64.urlsafe_b64decode(p))
    except Exception:  # noqa: BLE001 — bukan JWT / rusak
        return {}


def wib(ts: int | None) -> str:
    return datetime.fromtimestamp(ts, WIB).strftime("%d %b %H:%M") if ts else "?"


def sidik(token: str | None) -> str:
    """Sidik pendek untuk membandingkan dua token TANPA mencetak isinya."""
    if not token:
        return "-"
    return hashlib.sha256(token.encode()).hexdigest()[:8]


def pemilik(token: str | None) -> str | None:
    """Penanda pemilik dari klaim JWT. Nama ruasnya berbeda-beda antar
    penerbit, jadi yang pertama ketemu dipakai; None kalau tak satu pun ada."""
    k = klaim(token)
    for ruas in ("sub", "user_id", "uid", "userId", "id"):
        if k.get(ruas) not in (None, ""):
            return str(k[ruas])
    return None


def token_panen_pemilik() -> str | None:
    try:
        return pemilik(json.loads(TOKEN_PANEN.read_text(encoding="utf-8")).get("access"))
    except Exception:  # noqa: BLE001 — berkas tak ada/rusak: sabuk kedua saja
        return None


def env_gabungan() -> dict:
    """Isi .env.local ditimpa variabel lingkungan — supaya kunci server bisa
    diberikan sesaat tanpa menulisnya ke berkas."""
    env = baca_env(ENV_LOCAL.read_text(encoding="utf-8")) if ENV_LOCAL.exists() else {}
    for k in ("VITE_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
              "STOCKBIT_LIVE_TOKEN", "STOCKBIT_LIVE_REFRESH_TOKEN"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    return env


def keadaan_baris(url: str, kunci: str) -> tuple[int, dict | None]:
    """Baris id=1 apa adanya — TANPA mengambil ruas access/refresh."""
    import requests
    r = requests.get(f"{url}/rest/v1/{TABEL}",
                     params={"id": "eq.1", "select": "id,diputar_pada"},
                     headers={"apikey": kunci, "Authorization": f"Bearer {kunci}"},
                     timeout=30)
    if r.status_code != 200:
        return r.status_code, None
    baris = r.json()
    return 200, (baris[0] if baris else None)


def uji_hidup() -> int:
    """Uji proxy produksi. Yang dicetak cuma status + tanggal bar + harga."""
    import requests
    try:
        r = requests.get(URL_UJI, timeout=20)
    except Exception as e:  # noqa: BLE001
        print(f"  uji hidup: gagal menghubungi produksi ({type(e).__name__})")
        return 1
    if r.status_code != 200:
        print(f"  uji hidup: HTTP {r.status_code} — proxy belum melayani "
              f"(503 = token belum tersemai atau ditolak sumber)")
        return 1
    d = r.json()
    print(f"  uji hidup: 200 OK — bar {d.get('tanggal')} close {d.get('close')} "
          f"({d.get('pct')}%)")
    return 0


def periksa(env: dict) -> int:
    url = env.get("VITE_SUPABASE_URL") or env.get("SUPABASE_URL")
    kunci = env.get("SUPABASE_SERVICE_ROLE_KEY")
    print(f"  .env.local          : {'ada' if ENV_LOCAL.exists() else 'TIDAK ADA'}")
    print(f"  URL Supabase        : {'ada' if url else 'KOSONG'}")
    print(f"  kunci server        : {'ada' if kunci else 'KOSONG (SUPABASE_SERVICE_ROLE_KEY)'}")
    a, r = env.get("STOCKBIT_LIVE_TOKEN"), env.get("STOCKBIT_LIVE_REFRESH_TOKEN")
    print(f"  token live di env   : access {'ada' if a else 'KOSONG'} · refresh {'ada' if r else 'KOSONG'}")
    if a:
        ka = klaim(a)
        print(f"    access  : terbit {wib(ka.get('iat'))} · habis {wib(ka.get('exp'))} · sidik {sidik(a)}")
    if r:
        kr = klaim(r)
        print(f"    refresh : terbit {wib(kr.get('iat'))} · habis {wib(kr.get('exp'))} · sidik {sidik(r)}")
    if not (url and kunci):
        return 2
    kode, baris = keadaan_baris(url, kunci)
    if kode != 200:
        print(f"  baris live_token    : tak terbaca (HTTP {kode})")
        return 2
    print(f"  baris live_token    : {'ADA, diputar ' + str(baris.get('diputar_pada')) if baris else 'BELUM ADA (proxy akan 503)'}")
    return 0


def semai(env: dict, paksa: bool) -> int:
    import requests
    url = env.get("VITE_SUPABASE_URL") or env.get("SUPABASE_URL")
    kunci = env.get("SUPABASE_SERVICE_ROLE_KEY")
    access = env.get("STOCKBIT_LIVE_TOKEN")
    refresh = env.get("STOCKBIT_LIVE_REFRESH_TOKEN")

    if not (access and refresh):
        print("  STOCKBIT_LIVE_TOKEN / STOCKBIT_LIVE_REFRESH_TOKEN kosong.")
        print("  Tempel dua baris itu ke app/.env.local dari peramban yang login AKUN KEDUA")
        print("  (scripts/cek_token_console.js), JANGAN pakai nama kunci rantai panen.")
        return 2
    if not (url and kunci):
        print("  VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong — kunci server tak pernah masuk git,")
        print("  beri lewat variabel lingkungan atau baris di app/.env.local.")
        return 2

    ka, kr = klaim(access), klaim(refresh)
    sekarang = datetime.now(timezone.utc).timestamp()
    if ka.get("exp") and ka["exp"] < sekarang:
        print(f"  access sudah kedaluwarsa ({wib(ka.get('exp'))}) — semai ulang dari peramban.")
        return 2
    if kr.get("exp") and kr["exp"] < sekarang:
        print(f"  refresh sudah kedaluwarsa ({wib(kr.get('exp'))}) — semai ulang dari peramban.")
        return 2

    p_live, p_panen = pemilik(access), token_panen_pemilik()
    if p_live and p_panen and p_live == p_panen and not paksa:
        print("  DITOLAK: token ini milik pemilik yang SAMA dengan rantai panen.")
        print("  Rantai live wajib akun kedua — dua rantai satu akun akan saling mencabut")
        print("  (insiden 23–24 Agu 2026). Pakai --paksa hanya kalau kesamaan itu memang disengaja.")
        return 3

    print(f"  access  : terbit {wib(ka.get('iat'))} · habis {wib(ka.get('exp'))} · sidik {sidik(access)}")
    print(f"  refresh : terbit {wib(kr.get('iat'))} · habis {wib(kr.get('exp'))} · sidik {sidik(refresh)}")

    r = requests.post(
        f"{url}/rest/v1/{TABEL}",
        params={"on_conflict": "id"},
        headers={"apikey": kunci, "Authorization": f"Bearer {kunci}",
                 "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"},
        json={"id": 1, "access": access, "refresh": refresh,
              "diputar_pada": datetime.now(timezone.utc).isoformat()},
        timeout=30,
    )
    if r.status_code not in (200, 201, 204):
        # Isi balasan boleh dicetak: PostgREST tak menggemakan badan permintaan.
        print(f"  tulis GAGAL: HTTP {r.status_code} — {r.text[:200]}")
        return 1
    print(f"  tulis OK: HTTP {r.status_code}, baris id=1 tersemai")
    return uji_hidup()


def swauji() -> int:
    lulus = gagal = 0

    def cek(nama, syarat):
        nonlocal lulus, gagal
        if syarat:
            lulus += 1
        else:
            gagal += 1
            print(f"  GAGAL: {nama}")

    e = baca_env('# komentar\nVITE_SUPABASE_URL=https://x.supabase.co\n'
                 'STOCKBIT_LIVE_TOKEN="aa.bb.cc"\n\nKOSONG=\n')
    cek("baca_env: nilai berkutip dilepas", e["STOCKBIT_LIVE_TOKEN"] == "aa.bb.cc")
    cek("baca_env: komentar dilewati", "# komentar" not in e)

    def jwt(muatan: dict) -> str:
        b = base64.urlsafe_b64encode(json.dumps(muatan).encode()).decode().rstrip("=")
        return f"x.{b}.y"

    t = jwt({"iat": 1757000000, "exp": 1757086400, "sub": "user-1"})
    cek("klaim: iat terbaca", klaim(t).get("iat") == 1757000000)
    cek("klaim: token rusak jadi dict kosong", klaim("bukan-jwt") == {})
    cek("pemilik: sub dipakai", pemilik(t) == "user-1")
    cek("pemilik: tanpa ruas pemilik -> None", pemilik(jwt({"iat": 1})) is None)

    # Sidik membedakan token tanpa membocorkannya, dan panjangnya tetap.
    cek("sidik: beda token beda sidik", sidik("a") != sidik("b"))
    cek("sidik: 8 aksara", len(sidik("a")) == 8)
    cek("sidik: token kosong aman", sidik(None) == "-")

    # Penjaga rantai: dua token dengan pemilik sama harus terbaca sama.
    cek("penjaga: pemilik sama terdeteksi", pemilik(jwt({"sub": "u"})) == pemilik(jwt({"sub": "u", "iat": 9})))

    # Nama kunci live TIDAK boleh sama dengan kunci rantai panen — kalau
    # seseorang menyamakannya lagi, uji ini yang berteriak lebih dulu.
    isi = Path(__file__).read_text(encoding="utf-8")
    # Jarum dirakit saat jalan, bukan ditulis utuh: kalau ditulis utuh ia ADA di
    # berkas ini sendiri dan ujinya selalu merah (terukur saat menulisnya).
    jarum = ['env.get("STOCKBIT_' + 'TOKEN")', 'env.get("STOCKBIT_' + 'REFRESH_TOKEN")']
    cek("nama kunci live terpisah dari rantai panen", not any(j in isi for j in jarum))

    print(f"swauji semai_live_token: {lulus} lolos, {gagal} gagal")
    return 1 if gagal else 0


def main() -> int:
    if "--swauji" in sys.argv:
        return swauji()
    env = env_gabungan()
    if "--periksa" in sys.argv:
        return periksa(env)
    return semai(env, paksa="--paksa" in sys.argv)


if __name__ == "__main__":
    raise SystemExit(main())
