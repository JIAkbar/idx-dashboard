# -*- coding: utf-8 -*-
"""Panen Broker Summary PER EMITEN — lapis yang selama ini hanya bisa datang
dari setoran tangkapan layar kontributor.

Johan 22 Agu 2026: *"coba pertimbangkan juga soal Stockbit Exodus, coba kita
kerjakan"*.

## Kenapa ini ada

Analisa PAPAN v1 berdiri di tiga lapis, dan lapis pertamanya — arus broker
multi-hari — TIDAK ADA di satu pun endpoint publik IDX. `GetBrokerSummary`
mengabaikan `stockCode` (diuji ulang 22 Agu: `?stockCode=BBCA` dan
`?stockCode=BUMI` mengembalikan 88 baris identik sampai ke `IDBrokerSummary`),
jadi selama ini satu-satunya jalan adalah kontributor memotret layar Stockbit.

Skrip ini menambah jalan kedua. Ia TIDAK menggantikan setoran kontributor:
setoran tetap jadi bukti yang dikurasi manusia dan dasar jenjang. Yang berubah,
kandidat Deep Dive bisa diperiksa lebih dulu tanpa menunggu ada yang menyetor.

## Dua sumber, sengaja bukan satu

| | `indexalpha` | `stockbit` |
|---|---|---|
| Sifat | API resmi berlangganan | API internal aplikasi, dipakai dengan token akun sendiri |
| Kuota | 5 ticker/hari (gratis), 25.000/bulan (Rp200rb) | tak diumumkan |
| Kunci | token permanen dari dasbor | JWT dari peramban yang sedang login, umur ±24 jam |
| Rentang | teragregasi: 1 baris per broker untuk seluruh rentang | sama |
| Bonus | — | `bandar_detector` (top1/top5 akumulasi-distribusi) |
| Riwayat | sejak 2025-01-01 | belum terukur |

Keduanya menulis ke BENTUK YANG SAMA supaya pembacanya tak perlu tahu asalnya.

## Yang TIDAK diklaim skrip ini

Ekuivalensi ruas antar-sumber **belum terukur**. `brokers_buy[].bval` Stockbit
(mode `TRANSACTION_TYPE_NET`) belum tentu berarti sama dengan `buy_value` Index
Alpha — yang satu bisa saja sudah bersih, yang lain kotor. Sesuai aturan
CLAUDE.md "ukur definisinya dulu sebelum menurunkan satu ruas dari ruas lain",
keduanya disimpan APA ADANYA berikut penanda `sumber`, dan penggabungan
angkanya ditunda sampai rasio hitung-ulang-vs-tersimpan benar-benar diukur.
`bandingkan_sumber()` di bawah menyiapkan pengukuran itu; ia melaporkan, tidak
mengoreksi.

## Rahasia

Token dibaca dari `app/.env.local` (sudah ber-gitignore lewat `*.local`) atau
dari lingkungan. Kuncinya:

    STOCKBIT_TOKEN=eyJ...        # JWT dari peramban, lihat --bantuan-token
    INDEXALPHA_TOKEN=ia_live_... # dari dasbor indexalpha.id

Skrip TIDAK pernah mencetak tokennya, termasuk saat galat.

## Mentahnya disimpan

Balasan JSON mentah diarsipkan ke `_arsip-mentah/broker-emiten/` (di luar git).
Aturan CLAUDE.md: yang mahal itu MENGAMBIL data, bukan menyimpannya — dan di
sini lebih mahal lagi, karena kuota gratis 5 ticker/hari berarti satu panen
yang terbuang butuh sehari penuh untuk diulang.

Pakai:
    python scripts/panen_broker_emiten.py BUMI --dari 2026-08-03 --sampai 2026-08-14
    python scripts/panen_broker_emiten.py BUMI --sumber indexalpha
    python scripts/panen_broker_emiten.py --bantuan-token
    python scripts/panen_broker_emiten.py --uji        # swauji, nol jaringan
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).resolve().parent.parent
ENV_LOCAL = AKAR / "app" / ".env.local"
KELUARAN = AKAR / "data-idx" / "json" / "broker_emiten"
ARSIP = AKAR / "_arsip-mentah" / "broker-emiten"

WIB = timezone(timedelta(hours=7))

STOCKBIT_BASE = "https://exodus.stockbit.com"
INDEXALPHA_BASE = "https://api.indexalpha.id"

BANTUAN_TOKEN = """
Cara mengambil token Stockbit (dilakukan SENDIRI di peramban, tidak lewat skrip):

  1. Buka https://stockbit.com dan login seperti biasa.
  2. Buka satu halaman Broker Summary, mis.
     https://stockbit.com/symbol/BBCA/broker-summary
  3. Buka DevTools (F12) -> tab Network -> saring "marketdetectors".
  4. Klik permintaannya, lihat Request Headers, salin isi header
     Authorization SESUDAH kata "Bearer ".
  5. Tempel ke app/.env.local sebagai satu baris:

         STOCKBIT_TOKEN=eyJhbGciOi...

