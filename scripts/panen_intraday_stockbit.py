# -*- coding: utf-8 -*-
"""Panen intraday Stockbit — bar 1 MENIT per emiten, arsip bulanan gz.

KETETAPAN Johan 26 Agu 2026 (via sesi pengawas AI Skill): *"jadikan kewajib
panen endpoint dari 1 menit sampai 4H ini meskipun maksimal 90 hari gak
masalah berharga sekali ini"*. Server hanya menyimpan ±90 hari (lebih tua →
HTTP 400, teruji 25 Agu) — hari yang lewat tanpa dipanen hilang permanen,
karena itu run perdana menarik mundur seluruh jendela selagi masih ada.

Spek: `docs/spek-dev-papan/spek_rbs_gap_intraday.md` §3 + arahan pengawas
26 Agu. Keputusan desain yang MENGIKAT:

- **Bar 1 menit mentah = kanon.** 5m/15m/1H/4H diagregasi saat baca, tidak
  pernah disimpan berlipat.
- **Rumah**: `_arsip-mentah/intraday/<KODE>/<YYYY-MM>.json.gz` — satu berkas
  per emiten per bulan (pelajaran broker-harian: jangan jutaan berkas kecil).
  Di luar git.
- **Hari BERJALAN tidak pernah ditulis ke arsip** — berkas parsial akan
  dilewati jalan berikutnya ("sudah ada") dan tinggal parsial selamanya;
  ruas foreign_buy/sell hari berjalan juga BASI (salinan kemarin, temuan
  24 Agu). Bar hari ini dibuang saat tulis; tumpang-tindih run berikutnya
  yang memungutnya.
- **TIDAK ADA refresh token dari runner ini.** Stockbit memutar pasangan
  sekali pakai; refresh dari skrip pernah melempar sesi peramban Johan dan
  mematikan rantai (23 Agu 21:01). Access dibaca apa adanya dari simpanan;
  401 → berhenti bersih, minta Johan semai ulang.
- **Resumable**: penanda `_arsip-mentah/intraday/_beres/<KODE>.json` per
  emiten per run-window (tanggal `sampai`). Jalan ulang melewati emiten yang
  penandanya sudah menunjuk jendela yang sama — berhenti di tengah tidak
  mengulang dari nol.
- Merge-dedup per `unix_timestamp` dengan isi arsip lama — run harian rutin
  (`--hari 7`, tumpang-tindih seminggu) menutup hari terlewat tanpa duplikat.

Pakai:
    python scripts/panen_intraday_stockbit.py --hari 90 --paralel 24   # perdana
    python scripts/panen_intraday_stockbit.py                          # rutin (7 hari)
    python scripts/panen_intraday_stockbit.py --hanya BBCA,BUMI --hari 14
    python scripts/panen_intraday_stockbit.py --uji                    # swauji, nol jaringan
"""
from __future__ import annotations

import argparse
import gzip
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))

DIR_JSON = AKAR / "data-idx" / "json"
DAFTAR = DIR_JSON / "daftar_emiten.json"
ARSIP = AKAR / "_arsip-mentah" / "intraday"
BERES = ARSIP / "_beres"
WIB = timezone(timedelta(hours=7))

URL = "https://exodus.stockbit.com/chartbit/{kode}/price/intraday"

_sesi = None
_kunci_sesi = threading.Lock()
_kunci_tulis: dict[str, threading.Lock] = {}
_mati = threading.Event()  # 401 → seluruh runner berhenti bersih


def sesi(maks: int = 128):
    global _sesi
    with _kunci_sesi:
        if _sesi is None:
            import requests
            from requests.adapters import HTTPAdapter
            s = requests.Session()
            ad = HTTPAdapter(pool_connections=maks, pool_maxsize=maks, max_retries=0)
            s.mount("https://", ad)
            s.mount("http://", ad)
            _sesi = s
    return _sesi


def token_tanpa_refresh() -> str:
    """Access apa adanya dari simpanan. SENGAJA tidak lewat token_segar():
    runner ini dilarang memutar refresh (lihat docstring modul)."""
    from stockbit_token import baca_simpanan
    t = (baca_simpanan() or {}).get("access")
    if not t:
        raise SystemExit("Tidak ada access token — semai dulu (stockbit_token.py).")
    return t


def cari_bar(j) -> list[dict]:
    """Larik bar 1 menit di dalam balasan — kuncinya tidak diasumsikan dari
    nama (pelajaran 'jangan simpulkan dari label'): dicari list-of-dict yang
    barisnya memuat `unix_timestamp`."""
    tumpukan = [j]
    while tumpukan:
        x = tumpukan.pop()
        if isinstance(x, list):
            if x and isinstance(x[0], dict) and "unix_timestamp" in x[0]:
                return x
            tumpukan.extend(x[:3])
        elif isinstance(x, dict):
            tumpukan.extend(x.values())
    return []


