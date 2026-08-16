"""Arus Pasar — perakit report BULANAN dengan SCORECARD (akuntabilitas pick).

Bukan sekadar gabungan edisi: tiap pick unik dievaluasi terhadap target dan
invalidation yang DITULIS SENDIRI di edisi pertamanya, memakai bar OHLC nyata
SESUDAH tanggal pick (cache terbaru yang tersedia). Vonis: TARGET TERCAPAI /
INVALID / BERJALAN / TANPA DATA — tidak pernah mengarang; data yang tidak ada
ditampilkan jujur sebagai TANPA DATA.

Struktur: sampul (angka utama scorecard) -> halaman scorecard -> ringkasan
statistik (hit rate, skor vs hasil, frekuensi emiten) -> peringkat akhir bulan
(reuse halaman_peringkat; posisi = kemunculan terakhir). Tanpa detail per
emiten — itu porsi harian/mingguan.

Kode edisi: AP-M<mmyy>-E01 (konsisten pola AP-W<ddmmyy>-E01; M = monthly).
Sumber bertanda UJI- membuat kode ikut berprefiks UJI-.

Pakai:
  python build_monthly.py 2026-08
  python build_monthly.py 2026-08 --dir-edisi edisi-uji   # data uji -> keluaran-uji/
  python build_monthly.py 2026-08 --tanpa-pdf
  python build_monthly.py --self-test                     # uji logika vonis/parser
"""
import argparse, datetime as dt, json, re
from pathlib import Path

import palet
from build import AKAR, fmt, halaman_peringkat, band, kaki, render_pdf, tulis_meta
from build_weekly import hitung_skor, BULAN

EDISI_PALET = "monthly"  # Opsi A · Permukaan & Suhu — lihat palet.py
BARIS_SC = 12  # ponytail: baris scorecard per halaman; sel vonis 2 baris, muat aman di A4
MAKS_SAMPUL = 12


# ── Parser & vonis ───────────────────────────────────────────────────────────

def parse_harga(teks):
    """Angka pertama format Indonesia (titik ribuan, koma desimal) -> float.

    'Close <1.110' -> 1110 · '1.245 / 1.290' -> 1245 · '565 / 575' -> 565.
    Tak ada angka valid -> None (vonis TANPA DATA; JANGAN tebak).
    """
    m = re.search(r"\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?", teks or "")
    if not m:
        return None
    return float(m.group().replace(".", "").replace(",", "."))


def vonis_pick(bars, tgl_pick, target, inval):
    """Telusuri bar per bar SESUDAH tgl_pick (ISO string); kejadian kronologis
    pertama menang. Dalam SATU bar yang memuat keduanya, target menang:
    high tersentuh intraday, close adalah transaksi terakhir hari itu —
    jadi sentuhan target selalu mendahului close < invalidation di bar sama.
    Aturan invalidation mengikuti teks edisi: Close < X (strict)."""
    if bars is None:
        return {"vonis": "TANPA DATA", "tanggal": None, "hi": None, "lo": None,
                "catatan": "ticker tidak ada di cache OHLC terbaru"}
    sesudah = [b for b in bars if b["d"] > tgl_pick]
    hi = max((b["h"] for b in sesudah), default=None)
    lo = min((b["l"] for b in sesudah), default=None)
    if target is None or inval is None:
        return {"vonis": "TANPA DATA", "tanggal": None, "hi": hi, "lo": lo,
                "catatan": "target/invalidation tak bisa diparse dari teks edisi"}
    if not sesudah:
        return {"vonis": "TANPA DATA", "tanggal": None, "hi": None, "lo": None,
                "catatan": "cache OHLC belum memuat bar sesudah tanggal pick"}
    for b in sesudah:
        if b["h"] >= target:
            return {"vonis": "TARGET TERCAPAI", "tanggal": b["d"], "hi": hi, "lo": lo, "catatan": ""}
        if b["c"] < inval:
            return {"vonis": "INVALID", "tanggal": b["d"], "hi": hi, "lo": lo, "catatan": ""}
    return {"vonis": "BERJALAN", "tanggal": None, "hi": hi, "lo": lo, "catatan": ""}


