"""Panen ARSIP IPOT News mundur sampai awal tahun berjalan → ipot_arsip.json.

IPOT adalah sumber paling aktif di antara sumber kita (lihat `panen_kabar.py`),
jadi arsipnya layak disimpan lebih panjang daripada retensi 7 hari punya
`kabar.json`. Skrip ini terpisah karena tujuannya beda: bukan "apa yang baru
hari ini", tapi "seberapa jauh riwayatnya bisa digali".

Endpoint dan pola HTML-nya SAMA PERSIS dengan yang dipakai `panen_kabar.py`
untuk kanal IPOT — konstanta dan regex-nya diimpor dari situ, bukan disalin,
supaya kalau IPOT ganti markup cukup dibetulkan di satu tempat. Skrip ini
TIDAK mengubah `panen_kabar.py`, cuma membaca dari situ.

Beda dari `ipot()` di `panen_kabar.py`: itu ambil halaman 0 saja (kabar
terbaru). Ini mundur halaman demi halaman (`halaman=0,1,2,…`) sampai
tanggalnya lebih tua dari `--sejak`, atau endpoint berhenti memberi item baru.

Pakai:
  python scripts/panen_ipot_arsip.py                    # sejak 1 Jan tahun ini
  python scripts/panen_ipot_arsip.py --sejak 2026-05-01
  python scripts/panen_ipot_arsip.py --maks-halaman 40
"""
from __future__ import annotations

import argparse
import html
import json
import random
import re
import sys
import time
from datetime import date, datetime
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import panen_kabar as pk  # noqa: E402 — reuse konstanta & regex IPOT, lihat docstring
import arsip_mentah  # noqa: E402 — reuse, lihat CLAUDE.md rung 2

AKAR = Path(__file__).resolve().parent.parent
KELUARAN = AKAR / "data-idx" / "json" / "ipot_arsip.json"


def _news_id(tautan: str) -> str | None:
    m = re.search(r"news_id=(\d+)", tautan)
    return m.group(1) if m else None


def ambil_dengan_ulang(url: str, headers: dict, percobaan: int = 4) -> requests.Response | None:
    """Seperti `pk.ambil`, tapi dengan backoff eksponensial untuk 429/5xx —
    arsip ini bisa memanggil ratusan halaman, jauh lebih berat dari panen
    harian yang cuma sekali per kanal."""
    tunda = 2.0
    for i in range(percobaan):
        try:
            r = pk.SESI.get(url, headers=headers, timeout=45)
        except Exception as e:  # noqa: BLE001
            if i == percobaan - 1:
                print(f"  ! gagal total {url[:70]}… — {e}", file=sys.stderr)
                return None
            time.sleep(tunda)
            tunda *= 2
            continue
        if r.status_code == 200:
            return r
        if r.status_code in (429, 500, 502, 503, 504) and i < percobaan - 1:
            print(f"  ! {r.status_code} di halaman, tunggu {tunda:.0f}s lalu ulang…", file=sys.stderr)
            time.sleep(tunda)
            tunda *= 2
            continue
        print(f"  ! {r.status_code} {url[:70]}…", file=sys.stderr)
        return None
    return None


