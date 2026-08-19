"""Arus Pasar — SATU sumber palet warna untuk semua terbitan (Opsi A ·
Permukaan & Suhu).

Prinsip (baca ini sebelum menambah terbitan ke-5):
  - Permukaan (latar halaman) ditentukan CARA BACA: dibaca di layar -> gelap
    (Daily, Weekly); dicetak/diarsipkan sebagai dokumen rujukan -> terang
    (Single/Bedah, Monthly).
  - Aksen (satu warna penekan per terbitan — dipakai utk kode edisi, label
    pivot chart, garis PCD, dsb) ditentukan JANGKAUAN WAKTU datanya: makin
    panjang rentang, makin dingin huenya. Single (1 hari) = teal gelap ->
    Daily (1 hari juga tapi harian) = amber -> Weekly = cyan muda -> Monthly
    (rekap sebulan) = biru navy dingin.
  - Naik/Turun (hijau/merah) tetap warna konvensi pasar di semua terbitan;
    hanya nuansanya mengikuti temperatur permukaan (lebih cerah di atas
    gelap, lebih gelap/jenuh di atas terang supaya tetap ≥4,5:1).
  - Enam token di bawah ini SUDAH final & disetujui — jangan ubah nilainya.
    Token turunan (panel/hair/brand/ink2/*-dim) dihitung otomatis dari
    keenamnya lewat blok_css()/blok_tema() supaya tidak ada hex yang harus
    disalin tangan ke generator lain.

Dipakai: build.py ("daily"), build_bedah.py ("single"), build_weekly.py
("weekly"), build_monthly.py ("monthly") — masing-masing memanggil
blok_css(edisi) utk mengisi placeholder /*PALET*/ di template.html, dan
blok_tema(edisi) utk window.__TEMA yang dibaca gambarChart().
"""
import base64
import json
from pathlib import Path

# ── Enam token dasar per terbitan (JANGAN UBAH — sudah disetujui user) ──────
PALET = {
    "single":  {"permukaan": "#FFFFFF", "tinta": "#0F1A22", "redup": "#57687A",
                "aksen": "#0A6B63", "naik": "#0F7A38", "turun": "#B3271E"},
    "daily":   {"permukaan": "#0E1620", "tinta": "#E7EEF4", "redup": "#8FA3B0",
                "aksen": "#E8A33D", "naik": "#3BC46F", "turun": "#F0705F"},
    "weekly":  {"permukaan": "#26333D", "tinta": "#EAF1F5", "redup": "#A8B9C4",
                "aksen": "#7FD1E8", "naik": "#5BD98A", "turun": "#FF8B7A"},
    "monthly": {"permukaan": "#F5F2EA", "tinta": "#171C26", "redup": "#5E6470",
                "aksen": "#243F7A", "naik": "#0F7A38", "turun": "#A8241C"},
}

# EMA chart 5-garis: 2 set hue tetap (tak bagian tabel token, murni dekorasi
# pembeda garis) — dipilih berdasar gelap/terangnya permukaan supaya kontras.
_EMA_GELAP = [[20, "#6FE3D9", 1], [50, "#37B8AF", 1], [60, "#7E97B8", 1],
              [100, "#A583D6", 1], [200, "#E0955A", 1.5]]
_EMA_TERANG = [[20, "#0E8F87", 1], [50, "#0A6E68", 1.2], [60, "#4A6B8A", 1],
               [100, "#6B4FA8", 1], [200, "#B06A2C", 1.5]]


# ── Helper warna ─────────────────────────────────────────────────────────────

def _rgb(hx):
    hx = hx.lstrip("#")
    return tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))


def _hex(rgb):
    return "#%02X%02X%02X" % tuple(max(0, min(255, round(c))) for c in rgb)


def _mix(a, b, t):
    """t=0 -> warna a, t=1 -> warna b."""
    ra, rb = _rgb(a), _rgb(b)
    return _hex(tuple(ra[i] + (rb[i] - ra[i]) * t for i in range(3)))


def rgba(hx, alpha):
    r, g, b = _rgb(hx)
    return f"rgba({r},{g},{b},{alpha})"


