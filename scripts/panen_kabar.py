"""Panen kabar pasar → data-idx/json/kabar.json.

Lima sumber:

| Sumber              | Cara ambil                                   | Isi                                   |
|---------------------|----------------------------------------------|---------------------------------------|
| IDX — Berita        | `primary/NewsAnnouncement/GetNewsSearch`      | Siaran pers & berita bursa            |
| IDX — Pengumuman    | `primary/ListedCompany/GetAnnouncement`       | Pengumuman resmi PER EMITEN           |
| IPOT News           | HTML `ipotnews/newsList.php` (tak punya RSS)  | Berita pasar harian                   |
| Kontan Investasi    | RSS `investasi.kontan.co.id/rss`              | Berita investasi & pasar modal        |
| Google News RSS     | `news.google.com/rss/search` (3 kueri)        | Pencarian, bukan endpoint IDX — lihat `google_news()` |

Google News RSS adalah **pencarian publik** tanpa kunci API — bukan endpoint
idx.co.id — jadi kandidat pertama yang diuji untuk jalur awan yang tak
bergantung IP rumahan (permintaan Johan 20 Agu 2026: "web search berita saham
yang bisa dijalankan di github action juga"). Status pembuktian dari IP
datacenter GitHub ada di `docs/status-panen.md`, BUKAN disimpulkan dari 200
di mesin ini — lihat catatan di `google_news()`.

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

sys.path.insert(0, str(Path(__file__).resolve().parent))
import arsip_mentah  # noqa: E402 — reuse, lihat CLAUDE.md rung 2
import cek_kabar  # noqa: E402 — bentuk record status ditulis di berkas yang membacanya

# Impor LUNAK, sengaja. `idx_net` menarik `curl_cffi`, dan sampai 18 Agu 2026
# impor itu di ujung berkas: satu lingkungan tanpa curl_cffi membuat SELURUH
# skrip mati sebelum baris pertama jalan — Kontan, IPOT, dan Snips yang tak
# pernah menyentuh idx.co.id ikut hilang karena dependensi milik sumber lain.
# Sekarang kegagalannya dibatasi pada sumber yang memang butuh: dua sumber IDX.
try:
    import idx_net  # noqa: E402 — satu pintu jaringan IDX (curl_cffi)
except Exception as _e:  # noqa: BLE001
    idx_net = None
    _KENAPA_TAK_ADA_IDX_NET = f"{type(_e).__name__}: {_e}"

AKAR = Path(__file__).resolve().parent.parent
KELUARAN = AKAR / "data-idx" / "json" / "kabar.json"
WIB = timezone(timedelta(hours=7))

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")

# Header ala peramban SUNGGUHAN. Bentuk lama (UA + Referer beranda + Accept
# json) mulai dijawab 403 oleh IDX, dan `panen_keuangan_idx.py` sudah
# diperbaiki 18 Agu 2026 -- berkas ini punya salinan headernya sendiri dan
# tertinggal, jadi IDX berita & pengumuman mati bahkan dari mesin rumahan.
# Tak ada yang menyadarinya karena Kontan + IPOT tetap mengisi kabar.json.
#
# Yang menyembuhkan: Accept-Language, sec-ch-ua*, Sec-Fetch-*, dan Referer
# yang menunjuk ke halaman yang wajar memuat panggilan itu -- bukan beranda.
_HDR_PERAMBAN = {
    "User-Agent": UA,
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}
HEADER_IDX = {
    **_HDR_PERAMBAN,
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.idx.co.id/id/berita/berita",
}
HEADER_UMUM = {"User-Agent": UA}


SESI = requests.Session()

# Kenapa tiap sumber gagal, dikumpulkan selagi panen berjalan. Tanpa ini,
# "sumber mati" dan "sumber sepi" sama-sama tampil sebagai `0 item` — dan 403,
# timeout, serta "bentuk balasan berubah" adalah tiga masalah berbeda dengan
# tiga penanganan berbeda. Dikosongkan sebelum tiap sumber dipanen.
GALAT: list[str] = []


def _ringkas_galat(e: Exception) -> str:
    """"HTTP 403" / "timeout" / "JSONDecodeError" — pendek, tapi cukup untuk
    memutuskan langkah berikutnya. Teks galat utuh tetap masuk stderr."""
    teks = str(e)
    kode = re.search(r"HTTP (\d{3})|(\d{3}) (?:Client|Server) Error", teks)
    if kode:
        return f"HTTP {kode.group(1) or kode.group(2)}"
    nama = type(e).__name__
    return "timeout" if "Timeout" in nama or "timeout" in teks.lower() else nama


def ambil(url: str, headers: dict, timeout: int = 45, arsip: str | None = None) -> requests.Response | None:
    """GET yang tak pernah menggagalkan seluruh panen: satu sumber mati bukan
    alasan tiga sumber lain ikut hilang dari halaman.

    `arsip` (opsional): label sumber ("idx-berita", "ipot-stocks", dst) —
    kalau diisi, badan respons MENTAH disimpan ke
    `_arsip-mentah/kabar/<tanggal>/<arsip>.<ext>` sebelum diparse.
    """
    try:
        if "idx.co.id" in url:
            # Lewat curl_cffi, BUKAN requests (18 Agu 2026). Terukur:
            # NewsAnnouncement/GetNewsSearch -> 403 lewat requests, 200 lewat
            # curl_cffi impersonate=chrome124. Pembedanya sidik jari TLS.
            # Pemanasan cookie (dulu `_pemanasan_idx`) pindah ke idx_net;
            # GetAnnouncement tetap butuh itu, jadi tak boleh ikut dibuang.
            # Sumber NON-IDX (IPOT dsb.) sengaja TETAP di `requests` — tak ada
            # yang perlu disembuhkan di sana.
            if idx_net is None:
                raise RuntimeError(f"idx_net tak bisa dimuat — {_KENAPA_TAK_ADA_IDX_NET}")
            r = idx_net.get(url, headers=headers, timeout=timeout)
        else:
            r = SESI.get(url, headers=headers, timeout=timeout)
            r.raise_for_status()
        if arsip:
            ct = r.headers.get("Content-Type", "")
            ext = "json" if "json" in ct else ("xml" if "xml" in ct else "html")
            tanggal = datetime.now(WIB).strftime("%Y-%m-%d")
            arsip_mentah.simpan("kabar", tanggal, f"{arsip}.{ext}", data=r.text)
        return r
    except Exception as e:  # noqa: BLE001 — sengaja menangkap semuanya
        print(f"  ! gagal {url[:60]}… — {e}", file=sys.stderr)
        GALAT.append(_ringkas_galat(e))
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
    r = ambil(url, HEADER_IDX, arsip="idx-berita")
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
    r = ambil(url, HEADER_IDX, arsip="idx-pengumuman")
    if not r:
        return []
    out = []
    for baris in (r.json().get("Replies") or []):
        p = baris.get("pengumuman") or {}
        # Kode_Emiten datang dipadatkan spasi selebar 100 karakter, dan bisa
        # memuat beberapa kode sekaligus.
        kode = [k for k in re.split(r"[\s,;]+", (p.get("Kode_Emiten") or "")) if k]
        # Tautan PER PENGUMUMAN, bukan halaman daftar. Tiap baris membawa
        # `attachments`: yang `IsAttachment: false` adalah dokumen utamanya,
        # sisanya lampiran. Sebelumnya semua baris ditunjuk ke satu URL
        # generik yang sama — pembaca yang mengklik mendarat di halaman
        # pencarian dan harus mencari sendiri pengumuman yang barusan
        # dibacanya. Halaman daftar tetap jadi cadangan kalau memang tak ada
        # berkas terlampir.
        lampiran = baris.get("attachments") or []
        utama = next((a for a in lampiran if not a.get("IsAttachment")), None) or (lampiran[0] if lampiran else None)
        tautan = (utama or {}).get("FullSavePath") or "https://www.idx.co.id/id/perusahaan-tercatat/keterbukaan-informasi"
        out.append({
            "sumber": "IDX",
            "jenis": "pengumuman",
            "judul": (p.get("JudulPengumuman") or p.get("PerihalPengumuman") or "").strip(),
            "tautan": tautan,
            "waktu": wib(p.get("TglPengumuman")),
            "emiten": kode[:6],
            "nomor": (p.get("NoPengumuman") or "").strip() or None,
        })
    return out


# Kanal IPOT News yang ditunjuk Johan — TUJUH, bukan empat. `newsList.php`
# yang dipakai sebelumnya adalah daftar campur: di sana berita bursa
# berdampingan dengan politik Amerika dan pemilu Zambia. Kanal per topik ini
# yang isinya pasar.
#
# Tiga terakhir ditambahkan 20 Agu 2026 atas kiriman tautan Johan, dan
# ketiganya diuji lebih dulu sebelum dipasang: `industries`, `bonds`, dan
# `komoditi` sama-sama menjawab 200 dengan 200 tautan `newsDetail.php` per
# halaman, jadi tak ada yang perlu diperlakukan khusus.
IPOT_KANAL = [
    ("stocks", "Saham"),
    ("economy", "Ekonomi"),
    ("ipsnews", "IPS News"),
    ("jci", "Market/JCI"),
    ("industries", "Industri"),
    ("bonds", "Obligasi"),
    ("komoditi", "Komoditas"),
]

# Lantai per kanal. Tanpa ini `batas // len(IPOT_KANAL)` menyusut diam-diam
# tiap kali kanal ditambah — dengan `--batas 30` bawaan alur, tujuh kanal cuma
# kebagian 4 item masing-masing, jadi menambah kanal justru MENGURANGI kabar
# yang masuk dari kanal yang sudah ada.
IPOT_MIN_PER_KANAL = 10

# Halaman kanal itu sendiri cuma kerangka — daftarnya diambil JavaScript dari
# endpoint di bawah, yang membalas JSON berisi potongan HTML per halaman.
# Ditemukan dengan membaca lalu lintas jaringan halamannya, bukan menebak URL.
IPOT_AJAX = "https://www.indopremier.com/module/newsresearch/ajax/ajax_generalNewsPagesMore.php"

# "Saturday, Aug 15, 2026 - 11:46 WIB"
_WAKTU_IPOT = re.compile(r"<small>[^,]+,\s*([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})\s*-\s*(\d{1,2}):(\d{2})", re.I)
_ITEM_IPOT = re.compile(
    r'<small>(.*?)</small>.*?<a href="(newsDetail\.php\?[^"]+)"[^>]*>(.*?)</a>',
    re.S)
_BULAN_EN = {b: i for i, b in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def _waktu_ipot(potongan: str) -> str | None:
    m = _WAKTU_IPOT.search(potongan)
    if not m:
        return None
    bln = _BULAN_EN.get(m.group(1).lower())
    if not bln:
        return None
    try:
        return datetime(int(m.group(3)), bln, int(m.group(2)),
                        int(m.group(4)), int(m.group(5)), tzinfo=WIB).isoformat()
    except ValueError:
        return None


def ipot(batas: int) -> list[dict]:
    """IPOT News — empat kanal topik, lewat endpoint AJAX-nya.

    Berbeda dari daftar umum yang dipakai sebelumnya, potongan HTML di sini
    MEMBAWA WAKTU TERBIT ("Saturday, Aug 15, 2026 - 11:46 WIB"), jadi kabar
    IPOT tak lagi tampil tanpa tanggal dan bisa diurut bersama sumber lain.
    """
    out, terlihat = [], set()
    per_kanal = max(IPOT_MIN_PER_KANAL, batas // len(IPOT_KANAL))
    for level4, nama in IPOT_KANAL:
        r = ambil(f"{IPOT_AJAX}?halaman=0&level4={level4}",
                  {**HEADER_UMUM, "Referer": f"https://www.indopremier.com/ipotnews/nw-saham.php?level4={level4}",
                   "X-Requested-With": "XMLHttpRequest"},
                  arsip=f"ipot-{level4}")
        if not r:
            continue
        # String mentah (r"") wajib di sini: "\/" itu escape tak sah, dan
        # Python memang belum mengubahnya — tapi peringatannya sudah keluar
        # dan versi mendatang akan menerjemahkannya. Escape yang diam-diam
        # berubah arti adalah cara paling senyap merusak pengurai teks.
        teks = r.text.replace(r"\/", "/").replace(r'\"', '"')
        n = 0
        for m in _ITEM_IPOT.finditer(teks):
            judul = re.sub(r"<[^>]+>", " ", m.group(3))
            judul = re.sub(r"\s{2,}", " ", html.unescape(judul)).strip()
            tautan = html.unescape(m.group(2))
            nid = re.search(r"news_id=(\d+)", tautan)
            kunci = nid.group(1) if nid else tautan
            if not judul or kunci in terlihat:
                continue
            terlihat.add(kunci)
            out.append({
                "sumber": "IPOT News",
                "jenis": "berita",
                "kanal": nama,
                "judul": judul,
                "tautan": "https://www.indopremier.com/ipotnews/" + tautan,
                "waktu": _waktu_ipot(m.group(0)),
                "emiten": [],
            })
            n += 1
            if n >= per_kanal:
                break
    return out


def rss(nama: str, url: str, batas: int, arsip: str | None = None) -> list[dict]:
    """Pembaca RSS umum — dipakai Kontan dan Google News.

    Feed publik biasa **tanpa batasan IP**, beda dari endpoint IDX.
    Itu yang membuat mereka bisa dipanen dari GitHub Actions (lihat
    `--hanya` di bawah dan `docs/panen-kabar.md`).

    `arsip` override label arsip mentah — perlu kalau `rss()` dipanggil
    berkali-kali dengan `nama` yang sama (Google News: 3 kueri berbeda),
    supaya arsipnya tak saling menimpa (lihat `google_news()`).
    """
    r = ambil(url, HEADER_UMUM, arsip=arsip or f"rss-{nama.lower()}")
    if not r:
        return []
    try:
        akar = ET.fromstring(r.content)
    except ET.ParseError as e:
        print(f"  ! RSS {nama} tak terbaca — {e}", file=sys.stderr)
        return []
    out = []
    for item in akar.iterfind(".//item")[:batas] if False else list(akar.iterfind(".//item"))[:batas]:
        judul = (item.findtext("title") or "").strip()
        tautan = (item.findtext("link") or "").strip()
        tgl = (item.findtext("pubDate") or "").strip()
        waktu = None
        # Google News membalas "GMT" literal ("Wed, 19 Aug 2026 23:54:00
        # GMT"), bukan offset angka — `%z` menolaknya (`does not match
        # format`), lolos ke pola tanpa zona lalu SALAH ditandai WIB (geser
        # 7 jam, item "basi" jadi terbaca "dari masa depan"). Diuji 20 Agu
        # 2026: semua item Google News waktu=None sebelum ini, dan itu
        # membuat `cek_kabar.py` membaca sumbernya seolah kosong walau
        # panennya OK. `%Z` di sini cocok dengan token GMT tapi tak mengisi
        # tzinfo — jadi UTC dipasang tangan, bukan lewat `t.tzinfo`.
        # ponytail: hanya menangani GMT/UTC; kalau kelak ada feed RSS lain
        # berzona-nama BUKAN GMT/UTC, tambah cabang, jangan diam-diam pukul
        # rata ke UTC.
        for pola in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z", "%a, %d %b %Y %H:%M:%S"):
            try:
                t = datetime.strptime(tgl, pola)
                if t.tzinfo:
                    waktu = t.isoformat()
                elif pola.endswith("%Z"):
                    waktu = t.replace(tzinfo=timezone.utc).isoformat()
                else:
                    waktu = t.replace(tzinfo=WIB).isoformat()
                break
            except ValueError:
                continue
        if judul and tautan:
            out.append({"sumber": nama, "jenis": "berita", "judul": judul,
                        "tautan": tautan, "waktu": waktu, "emiten": []})
    return out


# Kueri Google News RSS — daftar, bukan satu kueri, supaya bisa diperluas
# tanpa menulis pengurai baru (dipakai lewat `rss()` yang sudah ada).
# TIDAK per-emiten: ~960 emiten berarti ~960 permintaan, dan kueri "emiten"
# di bawah sendirian sudah menangkap sebagian besar berita per-emiten.
#
# Diuji 20 Agu 2026 dari mesin ini (bukan dari awan — lihat `google_news()`):
# kueri LONGGAR terbukti kotor dan makanya TIDAK dipakai —
#   "bursa when:1d" ikut menyeret "Pameran Bursa Kerja (Job Fair) 2026",
#   "Saldo Ethereum di bursa turun 10%", "Bursa Kripto CFX Perkuat Komitmen
#   Lingkungan", "Bursa Komoditas dan Mimpi Jadi Penentu Harga Dunia" — bursa
#   kerja, bursa kripto, bursa komoditas, tak satu pun soal IDX.
#   "saham" tanpa kualifikasi ikut menyeret "Mengapa saham CSL melonjak
#   hari ini?" (saham AS) dan "Wolfspeed turun ... akibat kerugian Q4" (AS).
# Ketiga kueri di bawah diuji BERSIH dari itu (lihat laporan panen).
GOOGLE_NEWS_KUERI = [
    ("umum", "saham IHSG when:1d"),
    ("bei", '"Bursa Efek Indonesia" when:1d'),
    ("emiten", "emiten saham when:1d"),
]
GOOGLE_NEWS_MIN_PER_KUERI = 15  # lantai, sama alasannya dengan IPOT_MIN_PER_KANAL


def google_news(batas: int) -> list[dict]:
    """Google News RSS — gabungan tiga kueri (`GOOGLE_NEWS_KUERI`), dedup sendiri.

    Kandidat utama untuk jalur awan: ini PENCARIAN publik, bukan endpoint
    idx.co.id, jadi tak terikat blokir IP datacenter yang menjegal IDX &
    Kontan (lihat docstring modul). **Belum terbukti tembus dari awan** —
    200 di mesin ini cuma membuktikan sumbernya hidup, bukan soal IP
    datacenter GitHub (persis kasus IDX/Kontan yang sudah pernah menjebak,
    lihat `docs/status-panen.md`). Baris "belum terbukti" itu hanya boleh
    berubah sesudah ada run awan yang hijau dan benar-benar mengisinya.

    Dedup di sini pakai tautan+judul+waktu (aturan proyek — jangan tautan
    saja), tapi itu TIDAK menangkap kasus artikel sama yang dilaporkan ulang
    penerbit berbeda dengan judul berbeda, dan URL Google News sendiri
    (`news.google.com/rss/articles/<token>`) adalah pengalihan yang bisa
    beda tautan untuk kueri berbeda walau artikelnya sama persis. Dedup
    LINTAS sumber di `main()` (kunci judul saja, dipangkas 70 karakter)
    yang menangkap sisanya.
    """
    out, terlihat = [], set()
    per_kueri = max(GOOGLE_NEWS_MIN_PER_KUERI, batas // len(GOOGLE_NEWS_KUERI))
    for label, q in GOOGLE_NEWS_KUERI:
        url = "https://news.google.com/rss/search?q=" + urllib.parse.quote(q) + "&hl=id&gl=ID&ceid=ID:id"
        for it in rss("Google News", url, per_kueri, arsip=f"google-news-{label}"):
            kunci = f"{it['tautan']}|{it['judul']}|{it['waktu']}"
            if kunci in terlihat:
                continue
            terlihat.add(kunci)
            out.append(it)
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
    ap.add_argument("--hanya", default="",
                    help="panen sebagian sumber saja, dipisah koma "
                         "(idx, idx-pengumuman, ipot, kontan, google-news). Kosong = semua")
    ap.add_argument("--status", default="",
                    help="berkas JSONL: satu baris hasil per sumber "
                         "(berhasil/gagal + kenapa). Dibaca scripts/cek_kabar.py")
    args = ap.parse_args()

    # kunci → (label, fungsi). Kunci dipakai `--hanya` supaya jalur awan bisa
    # memanen HANYA sumber yang tak terikat IP rumahan.
    SUMBER = {
        "idx": ("IDX berita", idx_berita),
        "idx-pengumuman": ("IDX pengumuman", idx_pengumuman),
        "ipot": ("IPOT News", ipot),
        "kontan": ("Kontan", lambda b: rss("Kontan", "https://investasi.kontan.co.id/rss", b)),
        "google-news": ("Google News", google_news),
        # CNBC Indonesia dan detikFinance DICABUT (16 Agu 2026):
        #   - CNBC: URL-nya `/market/rss` tapi isinya campur berita umum
        #     ("Bupati Terkaya di Jawa Hidup Serba Mewah"). Menyaring judul
        #     dengan kata kunci pasar cuma memindahkan tebakan ke tempat lain.
        #   - detikFinance: feed-nya hidup kalau diuji satuan, tapi dua panen
        #     berturut-turut kena timeout — sumber yang cuma kadang menjawab
        #     membuat jumlah item naik-turun tanpa sebab yang terbaca.
        # Arsip IPOT (`panen_ipot_arsip.py`) jauh lebih tebal dan relevan
        # daripada keduanya digabung, jadi dicabut tanpa rugi.
    }
    pilih = [k.strip() for k in args.hanya.split(",") if k.strip()] if args.hanya else list(SUMBER)
    tak_dikenal = [k for k in pilih if k not in SUMBER]
    if tak_dikenal:
        raise SystemExit(f"Sumber tak dikenal: {', '.join(tak_dikenal)}. Pilihan: {', '.join(SUMBER)}")

    semua: list[dict] = []
    for kunci in pilih:
        nama, fn = SUMBER[kunci]
        # Tiap sumber berdiri sendiri. Sebelumnya galat yang lolos dari
        # `ambil()` (mis. balasan 200 yang bukan JSON) melempar keluar dari
        # perulangan ini dan menghentikan SELURUH panen — sumber sehat yang
        # antre di belakangnya ikut hilang tanpa pernah dicoba.
        GALAT.clear()
        try:
            hasil = fn(args.batas)
        except Exception as e:  # noqa: BLE001
            print(f"  ! {nama} melempar galat — {e}", file=sys.stderr)
            hasil = []
            GALAT.append(_ringkas_galat(e))
        # Tiga keadaan, bukan dua. "kosong" = sumbernya menjawab tapi nol item
        # terparse: bisa memang sepi, bisa bentuk balasannya berubah dan
        # pengurai kita diam-diam tak cocok lagi. Yang kedua kegagalan senyap,
        # jadi tak boleh dilebur ke "gagal" maupun ke "ok".
        status = "ok" if hasil else ("gagal" if GALAT else "kosong")
        print(f"  {nama}: {len(hasil)} item [{status}{' — ' + ', '.join(dict.fromkeys(GALAT)) if GALAT else ''}]")
        cek_kabar.catat(args.status, kunci, nama, status, len(hasil),
                        ", ".join(dict.fromkeys(GALAT)))
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
    # Retensi per sumber. Satu angka untuk semua mengandaikan semua sumber
    # berkadensa sama, dan IDX berita membantahnya: siaran pers BEI terbit
    # beberapa kali sebulan, jadi 30 item yang baru saja dipanen SELURUHNYA
    # lewat 7 hari dan dibuang di baris ini. Akibatnya ganda dan dua-duanya
    # senyap — halaman Kabar tak pernah memuat satu pun siaran pers BEI, dan
    # `cek_kabar.py` memvonis MERAH "tak ada satu pun item di berkas" pada
    # sumber yang panennya justru berhasil. Alarm yang mustahil hijau bukan
    # alarm. Ambangnya diikat ke jeda terbit sumbernya, bukan ke selera.
    RETENSI_KHUSUS = {("IDX", "berita"): 60}
    batas_khusus = {
        k: (datetime.now(WIB) - timedelta(days=h)).isoformat()
        for k, h in RETENSI_KHUSUS.items()
    }
    def masih_berlaku(i: dict) -> bool:
        w = i.get("waktu")
        # Sejak IPOT dipanen lewat kanal topiknya, KEEMPAT sumber membawa waktu
        # terbit. Jadi item tanpa waktu = sisa panen lama sebelum perbaikan itu,
        # dan justru harus luruh. (Pengecualian lama "tanpa waktu jangan dibuang"
        # dicabut: sekarang dia cuma membuat sampah menetap selamanya.)
        if not w:
            return False
        return w >= batas_khusus.get((i.get("sumber"), i.get("jenis")), batas_waktu)

    sebelum = len(unik)
    unik = [i for i in unik if masih_berlaku(i)]

    isi = {
        "dipanen": datetime.now(WIB).isoformat(timespec="seconds"),
        "retensi_hari": args.hari,
        "sumber": sorted({i["sumber"] for i in unik}),
        "item": urut(unik),
    }
    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    KELUARAN.write_text(json.dumps(isi, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK -> {KELUARAN} ({len(unik)} item, {len(semua)} baru dipanen, "
          f"{sebelum - len(unik)} dibuang karena lewat {args.hari} hari)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
