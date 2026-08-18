"""Arus Pasar — perakit terbitan harian (gaya nota riset institusional).

Baca edisi/<tanggal>.json + cache/ohlc-<tanggal>.json, hitung skor model
(Technical 35 / Flow 30 / RR 20 / Liquidity 10 / IHSG sensitivity 5),
rakit HTML dari template.html, tulis ke keluaran/.

Pakai: python build.py 2026-08-10 [--tanpa-pdf]
Setelah HTML jadi, render juga ke keluaran/<edisi>.pdf via Playwright
(chromium headless; menunggu window.__chartsDone dari template).
--tanpa-pdf melewatkan langkah PDF.
"""
import json, sys, statistics
from pathlib import Path

import palet
import prob

AKAR = Path(__file__).parent
EDISI_PALET = "daily"  # Opsi A · Permukaan & Suhu — lihat palet.py


TERBILANG = {1: "Satu", 2: "Dua", 3: "Tiga", 4: "Empat", 5: "Lima", 6: "Enam",
             7: "Tujuh", 8: "Delapan", 9: "Sembilan", 10: "Sepuluh",
             11: "Sebelas", 12: "Dua belas"}


def ema_seri(seri, n):
    """EMA klasik dari daftar close penuh (pemanasan riwayat 2 tahun)."""
    k = 2 / (n + 1); e = seri[0]
    for x in seri[1:]:
        e = x * k + e * (1 - k)
    return e


def fmt(n, des=0):
    """Format angka gaya Indonesia: ribuan titik, desimal koma."""
    return f"{n:,.{des}f}".replace(",", "_").replace(".", ",").replace("_", ".")


def fmt_rp(juta):
    """Nilai dalam juta Rp -> '8,3B' / '921,7M' gaya Stockbit."""
    if abs(juta) >= 1000:
        return fmt(juta / 1000, 1) + "B"
    return fmt(juta, 1) + "M"


def fmt_lot(lot):
    return (fmt(lot / 1000, 1) + "K") if lot >= 1000 else fmt(lot)


# ── Skor model (METODOLOGI §7; bobot terbuka) ────────────────────────────────

def skor_teknikal(em):
    c = em["ohlc_hari"]["c"]; p = em["pivot"]; ema = em["ema50"]
    s = 0.0
    s += 12 if c > ema else 0
    s += 12 if c > p["P"] else 0
    if p["R1"] > p["P"]:
        s += 8 * max(0.0, min(1.0, (c - p["P"]) / (p["R1"] - p["P"])))
    rentang = (c - ema) / ema
    if rentang > 0.15:
        s -= min(7, (rentang - 0.15) * 60)
    return max(0.0, min(35.0, s))


def skor_flow(em, peran):
    b = sum(r[1] for r in em["beli"]); j = sum(r[1] for r in em["jual"])
    rasio = (b - j) / (b + j) if b + j else 0.0
    s = 15 + 15 * rasio
    b1, j1 = em["beli"][0][0], em["jual"][0][0]
    if b1 in peran["scalper"]: s -= 5
    if b1 in peran["ritel"]:   s -= 5
    if j1 in peran["ritel"]:   s += 3
    if em["jual"][0][1] + em["jual"][1][1] > em["beli"][0][1] + em["beli"][1][1]:
        s -= 5
    return max(0.0, min(30.0, s))


def skor_rr(em):
    c = em["ohlc_hari"]["c"]; p = em["pivot"]
    inval = float(em["invalidation"].replace("Close <", "").replace(".", ""))
    risiko = c - inval
    if risiko <= 0:
        return 0.0
    return max(0.0, min(20.0, (p["R2"] - c) / risiko * 9))


def skor_likuiditas(em):
    nilai_b = em["ohlc_hari"]["c"] * em["ohlc_hari"]["vol_juta"] / 1000
    for ambang, sk in ((50, 10), (20, 8), (5, 6), (1, 4)):
        if nilai_b >= ambang:
            return sk
    return 2


def skor_ihsg(tk, ohlc):
    def ret(seri):
        return [(seri[i]["c"] - seri[i-1]["c"]) / seri[i-1]["c"] for i in range(1, len(seri))]
    a, b = ret(ohlc[tk][-61:]), ret(ohlc["JKSE"][-61:])
    n = min(len(a), len(b)); a, b = a[-n:], b[-n:]
    try:
        korr = statistics.correlation(a, b)
    except statistics.StatisticsError:
        korr = 0.0
    return max(0.0, 5 - 4 * abs(korr - 0.3)), korr


def tingkat_risiko(total):
    if total >= 80: return "MENENGAH"
    if total >= 55: return "TINGGI"
    return "EKSTREM"


def sentimen(em):
    """Vonis sentimen halaman: 'bull' / 'side' / 'bear'.

    Dari field `arah` (nilai aktual di edisi: "bull"); kalau kosong, fallback
    kata pertama `label` (mis. "BULLISH — UJI PIVOT R1"). Selain bull/bear
    (sideways, netral, fluktuatif, dst) -> 'side' (amber).
    """
    kunci = (em.get("arah") or "").strip().lower() \
        or (em.get("label") or "").strip().lower()
    if kunci.startswith("bull"): return "bull"
    if kunci.startswith("bear"): return "bear"
    return "side"


# ── Halaman pembuka: level IHSG, sentimen terukur, kalimat angka ─────────────

def kalimat_angka(subjek, c, sup, res, des=0, des_l=0):
    """Headline otomatis: posisi close vs S/R terdekat (pembagi = level).

    'IHSG 6.301,77 bertahan 0,7% di atas support 6.259' — dipilih sisi yang
    jaraknya (dalam %) paling dekat. Angka di-bold untuk .hangka.
    """
    d_s = (c - sup) / sup * 100 if sup and sup < c else 9e9
    d_r = (res - c) / res * 100 if res and res > c else 9e9
    if d_s <= d_r:
        return (f'{subjek} <b>{fmt(c, des)}</b> bertahan <b>{fmt(d_s, 1)}%</b> '
                f'di atas support <b>{fmt(sup, des_l)}</b>')
    return (f'{subjek} <b>{fmt(c, des)}</b> tertahan <b>{fmt(d_r, 1)}%</b> '
            f'di bawah resistance <b>{fmt(res, des_l)}</b>')