def _luminansi(hx):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = _rgb(hx)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def gelap(edisi):
    """True kalau permukaan terbitan ini gelap (dibaca di layar)."""
    return _luminansi(PALET[edisi]["permukaan"]) < 0.5


# ── Token turunan (dihitung, bukan ditulis tangan) ───────────────────────────

def token(edisi):
    b = PALET[edisi]
    g = gelap(edisi)
    dim_a = 0.16 if g else 0.11
    return {
        "paper": b["permukaan"], "ink": b["tinta"], "mute": b["redup"],
        "ink2": _mix(b["tinta"], b["redup"], 0.5),
        "hair": rgba(b["tinta"], 0.12),
        "panel": rgba(b["tinta"], 0.05),
        "brand": _mix(b["permukaan"], b["tinta"], 0.09),
        # aksen tunggal dipakai jadi teal/side/warn — sistem baru tak lagi
        # butuh warna "netral" & "peringatan" terpisah, aksen sudah cukup.
        "teal": b["aksen"], "side": b["aksen"], "warn": b["aksen"],
        "bull": b["naik"], "bull-dim": rgba(b["naik"], dim_a),
        "bear": b["turun"], "bear-dim": rgba(b["turun"], dim_a),
        "side-dim": rgba(b["aksen"], dim_a),
    }


def blok_css(edisi):
    """Blok CSS ":root{...}" TELANJANG (tanpa tag <style>) siap sisip ke
    placeholder /*PALET*/ template.html — placeholder itu sudah ada DI DALAM
    <style> milik <head>; membungkusnya lagi malah menutup <style> itu lebih
    awal (tag bersarang ditolak parser HTML) dan sisa CSS bocor jadi teks
    halaman. Pemanggil yang menyisip di BODY (bukan di dalam <style> lain,
    mis. BSTYLE build_bedah.py) yang harus membungkus sendiri dengan
    <style>...</style>."""
    t = token(edisi)
    baris = ";".join(f"--{k}:{v}" for k, v in t.items())
    return f":root{{{baris}}}"


# ── Huruf terbitan (#127) ────────────────────────────────────────────────────
# Sebelum ini PDF memakai Bahnschrift + Cascadia (font bawaan Windows),
# sementara web memakai keluarga huruf lain — dua wajah untuk satu produk.
# Berkas fontnya sudah ada di repo (app/public/fonts, SIL OFL 1.1), jadi tak
# perlu diunduh ulang atau dipasang ke sistem.
#
# Diganti dari Red Hat ke Plus Jakarta Sans + IBM Plex Mono 19 Agu 2026
# (permintaan Johan, sapuan font seluruh produk — web dan cetak harus
# berwajah sama).
#
# Fontnya DITANAM sebagai data URI, bukan dirujuk lewat path. Chromium
# headless membuka keluaran/*.html lewat file://, dan di origin file:// setiap
# berkas dianggap asal berbeda — permintaan font ke direktori lain diblokir
# diam-diam, PDF-nya lalu jatuh ke Segoe UI tanpa satu pun pesan galat
# (terlihat 16 Agu 2026: PDF berisi Georgia + SegoeUI, bukan huruf terpasang).
# Menanam ±100 KB font juga membuat HTML terbitan berdiri sendiri — arsip yang
# dibuka bertahun-tahun kemudian tetap tampil dengan huruf yang benar.
_FONT = [
    ("Plus Jakarta Sans", 700, "PlusJakartaSans-700"),
    ("Plus Jakarta Sans", 800, "PlusJakartaSans-800"),
    ("Plus Jakarta Sans", 400, "PlusJakartaSans-400"),
    ("Plus Jakarta Sans", 500, "PlusJakartaSans-500"),
    ("IBM Plex Mono", 400, "IBMPlexMono-400"),
    ("IBM Plex Mono", 600, "IBMPlexMono-600"),
    # 700 ditambah 19 Agu (bukan cuma 400/600): template.html punya beberapa
    # selektor var(--mono) berbobot 800 (skor komposit, kode ticker) — Plex
    # Mono TAK PUNYA wajah 800 sama sekali, jadi selektornya diturunkan ke 700
    # (lihat template.html). Tanpa wajah 700 pun tertanam, permintaan itu
    # meleset dari SEMUA wajah yang ada dan Chromium loncat ke Segoe UI.
    ("IBM Plex Mono", 700, "IBMPlexMono-700"),
]
_FONT_DIR = Path(__file__).parent.parent / "app" / "public" / "fonts"


