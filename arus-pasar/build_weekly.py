"""Arus Pasar — perakit bulletin MINGGUAN (gabungan edisi harian).

Baca semua edisi/<tanggal>.json dalam rentang minggu + cache/ohlc-<tanggal>.json
masing-masing, hitung ulang skor per emiten per hari (impor fungsi skor dari
build.py — satu sumber rumus), dedupe per ticker (kemunculan TERAKHIR jadi
posisi terkini) dengan progresi skor lintas hari.

Struktur: sampul mingguan -> ringkasan ranking semua emiten unik (dipecah
beberapa halaman kalau >14 baris) -> detail per emiten (reuse halaman_emiten
build.py + strip progresi) -> peringkat/metodologi (reuse halaman_peringkat).

Kode edisi mingguan: AP-W<ddmmyy akhir rentang>-E01 — konsisten dengan pola
harian AP-<ddmmyy>-E01; huruf W menandai weekly. Kalau ada edisi sumber
bertanda UJI-, kode ikut berprefiks UJI- supaya keluaran uji tak menyamar
sebagai edisi asli.

Pakai:
  python build_weekly.py 2026-08-10 2026-08-14
  python build_weekly.py                      # default Senin-Jumat minggu ini
  python build_weekly.py ... --dir-edisi edisi-uji   # data uji -> keluaran-uji/
  python build_weekly.py ... --tanpa-pdf
"""
import argparse, datetime as dt, json
from pathlib import Path

import palet
from build import (AKAR, fmt, halaman_emiten, halaman_peringkat, band, kaki,
                   render_pdf, skor_teknikal, skor_flow, skor_rr,
                   skor_likuiditas, skor_ihsg, tingkat_risiko, tulis_meta)

EDISI_PALET = "weekly"  # Opsi A · Permukaan & Suhu — lihat palet.py
HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
BULAN = [None, "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
         "Agustus", "September", "Oktober", "November", "Desember"]
BARIS_PER_HAL = 14  # ponytail: pecah tabel ringkasan tiap 14 baris; muat aman di A4


def rentang_id(a, b):
    """'10–14 Agustus 2026' atau '28 Juli – 1 Agustus 2026'."""
    if (a.year, a.month) == (b.year, b.month):
        return f"{a.day}–{b.day} {BULAN[b.month]} {b.year}"
    kiri = f"{a.day} {BULAN[a.month]}" + ("" if a.year == b.year else f" {a.year}")
    return f"{kiri} – {b.day} {BULAN[b.month]} {b.year}"


def teks_progresi(hist):
    return " → ".join(f"{HARI[t.weekday()]} {total:.0f}" for t, total in hist)


def hitung_skor(em, ed, ohlc):
    t = skor_teknikal(em); f_ = skor_flow(em, ed["peran_broker"])
    r = skor_rr(em); l = skor_likuiditas(em)
    i, korr = skor_ihsg(em["ticker"], ohlc)
    total = t + f_ + r + l + i
    return {"teknikal": t, "flow": f_, "rr": r, "lik": l, "ihsg": i,
            "korr": korr, "total": total, "risiko": tingkat_risiko(total)}


MAKS_SAMPUL = 44  # dua lajur x 22 baris; lihat .c-list di sampul


