# -*- coding: utf-8 -*-
"""Hitung angka NYATA untuk purwarupa Kartu Analisa Emiten (docs/riset/kartu-analisa.html).

Sekali pakai — tidak dipanggil pipeline mana pun. Tujuannya satu: memastikan
tiap angka di kartu purwarupa punya asal-usul yang bisa diulang, bukan
karangan. Jalankan dari akar repo:

    python scripts/riset/kartu_analisa.py ARCI WIFI BUMI

Yang dihitung, dan dari mana:

| Blok kartu            | Sumber                        | Metode                                   |
|-----------------------|-------------------------------|------------------------------------------|
| Harga & perubahan     | data-idx/json/ohlc/<KODE>.json| lilin harian terakhir                    |
| Struktur (MA/ATR)     | idem                          | MA20/50/200, ATR14 (Wilder)              |
| Support & resistance  | idem                          | klaster pivot fraktal k=5, toleransi ATR |
| Karakter emiten       | idem + 964 emiten lain        | Efficiency Ratio 20 hari + persentil     |
| Waktu ke target       | idem                          | first-passage empiris (target vs stop)   |
| Musiman bulan berjalan| idem                          | imbal bulanan + Wilson + susut ALFA=6    |
| Likuiditas            | idem                          | median nilai transaksi 20 hari           |
| Sektor / papan        | data-idx/json/emiten_sektor.json | apa adanya                            |
| Fundamental ringkas   | data-idx/json/fundamental/<KODE>.json | apa adanya                      |
| Aliran asing (ringkas)| data-idx/json/asing/<KODE>.json | net beli/jual LEMBAR + porsi thd volume pasar, 5h & 20h |
| MA5/100/150, Bollinger20, Ichimoku, regresi60 | data-idx/json/ohlc/<KODE>.json | ditambahkan 25 Agu 2026, close-based |
| Frekuensi/ukuran order/peringkat/porsi asing harian | data-idx/json/ohlcv_stockbit/<KODE>.json | baris TERAKHIR saja, ruas yang tak ada di ohlc/ |

Aliran asing per emiten dipanen sejak 18 Agu 2026 (989 emiten, commit
5793317d) — beli/jual dalam LEMBAR, bukan rupiah (IDX tidak melaporkan aliran
asing dalam rupiah). Blok ini SENGAJA cuma ringkasan (net + porsi terhadap
volume pasar); panel lengkap ada di Stock Detail, bukan di kartu ini.
`asing_ringkas()`/`ringkas_asing_dari()` di bawah, berkas yang tak ada
mengembalikan `None` — pembaca kartu WAJIB menampilkan "belum tersedia",
bukan 0 (nol berarti asing tak bertransaksi, itu klaim berbeda).

Swauji: `python scripts/riset/kartu_analisa.py --uji`.
"""
from __future__ import annotations

import json
import math
import os
import statistics
import sys
import time
from pathlib import Path

# Tambalan ujung dari arsip bursa — dipakai saat arsip harga belum memuat hari
# bursa terakhir (sumbernya memakai kredensial dan bisa berhenti tanpa galat).
# Modulnya di scripts/, kartu di scripts/riset/, jadi akarnya ditambahkan ke
# jalur pencarian — pola yang sama dipakai skrip riset lain di sini.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import tambal_bursa  # noqa: E402

AKAR = Path(__file__).resolve().parents[2]
OHLC = AKAR / "data-idx" / "json" / "ohlc"
ASING = AKAR / "data-idx" / "json" / "asing"
STOCKBIT = AKAR / "data-idx" / "json" / "ohlcv_stockbit"
KARTU_DIR = AKAR / "data-idx" / "json" / "kartu"

# ---------------------------------------------------------------- fraksi BEI
JENJANG = [(200, 1), (500, 2), (2000, 5), (5000, 10), (math.inf, 25)]


def fraksi(harga: float) -> int:
    for batas, f in JENJANG:
        if harga <= batas:
            return f
    return 25


def ke_fraksi(harga: float, arah: str = "dekat") -> float:
    """Port dari app/src/lib/fraksiHarga.ts — level yang tak bisa dipesan di
    bursa adalah level palsu."""
    if not math.isfinite(harga) or harga <= 0:
        return 0
    f = fraksi(harga)
    bagi = harga / f
    if abs(round(bagi) - bagi) < 1e-9:
        bagi = round(bagi)
    n = math.ceil(bagi) if arah == "atas" else math.floor(bagi) if arah == "bawah" else round(bagi)
    hasil = n * f
    return hasil if fraksi(hasil) == f else ke_fraksi(hasil, arah)


# ---------------------------------------------------------------- muat data
def _baca_ohlc(p: Path, sampai: str | None) -> dict | None:
    """Baca satu berkas ohlc/<KODE>.json, potong deret ke `sampai` (ISO) kalau
    diisi — 'pakai OHLC hanya s.d. tanggal itu, jangan intip ke depan'. `None`
    kalau berkasnya rusak atau tak ada lilin sebelum/pada `sampai`."""
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None
    baris = d.get("d")
    if baris is None or "kode" not in d:
        return None  # bukan berkas ohlc (mis. _gagal.json — manifest kode yang gagal dipanen)
    # Hari yang arsip harga belum punya disambung dari arsip bursa (di memori;
    # berkasnya tak ditulis ulang). `_TAMBALAN` diisi sekali di muat_semua_ohlc;
    # kosong berarti tak ada yang perlu disambung — jalur biasa, nol biaya.
    if _TAMBALAN:
        tambal_bursa.sisipkan(baris, _TAMBALAN.get(d.get("kode")))
    if sampai:
        baris = [r for r in baris if r[0] <= sampai]
    if not baris:
        return None
    # ── BAR HANTU hari berjalan (temuan 28 Agu 2026) ──────────────────────
    # Sumber harga menulis bar bertanggal HARI INI dengan volume 0 dan OHLC
    # datar (keempatnya = penutupan kemarin) SEBELUM data hari itu terbit.
    # Bar itu bukan hari bursa, ia cuma tempat kosong yang sudah dipesan.
    # Sebabnya harus ditutup DI SINI, di hulu: seluruh pemakai deret ini
    # (kartu/er/sr/first_passage/musiman/kode_populasi) mengambil elemen
    # PALING UJUNG sebagai "hari ini", jadi satu bar palsu membuat harga =
    # prev, chg = 0,00%, dan RSI/MA/Bollinger/Ichimoku/regresi60 semuanya
    # dihitung di atas deret yang diakhiri titik yang tak pernah terjadi.
    # Terukur sebelum tambalan ini: 962 dari 963 kartu bertanggal 2026-08-28
    # dengan chg 0,00% — sementara hari bursa nyata terakhir 27 Agu.
    # Deret karena itu dimundurkan ke bar TERAKHIR YANG BERISI (volume > 0),
    # pola yang sama dengan app/scripts/bangun-harian-papan.mjs.
    #
    # Dua hal yang sengaja TIDAK ikut dipotong:
    # 1. `beku`/`beku_sejak` dihitung dari deret ASLI — ekor volume nol itu
    #    justru datanya (suspensi WIKA 363 hari, SCPI 3.291 hari). Kalau
    #    dihitung sesudah dipotong, ekornya lenyap dan tiap emiten selalu
    #    terbaca "tidak beku".
    # 2. Emiten yang volumenya nol SEUMUR deret tidak dipotong sama sekali —
    #    membuangnya akan mengulang kasus 582 emiten yang dulu lenyap dari
    #    halaman tanpa satu pun keterangan. Angka absen lebih baik daripada
    #    angka menyesatkan, tapi emiten absen bukan salah satunya.
    v_asli = [float(r[5]) for r in baris]
    tgl_asli = [r[0] for r in baris]
    i = len(baris) - 1
    while i > 0 and v_asli[i] == 0:
        i -= 1
    if v_asli[i]:
        baris = baris[: i + 1]
    return {
        "kode": d["kode"],
        "tgl": [r[0] for r in baris],
        # Pembukaan bisa TIDAK ADA di hari yang disambung dari arsip bursa —
        # bursa tak selalu melaporkannya (terukur 28 Agu 2026: kosong di 220
        # dari 833 emiten aktif). Modul tambalan sengaja mengembalikan None di
        # situ, bukan nol, supaya konsumen yang bisa jujur (Harian Papan
        # mengosongkan kolom Close Gap-nya) tetap bisa jujur.
        #
        # Di sini pilihannya berbeda dan disengaja: `o` dipakai backtest
        # sebagai harga masuk posisi, dan None akan menghentikannya. Jatuh ke
        # harga tutup hari itu = mengasumsikan bar datar, asumsi paling netral
        # yang bisa dibuat tanpa data. Itu MENGABURKAN "tak diketahui" jadi
        # angka, jadi batasnya penting: hanya menyentuh hari terakhir yang
        # disambung, dan panen ulang sumbernya mengembalikan angka asli.
        "o": [float(r[1] if r[1] is not None else r[4]) for r in baris],
        "h": [float(r[2]) for r in baris],
        "l": [float(r[3]) for r in baris],
        "c": [float(r[4]) for r in baris],
        "v": [float(r[5]) for r in baris],
        "mulai": baris[0][0],
        "akhir": baris[-1][0],
        "n": len(baris),
        # dihitung dari deret asli, lihat catatan (1) di atas
        "beku": hari_beku(v_asli),
        "beku_sejak": beku_sejak(tgl_asli, v_asli),
    }


