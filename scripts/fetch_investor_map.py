# -*- coding: utf-8 -*-
"""Harvester peta investor (kepemilikan saham >= 1%, sumber KSEI via IDX).

Sumber: pengumuman bursa bulanan "Pemegang Saham di atas 1% (KSEI)"
(Peng-LKS-xxxxx/BEI.PLP/MM-YYYY, kode "Semua Emiten Saham"), terbit tiap
awal bulan di idx.co.id > Berita > Pengumuman. Lampiran lamp1 = PDF berisi
seluruh baris kepemilikan >=1% semua emiten (data per akhir bulan lalu).

Endpoint listing: /primary/NewsAnnouncement/GetAllAnnouncement
(Cloudflare menolak request non-browser -> wajib page.evaluate(fetch)
dari dalam halaman idx.co.id, pola sama dengan fetch_broker_summary.py).

Output: data-idx/json/investor_map.json (format sama persis dengan file lama:
list of {code, issuer, holders:[{name, cls, lf, pct}]}) + investor_map.meta.json.
Backup sekali: investor_map.json.bak-2026-06.

Cara pakai:
  python scripts/fetch_investor_map.py                 # otomatis: cari pengumuman terbaru
  python scripts/fetch_investor_map.py --pdf "data owner/xxx_lamp1.pdf"   # parse PDF lokal
  python scripts/fetch_investor_map.py --dry-run       # parse + validasi tanpa menimpa
"""
import argparse, base64, json, re, shutil, sys
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUT = ROOT / "data-idx" / "json" / "investor_map.json"
META = ROOT / "data-idx" / "json" / "investor_map.meta.json"
BAK = ROOT / "data-idx" / "json" / "investor_map.json.bak-2026-06"
PDF_DIR = ROOT / "data owner"

HALAMAN = "https://www.idx.co.id/id/berita/pengumuman"
# keyword "KSEI" (bukan frasa panjang): pencarian endpoint berbasis kata dan
# frasa ber-angka "di atas 1" tidak pernah match (diverifikasi 13 Agu 2026 —
# frasa lama 0 hasil, "KSEI" menemukan Peng-LKS 1% Jun 2026). Judul difilter
# lagi di cari_pengumuman().
ENDPOINT = ("https://www.idx.co.id/primary/NewsAnnouncement/GetAllAnnouncement"
            "?locale=id-id&pageNumber=1&pageSize=50"
            "&keywords=KSEI&dateFrom={f}&dateTo={t}")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "Chrome/124.0.0.0 Safari/537.36")
JS_FETCH = """async (url) => {
  const r = await fetch(url, {headers: {"Accept": "application/json"}});
  return {status: r.status, body: await r.text()};
}"""
# PDF binary -> base64 (btoa per-chunk supaya tidak overflow argumen)
JS_FETCH_B64 = """async (url) => {
  const r = await fetch(url);
  if (!r.ok) return {status: r.status, b64: null};
  const buf = new Uint8Array(await r.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 32768)
    s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
  return {status: r.status, b64: btoa(s)};
}"""

DATE_RE = re.compile(r"^\d{2}-[A-Za-z]{3}-\d{4}")


# ---------------------------------------------------------------- pengumuman

def cari_pengumuman(pg):
    """Return item pengumuman '1% (KSEI)' terbaru (dict) atau None."""
    # pengumuman 1% terbit bulanan tapi bisa absen berbulan-bulan (Jul-Agu
    # 2026 kosong) -> cari mundur per jendela 60 hari sampai 240 hari ke
    # belakang, berhenti begitu ketemu yang terbaru.
    hari_ini = date.today()
    for mundur in range(0, 240, 60):
        t = hari_ini - timedelta(days=mundur)
        f = hari_ini - timedelta(days=mundur + 60)
        url = ENDPOINT.format(f=f.strftime("%Y%m%d"), t=t.strftime("%Y%m%d"))
        res = pg.evaluate(JS_FETCH, url)
        if res["status"] != 200:
            raise RuntimeError(f"GetAllAnnouncement HTTP {res['status']}")
        items = json.loads(res["body"]).get("Items") or []
        calon = [it for it in items
                 if "di atas 1%" in (it.get("Title") or "")
                 and "KSEI" in (it.get("Title") or "")
                 and "Semua Emiten" in (it.get("Code") or "")]
        if calon:
            calon.sort(key=lambda it: it.get("PublishDate") or "", reverse=True)
            return calon[0]
    return None


