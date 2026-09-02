# -*- coding: utf-8 -*-
"""Rencana dagang + rekam jejak per emiten — isi kartu di halaman Kartu Analisa.

Asal: Johan 1 Sep 2026, menunjuk kartu "Rincian tiap saham" di artifact
horizon — *"nah buat seperti ini menarik page baru ketik saham atau ada preset
atau pakai filter muncul"*.

Yang dihasilkan per emiten, satu berkas untuk seluruh pasar:

  rencana  area beli · target 1 · target 2 · batas rugi · imbalan:risiko
  jejak    win rate 5 / 10 / 20 hari bursa, dengan menang·kalah·menggantung
           dan ekspektansi per sinyal
  konteks  nilai transaksi harian, gerak harian khas, panjang riwayat

## Kenapa dihitung di sini, bukan di peramban

Win rate per emiten menuntut menelusuri ratusan hari bursa untuk tiap emiten
dan tiap horizon. Di peramban itu berarti mengunduh seluruh riwayat 963
emiten. Di sini ia sekali jalan, hasilnya satu berkas kecil.

## Empat keputusan yang menentukan angkanya

1. **Aturan level PERSIS sama dengan produksi** — `rekap_preset.py`: target 1
   = penutupan + 1xATR, target 2 = +2xATR, batas = yang lebih rendah antara
   (penutupan - 1,5xATR) dan terendah 5 hari, semuanya dibulatkan ke tick
   bursa. Kalau kartu memakai rumus lain, angka win rate-nya tak menjelaskan
   apa-apa tentang sinyal yang benar-benar diterbitkan.

2. **Hari sinyal tak ikut dinilai.** Jendela mulai hari bursa berikutnya.
   Memasukkan hari sinyal berarti menilai aturan atas data yang dipakai
   membuatnya.

3. **Target dan batas tersentuh di hari yang sama = KALAH.** Data harian tak
   menyimpan urutannya. Memilih menang di situ berarti memilih asumsi yang
   menguntungkan diri sendiri di setiap kasus ambigu.

4. **Dua penyebut, selalu berdampingan.** `winRate` dari yang tuntas
   (menang+kalah) dan `winRateSemua` dari SELURUH sinyal termasuk yang
   menggantung. Yang pertama sendirian membuat aturan yang sering menggantung
   terlihat lebih baik daripada aturan yang selalu tuntas dan kadang kalah.

Jalankan dari akar repo:
    python scripts/riset/rencana_saham.py
    python scripts/riset/rencana_saham.py --uji
"""
from __future__ import annotations

import argparse
import json
import statistics as st
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(AKAR / "scripts" / "riset"))
from kartu_analisa import ke_fraksi  # noqa: E402  (rumus tick bursa — jangan disalin)

OHLC = AKAR / "data-idx" / "json" / "ohlc"
GUDANG = AKAR / "data-idx" / "json" / "ohlcv_stockbit"
KELUARAN = AKAR / "data-idx" / "json" / "rencana_saham.json"

HORIZON = [5, 10, 20]
N_SINYAL = 120      # hari sinyal yang dinilai — sama untuk semua horizon
ATR_HARI = 14
# Biaya transaksi pulang-pergi, sebagai pecahan. DIPAKAI ULANG dari benchmark
# 644 aturan (benchmarkAturan.ts: "eksR sesudah biaya transaksi 0,40%
# pulang-pergi"), bukan dikarang: dua angka biaya yang berbeda di dua halaman
# akan membuat aturan yang sama terbaca untung di satu tempat dan rugi di
# tempat lain.
BIAYA = 0.004
KELAS_BUKTI = "REKONSTRUKSI"   # aturan hari ini diterapkan ke masa lalu — bukan catatan harian
WIB = timezone(timedelta(hours=7))


def atr_persen(d: list, n: int = ATR_HARI) -> float | None:
    """Rentang harian khas, dalam persen terhadap penutupan."""
    r = [100 * (b[2] - b[3]) / b[4] for b in d[-n:] if b[4]]
    return st.median(r) if r else None