def prog_mingguan(riwayat):
    """Skor terakhir tiap pekan ISO, urut waktu -> progresi ringkas per minggu."""
    per_minggu = {}
    for tgl, total in riwayat:
        per_minggu[tgl.isocalendar()[:2]] = total
    return list(per_minggu.values())


def tgl_id(t):
    return f"{t.day} {BULAN[t.month][:3]}"


# ── Halaman ──────────────────────────────────────────────────────────────────

KELAS_VONIS = {"TARGET TERCAPAI": "vd-ok", "INVALID": "vd-bad",
               "BERJALAN": "vd-run", "TANPA DATA": "vd-nd"}

GAYA_EKSTRA = """<style>
table.sc{width:100%;border-collapse:collapse;font-size:8pt;font-variant-numeric:tabular-nums}
table.sc th{font-size:6.1pt;color:var(--mute);text-transform:uppercase;letter-spacing:.12em;
  text-align:left;padding:0 2mm 2mm 0;border-bottom:1px solid var(--hair)}
table.sc td{padding:2.4mm 2mm 2.4mm 0;border-bottom:1px solid var(--hair);vertical-align:top}
table.sc .tk{font-weight:800;font-size:9.5pt}
table.sc .prog-cell{font-family:var(--mono);font-size:7.2pt;white-space:nowrap}
.vd{display:inline-block;font-size:6.4pt;font-weight:800;letter-spacing:.08em;
  padding:.9mm 1.8mm;border:1px solid currentColor;white-space:nowrap}
.vd-ok{color:var(--bull)}.vd-bad{color:var(--bear)}.vd-run{color:var(--side)}.vd-nd{color:var(--mute)}
.vd-sub{display:block;font-size:6.4pt;color:var(--mute);margin-top:1mm;max-width:34mm}
</style>"""