def panen_kanal(level4: str, nama: str, sejak: date, maks_halaman: int,
                 terlihat_global: set[str]) -> tuple[list[dict], int, str | None]:
    """Mundur per halaman sampai tanggal < sejak atau halaman tak lagi baru.

    Return (item baru kanal ini, jumlah halaman yang dilayani, tanggal tertua
    yang tercapai)."""
    out: list[dict] = []
    tertua: str | None = None
    referer = f"https://www.indopremier.com/ipotnews/nw-saham.php?level4={level4}"
    halaman = 0
    sidik_sebelumnya: frozenset[str] | None = None
    while halaman < maks_halaman:
        r = ambil_dengan_ulang(
            f"{pk.IPOT_AJAX}?halaman={halaman}&level4={level4}",
            {**pk.HEADER_UMUM, "Referer": referer, "X-Requested-With": "XMLHttpRequest"})
        if not r:
            break  # sumber tak menjawab — laporkan sejauh yang berhasil, jangan memaksa
        # Arsip respons MENTAH — pembeda TANGGAL PANEN (bukan tanggal berita:
        # endpoint mengabaikan parameter `halaman`, lihat catatan di bawah,
        # jadi "halaman 0" bisa membawa isi berbeda tiap kali dipanen ulang).
        tanggal_panen = datetime.now().strftime("%Y-%m-%d")
        arsip_mentah.simpan("ipot", tanggal_panen, f"{level4}-halaman-{halaman}.json",
                             data=r.text)
        teks = r.text.replace(r"\/", "/").replace(r'\"', '"')
        terlihat_di_halaman = 0  # item terurai di halaman ini, dedup atau tidak
        sidik: set[str] = set()  # news_id di halaman ini — untuk deteksi halaman kembar
        berhenti = False
        for m in pk._ITEM_IPOT.finditer(teks):
            judul = re.sub(r"<[^>]+>", " ", m.group(3))
            judul = re.sub(r"\s{2,}", " ", html.unescape(judul)).strip()
            tautan = html.unescape(m.group(2))
            nid = _news_id(tautan)
            waktu = pk._waktu_ipot(m.group(0))
            if not judul or not nid:
                continue
            terlihat_di_halaman += 1
            sidik.add(nid)
            if waktu:
                hari = datetime.fromisoformat(waktu).date()
                if tertua is None or hari < date.fromisoformat(tertua):
                    tertua = hari.isoformat()
                if hari < sejak:
                    berhenti = True
                    break
            if nid in terlihat_global:
                continue  # sudah ada dari panen sebelumnya — tetap lanjut ke halaman
                          # berikutnya, jangan berhenti cuma karena tak ada yang baru
            terlihat_global.add(nid)
            out.append({
                "sumber": "IPOT News",
                "jenis": "berita",
                "kanal": nama,
                "judul": judul,
                "tautan": "https://www.indopremier.com/ipotnews/" + tautan,
                "waktu": waktu,
                "emiten": [],
            })
        halaman += 1
        if berhenti:
            break
        if terlihat_di_halaman == 0:
            break  # halaman benar-benar kosong — pagination sumbernya habis
        # Halaman KEMBAR PERSIS dengan sebelumnya = parameter `halaman`
        # diabaikan sumbernya. Terbukti 16 Agu 2026: halaman 0, 1, 5, dan 50
        # membalas 200 news_id yang sama. Tanpa pemeriksaan ini skripnya
        # menembak seribu permintaan (20 menit) untuk nol item baru — dan
        # "tak ada yang baru" TIDAK bisa dipakai sebagai tanda berhenti,
        # karena panen ulang yang wajar juga menghasilkan nol item baru.
        beku = frozenset(sidik)
        if sidik_sebelumnya is not None and beku == sidik_sebelumnya:
            print(f"  · halaman {halaman} sama persis dengan sebelumnya — "
                  f"paginasi tak bergerak, berhenti di sini.")
            break
        sidik_sebelumnya = beku
        time.sleep(0.7 + random.random() * 0.3)
    return out, halaman, tertua


def main() -> int:
    tahun_ini = date.today().year
    ap = argparse.ArgumentParser(description="Panen arsip IPOT News mundur ke belakang")
    ap.add_argument("--sejak", default=f"{tahun_ini}-01-01",
                     help="tanggal paling tua yang diambil, YYYY-MM-DD (default 1 Jan tahun berjalan)")
    ap.add_argument("--maks-halaman", type=int, default=500,
                     help="batas halaman per kanal, jaga-jaga endpoint tak pernah berhenti (default 500)")
    args = ap.parse_args()
    sejak = date.fromisoformat(args.sejak)

    lama: list[dict] = []
    if KELUARAN.exists():
        try:
            lama = json.loads(KELUARAN.read_text(encoding="utf-8")).get("item", [])
        except Exception:  # noqa: BLE001 — berkas rusak bukan alasan gagal panen
            lama = []
    terlihat_global = {nid for it in lama if (nid := _news_id(it.get("tautan", "")))}

    semua_baru: list[dict] = []
    t0 = time.monotonic()
    for level4, nama in pk.IPOT_KANAL:
        print(f"kanal {nama} ({level4})…")
        item, halaman, tertua = panen_kanal(level4, nama, sejak, args.maks_halaman, terlihat_global)
        semua_baru.extend(item)
        print(f"  {len(item)} item baru, {halaman} halaman dilayani, "
              f"tertua tercapai: {tertua or '-'}")

    gabung = lama + semua_baru
    if not gabung:
        print("Tidak ada item sama sekali — berkas lama TIDAK ditimpa.", file=sys.stderr)
        return 1

    gabung.sort(key=lambda i: i.get("waktu") or "", reverse=True)
    waktu_valid = [i["waktu"] for i in gabung if i.get("waktu")]
    isi = {
        "diperbarui": datetime.now(pk.WIB).isoformat(timespec="seconds"),
        "mulai": min(waktu_valid)[:10] if waktu_valid else None,
        "akhir": max(waktu_valid)[:10] if waktu_valid else None,
        "n": len(gabung),
        "item": gabung,
    }
    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    KELUARAN.write_text(json.dumps(isi, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK -> {KELUARAN} ({len(gabung)} item total, {len(semua_baru)} baru, "
          f"{time.monotonic() - t0:.0f}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
