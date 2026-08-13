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

AKAR = Path(__file__).parent


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


# ── Potongan HTML ────────────────────────────────────────────────────────────

def band(ed, eyebrow="Tinjauan Teknikal & Arus Dana Harian"):
    return f'''<header class="band">
    <div class="m"><h1>ARUS PASAR</h1><div class="sub">{eyebrow}</div></div>
    <div class="e">{ed["tanggal_id"]}<br><span class="kode">{ed["edisi"]}</span></div>
  </header>'''


def kaki(ed):
    return f'''<footer class="foot">
    <span class="kode">{ed["edisi"]}</span>
    <span>© {ed["tanggal_id"].split()[-1]} Johan Iriawan Akbar — PAPAN · Analisis probabilistik, bukan ajakan transaksi.</span>
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
        ("EMA50", f'{fmt(em["ema50"])} <small>({vs_ema:+.1f}%)</small>'.replace(".", ",")),
        ("Pivot Harian", fmt(em["pivot"]["P"])),
        ("Volume", f'{fmt(o["vol_juta"],1)} jt <small>({fmt(vs_vol,1)}× rerata20)</small>'),
        ("Nilai Transaksi", f'≈ Rp{fmt(nilai_b,1)} miliar'),
    ]
    sel = "".join(f'<div class="s"><div class="l">{l}</div><div class="v">{v}</div></div>'
                  for l, v in stats)
    return f'<div class="stats">{sel}</div>'


def halaman_emiten(em, sk, ed, ohlc, idx):
    o = em["ohlc_hari"]; p = em["pivot"]
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
    return f'''
<div class="page s-{sentimen(em)}">
  <span class="senti-edge"></span>
  {band(ed)}
  <div class="inner">
    <div class="trow">
      <div class="tk">${em["ticker"]}<small>{em["nama"]}</small></div>
      <div class="px"><span class="h">{fmt(o["c"])}</span><br>
        <span class="c {chg_cls}">{tanda}{fmt(abs(o["chg"]))} ({tanda}{fmt(abs(o["pct"]),2)}%)</span></div>
    </div>
    {statistik_hari(em, ohlc)}
    <div class="chartwrap">
      <div class="cap">IDX · Harian · 1 Tahun · EMA 20/50/60/100/200 · Volume &amp; Pivot</div>
      <canvas id="ch{idx}" width="1360" height="360"></canvas>
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
        <div class="brksrc">Sumber: orderbook Stockbit, transkripsi manual terverifikasi.
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
        <div class="strategi">{em["strategi"]}</div>
        <div class="invtar">
          <span class="inv"><span class="l">Invalidation</span><b>{em["invalidation"]}</b></span>
          <span class="tar"><span class="l">Target</span><b>{em["target"]}</b></span>
        </div>
        <p class="konsek">{em["konsekuensi"]}</p>
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


MAKS_SAMPUL = 20  # >20 emiten: sampul tampilkan 20 teratas per skor


def halaman_sampul(ed, skor_map):
    urut = sorted(ed["emiten"], key=lambda e: -skor_map[e["ticker"]]["total"])
    n = len(urut)
    jml = {"bull": 0, "side": 0, "bear": 0}
    for e in urut:
        jml[sentimen(e)] += 1
    padat = n > 6  # 7-20: daftar 2 kolom + label pendek; ≤6: 1 kolom label penuh
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
    <div class="cv-kode">{ed["edisi"]} · Edisi Ujicoba</div>'''
    else:
        kepala = f'''<div class="wm-big">ARUS<br>PASAR</div>
    <div class="cv-tag">Lantai Bursa · Edisi Harian</div>
    <div class="cv-tgl">{ed["tanggal_id"]}</div>
    <div class="cv-kode">{ed["edisi"]} · {n} emiten · Edisi Ujicoba</div>'''

    return f'''
