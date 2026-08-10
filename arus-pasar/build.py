"""Arus Pasar — perakit terbitan harian.

Baca edisi/<tanggal>.json + cache/ohlc-<tanggal>.json, hitung skor model
(Technical 35 / Flow 30 / RR 20 / Liquidity 10 / IHSG sensitivity 5),
rakit HTML dari template.html, tulis ke keluaran/.

Pakai: python build.py 2026-08-10
"""
import json, sys, statistics
from pathlib import Path

AKAR = Path(__file__).parent


def fmt(n, des=0):
    """Format angka gaya Indonesia: ribuan titik, desimal koma."""
    s = f"{n:,.{des}f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return s


def fmt_rp(juta):
    """Nilai dalam juta Rp -> '8,3B' / '921,7M' gaya Stockbit."""
    if abs(juta) >= 1000:
        return fmt(juta / 1000, 1) + "B"
    return fmt(juta, 1) + "M"


def fmt_lot(lot):
    if lot >= 1000:
        v = lot / 1000
        return (fmt(v, 1) if v < 100 else fmt(v, 1)) + "K"
    return fmt(lot)


# ── Skor model (METODOLOGI §7; angka bobot terbuka) ─────────────────────────

def skor_teknikal(em):
    """0-35: posisi vs EMA50, vs pivot, momentum ke R1, penalti overextended."""
    c = em["ohlc_hari"]["c"]; p = em["pivot"]; ema = em["ema50"]
    s = 0.0
    s += 12 if c > ema else 0            # struktur di atas EMA50
    s += 12 if c > p["P"] else 0         # di atas pivot harian
    # momentum: posisi close di rentang P..R1 (uji resistance = momentum hidup)
    if p["R1"] > p["P"]:
        pos = max(0.0, min(1.0, (c - p["P"]) / (p["R1"] - p["P"])))
        s += 8 * pos
    # penalti jarak ke EMA >15% (rawan mean-reversion)
    rentang = (c - ema) / ema
    if rentang > 0.15:
        s -= min(7, (rentang - 0.15) * 60)
    return max(0.0, min(35.0, s))


def skor_flow(em, peran):
    """0-30: rasio net top-10 + kualitas pelaku (institusi vs ritel/scalper)."""
    b = sum(r[1] for r in em["beli"]); j = sum(r[1] for r in em["jual"])
    rasio = (b - j) / (b + j) if b + j else 0.0
    s = 15 + 15 * rasio
    b1, j1 = em["beli"][0][0], em["jual"][0][0]
    if b1 in peran["scalper"]: s -= 5     # beli terbesar scalper = keyakinan semu
    if b1 in peran["ritel"]:   s -= 5
    if j1 in peran["ritel"]:   s += 3     # jual terbesar ritel = tekanan non-institusi
    # distribusi top-2: dua penjual teratas > dua pembeli teratas
    if em["jual"][0][1] + em["jual"][1][1] > em["beli"][0][1] + em["beli"][1][1]:
        s -= 5
    return max(0.0, min(30.0, s))


def skor_rr(em):
    """0-20: (target tengah - close) / (close - invalidation)."""
    c = em["ohlc_hari"]["c"]; p = em["pivot"]
    inval = float(em["invalidation"].replace("Close <", "").replace(".", ""))
    t2 = p["R2"]
    risiko = c - inval
    if risiko <= 0:
        return 0.0
    rr = (t2 - c) / risiko
    return max(0.0, min(20.0, rr * 9))


def skor_likuiditas(em):
    """0-10: nilai transaksi hari (harga x volume)."""
    nilai_b = em["ohlc_hari"]["c"] * em["ohlc_hari"]["vol_juta"] / 1000  # miliar Rp
    for ambang, sk in ((50, 10), (20, 8), (5, 6), (1, 4)):
        if nilai_b >= ambang:
            return sk
    return 2


def skor_ihsg(tk, ohlc):
    """0-5: korelasi return 60 hari vs IHSG; korelasi moderat (~0,3) ideal."""
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


