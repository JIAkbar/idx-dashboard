"""Arus Pasar — perakit BEDAH ARUS SAHAM (BA-*): satu emiten, satu terbitan.

Baca bedah/<TICKER-tanggal>.json, hitung PCD (pcd.py) dan probabilitas
historis (prob.py), rakit 5 halaman di atas kulit template.html yang SAMA
dengan bulletin harian (build.py tidak disentuh): sampul mini, PCD,
teknikal, arus broker, scenario map. Tulis keluaran/<kode>.html + .pdf.

Dua mode:
- `edisi_sumber` ADA  : data emiten (ohlc_hari, pivot, narasi, broksum top-10)
  ditarik dari edisi harian sumber — perilaku lama.
- `edisi_sumber` TIDAK ada (bedah standalone): OHLC diambil sendiri (yfinance
  2 tahun harian, cache/ohlc-bedah-<TICKER>.json), `em` dirakit otomatis dari
  OHLC (ohlc_hari, ema50, pivot klasik — formula sama build.py) + field
  analis dari bedah JSON sendiri (blok `em`: label, arah, narasi_teknikal,
  skenario). Pool probabilitas = cache `bd["cache"]` DIGABUNG seri sendiri,
  supaya setup tetap dihitung terhadap pool besar.

Halaman arus broker:
- bedah/flow-<TICKER>.json ADA (setoran Broker Summary harian multi-hari):
  chart Big Money Flow per hari + tabel broker hari terakhir + modal
  rata-rata per broker lintas hari + strip label Acc/Dist Stockbit.
- tidak ada, tapi ada edisi_sumber: tabel top-10 satu hari (perilaku lama).
- tidak ada dua-duanya: panel keterangan jujur (belum ada setoran).

Pakai: python build_bedah.py DSSA-2026-08-14 [--tanpa-pdf]
"""
import json, sys
from pathlib import Path

import build as B
import palet
import pcd as PCD
import prob

AKAR = Path(__file__).parent
EDISI_PALET = "single"  # Opsi A · Permukaan & Suhu — lihat palet.py
PAL = palet.PALET[EDISI_PALET]

# CSS tambahan khusus bedah — disuntik di body, kulit template tidak diubah.
# Tema TERANG ("kertas riset institusional"): token :root datang dari
# palet.py (satu sumber, lihat blok_css() di bawah) — build.py & bulletin
# harian TIDAK disentuh, override ini cuma berlaku di body halaman bedah
# karena disuntik lewat BSTYLE, bukan lewat template.html. Selektor yang di
# kulit gelap memakai rgba(255,255,255,x) hardcode sudah diperbaiki generik
# di template.html sendiri (color-mix atas var(--ink)) — tidak perlu diulang
# di sini lagi.
BSTYLE = f"<style>{palet.blok_css(EDISI_PALET)}</style>" + """
<style>
  .band{background:var(--brand);border-bottom:1px solid var(--ink)}
  .chartwrap{background:var(--panel)}
  .bd-judul{font-family:Georgia,Cambria,serif;font-size:30pt;font-weight:700;line-height:1.08;margin-top:10mm}
  .bd-tk{font-family:var(--mono);font-size:20pt;font-weight:800;margin-top:8mm}
  .bd-tk small{font-family:var(--disp);font-size:9.5pt;font-weight:400;color:var(--mute);margin-left:8px}
  .bd-vonis{font-size:10.5pt;color:var(--ink2);line-height:1.65;text-align:justify;margin-top:6mm;text-wrap:pretty}
  .tagdraf{font-size:5.8pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
    color:var(--warn);outline:1px solid var(--warn);padding:.4mm 1.6mm;border-radius:.8mm;
    vertical-align:2px;margin-left:2mm;font-family:var(--disp)}
  .bd-lvl{display:grid;grid-template-columns:1fr 1fr;gap:0 10mm;margin-top:3mm}
  .bd-note{font-size:6.5pt;color:var(--mute);font-family:var(--mono);line-height:1.7;margin-top:2.5mm}
  /* Pita batas data — angka terbitan ditutup di sesi terakhir SEBELUM tanggal
     rilis; dipasang di sampul supaya pembaca tidak menyangka ini waktu nyata. */
  .bd-cutoff{margin-top:6mm;padding:2.5mm 4mm;border-left:3px solid var(--warn);
    background:var(--panel);border-radius:0 1.5mm 1.5mm 0;font-size:8.2pt;
    color:var(--ink2);line-height:1.6;text-align:justify}
  .bd-cutoff .l{display:block;font-size:6pt;font-weight:700;letter-spacing:.16em;
    text-transform:uppercase;color:var(--warn);margin-bottom:1.2mm;font-family:var(--disp)}
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
</style>""" + palet.blok_tema(EDISI_PALET)


BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
            "Agustus", "September", "Oktober", "November", "Desember"]


def tanggal_id(iso):
    """'2026-08-13' -> '13 Agustus 2026' (tanpa nama hari)."""
    t, b, h = iso.split("-")
    return f"{int(h)} {BULAN_ID[int(b) - 1]} {t}"


def hal_sampul(bd, em, r, pr, cutoff):
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
    <div class="bd-vonis">{bd["vonis"]}</div>
    <div class="bd-cutoff">
      <span class="l">Batas Data</span>
      Seluruh angka terbitan ini ditutup pada sesi <b>{cutoff}</b> — perdagangan hari terbit
      ({bd["tanggal_id"]}) belum tercakup. Ini bukan data waktu nyata: harga, arus broker, dan
      probabilitas dihitung dari sesi bursa yang sudah selesai sebelum tanggal rilis.
    </div>
    <div class="cv-foot">
      <div class="cv-stats">{sel}</div>
      <div class="cv-legal">© {bd["tanggal_id"].split()[-1]} Johan Iriawan Akbar — PAPAN (Pusat Analisa Pasar Nusantara). Hak cipta dilindungi.<br>
      Analisis probabilistik, bukan ajakan transaksi. PCD = aproksimasi OHLCV, bukan data done per harga.<br>
      Data per {cutoff} (bukan waktu nyata) · sumber: Yahoo Finance &amp; Stockbit.</div>
    </div>
  </div>