def level(harga: float, atr_pct: float, low5: float | None) -> dict:
    """PERSIS rumus produksi di rekap_preset.py — jangan diubah sepihak."""
    atr = harga * atr_pct / 100
    tp1 = ke_fraksi(harga + 1 * atr, "atas")
    tp2 = ke_fraksi(harga + 2 * atr, "atas")
    cand = harga - 1.5 * atr
    if low5 is not None:
        cand = min(low5, cand)
    sl = ke_fraksi(cand, "bawah")
    return {"tp1": tp1, "tp2": tp2, "sl": sl}


def telusuri(d: list, n_sinyal: int, horizon: int) -> dict:
    """Terapkan aturan ke tiap hari sinyal, hitung menang/kalah/menggantung.

    `d` = [[tanggal, open, high, low, close, volume], ...] urut naik.
    Sinyal diambil dari hari yang jendelanya MUAT — hari terakhir tak bisa
    dinilai untuk horizon 20 dan itu bukan kekurangan data, itu kenyataan.
    """
    menang = kalah = gantung = 0
    hasil_r = []
    mulai = max(ATR_HARI + 5, len(d) - n_sinyal - horizon)
    for i in range(mulai, len(d) - horizon):
        harga = d[i][4]
        if not harga:
            continue
        ap = atr_persen(d[: i + 1])
        if not ap:
            continue
        low5 = min(b[3] for b in d[i - 4: i + 1] if b[3]) if i >= 4 else None
        lv = level(harga, ap, low5)
        if not lv["tp1"] or not lv["sl"] or lv["sl"] >= harga:
            continue
        untung = (lv["tp1"] - harga) / harga
        rugi = (harga - lv["sl"]) / harga
        # keputusan (2): jendela mulai hari BERIKUTNYA
        selesai = False
        for b in d[i + 1: i + 1 + horizon]:
            kena_tp = b[2] >= lv["tp1"]
            kena_sl = b[3] <= lv["sl"]
            if kena_tp and kena_sl:      # keputusan (3): ambigu = kalah
                kalah += 1
                hasil_r.append(-rugi)
                selesai = True
                break
            if kena_sl:
                kalah += 1
                hasil_r.append(-rugi)
                selesai = True
                break
            if kena_tp:
                menang += 1
                hasil_r.append(untung)
                selesai = True
                break
        if not selesai:
            gantung += 1
            # menggantung dinilai pada penutupan terakhir jendela — ia posisi
            # yang masih terbuka, bukan nol
            akhir = d[i + horizon][4]
            if akhir and harga:
                hasil_r.append((akhir - harga) / harga)
    tuntas = menang + kalah
    n = menang + kalah + gantung
    rata = st.mean(hasil_r) if hasil_r else None
    return {
        "menang": menang, "kalah": kalah, "gantung": gantung, "n": n,
        "winRate": round(100 * menang / tuntas, 1) if tuntas else None,
        "winRateSemua": round(100 * menang / n, 1) if n else None,
        "ekspektansi": round(100 * rata, 3) if rata is not None else None,
        # Sesudah biaya pulang-pergi — INI angka utamanya di kartu. Sebelum
        # biaya cuma pembanding: aturan yang untung tipis sebelum biaya dan
        # rugi sesudahnya harus terbaca rugi.
        "ekspektansiBiaya": round(100 * (rata - BIAYA), 3) if rata is not None else None,
    }


def nilai_harian(kode: str) -> float | None:
    p = GUDANG / f"{kode}.json"
    if not p.exists():
        return None
    try:
        b = json.loads(p.read_text(encoding="utf-8"))["bar"][-20:]
    except Exception:
        return None
    v = [x[7] for x in b if x[7]]
    return st.median(v) if len(v) >= 10 else None