# ── Perakit HTML ─────────────────────────────────────────────────────────────

def baris_broker(rows, sisi, peran):
    cls = "bcode-b" if sisi == "b" else "bcode-s"
    out = []
    for kode, val, lot, avg in rows[:7]:
        tag = ""
        if kode in peran["ritel"]:   tag = '<span class="tag ritel">RITEL</span>'
        elif kode in peran["scalper"]: tag = '<span class="tag scalp">SCALP</span>'
        out.append(f'<tr><td class="{cls}">{kode}{tag}</td><td>{fmt_rp(val)}</td>'
                   f'<td>{fmt_lot(lot)}</td><td>{fmt(avg)}</td></tr>')
    return "\n".join(out)


def halaman_emiten(em, sk, ed, idx):
    o = em["ohlc_hari"]; p = em["pivot"]
    chg_cls = "bull" if o["chg"] >= 0 else "bear"
    tanda = "+" if o["chg"] >= 0 else "−"
    arah_cls = em["arah"]
    kata_arah = em["label"].split("—")[0].strip()
    sisa_label = em["label"][len(kata_arah):]
    net = sum(r[1] for r in em["beli"]) - sum(r[1] for r in em["jual"])
    net_cls = "net-b" if net >= 0 else "net-s"
    net_txt = ("+" if net >= 0 else "−") + "Rp" + fmt_rp(abs(net)).replace("B", " miliar").replace("M", " juta")
    sup = " <span>•</span> ".join(fmt(p[k]) for k in ("P", "S1", "S2", "S3"))
    res = " <span>•</span> ".join(fmt(p[k]) for k in ("R1", "R2", "R3"))
    ragu = f' <span style="color:var(--warn)">(verifikasi: {", ".join(em["pivot_ragu"])})</span>' if em["pivot_ragu"] else ""
    return f'''
<div class="page">
  <header class="mast">
    <div class="brand">
      <div class="eyebrow">Tinjauan Teknikal &amp; Arus Dana Harian</div>
      <h1><span class="wave">≋</span> ARUS PASAR</h1>
    </div>
    <div class="edisi">{ed["tanggal_id"]}<br><span class="kode">{ed["edisi"]}</span></div>
  </header>
  <div class="emiten">
    <div class="tk">${em["ticker"]} <small>{em["nama"]}</small></div>
    <div class="close"><div class="harga">{fmt(o["c"])}</div>
      <div class="chg {chg_cls}">{tanda}{fmt(abs(o["chg"]))} · {tanda}{fmt(abs(o["pct"]),2)}%</div></div>
  </div>
  <div class="chartwrap"><span class="cap">IDX · 1D · EMA50 &amp; Pivot</span>
    <canvas id="ch{idx}" width="1360" height="330"></canvas></div>
  <div class="cols">
    <aside class="panel">
      <h2 class="ptitle">Arus Broker <span>{ed["tanggal_flow"]} · Net</span></h2>
      <div class="meter"><i style="left:{em["slider_pct"]}%"></i></div>
      <div class="meterlbl"><span>Big Dist</span><span>Netral</span><span>Big Acc</span></div>
      <table class="brk">
        <tr><th>BY</th><th>Nilai</th><th>Lot</th><th>Avg</th></tr>
        {baris_broker(em["beli"], "b", ed["peran_broker"])}
        <tr class="sep"><td colspan="4">Jual terbesar</td></tr>
        {baris_broker(em["jual"], "s", ed["peran_broker"])}
      </table>
      <div class="brksrc">Sumber: orderbook Stockbit, transkripsi manual terverifikasi.</div>
    </aside>
    <section class="panel" style="display:flex;flex-direction:column">
      <div class="bias">
        <div class="lbl"><b class="{arah_cls}">{kata_arah}</b>{sisa_label}</div>
        <div class="risk {sk["risiko"]}">{sk["risiko"]}</div>
      </div>
      <div class="sec"><h3>Arus Dana</h3>
        <p class="flowline">{em["flow_kelas"]} | <span class="{net_cls}">≈ {net_txt}</span> (top-10)</p>
        <p class="dim">{em["narasi_flow"]}</p></div>
      <div class="sec"><h3>Teknikal</h3><p class="dim">{em["narasi_teknikal"]}</p></div>
      <div class="sr">
        <div class="k sup">Support</div><div class="v">{sup}{ragu}</div>
        <div class="k res">Resistance</div><div class="v">{res}</div>
      </div>
      <div class="sec"><h3>Strategi</h3><div class="strategi">{em["strategi"]}</div></div>
      <div class="invtar">
        <span class="inv">Invalidation: <b>{em["invalidation"]}</b></span>
        <span class="tar">Target: <b>{em["target"]}</b></span>
      </div>
      <p class="konsek">{em["konsekuensi"]}</p>
      <div class="skorbar">
        <span>Skor <b>{sk["total"]:.0f}</b>/100</span>
        <span>Teknikal {sk["teknikal"]:.0f}/35</span><span>Flow {sk["flow"]:.0f}/30</span>
        <span>R/R {sk["rr"]:.0f}/20</span><span>Lik {sk["lik"]}/10</span>
        <span>IHSG {sk["ihsg"]:.0f}/5</span>
      </div>
    </section>
  </div>
  <footer class="foot">
    <span class="kode">{ed["edisi"]} · {ed["tanggal_id"].split(", ")[1].upper()}</span>
    <span>≋ Arus Pasar · Analisis probabilistik, bukan ajakan transaksi.</span>
  </footer>
</div>'''