def halaman_sampul_bulanan(ed, picks_urut, jml, total_muncul):
    n = len(picks_urut)
    tuntas = jml["TARGET TERCAPAI"] + jml["INVALID"]
    baris = "\n".join(
        f'''<div class="c-row"><span class="c-tk">{p["ticker"]}</span>
        <span class="c-lbl">pick {tgl_id(p["tgl_pick"])} @ {fmt(p["harga_pick"])} · target {
            fmt(p["target"]) if p["target"] is not None else "—"}</span>
        <span class="c-skor" style="font-size:8pt;font-weight:700">{p["hasil"]["vonis"]}</span></div>'''
        for p in picks_urut[:MAKS_SAMPUL])
    sisa = (f'<div class="c-row"><span class="c-tk"></span><span class="c-lbl">'
            f'+{n - MAKS_SAMPUL} pick lainnya di halaman scorecard</span><span class="c-skor"></span></div>'
            if n > MAKS_SAMPUL else "")
    # var(--ink) + color-mix, bukan #fff/rgba(255,255,255,x) hardcode — Monthly
    # permukaannya TERANG (krem), teks putih di atas --brand terang jadi tak
    # terbaca; var(--ink) otomatis kontras benar di kedua arah tema.
    return f'''
<div class="page" style="background:var(--brand);color:var(--ink)">
  <div style="padding:22mm 20mm 0;flex:1;display:flex;flex-direction:column">
    <div style="border-bottom:1px solid color-mix(in srgb, var(--ink) 35%, transparent);padding-bottom:6mm">
      <div style="font-size:8pt;letter-spacing:.3em;text-transform:uppercase;color:color-mix(in srgb, var(--ink) 70%, transparent)">
        Scorecard &amp; Rekap — Edisi Bulanan</div>
      <div style="font-family:var(--disp);font-size:46pt;font-weight:700;line-height:1.05;margin-top:4mm">
        ARUS PASAR</div>
    </div>
    <div style="margin-top:8mm;font-size:13pt">{ed["tanggal_id"]}</div>
    <div style="font-family:var(--mono);font-size:9pt;color:color-mix(in srgb, var(--ink) 75%, transparent);margin-top:1.5mm">
      {ed["edisi"]} · {n} pick unik · {total_muncul} kemunculan harian</div>
    <div style="margin-top:10mm;display:flex;gap:6mm;font-variant-numeric:tabular-nums">
      <div style="background:color-mix(in srgb, var(--ink) 8%, transparent);padding:4mm 5mm;flex:1">
        <div style="font-size:6.3pt;letter-spacing:.16em;text-transform:uppercase;color:color-mix(in srgb, var(--ink) 60%, transparent)">Target Tercapai</div>
        <div style="font-size:20pt;font-weight:800">{jml["TARGET TERCAPAI"]}<small style="font-size:9pt;color:color-mix(in srgb, var(--ink) 60%, transparent)"> / {n}</small></div></div>
      <div style="background:color-mix(in srgb, var(--ink) 8%, transparent);padding:4mm 5mm;flex:1">
        <div style="font-size:6.3pt;letter-spacing:.16em;text-transform:uppercase;color:color-mix(in srgb, var(--ink) 60%, transparent)">Kena Invalidation</div>
        <div style="font-size:20pt;font-weight:800">{jml["INVALID"]}<small style="font-size:9pt;color:color-mix(in srgb, var(--ink) 60%, transparent)"> / {n}</small></div></div>
      <div style="background:color-mix(in srgb, var(--ink) 8%, transparent);padding:4mm 5mm;flex:1">
        <div style="font-size:6.3pt;letter-spacing:.16em;text-transform:uppercase;color:color-mix(in srgb, var(--ink) 60%, transparent)">Berjalan · Tanpa Data</div>
        <div style="font-size:20pt;font-weight:800">{jml["BERJALAN"]}<small style="font-size:9pt;color:color-mix(in srgb, var(--ink) 60%, transparent)"> · {jml["TANPA DATA"]}</small></div></div>
    </div>
    <div style="margin-top:9mm">
      <div style="font-size:7pt;letter-spacing:.24em;text-transform:uppercase;color:color-mix(in srgb, var(--ink) 60%, transparent);
        border-bottom:1px solid color-mix(in srgb, var(--ink) 35%, transparent);padding-bottom:2mm;margin-bottom:3mm;
        display:flex;justify-content:space-between"><span>Pick Bulan Ini — vonis</span><span></span></div>
      <style>.c-row{{display:flex;align-items:baseline;gap:6mm;padding:2.4mm 0;
        border-bottom:1px solid color-mix(in srgb, var(--ink) 16%, transparent);font-variant-numeric:tabular-nums}}
        .c-tk{{font-size:12pt;font-weight:800;width:24mm}}
        .c-lbl{{flex:1;font-size:9pt;color:color-mix(in srgb, var(--ink) 85%, transparent)}}
        .c-skor{{font-size:14pt;font-weight:800}}</style>
      {baris}{sisa}
    </div>
    <div style="margin-top:auto;padding-bottom:16mm">
      <div style="font-size:7pt;color:color-mix(in srgb, var(--ink) 55%, transparent);margin-top:5mm;line-height:1.7">
        Tiap pick dievaluasi terhadap target &amp; invalidation yang ditulis di edisi pertamanya,
        memakai bar OHLC nyata sesudah tanggal pick — dari {tuntas} pick tuntas, kejadian kronologis
        pertama yang menang. Data yang tidak tersedia ditampilkan jujur sebagai TANPA DATA.<br>
        Analisis probabilistik, bukan ajakan transaksi. Data: TradingView &amp; Stockbit
       , Yahoo Finance.</div>
    </div>
  </div>
</div>'''