def level_ihsg(ohlc, override=None):
    """S/R IHSG dihitung, bukan dikarang: pivot klasik bar terakhir
    (P=(H+L+C)/3; R1=2P−L; S1=2P−H; R2=P+(H−L); S2=P−(H−L)) digabung swing
    fractal (jendela ±2 bar, 120 bar terakhir). Kandidat per sisi diurut dari
    close, dedupe <0,35%, ambil dua terdekat. Override per kunci lewat
    edisi ihsg_view.level {s1,s2,r1,r2}."""
    seri = ohlc["JKSE"]; b = seri[-1]; c = b["c"]
    P = (b["h"] + b["l"] + b["c"]) / 3
    kand_s = [2 * P - b["h"], P - (b["h"] - b["l"])]
    kand_r = [2 * P - b["l"], P + (b["h"] - b["l"])]
    win = seri[-122:]
    for i in range(2, len(win) - 2):
        seg = win[i - 2:i + 3]
        if win[i]["h"] == max(x["h"] for x in seg): kand_r.append(win[i]["h"])
        if win[i]["l"] == min(x["l"] for x in seg): kand_s.append(win[i]["l"])

    def dua(kand, bawah):
        pool = sorted((x for x in kand if (x < c) == bawah), reverse=bawah)
        pilih = []
        for x in pool:
            if all(abs(x - y) / y > 0.0035 for y in pilih):
                pilih.append(x)
            if len(pilih) == 2:
                break
        return pilih + [None] * (2 - len(pilih))

    s, r = dua(kand_s, True), dua(kand_r, False)
    lv = {"s1": s[0], "s2": s[1], "r1": r[0], "r2": r[1], "p": P}
    lv.update({k: v for k, v in (override or {}).items() if v})
    return {k: round(v, 2) if v else v for k, v in lv.items()}


def muat_ds(tgl):
    """Baca ds_YYMMDD.json + hari bursa sebelumnya (urutan dari index.json)."""
    akar = AKAR.parent / "data-idx" / "json"
    stems = [d["stem"] for d in
             json.loads((akar / "index.json").read_text(encoding="utf-8"))["dates"]]
    stem = f"ds_{tgl[2:4]}{tgl[5:7]}{tgl[8:10]}"
    i = stems.index(stem)
    baca = lambda s: json.loads((akar / f"{s}.json").read_text(encoding="utf-8"))
    return baca(stem), baca(stems[i - 1])


def skor_sentimen(ds, ds_prev):
    """Komponen TERUKUR (clamp 0–10; formula dicetak di halaman):
    dunia  = 5 + 2,5 × rerata Δ% bursa dunia overnight (non-IDX)
    rupiah = 5 − 5 × Δ% USD/IDR harian
    asing  = 5 + 2,5 × (net foreign hari ini, Rp triliun)
    skor   = rerata tiga komponen (bisa dioverride analis di edisi)."""
    w = [x["d"] for x in ds["world"] if not x.get("is_idx")]
    d_w = sum(w) / len(w)
    d_u = (ds["usd_idr"] - ds_prev["usd_idr"]) / ds_prev["usd_idr"] * 100
    nf_t = ds["nf_today_idr"] / 1000
    kl = lambda v: max(0.0, min(10.0, v))
    s_w, s_u, s_n = kl(5 + 2.5 * d_w), kl(5 - 5 * d_u), kl(5 + 2.5 * nf_t)
    return {"dunia": (d_w, s_w), "rupiah": (d_u, s_u), "asing": (nf_t, s_n),
            "skor": round((s_w + s_u + s_n) / 3, 1)}


# ── Potongan HTML ────────────────────────────────────────────────────────────

def band(ed, eyebrow="Tinjauan Teknikal & Arus Dana Harian"):
    return f'''<header class="band">
    <div class="m"><h1>ARUS PASAR</h1><div class="sub">{eyebrow}</div></div>
    <div class="e">{ed["tanggal_id"]}<br><span class="kode">{ed["edisi"]}</span></div>
  </header>'''


def kaki(ed):
    return f'''<footer class="foot">
    <span class="kode">{ed["edisi"]}</span>
    <span>© {ed["tanggal_id"].split()[-1]} PAPAN — Pusat Analisa Pasar Nusantara · Analisis probabilistik, bukan ajakan transaksi.</span>
  </footer>'''


def baris_broker(rows, sisi, peran):
    cls = "bcode-b" if sisi == "b" else "bcode-s"
    out = []
    for kode, val, lot, avg in rows:
        tag = ""
        if kode in peran["ritel"]:     tag = '<span class="tag ritel">RITEL</span>'
        elif kode in peran["scalper"]: tag = '<span class="tag scalp">SCALP</span>'
        out.append(f'<tr><td class="{cls}">{kode}{tag}</td><td>{fmt_rp(val)}</td>'
                   f'<td>{fmt_lot(lot)}</td><td>{fmt(avg)}</td></tr>')
    return "\n".join(out)


def statistik_hari(em, ohlc):
    """Strip statistik: dihitung dari data, bukan dekorasi."""
    o = em["ohlc_hari"]; c = o["c"]
    vs_ema = (c - em["ema50"]) / em["ema50"] * 100
    nilai_b = c * o["vol_juta"] / 1000
    vol20 = [b["v"] for b in ohlc[em["ticker"]][-21:-1]]
    vs_vol = o["vol_juta"] * 1e6 / (sum(vol20) / len(vol20)) if vol20 else 0
    stats = [
        ("Rentang Hari", f'{fmt(o["l"])}–{fmt(o["h"])}'),
        ("EMA50", f'{fmt(em["ema50"])} <small>({f"{vs_ema:+.1f}".replace(".", ",")}%)</small>'),
        ("Pivot Harian", fmt(em["pivot"]["P"])),
        ("Volume", f'{fmt(o["vol_juta"],1)} jt <small>({fmt(vs_vol,1)}× rerata20)</small>'),
        ("Nilai Transaksi", f'≈ Rp{fmt(nilai_b,1)} miliar'),
    ]
    sel = "".join(f'<div class="s"><div class="l">{l}</div><div class="v">{v}</div></div>'
                  for l, v in stats)
    closes = [b["c"] for b in ohlc[em["ticker"]]]
    ema_txt = " · ".join(
        f'<b>{n}</b> {fmt(ema_seri(closes, n))}' for n in (20, 60, 100, 200))
    return (f'<div class="stats">{sel}</div>'
            f'<div class="emabar">EMA {ema_txt} <span class="ket">(50 di strip atas; '
            f'garis lengkap di chart)</span></div>')