def halaman_sampul(ed):
    isi = "<br>".join(f'<b>${e["ticker"]}</b> — {e["label"]}' for e in ed["emiten"])
    return f'''
<div class="page cover">
  <div>
    <div class="wave-big">≋</div>
    <h1>ARUS PASAR</h1>
    <div class="sub">Tinjauan Teknikal &amp; Arus Dana Harian</div>
    <div class="tgl">{ed["tanggal_id"]}</div>
    <div class="kode">{ed["edisi"]} · Edisi Ujicoba</div>
    <div class="isi">{isi}<br><b>Peringkat</b> — Quant Opportunity Ranking</div>
    <div class="ihsg">{ed["ihsg_baris"]}</div>
  </div>
  <div class="disc">Analisis probabilistik, bukan ajakan transaksi · Data: TradingView &amp; Stockbit (transkripsi manual), Yahoo Finance</div>
</div>'''


def halaman_peringkat(ed, skor_map):
    urut = sorted(ed["emiten"], key=lambda e: -skor_map[e["ticker"]]["total"])
    baris = "\n".join(
        f'<tr><td>{i+1}</td><td><b>${e["ticker"]}</b></td>'
        f'<td class="skor">{skor_map[e["ticker"]]["total"]:.0f}</td>'
        f'<td>{e["rationale_rank"]}</td>'
        f'<td><span class="risk {skor_map[e["ticker"]]["risiko"]}">{skor_map[e["ticker"]]["risiko"]}</span></td></tr>'
        for i, e in enumerate(urut))
    atas, bawah = urut[0], urut[-1]
    sk_atas = skor_map[atas["ticker"]]
    # pendorong = komponen dengan rasio capaian tertinggi — kesimpulan wajib jujur pada angka
    komponen = {"struktur teknikal": sk_atas["teknikal"] / 35, "arus dana": sk_atas["flow"] / 30,
                "rasio risk/reward": sk_atas["rr"] / 20}
    pendorong = max(komponen, key=komponen.get)
    lemah = min(komponen, key=komponen.get)
    return f'''
<div class="page">
  <header class="mast">
    <div class="brand">
      <div class="eyebrow">Quant Opportunity Ranking</div>
      <h1><span class="wave">≋</span> ARUS PASAR</h1>
    </div>
    <div class="edisi">{ed["tanggal_id"]}<br><span class="kode">{ed["edisi"]}</span></div>
  </header>
  <div class="rank-kesimpulan"><h3>Kesimpulan Utama</h3>
    ${atas["ticker"]} mencetak skor tertinggi ({sk_atas["total"]:.0f}) — pendorong utamanya
    {pendorong}, dengan catatan {lemah} bukan kekuatannya. ${bawah["ticker"]} di posisi akhir:
    {bawah["rationale_rank"].lower()}. Peringkat bersifat komparatif antar {len(urut)} emiten
    ujicoba — bukan sinyal beli otomatis.</div>
  <table class="rank">
    <tr><th>#</th><th>Ticker</th><th>Skor</th><th>Rationale</th><th>Risk</th></tr>
    {baris}
  </table>
  <div class="blok"><h3>Model</h3>
    Technical 35% • Big Money Flow 30% • Risk/reward 20% • Liquidity 10% • IHSG sensitivity 5%
    <div class="dim" style="margin-top:3px">{ed["ihsg_baris"]}</div></div>
  <div class="blok"><h3>Eksekusi</h3>
    Prioritaskan emiten yang menahan support atau merebut resistance dengan volume.
    Tidak ada konfirmasi berarti tidak ada ukuran agresif.</div>
  <div class="blok warn"><h3>Catatan Integritas Data</h3>
    <span class="dim">{ed["catatan_verifikasi"]}</span></div>
  <footer class="foot" style="margin-top:auto">
    <span class="kode">{ed["edisi"]}</span>
    <span>≋ Arus Pasar · Analisis probabilistik, bukan ajakan transaksi.</span>
  </footer>
</div>'''