def unduh_lampiran(pg, item):
    """Download lamp1 (IsAttachment=1) ke data owner/. Return path lokal."""
    att = [a for a in item.get("Attachments") or [] if a.get("IsAttachment") in (1, "1")]
    if not att:
        raise RuntimeError("pengumuman tanpa lampiran lamp1")
    a = att[0]
    tujuan = PDF_DIR / a["OriginalFilename"]
    if tujuan.exists():
        print(f"  lampiran sudah ada: {tujuan.name}")
        return tujuan
    print(f"  download {a['OriginalFilename']} ...")
    res = pg.evaluate(JS_FETCH_B64, a["FullSavePath"])
    if res["status"] != 200 or not res["b64"]:
        raise RuntimeError(f"download lampiran HTTP {res['status']}")
    PDF_DIR.mkdir(exist_ok=True)
    tujuan.write_bytes(base64.b64decode(res["b64"]))
    print(f"  tersimpan: {tujuan} ({tujuan.stat().st_size//1024} KB)")
    return tujuan


# ---------------------------------------------------------------------- parse

def _kolom_starts(rows, min_gap):
    """Deteksi x0 awal kolom dari modus x0 kata per baris.

    Kolom PDF KSEI rata kiri: kata pertama tiap sel selalu mulai di x0 yang
    sama antar baris. Ambil nilai x0 yang muncul di >=40% baris. Modus palsu
    muncul kalau banyak nilai sekolom berawalan kata sama (mis. "BANK ",
    "PT. ") sehingga kata KEDUA pun sejajar — jarak modus palsu ke awal kolom
    aslinya < lebar satu kata, sedangkan jarak antar kolom asli jauh lebih
    lebar -> saring dengan min_gap (skala lebar halaman).
    """
    c = Counter()
    for ws in rows:
        for x in {round(w["x0"], 1) for w in ws}:
            c[x] += 1
    ambang = max(2, int(len(rows) * 0.4))
    starts = sorted(x for x, n in c.items() if n >= ambang)
    hasil = []
    for x in starts:
        if hasil and x - hasil[-1] < min_gap:
            continue
        hasil.append(x)
    return hasil


def parse_pdf(path):
    """Parse PDF lampiran -> list baris {code, issuer, name, cls, lf, pct}."""
    import pdfplumber

    out, ditolak = [], 0
    with pdfplumber.open(path) as pdf:
        # tinggi huruf data = modus tinggi kata di halaman 2 (halaman data murni;
        # halaman 1 tercampur teks sampul/penafian dengan tinggi huruf berbeda)
        ref = pdf.pages[1 if len(pdf.pages) > 1 else 0].extract_words()
        h_data = Counter(round(w["bottom"] - w["top"], 1) for w in ref).most_common(1)[0][0]

        for pg in pdf.pages:
            words = [w for w in pg.extract_words()
                     if abs((w["bottom"] - w["top"]) - h_data) <= 0.15]
            # grup per baris (top)
            baris = {}
            for w in words:
                baris.setdefault(round(w["top"] * 2) / 2, []).append(w)
            rows = [sorted(ws, key=lambda w: w["x0"]) for _, ws in sorted(baris.items())]
            # baris data = diawali tanggal DD-Mon-YYYY
            rows = [ws for ws in rows if DATE_RE.match(ws[0]["text"])]
            if not rows:
                continue
            # ponytail: min_gap 2.5% lebar halaman — cukup memisahkan kolom asli
            # (gap terkecil ~27pt/612) dari modus palsu prefiks kata (<20pt)
            starts = _kolom_starts(rows, pg.width * 0.025)
            if len(starts) < 5:
                ditolak += len(rows)
                continue
            b = starts  # date+code | issuer | investor | cls | lf | nat | dom ...

            def sel(ws, i):
                lo = b[i] - 1
                hi = b[i + 1] - 1 if i + 1 < len(b) else None
                return " ".join(w["text"] for w in ws
                                if w["x0"] >= lo and (hi is None or w["x0"] < hi))

            for ws in rows:
                datecode = sel(ws, 0)
                code = DATE_RE.sub("", datecode).strip()
                issuer = sel(ws, 1)
                name = sel(ws, 2)
                cls = sel(ws, 3)
                # nat/dom kadang kosong -> batas kanan interval lf bisa meleset;
                # nilai sahnya satu huruf, ambil kata pertama interval saja
                lf = (sel(ws, 4).split() or [""])[0]
                pct_txt = ws[-1]["text"]
                try:
                    pct = float(pct_txt.replace(".", "").replace(",", "."))
                except ValueError:
                    ditolak += 1
                    continue
                # lf/cls boleh kosong: sebagian baris sumber memang blank
                # (termasuk pemegang besar, mis. 81.54% AMAN) — jangan dibuang
                if (not re.fullmatch(r"[A-Z0-9]{4}", code) or not name
                        or lf not in ("L", "F", "") or not 0 < pct <= 100
                        or any(ch.isdigit() for ch in cls)):
                    ditolak += 1
                    continue
                out.append({"code": code, "issuer": issuer, "name": name,
                            "cls": cls, "lf": lf, "pct": round(pct, 2)})
    if ditolak:
        print(f"  peringatan: {ditolak} baris ditolak validasi per-baris")
    return out