<div class="page cover">
  <header class="band">
    <div class="m"><div class="sub">Tinjauan Teknikal &amp; Arus Dana Harian</div></div>
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
        <span><span class="l">IHSG</span><b>6.409,65</b> <span class="c-bull">+1,04%</span></span>
        <span><span class="l">Net Foreign Buy Reguler</span><b class="c-bull">Rp917,23 miliar</b> (7 Agu)</span>
      </div>
      <div class="cv-legal">© {ed["tanggal_id"].split()[-1]} Johan Iriawan Akbar — PAPAN (Pusat Analisa Pasar Nusantara). Hak cipta dilindungi.<br>
      Analisis probabilistik, bukan ajakan transaksi.<br>
      Data: TradingView &amp; Stockbit (transkripsi manual terverifikasi), Yahoo Finance.</div>
    </div>
  </div>
</div>'''


def halaman_ringkasan(ed, skor_map):
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
        <td class="num c-{s}">{skor_map[e["ticker"]]["total"]:.0f}</td>
        <td><span class="risk {skor_map[e["ticker"]]["risiko"]}">{skor_map[e["ticker"]]["risiko"]}</span></td></tr>''')
    baris = "\n".join(baris)
    return f'''
<div class="page">
  {band(ed, "Ringkasan Edisi")}
  <div class="inner">
    <div class="trow" style="margin-bottom:4mm"><div class="tk" style="font-size:14pt">Ringkasan Edisi</div>
      <div class="px" style="font-size:8pt;color:var(--mute)">Edisi ujicoba · {len(ed["emiten"])} emiten</div></div>
    <p class="lede">Tiga emiten dibedah dengan kerangka yang sama: struktur harga terhadap EMA50
    dan Pivot Points, kualitas arus dana broker (siapa yang membeli — bukan hanya berapa),
    rasio risk/reward, likuiditas, dan sensitivitas terhadap IHSG.</p>
    <table class="ring">
      <tr><th>Ticker</th><th>Emiten</th><th>Close</th><th>±%</th><th>Bias</th><th>Skor</th><th>Risiko</th></tr>
      {baris}
    </table>
    <div class="ihsgbar">
      <span><span class="l">IHSG</span><b>6.409,65</b> <span class="bull">+1,04%</span></span>
      <span><span class="l">Net Foreign Buy Reguler</span><b class="bull">Rp917,23 miliar</b> (7 Agu)</span>
      <span><span class="l">Konteks</span>Bullish fluktuatif selama 6.376–6.380 bertahan</span>
    </div>
    <h3 class="rule">Metodologi</h3>
    <p class="metode"><b>Skor komposit 0–100:</b> Technical 35% · Big Money Flow 30% · Risk/reward 20% ·
    Liquidity 10% · IHSG sensitivity 5%. Pemetaan risiko: ≥80 Menengah · 55–79 Tinggi · &lt;55 Ekstrem.</p>
    <p class="metode"><b>Sumber data:</b> harga Yahoo Finance; pivot &amp; EMA dari chart TradingView; arus broker dari
    orderbook Stockbit (transkripsi manual, diverifikasi). Komponen data yang tidak tersedia tidak
    pernah diisi perkiraan — halaman terkait akan menampilkan penanda kesenjangan data dan skor
    diberi penalti. Peringkat bersifat komparatif antar emiten edisi ini, bukan sinyal beli otomatis.</p>
  </div>
  {kaki(ed)}
</div>'''


