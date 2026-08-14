"""Arus Pasar — perakit BEDAH ARUS SAHAM (BA-*): satu emiten, satu terbitan.

Baca bedah/<TICKER-tanggal>.json, tarik data emiten + arus broker dari edisi
harian sumber, hitung PCD (pcd.py) dan probabilitas historis (prob.py), rakit
5 halaman di atas kulit template.html yang SAMA dengan bulletin harian
(build.py tidak disentuh): sampul mini, PCD, teknikal, arus broker, scenario
map. Tulis keluaran/<kode>.html + .pdf.

Pakai: python build_bedah.py EXCL-2026-08-14 [--tanpa-pdf]
"""
import json, sys
from pathlib import Path

import build as B
import pcd as PCD
import prob

AKAR = Path(__file__).parent

# CSS tambahan khusus bedah — disuntik di body, kulit template tidak diubah
BSTYLE = """<style>
  .bd-judul{font-family:Georgia,Cambria,serif;font-size:30pt;font-weight:700;line-height:1.08;margin-top:10mm}
  .bd-tk{font-family:var(--mono);font-size:20pt;font-weight:800;margin-top:8mm}
  .bd-tk small{font-family:var(--disp);font-size:9.5pt;font-weight:400;color:var(--mute);margin-left:8px}
  .bd-vonis{font-size:10.5pt;color:var(--ink2);line-height:1.65;text-align:justify;margin-top:6mm;text-wrap:pretty}
  .tagdraf{font-size:5.8pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
    color:var(--warn);outline:1px solid var(--warn);padding:.4mm 1.6mm;border-radius:.8mm;
    vertical-align:2px;margin-left:2mm;font-family:var(--disp)}
  .bd-lvl{display:grid;grid-template-columns:1fr 1fr;gap:0 10mm;margin-top:3mm}
  .bd-note{font-size:6.5pt;color:var(--mute);font-family:var(--mono);line-height:1.7;margin-top:2.5mm}
  .sknb{display:flex;flex-direction:column;gap:3mm;margin-top:4mm}
  .sknb .kartu{border-left:3px solid var(--mute);border-radius:0 1.5mm 1.5mm 0;
    background:var(--panel);padding:3mm 4.5mm}
  .sknb .kartu.b{border-color:var(--bull);background:var(--bull-dim)}
  .sknb .kartu.t{border-color:var(--teal)}
  .sknb .kartu.r{border-color:var(--bear);background:var(--bear-dim)}
  .sknb .kt{font-size:10pt;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:2mm}
  .sknb .kartu.b .kt{color:var(--bull)} .sknb .kartu.t .kt{color:var(--teal)} .sknb .kartu.r .kt{color:var(--bear)}
  .sknb .kr{display:grid;grid-template-columns:24mm 1fr;gap:4mm;font-size:8.8pt;line-height:1.5;
    color:var(--ink2);padding:1mm 0;font-variant-numeric:tabular-nums}
  .sknb .kl{font-size:6.3pt;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);padding-top:.6mm}
  .sknb .aturan{display:grid;grid-template-columns:24mm 1fr;gap:4mm;font-size:9.3pt;font-weight:700;
    padding:2.5mm 4.5mm;border:1px solid var(--hair);border-radius:1.5mm}
  .sknb .aturan .kl{font-weight:400}
</style>"""