def muat(kode: str, sampai: str | None = None) -> dict:
    d = _baca_ohlc(OHLC / f"{kode}.json", sampai)
    if d is None:
        raise ValueError(f"{kode}: tak ada lilin OHLC{f' sampai {sampai}' if sampai else ''}")
    return d


#: kode -> bar tambahan dari arsip bursa. Diisi sekali oleh muat_semua_ohlc();
#: dibiarkan kosong di jalur lain supaya perilaku lama tak berubah diam-diam.
_TAMBALAN: dict[str, list] = {}


def muat_semua_ohlc(sampai: str | None = None) -> dict[str, dict]:
    """Baca SEKALI seluruh data-idx/json/ohlc/*.json (dipotong ke `sampai` kalau
    diisi) — dipakai bersama oleh semua_kode/kode_populasi/er_populasi/kartu di
    mode --semua supaya satu run --tanggal tak membaca cakram berkali-kali."""
    global _TAMBALAN
    if not sampai:
        # Hanya di mode "hari terakhir". Kalau `sampai` diisi, pemanggilnya
        # sedang membangun ulang tanggal lampau dan tambalan hari ini justru
        # yang tak boleh ikut.
        _, _TAMBALAN = tambal_bursa.muat_tambalan(
            tambal_bursa.tanggal_berisi_di_dir(OHLC)
        )
    out: dict[str, dict] = {}
    for p in sorted(OHLC.glob("*.json")):
        d = _baca_ohlc(p, sampai)
        if d is not None:
            out[d["kode"]] = d
    return out


# ------------------------------------------------------ ohlcv_stockbit (baris terakhir)
def _baca_stockbit(p: Path, sampai: str | None) -> dict | None:
    """Baris TERAKHIR dari ohlcv_stockbit/<KODE>.json (dipotong ke `sampai`
    kalau diisi) — sumber frekuensi/lot/foreignbuy-sell yang tak ada di
    ohlc/<KODE>.json. Close/volume sudah terukur median 1,000000 sama dengan
    ohlc/ (25 Agu 2026), jadi MA/BB/Ichimoku/regresi tetap dari ohlc/ apa
    adanya — cuma ruas yang MEMANG cuma ada di sini yang dibaca dari sini."""
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None
    kolom, bar = d.get("kolom"), d.get("bar")
    if not kolom or not bar:
        return None
    idx = {k: i for i, k in enumerate(kolom)}
    if sampai:
        bar = [r for r in bar if r[idx["tanggal"]] <= sampai]
    if not bar:
        return None
    # Bar hantu hari berjalan ada juga di sini (sumber yang sama) — lihat
    # catatan panjang di _baca_ohlc(). Kalau tak dipotong, `frequency` dan
    # `value` bar terakhir nol, dan seluruh ruas turunannya (ukuran order,
    # porsi asing, net asing rupiah, peringkat) jatuh jadi None/0 untuk
    # SEMUA emiten — hilang senyap, tanpa satu pun galat. ekor60 ikut
    # dipotong supaya jendela whale tidak digeser satu hari kosong.
    j = len(bar) - 1
    while j > 0 and not bar[j][idx["volume"]]:
        j -= 1
    if bar[j][idx["volume"]]:
        bar = bar[: j + 1]
    r = bar[-1]
    out = {ruas: r[idx[ruas]] for ruas in (
        "tanggal", "value", "volume", "frequency", "foreignbuy", "foreignsell", "lot",
    )}
    # Ekor 60 bar untuk ruas whale (tiket median 60 hari, asing 5/20 hari,
    # streak). Disimpan ramping — empat ruas saja — supaya muat_semua tidak
    # membengkak; 60 dipilih karena itu jendela terpanjang yang dibutuhkan.
    out["ekor60"] = [
        {
            "value": q[idx["value"]], "frequency": q[idx["frequency"]],
            "foreignbuy": q[idx["foreignbuy"]], "foreignsell": q[idx["foreignsell"]],
        }
        for q in bar[-60:]
    ]
    return out


def stockbit_terakhir(kode: str, sampai: str | None = None) -> dict | None:
    p = STOCKBIT / f"{kode}.json"
    return _baca_stockbit(p, sampai) if p.exists() else None


ARSIP_BROKER = AKAR / "_arsip-mentah" / "broker-harian"


def _f(x) -> float | None:
    """Angka arsip broker tersimpan sebagai STRING (kadang notasi ilmiah,
    '1.376821725e+11') — float() menanganinya; kosong/None jadi None."""
    try:
        v = float(x)
        return v if v == v else None  # buang NaN
    except (TypeError, ValueError):
        return None