def halaman_ihsg(ed, ohlc):
    """Technical View IHSG: chart 6 bulan + level terhitung + blok naratif.

    Mengembalikan (html, garis_chart) — None kalau edisi tak punya ihsg_view
    (edisi lama tetap terakit)."""
    iv = ed.get("ihsg_view")
    if not iv:
        return None, None
    lv = level_ihsg(ohlc, iv.get("level"))
    c = ohlc["JKSE"][-1]["c"]
    judul = kalimat_angka("IHSG", c, lv["s1"], lv["r1"], des=2)
    label = [("Support krusial", lv["s1"], "c-bull"), ("Support lanjutan", lv["s2"], "c-bull"),
             ("Pivot harian", lv["p"], ""), ("Resistance rebound", lv["r1"], "c-bear"),
             ("Resistance utama", lv["r2"], "c-bear")]
    rows = "\n".join(
        f'<div class="r"><span class="l">{n}</span><b class="{cls}">{fmt(v)}</b></div>'
        for n, v, cls in label if v)
    garis = {"R2": lv["r2"], "R1": lv["r1"], "P": lv["p"], "S1": lv["s1"], "S2": lv["s2"]}
    garis = {k: v for k, v in garis.items() if v}
    html = f'''
<div class="page">
  {band(ed, "Technical View IHSG")}
  <div class="inner">
    <div class="hangka">{judul}</div>
    <div class="chartwrap">
      <div class="cap">IHSG · Harian · 6 Bulan · EMA 20/50/60/100/200 · Pivot &amp; Swing</div>
      <canvas id="chIHSG" width="1360" height="500"></canvas>
    </div>
    <div class="blok4">
      <div class="b4"><h3 class="rule">Daily View</h3><p>{iv["naratif"]}</p></div>
      <div class="b4"><h3 class="rule">Level Penting <span class="r">pivot &amp; swing — dihitung</span></h3>
        <div class="lvl">{rows}</div></div>
      <div class="b4"><h3 class="rule">Skenario Utama</h3><p>{iv["skenario"]}</p></div>
      <div class="b4 ksmp"><h3 class="rule">Kesimpulan</h3><p>{iv["kesimpulan"]}</p></div>
    </div>
  </div>
  {kaki(ed)}
</div>'''
    return html, garis


def halaman_sentimen(ed, ds, ds_prev):
    """Sentimen Global & Domestik: skor terukur + 4 poin analis + kesimpulan.
    None kalau edisi tak punya field sentimen (halaman dilewati)."""
    st = ed.get("sentimen")
    if not st:
        return None
    k = skor_sentimen(ds, ds_prev)
    skor = st.get("skor") or k["skor"]
    cls = "c-bull" if skor >= 6.5 else "c-side" if skor >= 4.5 else "c-bear"
    sel_bar = "".join(f'<i class="{"isi" if i < round(skor) else ""}"></i>' for i in range(10))
    tanda = lambda v: ("+" if v >= 0 else "−") + fmt(abs(v), 2)
    komp = [
        ("Bursa Dunia Overnight", f'{tanda(k["dunia"][0])}%', k["dunia"][1],
         f'rerata Δ% {len([1 for x in ds["world"] if not x.get("is_idx")])} indeks'),
        ("Rupiah (USD/IDR)", f'{fmt(ds["usd_idr"])} ({tanda(k["rupiah"][0])}%)', k["rupiah"][1], "vs hari bursa sebelumnya"),
        ("Arus Asing Reguler", f'{tanda(k["asing"][0])} T', k["asing"][1], ds["nf_today_status"]),
    ]
    sel_komp = "\n".join(
        f'<div class="k"><div class="l">{n}</div><div class="v">{v}</div>'
        f'<div class="s">{ket} → {fmt(s, 1)}/10</div></div>' for n, v, s, ket in komp)
    poin = "\n".join(
        f'<div class="poin"><div class="no">{i + 1}</div>'
        f'<div><h4>{p["judul"]}</h4><p>{p["isi"]}</p></div></div>'
        for i, p in enumerate(st["poin"]))
    manual = "" if st.get("skor") is None else \
        f' · nilai akhir dioverride analis: {fmt(skor, 1)} (model: {fmt(k["skor"], 1)})'
    return f'''
<div class="page">
  {band(ed, "Sentimen Global &amp; Domestik")}
  <div class="inner">
    <div class="sent-head">
      <div class="sent-skor {cls}"><span class="l">Skor Sentimen</span>{fmt(skor, 1)}<small>/10</small></div>
      <div class="sent-bar {cls}">{sel_bar}</div>
    </div>
    <div class="sent-komp">
      {sel_komp}
    </div>
    <div class="formula">Formula: skor = rerata(dunia, rupiah, asing) · dunia = 5 + 2,5 ×
    rerata Δ% bursa dunia · rupiah = 5 − 5 × Δ% USD/IDR · asing = 5 + 2,5 × (NF hari, Rp T)
    · tiap komponen dibatasi 0–10{manual}</div>
    <h3 class="rule">Empat Hal yang Menggerakkan Pasar</h3>
    <div class="poin-grid">
      {poin}
    </div>
    <div class="sent-ksmp"><h3 class="rule">Kesimpulan</h3><p>{st["kesimpulan"]}</p></div>
  </div>
  {kaki(ed)}
</div>'''


def fmt_z(z):
    return ("z+" if z >= 0 else "z−") + fmt(abs(z), 1)


def sel_prob(h):
    """Sel kolom Prob tabel Ringkasan: '62% · n134' font kecil."""
    if not h or h["p5"] is None:
        return "—"
    cat = f'n{h["n"]}' + ("" if h["cocok"] == 4 else f' · {h["cocok"]}/4')
    return f'{h["p5"] * 100:.0f}%<br><small>{cat}</small>'


def strip_prob(h):
    """Strip 1 baris PROBABILITAS HISTORIS halaman emiten (dekat skor komposit).

    Semua angka dari backtest pool cache edisi; n SELALU tampil. h None =
    riwayat ticker terlalu pendek (fallback aman edisi lama / emiten baru)."""
    if not h or h["p5"] is None:
        isi = "riwayat harga belum cukup untuk backtest setup — belum ada angka"
    else:
        cocok = "4/4" if h["cocok"] == 4 else f'{h["cocok"]}/4 fitur'
        vv = h["volval"]
        if vv is None:
            vv_txt = "VolVal n/a"
        elif vv["sinyal"]:
            vv_txt = f'VolVal <span class="vv">AKUM. SENYAP</span> {fmt_z(vv["z"])}'
        else:
            vv_txt = f'VolVal {fmt_z(vv["z"])} normal'
        hit = (f' <small>· senyap {h["vv_hit"] * 100:.0f}% n{h["vv_n"]}</small>'
               if h["vv_hit"] is not None else "")
        isi = (f'P(naik 5h) <b>{h["p5"] * 100:.0f}%</b> · P(≥3%) '
               f'<b>{h["p3"] * 100:.0f}%</b> <small>n{h["n"]}·{cocok}</small> · '
               f'{vv_txt}{hit}')
    return (f'<div class="probstrip"><span class="pl">Probabilitas Historis</span>'
            f'{isi}</div>')