def hal_sampul(bd, em, r, pr):
    o = em["ohlc_hari"]
    gap = (r["pcd"] - r["close"]) / r["close"] * 100
    arah = "di bawah" if gap > 0 else "di atas"
    headline = (f'{bd["ticker"]} <b>{B.fmt(r["close"])}</b> diperdagangkan '
                f'<b>{B.fmt(abs(gap), 1)}%</b> {arah} harga konstruksi pasar '
                f'<b>{B.fmt(r["pcd"])}</b>')
    tanda = "+" if o["chg"] >= 0 else "−"
    p5 = f'{pr["p5"]*100:.0f}% <small style="color:var(--mute)">n{pr["n"]}</small>' \
        if pr and pr["p5"] is not None else "—"
    stats = [("Close", f'{B.fmt(o["c"])} <span class="c-{"bull" if o["chg"]>=0 else "bear"}" style="font-size:8pt">{tanda}{B.fmt(abs(o["pct"]),2)}%</span>'),
             ("PCD (konstruksi)", B.fmt(r["pcd"])),
             ("Modal di atas air", f'{B.fmt(r["diatas_air"]*100,1)}%'),
             ("P(naik 5 hari)", p5)]
    sel = "".join(f'<span><span class="l">{l}</span><b>{v}</b></span>' for l, v in stats)
    return f'''
<div class="page">
  {B.band(bd, "Bedah Arus Saham — Terbitan Perdana")}
  <div class="inner">
    <div class="bd-judul">BEDAH<br>ARUS SAHAM</div>
    <div class="cv-tag" style="margin-top:3mm">Satu Emiten · Modal, Arus &amp; Probabilitas</div>
    <div class="bd-tk">${bd["ticker"]}<small>{bd["nama"]}</small></div>
    <div class="hangka" style="margin-top:5mm">{headline}</div>
    <div class="bd-vonis">{bd["vonis"]}<span class="tagdraf">Draf Analis</span></div>
    <div class="cv-foot">
      <div class="cv-stats">{sel}</div>
      <div class="cv-legal">© {bd["tanggal_id"].split()[-1]} Johan Iriawan Akbar — PAPAN (Pusat Analisa Pasar Nusantara). Hak cipta dilindungi.<br>
      Analisis probabilistik, bukan ajakan transaksi. PCD = aproksimasi OHLCV, bukan data done per harga.<br>
      Data: Yahoo Finance &amp; Stockbit.</div>
    </div>
  </div>
</div>'''