def jalankan() -> dict:
    baris = []
    berkas = sorted(OHLC.glob("*.json"))
    for j, p in enumerate(berkas, 1):
        kode = p.stem
        if kode == "IHSG":
            continue
        try:
            isi = json.loads(p.read_text(encoding="utf-8"))
            d = isi["d"]
        except Exception:
            continue
        if len(d) < ATR_HARI + 30:
            continue
        harga = d[-1][4]
        ap = atr_persen(d)
        if not harga or not ap:
            continue
        low5 = min(b[3] for b in d[-5:] if b[3])
        lv = level(harga, ap, low5)
        if not lv["tp1"] or not lv["sl"]:
            continue
        rr = ((lv["tp1"] - harga) / (harga - lv["sl"])) if harga > lv["sl"] else None
        jejak = {f"h{h}": telusuri(d, N_SINYAL, h) for h in HORIZON}
        prev = d[-2][4] if len(d) > 1 else None
        dua_pekan = d[-11][4] if len(d) > 11 else None
        baris.append({
            "kode": kode,
            "tanggal": d[-1][0],
            "harga": harga,
            "areaBeli": [min(b[3] for b in d[-1:]), harga],
            **lv,
            "rr": round(rr, 3) if rr else None,
            "atrPct": round(ap, 2),
            "ubah1h": round(100 * (harga - prev) / prev, 2) if prev else None,
            "ubah2p": round(100 * (harga - dua_pekan) / dua_pekan, 2) if dua_pekan else None,
            "nilaiHarian": nilai_harian(kode),
            "nBar": len(d),
            "mulai": d[0][0],
            "jejak": jejak,
        })
        if j % 200 == 0:
            print(f"    {j}/{len(berkas)}")
    return {
        "dibangun": datetime.now(WIB).isoformat(timespec="seconds"),
        "kelasBukti": KELAS_BUKTI,
        "biayaPct": round(100 * BIAYA, 2),
        "nSinyal": N_SINYAL, "horizon": HORIZON, "atrHari": ATR_HARI,
        "catatan": ("Target 1 = penutupan + 1xATR, target 2 = +2xATR, batas rugi = "
                    "yang lebih rendah antara (penutupan - 1,5xATR) dan terendah 5 hari. "
                    "Rumus yang sama dipakai menerbitkan sinyal harian. Win rate dihitung "
                    "dengan menerapkan aturan itu ke tiap hari sinyal di riwayat; hari "
                    "sinyal tak ikut dinilai, dan target-serta-batas di hari yang sama "
                    "dihitung kalah."),
        "emiten": sorted(baris, key=lambda x: -(x["nilaiHarian"] or 0)),
    }


def swauji() -> None:
    # naik lurus: target selalu kena lebih dulu
    naik = [["2026-01-%02d" % (i + 1), 100 + i, 101 + i, 99 + i, 100 + i, 1000]
            for i in range(60)]
    r = telusuri(naik, 30, 5)
    assert r["menang"] > r["kalah"], r

    # turun lurus: batas selalu kena
    turun = [["2026-01-%02d" % (i + 1), 200 - i, 201 - i, 199 - i, 200 - i, 1000]
             for i in range(60)]
    r = telusuri(turun, 30, 5)
    assert r["kalah"] > r["menang"], r

    # datar sempurna: tak ada yang tersentuh -> semua menggantung
    datar = [["2026-01-%02d" % (i + 1), 100, 100, 100, 100, 1000] for i in range(60)]
    r = telusuri(datar, 30, 5)
    assert r["menang"] == 0 and r["kalah"] == 0, r

    # dua penyebut hadir bersamaan
    assert set(r) >= {"winRate", "winRateSemua", "ekspektansi"}

    # level PERSIS rumus produksi: harga 1000, atr 5% -> tp1 1050, tp2 1100
    lv = level(1000, 5.0, None)
    assert lv["tp1"] == 1050 and lv["tp2"] == 1100 and lv["sl"] == 925, lv

    print("swauji rencana_saham: 5 kasus lolos")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()
    if a.uji:
        swauji()
        sys.exit(0)
    h = jalankan()
    KELUARAN.write_text(json.dumps(h, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"  {len(h['emiten'])} emiten · {KELUARAN.stat().st_size/1024:.0f} KB")
    print(f"  ditulis: {KELUARAN.relative_to(AKAR)}")