def main():
    tgl = sys.argv[1] if len(sys.argv) > 1 else "2026-08-10"
    ed = json.loads((AKAR / "edisi" / f"{tgl}.json").read_text(encoding="utf-8"))
    ohlc = json.loads((AKAR / "cache" / f"ohlc-{tgl}.json").read_text(encoding="utf-8"))

    skor_map = {}
    for em in ed["emiten"]:
        t = skor_teknikal(em)
        f_ = skor_flow(em, ed["peran_broker"])
        r = skor_rr(em)
        l = skor_likuiditas(em)
        i, korr = skor_ihsg(em["ticker"], ohlc)
        total = t + f_ + r + l + i
        skor_map[em["ticker"]] = {"teknikal": t, "flow": f_, "rr": r, "lik": l,
                                  "ihsg": i, "korr": korr, "total": total,
                                  "risiko": tingkat_risiko(total)}

    pages = [halaman_sampul(ed)]
    draw = []
    for idx, em in enumerate(ed["emiten"]):
        pages.append(halaman_emiten(em, skor_map[em["ticker"]], ed, idx))
        draw.append(f'gambarChart("ch{idx}","{em["ticker"]}",{em["ema50"]},'
                    f'{json.dumps(em["pivot"])});')
    pages.append(halaman_peringkat(ed, skor_map))

    tpl = (AKAR / "template.html").read_text(encoding="utf-8")
    ohlc_kecil = {k: v[-260:] for k, v in ohlc.items() if k != "JKSE"}
    html = (tpl.replace("{{JUDUL}}", f"Arus Pasar {ed['edisi']}")
               .replace("<!--PAGES-->", "\n".join(pages))
               .replace("/*OHLC*/{}", json.dumps(ohlc_kecil, separators=(",", ":")))
               .replace("/*DRAWCALLS*/", "\n".join(draw)))
    keluar = AKAR / "keluaran" / f"{ed['edisi']}.html"
    keluar.write_text(html, encoding="utf-8")

    print(f"OK -> {keluar}")
    for tk, s in skor_map.items():
        print(f"  {tk}: total {s['total']:.1f} ({s['risiko']}) | "
              f"T {s['teknikal']:.1f} F {s['flow']:.1f} RR {s['rr']:.1f} "
              f"L {s['lik']} I {s['ihsg']:.1f} (korr {s['korr']:.2f})")


if __name__ == "__main__":
    main()