def halaman_sampul_mingguan(ed, urut, skor_map, riwayat, total_muncul):
    # Sampul mingguan pekan 10–14 Agu memuat 41 emiten unik: seluruh daftar
    # dicetak apa adanya sehingga separuhnya jatuh di luar halaman bersama
    # baris IHSG dan hak ciptanya (temuan 17 Agu). Sampul memang bukan daftar
    # isi lengkap — itu tugas halaman Ringkasan Mingguan.
    tampil = urut[:MAKS_SAMPUL]
    isi = "\n".join(
        f'''<div class="c-row"><span class="c-tk">{em["ticker"]}</span>
        <span class="c-lbl">{em["label"]}<span class="c-prog">{
            teks_progresi(riwayat[em["ticker"]]) if len(riwayat[em["ticker"]]) > 1 else ""
        }</span></span>
        <span class="c-skor">{skor_map[em["ticker"]]["total"]:.0f}</span></div>'''
        for em in tampil)
    if len(urut) > MAKS_SAMPUL:
        isi += (f'''\n<div class="c-row"><span class="c-tk" style="font-size:9.5pt;font-weight:700">+{
            len(urut) - MAKS_SAMPUL}</span>
        <span class="c-lbl">emiten lain dengan skor lebih rendah — daftar penuh di Ringkasan Mingguan</span>
        <span class="c-skor"></span></div>''')
    # Teks sampul full-bleed pakai var(--ink) (bukan #fff hardcode) + color-mix
    # atas var(--ink) utk versi tembus pandang — supaya kontras BENAR di kedua
    # arah tema: --ink terang di atas --brand gelap (Weekly), --ink gelap di
    # atas --brand terang (kalau kelak terbitan lain pakai kepala sampul ini).
    return f'''
<div class="page" style="background:var(--brand);color:var(--ink)">
  <div style="padding:16mm 18mm 0;flex:1;display:flex;flex-direction:column">
    <div style="border-bottom:1px solid color-mix(in srgb, var(--ink) 35%, transparent);padding-bottom:6mm">
      <div style="font-size:8pt;letter-spacing:.3em;text-transform:uppercase;color:color-mix(in srgb, var(--ink) 70%, transparent)">
        Tinjauan Teknikal &amp; Arus Dana — Edisi Mingguan</div>
      <div style="font-family:var(--disp);font-size:46pt;font-weight:700;line-height:1.05;margin-top:4mm">
        ARUS PASAR</div>
    </div>
    <div style="margin-top:8mm;font-size:13pt">{ed["tanggal_id"]}</div>
    <div style="font-family:var(--mono);font-size:9pt;color:color-mix(in srgb, var(--ink) 75%, transparent);margin-top:1.5mm">
      {ed["edisi"]} · {len(urut)} emiten unik · {total_muncul} kemunculan harian</div>
    <div style="margin-top:7mm">
      <div style="font-size:7pt;letter-spacing:.24em;text-transform:uppercase;color:color-mix(in srgb, var(--ink) 60%, transparent);
        border-bottom:1px solid color-mix(in srgb, var(--ink) 35%, transparent);padding-bottom:2mm;margin-bottom:3mm;
        display:flex;justify-content:space-between"><span>Dalam Edisi Ini — posisi terkini</span><span>Skor</span></div>
      <style>
        /* Dua lajur. Satu lajur cuma memuat 15 baris, sehingga 43 emiten
           dipangkas jadi "+28 lainnya" dan sampulnya berhenti jadi daftar isi.
           Tinggi baris DIPATOK supaya baris ke-n di kedua lajur sejajar --
           tanpa itu label satu baris dan dua baris menggeser lajur kanan. */
        .c-list{{columns:2;column-gap:9mm}}
        .c-row{{display:flex;align-items:center;gap:3.5mm;padding:0;height:8.6mm;
        break-inside:avoid;border-bottom:1px solid color-mix(in srgb, var(--ink) 16%, transparent);
        font-variant-numeric:tabular-nums}}
        .c-tk{{font-size:10.5pt;font-weight:800;width:15mm;flex:none}}
        .c-lbl{{flex:1;min-width:0;font-size:7.4pt;line-height:1.3;
        color:color-mix(in srgb, var(--ink) 85%, transparent);
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
        .c-prog{{display:block;font-size:6pt;color:color-mix(in srgb, var(--ink) 55%, transparent);font-family:var(--mono)}}
        .c-skor{{font-size:10.5pt;font-weight:800;flex:none}}</style>
      <div class="c-list">{isi}</div>
      <div class="c-row"><span class="c-tk" style="font-size:9.5pt;font-weight:700">Peringkat</span>
        <span class="c-lbl">Quant Opportunity Ranking mingguan — komponen skor terbuka</span><span class="c-skor"></span></div>
    </div>
    <div style="margin-top:auto;padding-bottom:16mm">
      <div style="background:color-mix(in srgb, var(--ink) 8%, transparent);padding:4mm 5mm;font-size:9pt">{ed["ihsg_baris"]}</div>
      <div style="font-size:7pt;color:color-mix(in srgb, var(--ink) 55%, transparent);margin-top:5mm;line-height:1.7">
        Skor tiap emiten dihitung ulang per hari dengan model harian yang sama; emiten yang muncul
        di beberapa edisi ditampilkan sekali dengan progresi skornya.<br>
        © {ed["tanggal_id"].split()[-1]} PAPAN — Pusat Analisa Pasar Nusantara. Hak cipta dilindungi.<br>
        Analisis probabilistik, bukan ajakan transaksi. Data: TradingView &amp; Stockbit.</div>
    </div>
  </div>
</div>'''