def halaman_scorecard(ed, potongan, hal, n_hal, n_unik):
    baris = []
    for p in potongan:
        h = p["hasil"]
        prog = prog_mingguan(p["riwayat"])
        prog_txt = " → ".join(f"{v:.0f}" for v in prog)
        sub = ""
        if h["tanggal"]:
            t = dt.date.fromisoformat(h["tanggal"])
            sub = f'<span class="vd-sub">{tgl_id(t)}</span>'
        elif h["catatan"]:
            sub = f'<span class="vd-sub">{h["catatan"]}</span>'
        hilo = (f'{fmt(h["hi"])} / {fmt(h["lo"])}' if h["hi"] is not None else "—")
        baris.append(f'''<tr><td class="tk">{p["ticker"]}</td>
        <td>{tgl_id(p["tgl_pick"])}</td>
        <td class="num">{fmt(p["harga_pick"])}</td>
        <td class="num">{fmt(p["target"]) if p["target"] is not None else "—"}</td>
        <td class="num">{fmt(p["inval"]) if p["inval"] is not None else "—"}</td>
        <td class="prog-cell">{prog_txt}</td>
        <td class="num">{hilo}</td>
        <td><span class="vd {KELAS_VONIS[h["vonis"]]}">{h["vonis"]}</span>{sub}</td></tr>''')
    lede = ("" if hal else f'''<p class="lede">{n_unik} pick unik sepanjang bulan, dievaluasi terhadap
    target dan invalidation yang ditulis di edisi PERTAMA pick tersebut. Target = angka pertama pada
    teks target; invalidation mengikuti aturan Close &lt; X. Hi/Lo dihitung dari bar OHLC sesudah
    tanggal pick; bila target dan invalidation tersentuh, yang kronologis lebih dulu menang.</p>''')
    sub_hal = f" ({hal + 1}/{n_hal})" if n_hal > 1 else ""
    return f'''
<div class="page">
  {band(ed, "Scorecard Bulanan")}
  <div class="inner">
    <div class="trow" style="margin-bottom:4mm"><div class="tk" style="font-size:14pt">Scorecard{sub_hal}</div>
      <div class="px" style="font-size:8pt;color:var(--mute)">{n_unik} pick unik</div></div>
    {lede}
    <table class="sc">
      <tr><th>Ticker</th><th>Pick</th><th>Harga</th><th>Target</th><th>Inval</th>
        <th>Skor / Minggu</th><th>Hi / Lo Sesudah</th><th>Vonis</th></tr>
      {"".join(baris)}
    </table>
  </div>
  {kaki(ed)}
</div>'''


