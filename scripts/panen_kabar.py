"""Panen kabar pasar → data-idx/json/kabar.json.

Empat sumber, semuanya diuji hidup 16 Agustus 2026 dari IP rumahan:

| Sumber              | Cara ambil                                   | Isi                                   |
|---------------------|----------------------------------------------|---------------------------------------|
| IDX — Berita        | `primary/NewsAnnouncement/GetNewsSearch`      | Siaran pers & berita bursa            |
| IDX — Pengumuman    | `primary/ListedCompany/GetAnnouncement`       | Pengumuman resmi PER EMITEN           |
| IPOT News           | HTML `ipotnews/newsList.php` (tak punya RSS)  | Berita pasar harian                   |
| Kontan Investasi    | RSS `investasi.kontan.co.id/rss`              | Berita investasi & pasar modal        |

**Endpoint IDX menolak permintaan tanpa header peramban** — tanpa `User-Agent`
dan `Referer` keduanya menjawab 403/302 ke halaman 404. Ini bukan blokir IP
(lihat `docs/sumber-fundamental-idx.md`), cuma penyaring klien.

Yang disimpan hanya METADATA: judul, tautan, waktu, sumber, dan kode emiten
kalau ada. Isi beritanya TIDAK disalin — kita menunjuk ke sumbernya, bukan
menyiarkan ulang tulisan orang.

Pakai:
  python scripts/panen_kabar.py            # tulis data-idx/json/kabar.json
  python scripts/panen_kabar.py --batas 40 # berapa item per sumber
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import html
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

AKAR = Path(__file__).resolve().parent.parent
KELUARAN = AKAR / "data-idx" / "json" / "kabar.json"
WIB = timezone(timedelta(hours=7))

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
HEADER_IDX = {"User-Agent": UA, "Referer": "https://www.idx.co.id/id", "Accept": "application/json"}
HEADER_UMUM = {"User-Agent": UA}


SESI = requests.Session()
_idx_siap = False


def _pemanasan_idx() -> None:
    """Sentuh halaman depan IDX sekali sebelum memanggil API-nya.

    `ListedCompany/GetAnnouncement` menjawab **403 tanpa cookie sesi**, padahal
    `NewsAnnouncement/GetNewsSearch` di host yang sama menerima permintaan
    polos. Bedanya baru terlihat saat dua endpoint dipanggil berdampingan —
    header peramban saja tidak cukup untuk yang satu itu.
    """
    global _idx_siap
    if _idx_siap:
        return
    _idx_siap = True
    try:
        SESI.get("https://www.idx.co.id/id", headers=HEADER_UMUM, timeout=30)
    except Exception:  # noqa: BLE001 — pemanasan gagal bukan alasan berhenti
        pass


def ambil(url: str, headers: dict, timeout: int = 45) -> requests.Response | None:
    """GET yang tak pernah menggagalkan seluruh panen: satu sumber mati bukan
    alasan tiga sumber lain ikut hilang dari halaman."""
    if "idx.co.id" in url:
        _pemanasan_idx()
    try:
        r = SESI.get(url, headers=headers, timeout=timeout)
        r.raise_for_status()
        return r
    except Exception as e:  # noqa: BLE001 — sengaja menangkap semuanya
        print(f"  ! gagal {url[:60]}… — {e}", file=sys.stderr)
        return None


def wib(iso: str | None) -> str | None:
    """Waktu IDX datang tanpa zona; dibaca sebagai WIB lalu disimpan ber-offset
    supaya peramban tak menggesernya sendiri."""
    if not iso:
        return None
    try:
        t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=WIB)
    return t.isoformat()


def idx_berita(batas: int) -> list[dict]:
    url = ("https://www.idx.co.id/primary/NewsAnnouncement/GetNewsSearch"
           f"?locale=id-id&pageSize={batas}&pageNumber=1")
    r = ambil(url, HEADER_IDX)
    if not r:
        return []
    out = []
    for it in (r.json().get("Items") or []):
        jalur = it.get("Url") or ""
        out.append({
            "sumber": "IDX",
            "jenis": "berita",
            "judul": (it.get("Title") or "").strip(),
            "tautan": f"https://www.idx.co.id/id/berita/berita/{jalur}" if jalur else "https://www.idx.co.id/id/berita",
            "waktu": wib(it.get("PublishedDate")),
            "emiten": [],
        })
    return out


def idx_pengumuman(batas: int) -> list[dict]:
    url = ("https://www.idx.co.id/primary/ListedCompany/GetAnnouncement"
           f"?indexFrom=0&pageSize={batas}&dateFrom=&dateTo=&lang=id&keyword=")
    r = ambil(url, HEADER_IDX)
    if not r:
        return []
    out = []
    for baris in (r.json().get("Replies") or []):
        p = baris.get("pengumuman") or {}
        # Kode_Emiten datang dipadatkan spasi selebar 100 karakter, dan bisa
        # memuat beberapa kode sekaligus.
        kode = [k for k in re.split(r"[\s,;]+", (p.get("Kode_Emiten") or "")) if k]
        out.append({
            "sumber": "IDX",
            "jenis": "pengumuman",
            "judul": (p.get("JudulPengumuman") or p.get("PerihalPengumuman") or "").strip(),
            "tautan": "https://www.idx.co.id/id/perusahaan-tercatat/keterbukaan-informasi",
            "waktu": wib(p.get("TglPengumuman")),
            "emiten": kode[:6],
            "nomor": (p.get("NoPengumuman") or "").strip() or None,
        })
    return out


def ipot(batas: int) -> list[dict]:
    """IPOT News tidak menyediakan RSS — daftarnya diambil dari HTML.

    Judulnya ada di parameter `jdl` pada tautan (garis bawah = spasi), jadi
    tak perlu mem-parse seluruh pohon HTML: satu regex atas tautan detail
    sudah memberi judul + id beritanya sekaligus.
    """
    r = ambil("https://www.indopremier.com/ipotnews/newsList.php", HEADER_UMUM)
    if not r:
        return []
    out, terlihat = [], set()
    # Judul diambil dari TEKS di dalam <a>, bukan dari parameter `jdl` di URL:
    # parameter itu sudah kehilangan tanda baca (titik, koma, persen jadi
    # spasi) sehingga "IDXTRANS Melaju 5,29%" tercetak "IDXTRANS Melaju 5 29%".
    pola = re.compile(
        r'href="(newsDetail\.php\?jdl=([^&"]+)&news_id=(\d+)[^"]*)"[^>]*>(.*?)</a>',
        re.S)
    for m in pola.finditer(r.text):
        nid = m.group(3)
        if nid in terlihat:
            continue
        terlihat.add(nid)
        judul = re.sub(r"<[^>]+>", " ", m.group(4))
        judul = re.sub(r"\s{2,}", " ", html.unescape(judul)).strip()
        if not judul:  # tautan gambar tanpa teks — pakai parameter sebagai cadangan
            judul = re.sub(r"\s{2,}", " ", urllib.parse.unquote(m.group(2)).replace("_", " ")).strip()
        out.append({
            "sumber": "IPOT News",
            "jenis": "berita",
            "judul": judul,
            "tautan": "https://www.indopremier.com/ipotnews/" + m.group(1).replace("&", "&amp;").replace("&amp;", "&"),
            # Halaman daftar tidak memuat tanggal per baris; biarkan kosong
            # alih-alih menebak "hari ini" — tanggal karangan lebih buruk
            # daripada tanggal yang tak ada.
            "waktu": None,
            "emiten": [],
        })
        if len(out) >= batas:
            break
    return out


def kontan(batas: int) -> list[dict]:
    r = ambil("https://investasi.kontan.co.id/rss", HEADER_UMUM)
    if not r:
        return []
    try:
        akar = ET.fromstring(r.content)
    except ET.ParseError as e:
        print(f"  ! RSS Kontan tak terbaca — {e}", file=sys.stderr)
        return []
    out = []
    for item in akar.iterfind(".//item")[:batas] if False else list(akar.iterfind(".//item"))[:batas]:
        judul = (item.findtext("title") or "").strip()
        tautan = (item.findtext("link") or "").strip()
        tgl = (item.findtext("pubDate") or "").strip()
        waktu = None
        for pola in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S"):
            try:
                t = datetime.strptime(tgl, pola)
                waktu = (t if t.tzinfo else t.replace(tzinfo=WIB)).isoformat()
                break
            except ValueError:
                continue
        if judul and tautan:
            out.append({"sumber": "Kontan", "jenis": "berita", "judul": judul,
                        "tautan": tautan, "waktu": waktu, "emiten": []})
    return out


def urut(items: list[dict]) -> list[dict]:
    """Yang berwaktu duluan (terbaru di atas), yang tanpa waktu menyusul —
    bukan dibuang: IPOT tak memberi tanggal, dan beritanya tetap berguna."""
    berwaktu = [i for i in items if i.get("waktu")]
    tanpa = [i for i in items if not i.get("waktu")]
    berwaktu.sort(key=lambda i: i["waktu"], reverse=True)
    return berwaktu + tanpa


def main() -> int:
    ap = argparse.ArgumentParser(description="Panen kabar pasar untuk halaman Kabar PAPAN")
    ap.add_argument("--batas", type=int, default=30, help="item per sumber (default 30)")
    ap.add_argument("--hari", type=int, default=7,
                    help="berapa hari kabar disimpan sebelum dibuang (default 7)")
    args = ap.parse_args()

    semua: list[dict] = []
    for nama, fn in (("IDX berita", idx_berita), ("IDX pengumuman", idx_pengumuman),
                     ("IPOT News", ipot), ("Kontan", kontan)):
        hasil = fn(args.batas)
        print(f"  {nama}: {len(hasil)} item")
        semua.extend(hasil)

    if not semua:
        print("Tidak ada satu pun sumber yang menjawab — berkas lama TIDAK ditimpa.", file=sys.stderr)
        return 1

    # Buang judul kembar lintas sumber (Kontan & IPOT sering memberitakan hal
    # yang sama); yang pertama masuk menang karena urutannya sudah dari yang
    # paling otoritatif (IDX duluan).
    unik, terlihat = [], set()
    for it in semua:
        kunci = re.sub(r"\W+", "", it["judul"].lower())[:70]
        if kunci in terlihat:
            continue
        terlihat.add(kunci)
        unik.append(it)

    # ── Gabung dengan panen sebelumnya ──────────────────────────────────────
    # Tiap panen cuma mengambil ±25 item terbaru per sumber. Kalau berkasnya
    # ditimpa, kabar dua jam lalu yang sudah tergeser dari halaman depan
    # sumbernya ikut hilang — arsipnya tak pernah lebih panjang dari satu
    # panen. Digabung, jadi makin sering dipanen makin lengkap, dan yang lewat
    # `--hari` dibuang supaya berkasnya tak tumbuh selamanya.
    lama: list[dict] = []
    if KELUARAN.exists():
        try:
            lama = json.loads(KELUARAN.read_text(encoding="utf-8")).get("item", [])
        except Exception:  # noqa: BLE001 — berkas rusak bukan alasan gagal panen
            lama = []

    for it in lama:
        kunci = re.sub(r"\W+", "", it.get("judul", "").lower())[:70]
        if kunci and kunci not in terlihat:
            terlihat.add(kunci)
            unik.append(it)

    batas_waktu = (datetime.now(WIB) - timedelta(days=args.hari)).isoformat()
    sebelum = len(unik)
    # Item tanpa waktu (IPOT) TIDAK ikut dibuang oleh saringan umur — kita tak
    # tahu umurnya, dan menebaknya berarti membuang kabar yang mungkin baru.
    unik = [i for i in unik if not i.get("waktu") or i["waktu"] >= batas_waktu]

    isi = {
        "dipanen": datetime.now(WIB).isoformat(timespec="seconds"),
        "retensi_hari": args.hari,
        "sumber": ["IDX", "IPOT News", "Kontan"],
        "item": urut(unik),
    }
    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    KELUARAN.write_text(json.dumps(isi, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK -> {KELUARAN} ({len(unik)} item, {len(semua)} baru dipanen, "
          f"{sebelum - len(unik)} dibuang karena lewat {args.hari} hari)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