def peta_skenario(em):
    """Dict skenario lengkap (bull/retest/invalid/aturan) untuk satu emiten.

    Field edisi `skenario` MENANG per kunci; kunci yang tak diisi dirakit dari
    target/invalidation/pivot/strategi. Dipisah dari kartu_skenario() supaya
    perakit lain (build_bedah.hal_skenario) memakai fallback yang sama —
    sebelum ini ia membaca sk["retest"]/sk["invalid"] langsung dan meledak
    KeyError untuk emiten yang edisinya menulis skenario bull/bear saja
    (mis. ARCI 14 Agu).
    """
    p = em["pivot"]; c = em["ohlc_hari"]["c"]
    sk = {
        "bull": {"konfirmasi": f'Close &gt;{fmt(p["R1"])} dengan volume di atas rerata 20 hari',
                 "rute": f'{em["target"]} (R1 → R2 → R3)',
                 "risiko": f'Gagal bertahan di atas {fmt(p["R1"])} = breakout palsu, kembali netral'},
        "retest": {"konfirmasi": f'Bertahan di {fmt(p["S1"])}–{fmt(c)} lalu rebut kembali pivot {fmt(p["P"])}',
                   "rute": f'Basis di atas {fmt(p["S1"])}; reclaim {fmt(p["P"])} lalu uji {fmt(p["R1"])}',
                   "risiko": f'{em["invalidation"]} membatalkan skenario konstruktif'},
        "invalid": {"konfirmasi": f'{em["invalidation"]} (S1 patah)',
                    "rute": f'Terbuka jalan ke {fmt(p["S2"])}–{fmt(p["S3"])}',
                    "risiko": 'Pantulan tanpa volume rawan jebakan; tunggu basis baru terbentuk'},
        "aturan": em["strategi"],
    }
    for k, v in (em.get("skenario") or {}).items():
        sk[k] = v

    def krt(kunci, judul, cls):
        d = sk[kunci]
        return (f'<div class="kartu {cls}"><div class="kt">{judul}</div>'
                f'<div class="kr"><span class="kl">Konfirmasi</span><span>{d["konfirmasi"]}</span></div>'
                f'<div class="kr"><span class="kl">Rute</span><span>{d["rute"]}</span></div>'
                f'<div class="kr"><span class="kl">Risiko</span><span>{d["risiko"]}</span></div></div>')

    return (f'<div class="skn">{krt("bull", "Konfirmasi Bullish", "b")}'
            f'{krt("retest", "Retest Konstruktif", "t")}'
            f'{krt("invalid", "Risk-off / Invalidasi", "r")}'
            f'<div class="aturan"><span class="kl">Aturan Eksekusi</span><span>{sk["aturan"]}</span></div></div>')


def halaman_emiten(em, sk, ed, ohlc, idx, pr=None, alias=None):
    o = em["ohlc_hari"]; p = em["pivot"]
    # Kredit kontributor BERDAMPINGAN dengan kode emiten (permintaan user 17
    # Agu: "dimunculkan di samping nama emiten si kontributor nya"). Sumber
    # utamanya ruas `kontributor` di edisi; berkas kredit-<EDISI>.json hanya
    # menimpa kalau ada. Kecil & redup: pengakuan, bukan perebut perhatian.
    penyetor = alias or em.get("kontributor")
    kredit_tk = (f'<span class="tk-kredit">setoran <b>{penyetor}</b></span>'
                 if penyetor else "")
    chg_cls = "bull" if o["chg"] >= 0 else "bear"
    tanda = "+" if o["chg"] >= 0 else "−"
    kata = em["label"].split("—")[0].strip()
    sisa = em["label"][len(kata):]
    net = sum(r[1] for r in em["beli"]) - sum(r[1] for r in em["jual"])
    net_cls = "bull" if net >= 0 else "bear"
    net_txt = ("+" if net >= 0 else "−") + "Rp" + fmt_rp(abs(net)).replace("B", " miliar").replace("M", " juta")
    tb = sum(r[1] for r in em["beli"]); tj = sum(r[1] for r in em["jual"])
    sup = " <span>|</span> ".join(fmt(p[k]) for k in ("P", "S1", "S2", "S3"))
    res = " <span>|</span> ".join(fmt(p[k]) for k in ("R1", "R2", "R3"))
    ragu = (f' <span class="ragu">verifikasi: {", ".join(em["pivot_ragu"])}</span>'
            if em["pivot_ragu"] else "")
    segmen = "".join(
        f'<i style="flex:{b}"></i><i class="sisa" style="flex:{mx - b:.1f}"></i>'
        for b, mx in ((sk["teknikal"], 35), (sk["flow"], 30), (sk["rr"], 20),
                      (sk["lik"], 10), (sk["ihsg"], 5)))
    c = o["c"]
    sup_dekat = max((v for v in p.values() if v < c), default=None)
    res_dekat = min((v for v in p.values() if v > c), default=None)
    headline = kalimat_angka(f'Harga {em["ticker"]}', c, sup_dekat, res_dekat)
    return f'''
<div class="page s-{sentimen(em)}">
  <span class="senti-edge"></span>
  {band(ed)}
  <div class="inner">
    <div class="trow">
      <div class="tk">${em["ticker"]}<small>{em["nama"]}</small>{kredit_tk}</div>
      <div class="px"><span class="h">{fmt(o["c"])}</span><br>
        <span class="c {chg_cls}">{tanda}{fmt(abs(o["chg"]))} ({tanda}{fmt(abs(o["pct"]),2)}%)</span></div>
    </div>
    <div class="hangka em">{headline}</div>
    {statistik_hari(em, ohlc)}
    <div class="chartwrap">
      <div class="cap">IDX · Harian · 1 Tahun · EMA 20/50/60/100/200 · Volume &amp; Pivot</div>
      <canvas id="ch{idx}" width="1360" height="320"></canvas>
    </div>
    <div class="cols">
      <aside>
        <h3 class="rule">Arus Broker <span class="r">{ed["tanggal_flow"]} · Net</span></h3>
        <div class="meter"><i style="left:{em["slider_pct"]}%"></i></div>
        <div class="meterlbl"><span>Big Dist</span><span>Netral</span><span>Big Acc</span></div>
        <table class="brk">
          <tr><th>BY</th><th>Nilai</th><th>Lot</th><th>Avg</th></tr>
          {baris_broker(em["beli"], "b", ed["peran_broker"])}
          <tr class="sep"><td colspan="4">Jual Terbesar</td></tr>
          {baris_broker(em["jual"], "s", ed["peran_broker"])}
          <tr class="tot"><td>NET</td><td colspan="3" class="{net_cls}">{net_txt}
            <small style="color:var(--mute);font-weight:400"> (B {fmt_rp(tb)} · S {fmt_rp(tj)})</small></td></tr>
        </table>
        <div class="brksrc">Sumber: Broker Summary Stockbit{
          f' — setoran {penyetor}, hak cipta setoran ada padanya' if penyetor else ""}.
          Peran broker: RITEL &amp; SCALP mengubah tafsir angka, bukan sekadar label.</div>
      </aside>
      <section style="display:flex;flex-direction:column;min-height:0">
        <div class="bias">
          <div class="lbl"><span class="{em["arah"]}">{kata}</span>{sisa}</div>
          <div class="risk {sk["risiko"]}">Risiko {sk["risiko"]}</div>
        </div>
        <div class="sec">
          <h3 class="rule">Arus Dana</h3>
          <p class="flowline"><span class="kw">{em["flow_kelas"]}</span> · <span class="{net_cls}">≈ {net_txt}</span> (top-10)</p>
          <p>{em["narasi_flow"]}</p>
        </div>
        <div class="sec">
          <h3 class="rule">Teknikal</h3>
          <p>{em["narasi_teknikal"]}</p>
        </div>
        <div class="sr">
          <div class="k sup">Support</div><div class="v">{sup}{ragu}</div>
          <div class="k res">Resistance</div><div class="v">{res}</div>
        </div>
        {peta_skenario(em)}
        {strip_prob(pr)}
        <div class="skor">
          <div class="head"><span class="t">Skor Komposit</span><span class="n">{sk["total"]:.0f}<small style="font-size:7pt;color:var(--mute)">/100</small></span></div>
          <div class="barrow">{segmen}</div>
          <div class="leg"><span>Teknikal {sk["teknikal"]:.0f}/35</span><span>Flow {sk["flow"]:.0f}/30</span>
            <span>R/R {sk["rr"]:.0f}/20</span><span>Likuiditas {sk["lik"]}/10</span><span>IHSG {sk["ihsg"]:.0f}/5</span></div>
        </div>
      </section>
    </div>
  </div>
  {kaki(ed)}
</div>'''