Umurnya sekitar 24 jam. Kalau skrip menjawab "token kedaluwarsa", ulangi
langkah 3-5. Token Index Alpha permanen dan diambil dari dasbornya sendiri
(indexalpha.id/dashboard -> API Keys), disimpan sebagai INDEXALPHA_TOKEN.
"""


# ── Rahasia ─────────────────────────────────────────────────────────────────
def baca_env() -> dict[str, str]:
    """Isi `app/.env.local`, digabung dengan variabel lingkungan (yang menang).

    Pola sama `scripts/backup_screenshot.py` — sengaja tidak menarik pustaka
    dotenv untuk satu berkas dua baris.
    """
    env: dict[str, str] = {}
    if ENV_LOCAL.exists():
        for baris in ENV_LOCAL.read_text(encoding="utf-8").splitlines():
            baris = baris.strip()
            if not baris or baris.startswith("#") or "=" not in baris:
                continue
            k, v = baris.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("STOCKBIT_TOKEN", "INDEXALPHA_TOKEN"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    return env


def umur_jwt(token: str) -> datetime | None:
    """Kedaluwarsa JWT dari klaim `exp`, tanpa memverifikasi tanda tangan.

    Verifikasi bukan urusan kita — servernya yang memutuskan sah atau tidak.
    Yang berguna di sini cuma satu: memberi tahu SEBELUM memanggil bahwa
    tokennya sudah mati, supaya kuota dan waktu tak terbuang untuk 401.
    """
    import base64

    try:
        bagian = token.split(".")
        if len(bagian) != 3:
            return None
        isi = bagian[1] + "=" * (-len(bagian[1]) % 4)
        exp = json.loads(base64.urlsafe_b64decode(isi)).get("exp")
        return datetime.fromtimestamp(exp, WIB) if exp else None
    except Exception:  # noqa: BLE001 — token cacat = tak bisa dinilai, bukan galat
        return None


# ── Normalisasi ke satu bentuk ──────────────────────────────────────────────
"""Ruas yang gagal diparse pada panen terakhir — dikosongkan tiap normalisasi.