def hal_pcd(bd, r):
    kurva = [[p, round(v, 1)] for p, v in r["kurva"]]
    headline = (f'Modal pasar {bd["ticker"]} terkonsentrasi <b>{B.fmt(r["p25"])}</b>–'
                f'<b>{B.fmt(r["p75"])}</b>; close <b>{B.fmt(r["close"])}</b> di lapis bawah zona')
    rows_kiri = [("PCD — rata-rata modal", r["pcd"], "c-side"),
                 ("Median modal (p50)", r["p50"], ""),
                 ("Close terakhir", r["close"], "c-bull" if r["close"] >= r["pcd"] else "c-bear")]
    rows_kanan = [("Lapis modal bawah (p25)", r["p25"], "c-bull"),
                  ("Lapis modal atas (p75)", r["p75"], "c-bear"),
                  ("Modal di atas air", f'{B.fmt(r["diatas_air"]*100,1)}%', "")]
    lv = lambda rows: "\n".join(
        f'<div class="r"><span class="l">{n}</span><b class="{cls}">'
        f'{v if isinstance(v,str) else B.fmt(v)}</b></div>' for n, v, cls in rows)
    return f'''
<div class="page">
  {B.band(bd, "Price of Construction Distribution")}
  <div class="inner">
    <div class="hangka">{headline}</div>
    <div class="chartwrap">
      <div class="cap">{bd["ticker"]} · Distribusi Volume × Harga · Peluruhan Half-life {r["half_life"]} Hari · {r["n_bar"]} Bar</div>
      <canvas id="chPCD" width="1360" height="430"></canvas>
    </div>
    <script>
    (function(){{
      const K={json.dumps(kurva)},PCDV={r["pcd"]:.1f},P25={r["p25"]},P50={r["p50"]},P75={r["p75"]},C={r["close"]};
      const cv=document.getElementById('chPCD'),x=cv.getContext('2d');
      const W=cv.width,H=cv.height,pad={{t:44,r:16,b:30,l:16}};
      const lo=K[0][0],hi=K[K.length-1][0],mx=Math.max(...K.map(k=>k[1]));
      const X=p=>pad.l+(p-lo)/(hi-lo)*(W-pad.l-pad.r);
      const Y=v=>H-pad.b-v/mx*(H-pad.t-pad.b);
      const bw=(W-pad.l-pad.r)/K.length*.82;
      K.forEach(([p,v])=>{{x.fillStyle=p<=C?"rgba(47,191,113,.5)":"rgba(126,151,184,.38)";
        x.fillRect(X(p)-bw/2,Y(v),bw,H-pad.b-Y(v));}});
      x.font="14px Cascadia Code, Consolas, monospace";x.textAlign="center";
      let taken=[];
      const garis=[["p25",P25,"#37B8AF",1,[4,4]],["p50",P50,"#37B8AF",1,[4,4]],
                   ["p75",P75,"#37B8AF",1,[4,4]],["PCD "+PCDV.toLocaleString('id',{{maximumFractionDigits:0}}),PCDV,"#E8A33D",2,[]],
                   ["CLOSE "+C.toLocaleString('id'),C,"#E9EEF4",2,[]]];
      garis.forEach(([lbl,p,c,w,dash])=>{{
        x.strokeStyle=c;x.lineWidth=w;x.setLineDash(dash);x.beginPath();
        x.moveTo(X(p),pad.t-4);x.lineTo(X(p),H-pad.b);x.stroke();x.setLineDash([]);
        let yl=12; while(taken.some(([tx,ty])=>ty===yl&&Math.abs(tx-X(p))<70)) yl+=15;
        taken.push([X(p),yl]);
        x.fillStyle=c;x.fillText(lbl,X(p),yl);
      }});
      x.fillStyle="rgba(233,238,244,.55)";
      for(let i=0;i<=4;i++){{const p=lo+(hi-lo)*i/4;
        x.textAlign=i===0?"left":i===4?"right":"center";
        x.fillText(p.toLocaleString('id',{{maximumFractionDigits:0}}),X(p),H-8);}}
    }})();
    </script>
    <div class="bd-lvl">
      <div class="lvl">{lv(rows_kiri)}</div>
      <div class="lvl">{lv(rows_kanan)}</div>
    </div>
    <div class="blok" style="margin-top:4mm">
      <h3 class="rule">Interpretasi Analis <span class="tagdraf" style="margin-left:0">Draf Analis</span></h3>
      <p style="text-align:justify;line-height:1.6">{bd["interpretasi_pcd"]}</p>
    </div>
    <div class="bd-note">METODE: {r["metode"]}. Batang hijau = lapis harga ≤ close (pemegang untung/impas);
    batang biru = lapis di atas close (pemegang rugi). % modal di atas air = porsi volume tertimbang pada lapis ≤ close.</div>
  </div>
  {B.kaki(bd)}
</div>'''