def halaman_statistik(ed, picks, jml, total_muncul):
    n = len(picks)
    tuntas = jml["TARGET TERCAPAI"] + jml["INVALID"]
    hit = f'{jml["TARGET TERCAPAI"] / tuntas * 100:.0f}%' if tuntas else "—"
    inv = f'{jml["INVALID"] / tuntas * 100:.0f}%' if tuntas else "—"

    def rerata_awal(vonis):
        s = [p["riwayat"][0][1] for p in picks if p["hasil"]["vonis"] == vonis]
        return sum(s) / len(s) if s else None

    r_ok, r_bad = rerata_awal("TARGET TERCAPAI"), rerata_awal("INVALID")
    if r_ok is not None and r_bad is not None:
        arah = ("berkorelasi positif dengan keberhasilan" if r_ok > r_bad
                else "TIDAK berkorelasi positif dengan keberhasilan bulan ini")
        insight = (f"Rata-rata skor awal pick yang mencapai target {r_ok:.0f} vs {r_bad:.0f} "
                   f"pada pick yang invalid — skor tinggi {arah}.")
    else:
        insight = ("Belum cukup pick tuntas di kedua kelompok untuk menguji korelasi "
                   "skor terhadap hasil — evaluasi berlanjut bulan depan.")
    freq = sorted(picks, key=lambda p: (-len(p["riwayat"]), p["ticker"]))
    baris_freq = "\n".join(
        f'''<tr><td class="tk">{p["ticker"]}</td><td>{p["nama"].replace("PT ", "").replace(" Tbk.", "")}</td>
        <td class="num">{len(p["riwayat"])}×</td>
        <td><span class="vd {KELAS_VONIS[p["hasil"]["vonis"]]}">{p["hasil"]["vonis"]}</span></td></tr>'''
        for p in freq)
    sel = "".join(f'<div class="s"><div class="l">{l}</div><div class="v">{v}</div></div>'
                  for l, v in (("Pick Unik", n), ("Kemunculan", total_muncul),
                               ("Tercapai", jml["TARGET TERCAPAI"]), ("Invalid", jml["INVALID"]),
                               ("Berjalan", jml["BERJALAN"]), ("Tanpa Data", jml["TANPA DATA"])))
    return f'''
<div class="page">
  {band(ed, "Ringkasan Statistik Bulanan")}
  <div class="inner">
    <div class="trow" style="margin-bottom:4mm"><div class="tk" style="font-size:14pt">Statistik Bulanan</div>
      <div class="px" style="font-size:8pt;color:var(--mute)">akuntabilitas, bukan promosi</div></div>
    <div class="stats">{sel}</div>
    <div class="blok">
      <h3 class="rule">Hit Rate</h3>
      <p>Dari {tuntas} pick yang sudah tuntas (target tercapai atau invalid): <b>{hit}</b> mencapai
      target, <b>{inv}</b> kena invalidation. {jml["BERJALAN"]} pick masih berjalan dan
      {jml["TANPA DATA"]} tanpa data evaluasi — keduanya TIDAK dihitung dalam hit rate.</p>
    </div>
    <div class="blok">
      <h3 class="rule">Skor vs Hasil</h3>
      <p>{insight}</p>
    </div>
    <div class="blok">
      <h3 class="rule">Paling Sering Dibahas</h3>
      <table class="sc">
        <tr><th>Ticker</th><th>Emiten</th><th>Muncul</th><th>Vonis</th></tr>
        {baris_freq}
      </table>
    </div>
    <div class="blok integritas">
      <h3 class="rule">Catatan Integritas Data</h3>
      <p>{ed["catatan_verifikasi"]}</p>
    </div>
  </div>
  {kaki(ed)}
</div>'''


# ── Uji logika (jalankan: python build_monthly.py --self-test) ───────────────