MAKS_SAMPUL = 28  # >28 emiten (14/kolom): sampul tampilkan teratas per skor


def halaman_sampul(ed, skor_map):
    urut = sorted(ed["emiten"], key=lambda e: -skor_map[e["ticker"]]["total"])
    n = len(urut)
    jml = {"bull": 0, "side": 0, "bear": 0}
    for e in urut:
        jml[sentimen(e)] += 1
    padat = n > 10  # 11-20: daftar 2 kolom + label pendek; ≤10: 1 kolom label penuh
    # (keputusan user 13 Agu: pakai 1 kolom selama muat — halaman sampul masih
    #  lega sampai ±10 baris; 2 kolom hanya kalau benar-benar tidak cukup)
    tampil = urut[:MAKS_SAMPUL]

    def lbl(e):
        t = e["label"]
        if padat and "—" in t:  # warna dot sudah mewakili arah — buang kata vonis
            t = t.split("—", 1)[1]
        return t.strip().title()

    baris = []
    for e in tampil:
        s = sentimen(e)
        baris.append(
            f'<div class="cvrow"><span class="dot" style="background:var(--{s})"></span>'
            f'<span class="tkk">{e["ticker"]}</span><span class="lb">{lbl(e)}</span>'
            f'<span class="sk c-{s}">{skor_map[e["ticker"]]["total"]:.0f}</span></div>')
    if n > MAKS_SAMPUL:
        baris.append(
            f'<div class="cvrow"><span class="dot" style="background:var(--mute)"></span>'
            f'<span class="lb">+{n - MAKS_SAMPUL} emiten lain — lihat Ringkasan</span></div>')

    if padat:
        kepala = f'''<div class="wm-big kecil">ARUS PASAR</div>
    <div class="cv-tag">Lantai Bursa · Edisi Harian · {n} emiten</div>
    <div class="cv-kode">{ed["edisi"]}</div>'''
    else:
        kepala = f'''<div class="wm-big">ARUS<br>PASAR</div>
    <div class="cv-tag">Lantai Bursa · Edisi Harian</div>
    <div class="cv-tgl">{ed["tanggal_id"]}</div>
    <div class="cv-kode">{ed["edisi"]} · {n} emiten</div>'''

    return f'''
<div class="page cover">
  <header class="band">
    <div class="m"><div class="sub">Tinjauan Teknikal &amp; Arus Dana Harian</div>
      <div class="byline">oleh Johan Iriawan Akbar · PAPAN</div></div>
    <div class="e">{ed["tanggal_id"]}<br><span class="kode">{ed["edisi"]}</span></div>
  </header>
  <div class="inner">
    {kepala}
    <div class="senti-sum">
      <div class="b sb-bull"><span class="n">{jml["bull"]}</span><span class="l">Bullish</span></div>
      <div class="b sb-side"><span class="n">{jml["side"]}</span><span class="l">Sideways</span></div>
      <div class="b sb-bear"><span class="n">{jml["bear"]}</span><span class="l">Bearish</span></div>
    </div>
    <div class="cv-list{" padat" if padat else ""}">
      {chr(10).join(baris)}
    </div>
    <div class="cv-foot">
      <div class="cv-stats">
        <span><span class="l">IHSG</span><b>{ed["ihsg"]["nilai"]}</b> <span class="c-{ed["ihsg"]["cls"]}">{ed["ihsg"]["pct"]}</span></span>
        <span><span class="l">{ed["nf"]["label"]}</span><b class="c-{ed["nf"]["cls"]}">{ed["nf"]["nilai"]}</b> {ed["nf"]["ket"]}</span>
      </div>
      <div class="cv-legal">© {ed["tanggal_id"].split()[-1]} PAPAN — Pusat Analisa Pasar Nusantara. Hak cipta dilindungi.<br>
      Analisis probabilistik, bukan ajakan transaksi.<br>
      Data: TradingView &amp; Stockbit.</div>
    </div>
  </div>
</div>'''