def halaman_ringkasan_mingguan(ed, potongan, skor_map, riwayat, hal, n_hal, n_unik):
    baris = "\n".join(
        f'''<tr><td class="tk">{em["ticker"]}</td><td>{em["nama"].replace("PT ", "").replace(" Tbk.", "")}</td>
        <td class="num">{fmt(em["ohlc_hari"]["c"])}</td>
        <td class="num {'bull' if em["ohlc_hari"]["chg"] >= 0 else 'bear'}">{'+' if em["ohlc_hari"]["chg"] >= 0 else '−'}{fmt(abs(em["ohlc_hari"]["pct"]), 2)}%</td>
        <td>{em["label"]}</td>
        <td class="prog-cell">{teks_progresi(riwayat[em["ticker"]]) if len(riwayat[em["ticker"]]) > 1 else "—"}</td>
        <td class="num">{skor_map[em["ticker"]]["total"]:.0f}</td>
        <td><span class="risk {skor_map[em["ticker"]]["risiko"]}">{skor_map[em["ticker"]]["risiko"]}</span></td></tr>'''
        for em in potongan)
    lede = ('' if hal else f'''<p class="lede">{n_unik} emiten unik dari seluruh edisi harian pekan ini,
    diurutkan skor komposit terkini. Emiten yang muncul beberapa kali ditampilkan sekali —
    kolom progresi merekam pergerakan skornya lintas hari; data harga &amp; flow memakai
    kemunculan terakhirnya.</p>''')
    sub = f" ({hal + 1}/{n_hal})" if n_hal > 1 else ""
    return f'''
<div class="page">
  {band(ed, "Ringkasan Mingguan")}
  <div class="inner">
    <div class="trow" style="margin-bottom:4mm"><div class="tk" style="font-size:14pt">Ringkasan Mingguan{sub}</div>
      <div class="px" style="font-size:8pt;color:var(--mute)">{n_unik} emiten unik</div></div>
    {lede}
    <table class="ring">
      <tr><th>Ticker</th><th>Emiten</th><th>Close</th><th>±%</th><th>Bias</th><th>Progresi Skor</th><th>Skor</th><th>Risiko</th></tr>
      {baris}
    </table>
  </div>
  {kaki(ed)}
</div>'''