def self_test():
    assert parse_harga("1.245 / 1.290 / 1.360") == 1245
    assert parse_harga("Close <1.110") == 1110
    assert parse_harga("Close < 1.150") == 1150
    assert parse_harga("565 / 575 / 600") == 565
    assert parse_harga("1.380–1.400") == 1380
    assert parse_harga("sideways dulu") is None
    assert parse_harga(None) is None

    bar = lambda d, h, l, c: {"d": d, "o": c, "h": h, "l": l, "c": c, "v": 0}
    bars = [bar("2026-08-01", 100, 90, 95), bar("2026-08-03", 120, 95, 110),
            bar("2026-08-04", 100, 70, 80)]
    v = vonis_pick(bars, "2026-08-01", 115, 85)
    assert (v["vonis"], v["tanggal"]) == ("TARGET TERCAPAI", "2026-08-03")
    assert (v["hi"], v["lo"]) == (120, 70)
    assert vonis_pick(bars, "2026-08-01", 130, 100)["vonis"] == "INVALID"      # close 80 < 100 duluan
    assert vonis_pick(bars, "2026-08-01", 118, 112)["vonis"] == "TARGET TERCAPAI"  # bar sama: high duluan
    assert vonis_pick(bars, "2026-08-01", 130, 60)["vonis"] == "BERJALAN"
    assert vonis_pick(bars, "2026-08-04", 115, 85)["vonis"] == "TANPA DATA"    # tak ada bar sesudah
    assert vonis_pick(bars, "2026-08-01", None, 85)["vonis"] == "TANPA DATA"   # target tak terparse
    assert vonis_pick(None, "2026-08-01", 115, 85)["vonis"] == "TANPA DATA"    # ticker tak di cache
    # kronologis: invalidation jatuh SEBELUM bar target
    bars2 = [bar("2026-08-01", 100, 90, 95), bar("2026-08-03", 100, 75, 80),
             bar("2026-08-04", 125, 100, 120)]
    assert vonis_pick(bars2, "2026-08-01", 115, 85)["vonis"] == "INVALID"
    print("self-test OK: parser + vonis (kronologi, bar-sama, tanpa-data)")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Perakit report bulanan Arus Pasar (scorecard)")
    ap.add_argument("bulan", nargs="?", help="bulan YYYY-MM")
    ap.add_argument("--dir-edisi", help="folder edisi alternatif (mis. edisi-uji); "
                                        "output otomatis ke keluaran-uji/")
    ap.add_argument("--tanpa-pdf", action="store_true")
    ap.add_argument("--self-test", action="store_true", help="uji logika parser & vonis lalu keluar")
    args = ap.parse_args()

    if args.self_test:
        self_test()
        return
    if not args.bulan:
        ap.error("argumen bulan (YYYY-MM) wajib kecuali --self-test")
    thn, bln = map(int, args.bulan.split("-"))

    dir_edisi = (Path(args.dir_edisi) if args.dir_edisi and Path(args.dir_edisi).is_absolute()
                 else AKAR / args.dir_edisi) if args.dir_edisi else AKAR / "edisi"
    dir_keluar = AKAR / ("keluaran-uji" if args.dir_edisi else "keluaran")

    # ── Muat edisi bulan itu ─────────────────────────────────────────────────
    edisi_list = []
    for f in sorted(dir_edisi.glob(f"{thn:04d}-{bln:02d}-*.json")):
        edisi_list.append((dt.date.fromisoformat(f.stem), json.loads(f.read_text(encoding="utf-8"))))
    if not edisi_list:
        raise SystemExit(f"Tidak ada edisi {thn:04d}-{bln:02d}-* di {dir_edisi}")

    # ── Cache OHLC: per-edisi (untuk skor) + terbaru di folder (untuk evaluasi)
    # ohlc.update mengganti seri per ticker utuh -> ticker memakai seri dari
    # cache TERBARU yang memuatnya; evaluasi vonis pakai seri itu.
    tanggal_set = {t.isoformat() for t, _ in edisi_list}
    # ponytail: exclude ohlc-bedah-<TICKER>.json — cache standalone Bedah itu
    # list bar SATU ticker (bukan dict {ticker: bars} per-tanggal), bikin
    # ohlc.update() di bawah meledak kalau ikut ke-glob (bug lama, ketemu
    # sambil kerja palet, sekalian dibetulkan — bukan bagian tugas warna).
    semua_cache = sorted(c for c in (AKAR / "cache").glob("ohlc-*.json")
                         if not c.stem.startswith("ohlc-bedah-"))
    ohlc = {}
    for c in semua_cache:
        if c.stem[5:] in tanggal_set or c == semua_cache[-1]:
            ohlc.update(json.loads(c.read_text(encoding="utf-8")))
    if "JKSE" not in ohlc:
        raise SystemExit("Tidak ada satu pun cache OHLC (JKSE hilang) — skor tak bisa dihitung")

    # ── Pick unik: identitas dari kemunculan PERTAMA, posisi dari TERAKHIR ───
    picks = {}
    for tgl, ed in edisi_list:
        for em in ed["emiten"]:
            sk = hitung_skor(em, ed, ohlc)
            p = picks.setdefault(em["ticker"], {
                "ticker": em["ticker"], "nama": em["nama"], "tgl_pick": tgl,
                "harga_pick": em["ohlc_hari"]["c"],
                "target": parse_harga(em["target"]), "inval": parse_harga(em["invalidation"]),
                "riwayat": []})
            p["riwayat"].append((tgl, sk["total"]))
            p["em_akhir"], p["sk_akhir"] = em, sk
    for p in picks.values():
        p["hasil"] = vonis_pick(ohlc.get(p["ticker"]), p["tgl_pick"].isoformat(),
                                p["target"], p["inval"])

    urutan_vonis = ["TARGET TERCAPAI", "BERJALAN", "INVALID", "TANPA DATA"]
    picks_urut = sorted(picks.values(),
                        key=lambda p: (urutan_vonis.index(p["hasil"]["vonis"]), p["tgl_pick"]))
    jml = {v: sum(1 for p in picks.values() if p["hasil"]["vonis"] == v) for v in urutan_vonis}
    total_muncul = sum(len(p["riwayat"]) for p in picks.values())

    # ── Identitas edisi bulanan ──────────────────────────────────────────────
    uji = any(ed["edisi"].startswith("UJI") for _, ed in edisi_list)
    kode = f"{'UJI-' if uji else ''}AP-M{bln:02d}{thn % 100:02d}-E01"
    ed_akhir = edisi_list[-1][1]
    skor_map = {tk: p["sk_akhir"] for tk, p in picks.items()}
    emiten_akhir = sorted((p["em_akhir"] for p in picks.values()),
                          key=lambda e: -skor_map[e["ticker"]]["total"])
    ed_bulanan = {
        "edisi": kode,
        "tanggal_id": f"Edisi Bulanan · {BULAN[bln]} {thn}",
        "tanggal_flow": ed_akhir["tanggal_flow"],
        "peran_broker": ed_akhir["peran_broker"],
        "emiten": emiten_akhir,
        "catatan_verifikasi": (f"Rekap {len(edisi_list)} edisi harian {BULAN[bln]} {thn}. "
                               f"Evaluasi scorecard memakai cache OHLC terbaru yang tersedia "
                               f"({semua_cache[-1].name}). " + ed_akhir["catatan_verifikasi"]),
    }

    # ── Rakit halaman (tanpa chart -> OHLC payload kosong, drawcalls kosong) ─
    pages = [palet.blok_tema(EDISI_PALET) + GAYA_EKSTRA
             + halaman_sampul_bulanan(ed_bulanan, picks_urut, jml, total_muncul)]
    potongan = [picks_urut[i:i + BARIS_SC] for i in range(0, len(picks_urut), BARIS_SC)]
    for i, pot in enumerate(potongan):
        pages.append(halaman_scorecard(ed_bulanan, pot, i, len(potongan), len(picks_urut)))
    pages.append(halaman_statistik(ed_bulanan, list(picks.values()), jml, total_muncul))
    pages.append(halaman_peringkat(ed_bulanan, skor_map))

    tpl = (AKAR / "template.html").read_text(encoding="utf-8")
    html = (tpl.replace("{{JUDUL}}", f"Arus Pasar Bulanan {kode}")
               .replace("/*PALET*/", palet.blok_css(EDISI_PALET))
               .replace("/*FONT*/", palet.blok_font())
               .replace("<!--PAGES-->", "\n".join(pages)))
    dir_keluar.mkdir(exist_ok=True)
    keluar = dir_keluar / f"{kode}.html"
    keluar.write_text(html, encoding="utf-8")
    tulis_meta(dir_keluar, kode, edisi_list[-1][0].isoformat(), ed_bulanan["tanggal_id"],
               f"Arus Pasar Bulanan — {BULAN[bln]} {thn}",
               [e["ticker"] for e in emiten_akhir])

    print(f"OK -> {keluar}")
    print(f"  {len(edisi_list)} edisi harian, {len(picks)} pick unik, {total_muncul} kemunculan")
    print(f"  scorecard: {jml['TARGET TERCAPAI']} tercapai / {jml['INVALID']} invalid / "
          f"{jml['BERJALAN']} berjalan / {jml['TANPA DATA']} tanpa data")
    for p in picks_urut:
        h = p["hasil"]
        det = h["tanggal"] or h["catatan"] or "-"
        print(f"  {p['ticker']}: pick {p['tgl_pick']} @ {p['harga_pick']:g} "
              f"tgt {p['target']} inv {p['inval']} -> {h['vonis']} ({det})")

    if not args.tanpa_pdf:
        render_pdf(keluar)


if __name__ == "__main__":
    main()
