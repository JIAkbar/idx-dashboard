"""Transkripsi Broker Summary Stockbit dari screenshot -> draft JSON blok beli/jual.

Alur: upload screenshot orderbook -> Claude vision menyalin tabel apa adanya ->
script mengonversi sufiks (B/M/K) ke satuan edisi -> draft ditulis ke
arus-pasar/draft/<ticker>-<tanggal>.json dengan penanda "_verifikasi": "BELUM".

Cara pakai:
    python arus-pasar/transkrip_orderbook.py "data emiten/Screenshot 2026-08-10 211052.png" --ticker DSSA
    python arus-pasar/transkrip_orderbook.py gambar1.png gambar2.png --ticker DSSA --tanggal 2026-08-10
    python arus-pasar/transkrip_orderbook.py --selftest   # uji parsing/konversi tanpa API

API key: environment variable ANTHROPIC_API_KEY, atau baris
ANTHROPIC_API_KEY=... di file .env pada root proyek.

!!! DRAFT WAJIB DIVERIFIKASI MANUSIA SEBELUM MASUK EDISI JSON !!!
Angka salah lebih buruk dari kosong. Cocokkan tiap baris dengan screenshot
sebelum menempel ke edisi/<tanggal>.json. Field "_mentah" berisi teks persis
yang dibaca model — pakai itu untuk cek konversi.

Format target (lihat arus-pasar/edisi/2026-08-10.json):
    "beli"/"jual": list maks 10 baris [kode_broker, nilai_juta, lot, harga_avg]
    Stockbit menampilkan nilai dengan sufiks: 262.1B -> 262100 (juta rupiah),
    921.7M -> 921.7 (juta), lot 2.6M -> 2600000, 918.5K -> 918500.
"""

import argparse
import base64
import datetime as dt
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DRAFT_DIR = Path(__file__).resolve().parent / "draft"

MODEL = "claude-sonnet-5"
API_URL = "https://api.anthropic.com/v1/messages"

PROMPT = (
    "Screenshot berikut adalah tabel Broker Summary Stockbit untuk satu emiten. "
    "Kolom kiri = sisi BELI (BY, B.val, B.lot, B.avg), kolom kanan = sisi JUAL "
    "(SL, S.val, S.lot, S.avg). Salin tabel APA ADANYA sesuai skema JSON: "
    "untuk tiap baris tulis broker (kode 2 huruf), val, lot, avg PERSIS seperti "
    "tertulis di layar, termasuk sufiks B/M/K dan tanda koma (contoh: \"262.1B\", "
    "\"2.6M\", \"1,016\"). JANGAN menafsir, membulatkan, atau mengonversi angka. "
    "Kalau sebuah sel tidak terbaca jelas, isi null. Ambil semua baris yang "
    "terlihat, urut dari atas. Isi ticker dan tanggal dari header kalau terlihat, "
    "kalau tidak isi null."
)

ROW_SCHEMA = {
    "type": "object",
    "properties": {
        "broker": {"type": ["string", "null"]},
        "val": {"type": ["string", "null"]},
        "lot": {"type": ["string", "null"]},
        "avg": {"type": ["string", "null"]},
    },
    "required": ["broker", "val", "lot", "avg"],
    "additionalProperties": False,
}

SCHEMA = {
    "type": "object",
    "properties": {
        "ticker": {"type": ["string", "null"]},
        "tanggal": {"type": ["string", "null"]},
        "beli": {"type": "array", "items": ROW_SCHEMA},
        "jual": {"type": "array", "items": ROW_SCHEMA},
    },
    "required": ["ticker", "tanggal", "beli", "jual"],
    "additionalProperties": False,
}

MEDIA = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
         ".webp": "image/webp", ".gif": "image/gif"}


def load_api_key():
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key
    env = ROOT / ".env"
    if env.is_file():
        for line in env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("ANTHROPIC_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(
        "ANTHROPIC_API_KEY tidak ditemukan.\n"
        "Set dulu salah satu:\n"
        "  PowerShell : $env:ANTHROPIC_API_KEY = 'sk-ant-...'\n"
        f"  File .env  : tulis baris ANTHROPIC_API_KEY=sk-ant-... di {env}"
    )


def panggil_api(image_paths, api_key):
    import requests  # sudah ada di requirements

    content = []
    for p in image_paths:
        p = Path(p)
        media = MEDIA.get(p.suffix.lower())
        if not media:
            sys.exit(f"Format gambar tidak didukung: {p}")
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media,
                "data": base64.standard_b64encode(p.read_bytes()).decode(),
            },
        })
    content.append({"type": "text", "text": PROMPT})

    body = {
        "model": MODEL,
        "max_tokens": 16000,
        "output_config": {"format": {"type": "json_schema", "schema": SCHEMA}},
        "messages": [{"role": "user", "content": content}],
    }
    r = requests.post(
        API_URL,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=body,
        timeout=300,
    )
    if r.status_code != 200:
        sys.exit(f"API error {r.status_code}: {r.text[:2000]}")
    resp = r.json()
    if resp.get("stop_reason") == "refusal":
        sys.exit(f"Model menolak permintaan: {resp.get('stop_details')}")
    if resp.get("stop_reason") == "max_tokens":
        sys.exit("Output terpotong (max_tokens) — coba crop screenshot atau naikkan max_tokens.")
    text = next(b["text"] for b in resp["content"] if b["type"] == "text")
    return json.loads(text), resp.get("usage", {})