def main():
    ap = argparse.ArgumentParser(description="Perakit bulletin mingguan Arus Pasar")
    ap.add_argument("tanggal", nargs="*", help="awal [akhir] rentang, YYYY-MM-DD")
    ap.add_argument("--dir-edisi", help="folder edisi alternatif (mis. edisi-uji); "
                                        "output otomatis ke keluaran-uji/")
    ap.add_argument("--tanpa-pdf", action="store_true")
    args = ap.parse_args()

    if args.tanggal:
        awal = dt.date.fromisoformat(args.tanggal[0])
        akhir = dt.date.fromisoformat(args.tanggal[1]) if len(args.tanggal) > 1 else awal + dt.timedelta(4)
    else:
        senin = dt.date.today() - dt.timedelta(dt.date.today().weekday())
        awal, akhir = senin, senin + dt.timedelta(4)

    dir_edisi = (Path(args.dir_edisi) if args.dir_edisi and Path(args.dir_edisi).is_absolute()
                 else AKAR / args.dir_edisi) if args.dir_edisi else AKAR / "edisi"
    dir_keluar = AKAR / ("keluaran-uji" if args.dir_edisi else "keluaran")

    # ── Muat edisi + cache OHLC dalam rentang ────────────────────────────────
    edisi_list, ohlc = [], {}
    for n in range((akhir - awal).days + 1):
        tgl = awal + dt.timedelta(n)
        f = dir_edisi / f"{tgl.isoformat()}.json"
        if not f.exists():
            continue
        edisi_list.append((tgl, json.loads(f.read_text(encoding="utf-8"))))
        c = AKAR / "cache" / f"ohlc-{tgl.isoformat()}.json"
        if c.exists():
            # kemunculan terakhir menang: cache tanggal lebih baru menimpa per ticker
            ohlc.update(json.loads(c.read_text(encoding="utf-8")))
        else:
            print(f"  peringatan: {c.name} tidak ada — pakai cache gabungan tanggal lain")
    if not edisi_list:
        raise SystemExit(f"Tidak ada edisi di {dir_edisi} untuk rentang {awal}..{akhir}")
    if "JKSE" not in ohlc:
        raise SystemExit("Tidak ada satu pun cache OHLC (JKSE hilang) — skor tak bisa dihitung")

    # ── Skor per emiten per hari; dedupe: kemunculan terakhir = posisi terkini ─
    riwayat, terakhir = {}, {}   # ticker -> [(tanggal, total)], ticker -> (em, sk, ed_sumber)
    for tgl, ed in edisi_list:
        for em in ed["emiten"]:
            # ponytail: skor_ihsg pakai OHLC gabungan (korelasi 60 hari, beda antar-hari
            # dalam seminggu tak material); pakai cache per-tanggal kalau kelak perlu presisi
            sk = hitung_skor(em, ed, ohlc)
            riwayat.setdefault(em["ticker"], []).append((tgl, sk["total"]))
            terakhir[em["ticker"]] = (em, sk, ed)

    skor_map = {tk: sk for tk, (em, sk, ed) in terakhir.items()}
    urut = sorted((em for em, sk, ed in terakhir.values()),
                  key=lambda e: -skor_map[e["ticker"]]["total"])
    total_muncul = sum(len(h) for h in riwayat.values())

    uji = any(ed["edisi"].startswith("UJI") for _, ed in edisi_list)
    kode = f"{'UJI-' if uji else ''}AP-W{akhir.strftime('%d%m%y')}-E01"
    ed_akhir = edisi_list[-1][1]
    ed_mingguan = {
        "edisi": kode,
        "tanggal_id": f"Edisi Mingguan · {rentang_id(awal, akhir)}",
        "tanggal_flow": ed_akhir["tanggal_flow"],
        "peran_broker": ed_akhir["peran_broker"],
        "ihsg_baris": ed_akhir["ihsg_baris"],
        "emiten": urut,
        "catatan_verifikasi": (f"Gabungan {len(edisi_list)} edisi harian "
                               f"({rentang_id(awal, akhir)}). " + ed_akhir["catatan_verifikasi"]),
    }

    # ── Rakit halaman ────────────────────────────────────────────────────────
    gaya_ekstra = ('<style>.prog{border-left:3px solid var(--teal);padding:1.5mm 0 1.5mm 4mm;'
                   'margin-top:3mm;font-size:8pt;font-variant-numeric:tabular-nums}'
                   '.prog b{font-family:var(--mono);font-weight:700}'
                   '.prog .l{font-size:6.3pt;letter-spacing:.14em;text-transform:uppercase;'
                   'color:var(--mute);margin-right:3mm}'
                   'table.ring .prog-cell{font-family:var(--mono);font-size:7.4pt;'
                   'color:var(--ink2);white-space:nowrap}</style>')
    pages = [palet.blok_tema(EDISI_PALET) + gaya_ekstra
             + halaman_sampul_mingguan(ed_mingguan, urut, skor_map, riwayat, total_muncul)]
    potongan = [urut[i:i + BARIS_PER_HAL] for i in range(0, len(urut), BARIS_PER_HAL)]
    for i, pot in enumerate(potongan):
        pages.append(halaman_ringkasan_mingguan(ed_mingguan, pot, skor_map, riwayat,
                                                i, len(potongan), len(urut)))

    draw = []
    for idx, em in enumerate(urut):
        _, sk, ed_sumber = terakhir[em["ticker"]]
        # band halaman pakai identitas mingguan; tanggal_flow & peran_broker tetap dari edisi sumber
        ed_em = {**ed_sumber, "edisi": kode, "tanggal_id": ed_mingguan["tanggal_id"]}
        hal = halaman_emiten(em, sk, ed_em, ohlc, idx)
        hist = riwayat[em["ticker"]]
        if len(hist) > 1:
            strip = (f'<div class="prog"><span class="l">Progresi Skor Mingguan</span>'
                     f'<b>{teks_progresi(hist)}</b> · data halaman ini: kemunculan terakhir '
                     f'({HARI[hist[-1][0].weekday()]} {hist[-1][0].day} {BULAN[hist[-1][0].month]})</div>')
            # sisip strip di atas chart tanpa menyentuh build.py
            hal = hal.replace('<div class="chartwrap">', strip + '\n    <div class="chartwrap">', 1)
        pages.append(hal)
        draw.append(f'gambarChart("ch{idx}","{em["ticker"]}",{em["ema50"]},'
                    f'{json.dumps(em["pivot"])});')

    pages.append(halaman_peringkat(ed_mingguan, skor_map))

    tpl = (AKAR / "template.html").read_text(encoding="utf-8")
    ohlc_kecil = {k: v[-260:] for k, v in ohlc.items() if k != "JKSE"}
    html = (tpl.replace("{{JUDUL}}", f"Arus Pasar Mingguan {kode}")
               .replace("/*PALET*/", palet.blok_css(EDISI_PALET))
               .replace("/*FONT*/", palet.blok_font())
               .replace("<!--PAGES-->", "\n".join(pages))
               .replace("/*OHLC*/{}", json.dumps(ohlc_kecil, separators=(",", ":")))
               .replace("/*DRAWCALLS*/", "\n".join(draw)))
    dir_keluar.mkdir(exist_ok=True)
    keluar = dir_keluar / f"{kode}.html"
    keluar.write_text(html, encoding="utf-8")
    tulis_meta(dir_keluar, kode, akhir.isoformat(), ed_mingguan["tanggal_id"],
               f"Arus Pasar Mingguan — {rentang_id(awal, akhir)}",
               [em["ticker"] for em in urut])

    print(f"OK -> {keluar}")
    print(f"  {len(edisi_list)} edisi harian, {len(urut)} emiten unik, {total_muncul} kemunculan")
    for em in urut:
        tk = em["ticker"]
        prog = (f" [{teks_progresi(riwayat[tk])}]".replace("→", "->")
                if len(riwayat[tk]) > 1 else "")  # konsol Windows cp1252
        print(f"  {tk}: total {skor_map[tk]['total']:.1f} ({skor_map[tk]['risiko']}){prog}")

    if not args.tanpa_pdf:
        render_pdf(keluar)


if __name__ == "__main__":
    main()