def halaman_ringkasan(ed, skor_map, prob_map=None):
    urut = sorted(ed["emiten"], key=lambda e: -skor_map[e["ticker"]]["total"])
    baris = []
    for e in urut:
        s = sentimen(e)
        kata = e["label"].split("—")[0].strip()
        sisa = e["label"][len(kata):].lstrip(" —")
        baris.append(
            f'''<tr><td class="tk">{e["ticker"]}</td><td>{e["nama"].replace("PT ","").replace(" Tbk.","")}</td>
        <td class="num">{fmt(e["ohlc_hari"]["c"])}</td>
        <td class="num {'bull' if e["ohlc_hari"]["chg"]>=0 else 'bear'}">{'+' if e["ohlc_hari"]["chg"]>=0 else '−'}{fmt(abs(e["ohlc_hari"]["pct"]),2)}%</td>
        <td><span class="pill {s}">{kata}</span><br><span class="lbl-sisa">{sisa}</span></td>
        <td class="num prob">{sel_prob((prob_map or {}).get(e["ticker"]))}</td>
        <td class="num c-{s}">{skor_map[e["ticker"]]["total"]:.0f}</td>
        <td><span class="risk {skor_map[e["ticker"]]["risiko"]}">{skor_map[e["ticker"]]["risiko"]}</span></td></tr>''')
    n = len(ed["emiten"])
    lede = f'''<p class="lede">{TERBILANG.get(n, n)} emiten dibedah dengan kerangka yang sama: struktur harga terhadap EMA50
    dan Pivot Points, kualitas arus dana broker (siapa yang membeli — bukan hanya berapa),
    rasio risk/reward, likuiditas, dan sensitivitas terhadap IHSG.</p>'''
    penutup = f'''<div class="ihsgbar">
      <span><span class="l">IHSG</span><b>{ed["ihsg"]["nilai"]}</b> <span class="{ed["ihsg"]["cls"]}">{ed["ihsg"]["pct"]}</span></span>
      <span><span class="l">{ed["nf"]["label"]}</span><b class="{ed["nf"]["cls"]}">{ed["nf"]["nilai"]}</b> {ed["nf"]["ket"]}</span>
      <span><span class="l">Konteks</span>{ed["konteks"]}</span>
    </div>
    <h3 class="rule">Metodologi</h3>
    <p class="metode"><b>Skor komposit 0–100:</b> Technical 35% · Big Money Flow 30% · Risk/reward 20% ·
    Liquidity 10% · IHSG sensitivity 5%. Pemetaan risiko: ≥80 Menengah · 55–79 Tinggi · &lt;55 Ekstrem.</p>
    <p class="metode"><b>Sumber data:</b> statistik resmi IDX; pivot &amp; EMA dihitung dari data
    harga; arus broker dari Broker Summary Stockbit. Komponen data yang tidak tersedia tidak
    pernah diisi perkiraan — halaman terkait akan menampilkan penanda kesenjangan data dan skor
    diberi penalti. Peringkat bersifat komparatif antar emiten edisi ini, bukan sinyal beli otomatis.</p>
    <p class="metode"><b>Kolom Prob 5h:</b> probabilitas historis close 5 hari ke depan lebih tinggi,
    dari backtest setup serupa (posisi vs EMA50, pivot harian, rasio volume 20 hari, posisi di
    rentang 20 hari) atas seluruh seri harga emiten edisi ini; n = jumlah sampel setup serupa.
    Label "k/4" berarti pencocokan dilonggarkan ke k fitur karena sampel penuh &lt;30.</p>'''
    kepala_tabel = ('<tr><th>Ticker</th><th>Emiten</th><th>Close</th><th>±%</th><th>Bias</th>'
                    '<th>Prob 5h</th><th>Skor</th><th>Risiko</th></tr>')

    # Paginasi: baris .ring 2-lajur tinggi — edisi gemuk (>10) tembus footer
    # kalau dipaksa 1 halaman. Kapasitas konservatif: hal-1 (dengan lede,
    # tanpa penutup) 13 baris; sambungan 15; hal terakhir (bawa ihsgbar +
    # metodologi) maks 9. Edisi ≤10 tetap persis 1 halaman seperti dulu.
    # Angka diturunkan satu takik 17 Agu: kapasitas lama menyisakan sisa
    # beberapa milimeter yang menabrak kaki halaman di PDF (tak terlihat di
    # HTML karena halaman layar boleh memanjang).
    if n <= 10:
        potongan = [baris]
    else:
        potongan, sisa = [baris[:13]], baris[13:]
        while len(sisa) > 9:
            potongan.append(sisa[:15]); sisa = sisa[15:]
        potongan.append(sisa)

    halaman = []
    for i, chunk in enumerate(potongan):
        awal = i == 0
        akhir = i == len(potongan) - 1
        sub = f"{n} emiten" if len(potongan) == 1 else f"{n} emiten · bagian {i+1}/{len(potongan)}"
        halaman.append(f'''
<div class="page">
  {band(ed, "Ringkasan Edisi")}
  <div class="inner">
    <div class="trow" style="margin-bottom:4mm"><div class="tk" style="font-size:14pt">Ringkasan Edisi</div>
      <div class="px" style="font-size:8pt;color:var(--mute)">{sub}</div></div>
    {lede if awal else ""}
    <table class="ring">
      {kepala_tabel}
      {chr(10).join(chunk)}
    </table>
    {penutup if akhir else ""}
  </div>
  {kaki(ed)}
</div>''')
    return "".join(halaman)


def muat_kredit(edisi):
    """Berkas opsional masuk/kredit-<EDISI>.json: {"developer": str,
    "kontributor": {TICKER: alias}} — alias penyetor orderbook yang setorannya
    sudah disetujui, per emiten edisi ini. Dipakai kolofon + badge kartu
    emiten. None kalau berkas tak ada/rusak -> fallback nama hardcode lama,
    build TIDAK PERNAH gagal gara-gara berkas ini."""
    p = AKAR / "masuk" / f"kredit-{edisi}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def halaman_kolofon(ed, kredit=None):
    """Halaman penutup terbitan: monogram + wordmark PAPAN, peran Developer
    (utama) & Analisa/Penyusun (kedua) — keduanya Johan Iriawan Akbar — lalu
    kontributor. Nama penyetor diambil dari ruas `kontributor` tiap emiten di
    edisi — berkas kredit terpisah hanya menimpa kalau ada: alias unik +
    jumlah emiten yang disetornya, urut kontribusi terbanyak. Edisi tanpa
    ruas itu tetap terbit dengan daftar nama lama."""
    kontrib = (kredit or {}).get("kontributor") or {}
    cnt = {}
    for em in ed["emiten"]:
        alias = kontrib.get(em["ticker"]) or em.get("kontributor")
        if alias:
            cnt[alias] = cnt.get(alias, 0) + 1
    if cnt:
        urut = sorted(cnt.items(), key=lambda kv: -kv[1])
        judul_kontrib = "Kontributor Edisi Ini <span class=\"kf-hak\">pemilik hak cipta setoran masing-masing</span>"
        sel = "\n".join(
            f'<div class="kf-nama"><span>{alias}</span><span class="kf-jml">{n} emiten</span></div>'
            for alias, n in urut)
    else:
        nama_lama = ["Agitama Wahyu Putra Dita", "Mohamad Miftahul Ulum", "Ali Supian",
                     "Wardani W.", "Dhafina S. F.", "Erika J.", "Difla S.", "Ratu N. A. A."]
        judul_kontrib = "Pengembangan, Ide, Gagasan &amp; Dukungan"
        sel = "\n".join(f'<div class="kf-nama"><span>{n}</span></div>' for n in nama_lama)
    tahun = ed["tanggal_id"].split()[-1]
    return f'''
<div class="page">
  {band(ed, "Kolofon")}
  <div class="inner kolofon">
    <div class="kf-monogram">P</div>
    <div class="kf-judul">PAPAN</div>
    <div class="kf-merek">Pusat Analisa Pasar Nusantara</div>
    <div class="kf-blok">
      <div class="kf-peran">Developer</div>
      <div class="kf-utama">Johan Iriawan Akbar</div>
      <div class="kf-peran-dua">Analisa &amp; Penyusun</div>
    </div>
    <hr class="kf-garis">
    <div class="kf-blok">
      <div class="kf-peran">{judul_kontrib}</div>
      <div class="kf-grid">
{sel}
      </div>
    </div>
    <div class="kf-kaki">© {tahun} PAPAN — Pusat Analisa Pasar Nusantara. Hak cipta dilindungi.<br>
    Hak cipta setiap setoran Broker Summary tetap pada kontributor yang menyetorkannya;
    PAPAN memuatnya atas izin mereka dan mencantumkan namanya di halaman emiten terkait.<br>
    Terbitan Arus Pasar disusun untuk edukasi analisa pasar, bukan ajakan transaksi.</div>
  </div>
</div>'''