</div>'''


def hal_pcd(bd, r):
    # Tampilan kurva dipotong ke persentil volume 0,5%–99,5%: ekor bin nyaris
    # nol (mis. jejak harga lama yang bobotnya sudah meluruh) memanjangkan
    # sumbu-x dan menggencet area bermakna. Angka PCD/persentil tetap dari
    # kurva utuh; batas diperluas agar garis PCD & close selalu tergambar.
    total = sum(v for _, v in r["kurva"])
    kum, lo_t, hi_t = 0.0, r["kurva"][0][0], r["kurva"][-1][0]
    for p, v in r["kurva"]:
        if kum / total < 0.005:
            lo_t = p
        kum += v
        if kum / total <= 0.995:
            hi_t = p
    lo_t = min(lo_t, r["close"], r["pcd"])
    hi_t = max(hi_t, r["close"], r["pcd"])
    kurva = [[p, round(v, 1)] for p, v in r["kurva"] if lo_t <= p <= hi_t]
    c = r["close"]
    posisi = ("di bawah zona" if c < r["p25"] else
              "di lapis bawah zona" if c < r["p50"] else
              "di lapis atas zona" if c < r["p75"] else "di atas zona")
    headline = (f'Modal pasar {bd["ticker"]} terkonsentrasi <b>{B.fmt(r["p25"])}</b>–'
                f'<b>{B.fmt(r["p75"])}</b>; close <b>{B.fmt(r["close"])}</b> {posisi}')
    rows_kiri = [("PCD — rata-rata modal", r["pcd"], "c-side"),
                 ("Median modal (p50)", r["p50"], ""),
                 ("Close terakhir", r["close"], "c-bull" if r["close"] >= r["pcd"] else "c-bear")]
    rows_kanan = [("Lapis modal bawah (p25)", r["p25"], "c-bull"),
                  ("Lapis modal atas (p75)", r["p75"], "c-bear"),
                  ("Modal di atas air", f'{B.fmt(r["diatas_air"]*100,1)}%', "")]
    lv = lambda rows: "\n".join(
        f'<div class="r"><span class="l">{n}</span><b class="{cls}">'
        f'{v if isinstance(v,str) else B.fmt(v)}</b></div>' for n, v, cls in rows)
    # Warna chart PCD dari palet.py (single sumber) — bukan hex sendiri:
    # batang untung = naik, batang rugi = redup (netral, bukan warna arah),
    # garis persentil & PCD = aksen (metrik andalan halaman ini), CLOSE = tinta.
    c_untung, c_rugi = palet.rgba(PAL["naik"], 0.42), palet.rgba(PAL["redup"], 0.30)
    c_persentil, c_pcd, c_close = PAL["aksen"], PAL["aksen"], PAL["tinta"]
    c_sumbu = palet.rgba(PAL["tinta"], 0.55)
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
      K.forEach(([p,v])=>{{x.fillStyle=p<=C?"{c_untung}":"{c_rugi}";
        x.fillRect(X(p)-bw/2,Y(v),bw,H-pad.b-Y(v));}});
      x.font="14px Cascadia Code, Consolas, monospace";x.textAlign="center";
      let taken=[];
      const garis=[["p25",P25,"{c_persentil}",1,[4,4]],["p50",P50,"{c_persentil}",1,[4,4]],
                   ["p75",P75,"{c_persentil}",1,[4,4]],["PCD "+PCDV.toLocaleString('id',{{maximumFractionDigits:0}}),PCDV,"{c_pcd}",2,[]],
                   ["CLOSE "+C.toLocaleString('id'),C,"{c_close}",2,[]]];
      garis.forEach(([lbl,p,c,w,dash])=>{{
        x.strokeStyle=c;x.lineWidth=w;x.setLineDash(dash);x.beginPath();
        x.moveTo(X(p),pad.t-4);x.lineTo(X(p),H-pad.b);x.stroke();x.setLineDash([]);
        let yl=12; while(taken.some(([tx,ty])=>ty===yl&&Math.abs(tx-X(p))<70)) yl+=15;
        taken.push([X(p),yl]);
        x.fillStyle=c;x.fillText(lbl,X(p),yl);
      }});
      x.fillStyle="{c_sumbu}";
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
      <h3 class="rule">Interpretasi Analis</h3>
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
    seri = ohlc[bd["ticker"]]
    rentang_cap = "1 Tahun" if len(seri) >= 252 else f'Sejak Listing ({seri[0]["d"]})'
    pool_lbl = (f'pool cache edisi {bd["edisi_sumber"]}' if "edisi_sumber" in bd
                else f'pool cache {bd["cache"]} + seri {bd["ticker"]} sendiri')
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
      <div class="cap">IDX · Harian · {rentang_cap} · EMA 20/50/60/100/200 · Volume &amp; Pivot</div>
      <canvas id="chT" width="1360" height="430"></canvas>
    </div>
    <div class="sec" style="margin-top:4mm">
      <h3 class="rule">Teknikal</h3>
      <p>{em["narasi_teknikal"]}</p>
    </div>
    <div class="sr">
      <div class="k sup">Support</div><div class="v">{sup}</div>
      <div class="k res">Resistance</div><div class="v">{res}</div>
    </div>
    {B.strip_prob(pr)}
    <div class="bd-note">Probabilitas dari backtest setup serupa (EMA50, pivot, volume 20h, rentang 20h)
    atas {pool_lbl}; n = jumlah sampel. Bukan jaminan — frekuensi historis.</div>
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
          <h3 class="rule">Arus Dana</h3>
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


def hal_broker_seri(bd, flow, peran=None):
    """Halaman arus broker dari SETORAN HARIAN multi-hari (bedah/flow-<TK>.json):
    (a) chart batang Big Money Flow per hari (net broker tampak, juta Rp)
        + total rentang, total 5 hari terakhir, breadth hari positif;
    (b) tabel broker hari terakhir (beli & jual — avg jual ikut tercatat);
    (c) modal rata-rata per broker lintas hari (agregat val & lot per broker
        -> avg tertimbang, aproksimasi modal akumulasi);
    (d) strip label Acc/Dist Stockbit per hari (+ ringkasan rentang bila ada)."""
    peran = peran or {"ritel": [], "scalper": []}
    hh = sorted(flow["harian"].items())
    hari = []
    for d, h in hh:
        tb = sum(r[1] for r in h["beli"]); tj = sum(r[1] for r in h["jual"])
        hari.append({"d": d, "net": tb - tj, "r": h["ringkas"]})
    total = sum(x["net"] for x in hari)
    tot5 = sum(x["net"] for x in hari[-5:])
    breadth = sum(1 for x in hari if x["net"] > 0)
    rp = lambda v: ("+" if v >= 0 else "−") + "Rp" + B.fmt_rp(abs(v)).replace("B", " miliar").replace("M", " juta")
    cls = lambda v: "bull" if v >= 0 else "bear"

    # (c) agregat per broker lintas hari
    agg = {}
    for d, h in hh:
        for kode, val, lot, _ in h["beli"]:
            a = agg.setdefault(kode, [0.0, 0, 0.0, 0]); a[0] += val; a[1] += lot
        for kode, val, lot, _ in h["jual"]:
            a = agg.setdefault(kode, [0.0, 0, 0.0, 0]); a[2] += val; a[3] += lot
    net_b = sorted(agg.items(), key=lambda kv: kv[1][2] - kv[1][0])
    avg = lambda val, lot: B.fmt(val * 1e4 / lot) if lot else "—"

    def baris_agg(kode, a):
        n = a[0] - a[2]
        return (f'<tr><td class="{"bcode-b" if n >= 0 else "bcode-s"}">{kode}</td>'
                f'<td class="{cls(n)}">{("+" if n >= 0 else "−")}{B.fmt_rp(abs(n))}</td>'
                f'<td>{avg(a[0], a[1])}</td><td>{avg(a[2], a[3])}</td></tr>')
    rows_agg = "\n".join(baris_agg(k, a) for k, a in net_b[:4] + net_b[:-5:-1])

    # (d) strip label per hari + ringkasan rentang
    def lcls(lbl):
        return "c-bull" if "Acc" in lbl else "c-bear" if "Dist" in lbl else ""
    strip = " · ".join(
        f'{x["d"][8:10]}/{x["d"][5:7]} <b class="{lcls(x["r"].get("label_avg",""))}">'
        f'{x["r"].get("label_avg", "—")}</b>' for x in hari)
    per_tbl = ""
    if flow.get("periode"):
        baris_per = []
        for k, v in flow["periode"].items():
            a, b = k.split("_")
            pct = f'{v["top5_pct"]:+.1f}'.replace(".", ",").replace("-", "−")
            baris_per.append(
                f'<tr><td>{a[8:10]}/{a[5:7]}–{b[8:10]}/{b[5:7]}</td>'
                f'<td class="{lcls(v["label_avg"])}">{v["label_avg"]}</td>'
                f'<td>{pct}%</td><td>{B.fmt(v["average_rp"])}</td></tr>')
        per_tbl = f'''<div class="sec" style="margin-bottom:4mm">
          <h3 class="rule">Rentang Stockbit <span class="r">modal rata-rata pasar per rentang</span></h3>
          <table class="brk">
            <tr><th>Rentang</th><th>Vonis</th><th>Top5</th><th>Avg Rp</th></tr>
            {chr(10).join(baris_per)}
          </table>
        </div>'''

    # (a) chart batang net per hari
    dchart = [[x["d"][8:10] + "/" + x["d"][5:7], round(x["net"], 1)] for x in hari]
    d_akhir, h_akhir = hh[-1]
    tgl_akhir = f"{d_akhir[8:10]}/{d_akhir[5:7]}"
    return f'''