def hal_teknikal(bd, em, ohlc, pr):
    o = em["ohlc_hari"]; p = em["pivot"]
    chg_cls = "bull" if o["chg"] >= 0 else "bear"
    tanda = "+" if o["chg"] >= 0 else "−"
    c = o["c"]
    sup_dekat = max((v for v in p.values() if v < c), default=None)
    res_dekat = min((v for v in p.values() if v > c), default=None)
    sup = " <span>|</span> ".join(B.fmt(p[k]) for k in ("P", "S1", "S2", "S3"))
    res = " <span>|</span> ".join(B.fmt(p[k]) for k in ("R1", "R2", "R3"))
    awal = ohlc[bd["ticker"]][0]["d"]
    return f'''
<div class="page s-{B.sentimen(em)}">
  <span class="senti-edge"></span>
  {B.band(bd, "Teknikal & Probabilitas Historis")}
  <div class="inner">
    <div class="trow">
      <div class="tk">${bd["ticker"]}<small>{bd["nama"]}</small></div>
      <div class="px"><span class="h">{B.fmt(o["c"])}</span><br>
        <span class="c {chg_cls}">{tanda}{B.fmt(abs(o["chg"]))} ({tanda}{B.fmt(abs(o["pct"]),2)}%)</span></div>
    </div>
    <div class="hangka em">{B.kalimat_angka(f'Harga {bd["ticker"]}', c, sup_dekat, res_dekat)}</div>
    {B.statistik_hari(em, ohlc)}
    <div class="chartwrap">
      <div class="cap">IDX · Harian · Sejak Listing XLSMART ({awal}) · EMA 20/50/60/100/200 · Volume &amp; Pivot</div>
      <canvas id="chT" width="1360" height="430"></canvas>
    </div>
    <div class="sec" style="margin-top:4mm">
      <h3 class="rule">Teknikal <span class="tagdraf" style="margin-left:0">Draf Analis</span></h3>
      <p>{em["narasi_teknikal"]}</p>
    </div>
    <div class="sr">
      <div class="k sup">Support</div><div class="v">{sup}</div>
      <div class="k res">Resistance</div><div class="v">{res}</div>
    </div>
    {B.strip_prob(pr)}
    <div class="bd-note">Probabilitas dari backtest setup serupa (EMA50, pivot, volume 20h, rentang 20h)
    atas pool cache edisi {bd["edisi_sumber"]}; n = jumlah sampel. Bukan jaminan — frekuensi historis.</div>
  </div>
  {B.kaki(bd)}
</div>'''


def hal_broker(bd, em, ed_sumber):
    peran = ed_sumber["peran_broker"]
    net = sum(r[1] for r in em["beli"]) - sum(r[1] for r in em["jual"])
    net_cls = "bull" if net >= 0 else "bear"
    net_txt = ("+" if net >= 0 else "−") + "Rp" + B.fmt_rp(abs(net)).replace("B", " miliar").replace("M", " juta")
    tb = sum(r[1] for r in em["beli"]); tj = sum(r[1] for r in em["jual"])
    return f'''
<div class="page">
  {B.band(bd, "Arus Broker")}
  <div class="inner">
    <div class="trow" style="margin-bottom:4mm"><div class="tk" style="font-size:14pt">Arus Broker {bd["ticker"]}</div>
      <div class="px" style="font-size:8pt;color:var(--mute)">{ed_sumber["tanggal_flow"]} · potret 1 hari</div></div>
    <div class="cols" style="margin-top:0">
      <aside>
        <h3 class="rule">Top-10 <span class="r">{ed_sumber["tanggal_flow"]} · Net</span></h3>
        <div class="meter"><i style="left:{em["slider_pct"]}%"></i></div>
        <div class="meterlbl"><span>Big Dist</span><span>Netral</span><span>Big Acc</span></div>
        <table class="brk">
          <tr><th>BY</th><th>Nilai</th><th>Lot</th><th>Avg</th></tr>
          {B.baris_broker(em["beli"], "b", peran)}
          <tr class="sep"><td colspan="4">Jual Terbesar</td></tr>
          {B.baris_broker(em["jual"], "s", peran)}
          <tr class="tot"><td>NET</td><td colspan="3" class="{net_cls}">{net_txt}
            <small style="color:var(--mute);font-weight:400"> (B {B.fmt_rp(tb)} · S {B.fmt_rp(tj)})</small></td></tr>
        </table>
        <div class="brksrc">Sumber: orderbook Stockbit. Peran broker: RITEL &amp; SCALP
          mengubah tafsir angka, bukan sekadar label.</div>
      </aside>
      <section>
        <div class="sec">
          <h3 class="rule">Arus Dana <span class="tagdraf" style="margin-left:0">Draf Analis</span></h3>
          <p class="flowline"><span class="kw c-bull">{em["flow_kelas"]}</span> · <span class="{net_cls}">≈ {net_txt}</span> (top-10)</p>
          <p style="text-align:justify">{em["narasi_flow"]}</p>
        </div>
        <div class="blok integritas" style="margin-top:5mm">
          <h3 class="rule">Kejujuran Data</h3>
          <p>{bd["catatan_flow"]}</p>
        </div>
      </section>
    </div>
  </div>
  {B.kaki(bd)}
</div>'''


