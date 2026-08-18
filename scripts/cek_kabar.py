# -*- coding: utf-8 -*-
"""Pemeriksa kabar: apakah panen barusan jalan, dan apakah datanya masih segar.

DUA PERTANYAAN BERBEDA — sengaja dijawab satu berkas supaya keduanya muncul di
tabel yang sama saat tab Actions dibuka:

1. **Panen barusan jalan?** Dibaca dari catatan status yang ditulis pemanen
   (`--status`, satu baris JSON per sumber). Menjawab "IDX 403" / "IPOT 28
   item" / "Kontan 200 tapi 0 item".
2. **Datanya masih segar?** Dibaca dari **ISI** `kabar.json` + `snips.json`,
   yaitu stempel waktu item TERBARU per sumber — bukan mtime berkas dan bukan
   ruas `dipanen`. Berkas ditulis ulang tiap 2 jam walau tak membawa satu pun
   kabar baru; melaporkan waktu tulis membuat data basi terlihat segar (persis
   yang terjadi pada broker summary, CLAUDE.md).

Sumber bisa **berhasil dipanen hari ini tapi datanya basi tiga hari** karena
sumbernya sendiri diam. Itu bukan kegagalan kita, dan tidak boleh membuat job
merah — tapi harus terbaca.

KENAPA ADA (18 Agu 2026)
------------------------
Terukur dari log run 32139468436: job HIJAU, commit terkirim, padahal
`IDX berita: 0 item` dan `IDX pengumuman: 0 item` — keduanya 403. Satu sumber
yang masih hidup (IPOT) cukup membuat seluruh panen terlihat sehat. Tak ada
yang tahu separuh halaman Kabar sudah mati sejak beberapa hari.

AMBANG BASI — kenapa dihitung dalam JAM KABAR, bukan jam dinding
----------------------------------------------------------------
Kabar memang sepi Sabtu malam dan Minggu, dan 17 Agu 2026 (Hari Kemerdekaan)
nol. Ambang datar berjam-dinding akan merah tiap akhir pekan; alarm yang
berulang salah berhenti dibaca, dan itu lebih buruk daripada tak ada alarm.

Jadi umur dihitung sebagai **jam yang jatuh di dalam jendela kabar**: hari
bursa, 07:00–19:00 WIB — jendela yang sama dengan cron panennya. Hari bursa
dibaca dari kalender NYATA yang sudah ada di repo (`data-idx/json/ds_*.json`,
satu berkas per hari IDX menerbitkan ringkasan). 15–17 Agu tak punya berkas →
tak dihitung, tanpa perlu daftar libur yang harus disunting tangan.

Pakai:
  python scripts/cek_kabar.py                       # periksa kesegaran saja
  python scripts/cek_kabar.py --status s.jsonl      # + hasil panen per sumber
  python scripts/cek_kabar.py --demo                # swauji (data buatan)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
JSON = AKAR / "data-idx" / "json"
KABAR = JSON / "kabar.json"
SNIPS = JSON / "snips.json"
# Sumber mana yang PERNAH tembus dari IP datacenter GitHub. Pertanyaan itu
# mustahil dijawab dari mesin rumahan, jadi jawabannya dicatat di repo — dan
# dipakai memutuskan siapa yang boleh membuat job merah.
#
# Berkasnya sengaja sudah ada (kosong) di repo, bukan dibuat saat dibutuhkan:
# `git diff -- <path>` di workflow TIDAK melihat berkas yang belum terlacak,
# jadi hasil run pertama akan lewat tanpa di-commit dan tanpa satu pun galat.
BASELINE = JSON / "kabar-sumber-awan.json"

WIB = timezone(timedelta(hours=7))
JAM_BUKA, JAM_TUTUP = 7, 19          # jendela kabar WIB, sama dengan cron panen


# ── Daftar sumber ───────────────────────────────────────────────────────────
# `ambang` dalam JAM KABAR (lihat docstring). Angkanya DIUKUR dari isi berkas
# 18 Agu 2026, bukan ditebak dari nama sumbernya — jeda antar-item terbesar
# yang benar-benar terjadi, lalu dikali ~2–3 supaya hari yang memang sepi tak
# langsung merah:
#
#   IPOT News        n=94  jeda maks  4,0 jam kabar → ambang 18
#   Kontan           n=61  jeda maks  5,0           → ambang 18
#   IDX pengumuman   n=30  jeda maks  6,6           → ambang 18
#   Stockbit Snips   n=238 jeda maks 13,7 (±1 tulisan/hari, terbit sore) → 30
#   IDX berita       n=4   jeda maks 15,8 (siaran pers, sampelnya tipis) → 48
#
# Kalibrasi ulang: lihat blok di ujung `docs/panen-kabar.md`.
#
# kunci → (label, berkas, pencocok item, ambang jam kabar)
SUMBER: dict[str, tuple[str, Path, "object", float]] = {
    "idx":            ("IDX berita",     KABAR, lambda i: i.get("sumber") == "IDX" and i.get("jenis") == "berita", 48),
    "idx-pengumuman": ("IDX pengumuman", KABAR, lambda i: i.get("sumber") == "IDX" and i.get("jenis") == "pengumuman", 18),
    "ipot":           ("IPOT News",      KABAR, lambda i: i.get("sumber") == "IPOT News", 18),
    "kontan":         ("Kontan",         KABAR, lambda i: i.get("sumber") == "Kontan", 18),
    "snips":          ("Stockbit Snips", SNIPS, lambda i: True, 30),
}


# ── Catatan status dari pemanen ─────────────────────────────────────────────
def catat(path: str | None, kunci: str, nama: str, status: str, item: int,
          detail: str = "") -> None:
    """Tambah satu baris hasil panen ke berkas JSONL.

    Dipanggil dari `panen_kabar.py` dan `panen_snips.py`. Bentuk recordnya
    didefinisikan DI SINI — di berkas yang juga membacanya — supaya penulis dan
    pembaca tak bisa lagi berbeda diam-diam.

    `status`: "ok" | "gagal" | "kosong". "kosong" = sumbernya menjawab tapi nol
    item terparse; itu BUKAN sama dengan gagal (bisa memang sepi, bisa bentuk
    balasannya berubah), jadi tak boleh digabung.
    """
    if not path:
        return
    rec = {"kunci": kunci, "nama": nama, "status": status, "item": item,
           "detail": detail[:200],
           "waktu": datetime.now(WIB).isoformat(timespec="seconds"),
           "dari": "awan" if os.environ.get("GITHUB_ACTIONS") else "lokal"}
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


# ── Kalender hari bursa ─────────────────────────────────────────────────────
_ds_cache: tuple[set[date], date] | None = None


def _kalender() -> tuple[set[date], date]:
    """Himpunan hari bursa dari `ds_YYMMDD.json` + tanggal terbaru yang ada.

    Tanggal terbarunya penting: KETIADAAN berkas hanya boleh dibaca sebagai
    "libur" untuk hari yang kalendernya memang sudah terisi. Untuk hari yang
    lebih baru dari itu, ketiadaan berarti panen ds-nya yang belum jalan —
    menyimpulkan "libur" di situ akan membuat pemeriksa diam persis saat
    datanya paling mungkin bermasalah.
    """
    global _ds_cache
    if _ds_cache is None:
        hari: set[date] = set()
        for f in JSON.glob("ds_??????.json"):
            m = re.fullmatch(r"ds_(\d{2})(\d{2})(\d{2})", f.stem)
            if m:
                try:
                    hari.add(date(2000 + int(m[1]), int(m[2]), int(m[3])))
                except ValueError:
                    pass
        _ds_cache = (hari, max(hari) if hari else date(1970, 1, 1))
    return _ds_cache


def hari_kabar(d: date) -> bool:
    """Hari yang wajar membawa kabar: hari bursa menurut kalender ds_*.json."""
    if d.weekday() >= 5:          # Sabtu/Minggu — bursa tutup
        return False
    hari, terbaru = _kalender()
    return d in hari or d > terbaru


def jam_kabar(a: datetime, b: datetime) -> float:
    """Berapa jam antara `a` dan `b` yang jatuh di jendela kabar.

    Akhir pekan, libur bursa, dan malam hari tidak dihitung — itu yang membuat
    ambangnya tidak melahirkan alarm palsu tiap Sabtu.
    """
    if b <= a:
        return 0.0
    a, b = a.astimezone(WIB), b.astimezone(WIB)
    total, d = 0.0, a.date()
    # Pagar 400 hari: item yang jauh lebih tua dari itu sudah pasti basi, dan
    # tak ada gunanya menghitungnya jam per jam.
    batas = min(b.date(), a.date() + timedelta(days=400))
    while d <= batas:
        if hari_kabar(d):
            buka = datetime(d.year, d.month, d.day, JAM_BUKA, tzinfo=WIB)
            tutup = datetime(d.year, d.month, d.day, JAM_TUTUP, tzinfo=WIB)
            irisan = (min(b, tutup) - max(a, buka)).total_seconds() / 3600
            total += max(0.0, irisan)
        d += timedelta(days=1)
    return round(total, 1)


# ── Pembacaan data ──────────────────────────────────────────────────────────
def _muat(p: Path) -> list[dict]:
    try:
        return json.loads(p.read_text(encoding="utf-8")).get("item", []) or []
    except Exception:  # noqa: BLE001 — berkas hilang/rusak = tak ada item
        return []


def terbaru_per_sumber(kabar: list[dict], snips: list[dict]) -> dict[str, str | None]:
    """Stempel waktu item TERBARU per sumber — dari isi, bukan dari mtime."""
    isi = {KABAR: kabar, SNIPS: snips}
    out: dict[str, str | None] = {}
    for kunci, (_nama, berkas, cocok, _ambang) in SUMBER.items():
        waktu = [i["waktu"] for i in isi[berkas] if i.get("waktu") and cocok(i)]
        out[kunci] = max(waktu) if waktu else None
    return out


def periksa(terbaru: dict[str, str | None], hasil: dict[str, dict],
            baseline: dict[str, dict], sekarang: datetime) -> list[dict]:
    """Satu baris laporan per sumber, plus vonis merah/tidaknya.

    Merah HANYA untuk dua hal yang benar-benar salah di pihak kita:
      1. Sumber yang PERNAH tembus dari awan sekarang gagal/kosong — artinya
         ada yang berubah, bukan sekadar belum pernah bisa.
      2. Datanya basi lewat ambang DAN panen sumber itu tidak berhasil di
         jalanan ini — artinya benar-benar tak ada yang mengisinya.

    Sumber yang belum pernah tembus dari awan sengaja TIDAK merah: ia akan
    gagal tiap 2 jam selamanya, dan alarm yang selalu merah sama tak bergunanya
    dengan alarm yang tak pernah bunyi.
    """
    baris = []
    for kunci, (nama, _berkas, _cocok, ambang) in SUMBER.items():
        h = hasil.get(kunci)
        iso = terbaru.get(kunci)
        umur = jam_kabar(datetime.fromisoformat(iso), sekarang) if iso else None
        basi = umur is not None and umur > ambang
        pernah = kunci in baseline

        merah, catatan = False, []
        if h is None:
            catatan.append("tak dipanen di jalanan ini")
        elif h["status"] == "ok":
            catatan.append(f"panen OK, {h['item']} item")
        elif h["status"] == "kosong":
            catatan.append(f"menjawab tapi 0 item — bentuk balasan berubah? ({h['detail'] or 'tanpa galat'})")
            merah = pernah
        else:
            catatan.append(f"panen GAGAL — {h['detail'] or 'tanpa keterangan'}")
            merah = pernah
            if not pernah:
                catatan.append("belum pernah tembus dari awan, jadi tidak dihitung regresi")

        if iso is None:
            catatan.append("tak ada satu pun item di berkas")
            merah = True
        elif basi:
            catatan.append(f"BASI: {umur} jam kabar (ambang {ambang})")
            # Panen berhasil tapi datanya tetap tua = sumbernya yang sedang
            # diam. Itu fakta yang layak terbaca, bukan kegagalan kita.
            if h and h["status"] == "ok":
                catatan[-1] += " — sumbernya sepi, bukan panennya"
            else:
                merah = True

        baris.append({
            "kunci": kunci, "nama": nama, "terbaru": iso, "umur": umur,
            "ambang": ambang, "status": (h or {}).get("status", "—"),
            "item": (h or {}).get("item", ""), "merah": merah,
            "catatan": "; ".join(catatan),
        })
    return baris


def tabel(baris: list[dict]) -> str:
    t = ["| Sumber | Panen | Item | Kabar terbaru | Umur (jam kabar) | Vonis | Keterangan |",
         "|---|---|---|---|---|---|---|"]
    for b in baris:
        wkt = (b["terbaru"] or "—")[:16].replace("T", " ")
        umur = "—" if b["umur"] is None else f"{b['umur']} / {b['ambang']}"
        ikon = {"ok": "OK", "gagal": "GAGAL", "kosong": "KOSONG", "—": "—"}[b["status"]]
        t.append(f"| {b['nama']} | {ikon} | {b['item']} | {wkt} | {umur} | "
                 f"{'MERAH' if b['merah'] else 'hijau'} | {b['catatan']} |")
    return "\n".join(t)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Periksa hasil panen & kesegaran kabar")
    ap.add_argument("--status", help="berkas JSONL hasil panen per sumber (opsional)")
    ap.add_argument("--demo", action="store_true", help="jalankan swauji lalu keluar")
    args = ap.parse_args(argv)
    if args.demo:
        return demo()

    hasil: dict[str, dict] = {}
    if args.status and Path(args.status).exists():
        for garis in Path(args.status).read_text(encoding="utf-8").splitlines():
            if garis.strip():
                r = json.loads(garis)
                hasil[r["kunci"]] = r

    baseline = {}
    if BASELINE.exists():
        try:
            baseline = json.loads(BASELINE.read_text(encoding="utf-8")).get("sumber", {})
        except Exception:  # noqa: BLE001
            baseline = {}

    baris = periksa(terbaru_per_sumber(_muat(KABAR), _muat(SNIPS)),
                    hasil, baseline, datetime.now(WIB))
    laporan = tabel(baris)
    print(laporan)

    # Catat sumber yang tembus dari awan. Hanya dari awan: itu satu-satunya
    # tempat pertanyaannya bisa dijawab, dan mesin rumahan yang berhasil tak
    # membuktikan apa pun soal IP datacenter.
    if os.environ.get("GITHUB_ACTIONS") and hasil:
        for kunci, r in hasil.items():
            if r["status"] == "ok" and r.get("dari") == "awan":
                baseline[kunci] = {"terakhir_berhasil": r["waktu"], "item": r["item"]}
        BASELINE.write_text(json.dumps({
            "catatan": "Sumber yang TERBUKTI tembus dari IP datacenter GitHub. "
                       "Ditulis scripts/cek_kabar.py; dipakai memutuskan sumber "
                       "mana yang boleh membuat job merah kalau berhenti tembus.",
            "sumber": dict(sorted(baseline.items())),
        }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    merah = [b for b in baris if b["merah"]]
    ringkas = ("Semua sumber wajar." if not merah
               else "MERAH: " + ", ".join(b["nama"] for b in merah))
    ringkasan = os.environ.get("GITHUB_STEP_SUMMARY")
    if ringkasan:
        with open(ringkasan, "a", encoding="utf-8") as f:
            f.write(f"## Kabar pasar — hasil panen & kesegaran\n\n{laporan}\n\n{ringkas}\n")
    print(ringkas)
    return 1 if merah else 0


# ── Swauji ──────────────────────────────────────────────────────────────────
def demo() -> int:
    """Data buatan; tiap kasus yang pernah lolos diam-diam diuji di sini."""
    jum = datetime(2026, 8, 14, 16, 0, tzinfo=WIB)   # Jumat sore
    sen = datetime(2026, 8, 18, 10, 0, tzinfo=WIB)   # Selasa pagi

    # 15–16 Agu akhir pekan, 17 Agu libur (tak punya ds_*.json) → yang terhitung
    # cuma Jumat 16–19 + Selasa 07–10 = 6 jam. Inilah yang membuat "basi 4 hari"
    # menurut jam dinding tidak melahirkan alarm palsu.
    assert jam_kabar(jum, sen) == 6.0, jam_kabar(jum, sen)
    assert jam_kabar(sen, jum) == 0.0
    sabtu = datetime(2026, 8, 15, 9, 0, tzinfo=WIB)
    assert jam_kabar(sabtu, datetime(2026, 8, 16, 23, 0, tzinfo=WIB)) == 0.0

    segar = {k: (sen - timedelta(hours=1)).isoformat() for k in SUMBER}
    ok = {k: {"status": "ok", "item": 20, "detail": "", "dari": "awan"} for k in SUMBER}
    base = {k: {"terakhir_berhasil": "x"} for k in SUMBER}

    # 1. Semuanya segar → tak ada yang merah.
    b = periksa(segar, ok, base, sen)
    assert not any(x["merah"] for x in b), [x for x in b if x["merah"]]

    # 2. Semuanya basi DAN tak terpanen → merah.
    basi = {k: datetime(2026, 6, 1, 9, 0, tzinfo=WIB).isoformat() for k in SUMBER}
    b = periksa(basi, {}, base, sen)
    assert all(x["merah"] for x in b)

    # 3. KASUS YANG PALING MUDAH LUPUT: keseluruhan terlihat segar, satu sumber
    #    diam berhari-hari. Kalau ini lolos, separuh halaman bisa mati tanpa
    #    terlihat — persis IDX 403 yang hijau di run 32139468436.
    satu = {**segar, "idx-pengumuman": datetime(2026, 7, 1, 9, 0, tzinfo=WIB).isoformat()}
    b = periksa(satu, {k: v for k, v in ok.items() if k != "idx-pengumuman"}, base, sen)
    merah = [x["nama"] for x in b if x["merah"]]
    assert merah == ["IDX pengumuman"], merah

    # 4. Akhir pekan: diperiksa Sabtu malam, kabar terakhir Jumat sore → hijau.
    sabtu_malam = datetime(2026, 8, 15, 22, 0, tzinfo=WIB)
    b = periksa({k: jum.isoformat() for k in SUMBER}, ok, base, sabtu_malam)
    assert not any(x["merah"] for x in b), [x["catatan"] for x in b if x["merah"]]

    # 5. Hari libur bursa (17 Agu, Senin): tetap hijau.
    b = periksa({k: jum.isoformat() for k in SUMBER}, ok, base,
                datetime(2026, 8, 17, 20, 0, tzinfo=WIB))
    assert not any(x["merah"] for x in b)

    # 6. Panen gagal pada sumber yang PERNAH tembus dari awan → merah.
    b = periksa(segar, {**ok, "ipot": {"status": "gagal", "item": 0, "detail": "HTTP 403"}}, base, sen)
    assert [x["nama"] for x in b if x["merah"]] == ["IPOT News"]

    # 7. Sumber yang BELUM pernah tembus dari awan gagal → hijau (bukan alarm
    #    palsu tiap 2 jam), tapi tetap tercetak di tabel.
    b = periksa(segar, {**ok, "idx": {"status": "gagal", "item": 0, "detail": "HTTP 403"}},
                {k: v for k, v in base.items() if k != "idx"}, sen)
    assert not any(x["merah"] for x in b)

    # 8. "200 tapi 0 item" tidak boleh terbaca sama dengan gagal.
    b = periksa(segar, {**ok, "kontan": {"status": "kosong", "item": 0, "detail": ""}}, base, sen)
    assert [x["nama"] for x in b if x["merah"]] == ["Kontan"]
    assert "bentuk balasan berubah" in [x["catatan"] for x in b if x["merah"]][0]

    # 9. Berkas ada tapi sumbernya nol item → merah, jangan dibaca "segar".
    b = periksa({**segar, "snips": None}, ok, base, sen)
    assert [x["nama"] for x in b if x["merah"]] == ["Stockbit Snips"]

    print("cek_kabar: swauji lolos — 9 kasus")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