<div class="page">
  {B.band(bd, "Arus Broker — Big Money Flow")}
  <div class="inner">
    <div class="trow" style="margin-bottom:3mm"><div class="tk" style="font-size:14pt">Arus Broker {bd["ticker"]}</div>
      <div class="px" style="font-size:8pt;color:var(--mute)">{len(hari)} hari setoran · {hari[0]["d"]} s.d. {hari[-1]["d"]}</div></div>
    <div class="chartwrap">
      <div class="cap">{bd["ticker"]} · Net Broker Tampak per Hari (juta Rp) · Broker Summary Stockbit</div>
      <canvas id="chBMF" width="1360" height="290"></canvas>
    </div>
    <script>
    (function(){{
      const D={json.dumps(dchart)};
      const cv=document.getElementById('chBMF'),x=cv.getContext('2d');
      const W=cv.width,H=cv.height,pad={{t:26,r:16,b:30,l:16}};
      const mx=Math.max(...D.map(d=>Math.abs(d[1])),1);
      const Y0=pad.t+(H-pad.t-pad.b)*mx/(2*mx);
      const Y=v=>Y0-v/mx*(H-pad.t-pad.b)/2;
      const bw=(W-pad.l-pad.r)/D.length;
      x.strokeStyle="rgba(18,32,46,.20)";x.lineWidth=1;
      x.beginPath();x.moveTo(pad.l,Y0);x.lineTo(W-pad.r,Y0);x.stroke();
      x.font="15px Cascadia Code, Consolas, monospace";x.textAlign="center";
      D.forEach(([d,v],i)=>{{
        const cx=pad.l+bw*(i+.5);
        x.fillStyle=v>=0?"rgba(18,135,63,.55)":"rgba(198,54,43,.55)";
        x.fillRect(cx-bw*.3,Math.min(Y0,Y(v)),bw*.6,Math.abs(Y0-Y(v))||1);
        x.fillStyle=v>=0?"#12873F":"#C6362B";
        const lbl=(v>=0?"+":"−")+Math.abs(v/1000).toLocaleString('id',{{maximumFractionDigits:1}})+"B";
        x.fillText(lbl,cx,v>=0?Y(v)-8:Y(v)+18);
        x.fillStyle="rgba(22,32,43,.55)";x.fillText(d,cx,H-8);
      }});
    }})();
    </script>
    <div class="bd-note" style="margin-top:1mm">VONIS HARIAN STOCKBIT: {strip}</div>
    <div class="cols" style="margin-top:3mm">
      <aside>
        <h3 class="rule">Broker Hari Terakhir <span class="r">{tgl_akhir} · top-9 tampak</span></h3>
        <table class="brk">
          <tr><th>BY</th><th>Nilai</th><th>Lot</th><th>Avg</th></tr>
          {B.baris_broker(h_akhir["beli"][:9], "b", peran)}
          <tr class="sep"><td colspan="4">Jual Terbesar</td></tr>
          {B.baris_broker(h_akhir["jual"][:9], "s", peran)}
          <tr class="tot"><td>NET</td><td colspan="3" class="{cls(hari[-1]["net"])}">{rp(hari[-1]["net"])}</td></tr>
        </table>
        <table class="brk" style="margin-top:3mm">
          <tr><th>Broker</th><th>Net {len(hari)}h</th><th>Avg Beli</th><th>Avg Jual</th></tr>
          {rows_agg}
        </table>
        <div class="brksrc">Avg = Σnilai ÷ Σlot, agregat {len(hari)} hari — bukan data done.</div>
      </aside>
      <section>
        {per_tbl}
        <div class="sec">
          <h3 class="rule">Arus Dana</h3>
          <p class="flowline"><span class="{cls(total)}">Σ rentang {rp(total)}</span> ·
            <span class="{cls(tot5)}">5 hari {rp(tot5)}</span> ·
            breadth {breadth}/{len(hari)} hari positif</p>
          <p style="text-align:justify">{bd["narasi_flow"]}</p>
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