def ambil(token: str, kode: str, dari_epoch: int, sampai_epoch: int):
    r = sesi().get(URL.format(kode=kode), headers={
        "Authorization": f"Bearer {token}", "Origin": "https://stockbit.com",
        "Referer": "https://stockbit.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }, params={
        # Konvensi server TERBALIK (teruji 25 Agu): from = epoch TERBARU,
        # to = epoch TERLAMA.
        "from": dari_epoch, "to": sampai_epoch, "limit": 0,
    }, timeout=120)
    if r.status_code == 200:
        return 200, r.json()
    return r.status_code, r.text[:200]


def kunci_untuk(kode: str) -> threading.Lock:
    with _kunci_sesi:
        return _kunci_tulis.setdefault(kode, threading.Lock())


def tanggal_bar(b: dict) -> str:
    """'yyyy-mm-dd' WIB dari unix_timestamp — dipakai memilah bulan & membuang
    hari berjalan. `datetime` string di balasan tidak dipercaya sendirian."""
    return datetime.fromtimestamp(int(b["unix_timestamp"]), WIB).strftime("%Y-%m-%d")


def simpan(kode: str, bar: list[dict], hari_ini: str) -> tuple[int, int]:
    """Merge-dedup ke arsip bulanan. Bar hari berjalan DIBUANG. Kembali
    (bar_baru, bar_dibuang_hari_ini)."""
    buang = 0
    per_bulan: dict[str, list[dict]] = {}
    for b in bar:
        tgl = tanggal_bar(b)
        if tgl >= hari_ini:
            buang += 1
            continue
        per_bulan.setdefault(tgl[:7], []).append(b)
    baru = 0
    with kunci_untuk(kode):
        for bulan, isi in per_bulan.items():
            p = ARSIP / kode / f"{bulan}.json.gz"
            p.parent.mkdir(parents=True, exist_ok=True)
            lama: dict[int, dict] = {}
            if p.exists():
                try:
                    for b in json.loads(gzip.decompress(p.read_bytes()).decode("utf-8")):
                        lama[int(b["unix_timestamp"])] = b
                except Exception:
                    # arsip korup = ditimpa isi segar; mentah bulan itu masih
                    # ada di server selama di dalam jendela 90 hari
                    lama = {}
            n0 = len(lama)
            for b in isi:
                lama[int(b["unix_timestamp"])] = b
            baru += len(lama) - n0
            urut = [lama[k] for k in sorted(lama)]
            p.write_bytes(gzip.compress(json.dumps(urut, separators=(",", ":")).encode("utf-8"), 6))
    return baru, buang


def sudah_beres(kode: str, jendela: str) -> bool:
    p = BERES / f"{kode}.json"
    if not p.exists():
        return False
    try:
        return json.loads(p.read_text(encoding="utf-8")).get("jendela") == jendela
    except Exception:
        return False


def tandai_beres(kode: str, jendela: str, n_bar: int) -> None:
    BERES.mkdir(parents=True, exist_ok=True)
    (BERES / f"{kode}.json").write_text(json.dumps({
        "jendela": jendela, "bar": n_bar,
        "pada": datetime.now(WIB).isoformat(timespec="seconds"),
    }), encoding="utf-8")


def kerjakan(token: str, kode: str, dari_e: int, sampai_e: int,
             jendela: str, hari_ini: str, jeda: float) -> str:
    if _mati.is_set():
        return "berhenti"
    kode_status, j = ambil(token, kode, dari_e, sampai_e)
    if kode_status == 401:
        _mati.set()
        return "401"
    if kode_status != 200:
        return f"HTTP {kode_status}"
    bar = cari_bar(j)
    baru, _ = simpan(kode, bar, hari_ini)
    tandai_beres(kode, jendela, len(bar))
    time.sleep(jeda)
    return f"ok {len(bar)} bar (+{baru} baru)"