def ruas_whale(kode: str, sb: dict | None, tgl: str | None) -> dict:
    """Ruas preset Whale (adendum_preset_whale.md) — dua sisi sumber.

    Sisi HARGA dari ekor 60 bar ohlcv_stockbit (tiket = value/frequency; asing
    = foreignbuy−foreignsell rupiah RESMI, bukan taksiran lembar×harga —
    koreksi konsep #3 adendum). Sisi BROKER dari arsip GROSS reguler hari itu
    (`_arsip-mentah/broker-harian/<K>/<tgl>.json`) + varian NEGO — per-broker
    `freq` ADA di arsip (diverifikasi 26 Agu 2026), jadi tiket per broker
    dihitung persis, bukan proksi.

    Label accdist & konsentrasi diambil dari blok bandar_detector arsip —
    `broker_accdist` (label hari) dan `top3.percent`; keduanya SALINAN dari
    sumber, bukan hitungan kita (aturan: catat siapa pengisi ruas).

    Semua ruas None-safe: arsip hari itu tak ada -> ruas broker None, bukan 0
    — nol berarti "diukur dan nol", None berarti "tak terukur".
    """
    out = {
        "tiket_avg": None, "tiket_avg_med60": None, "tiket_lonjakan": None,
        "asing_net_5h": None, "asing_net_20h": None, "asing_streak": None,
        "tiket_broker_maks": None, "broker_tiket_maks_kode": None,
        "bval_maks": None, "nego_blok_rp": None, "nego_broker_maks_kode": None,
        "top3_pct": None, "number_broker_buysell": None, "label_accdist": None,
    }
    if sb and sb.get("ekor60"):
        ekor = sb["ekor60"]
        tiket = [b["value"] / b["frequency"] for b in ekor if b.get("frequency")]
        if tiket:
            out["tiket_avg"] = round(tiket[-1], 2)
            med = sorted(tiket)[len(tiket) // 2]
            out["tiket_avg_med60"] = round(med, 2)
            if med:
                out["tiket_lonjakan"] = round(tiket[-1] / med, 4)
        net = [(b.get("foreignbuy") or 0) - (b.get("foreignsell") or 0) for b in ekor]
        if net:
            out["asing_net_5h"] = int(sum(net[-5:]))
            out["asing_net_20h"] = int(sum(net[-20:]))
            arah = 1 if net[-1] > 0 else (-1 if net[-1] < 0 else 0)
            n = 0
            if arah:
                for x in reversed(net):
                    if (x > 0) == (arah > 0) and x != 0:
                        n += 1
                    else:
                        break
            out["asing_streak"] = n * arah  # bertanda: +3 masuk beruntun, -3 keluar
    if not tgl:
        return out
    reg = ARSIP_BROKER / kode / f"{tgl}.json"
    if reg.exists():
        try:
            d = json.loads(reg.read_text(encoding="utf-8"))["data"]
            beli = (d.get("broker_summary") or {}).get("brokers_buy") or []
            tmaks = bmaks = None
            tkode = None
            for b in beli:
                bval, fr = _f(b.get("bval")), _f(b.get("freq"))
                if bval is None:
                    continue
                if bmaks is None or bval > bmaks:
                    bmaks = bval
                if fr:
                    t = bval / fr
                    if tmaks is None or t > tmaks:
                        tmaks, tkode = t, b.get("netbs_broker_code")
            out["bval_maks"] = round(bmaks, 0) if bmaks is not None else None
            out["tiket_broker_maks"] = round(tmaks, 0) if tmaks is not None else None
            out["broker_tiket_maks_kode"] = tkode
            bd = d.get("bandar_detector") or {}
            out["number_broker_buysell"] = bd.get("number_broker_buysell")
            out["label_accdist"] = bd.get("broker_accdist")
            t3 = bd.get("top3") or {}
            out["top3_pct"] = round(t3["percent"], 2) if isinstance(t3.get("percent"), (int, float)) else None
        except Exception:
            pass  # arsip korup -> biarkan None; jangan menjatuhkan kartu
    nego = ARSIP_BROKER / kode / f"{tgl}.nego.json"
    if nego.exists():
        try:
            d = json.loads(nego.read_text(encoding="utf-8"))["data"]
            beli = (d.get("broker_summary") or {}).get("brokers_buy") or []
            tot = 0.0
            nmaks = None
            nkode = None
            for b in beli:
                bval = _f(b.get("bval"))
                if bval is None:
                    continue
                tot += bval
                if nmaks is None or bval > nmaks:
                    nmaks, nkode = bval, b.get("netbs_broker_code")
            out["nego_blok_rp"] = round(tot, 0)
            out["nego_broker_maks_kode"] = nkode
        except Exception:
            pass
    elif reg.exists():
        # Reguler ada tapi nego tak ada = hari itu memang nol blok nego.
        out["nego_blok_rp"] = 0.0
    return out


def muat_semua_stockbit_terakhir(sampai: str | None = None) -> dict[str, dict]:
    """Baca SEKALI baris terakhir tiap ohlcv_stockbit/*.json — dipakai bersama
    oleh peringkat_populasi() dan kartu() di mode --semua."""
    out: dict[str, dict] = {}
    for p in sorted(STOCKBIT.glob("*.json")):
        r = _baca_stockbit(p, sampai)
        if r is not None:
            out[p.stem] = r
    return out


def peringkat_populasi(pop: dict[str, dict]) -> dict[str, dict[str, int]]:
    """kode -> {'value','volume','freq': peringkat 1=terbesar}, dihitung
    dalam grup emiten yang berbagi tanggal baris terakhir yang SAMA (bukan
    lintas tanggal berbeda — lihat docstring modul)."""
    grup: dict[str, list[tuple[str, dict]]] = {}
    for kode, r in pop.items():
        grup.setdefault(r["tanggal"], []).append((kode, r))
    hasil: dict[str, dict[str, int]] = {}
    for anggota in grup.values():
        for label, ruas in (("value", "value"), ("volume", "volume"), ("freq", "frequency")):
            urut = sorted(anggota, key=lambda kv: -(kv[1][ruas] or 0))
            for i, (kode, _) in enumerate(urut):
                hasil.setdefault(kode, {})[label] = i + 1
    return hasil


# ---------------------------------------------------------------- indikator
def ma(x: list[float], n: int) -> float | None:
    return sum(x[-n:]) / n if len(x) >= n else None


def atr(h: list[float], l: list[float], c: list[float], n: int = 14) -> float | None:
    """ATR Wilder. Dipakai sebagai satuan toleransi klaster S/R — dua level
    yang berjarak kurang dari 0,5 ATR bukan dua level berbeda bagi pasar."""
    if len(c) < n + 1:
        return None
    tr = [max(h[i] - l[i], abs(h[i] - c[i - 1]), abs(l[i] - c[i - 1])) for i in range(1, len(c))]
    a = sum(tr[:n]) / n
    for x in tr[n:]:
        a = (a * (n - 1) + x) / n
    return a


def rsi(c: list[float], n: int = 14) -> list[float | None]:
    out: list[float | None] = [None] * len(c)
    if len(c) < n + 1:
        return out
    naik = tur = 0.0
    for i in range(1, n + 1):
        d = c[i] - c[i - 1]
        naik += max(d, 0)
        tur += max(-d, 0)
    naik /= n
    tur /= n
    out[n] = 100 - 100 / (1 + naik / tur) if tur else 100.0
    for i in range(n + 1, len(c)):
        d = c[i] - c[i - 1]
        naik = (naik * (n - 1) + max(d, 0)) / n
        tur = (tur * (n - 1) + max(-d, 0)) / n
        out[i] = 100 - 100 / (1 + naik / tur) if tur else 100.0
    return out


def stoch_rsi(c: list[float], n: int = 14, m: int = 14, k: int = 3) -> tuple[float, float] | None:
    r = [x for x in rsi(c, n) if x is not None]
    if len(r) < m + k:
        return None
    mentah = []
    for i in range(m - 1, len(r)):
        jendela = r[i - m + 1: i + 1]
        lo, hi = min(jendela), max(jendela)
        mentah.append(0.0 if hi == lo else (r[i] - lo) / (hi - lo) * 100)
    kk = sum(mentah[-k:]) / k
    dd = sum(mentah[-k - 2:-2]) / k if len(mentah) >= k + 2 else kk
    return kk, (kk + dd + sum(mentah[-k - 1:-1]) / k) / 3 if len(mentah) >= k + 2 else kk


def bollinger(c: list[float], n: int = 20) -> dict | None:
    """Bollinger 20/2: mid = SMA20, pita = mid ± 2σ (populasi, bukan sampel —
    seluruh 20 titik jendela ITU populasinya, bukan sampel dari yang lebih
    besar). `sigma` disisipkan untuk posisi_bb pemanggil, dibuang sebelum
    ditulis ke kartu."""
    if len(c) < n:
        return None
    jendela = c[-n:]
    mid = sum(jendela) / n
    sigma = math.sqrt(sum((x - mid) ** 2 for x in jendela) / n)
    return {"mid": mid, "atas": mid + 2 * sigma, "bawah": mid - 2 * sigma, "sigma": sigma}


def ichimoku(h: list[float], l: list[float], c: list[float]) -> dict | None:
    """tenkan/kijun/senkou HARI INI (dipakai kalau mau memplot awan ke depan),
    plus `di_atas_kumo` yang membandingkan close HARI INI dengan awan yang
    AKTIF hari ini — yaitu senkou yang dihitung 26 hari bursa lalu, karena
    awan Ichimoku digeser maju 26 hari saat diplot. Butuh >=78 lilin
    (52 utk senkou_b + 26 pergeseran); kurang dari itu seluruh objek None."""
    n = len(c)
    if n < 78:
        return None

    def titik(i: int, w: int) -> float:
        return (max(h[i - w + 1: i + 1]) + min(l[i - w + 1: i + 1])) / 2

    i = n - 1
    tenkan, kijun = titik(i, 9), titik(i, 26)
    j = i - 26  # awan yang aktif hari ini dihitung dari data 26 hari lalu
    senkou_a_aktif, senkou_b_aktif = (titik(j, 9) + titik(j, 26)) / 2, titik(j, 52)
    return {
        "tenkan": tenkan,
        "kijun": kijun,
        "senkou_a": (tenkan + kijun) / 2,
        "senkou_b": titik(i, 52),
        "di_atas_kumo": c[i] > max(senkou_a_aktif, senkou_b_aktif),
    }


def regresi60(c: list[float], n: int = 60) -> dict | None:
    """Regresi linear kuadrat-terkecil atas `n` close terakhir (x=0..n-1).
    `posisi` = jarak close ke garis, dalam satuan sigma residu (None kalau
    residunya rata sempurna — c konstan)."""
    if len(c) < n:
        return None
    y = c[-n:]
    xbar = (n - 1) / 2
    ybar = sum(y) / n
    sxy = sum((x - xbar) * (yi - ybar) for x, yi in enumerate(y))
    sxx = sum((x - xbar) ** 2 for x in range(n))
    kemiringan = sxy / sxx if sxx else 0.0
    intersep = ybar - kemiringan * xbar
    fitted = [intersep + kemiringan * x for x in range(n)]
    tengah = fitted[-1]
    sigma_r = math.sqrt(sum((yi - fi) ** 2 for yi, fi in zip(y, fitted)) / n)
    posisi = round((y[-1] - tengah) / sigma_r, 4) if sigma_r else None
    return {"kemiringan": kemiringan, "tengah": tengah, "posisi": posisi}


# ------------------------------------------------------- support/resistance
def pivot_idx(arr: list[float], k: int, rendah: bool) -> list[int]:
    """Pivot fraktal: titik yang jadi ekstrem lokal dalam jendela ±k.
    Sejalan dengan cariPivotRendah/cariPivotTinggi di lib/dasbor/grafikEmiten.ts."""
    out = []
    for i in range(k, len(arr) - k):
        jendela = arr[i - k: i + k + 1]
        if (arr[i] <= min(jendela)) if rendah else (arr[i] >= max(jendela)):
            out.append(i)
    return out


def klaster_level(nilai_tgl: list[tuple[float, str]], tol: float) -> list[dict]:
    """Gabung pivot yang berdekatan (< tol) jadi satu level. Jumlah anggota =
    berapa kali pasar benar-benar berbalik di situ — itulah 'n sentuhan'."""
    if not nilai_tgl:
        return []
    urut = sorted(nilai_tgl)
    kel: list[list[tuple[float, str]]] = [[urut[0]]]
    for nilai, tgl in urut[1:]:
        if nilai - kel[-1][-1][0] <= tol:
            kel[-1].append((nilai, tgl))
        else:
            kel.append([(nilai, tgl)])
    return [
        {
            "level": sum(x[0] for x in g) / len(g),
            "sentuhan": len(g),
            "terakhir": max(x[1] for x in g),
        }
        for g in kel
    ]


def sr(d: dict, k: int = 5, lihat: int = 500) -> tuple[list[dict], list[dict]]:
    """Support/resistance dari klaster pivot pada `lihat` lilin terakhir.

    Level yang jaraknya < 0,5 ATR dari harga sekarang DIBUANG: itu bukan level
    tersendiri, itu rentang hari ini. Tanpa saringan ini ARCI 18 Agu 2026
    memberi 'resistance 1.330' yang cuma +0,76% dari harga — angka yang
    terlihat presisi tapi tak mengandung informasi apa pun.
    """
    a = atr(d["h"], d["l"], d["c"]) or (d["c"][-1] * 0.02)
    tol = a * 0.75
    h, l, t = d["h"][-lihat:], d["l"][-lihat:], d["tgl"][-lihat:]
    sup = klaster_level([(l[i], t[i]) for i in pivot_idx(l, k, True)], tol)
    res = klaster_level([(h[i], t[i]) for i in pivot_idx(h, k, False)], tol)
    harga = d["c"][-1]
    minim = a * 0.5
    sup = sorted([x for x in sup if x["level"] < harga - minim], key=lambda x: -x["level"])
    res = sorted([x for x in res if x["level"] > harga + minim], key=lambda x: x["level"])
    for x in sup + res:
        # < 1 ATR = masih di dalam ayunan harian; stop di situ rawan tersapu noise.
        x["dalam_atr"] = abs(x["level"] - harga) < a
    for x in sup:
        x["harga"] = ke_fraksi(x["level"], "bawah")
    for x in res:
        x["harga"] = ke_fraksi(x["level"], "atas")
    return sup, res


# ------------------------------------------------------- first passage time
def first_passage(d: dict, naik_pct: float, turun_pct: float, horizon: int = 20) -> dict:
    """Dari SETIAP hari historis: dalam `horizon` hari bursa berikutnya, mana
    yang tersentuh lebih dulu — target (+naik_pct) atau stop (-turun_pct)?

    Inilah yang membuat 'ekspektasi waktu ke target' bukan tebakan. Kalau
    keduanya tersentuh di hari yang sama, dihitung sebagai STOP (konservatif —
    dari data harian kita tak tahu urutan intraday-nya).
    """
    c, h, l = d["c"], d["h"], d["l"]
    n = len(c)
    total = kena = stop = 0
    hari_kena: list[int] = []
    for t in range(n - horizon - 1):
        atas = c[t] * (1 + naik_pct / 100)
        bawah = c[t] * (1 - turun_pct / 100)
        total += 1
        for j in range(t + 1, t + 1 + horizon):
            kena_bawah = l[j] <= bawah
            kena_atas = h[j] >= atas
            if kena_bawah:
                stop += 1
                break
            if kena_atas:
                kena += 1
                hari_kena.append(j - t)
                break
    if total == 0:
        return {"n": 0}
    hari_kena.sort()
    q = lambda p: hari_kena[min(len(hari_kena) - 1, int(p * len(hari_kena)))] if hari_kena else None
    return {
        "n": total,
        # `n` conta hari MULAI, dan jendela `horizon` hari yang beruntun saling
        # beririsan (hari t & t+1 berbagi 19/20 harinya kalau horizon=20) — jadi
        # `n` bukan bukti bebas sebanyak itu. n_efektif ~= jumlah jendela yang
        # TAK beririsan yang muat di rentang yang sama, perkiraan kasar tapi
        # jujur (n / horizon). Dipakai di kartu ringkas supaya angka yang
        # ditonjolkan bukan yang paling melebih-lebihkan.
        "n_efektif": round(total / horizon),
        "kena": kena,
        "stop": stop,
        "lewat": total - kena - stop,
        "p_kena": kena / total * 100,
        "p_stop": stop / total * 100,
        "median_hari": statistics.median(hari_kena) if hari_kena else None,
        "q1": q(0.25),
        "q3": q(0.75),
        "harapan": (kena / total) * naik_pct - (stop / total) * turun_pct,
    }


# ----------------------------------------------------------- efficiency ratio
def er(c: list[float], n: int = 20) -> float | None:
    """Kaufman Efficiency Ratio: |perubahan bersih| / total jarak tempuh.
    Mendekati 0 = bolak-balik (sideways); mendekati 1 = tren bersih.
    Dipakai supaya label 'suka sideways' punya angka, bukan firasat."""
    if len(c) < n + 1:
        return None
    nilai = []
    for i in range(n, len(c)):
        jarak = sum(abs(c[j] - c[j - 1]) for j in range(i - n + 1, i + 1))
        if jarak:
            nilai.append(abs(c[i] - c[i - n]) / jarak)
    return statistics.median(nilai) if nilai else None


def er_populasi(min_n: int = 250, cache: dict[str, dict] | None = None, sampai: str | None = None) -> list[tuple[str, float]]:
    """ER median tiap emiten — dasar persentil. Sekali jalan ±1 menit dari cakram;
    kalau `cache` diisi (muat_semua_ohlc()), nol I/O tambahan."""
    sumber = cache.values() if cache is not None else muat_semua_ohlc(sampai).values()
    out = []
    for d in sumber:
        if d["n"] < min_n:
            continue
        e = er(d["c"])
        if e is not None:
            out.append((d["kode"], e))
    return out


# ------------------------------------------------------------------ musiman
ALFA = 6  # sama dengan app/src/lib/seasonality.ts


def wilson(naik: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n <= 0:
        return 0.0, 100.0
    p = naik / n
    d = 1 + z * z / n
    tengah = p + z * z / (2 * n)
    sebar = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return max(0, (tengah - sebar) / d * 100), min(100, (tengah + sebar) / d * 100)


def musiman_bulan(d: dict, bulan: int) -> dict:
    """Imbal bulan kalender tertentu, dengan selang Wilson dan penyusutan ke
    peluang dasar emiten — meniru lib/seasonality.ts, bukan tabel '80% naik'."""
    tutup: dict[str, float] = {}
    for tgl, c in zip(d["tgl"], d["c"]):
        tutup[tgl[:7]] = c
    kunci = sorted(tutup)
    imbal = [(kunci[i], (tutup[kunci[i]] / tutup[kunci[i - 1]] - 1) * 100) for i in range(1, len(kunci))]
    semua = [x[1] for x in imbal]
    dasar = sum(1 for x in semua if x > 0) / len(semua) * 100 if semua else 50
    ini = [(k, v) for k, v in imbal if int(k[5:7]) == bulan]
    n = len(ini)
    naik = sum(1 for _, v in ini if v > 0)
    bawah, atas = wilson(naik, n)
    return {
        "n": n,
        "naik": naik,
        "mentah": naik / n * 100 if n else None,
        "tersusut": (naik + ALFA * dasar / 100) / (n + ALFA) * 100 if n else dasar,
        "bawah": bawah,
        "atas": atas,
        "median": statistics.median([v for _, v in ini]) if ini else None,
        "dasar": dasar,
        "total_bulan": len(semua),
    }


# ----------------------------------------------------- sektor & fundamental
def sektor(kode: str) -> dict:
    p = AKAR / "data-idx" / "json" / "emiten_sektor.json"
    e = json.loads(p.read_text(encoding="utf-8"))["emiten"].get(kode, {})
    # _en = nama resmi Inggris IDX (keputusan Johan 27 Agu — nilai
    # klasifikasi tampil Inggris; Indonesia tetap ikut sebagai cadangan).
    return {k: e.get(k) for k in (
        "nama", "sektor", "subsektor", "subindustri", "papan", "tercatat",
        "sektor_en", "subsektor_en", "subindustri_en",
    )}


def fundamental(kode: str) -> dict:
    p = AKAR / "data-idx" / "json" / "fundamental" / f"{kode}.json"
    if not p.exists():
        return {}
    f = json.loads(p.read_text(encoding="utf-8"))
    return {k: f.get(k) for k in (
        "name", "updated", "pe", "pb", "eps", "roe", "der", "npm", "rev_yoy", "ni_yoy",
        "dividend_yield", "beta", "shares", "float_pct", "week52_high", "week52_low",
    )}


# --------------------------------------------------------------------- asing
def ringkas_asing_dari(baris: list[list], hari: int) -> dict:
    """Jumlah `hari` baris TERAKHIR dari deret [tgl,beli,jual,volume,value,frek]
    (data-idx/json/asing/<KODE>.json — 'volume' di situ adalah volume PASAR
    hari itu, sama dengan ruas V di ohlc/<KODE>.json, terverifikasi 18 Agu 2026).
    Porsi = jumlah beli (atau jual) periode dibagi jumlah volume pasar periode
    yang SAMA — dijumlah dulu baru dibagi, bukan rata-rata porsi harian,
    supaya hari sepi tak membobot sama besar dengan hari ramai."""
    slc = baris[-hari:]
    beli = sum(r[1] for r in slc)
    jual = sum(r[2] for r in slc)
    vol = sum(r[3] for r in slc)
    return {
        "n": len(slc),
        "beli": beli,
        "jual": jual,
        "net": beli - jual,
        "porsi_beli_pct": (beli / vol * 100) if vol else None,
        "porsi_jual_pct": (jual / vol * 100) if vol else None,
    }


def asing_ringkas(kode: str, hari_list: tuple[int, ...] = (5, 20)) -> dict | None:
    """None kalau emiten belum punya berkas asing — pembaca WAJIB menampilkan
    'belum tersedia', bukan 0 (lihat catatan modul)."""
    p = ASING / f"{kode}.json"
    if not p.exists():
        return None
    a = json.loads(p.read_text(encoding="utf-8"))
    baris = a.get("d") or []
    if not baris:
        return None
    return {
        "satuan": a.get("satuan", {}),
        "mulai": a.get("mulai"),
        "akhir": a.get("akhir"),
        "n_total": len(baris),
        "periode": {str(h): ringkas_asing_dari(baris, h) for h in hari_list},
    }


# ------------------------------------------------------------------ perakit
def kartu(
    kode: str, peringkat_er: dict[str, float] | None = None,
    d: dict | None = None, sampai: str | None = None, hemat: bool = False,
    stockbit_pop: dict[str, dict] | None = None, stockbit_rank: dict[str, dict] | None = None,
) -> dict:
    """`d` sudah dimuat (mis. dari muat_semua_ohlc() cache) -> dipakai apa
    adanya, nol I/O tambahan. `hemat=True` melewati blok yang TIDAK dipakai
    ringkas_dari_kartu() (musiman/sektor/fundamental/asing/target first-
    passage) — dipakai backfill arsip kalender supaya --tanggal tidak
    membayar ongkos first-passage untuk baris yang toh dibuang."""
    d = d if d is not None else muat(kode, sampai)
    c, h, l, v, t = d["c"], d["h"], d["l"], d["v"], d["tgl"]
    n = d["n"]
    a = atr(h, l, c)
    sup, res = sr(d)
    harga = c[-1]
    prev = c[-2] if n >= 2 else None
    chg = (harga / prev - 1) * 100 if prev else None
    stop = sup[0]["harga"] if sup else ke_fraksi(harga * 0.95, "bawah")
    # Asal stop ikut ditulis (audit 26 Agu 2.2): fallback -5% itu angka
    # arbitrer, bukan level historis — seluruh tabel first-passage berdiri
    # di atasnya, jadi pembaca wajib tahu bedanya dari klaster support nyata.
    stop_asal = "klaster" if sup else "fallback5pct"
    turun_pct = (harga - stop) / harga * 100
    e = er(c)
    jendela = range(max(0, n - 20), n)
    nilai = sorted(c[i] * v[i] for i in jendela)
    nilai20 = statistics.median(nilai) if nilai else None
    hasil = {
        "kode": kode,
        "tgl": t[-1],
        "harga": harga,
        "prev": prev,
        "chg": chg,
        "n": n,
        "mulai": d["mulai"],
        "ma20": ma(c, 20), "ma50": ma(c, 50), "ma200": ma(c, 200),
        "atr": a,
        "atr_pct": a / harga * 100 if a else None,
        "support": sup[:3],
        "resistance": res[:3],
        "stop": stop,
        "stop_asal": stop_asal,
        "stop_pct": turun_pct,
        "er": e,
        "er_persentil": (
            sum(1 for x in peringkat_er.values() if x < e) / len(peringkat_er) * 100
            if peringkat_er and e is not None else None
        ),
        "er_n_populasi": len(peringkat_er) if peringkat_er else None,
        "likuiditas_median20": nilai20,
        "kualitas": kualitas_dari(n, nilai20),
        # dari _baca_ohlc() atas deret ASLI — d["v"]/d["tgl"] di sini sudah
        # dipotong dari bar hantu, jadi menghitungnya lagi di sini akan
        # selalu menjawab "tidak beku" (28 Agu 2026)
        "beku": d["beku"],
        "beku_sejak": d["beku_sejak"],
        "dihitung": t[-1],
    }
    if hemat:
        return hasil
    target = []
    for r in res[:3]:
        naik_pct = (r["harga"] - harga) / harga * 100
        target.append({
            "harga": r["harga"],
            "pct": naik_pct,
            "sentuhan": r["sentuhan"],
            "terakhir": r["terakhir"],
            "fp": first_passage(d, naik_pct, turun_pct, 20),
            "fp60": first_passage(d, naik_pct, turun_pct, 60),
        })
    bb = bollinger(c)
    posisi_bb = round((harga - bb["mid"]) / (2 * bb["sigma"]), 4) if bb and bb["sigma"] else None
    row = stockbit_pop.get(kode) if stockbit_pop is not None else stockbit_terakhir(kode, sampai)
    freq = ukuran_order = porsi_asing = net_asing_rp = label_fd = None
    pv = pvol = pf = None
    if row is not None:
        freq = row["frequency"]
        ukuran_order = round(row["lot"] / freq, 4) if freq else None
        porsi_asing = ((row["foreignbuy"] + row["foreignsell"]) / (2 * row["value"])) if row["value"] else None
        net_asing_rp = row["foreignbuy"] - row["foreignsell"]
        if porsi_asing is not None:
            x = round(porsi_asing * 100)
            label_fd = f"F {x}% : D {100 - x}%"
        rank = (stockbit_rank or {}).get(kode, {})
        pv, pvol, pf = rank.get("value"), rank.get("volume"), rank.get("freq")
    hasil.update({
        "rsi": rsi(c)[-1],
        "stochrsi": stoch_rsi(c),
        "target": target,
        "musiman": musiman_bulan(d, int(t[-1][5:7])),
        "sektor": sektor(kode),
        "fundamental": fundamental(kode),
        "asing": asing_ringkas(kode),
        "ma5": ma(c, 5), "ma100": ma(c, 100), "ma150": ma(c, 150),
        "bb20": {"mid": bb["mid"], "atas": bb["atas"], "bawah": bb["bawah"]} if bb else None,
        "posisi_bb": posisi_bb,
        "ichimoku": ichimoku(h, l, c),
        "regresi60": regresi60(c),
        "freq": freq,
        "ukuran_order": ukuran_order,
        "peringkat_value": pv, "peringkat_volume": pvol, "peringkat_freq": pf,
        "porsi_asing": round(porsi_asing, 4) if porsi_asing is not None else None,
        "net_asing_rp": net_asing_rp,
        "label_fd": label_fd,
    })
    # Ruas preset Whale (adendum_preset_whale.md) — tanggal broker = tanggal
    # bar terakhir kartu, supaya sisi harga dan sisi broker satu hari.
    hasil.update(ruas_whale(kode, row, t[-1]))
    return hasil


def cetak(k: dict) -> None:
    p = print
    p(f"\n{'='*72}\n{k['kode']}  {k['tgl']}  close {k['harga']:,.0f}  ({k['chg']:+.2f}%)")
    p(f"  riwayat {k['mulai']} .. n={k['n']} lilin harian")
    p(f"  MA20 {k['ma20']:,.1f} | MA50 {k['ma50']:,.1f} | MA200 {k['ma200'] and k['ma200']:,.1f}")
    p(f"  ATR14 {k['atr']:,.1f} ({k['atr_pct']:.2f}%)  RSI14 {k['rsi']:.1f}  StochRSI K {k['stochrsi'][0]:.0f} D {k['stochrsi'][1]:.0f}")
    p(f"  ER20 median {k['er']:.3f} — persentil {k['er_persentil']:.0f} dari {k['er_n_populasi']} emiten")
    p(f"  likuiditas median 20h  Rp {k['likuiditas_median20']/1e9:,.1f} miliar/hari")
    p("  SUPPORT  " + " · ".join(f"{s['harga']:,.0f} (n={s['sentuhan']}, {s['terakhir']})" for s in k["support"]))
    p("  RESIST   " + " · ".join(f"{r['harga']:,.0f} (n={r['sentuhan']}, {r['terakhir']})" for r in k["resistance"]))
    rawan = k["support"] and k["support"][0]["dalam_atr"]
    p(f"  PEMBATAL close < {k['stop']:,.0f}  (-{k['stop_pct']:.2f}%)"
      + ("  [< 1 ATR — rawan tersapu ayunan harian]" if rawan else ""))
    s = k["sektor"]
    p(f"  SEKTOR {s['sektor']} / {s['subindustri']} — papan {s['papan']}, tercatat {s['tercatat']}")
    f = k["fundamental"]
    p(f"  FUNDAMENTAL PER {f.get('pe')} PBV {f.get('pb')} ROE {f.get('roe')} DER {f.get('der')} "
      f"rev_yoy {f.get('rev_yoy')} ni_yoy {f.get('ni_yoy')} (diperbarui {f.get('updated')})")
    for i, tg in enumerate(k["target"], 1):
        f = tg["fp"]; f6 = tg["fp60"]
        p(f"  TP{i} {tg['harga']:,.0f} (+{tg['pct']:.2f}%)  n={f['n']}  "
          f"target-dulu {f['p_kena']:.1f}% · stop-dulu {f['p_stop']:.1f}% · tak keduanya {100-f['p_kena']-f['p_stop']:.1f}%")
        p(f"       median {f['median_hari']} hari bursa (Q1 {f['q1']} · Q3 {f['q3']}), "
          f"harapan {f['harapan']:+.2f}% | horizon 60h: target-dulu {f6['p_kena']:.1f}%, median {f6['median_hari']}")
    m = k["musiman"]
    p(f"  MUSIMAN bulan ini: {m['naik']}/{m['n']} naik = {m['mentah']:.0f}% mentah, "
      f"tersusut {m['tersusut']:.0f}%, Wilson 95% {m['bawah']:.0f}-{m['atas']:.0f}%, "
      f"median {m['median']:+.2f}% (dasar emiten {m['dasar']:.0f}% dari {m['total_bulan']} bulan)")
    asg = k.get("asing")
    if not asg:
        p("  ASING belum tersedia untuk emiten ini")
    else:
        for h in ("5", "20"):
            pr = asg["periode"].get(h)
            if not pr:
                continue
            p(f"  ASING {h}h  beli {pr['beli']:,.0f} lbr ({pr['porsi_beli_pct']:.1f}% vol pasar) · "
              f"jual {pr['jual']:,.0f} lbr ({pr['porsi_jual_pct']:.1f}%) · net {pr['net']:+,.0f} lbr (n={pr['n']})")


def uji_bar_hantu() -> None:
    """_baca_ohlc() mundur dari bar hantu hari berjalan (28 Agu 2026), tapi
    tetap melaporkan beku dari deret ASLI dan tak membuang emiten nol-total."""
    import tempfile
    def tulis(dirp, kode, d):
        p = Path(dirp) / f"{kode}.json"
        p.write_text(json.dumps({"kode": kode, "d": d}), encoding="utf-8")
        return p
    with tempfile.TemporaryDirectory() as t:
        # ekor hantu 1 hari: harga & tanggal mundur ke bar berisi, beku=1
        h = _baca_ohlc(tulis(t, "HANTU", [
            ["2026-08-26", 100, 110, 90, 105, 500],
            ["2026-08-27", 105, 115, 100, 110, 700],
            ["2026-08-28", 110, 110, 110, 110, 0],
        ]), None)
        assert h["akhir"] == "2026-08-27" and h["c"][-1] == 110 and h["n"] == 2, h
        assert h["beku"] == 1 and h["beku_sejak"] == "2026-08-27", h
        # suspensi panjang: dipotong juga, tapi beku menghitung SELURUH ekor
        s = _baca_ohlc(tulis(t, "SUSPEN", [
            ["2026-08-24", 100, 100, 100, 100, 900],
            ["2026-08-26", 100, 100, 100, 100, 0],
            ["2026-08-27", 100, 100, 100, 100, 0],
            ["2026-08-28", 100, 100, 100, 100, 0],
        ]), None)
        assert s["akhir"] == "2026-08-24" and s["beku"] == 3 and s["beku_sejak"] == "2026-08-24", s
        # nol seumur deret: JANGAN dipotong, emiten tak boleh lenyap
        z = _baca_ohlc(tulis(t, "NOL", [
            ["2026-08-27", 50, 50, 50, 50, 0],
            ["2026-08-28", 50, 50, 50, 50, 0],
        ]), None)
        assert z is not None and z["n"] == 2 and z["beku"] == 2 and z["beku_sejak"] is None, z


def uji() -> None:
    uji_bar_hantu()
    assert ke_fraksi(1237, "atas") == 1240 and ke_fraksi(1237, "bawah") == 1235
    assert ke_fraksi(2000, "dekat") == 2000 and fraksi(2001) == 10
    # pivot fraktal: puncak tunggal di tengah
    assert pivot_idx([1, 2, 3, 9, 3, 2, 1], 3, False) == [3]
    assert pivot_idx([9, 8, 7, 1, 7, 8, 9], 3, True) == [3]
    # klaster: dua nilai berdekatan jadi satu level bersentuhan 2
    kl = klaster_level([(100, "a"), (101, "b"), (140, "c")], 5)
    assert len(kl) == 2 and kl[0]["sentuhan"] == 2 and kl[0]["terakhir"] == "b"
    # first passage pada deret naik lurus: target pasti kena, stop tak pernah
    lurus = {"c": [100 + i for i in range(60)], "h": [100 + i for i in range(60)],
             "l": [100 + i for i in range(60)], "tgl": [""] * 60}
    f = first_passage(lurus, 3.0, 50.0, 20)
    assert f["p_stop"] == 0 and f["p_kena"] > 99, f
    assert f["n_efektif"] == round(f["n"] / 20), f  # n dibagi horizon, bukan disalin dari n
    # ER deret naik lurus = 1; deret bolak-balik ≈ 0
    assert er([100 + i for i in range(40)]) > 0.99
    assert er([100 + (i % 2) for i in range(40)]) < 0.05
    # Wilson 5/5 tak boleh 100-100
    b, a = wilson(5, 5)
    assert b < 60 and a > 99
    # asing: 3 hari, porsi dijumlah dulu baru dibagi (bukan rata-rata harian)
    b3 = [["d1", 10, 5, 100, 0, 0], ["d2", 20, 20, 200, 0, 0], ["d3", 5, 25, 50, 0, 0]]
    r = ringkas_asing_dari(b3, 3)
    assert r["n"] == 3 and r["beli"] == 35 and r["jual"] == 50 and r["net"] == -15
    assert abs(r["porsi_beli_pct"] - 35 / 350 * 100) < 1e-9
    assert abs(r["porsi_jual_pct"] - 50 / 350 * 100) < 1e-9
    # volume nol -> porsi None, bukan ZeroDivisionError
    r0 = ringkas_asing_dari([["d1", 1, 1, 0, 0, 0]], 1)
    assert r0["porsi_beli_pct"] is None and r0["porsi_jual_pct"] is None
    # kualitas_dari: klasifikasi relatif MIN_LILIN/MIN_LIKUIDITAS (WBSA/GWSA
    # 21 Agu 2026 — riwayat pendek 93 lilin tapi likuiditas cukup vs sebaliknya)
    assert kualitas_dari(93, 9.9e9) == {"riwayat": "pendek", "likuiditas": "cukup", "lilin": 93, "nilai20": 9.9e9}
    assert kualitas_dari(2471, 2.83e8) == {"riwayat": "cukup", "likuiditas": "tipis", "lilin": 2471, "nilai20": 2.83e8}
    assert kualitas_dari(300, None) == {"riwayat": "cukup", "likuiditas": "tipis", "lilin": 300, "nilai20": None}
    # kode_populasi: emiten kualitas tak-lolos (riwayat ATAU likuiditas) tak
    # masuk populasi statistik (ER persentil/median pasar) — cache in-memory,
    # nol I/O.
    cache_uji = {
        "AA": {"kode": "AA", "n": 300, "c": [100.0] * 300, "v": [1e7] * 300},  # lolos keduanya
        "BB": {"kode": "BB", "n": 100, "c": [100.0] * 100, "v": [1e7] * 100},  # riwayat pendek
        "CC": {"kode": "CC", "n": 300, "c": [100.0] * 300, "v": [1.0] * 300},  # likuiditas tipis
    }
    lolos_uji, tolak_uji = kode_populasi(cache=cache_uji)
    assert lolos_uji == ["AA"] and tolak_uji == {"riwayat": 1, "likuiditas": 1}, (lolos_uji, tolak_uji)
    # hemat=True (dipakai backfill arsip): tanpa musiman/sektor/fundamental/
    # asing/target, tapi ringkas_dari_kartu() tetap lengkap dari hasilnya.
    hemat_dummy = {
        "kode": "AA", "tgl": "2026-08-01", "harga": 100.0, "prev": 99.0, "chg": 1.0, "n": 300,
        "mulai": "2025-01-01", "ma20": 98.0, "ma50": 97.0, "ma200": None, "atr": 2.0, "atr_pct": 2.0,
        "support": [], "resistance": [], "stop": 95.0, "stop_pct": 5.0, "er": 0.3, "er_persentil": None,
        "er_n_populasi": None, "likuiditas_median20": 1e9, "kualitas": kualitas_dari(300, 1e9), "dihitung": "2026-08-01",
    }
    assert "target" not in hemat_dummy and "musiman" not in hemat_dummy
    rk_hemat = ringkas_dari_kartu(hemat_dummy)
    assert rk_hemat["kualitas"]["riwayat"] == "cukup" and rk_hemat["s1"] is None
    # ringkas: S1/R1 diambil dari klaster TERDEKAT, dan emiten tanpa klaster
    # memberi None — bukan 0 (nol berarti "levelnya di harga nol").
    kp = {"kode": "XX", "tgl": "2026-08-19", "harga": 100.0, "chg": 1.0, "n": 600, "ma20": 98.0,
          "atr_pct": 3.0, "er_persentil": 40.0, "likuiditas_median20": 1e9, "stop_pct": 5.0,
          "support": [{"harga": 95.0}, {"harga": 90.0}], "resistance": [{"harga": 110.0}]}
    rk = ringkas_dari_kartu(kp)
    assert rk["s1"] == 95.0 and rk["r1"] == 110.0 and rk["likuiditas"] == 1e9
    assert ringkas_dari_kartu({**kp, "support": [], "resistance": []})["s1"] is None
    # ruas screener baru 25 Agu 2026: diambil apa adanya dari kartu, dan None
    # (bukan KeyError) kalau ichimoku/regresi60 kartu itu sendiri None.
    kp2 = {**kp, "ma5": 99.0, "posisi_bb": 0.5, "freq": 100, "ukuran_order": 2.0,
           "peringkat_value": 3, "peringkat_volume": 4, "peringkat_freq": 5,
           "porsi_asing": 0.1, "net_asing_rp": -500, "label_fd": "F 10% : D 90%",
           "ichimoku": {"tenkan": 1, "kijun": 1, "senkou_a": 1, "senkou_b": 1, "di_atas_kumo": True},
           "regresi60": {"kemiringan": 1.0, "tengah": 1.0, "posisi": 0.42}}
    rk2 = ringkas_dari_kartu(kp2)
    assert rk2["ma5"] == 99.0 and rk2["posisi_bb"] == 0.5 and rk2["freq"] == 100
    assert rk2["di_atas_kumo"] is True and rk2["posisi_regresi"] == 0.42
    assert rk2["peringkat_value"] == 3 and rk2["label_fd"] == "F 10% : D 90%"
    rk3 = ringkas_dari_kartu({**kp, "ichimoku": None, "regresi60": None})
    assert rk3["di_atas_kumo"] is None and rk3["posisi_regresi"] is None
    periksa_ringkas()
    print("kartu_analisa: swauji lolos")


# Ambang POPULASI STATISTIK (docs/riset/keputusan-kartu-ringkas.md, bagian
# "BANYAK SAHAM"; direvisi 21 Agu 2026). SEMUA emiten ber-OHLC dapat kartu —
# yang tak lolos ambang ini cuma dikeluarkan dari acuan statistik (ER
# persentil, median pasar) lewat ruas `kualitas`, JUMLAHNYA ikut ditulis ke
# ringkas.json supaya halaman bisa mencetaknya di kaki tabel — bukan hilang
# senyap.
MIN_LILIN = 250
MIN_LIKUIDITAS = 5e8  # Rp500 juta/hari, median 20 hari


def kode_populasi(
    min_n: int = MIN_LILIN, min_lik: float = MIN_LIKUIDITAS,
    cache: dict[str, dict] | None = None, sampai: str | None = None,
) -> tuple[list[str], dict]:
    """Kode emiten yang lolos ambang POPULASI STATISTIK (ER persentil, median
    pasar) — bukan lagi penyaring "siapa dapat kartu". Sejak keputusan 21 Agu
    2026 SEMUA emiten ber-OHLC dapat kartu; ambang ini cuma menandai siapa yang
    ikut dihitung sebagai acuan (`kualitas_dari()`), plus hitungan tak-lolos
    per sebab untuk kaki tabel."""
    sumber = cache.values() if cache is not None else muat_semua_ohlc(sampai).values()
    lolos: list[str] = []
    tolak = {"riwayat": 0, "likuiditas": 0}
    for d in sumber:
        if d["n"] < min_n:
            tolak["riwayat"] += 1
            continue
        c, v, n = d["c"], d["v"], d["n"]
        nilai20 = statistics.median(c[i] * v[i] for i in range(max(0, n - 20), n))
        if nilai20 < min_lik:
            tolak["likuiditas"] += 1
            continue
        lolos.append(d["kode"])
    return lolos, tolak


def hari_beku(v: list[float]) -> int:
    """Berapa hari bursa TERAKHIR berturut-turut yang volumenya nol.

    Emiten yang disuspensi tidak hilang dari deret harga — ia tetap punya bar
    tiap hari bursa, dengan harga terakhirnya dibekukan dan volume nol.
    Terukur 25 Agu 2026: WIKA 363 hari berturut sejak 2025-02-18 (harga beku
    204), SCPI 3.291 hari (29.000), dan 119 emiten total ber-deret >= 20 hari.

    Kenapa ruas ini perlu padahal sudah ada `kualitas.likuiditas`: 'tipis'
    berarti SEDIKIT diperdagangkan, sedangkan ini berarti TIDAK SAMA SEKALI —
    dua keadaan yang sangat berbeda dan selama ini tertulis sama. Akibatnya
    indikator tetap terhitung di atas deret datar dan tampil seolah pembacaan
    sah: RSI WIKA 39,98, SCPI 10,67. Angka yang terlihat 'jenuh jual' padahal
    lahir dari harga yang tak bergerak, bukan dari tekanan jual.

    Ruas ini TIDAK menyaring emiten dari kartu maupun dari daftar — sama
    seperti `kualitas`, ia penanda supaya halaman bisa menyatakannya apa
    adanya. Menyembunyikannya akan mengulang kesalahan 582 emiten yang dulu
    lenyap dari halaman tanpa satu pun keterangan.
    """
    n = 0
    for x in reversed(v):
        if x:
            break
        n += 1
    return n


def beku_sejak(tgl: list[str], v: list[float]) -> str | None:
    """Tanggal transaksi TERAKHIR sebelum deret beku — `None` kalau tak beku.

    Dipisah dari `hari_beku()` karena yang dibutuhkan layar berbeda dari yang
    dibutuhkan penyaring: penyaring memakai jumlah hari, pembaca butuh tanggal
    ("tidak diperdagangkan sejak 18 Feb 2025" jauh lebih berarti daripada
    "beku 363 hari"). Menghitungnya di layar dari jumlah hari akan salah —
    hari bursa tidak sama dengan hari kalender.
    """
    n = hari_beku(v)
    if n == 0 or n >= len(tgl):
        return None
    return tgl[-(n + 1)]


def kualitas_dari(n: int, nilai20: float | None) -> dict:
    """Ruas 'kualitas' kartu — riwayat/likuiditas relatif ambang populasi
    (MIN_LILIN/MIN_LIKUIDITAS). TIDAK menyaring emiten dari kartu, cuma
    penanda supaya halaman & populasi ER tahu siapa di luar populasi
    statistik (docs/riset/keputusan-kartu-ringkas.md keputusan 21 Agu 2026)."""
    return {
        "riwayat": "cukup" if n >= MIN_LILIN else "pendek",
        "likuiditas": "cukup" if (nilai20 is not None and nilai20 >= MIN_LIKUIDITAS) else "tipis",
        "lilin": n,
        "nilai20": nilai20,
    }


def ringkas_dari_kartu(k: dict) -> dict:
    """Satu baris tabel screener, DITURUNKAN dari dict kartu penuh yang sama —
    bukan jalur hitung kedua. Dua jalur yang menghitung angka sama akan
    menyimpang dalam sebulan tanpa satu pun galat.

    Jarak ke S1/R1 (persen dan dalam ATR) sengaja TIDAK disimpan: keduanya
    turunan aritmetika dari harga/s1/r1/atr_pct yang sudah ada di sini."""
    sup = k.get("support") or []
    res = k.get("resistance") or []
    ichi = k.get("ichimoku")
    reg = k.get("regresi60")
    return {
        "kode": k["kode"],
        "tgl": k["tgl"],
        "harga": k["harga"],
        "chg": k["chg"],
        "n": k["n"],
        "ma20": k["ma20"],
        "atr_pct": k["atr_pct"],
        "s1": sup[0]["harga"] if sup else None,
        "r1": res[0]["harga"] if res else None,
        "er_persentil": k["er_persentil"],
        "likuiditas": k["likuiditas_median20"],
        "stop_pct": k["stop_pct"],
        "kualitas": k.get("kualitas"),
        # ruas baru 25 Agu 2026 — dipakai Screener yg cuma memuat ringkas.json,
        # bukan 963 kartu penuh. Diambil apa adanya dari kartu, tak dihitung
        # ulang (lihat docstring di atas).
        "ma5": k.get("ma5"),
        "posisi_bb": k.get("posisi_bb"),
        "di_atas_kumo": ichi["di_atas_kumo"] if ichi else None,
        "posisi_regresi": reg["posisi"] if reg else None,
        "freq": k.get("freq"),
        "ukuran_order": k.get("ukuran_order"),
        "peringkat_value": k.get("peringkat_value"),
        "peringkat_volume": k.get("peringkat_volume"),
        "peringkat_freq": k.get("peringkat_freq"),
        "porsi_asing": k.get("porsi_asing"),
        "net_asing_rp": k.get("net_asing_rp"),
        "label_fd": k.get("label_fd"),
        # Ikut ke ringkas supaya Screener & preset bisa MENANDAI emiten yang
        # tak diperdagangkan, bukan diam-diam menyaringnya keluar.
        "beku": k.get("beku"),
        "beku_sejak": k.get("beku_sejak"),
        # Ruas preset Whale — dibaca mode Preset di Screener.
        "tiket_lonjakan": k.get("tiket_lonjakan"),
        "tiket_broker_maks": k.get("tiket_broker_maks"),
        "broker_tiket_maks_kode": k.get("broker_tiket_maks_kode"),
        "bval_maks": k.get("bval_maks"),
        "nego_blok_rp": k.get("nego_blok_rp"),
        "nego_broker_maks_kode": k.get("nego_broker_maks_kode"),
        "asing_net_5h": k.get("asing_net_5h"),
        "asing_net_20h": k.get("asing_net_20h"),
        "asing_streak": k.get("asing_streak"),
        "top3_pct": k.get("top3_pct"),
        "number_broker_buysell": k.get("number_broker_buysell"),
        "label_accdist": k.get("label_accdist"),
    }


def tulis_berkas_kartu(hasil: dict[str, dict], tolak: dict | None = None) -> None:
    """Tulis data-idx/json/kartu/<KODE>.json (satu per emiten) + index.json
    (daftar kode + tanggal hitung, supaya halaman tahu apa yang tersedia tanpa
    menebak nama berkas) + ringkas.json (satu berkas untuk tabel screener,
    supaya halaman tak menembak ratusan permintaan). Dipanggil dari --tulis
    TANPA --tanggal (run harian) — juga menulis arsip kalender hari itu lewat
    tulis_arsip(). Menjalankan skrip riset ini tanpa flag --tulis TIDAK
    mengubah berkas apa pun."""
    KARTU_DIR.mkdir(parents=True, exist_ok=True)
    daftar = []
    baris = []
    for kd, h in sorted(hasil.items()):
        (KARTU_DIR / f"{kd}.json").write_text(json.dumps(h, indent=1, default=str), encoding="utf-8")
        daftar.append({"kode": kd, "dihitung": h["dihitung"]})
        baris.append(ringkas_dari_kartu(h))
    waktu = __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M")
    (KARTU_DIR / "index.json").write_text(
        json.dumps({"diperbarui": waktu, "emiten": daftar, "arsip": []}, indent=1, ensure_ascii=False), encoding="utf-8")
    ringkas = {
        "diperbarui": waktu,
        "ambang": {"lilin": MIN_LILIN, "likuiditas": MIN_LIKUIDITAS},
        "tak_lolos": tolak or {},
        "emiten": baris,
    }
    p_ringkas = KARTU_DIR / "ringkas.json"
    p_ringkas.write_text(json.dumps(ringkas, ensure_ascii=False, default=str), encoding="utf-8")
    print(f"\ntersimpan: {len(daftar)} berkas kartu + index.json + "
          f"ringkas.json ({p_ringkas.stat().st_size/1024:.0f} KB) -> {KARTU_DIR}")
    periksa_ringkas()
    if hasil:
        # 'index.json.arsip' di atas cuma placeholder — tulis_arsip() di bawah
        # membaca ulang glob kartu/arsip/ dan menimpanya dengan daftar nyata.
        tulis_arsip(hasil, tolak, max(h["dihitung"] for h in hasil.values()))


def tulis_arsip(hasil: dict[str, dict], tolak: dict | None, tanggal: str) -> None:
    """Tulis data-idx/json/kartu/arsip/<tanggal>.json — ringkasan screener PADA
    tanggal itu (kompak, dibaca kalender tab Semua). TIDAK menyentuh
    kartu/<KODE>.json atau ringkas.json 'hari ini' — kartu penuh per emiten
    tetap hanya untuk tanggal terkini (lihat docstring modul & keputusan
    kalender 21 Agu 2026)."""
    arsip_dir = KARTU_DIR / "arsip"
    arsip_dir.mkdir(parents=True, exist_ok=True)
    baris = sorted((ringkas_dari_kartu(h) for h in hasil.values()), key=lambda b: b["kode"])
    isi = {
        "diperbarui": tanggal,
        "ambang": {"lilin": MIN_LILIN, "likuiditas": MIN_LIKUIDITAS},
        "tak_lolos": tolak or {},
        "emiten": baris,
    }
    p = arsip_dir / f"{tanggal}.json"
    p.write_text(json.dumps(isi, ensure_ascii=False, default=str, separators=(",", ":")), encoding="utf-8")
    print(f"  arsip {tanggal}: {len(baris)} emiten -> {p} ({p.stat().st_size/1024:.0f} KB)")
    perbarui_arsip_index()


def perbarui_arsip_index() -> None:
    """index.json.arsip = daftar tanggal yang tersedia di kartu/arsip/, dibaca
    ulang dari glob (bukan dilacak terpisah) supaya tak pernah basi terhadap
    berkas yang sungguh ada di cakram."""
    arsip_dir = KARTU_DIR / "arsip"
    daftar = sorted(x.stem for x in arsip_dir.glob("*.json")) if arsip_dir.exists() else []
    p = KARTU_DIR / "index.json"
    idx = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"diperbarui": None, "emiten": []}
    idx["arsip"] = daftar
    p.write_text(json.dumps(idx, indent=1, ensure_ascii=False), encoding="utf-8")


def periksa_ringkas(contoh: int = 5) -> None:
    """Assert kesamaan lintas berkas: baris ringkas.json HARUS identik dengan
    turunan kartu penuh emiten yang sama. Menangkap kasus 'ringkas.json ditulis
    dari jalur hitung lain' — kegagalan yang kalau tidak akan senyap total."""
    import random
    p = KARTU_DIR / "ringkas.json"
    if not p.exists():
        return
    r = json.loads(p.read_text(encoding="utf-8"))
    baris = {b["kode"]: b for b in r["emiten"]}
    pilih = random.sample(sorted(baris), min(contoh, len(baris)))
    for kd in pilih:
        penuh = json.loads((KARTU_DIR / f"{kd}.json").read_text(encoding="utf-8"))
        assert baris[kd] == ringkas_dari_kartu(penuh), f"ringkas.json != kartu penuh untuk {kd}"
    print(f"  assert kesamaan lintas berkas lolos untuk {len(pilih)} emiten acak: {', '.join(pilih)}")


if __name__ == "__main__":
    t_mulai = time.time()
    arg = sys.argv[1:]
    if "--uji" in arg:
        uji()
        raise SystemExit(0)
    tulis = "--tulis" in arg
    semua = "--semua" in arg
    maks = None
    i_maks = None
    if "--maks" in arg:
        i_maks = arg.index("--maks")
        maks = int(arg[i_maks + 1])
    tanggal = None
    i_tgl = None
    if "--tanggal" in arg:
        i_tgl = arg.index("--tanggal")
        tanggal = arg[i_tgl + 1]
    skip_val_idx = {i + 1 for i in (i_maks, i_tgl) if i is not None}
    positional = [a for i, a in enumerate(arg) if not a.startswith("--") and i not in skip_val_idx]

    # SEMUA emiten ber-OHLC dapat kartu (keputusan 21 Agu 2026) — kode_populasi()
    # cuma menandai siapa yang masuk POPULASI STATISTIK (ER persentil, dsb),
    # bukan lagi siapa yang dapat kartu.
    cache: dict[str, dict] | None = None
    if semua:
        cache = muat_semua_ohlc(sampai=tanggal)
        kode = sorted(cache)
        if maks:
            kode = kode[:maks]
        lolos, tolak = kode_populasi(cache=cache)
        print(f"mode --semua{f' --tanggal {tanggal}' if tanggal else ''}: {len(kode)} emiten ber-OHLC, "
              f"{len(lolos)} lolos ambang populasi statistik (riwayat >={MIN_LILIN} lilin & likuiditas "
              f">=Rp{MIN_LIKUIDITAS/1e6:.0f} jt/hari); tak lolos: {tolak['riwayat']} riwayat, "
              f"{tolak['likuiditas']} likuiditas{f' — dibatasi --maks {maks}' if maks else ''}")
    else:
        kode = positional or ["ARCI", "WIFI", "BUMI"]
        lolos, tolak = kode_populasi(sampai=tanggal)

    print("menghitung Efficiency Ratio populasi statistik...", flush=True)
    lolos_set = set(lolos)
    pop_mentah = dict(er_populasi(cache=cache, sampai=tanggal))
    pop = {kd: e for kd, e in pop_mentah.items() if kd in lolos_set}
    nilai_pop = sorted(pop.values())
    if nilai_pop:
        kuartil = lambda p: nilai_pop[int(p * len(nilai_pop))]
        print(f"  {len(pop)} emiten dalam populasi statistik — ER20 median pasar "
              f"{statistics.median(nilai_pop):.3f}, P25 {kuartil(0.25):.3f}, P75 {kuartil(0.75):.3f}")
    else:
        print("  populasi statistik kosong (tak ada emiten lolos ambang untuk rentang ini)")

    # --semua --tanggal X (backfill arsip): kartu() melewati blok yang tak
    # dipakai ringkas_dari_kartu() (musiman/sektor/fundamental/asing/target) —
    # itulah yang bikin --tanggal terjangkau untuk ratusan hari.
    hemat = semua and tanggal is not None
    # ruas berbasis ohlcv_stockbit (freq/porsi_asing/peringkat_*) juga
    # dilewati saat hemat — sama seperti musiman/asing, ringkas_dari_kartu()
    # tak memakainya, jadi backfill --tanggal tak perlu membayarnya.
    #
    # ⚠️ ALASAN DI ATAS SUDAH TIDAK UTUH, dan konsekuensinya besar (diukur
    # 31 Agu 2026): jejak rekomendasi (B45) menyaring `freq >= 100`, jadi
    # arsip yang dibangun lewat jalur hemat menghasilkan "cuma 0 emiten
    # berfrekuensi" dan tanggal itu TAK BISA di-backtest sama sekali. Win rate
    # karena itu mentok di 4 hari (24–28 Agu), bukan 24 hari.
    #
    # Percobaan menambalnya dengan memuat stockbit di sini GAGAL dan mahal:
    # 23,6 menit untuk satu tanggal (963 berkas ohlcv_stockbit dibaca ulang),
    # dan hasilnya tetap `freq: null` — karena `kartu()` keluar lewat
    # `if hemat: return hasil` (baris ~806) SEBELUM blok yang mengisi ruas itu.
    #
    # Perbaikan yang benar butuh dua langkah, dan sengaja belum dikerjakan di
    # sini supaya tak setengah jalan:
    #   1. pindahkan blok freq/ukuran_order/peringkat ke ATAS `if hemat`
    #   2. muat ohlcv_stockbit SEKALI untuk seluruh rentang backfill, bukan
    #      sekali per tanggal — kalau tidak, 24 tanggal = ±9,5 jam
    stockbit_pop = muat_semua_stockbit_terakhir(sampai=tanggal) if not hemat else {}
    stockbit_rank = peringkat_populasi(stockbit_pop) if stockbit_pop else {}
    hasil: dict[str, dict] = {}
    gagal: list[str] = []
    cetak_penuh = len(kode) <= 10 and not hemat  # cetak() penuh cuma buat daftar pendek
    for i, kd in enumerate(kode, 1):
        try:
            h = kartu(kd, pop, d=(cache.get(kd) if cache is not None else None), sampai=tanggal, hemat=hemat,
                      stockbit_pop=stockbit_pop, stockbit_rank=stockbit_rank)
        except Exception as e:  # emiten dengan riwayat aneh/pendek tak boleh menghentikan seluruh batch
            gagal.append(kd)
            print(f"  [{i}/{len(kode)}] {kd}: GAGAL — {e}")
            continue
        hasil[kd] = h
        if cetak_penuh:
            cetak(h)
        elif i % 100 == 0 or i == len(kode):
            print(f"  [{i}/{len(kode)}] ...")
    if gagal:
        print(f"\n{len(gagal)} emiten gagal dihitung: {', '.join(gagal)}")

    if tulis:
        if tanggal:
            tulis_arsip(hasil, tolak, tanggal)
        else:
            tulis_berkas_kartu(hasil, tolak)

    tujuan = os.environ.get("KARTU_OUT")
    if tujuan:
        Path(tujuan).write_text(json.dumps(hasil, indent=1, default=str), encoding="utf-8")
        print(f"\ntersimpan: {tujuan}")

    print(f"\nwaktu total: {time.time() - t_mulai:.1f} detik")