def hal_broker_kosong(bd):
    """Halaman arus broker saat BELUM ada setoran Broker Summary sama sekali:
    panel keterangan jujur bergaya sama — bukan halaman kosong polos."""
    return f'''
<div class="page">
  {B.band(bd, "Arus Broker")}
  <div class="inner">
    <div class="trow" style="margin-bottom:4mm"><div class="tk" style="font-size:14pt">Arus Broker {bd["ticker"]}</div>
      <div class="px" style="font-size:8pt;color:var(--mute)">belum ada data broker</div></div>
    <div class="blok integritas" style="margin-top:4mm">
      <h3 class="rule">Belum Ada Setoran Broker Summary</h3>
      <p style="text-align:justify">Belum ada setoran Broker Summary untuk {bd["ticker"]} — analisa arus broker
      &amp; PCD per broker akan aktif setelah screenshot disetor (Admin → Bedah Arus Saham).</p>
    </div>
    <div class="blok" style="margin-top:5mm">
      <h3 class="rule">Dua Jenis Setoran yang Diterima</h3>
      <p style="text-align:justify"><b>Harian</b> — Broker Summary satu hari penuh; deret setoran harian
      dirangkai menjadi chart Big Money Flow (net broker besar per hari) dan tabel broker per hari.<br>
      <b>Rentang</b> — Broker Summary kumulatif satu rentang tanggal; dipakai untuk aproksimasi
      modal rata-rata per broker (total nilai ÷ total lot per broker).</p>
    </div>
    <div class="blok integritas" style="margin-top:5mm">
      <h3 class="rule">Kejujuran Data</h3>
      <p>{bd["catatan_flow"]}</p>
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


def bars_hibrida(ticker, harian):
    """Seri hibrida utk PCD (pengganti Done Summary yang tak tersedia di
    Stockbit): 60 hari terakhir pakai bar intraday 15 menit dari Yahoo —
    distribusi harga per bar jauh lebih sempit daripada bar harian, sehingga
    kurva modal periode berbobot terbesar jadi jauh lebih presisi. Riwayat
    lebih lama tetap bar harian. Tiap bar membawa 'umur' hari-bursa supaya
    bobot peluruhan pcd.py konsisten lintas granularitas.
    Gagal fetch -> seri harian apa adanya (label metode mengikuti)."""
    try:
        import yfinance as yf
        df = yf.Ticker(f"{ticker}.JK").history(period="60d", interval="15m")
        if df.empty:
            raise ValueError("intraday kosong")
    except Exception as e:
        print(f"  intraday gagal ({e}) — PCD memakai bar harian saja")
        return list(harian), None
    umur_hari = {b["d"]: len(harian) - 1 - i for i, b in enumerate(harian)}
    intra, tgl_intra = [], set()
    for ts, row in df.iterrows():
        d = ts.strftime("%Y-%m-%d")
        if d not in umur_hari or not row["Volume"]:
            continue
        tgl_intra.add(d)
        intra.append({"l": float(row["Low"]), "h": float(row["High"]),
                      "c": float(row["Close"]), "v": float(row["Volume"]),
                      "umur": umur_hari[d]})
    if not intra:
        return list(harian), None
    lama = [{**b, "umur": umur_hari[b["d"]]} for b in harian if b["d"] not in tgl_intra]
    return lama + intra, len(tgl_intra)


def ohlc_standalone(ticker, tanggal):
    """OHLC ~2 tahun harian utk bedah tanpa edisi sumber. Konvensi sama
    fetch_ohlc: end EKSKLUSIF di tanggal terbitan (bar terakhir = sesi
    terakhir sebelumnya). Cache di cache/ohlc-bedah-<TICKER>.json supaya
    build ulang tak fetch lagi."""
    p = AKAR / "cache" / f"ohlc-bedah-{ticker}.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    from datetime import date, timedelta
    import fetch_ohlc
    akhir = date.fromisoformat(tanggal)
    seri = fetch_ohlc.ambil(f"{ticker}.JK", akhir - timedelta(days=730), akhir)
    if not seri:
        sys.exit(f"fetch OHLC {ticker} kosong — periksa ticker/koneksi")
    p.write_text(json.dumps(seri, separators=(",", ":")), encoding="utf-8")
    print(f"OK -> {p} ({len(seri)} bar, {seri[0]['d']} s.d. {seri[-1]['d']})")
    return seri


def rakit_em(bd, seri):
    """`em` mode standalone: angka mesin dari OHLC (ohlc_hari, ema50, pivot
    klasik — formula sama build.py/level_ihsg, dibulatkan ke tick) + field
    analis dari blok bd["em"] (label, arah, narasi_teknikal, skenario)."""
    b, prev = seri[-1], seri[-2]
    P = (b["h"] + b["l"] + b["c"]) / 3
    rng = b["h"] - b["l"]
    piv = {"P": P, "R1": 2 * P - b["l"], "R2": P + rng, "R3": b["h"] + 2 * (P - b["l"]),
           "S1": 2 * P - b["h"], "S2": P - rng, "S3": b["l"] - 2 * (b["h"] - P)}
    t = PCD.tick_size(b["c"])
    piv = {k: round(v / t) * t for k, v in piv.items()}
    chg = b["c"] - prev["c"]
    em = {"ticker": bd["ticker"], "nama": bd["nama"],
          "ohlc_hari": {"o": b["o"], "h": b["h"], "l": b["l"], "c": b["c"],
                        "chg": chg, "pct": round(chg / prev["c"] * 100, 2),
                        "vol_juta": round(b["v"] / 1e6, 2)},
          "ema50": round(B.ema_seri([x["c"] for x in seri], 50)),
          "pivot": piv,
          "target": f'{B.fmt(piv["R1"])} / {B.fmt(piv["R2"])} / {B.fmt(piv["R3"])}',
          "invalidation": f'Close <{B.fmt(piv["S1"])}'}
    em.update(bd["em"])
    return em


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    stem = args[0] if args else "DSSA-2026-08-14"
    bd = json.loads((AKAR / "bedah" / f"{stem}.json").read_text(encoding="utf-8"))
    tk = bd["ticker"]
    ohlc = json.loads((AKAR / "cache" / f"ohlc-{bd['cache']}.json").read_text(encoding="utf-8"))
    if "edisi_sumber" in bd:
        ed_sumber = json.loads((AKAR / "edisi" / f"{bd['edisi_sumber']}.json").read_text(encoding="utf-8"))
        em = next(e for e in ed_sumber["emiten"] if e["ticker"] == tk)
    else:
        ed_sumber = None
        ohlc[tk] = ohlc_standalone(tk, bd["tanggal"])   # gabung ke pool prob
        em = rakit_em(bd, ohlc[tk])

    seri_pcd, n_hari_intra = bars_hibrida(tk, ohlc[tk])
    r = PCD.hitung_pcd(seri_pcd)
    if n_hari_intra:
        r["metode"] = (f"aproksimasi hibrida: intraday 15 menit ({n_hari_intra} hari bursa terakhir) "
                       "+ OHLCV harian utk riwayat lebih lama; volume disebar merata low–high per bar, "
                       f"peluruhan half-life {r['half_life']} hari bursa — bukan data done per harga")
    pr = prob.analisa_edisi(ohlc, [tk])[tk]

    flow_p = AKAR / "bedah" / f"flow-{tk}.json"
    if flow_p.exists():
        flow = json.loads(flow_p.read_text(encoding="utf-8"))
        hal4 = hal_broker_seri(bd, flow, ed_sumber["peran_broker"] if ed_sumber else None)
    elif ed_sumber:
        hal4 = hal_broker(bd, em, ed_sumber)
    else:
        hal4 = hal_broker_kosong(bd)

    # Batas data = sesi bursa terakhir yang masuk hitungan (bar terakhir OHLC),
    # BUKAN tanggal terbit — dicetak di sampul & legal supaya tidak disangka
    # waktu nyata (permintaan user 14 Agu).
    cutoff = tanggal_id(ohlc[bd["ticker"]][-1]["d"])
    pages = [BSTYLE + hal_sampul(bd, em, r, pr, cutoff), hal_pcd(bd, r),
             hal_teknikal(bd, em, ohlc, pr), hal4,
             hal_skenario(bd, em)]
    draw = [f'gambarChart("chT","{bd["ticker"]}",{em["ema50"]},{json.dumps(em["pivot"])});']

    tpl = (AKAR / "template.html").read_text(encoding="utf-8")
    html = (tpl.replace("{{JUDUL}}", f"Bedah Arus Saham {bd['edisi']}")
               .replace("/*PALET*/", palet.blok_css(EDISI_PALET))
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