Ada karena kegagalan parse angka adalah jenis kegagalan yang paling gampang
senyap: balasan berubah bentuk, tiap ruas jadi 0.0, dan berkas hasilnya tetap
terlihat lengkap dengan seratusan broker bernilai nol.
"""
GAGAL_ANGKA: list[str] = []


def _angka(v) -> float:
    """Angka dari balasan API. TIDAK menebak pemisah ribuan.

    Sengaja memakai `float()` polos: "1.500" bisa berarti 1500 (format
    Indonesia) atau 1,5 (JSON standar), dan menebak salah satunya berarti
    meleset 1000x tanpa satu pun galat. Selama bentuk nyata balasannya belum
    terlihat, yang benar adalah mengikuti JSON — dan MENCATAT tiap string yang
    tak terbaca, supaya bentuk yang tak terduga ketahuan di panen pertama,
    bukan setelah angkanya telanjur dipakai menganalisa.
    """
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    t = str(v).strip()
    if not t or t in {"-", "--"}:
        return 0.0
    try:
        return float(t)
    except ValueError:
        GAGAL_ANGKA.append(t[:40])
        return 0.0


def normalkan_stockbit(mentah: dict, ticker: str, dari: str, sampai: str,
                       pasar: str) -> dict:
    """Balasan `marketdetectors` -> bentuk kanonis.

    Stockbit memberi DUA daftar (`brokers_buy`, `brokers_sell`) dan pada mode
    NET satu broker hanya muncul di salah satunya. Keduanya digabung per kode
    broker — kalau kode yang sama muncul dua kali (mode lain), ruasnya
    dijumlahkan, bukan yang belakangan menimpa yang duluan.
    """
    GAGAL_ANGKA.clear()
    data = (mentah or {}).get("data") or {}
    bs = data.get("broker_summary") or {}
    per_kode: dict[str, dict] = {}

    def masuk(baris: dict) -> None:
        kode = (baris.get("netbs_broker_code") or "").strip().upper()
        if not kode:
            return
        b = per_kode.setdefault(kode, {
            "kode": kode, "beli_lot": 0.0, "beli_nilai": 0.0,
            "jual_lot": 0.0, "jual_nilai": 0.0,
            "avg_beli": 0.0, "avg_jual": 0.0, "jenis": None,
        })
        b["beli_lot"] += _angka(baris.get("blot"))
        b["beli_nilai"] += _angka(baris.get("bval"))
        b["jual_lot"] += abs(_angka(baris.get("slot")))
        b["jual_nilai"] += abs(_angka(baris.get("sval")))
        # Harga rata-rata TIDAK dijumlahkan — yang belakangan hanya dipakai
        # kalau yang duluan kosong. Menjumlahkan rata-rata menghasilkan angka
        # yang tak berarti apa-apa.
        for asal, tujuan in (("netbs_buy_avg_price", "avg_beli"),
                             ("netbs_sell_avg_price", "avg_jual")):
            nilai = _angka(baris.get(asal))
            if nilai and not b[tujuan]:
                b[tujuan] = nilai
        if baris.get("type") and not b["jenis"]:
            b["jenis"] = str(baris["type"])

    for baris in (bs.get("brokers_buy") or []):
        masuk(baris)
    for baris in (bs.get("brokers_sell") or []):
        masuk(baris)

    broker = []
    for b in per_kode.values():
        b["net_lot"] = b["beli_lot"] - b["jual_lot"]
        b["net_nilai"] = b["beli_nilai"] - b["jual_nilai"]
        broker.append(b)
    broker.sort(key=lambda x: x["net_nilai"], reverse=True)

    return {
        "sumber": "stockbit",
        "ticker": ticker,
        "dari": dari,
        "sampai": sampai,
        "pasar": pasar,
        "dipanen": datetime.now(WIB).isoformat(timespec="seconds"),
        "broker": broker,
        # Milik Stockbit sendiri, tak ada padanannya di Index Alpha. Disimpan
        # apa adanya: ia ringkasan buatan Stockbit, bukan hitungan kita.
        "bandar_detector": data.get("bandar_detector") or None,
    }


def normalkan_indexalpha(mentah, ticker: str, dari: str, sampai: str,
                         pasar: str) -> dict:
    """Balasan `/stocks/broker-summary` -> bentuk kanonis.

    Index Alpha sudah memberi satu baris per broker berisi sisi beli DAN jual,
    jadi tak ada penggabungan — cuma penamaan ulang ruas.
    """
    GAGAL_ANGKA.clear()
    baris = mentah
    if isinstance(mentah, dict):
        baris = mentah.get("data") or mentah.get("rows") or mentah.get("result") or []
    broker = []
    for r in (baris or []):
        kode = (r.get("code") or r.get("broker_code") or "").strip().upper()
        if not kode:
            continue
        b = {
            "kode": kode,
            "beli_lot": _angka(r.get("buy_volume")),
            "beli_nilai": _angka(r.get("buy_value")),
            "jual_lot": _angka(r.get("sell_volume")),
            "jual_nilai": _angka(r.get("sell_value")),
            "avg_beli": _angka(r.get("buy_avg")),
            "avg_jual": _angka(r.get("sell_avg")),
            "jenis": r.get("investor_type") or r.get("type"),
            "beli_freq": _angka(r.get("buy_freq")),
            "jual_freq": _angka(r.get("sell_freq")),
        }
        b["net_lot"] = b["beli_lot"] - b["jual_lot"]
        b["net_nilai"] = b["beli_nilai"] - b["jual_nilai"]
        broker.append(b)
    broker.sort(key=lambda x: x["net_nilai"], reverse=True)

    return {
        "sumber": "indexalpha",
        "ticker": ticker,
        "dari": dari,
        "sampai": sampai,
        "pasar": pasar,
        "dipanen": datetime.now(WIB).isoformat(timespec="seconds"),
        "broker": broker,
        "bandar_detector": None,
    }


# ── Pengambilan ─────────────────────────────────────────────────────────────
def ambil_stockbit(token: str, ticker: str, dari: str, sampai: str,
                   pasar: str = "MARKET_BOARD_REGULER") -> dict:
    import requests

    r = requests.get(
        f"{STOCKBIT_BASE}/marketdetectors/{ticker}",
        headers={
            "Authorization": f"Bearer {token}",
            "Origin": "https://stockbit.com",
            "Referer": "https://stockbit.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        # `from`/`to`, BUKAN `start_date`/`end_date`. Pulse-CLI memakai yang
        # kedua dan endpoint MENGABAIKANNYA tanpa galat: balasannya tetap 200
        # dan tetap 80 broker, cuma isinya hari bursa terakhir. Ketahuan hanya
        # karena rentang 10 hari dan rentang 1 hari menghasilkan berkas yang
        # sha-nya identik, dan karena balasannya sendiri menyebut `from`/`to`
        # yang tak sama dengan yang diminta. Parameter yang diabaikan diam-diam
        # adalah jebakan yang sama persis dengan `stockCode` di GetBrokerSummary.
        params={
            "from": dari,
            "to": sampai,
            "transaction_type": "TRANSACTION_TYPE_NET",
            "market_board": pasar,
            "investor_type": "INVESTOR_TYPE_ALL",
            "limit": 100,
        },
        timeout=45,
    )
    if r.status_code == 401:
        raise SystemExit("Token Stockbit ditolak (401) — ambil ulang, "
                         "lihat: python scripts/panen_broker_emiten.py --bantuan-token")
    r.raise_for_status()
    balasan = r.json()

    salah = rentang_meleset(balasan, dari, sampai)
    if salah:
        raise SystemExit(salah + " JANGAN pakai hasilnya.")
    return balasan


def rentang_meleset(balasan: dict, dari: str, sampai: str) -> str | None:
    """Keterangan galat kalau rentang yang DIJAWAB tak sama dengan yang diminta.

    Ada karena endpoint ini pernah mengabaikan parameter tanggal tanpa satu pun
    galat: `start_date`/`end_date` (nama dari Pulse-CLI) dijawab 200 berisi 80
    broker — tapi isinya hari bursa terakhir, bukan rentang yang diminta.
    Ketahuan hanya karena panen 10 hari dan panen 1 hari menghasilkan berkas
    yang sha-nya identik. Nama yang benar `from`/`to`, dan balasannya memang
    menyebutkan rentang yang ia pakai — jadi pemeriksaan ini gratis.

    Kembalikan None kalau balasannya tak menyebut rentang sama sekali: menuduh
    berdasarkan ruas yang tak ada akan memblokir panen yang sebenarnya sah.
    """
    d = (balasan or {}).get("data") or {}
    if not d.get("from"):
        return None
    if d["from"] == dari and d.get("to") == sampai:
        return None
    return (f"Endpoint menjawab rentang {d.get('from')}..{d.get('to')} padahal "
            f"diminta {dari}..{sampai} — parameter tanggalnya diabaikan.")


def ambil_indexalpha(token: str, ticker: str, dari: str, sampai: str,
                     pasar: str = "RG") -> dict:
    import requests

    r = requests.get(
        f"{INDEXALPHA_BASE}/stocks/broker-summary",
        headers={"Authorization": f"Bearer {token}"},
        params={"ticker": ticker, "from": dari, "to": sampai, "market": pasar},
        timeout=45,
    )
    if r.status_code == 401:
        raise SystemExit("Token Index Alpha ditolak (401) — periksa INDEXALPHA_TOKEN.")
    if r.status_code == 429:
        raise SystemExit("Kuota Index Alpha habis untuk hari ini (paket gratis 5/hari).")
    r.raise_for_status()
    return r.json()


# ── Pengukuran, bukan penggabungan ──────────────────────────────────────────
def bandingkan_sumber(a: dict, b: dict) -> dict:
    """Adu dua panenan ticker+rentang yang SAMA dari dua sumber berbeda.

    Melaporkan, tidak mengoreksi. Aturan CLAUDE.md: sebelum satu ruas boleh
    diturunkan dari ruas sumber lain, rasio "hitung ulang / tersimpan" harus
    diukur dulu — median 1,0000 baru aman. Fungsi ini menyediakan angkanya.
    """
    pa = {x["kode"]: x for x in a.get("broker", [])}
    pb = {x["kode"]: x for x in b.get("broker", [])}
    sama = sorted(set(pa) & set(pb))
    hasil = {
        "ticker": a.get("ticker"),
        "rentang": f'{a.get("dari")}..{a.get("sampai")}',
        "broker_a": len(pa), "broker_b": len(pb), "beririsan": len(sama),
        "hanya_a": sorted(set(pa) - set(pb)), "hanya_b": sorted(set(pb) - set(pa)),
        "rasio": {},
    }
    for ruas in ("beli_lot", "beli_nilai", "jual_lot", "jual_nilai", "net_nilai"):
        r = []
        for k in sama:
            va, vb = pa[k].get(ruas, 0), pb[k].get(ruas, 0)
            if vb:
                r.append(va / vb)
        if r:
            r.sort()
            hasil["rasio"][ruas] = {
                "n": len(r),
                "median": round(r[len(r) // 2], 4),
                "min": round(r[0], 4),
                "maks": round(r[-1], 4),
            }
    return hasil


# ── Simpan ──────────────────────────────────────────────────────────────────
def simpan(rapi: dict, mentah) -> tuple[Path, Path]:
    ticker, dari, sampai = rapi["ticker"], rapi["dari"], rapi["sampai"]
    sumber = rapi["sumber"]

    ark = ARSIP / sumber / f"{ticker}_{dari}_{sampai}.json"
    ark.parent.mkdir(parents=True, exist_ok=True)
    ark.write_text(json.dumps(mentah, ensure_ascii=False), encoding="utf-8")

    out = KELUARAN / ticker / f"{dari}_{sampai}_{sumber}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rapi, ensure_ascii=False, indent=1), encoding="utf-8")
    return out, ark


# ── Swauji ──────────────────────────────────────────────────────────────────
def swauji() -> int:
    contoh_sb = {"data": {
        "broker_summary": {
            "brokers_buy": [
                {"netbs_broker_code": "LG", "blot": "1500", "bval": "7500000",
                 "netbs_buy_avg_price": "500", "type": "L"},
                {"netbs_broker_code": "RF", "blot": 800, "bval": 4000000,
                 "netbs_buy_avg_price": 500, "type": "F"},
            ],
            "brokers_sell": [
                {"netbs_broker_code": "YP", "slot": "-1000", "sval": "-5000000",
                 "netbs_sell_avg_price": "500", "type": "L"},
            ],
        },
        "bandar_detector": {"top1": {"accdist": "ACC", "percent": 31.2}},
    }}
    r = normalkan_stockbit(contoh_sb, "BUMI", "2026-08-03", "2026-08-14",
                           "MARKET_BOARD_REGULER")
    kode = [b["kode"] for b in r["broker"]]
    assert kode == ["LG", "RF", "YP"], f"urutan net salah: {kode}"
    lg = r["broker"][0]
    assert lg["beli_lot"] == 1500, f"angka string tak terbaca: {lg['beli_lot']}"
    assert lg["net_nilai"] == 7_500_000
    assert not GAGAL_ANGKA, f"ada yang tak terparse padahal bentuknya wajar: {GAGAL_ANGKA}"

    # Bentuk yang TIDAK dikenali harus tercatat, bukan diam-diam jadi nol —
    # dan tidak boleh ditebak: "1.500" ambigu (1500 gaya Indonesia vs 1,5 JSON).
    normalkan_stockbit({"data": {"broker_summary": {"brokers_buy": [
        {"netbs_broker_code": "ZZ", "blot": "1 500", "bval": "7.500.000"}]}}},
        "X", "a", "b", "RG")
    assert GAGAL_ANGKA, "string tak terparse harus tercatat supaya tak gagal senyap"
    yp = r["broker"][-1]
    # Nilai jual Stockbit datang NEGATIF; tanda dibuang supaya `jual_nilai`
    # berarti "besarnya jual", dan net-nya yang membawa arah.
    assert yp["jual_nilai"] == 5_000_000, f"tanda negatif tak dinormalkan: {yp}"
    assert yp["net_nilai"] == -5_000_000
    assert r["bandar_detector"]["top1"]["percent"] == 31.2

    # Satu broker di KEDUA daftar: ruasnya dijumlahkan, tidak saling menimpa.
    dua_sisi = {"data": {"broker_summary": {
        "brokers_buy": [{"netbs_broker_code": "CC", "blot": 10, "bval": 1000}],
        "brokers_sell": [{"netbs_broker_code": "CC", "slot": -4, "sval": -400}],
    }}}
    d = normalkan_stockbit(dua_sisi, "X", "a", "b", "RG")["broker"][0]
    assert d["beli_lot"] == 10 and d["jual_lot"] == 4, d
    assert d["net_lot"] == 6 and d["net_nilai"] == 600, d

    contoh_ia = {"data": [
        {"code": "LG", "buy_volume": 1500, "buy_value": 7500000, "sell_volume": 0,
         "sell_value": 0, "buy_avg": 500, "sell_avg": 0, "buy_freq": 12},
        {"code": "YP", "buy_volume": 0, "buy_value": 0, "sell_volume": 1000,
         "sell_value": 5000000, "buy_avg": 0, "sell_avg": 500, "sell_freq": 9},
    ]}
    ia = normalkan_indexalpha(contoh_ia, "BUMI", "2026-08-03", "2026-08-14", "RG")
    assert [b["kode"] for b in ia["broker"]] == ["LG", "YP"]
    assert ia["broker"][0]["beli_freq"] == 12
    assert ia["broker"][-1]["net_nilai"] == -5_000_000

    # Perbandingan: dua sumber yang cocok memberi rasio 1,0 di ruas yang sama.
    bd = bandingkan_sumber(r, ia)
    assert bd["beririsan"] == 2, bd
    assert bd["rasio"]["net_nilai"]["median"] == 1.0, bd["rasio"]
    assert bd["hanya_a"] == ["RF"], bd

    # JWT: `exp` terbaca tanpa memverifikasi tanda tangan, token cacat = None.
    import base64
    isi = base64.urlsafe_b64encode(json.dumps({"exp": 1_800_000_000}).encode()).decode()
    assert umur_jwt(f"x.{isi.rstrip('=')}.y") is not None
    assert umur_jwt("bukan-jwt") is None

    # Angka: kosong dan tanda hubung tak boleh melempar maupun tercatat gagal.
    GAGAL_ANGKA.clear()
    assert _angka("") == 0 and _angka("-") == 0 and _angka(None) == 0
    assert _angka(7) == 7 and _angka("7.5") == 7.5
    assert not GAGAL_ANGKA, GAGAL_ANGKA

    # Rentang yang dijawab beda = tolak; sama = terima; tak disebut = terima.
    assert rentang_meleset({"data": {"from": "2026-08-21", "to": "2026-08-21"}},
                           "2026-08-03", "2026-08-03"), "rentang meleset harus ditolak"
    assert rentang_meleset({"data": {"from": "2026-08-03", "to": "2026-08-03"}},
                           "2026-08-03", "2026-08-03") is None
    assert rentang_meleset({"data": {"broker_summary": {}}}, "a", "b") is None, \
        "balasan tanpa ruas rentang tak boleh dituduh"

    print("12/12 lulus")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Panen broker summary per emiten")
    ap.add_argument("ticker", nargs="?", help="kode emiten, mis. BUMI")
    ap.add_argument("--dari", help="tanggal mulai YYYY-MM-DD (bawaan: 10 hari lalu)")
    ap.add_argument("--sampai", help="tanggal akhir YYYY-MM-DD (bawaan: hari ini)")
    ap.add_argument("--sumber", choices=("stockbit", "indexalpha"),
                    help="bawaan: stockbit kalau tokennya ada, kalau tidak indexalpha")
    ap.add_argument("--pasar", help="stockbit: MARKET_BOARD_REGULER · indexalpha: RG/NG/ALL")
    ap.add_argument("--bantuan-token", action="store_true", help="cara mengambil token")
    ap.add_argument("--uji", action="store_true", help="swauji, nol jaringan")
    a = ap.parse_args()

    if a.uji:
        return swauji()
    if a.bantuan_token:
        print(BANTUAN_TOKEN)
        return 0
    if not a.ticker:
        ap.error("sebutkan ticker, mis. BUMI (atau pakai --uji / --bantuan-token)")

    env = baca_env()
    sumber = a.sumber or "stockbit"
    if sumber == "stockbit":
        # Token dari berkas bersama %USERPROFILE%\.papan\stockbit-token.json,
        # diperbarui otomatis lewat refresh token (lihat stockbit_token.py).
        # .env.local hanya dipakai untuk menyemainya pertama kali.
        sys.path.insert(0, str(AKAR / "scripts"))
        from stockbit_token import token_segar
        try:
            token = token_segar()
        except SystemExit as e:
            print(str(e), file=sys.stderr)
            print(BANTUAN_TOKEN, file=sys.stderr)
            return 2
    else:
        token = env.get("INDEXALPHA_TOKEN")
        if not token:
            print("Tak ada INDEXALPHA_TOKEN di app/.env.local maupun lingkungan.", file=sys.stderr)
            return 2

    ticker = a.ticker.upper().strip()
    sampai = a.sampai or datetime.now(WIB).strftime("%Y-%m-%d")
    dari = a.dari or (datetime.now(WIB) - timedelta(days=10)).strftime("%Y-%m-%d")

    if sumber == "stockbit":
        pasar = a.pasar or "MARKET_BOARD_REGULER"
        mentah = ambil_stockbit(token, ticker, dari, sampai, pasar)
        rapi = normalkan_stockbit(mentah, ticker, dari, sampai, pasar)
    else:
        pasar = a.pasar or "RG"
        mentah = ambil_indexalpha(token, ticker, dari, sampai, pasar)
        rapi = normalkan_indexalpha(mentah, ticker, dari, sampai, pasar)

    if not rapi["broker"]:
        print(f"{ticker} {dari}..{sampai} [{sumber}]: NOL broker terbaca — "
              "mentahnya tetap diarsipkan, periksa bentuk balasannya.", file=sys.stderr)
    if GAGAL_ANGKA:
        contoh = ", ".join(sorted(set(GAGAL_ANGKA))[:5])
        print(f"  PERINGATAN: {len(GAGAL_ANGKA)} nilai tak terbaca sebagai angka "
              f"(contoh: {contoh}). Angka-angka itu jadi 0 — periksa mentahnya "
              "sebelum memakai berkas ini.", file=sys.stderr)

    out, ark = simpan(rapi, mentah)
    n = len(rapi["broker"])
    atas = ", ".join(f'{b["kode"]} {b["net_nilai"]/1e9:+.2f}M' for b in rapi["broker"][:3])
    print(f"{ticker} {dari}..{sampai} [{sumber}]: {n} broker — {atas}")
    print(f"  -> {out.relative_to(AKAR)}")
    print(f"  mentah -> {ark.relative_to(AKAR)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
