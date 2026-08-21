"""Segarkan ruas BERBASIS HARGA di data-idx/json/fundamental/<KODE>.json dari
OHLC milik PAPAN sendiri — NOL JARINGAN.

Johan 22 Agu 2026: *"data daily ini mah, harusnya update yaa setiap setelah
panen, perlu buat workflow nya nih jadi basi"* — halaman Stock Detail
menampilkan ARCI Rp1.200 "diperbarui 2026-08-13 21:09" padahal harga
penutupan 21 Agu sudah Rp1.395. Sebabnya `fetch_fundamental.py` (yfinance,
~8 permintaan × 965 emiten) hanya dijadwalkan BULANAN, sementara `ohlc/`
dipanen tiap hari bursa.

## Kenapa bukan sekadar menjalankan pemanen penuh tiap hari

Pemanen penuh butuh jaringan ke Yahoo untuk tiap emiten dan berjeda 0,5 detik
per ticker (pola anti-bot) — puluhan menit, rawan rate limit, dan sebagian
besar hasilnya (laporan keuangan kuartalan) memang tak berubah harian.
Yang basi tiap hari hanyalah HARGA dan ruas yang murni fungsi harga.

## Ruas yang disegarkan — dan buktinya boleh dihitung ulang

Aturan proyek melarang menurunkan satu ruas dari ruas lain tanpa memeriksa
definisinya lebih dulu (lihat CLAUDE.md soal skala rasio: `der` persen vs
`der_q` rasio, 99,4× meleset tanpa satu pun galat). Karena itu tiap ruas di
bawah DIUKUR dulu terhadap nilai yang sudah tersimpan — rasio "hitung ulang
vs tersimpan" diambil mediannya atas sampel acak 150-250 berkas, 22 Agu 2026:

    market_cap  = harga × shares          median 1,0000  (n=194)
    pe          = harga / eps             median 1,0000  (n=135)
    pbv         = harga / bv              median 1,0000  (n=188)
    earn_yield  = eps / harga × 100       median 1,0000  (n=187)
    ps          = harga / rev_ps          median 1,0000  (n=238)
    price_fcf   = harga / fcf_ps          median 1,0000  (n=228)
    week52_low  = low 252 bar OHLC        median 1,0000  (n=138)
    week52_high = high 252 bar OHLC       median 1,0000  (n=138)
    week52_change_pct = harga / close 252 bar lalu − 1   median 0,9921 (n=127)

Ruas lain yang juga bergantung harga (`ev_ebitda`, `price_cf`, `target_price`,
`dividend_yield`, dst.) SENGAJA TIDAK disentuh: definisinya belum diukur, dan
menebaknya berarti mengarang angka yang terlihat resmi. Ia tetap membawa nilai
dari panen terakhir — itu jujur, dan `harga_pada` di bawah membuat pembaca
bisa tahu.

## Dua stempel waktu, bukan satu

`diperbarui` TIDAK diubah — itu kapan laporan keuangan dipanen. Yang
ditambahkan `harga_pada` (tanggal bar OHLC) dan `harga_disegarkan` (waktu
skrip jalan). Menimpa `diperbarui` akan membuat laporan keuangan bulan lalu
tampak sesegar harga hari ini — persis jenis kebohongan senyap yang mahal.

Pakai:
    python scripts/segarkan_harga_fundamental.py            # semua emiten
    python scripts/segarkan_harga_fundamental.py BBCA ARCI  # sebagian
    python scripts/segarkan_harga_fundamental.py --uji      # swauji, tak menulis
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
DIR_FUND = AKAR / "data-idx" / "json" / "fundamental"
DIR_OHLC = AKAR / "data-idx" / "json" / "ohlc"

HARI_52W = 252  # hari bursa dalam setahun (konvensi sama dengan kartu_analisa)


def baca(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def bar_ohlc(kode: str) -> list | None:
    """Baris OHLC ber-close, urut lama→baru. None kalau berkasnya tak ada."""
    d = baca(DIR_OHLC / f"{kode}.json")
    if not d:
        return None
    baris = [b for b in (d.get("d") or []) if b and b[4]]
    return baris or None


def hitung(fd: dict, bar: list) -> dict:
    """Ruas baru untuk satu emiten. Ruas yang penyusunnya tak ada di `fd`
    (mis. `eps` kosong) DILEWATI — bukan diisi None, karena None di sini akan
    menghapus nilai lama yang masih sah."""
    b = bar[-1]
    harga = b[4]
    baru: dict = {
        "last_price": harga,
        "harga_pada": b[0],
        "harga_disegarkan": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    if len(bar) >= 2:
        baru["prev_close"] = bar[-2][4]

    jendela = bar[-HARI_52W:]
    lo = min((x[3] for x in jendela if x[3]), default=None)
    hi = max((x[2] for x in jendela if x[2]), default=None)
    if lo:
        baru["week52_low"] = lo
    if hi:
        baru["week52_high"] = hi
    if len(bar) > HARI_52W:
        setahun = bar[-(HARI_52W + 1)][4]
        if setahun:
            baru["week52_change_pct"] = round((harga / setahun - 1) * 100, 2)

    def ada(k: str):
        v = fd.get(k)
        return v if isinstance(v, (int, float)) and v not in (0,) else None

    shares = ada("shares")
    if shares:
        baru["market_cap"] = harga * shares
    eps = ada("eps")
    if eps and eps > 0:
        baru["pe"] = harga / eps
        baru["earn_yield"] = eps / harga * 100
    bv = ada("bv")
    if bv and bv > 0:
        baru["pbv"] = harga / bv
    rev_ps = ada("rev_ps")
    if rev_ps and rev_ps > 0:
        baru["ps"] = harga / rev_ps
    fcf_ps = ada("fcf_ps")
    if fcf_ps and fcf_ps > 0:
        baru["price_fcf"] = harga / fcf_ps
    return baru


def segarkan(kode_terpilih: list[str] | None = None) -> dict:
    kode = kode_terpilih or sorted(p.stem for p in DIR_FUND.glob("*.json") if p.stem != "index")
    hasil = {"disegarkan": 0, "tanpa_ohlc": 0, "tak_berubah": 0, "tanggal": None}
    for k in kode:
        pf = DIR_FUND / f"{k}.json"
        fd = baca(pf)
        if not fd:
            continue
        bar = bar_ohlc(k)
        if not bar:
            hasil["tanpa_ohlc"] += 1
            continue
        baru = hitung(fd, bar)
        hasil["tanggal"] = max(hasil["tanggal"] or "", baru["harga_pada"])
        # Bandingkan TANPA stempel waktu — kalau harga & turunannya sama,
        # berkasnya tak ditulis ulang supaya diff git tetap kecil dan
        # `git status` jujur menunjukkan apa yang benar-benar berubah.
        pembanding = {x: v for x, v in baru.items() if x != "harga_disegarkan"}
        if all(fd.get(x) == v for x, v in pembanding.items()):
            hasil["tak_berubah"] += 1
            continue
        fd.update(baru)
        pf.write_text(json.dumps(fd, ensure_ascii=False), encoding="utf-8")
        hasil["disegarkan"] += 1
    return hasil


def uji() -> None:
    """Swauji dengan deret buatan — angka acuannya dihitung tangan."""
    bar = [[f"2026-01-{i+1:02d}", 100, 110, 90, 100 + i, 1000] for i in range(300)]
    fd = {"shares": 1_000_000, "eps": 10.0, "bv": 50.0, "rev_ps": 20.0,
          "fcf_ps": 5.0, "diperbarui": "2026-08-13 21:09"}
    b = hitung(fd, bar)
    harga = bar[-1][4]  # 100 + 299 = 399
    assert b["last_price"] == harga == 399, b["last_price"]
    assert b["prev_close"] == 398
    assert b["market_cap"] == 399 * 1_000_000
    assert abs(b["pe"] - 39.9) < 1e-9
    assert abs(b["pbv"] - 399 / 50) < 1e-9
    assert abs(b["earn_yield"] - (10 / 399 * 100)) < 1e-9
    assert abs(b["ps"] - 399 / 20) < 1e-9
    assert abs(b["price_fcf"] - 399 / 5) < 1e-9
    # 52 minggu dihitung dari 252 bar TERAKHIR saja
    assert b["week52_high"] == 110 and b["week52_low"] == 90
    setahun = bar[-253][4]
    assert abs(b["week52_change_pct"] - round((harga / setahun - 1) * 100, 2)) < 1e-9
    # `diperbarui` tak boleh ikut tersentuh — dua stempel, bukan satu
    assert "diperbarui" not in b and b["harga_pada"] == bar[-1][0]
    # ruas yang penyusunnya kosong tak diisi None (menghapus nilai lama)
    kosong = hitung({"shares": None, "eps": 0}, bar)
    assert "market_cap" not in kosong and "pe" not in kosong
    print("OK  segarkan_harga_fundamental: 12 pemeriksaan lolos")


if __name__ == "__main__":
    if "--uji" in sys.argv:
        uji()
        raise SystemExit(0)
    pilih = [a.upper() for a in sys.argv[1:] if not a.startswith("--")] or None
    h = segarkan(pilih)
    print(f"harga disegarkan: {h['disegarkan']} berkas · tak berubah {h['tak_berubah']} · "
          f"tanpa OHLC {h['tanpa_ohlc']} · bar terakhir {h['tanggal']}")