def swauji() -> int:
    """Nol jaringan: pemilah bulan + buang-hari-ini + merge-dedup."""
    import tempfile
    global ARSIP, BERES
    asli = ARSIP
    with tempfile.TemporaryDirectory() as d:
        ARSIP = Path(d)
        BERES = ARSIP / "_beres"
        def bar(ts, c):  # noqa: E306
            return {"unix_timestamp": ts, "close": c}
        # 30 Jun 16:00 WIB, 1 Jul 09:00, 2 Jul (=="hari ini") 09:00
        e = lambda s: int(datetime.strptime(s, "%Y-%m-%d %H:%M").replace(tzinfo=WIB).timestamp())  # noqa: E731
        b1, b2, b3 = bar(e("2026-06-30 16:00"), 1), bar(e("2026-07-01 09:00"), 2), bar(e("2026-07-02 09:00"), 3)
        baru, buang = simpan("UJI", [b1, b2, b3], "2026-07-02")
        assert (baru, buang) == (2, 1), (baru, buang)
        assert (ARSIP / "UJI" / "2026-06.json.gz").exists()
        assert (ARSIP / "UJI" / "2026-07.json.gz").exists()
        assert not any("2026-07-02" in tanggal_bar(b) for b in json.loads(
            gzip.decompress((ARSIP / "UJI" / "2026-07.json.gz").read_bytes())))
        # merge ulang bar sama + satu baru → dedup
        baru2, _ = simpan("UJI", [b2, bar(e("2026-07-01 09:01"), 4)], "2026-07-02")
        assert baru2 == 1, baru2
        isi = json.loads(gzip.decompress((ARSIP / "UJI" / "2026-07.json.gz").read_bytes()))
        assert len(isi) == 2 and isi[0]["unix_timestamp"] < isi[1]["unix_timestamp"]
        # penanda beres
        tandai_beres("UJI", "2026-07-02~90", 3)
        assert sudah_beres("UJI", "2026-07-02~90") and not sudah_beres("UJI", "2026-07-03~90")
        # pencari bar tak bergantung nama kunci pembungkus
        assert cari_bar({"data": {"apapun": [{"unix_timestamp": 1, "close": 9}]}})[0]["close"] == 9
    ARSIP = asli
    BERES = asli / "_beres"
    print("swauji lolos")
    return 0


def utama() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hari", type=int, default=7, help="jendela mundur (perdana: 90)")
    ap.add_argument("--paralel", type=int, default=24)
    ap.add_argument("--jeda", type=float, default=0.35)
    ap.add_argument("--hanya", default="")
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()
    if a.uji:
        return swauji()

    token = token_tanpa_refresh()
    kini = datetime.now(WIB)
    hari_ini = kini.strftime("%Y-%m-%d")
    jendela = f"{hari_ini}~{a.hari}"
    dari_e = int(kini.timestamp())
    sampai_e = int((kini - timedelta(days=a.hari)).timestamp())

    daftar = json.loads(DAFTAR.read_text(encoding="utf-8"))
    emiten = sorted(daftar if isinstance(daftar, list) and isinstance(daftar[0], str)
                    else [e["kode"] for e in (daftar.get("emiten") if isinstance(daftar, dict) else daftar)])
    if a.hanya:
        pilih = {k.strip().upper() for k in a.hanya.split(",")}
        emiten = [k for k in emiten if k in pilih]
    antre = [k for k in emiten if not sudah_beres(k, jendela)]
    print(f"panen intraday 1m · jendela {a.hari} hari (s.d. kemarin; hari ini dibuang) · "
          f"{len(antre)}/{len(emiten)} emiten antre · paralel {a.paralel}", flush=True)

    n_ok = n_gagal = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=a.paralel) as ex:
        fut = {ex.submit(kerjakan, token, k, dari_e, sampai_e, jendela, hari_ini, a.jeda): k
               for k in antre}
        for i, f in enumerate(as_completed(fut), 1):
            k = fut[f]
            try:
                hasil = f.result()
            except Exception as e:  # noqa: BLE001
                hasil = f"galat {type(e).__name__}: {e}"
            if hasil.startswith("ok"):
                n_ok += 1
            elif hasil == "401":
                print(f"[{i}] {k}: 401 — TOKEN MATI, runner berhenti bersih. "
                      f"Semai ulang lalu jalankan lagi (resume otomatis).", flush=True)
            elif hasil == "berhenti":
                pass
            else:
                n_gagal += 1
                print(f"[{i}] {k}: {hasil}", flush=True)
            if i % 25 == 0 or i == len(antre):
                laju = i / max(1e-9, time.time() - t0) * 60
                print(f"[{i}/{len(antre)}] ok={n_ok} gagal={n_gagal} · {laju:.0f} emiten/mnt", flush=True)
    if _mati.is_set():
        print("SELESAI-SEBAGIAN: token mati di tengah — penanda _beres menyimpan kemajuan.")
        return 2
    print(f"SELESAI: {n_ok} ok, {n_gagal} gagal dari {len(antre)} antre dalam "
          f"{(time.time() - t0) / 60:.1f} menit.")
    return 0 if n_gagal == 0 else 1


if __name__ == "__main__":
    raise SystemExit(utama())
