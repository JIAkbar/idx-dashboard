"""Arus Pasar — perakit bulletin MINGGUAN (gabungan edisi harian).

Baca semua edisi/<tanggal>.json dalam rentang minggu + cache/ohlc-<tanggal>.json
masing-masing, hitung ulang skor per emiten per hari (impor fungsi skor dari
build.py — satu sumber rumus), dedupe per ticker (kemunculan TERAKHIR jadi
posisi terkini) dengan progresi skor lintas hari.

Struktur: sampul mingguan -> Pola Sepekan (agregat SELURUH kemunculan: broker
berulang, net kumulatif, konsistensi arah, persistensi) -> ringkasan ranking
semua emiten unik (dipecah beberapa halaman kalau >14 baris) -> detail per
emiten (reuse halaman_emiten build.py + strip progresi) -> peringkat/metodologi
(reuse halaman_peringkat).

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
from build import (AKAR, fmt, fmt_rp, halaman_emiten, halaman_peringkat, band, kaki,
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
    return " -> ".join(f"{HARI[t.weekday()]} {total:.0f}" for t, total in hist)


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


# ── Pola Sepekan — agregat SELURUH kemunculan, bukan hari terakhir ───────────
# Dedupe "kemunculan terakhir menang" di main() membuang blok beli/jual tiap
# hari sebelumnya; halaman ini yang memakainya. Semua angka di sini berasal
# dari ruas edisi harian (`emiten[].beli` / `.jual`), tak ada sumber lain.
BROKER_TOP = 8       # 8 teratas tiap sisi (permintaan)
NET_ATAS, NET_BAWAH = 10, 5
POLA_BARIS = 8       # ponytail: tinggi baris dipatok, jumlah baris dibatasi
                     # supaya halaman ini tak pernah meluber walau sepekan penuh


def kumpulkan_pola(edisi_list):
    """Ringkas seluruh emiten-hari dalam rentang.

    sisi["beli"][kode] = [berapa emiten-hari, total nilai juta Rp]
    net_em[ticker]     = [net juta Rp kumulatif, n hari, n hari net+, n hari net−]
    """
    sisi = {"beli": {}, "jual": {}}
    net_em, n_eh = {}, 0
    for _tgl, ed in edisi_list:
        for em in ed["emiten"]:
            n_eh += 1
            for s in ("beli", "jual"):
                for baris in em[s]:          # [kode, nilai juta, lot, avg]
                    a = sisi[s].setdefault(baris[0], [0, 0.0])
                    a[0] += 1; a[1] += baris[1]
            net = sum(r[1] for r in em["beli"]) - sum(r[1] for r in em["jual"])
            e = net_em.setdefault(em["ticker"], [0.0, 0, 0, 0])
            e[0] += net; e[1] += 1
            e[2 if net >= 0 else 3] += 1
    return sisi, net_em, n_eh


def rp_net(juta):
    return ("+" if juta >= 0 else "−") + "Rp" + fmt_rp(abs(juta))


def periksa_pola():
    """Uji mandiri kumpulkan_pola: `py -3.14 build_weekly.py --periksa`."""
    def em(tk, beli, jual):
        return {"ticker": tk, "beli": beli, "jual": jual}
    palsu = [
        (dt.date(2026, 8, 10), {"emiten": [em("AAA", [["LG", 100, 0, 0]], [["XL", 40, 0, 0]]),
                                           em("BBB", [["LG", 10, 0, 0]], [["CC", 90, 0, 0]])]}),
        (dt.date(2026, 8, 11), {"emiten": [em("AAA", [["LG", 60, 0, 0]], [["CC", 20, 0, 0]])]}),
    ]
    sisi, net_em, n_eh = kumpulkan_pola(palsu)
    assert n_eh == 3, n_eh
    assert sisi["beli"]["LG"] == [3, 170.0], sisi["beli"]["LG"]
    assert sisi["jual"]["CC"] == [2, 110.0], sisi["jual"]["CC"]
    assert net_em["AAA"] == [100.0, 2, 2, 0], net_em["AAA"]   # 60 + 40, dua hari searah +
    assert net_em["BBB"] == [-80.0, 1, 0, 1], net_em["BBB"]   # muncul sekali: bukan pola
    print("periksa_pola OK")


def _baris_broker_pekan(sisi, s, n_eh):
    urut = sorted(sisi[s].items(), key=lambda kv: (-kv[1][0], -kv[1][1]))[:BROKER_TOP]
    return "\n".join(
        f'<tr><td class="k">{kode}</td>'
        f'<td class="n">{m}<span class="sub">/{n_eh}</span></td>'
        f'<td class="n">{fmt_rp(v)}</td></tr>' for kode, (m, v) in urut)


POLA_CSS = '''<style>
/* Tinggi baris dan lebar kolom DIPATOK (colgroup + height tetap): isi yang
   menentukan ukuran adalah cara dua cacat tata letak terakhir lahir. */
table.pola{width:100%;border-collapse:collapse;table-layout:fixed;
  font-size:7.8pt;font-variant-numeric:tabular-nums}
table.pola th{height:5mm;font-size:5.8pt;color:var(--mute);text-transform:uppercase;
  letter-spacing:.12em;font-weight:700;text-align:left;padding:0 2mm 1mm 0;
  border-bottom:1px solid var(--hair);white-space:nowrap}
table.pola td{height:5.4mm;padding:0 2mm 0 0;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;border-bottom:1px solid color-mix(in srgb, var(--ink) 5%, transparent)}
/* Kolom angka rata-kanan WAJIB berjarak kiri: tanpa padding-left, "0" dan
   "SEARAH +" saling menempel jadi "0SEARAH" (terlihat hanya di PDF). */
table.pola th.n,table.pola td.n{text-align:right;padding:0 0 0 3mm}
table.pola td.nol{color:var(--mute)}
table.pola td.k{font-family:var(--mono);font-weight:800;font-size:8.6pt}
table.pola td.n{font-family:var(--mono);font-weight:700}
table.pola td .sub{font-weight:400;color:var(--mute);font-size:6.4pt}
table.pola tr.sela td{height:3.4mm;font-size:5.8pt;letter-spacing:.14em;
  text-transform:uppercase;color:var(--mute);border-bottom:1px solid var(--hair);
  padding-top:1.6mm;vertical-align:bottom}
.pola-h{font-size:6.6pt;letter-spacing:.18em;text-transform:uppercase;font-weight:700;
  color:var(--ink2);margin:0 0 1.8mm}
.pola-h span{letter-spacing:0;text-transform:none;font-weight:400;color:var(--mute)}
.pola-grid{display:grid;grid-template-columns:1fr 1fr;gap:7mm 9mm;align-items:start}
.pola-note{font-size:6.5pt;color:var(--mute);line-height:1.55;margin:1.8mm 0 0}
.pola-kosong{font-size:7.4pt;color:var(--mute);line-height:1.5;margin:0}
.pola-tag{font-family:var(--mono);font-size:6.4pt;font-weight:700;letter-spacing:.06em}
</style>'''


def halaman_pola_sepekan(ed, edisi_list, riwayat, skor_map, n_unik):
    sisi, net_em, n_eh = kumpulkan_pola(edisi_list)
    n_hari = len(edisi_list)

    # ── 2. Net kumulatif per emiten (SEMUA hari ia muncul) ───────────────────
    urut_net = sorted(net_em.items(), key=lambda kv: -kv[1][0])
    atas = urut_net[:NET_ATAS]
    bawah = urut_net[max(NET_ATAS, len(urut_net) - NET_BAWAH):]

    def brs_net(pasangan):
        return "\n".join(
            f'<tr><td class="k">{tk}</td>'
            f'<td class="n">{v[1]}<span class="sub">/{n_hari}</span></td>'
            f'<td class="n {"bull" if v[0] >= 0 else "bear"}">{rp_net(v[0])}</td></tr>'
            for tk, v in pasangan)

    # ── 3. Konsistensi arah — hanya emiten yang muncul >=2 hari ───────────────
    ulang = [(tk, v) for tk, v in net_em.items() if v[1] >= 2]
    searah = lambda v: v[2] == 0 or v[3] == 0
    ulang.sort(key=lambda kv: (not searah(kv[1]), -kv[1][1], -abs(kv[1][0])))
    n_searah = sum(1 for _, v in ulang if searah(v))
    if ulang:
        brs_kons = "\n".join(
            f'<tr><td class="k">{tk}</td><td class="n">{v[1]}</td>'
            f'<td class="n {"bull" if v[2] else "nol"}">{v[2]}</td>'
            f'<td class="n {"bear" if v[3] else "nol"}">{v[3]}</td>'
            f'<td class="{"bull" if searah(v) and v[3] == 0 else "bear" if searah(v) else ""}" style="padding-left:3mm">'
            f'<span class="pola-tag">{"SEARAH +" if searah(v) and v[3] == 0 else "SEARAH −" if searah(v) else "campur"}</span></td></tr>'
            for tk, v in ulang[:POLA_BARIS])
        blok_kons = f'''<table class="pola">
      <colgroup><col style="width:15mm"><col style="width:11mm"><col style="width:12mm"><col style="width:12mm"><col></colgroup>
      <tr><th>Ticker</th><th class="n">Hari</th><th class="n">Net +</th><th class="n">Net −</th>
        <th style="padding-left:3mm">Arah</th></tr>
      {brs_kons}
    </table>
    <p class="pola-note">{n_searah} dari {len(ulang)} emiten berulang punya net searah di seluruh
    harinya. Sisanya berganti arah — netnya hasil saling hapus, bukan satu kecenderungan.
    {f"{len(ulang) - POLA_BARIS} baris lain tak dicetak." if len(ulang) > POLA_BARIS else ""}</p>'''
    else:
        blok_kons = ('<p class="pola-kosong">Tidak ada emiten yang muncul lebih dari sekali '
                     'dalam rentang ini, jadi konsistensi arah tak bisa diukur.</p>')

    # ── 4. Persistensi — muncul berapa hari dari berapa edisi ────────────────
    persis = sorted(net_em.items(), key=lambda kv: (-kv[1][1], -skor_map[kv[0]]["total"]))
    persis = [(tk, v) for tk, v in persis if v[1] >= 2][:POLA_BARIS]
    if persis:
        brs_persis = "\n".join(
            f'<tr><td class="k">{tk}</td>'
            f'<td class="n">{v[1]}<span class="sub">/{n_hari}</span></td>'
            f'<td style="padding-left:3mm;font-family:var(--mono);font-size:6.6pt;'
            f'color:var(--ink2)">{teks_progresi(riwayat[tk])}</td></tr>' for tk, v in persis)
        # Kolom "skor kini" sengaja tak ada: angka terakhir progresi sudah skor kini.
        blok_persis = f'''<table class="pola">
      <colgroup><col style="width:15mm"><col style="width:15mm"><col></colgroup>
      <tr><th>Ticker</th><th class="n">Muncul</th><th style="padding-left:3mm">Progresi Skor</th></tr>
      {brs_persis}
    </table>
    <p class="pola-note">Muncul berulang berarti emiten itu lolos penyaringan harian lebih dari
    sekali — bukan penilaian atas arah harganya. Skor tiap hari dihitung ulang dengan model
    harian yang sama.</p>'''
    else:
        blok_persis = ('<p class="pola-kosong">Setiap emiten hanya muncul sekali; tak ada '
                       'progresi skor lintas hari yang bisa ditampilkan.</p>')

    return f'''
<div class="page">
  {band(ed, "Pola Sepekan")}
  <div class="inner">
    <div class="trow" style="margin-bottom:3.5mm">
      <div class="tk" style="font-size:14pt">Pola Sepekan</div>
      <div class="px" style="font-size:8pt;color:var(--mute)">{n_hari} edisi harian ·
        {n_eh} emiten-hari · {n_unik} emiten unik</div>
    </div>
    <p class="lede" style="font-size:8.4pt;margin-bottom:4mm">Halaman ini dihitung dari
    <b>seluruh</b> kemunculan tiap emiten sepanjang rentang, bukan dari posisi hari terakhir.
    Yang terbaca di sini tak terbaca di satu pun edisi harian: broker mana yang berulang,
    emiten mana yang netnya menumpuk searah, dan mana yang cuma lewat sekali.</p>

    <div class="pola-h">1 · Broker paling sering muncul <span>— dari {n_eh} emiten-hari</span></div>
    <div class="pola-grid" style="gap:0 9mm">
      <div>
        <table class="pola">
          <colgroup><col style="width:16mm"><col style="width:22mm"><col></colgroup>
          <tr><th>Sisi Beli</th><th class="n">Emiten-hari</th><th class="n">Total Nilai</th></tr>
          {_baris_broker_pekan(sisi, "beli", n_eh)}
        </table>
      </div>
      <div>
        <table class="pola">
          <colgroup><col style="width:16mm"><col style="width:22mm"><col></colgroup>
          <tr><th>Sisi Jual</th><th class="n">Emiten-hari</th><th class="n">Total Nilai</th></tr>
          {_baris_broker_pekan(sisi, "jual", n_eh)}
        </table>
      </div>
    </div>
    <p class="pola-note">Batas data: tiap edisi harian hanya memuat <b>sepuluh broker terbesar</b>
    per sisi per emiten. Angka di atas adalah frekuensi masuk sepuluh besar — bukan seluruh
    aktivitas broker tersebut, dan bukan pula kepemilikan. Satu broker bisa aktif tanpa pernah
    masuk sepuluh besar.</p>

    <div class="pola-grid" style="margin-top:6mm">
      <div>
        <div class="pola-h">2 · Net kumulatif sepekan <span>— jumlah semua hari</span></div>
        <table class="pola">
          <colgroup><col style="width:16mm"><col style="width:15mm"><col></colgroup>
          <tr><th>Ticker</th><th class="n">Hari</th><th class="n">Net Kumulatif</th></tr>
          {brs_net(atas)}
          <tr class="sela"><td colspan="3">Net kumulatif terendah</td></tr>
          {brs_net(bawah)}
        </table>
        <p class="pola-note">Kolom Hari wajib dibaca bersama nilainya: net besar dari satu hari
        adalah peristiwa, net sedang yang berulang adalah pola. Nilai memakai top-10 broker saja.</p>
      </div>
      <div>
        <div class="pola-h">3 · Konsistensi arah <span>— emiten yang muncul >=2 hari</span></div>
        {blok_kons}
        <div class="pola-h" style="margin-top:6mm">4 · Emiten paling persisten</div>
        {blok_persis}
      </div>
    </div>
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
    pages = [palet.blok_tema(EDISI_PALET) + gaya_ekstra + POLA_CSS
             + halaman_sampul_mingguan(ed_mingguan, urut, skor_map, riwayat, total_muncul)]
    pages.append(halaman_pola_sepekan(ed_mingguan, edisi_list, riwayat, skor_map, len(urut)))
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
    import sys
    if "--periksa" in sys.argv:
        periksa_pola()
    else:
        main()