def halaman_peringkat(ed, skor_map):
    urut = sorted(ed["emiten"], key=lambda e: -skor_map[e["ticker"]]["total"])
    atas, bawah = urut[0], urut[-1]
    sk_atas = skor_map[atas["ticker"]]
    komponen = {"struktur teknikal": sk_atas["teknikal"] / 35, "arus dana": sk_atas["flow"] / 30,
                "rasio risk/reward": sk_atas["rr"] / 20}
    pendorong = max(komponen, key=komponen.get)
    lemah = min(komponen, key=komponen.get)
    baris = [
        f'''<tr><td>{i+1}</td><td class="tk">{e["ticker"]}</td>
        <td class="total">{skor_map[e["ticker"]]["total"]:.0f}</td>
        <td>{skor_map[e["ticker"]]["teknikal"]:.0f}</td><td>{skor_map[e["ticker"]]["flow"]:.0f}</td>
        <td>{skor_map[e["ticker"]]["rr"]:.0f}</td><td>{skor_map[e["ticker"]]["lik"]}</td>
        <td>{skor_map[e["ticker"]]["ihsg"]:.0f}</td>
        <td style="text-align:left;padding-left:5mm">{e["rationale_rank"]}</td>
        <td><span class="risk {skor_map[e["ticker"]]["risiko"]}">{skor_map[e["ticker"]]["risiko"]}</span></td></tr>'''
        for i, e in enumerate(urut)]
    lede = f'''<p class="lede">{atas["ticker"]} mencetak skor tertinggi ({sk_atas["total"]:.0f}) — pendorong
    utamanya {pendorong}, dengan catatan {lemah} bukan kekuatannya. {bawah["ticker"]} di posisi
    akhir: {bawah["rationale_rank"].lower()}.</p>'''
    penutup = f'''<div class="blok">
      <h3 class="rule">Model</h3>
      <p>Technical 35% · Big Money Flow 30% · Risk/reward 20% · Liquidity 10% · IHSG sensitivity 5%.
      Komponen ditampilkan terbuka di tabel — skor bisa diaudit, bukan kotak hitam.</p>
    </div>
    <div class="blok">
      <h3 class="rule">Eksekusi</h3>
      <p>Prioritaskan emiten yang menahan support atau merebut resistance dengan volume.
      Tidak ada konfirmasi berarti tidak ada ukuran agresif. Peringkat bersifat komparatif
      antar {len(urut)} emiten edisi ini — bukan sinyal beli otomatis.</p>
    </div>
    <div class="blok integritas">
      <h3 class="rule">Catatan Integritas Data</h3>
      <p>{ed["catatan_verifikasi"]}</p>
    </div>'''
    kepala_tabel = '''<tr><th>#</th><th>Ticker</th><th>Skor</th><th>Tek/35</th><th>Flow/30</th><th>R:R/20</th>
        <th>Lik/10</th><th>IHSG/5</th><th style="text-align:left;padding-left:5mm">Rationale</th><th>Risiko</th></tr>'''

    # Paginasi (pola sama halaman_ringkasan): edisi >11 tembus footer di 1
    # halaman. Hal-1 (lede) 11 baris; sambungan 14; hal terakhir bawa blok
    # Model/Eksekusi/Integritas maks 9. Edisi ≤11 tetap 1 halaman.
    # Angka lama (16/20/12) dihitung dari rationale satu baris; kenyataannya
    # kebanyakan rationale memakan dua sampai tiga baris, sehingga halaman
    # pertama edisi 20 emiten meluber ±31 mm dan menimpa kaki halaman.
    n = len(urut)
    if n <= 11:
        potongan = [baris]
    else:
        potongan, sisa = [baris[:11]], baris[11:]
        while len(sisa) > 9:
            potongan.append(sisa[:14]); sisa = sisa[14:]
        potongan.append(sisa)

    halaman = []
    for i, chunk in enumerate(potongan):
        awal = i == 0
        akhir = i == len(potongan) - 1
        sub = "Risk-adjusted · komparatif" if len(potongan) == 1 else f"Risk-adjusted · komparatif · bagian {i+1}/{len(potongan)}"
        halaman.append(f'''
<div class="page">
  {band(ed, "Quant Opportunity Ranking")}
  <div class="inner">
    <div class="trow" style="margin-bottom:4mm"><div class="tk" style="font-size:14pt">Peringkat Peluang</div>
      <div class="px" style="font-size:8pt;color:var(--mute)">{sub}</div></div>
    {lede if awal else ""}
    <table class="rank">
      {kepala_tabel}
      {chr(10).join(chunk)}
    </table>
    {penutup if akhir else ""}
  </div>
  {kaki(ed)}
</div>''')
    return "".join(halaman)


def render_pdf(html_path):
    """Render HTML -> PDF (chromium headless, tunggu chart canvas + font)."""
    from playwright.sync_api import sync_playwright
    pdf_path = html_path.with_suffix(".pdf")
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page()
        page.goto(html_path.resolve().as_uri())
        page.wait_for_function("window.__chartsDone === true")
        # Font DITUNGGU terpisah (#127). Chromium mencetak begitu diperintah,
        # tak peduli @font-face masih di-decode: hasilnya PDF berisi Segoe UI
        # padahal halaman yang sama di layar sudah memakai Red Hat — gagal
        # yang tak memberi satu pun pesan galat.
        page.wait_for_function("document.fonts.status === 'loaded'")
        page.pdf(path=str(pdf_path), format="A4", print_background=True,
                 margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                 prefer_css_page_size=True)
        b.close()
    print(f"OK -> {pdf_path} ({pdf_path.stat().st_size // 1024} KB)")