def halaman_peringkat(ed, skor_map):
    urut = sorted(ed["emiten"], key=lambda e: -skor_map[e["ticker"]]["total"])
    atas, bawah = urut[0], urut[-1]
    sk_atas = skor_map[atas["ticker"]]
    komponen = {"struktur teknikal": sk_atas["teknikal"] / 35, "arus dana": sk_atas["flow"] / 30,
                "rasio risk/reward": sk_atas["rr"] / 20}
    pendorong = max(komponen, key=komponen.get)
    lemah = min(komponen, key=komponen.get)
    baris = "\n".join(
        f'''<tr><td>{i+1}</td><td class="tk">{e["ticker"]}</td>
        <td class="total">{skor_map[e["ticker"]]["total"]:.0f}</td>
        <td>{skor_map[e["ticker"]]["teknikal"]:.0f}</td><td>{skor_map[e["ticker"]]["flow"]:.0f}</td>
        <td>{skor_map[e["ticker"]]["rr"]:.0f}</td><td>{skor_map[e["ticker"]]["lik"]}</td>
        <td>{skor_map[e["ticker"]]["ihsg"]:.0f}</td>
        <td style="text-align:left;padding-left:5mm">{e["rationale_rank"]}</td>
        <td><span class="risk {skor_map[e["ticker"]]["risiko"]}">{skor_map[e["ticker"]]["risiko"]}</span></td></tr>'''
        for i, e in enumerate(urut))
    return f'''
<div class="page">
  {band(ed, "Quant Opportunity Ranking")}
  <div class="inner">
    <div class="trow" style="margin-bottom:4mm"><div class="tk" style="font-size:14pt">Peringkat Peluang</div>
      <div class="px" style="font-size:8pt;color:var(--mute)">Risk-adjusted · komparatif</div></div>
    <p class="lede">{atas["ticker"]} mencetak skor tertinggi ({sk_atas["total"]:.0f}) — pendorong
    utamanya {pendorong}, dengan catatan {lemah} bukan kekuatannya. {bawah["ticker"]} di posisi
    akhir: {bawah["rationale_rank"].lower()}.</p>
    <table class="rank">
      <tr><th>#</th><th>Ticker</th><th>Skor</th><th>Tek/35</th><th>Flow/30</th><th>R:R/20</th>
        <th>Lik/10</th><th>IHSG/5</th><th style="text-align:left;padding-left:5mm">Rationale</th><th>Risiko</th></tr>
      {baris}
    </table>
    <div class="blok">
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
    </div>
  </div>
  {kaki(ed)}
</div>'''


def render_pdf(html_path):
    """Render HTML -> PDF (chromium headless, tunggu chart canvas selesai)."""
    from playwright.sync_api import sync_playwright
    pdf_path = html_path.with_suffix(".pdf")
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page()
        page.goto(html_path.resolve().as_uri())
        page.wait_for_function("window.__chartsDone === true")
        page.pdf(path=str(pdf_path), format="A4", print_background=True,
                 margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                 prefer_css_page_size=True)
        b.close()
    print(f"OK -> {pdf_path} ({pdf_path.stat().st_size // 1024} KB)")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    tgl = args[0] if args else "2026-08-10"
    ed = json.loads((AKAR / "edisi" / f"{tgl}.json").read_text(encoding="utf-8"))
    ohlc = json.loads((AKAR / "cache" / f"ohlc-{tgl}.json").read_text(encoding="utf-8"))

    skor_map = {}
    for em in ed["emiten"]:
        t = skor_teknikal(em); f_ = skor_flow(em, ed["peran_broker"])
        r = skor_rr(em); l = skor_likuiditas(em)
        i, korr = skor_ihsg(em["ticker"], ohlc)
        total = t + f_ + r + l + i
        skor_map[em["ticker"]] = {"teknikal": t, "flow": f_, "rr": r, "lik": l,
                                  "ihsg": i, "korr": korr, "total": total,
                                  "risiko": tingkat_risiko(total)}

    pages = [halaman_sampul(ed, skor_map), halaman_ringkasan(ed, skor_map)]
    draw = []
    for idx, em in enumerate(ed["emiten"]):
        pages.append(halaman_emiten(em, skor_map[em["ticker"]], ed, ohlc, idx))
        draw.append(f'gambarChart("ch{idx}","{em["ticker"]}",{em["ema50"]},'
                    f'{json.dumps(em["pivot"])});')
    pages.append(halaman_peringkat(ed, skor_map))

    tpl = (AKAR / "template.html").read_text(encoding="utf-8")
    # 2 thn penuh (pemanasan EMA200 di gambarChart); JKSE tak dipakai chart
    ohlc_kecil = {k: v[-505:] for k, v in ohlc.items() if k != "JKSE"}
    html = (tpl.replace("{{JUDUL}}", f"Arus Pasar {ed['edisi']}")
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