def hal_skenario(bd, em):
    sk = em["skenario"]
    p = em["pivot"]

    def krt(kunci, judul, cls):
        d = sk[kunci]
        return (f'<div class="kartu {cls}"><div class="kt">{judul}</div>'
                f'<div class="kr"><span class="kl">Konfirmasi</span><span>{d["konfirmasi"]}</span></div>'
                f'<div class="kr"><span class="kl">Rute Teknikal</span><span>{d["rute"]}</span></div>'
                f'<div class="kr"><span class="kl">Risiko</span><span>{d["risiko"]}</span></div></div>')

    headline = (f'{bd["ticker"]} memerlukan konfirmasi &gt;<b>{B.fmt(p["R1"])}</b> '
                f'untuk memperluas probabilitas')
    return f'''
<div class="page">
  {B.band(bd, "Scenario Map")}
  <div class="inner">
    <div class="hangka">{headline}</div>
    <div class="sknb">
      {krt("bull", "Konfirmasi Bullish", "b")}
      {krt("retest", "Retest Konstruktif", "t")}
      {krt("invalid", "Risk-off / Invalidasi", "r")}
      <div class="aturan"><span class="kl">Aturan Eksekusi</span><span>{sk["aturan"]}</span></div>
    </div>
    <div class="blok integritas" style="margin-top:auto;margin-bottom:2mm">
      <h3 class="rule">Catatan Integritas Data</h3>
      <p>{bd["catatan_verifikasi"]}</p>
    </div>
  </div>
  {B.kaki(bd)}
</div>'''


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    stem = args[0] if args else "EXCL-2026-08-14"
    bd = json.loads((AKAR / "bedah" / f"{stem}.json").read_text(encoding="utf-8"))
    ohlc = json.loads((AKAR / "cache" / f"ohlc-{bd['cache']}.json").read_text(encoding="utf-8"))
    ed_sumber = json.loads((AKAR / "edisi" / f"{bd['edisi_sumber']}.json").read_text(encoding="utf-8"))
    em = next(e for e in ed_sumber["emiten"] if e["ticker"] == bd["ticker"])

    r = PCD.hitung_pcd(ohlc[bd["ticker"]])
    pr = prob.analisa_edisi(ohlc, [bd["ticker"]])[bd["ticker"]]

    pages = [BSTYLE + hal_sampul(bd, em, r, pr), hal_pcd(bd, r),
             hal_teknikal(bd, em, ohlc, pr), hal_broker(bd, em, ed_sumber),
             hal_skenario(bd, em)]
    draw = [f'gambarChart("chT","{bd["ticker"]}",{em["ema50"]},{json.dumps(em["pivot"])});']

    tpl = (AKAR / "template.html").read_text(encoding="utf-8")
    html = (tpl.replace("{{JUDUL}}", f"Bedah Arus Saham {bd['edisi']}")
               .replace("<!--PAGES-->", "\n".join(pages))
               .replace("/*OHLC*/{}", json.dumps({bd["ticker"]: ohlc[bd["ticker"]]},
                                                 separators=(",", ":")))
               .replace("/*DRAWCALLS*/", "\n".join(draw)))
    keluar = AKAR / "keluaran" / f"{bd['edisi']}.html"
    keluar.write_text(html, encoding="utf-8")
    print(f"OK -> {keluar}")
    print(f"  PCD {r['pcd']:.0f} | p25/50/75 {r['p25']:.0f}/{r['p50']:.0f}/{r['p75']:.0f} "
          f"| di atas air {r['diatas_air']*100:.1f}% | close {r['close']:.0f}")
    if pr and pr["p5"] is not None:
        print(f"  Prob: p5 {pr['p5']:.3f} p3 {pr['p3']:.3f} n{pr['n']} cocok {pr['cocok']}/4")

    if "--tanpa-pdf" not in sys.argv:
        B.render_pdf(keluar)


if __name__ == "__main__":
    main()