def tulis_meta(dir_keluar, kode, tanggal, tanggal_id, judul, emiten):
    """Sidecar <kode>.meta.json untuk terbitan yang TIDAK punya berkas edisi/.

    generate_index.py membangun manifest dari edisi/*.json, jadi terbitan
    turunan (mingguan AP-W*, bulanan AP-M*) tak pernah muncul di halaman
    Bulletin — tidak ada berkas edisi yang mewakilinya. Sidecar ini mengisi
    lubang itu tanpa menaruh berkas palsu di edisi/: nama di sana berpola
    tanggal, jadi edisi mingguan akan bentrok dengan edisi harian tanggal sama.

    Tanpa medan "tipe" — dasbor menurunkannya dari prefiks kode (AP-W/AP-M),
    lihat tipeEdisi() di Bulletin.tsx.
    """
    (dir_keluar / f"{kode}.meta.json").write_text(json.dumps({
        "kode": kode, "tanggal": tanggal, "tanggal_id": tanggal_id,
        "judul": judul, "emiten": emiten, "pdf": f"{kode}.pdf",
    }, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    tgl = args[0] if args else "2026-08-10"
    ed = json.loads((AKAR / "edisi" / f"{tgl}.json").read_text(encoding="utf-8"))

    # #138 — emiten yang DIKELUARKAN dari edisi ini. Bukan penolakan data:
    # setorannya tetap 'disetujui' dan kreditnya tetap milik kontributor
    # (kolom `setoran.dimuat` di Supabase). Daftarnya dibawa lewat argumen,
    # bukan dibaca langsung dari DB, supaya perakitan tetap bisa jalan tanpa
    # kredensial — layar Kurasi menyalinnya lewat "Salin daftar masuk edisi".
    kecuali = set()
    for a in sys.argv[1:]:
        if a.startswith("--kecuali="):
            kecuali = {t.strip().upper() for t in a.split("=", 1)[1].split(",") if t.strip()}
    if kecuali:
        semula = len(ed["emiten"])
        ed["emiten"] = [em for em in ed["emiten"] if em["ticker"].upper() not in kecuali]
        print(f"  #138: {semula - len(ed['emiten'])} emiten dikeluarkan ({', '.join(sorted(kecuali))})")
        if not ed["emiten"]:
            sys.exit("Semua emiten dikeluarkan — tidak ada yang bisa dirakit.")
    ohlc = json.loads((AKAR / "cache" / f"ohlc-{tgl}.json").read_text(encoding="utf-8"))

    prob_map = prob.analisa_edisi(ohlc, [em["ticker"] for em in ed["emiten"]])
    kredit = muat_kredit(ed["edisi"])
    kontrib_map = (kredit or {}).get("kontributor") or {}

    skor_map = {}
    for em in ed["emiten"]:
        t = skor_teknikal(em); f_ = skor_flow(em, ed["peran_broker"])
        r = skor_rr(em); l = skor_likuiditas(em)
        i, korr = skor_ihsg(em["ticker"], ohlc)
        total = t + f_ + r + l + i
        skor_map[em["ticker"]] = {"teknikal": t, "flow": f_, "rr": r, "lik": l,
                                  "ihsg": i, "korr": korr, "total": total,
                                  "risiko": tingkat_risiko(total)}

    # Sidecar analitik utk dashboard (permintaan user 14 Agu: kolom Probabilitas
    # di TABEL bulletin web, bukan cuma PDF) — generate_index.py menempelkannya
    # ke entri edisi di keluaran/index.json.
    sidecar = []
    for em in ed["emiten"]:
        sk = skor_map[em["ticker"]]
        pr = prob_map.get(em["ticker"])
        vv = pr.get("volval") if pr else None
        sidecar.append({
            "ticker": em["ticker"], "label": em["label"], "arah": em["arah"],
            "close": em["ohlc_hari"]["c"], "pct": em["ohlc_hari"]["pct"],
            "skor": round(sk["total"]), "risiko": sk["risiko"],
            "p5": pr["p5"] if pr else None, "p3": pr["p3"] if pr else None,
            "n": pr["n"] if pr else None, "cocok": pr["cocok"] if pr else None,
            "vv_z": round(vv["z"], 2) if vv else None,
            "vv_sinyal": bool(vv and vv["sinyal"]),
        })
    (AKAR / "keluaran" / f"{ed['edisi']}.analisa.json").write_text(
        json.dumps(sidecar, ensure_ascii=False), encoding="utf-8")

    pages = [palet.blok_tema(EDISI_PALET) + halaman_sampul(ed, skor_map)]
    draw = []
    # dua halaman pembuka baru — keduanya opsional (edisi lama tetap terakit)
    hal_ihsg, garis_ihsg = halaman_ihsg(ed, ohlc)
    if hal_ihsg:
        pages.append(hal_ihsg)
        draw.append(f'gambarChart("chIHSG","JKSE",0,{json.dumps(garis_ihsg)},126);')
    if ed.get("sentimen"):
        ds, ds_prev = muat_ds(tgl)
        pages.append(halaman_sentimen(ed, ds, ds_prev))
    pages.append(halaman_ringkasan(ed, skor_map, prob_map))
    for idx, em in enumerate(ed["emiten"]):
        pages.append(halaman_emiten(em, skor_map[em["ticker"]], ed, ohlc, idx,
                                    prob_map.get(em["ticker"]), kontrib_map.get(em["ticker"])))
        draw.append(f'gambarChart("ch{idx}","{em["ticker"]}",{em["ema50"]},'
                    f'{json.dumps(em["pivot"])});')
    pages.append(halaman_peringkat(ed, skor_map))
    pages.append(halaman_kolofon(ed, kredit))

    tpl = (AKAR / "template.html").read_text(encoding="utf-8")
    # 2 thn penuh (pemanasan EMA200 di gambarChart); JKSE dipakai chart IHSG
    ohlc_kecil = {k: v[-505:] for k, v in ohlc.items()
                  if k != "JKSE" or hal_ihsg}
    html = (tpl.replace("{{JUDUL}}", f"Arus Pasar {ed['edisi']}")
               .replace("/*PALET*/", palet.blok_css(EDISI_PALET))
               .replace("/*FONT*/", palet.blok_font())
               .replace("<!--PAGES-->", "\n".join(pages))
               .replace("/*OHLC*/{}", json.dumps(ohlc_kecil, separators=(",", ":")))
               .replace("/*DRAWCALLS*/", "\n".join(draw)))
    keluar = AKAR / "keluaran" / f"{ed['edisi']}.html"
    keluar.write_text(html, encoding="utf-8")

    print(f"OK -> {keluar}")
    for tk, s in skor_map.items():
        print(f"  {tk}: total {s['total']:.1f} ({s['risiko']})")

    if "--tanpa-pdf" not in sys.argv:
        render_pdf(keluar)


if __name__ == "__main__":
    main()