def susun_map(baris):
    """Baris datar -> format investor_map.json (list per emiten)."""
    per = {}
    for r in baris:
        em = per.setdefault(r["code"], {"code": r["code"], "issuer": r["issuer"],
                                        "holders": []})
        em["holders"].append({"name": r["name"], "cls": r["cls"],
                              "lf": r["lf"], "pct": r["pct"]})
    for em in per.values():
        em["holders"].sort(key=lambda h: -h["pct"])
    return [per[k] for k in sorted(per)]


# ------------------------------------------------------------------ validasi

def validasi(baru, lama):
    """Return list masalah (kosong = lolos)."""
    m = []
    if lama:
        batas = int(len(lama) * 0.9)
        if len(baru) < batas:
            m.append(f"emiten hasil baru {len(baru)} < 90% dari lama ({len(lama)} -> batas {batas})")
    for em in baru[:50] + baru[-50:]:
        for h in em["holders"]:
            if set(h) != {"name", "cls", "lf", "pct"}:
                m.append(f"field holder tidak cocok di {em['code']}: {sorted(h)}")
                break
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", help="parse PDF lampiran lokal (lewati download)")
    ap.add_argument("--dry-run", action="store_true", help="jangan timpa output")
    args = ap.parse_args()

    sumber_info = {}
    if args.pdf:
        pdf_path = Path(args.pdf)
        sumber_info = {"mode": "manual-pdf", "file": pdf_path.name}
    else:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            pg = browser.new_page(user_agent=UA)
            print("Membuka halaman pengumuman IDX...")
            pg.goto(HALAMAN, wait_until="domcontentloaded", timeout=45000)
            pg.wait_for_timeout(3000)
            item = cari_pengumuman(pg)
            if not item:
                print("GAGAL: pengumuman 'Pemegang Saham di atas 1% (KSEI)' tidak "
                      "ditemukan 240 hari terakhir.\nAlternatif: download manual "
                      "lampirannya dari idx.co.id/id/berita/pengumuman lalu jalankan "
                      "dengan --pdf <path>.")
                sys.exit(1)
            print(f"  pengumuman: {item['AnnouncementNo']} ({item['PublishDate'][:10]})")
            pdf_path = unduh_lampiran(pg, item)
            sumber_info = {"mode": "otomatis", "announcement_no": item["AnnouncementNo"],
                           "publish_date": item["PublishDate"], "file": pdf_path.name}
            browser.close()

    print(f"Parse {pdf_path.name} ...")
    baris = parse_pdf(pdf_path)
    baru = susun_map(baris)
    print(f"  {len(baris)} baris kepemilikan, {len(baru)} emiten")

    lama = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else []
    masalah = validasi(baru, lama)
    if masalah:
        print("TOLAK TIMPA — validasi gagal:")
        for x in masalah:
            print("  -", x)
        sys.exit(1)
    print(f"Validasi OK (lama {len(lama)} emiten -> baru {len(baru)})")

    if args.dry_run:
        print("--dry-run: tidak menimpa.")
        return

    if OUT.exists() and not BAK.exists():
        shutil.copy2(OUT, BAK)
        print(f"  backup: {BAK.name}")
    OUT.write_text(json.dumps(baru, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    META.write_text(json.dumps({
        "updated": date.today().isoformat(),
        "n_emiten": len(baru),
        "n_baris": len(baris),
        **sumber_info,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK: {OUT} ({OUT.stat().st_size//1024} KB, {len(baru)} emiten)")


if __name__ == "__main__":
    main()