def blok_font():
    """@font-face (font ditanam) + variabel --disp/--ui/--mono,
    TELANJANG (tanpa tag <style>) — sama seperti blok_css(), siap sisip ke
    placeholder /*FONT*/ yang sudah berada di dalam <style> template."""
    cek_font()
    muka = "".join(
        f"@font-face{{font-family:'{nama}';font-style:normal;font-weight:{berat};"
        # Tanda kutip WAJIB: base64 memuat '=' dan '/', dan url() tanpa kutip
        # menolak keduanya — tanpa kutip aturannya diabaikan diam-diam dan PDF
        # kembali ke huruf cadangan.
        f'src:url("data:font/woff2;base64,'
        f"{base64.b64encode((_FONT_DIR / f'{berkas}.woff2').read_bytes()).decode()}\")"
        f" format('woff2')}}"
        for nama, berat, berkas in _FONT
    )
    return muka + (
        ":root{"
        "--disp:'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif;"
        "--ui:'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif;"
        "--mono:'IBM Plex Mono','Cascadia Mono',Consolas,monospace"
        "}"
    )


def cek_font():
    """Berkas font yang hilang = PDF diam-diam jatuh ke huruf cadangan, dan itu
    baru ketahuan setelah edisi terbit. Dipanggil generator sebelum render."""
    hilang = [f"{b}.woff2" for _, _, b in _FONT if not (_FONT_DIR / f"{b}.woff2").exists()]
    if hilang:
        raise FileNotFoundError(f"font terbitan hilang di {_FONT_DIR}: {', '.join(hilang)}")


def blok_tema(edisi):
    """<script>window.__TEMA=...</script> siap sisip SEBELUM script utama
    template.html jalan (gambarChart() membaca window.__TEMA)."""
    b = PALET[edisi]
    g = gelap(edisi)
    tema = {
        "emas": _EMA_GELAP if g else _EMA_TERANG,
        "bull": b["naik"], "bear": b["turun"],
        "bullSoft": rgba(b["naik"], 0.30), "bearSoft": rgba(b["turun"], 0.30),
        "teks": b["tinta"], "teksLembut": rgba(b["tinta"], 0.55),
        "grid": rgba(b["tinta"], 0.28 if g else 0.14),
        # label pivot = redup solid (bukan tinta translucent) — kontras
        # aman di kedua arah gelap/terang, sudah terbukti di edisi Single.
        "pivot": b["redup"],
    }
    return f"<script>window.__TEMA = {json.dumps(tema)};</script>"


def demo():
    """Cek diri: keenam token final tak berubah, turunan konsisten,
    blok_css/blok_tema menghasilkan CSS/JS valid utk keempat terbitan."""
    assert PALET["single"]["permukaan"] == "#FFFFFF"
    assert PALET["daily"]["aksen"] == "#E8A33D"
    assert PALET["weekly"]["naik"] == "#5BD98A"
    assert PALET["monthly"]["turun"] == "#A8241C"
    assert _mix("#000000", "#FFFFFF", 0.5) == "#808080"
    assert rgba("#0A6B63", 0.5) == "rgba(10,107,99,0.5)"
    assert gelap("daily") and gelap("weekly") and not gelap("single") and not gelap("monthly")
    for edisi in PALET:
        css, js = blok_css(edisi), blok_tema(edisi)
        assert css.startswith(":root{--paper:") and "<style>" not in css
        assert js.startswith("<script>window.__TEMA = {")
        assert PALET[edisi]["permukaan"] in css
    print("palet.py self-test OK —", ", ".join(PALET))


if __name__ == "__main__":
    demo()