def angka(s, faktor_b, faktor_m, faktor_k):
    """'262.1B' -> 262100.0 (juta) dst. None kalau tak bisa dikonversi."""
    if not s:
        return None
    s = s.strip().replace(",", "")
    try:
        if s[-1] in "BbMmKk":
            n = float(s[:-1])
            n *= {"b": faktor_b, "m": faktor_m, "k": faktor_k}[s[-1].lower()]
        else:
            n = float(s)
    except (ValueError, IndexError):
        return None
    return int(n) if n == int(n) else round(n, 1)


def konversi_baris(row):
    """Row mentah -> [broker, nilai_juta, lot, harga_avg]; None untuk sel gagal."""
    broker = row["broker"].strip().upper() if row["broker"] else None
    val = angka(row["val"], 1000, 1, 0.001)      # ke juta rupiah
    lot = angka(row["lot"], 1e9, 1e6, 1e3) if row["lot"] and row["lot"].strip()[-1] in "BbMmKk" \
        else angka(row["lot"], 1, 1, 1)          # lot: sufiks = pengali biasa
    avg = angka(row["avg"], 1, 1, 1)
    return [broker, val, lot, avg]


def sanity(nama, baris_mentah, baris):
    total = sum(b[1] for b in baris if b[1] is not None)
    null_baris = [i + 1 for i, b in enumerate(baris) if None in b]
    print(f"  {nama}: {len(baris_mentah)} baris terbaca, {len(baris)} dipakai (maks 10). "
          f"Total nilai {total:,.1f} juta. Baris ber-null: {null_baris or 'tidak ada'}")
    return total


def proses(data, ticker, tanggal):
    ticker = (ticker or data.get("ticker") or "UNKNOWN").upper()
    tanggal = tanggal or dt.date.today().isoformat()

    draft = {"ticker": ticker, "tanggal": tanggal, "_verifikasi": "BELUM"}
    print(f"\nDraft {ticker} {tanggal} (tanggal di screenshot: {data.get('tanggal')})")
    totals = {}
    for sisi in ("beli", "jual"):
        mentah = data.get(sisi, [])
        baris = [konversi_baris(r) for r in mentah[:10]]
        draft[sisi] = baris
        totals[sisi] = sanity(sisi, mentah, baris)
    print(f"  Selisih beli-jual (top10): {totals['beli'] - totals['jual']:,.1f} juta")
    draft["_mentah"] = data  # teks persis dari model, buat verifikasi manual
    return draft


def selftest():
    """Uji parsing+konversi dengan respons mock (tanpa API). Gagal = assert error."""
    mock = {
        "ticker": "DSSA", "tanggal": "10 Aug 26",
        "beli": [
            {"broker": "XL", "val": "262.1B", "lot": "2.6M", "avg": "1,016"},
            {"broker": "CP", "val": "921.7M", "lot": "7.5K", "avg": "1,217"},
            {"broker": "??", "val": None, "lot": "100", "avg": "998"},
        ] + [{"broker": "AA", "val": "1B", "lot": "1K", "avg": "1,000"}] * 9,
        "jual": [{"broker": "cc", "val": "203.5B", "lot": "2M", "avg": "1,016"}],
    }
    d = proses(mock, "DSSA", "2026-08-10")
    assert d["beli"][0] == ["XL", 262100, 2600000, 1016], d["beli"][0]
    assert d["beli"][1] == ["CP", 921.7, 7500, 1217], d["beli"][1]
    assert d["beli"][2][1] is None                      # sel tak terbaca -> null
    assert len(d["beli"]) == 10                          # dipotong ke 10
    assert d["jual"][0] == ["CC", 203500, 2000000, 1016], d["jual"][0]
    assert d["_verifikasi"] == "BELUM"
    print("\nselftest OK")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("gambar", nargs="*", help="path screenshot orderbook (png/jpg)")
    ap.add_argument("--ticker", help="kode emiten, mis. DSSA")
    ap.add_argument("--tanggal", help="YYYY-MM-DD (default: hari ini)")
    ap.add_argument("--selftest", action="store_true", help="uji parsing tanpa API")
    args = ap.parse_args()

    if args.selftest:
        selftest()
        return
    if not args.gambar or not args.ticker:
        ap.error("butuh minimal satu gambar dan --ticker (atau pakai --selftest)")
    for g in args.gambar:
        if not Path(g).is_file():
            sys.exit(f"File tidak ditemukan: {g}")

    data, usage = panggil_api(args.gambar, load_api_key())
    draft = proses(data, args.ticker, args.tanggal)

    DRAFT_DIR.mkdir(exist_ok=True)
    out = DRAFT_DIR / f"{draft['ticker']}-{draft['tanggal']}.json"
    out.write_text(json.dumps(draft, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nToken: input={usage.get('input_tokens')} output={usage.get('output_tokens')}")
    print(f"Draft tersimpan: {out}")
    print("\n=== DRAFT (WAJIB diverifikasi manusia sebelum masuk edisi) ===")
    print(json.dumps({k: v for k, v in draft.items() if k != "_mentah"},
                     indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
