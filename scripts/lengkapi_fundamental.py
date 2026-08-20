#!/usr/bin/env python3
"""Lengkapi ruas fundamental yang kosong — TANPA satu pun permintaan jaringan.

KENAPA berkas ini ada
=====================
Sebagian besar ruas ringkas di `data-idx/json/fundamental/<KODE>.json` bukan
hasil hitungan kita, melainkan SALINAN LANGSUNG dari `info` yfinance
(`fetch_fundamental.py`): `eps` ← `trailingEps`, `pe` ← `trailingPE`,
`der` ← `debtToEquity`, `roe` ← `returnOnEquity`, `dividend_yield` ←
`dividendYield`. Begitu yfinance tak punya kunci itu untuk sebuah emiten —
lazim di emiten kecil/IPO baru — ruasnya kosong SELAMANYA, walaupun bahan
untuk menghitungnya sudah ada di berkas yang sama (`ttm_net_income`,
`shares`, `last_price`, `der_q`, `lq_equity`) atau di laporan resmi bursa
(`data-idx/json/keuangan_idx/`, XBRL).

Jadi lubangnya BUKAN "sumbernya tak punya data", melainkan "tak pernah
dihitung". Berkas ini menghitungnya.

ATURAN yang tak boleh dilanggar
===============================
1. **Hanya mengisi yang null/kosong.** Angka dari yfinance selalu menang —
   berkas ini penambal, bukan pengganti.
2. **Nol dan "tidak tahu" itu beda.** Kalau pembilang atau penyebutnya tak
   ada, hasilnya tetap `null`. Tak pernah 0, tak pernah tebakan.
3. **Tiap angka turunan menyebut asalnya** di `asal_turunan` — dibaca
   `KolomValuasi.tsx` untuk lencana superscript, mengikuti pola yang sudah
   dipakai `PanelLaporanKeuangan.tsx` (angka resmi bursa dan angka
   agregator tak boleh terlihat sama persis).
4. **Jalankan SESUDAH `fetch_fundamental.py`**, bukan sebelum. `fetch`
   menulis ulang berkas dari nol, jadi tambalan lama hilang sendiri dan
   skrip ini idempoten tanpa perlu menghapus apa pun.

`q_eps` beda dari ruas lain di atas — bukan "isi kalau kosong" tapi "timpa
kalau SALAH". `fetch_fundamental.py` menghitungnya dari `q_net_income`
(yfinance `quarterly_financials`, sudah dikonfirmasi DISKRET per kuartal,
bukan kumulatif — jumlah 4 kuartal ≈ nilai tahunan di 122 sampel) dibagi
`shares`. Sampai 18 Agu 2026 pembaginya salah: net income kuartal dibagi
SEBELUM disamakan ke IDR, bukan sesudah — untuk 85 emiten pelapor non-IDR
(USD) hasilnya kepotong ke 0,00 (contoh ARCI: 532 miliar IDR / kurs ±16.300 /
25,2 miliar saham = 0,001 USD/saham). `fetch_fundamental.py` sudah dibetulkan
di sumbernya (q_eps dihitung dari `q_ni_idr`, sama seperti rev_ps/cash_ps/
fcf_ps); fungsi `q_eps_baru()` di sini menambal 967 berkas LAMA yang sudah
telanjur menyimpan versi buggy-nya. **84 dari 85** benar-benar ditulis ulang
(idempoten — hasilnya selalu genap sama dengan `q_net_income`/`shares` saat
itu); 1 (RIGS) sengaja DILEWATI oleh guard sanity-check kedua di bawah karena
`q_net_income`-nya sendiri korup ~11.000× (bug lain, bukan currency-timing),
dan versi LAMA-nya kebetulan benar — lihat docstring `q_eps_baru`.

Yang SENGAJA TIDAK diisi (dan kenapa) — lihat juga docs/workflow-fundamental.md:

* `altman_z` — Z" butuh modal kerja dan saldo laba (retained earnings).
  Modal kerja ada di 3 dari 398 emiten yang kosong, saldo laba tak pernah
  diekspor sama sekali, dan `panen_keuangan_idx.py` tak memanen keduanya.
  Jalan naiknya: tambah "Total current assets"/"Total current liabilities"/
  "Retained earnings" ke ekstraksi XBRL lalu panen ulang TW/audit terbaru.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
DIR_FUND = AKAR / "data-idx" / "json" / "fundamental"
DIR_IDX = AKAR / "data-idx" / "json" / "keuangan_idx"

# Kode asal yang ditulis ke `asal_turunan` — sengaja sama kosakatanya dengan
# `AsalAngka` di app/src/lib/dasbor/fundamentalGabungan.ts.
TURUNAN = "turunan"   # dihitung dari ruas lain DI BERKAS INI (asalnya Yahoo)
IDX = "idx"           # dari laporan resmi bursa (XBRL)

# Div yield di atas 100% berarti berkasnya salah, bukan emitennya murah hati.
# Dividen spesial besar memang ada (puluhan persen), jadi ambangnya longgar —
# yang ditolak cuma yang mustahil.
BATAS_DIV_YIELD = 100.0


def angka(v):
    """Nilai numerik saja. bool ikut tersaring karena bukan int/float murni."""
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def tahunan_terbaru(idx: dict | None, ruas: str):
    """Nilai `ruas` dari tahun buku TERBARU yang punya angka itu di XBRL."""
    if not idx:
        return None
    tahunan = idx.get("tahunan") or {}
    for iso in sorted(tahunan, reverse=True):
        v = angka(tahunan[iso].get(ruas))
        if v is not None:
            return v
    return None


def dps_ttm(fd: dict) -> float | None:
    """DPS 12 bulan terakhir dari `div_history` (punya ex_date, beda dari
    `hist_dps` yang cuma berkunci tahun sehingga tahun berjalan selalu
    separuh jalan). Acuan waktunya `updated` berkas ini, bukan jam mesin —
    supaya hasilnya sama kalau skripnya dijalankan ulang bulan depan."""
    riwayat = fd.get("div_history") or []
    if not riwayat:
        return None
    acuan = None
    if isinstance(fd.get("updated"), str):
        try:
            acuan = datetime.strptime(fd["updated"][:10], "%Y-%m-%d")
        except ValueError:
            acuan = None
    if acuan is None:
        acuan = datetime.now()
    batas = acuan.replace(year=acuan.year - 1)

    total = 0.0
    ketemu = False
    for e in riwayat:
        jumlah = angka(e.get("amount"))
        if jumlah is None or not isinstance(e.get("ex_date"), str):
            continue
        try:
            tgl = datetime.strptime(e["ex_date"], "%d %b %y")
        except ValueError:
            continue
        if batas < tgl <= acuan:
            total += jumlah
            ketemu = True
    return total if ketemu and total > 0 else None


def f_score_xbrl(idx: dict | None) -> tuple[int | None, int]:
    """Piotroski PARSIAL dari laporan tahunan XBRL — 7 dari 9 komponen.

    Yang tak bisa dihitung dan kenapa: komponen 6 (delta current ratio) butuh
    aset/liabilitas lancar, komponen 7 (tanpa dilusi) butuh jumlah saham —
    keduanya tak diparse `panen_keuangan_idx.py`. `f_score_n` mencatat berapa
    komponen yang benar-benar terhitung, persis seperti versi yfinance-nya,
    jadi skor 5/7 tak pernah terbaca sebagai 5/9.

    Beda kecil yang disengaja dari versi `fetch_fundamental.py`: komponen 5
    memakai TOTAL debt/aset (XBRL tak memisah utang jangka panjang), bukan
    utang jangka panjang saja. Arahnya sama — leverage turun itu poin.
    """
    if not idx:
        return None, 0
    tahunan = idx.get("tahunan") or {}
    tahun = sorted(tahunan, reverse=True)
    if len(tahun) < 1:
        return None, 0
    t = tahunan[tahun[0]]
    p = tahunan[tahun[1]] if len(tahun) >= 2 else {}

    def bagi(d: dict, atas: str, bawah: str):
        a, b = angka(d.get(atas)), angka(d.get(bawah))
        return a / b if (a is not None and b) else None

    skor, n = 0, 0

    def nilai(syarat: bool | None):
        nonlocal skor, n
        if syarat is None:
            return
        n += 1
        skor += 1 if syarat else 0

    roa_t, roa_p = bagi(t, "net_income", "total_assets"), bagi(p, "net_income", "total_assets")
    cfo_t = angka(t.get("operating_cf"))
    ni_t = angka(t.get("net_income"))
    lev_t, lev_p = bagi(t, "total_debt", "total_assets"), bagi(p, "total_debt", "total_assets")
    gm_t, gm_p = bagi(t, "gross_profit", "revenue"), bagi(p, "gross_profit", "revenue")
    at_t, at_p = bagi(t, "revenue", "total_assets"), bagi(p, "revenue", "total_assets")

    nilai(roa_t > 0 if roa_t is not None else None)                              # 1
    nilai(cfo_t > 0 if cfo_t is not None else None)                              # 2
    nilai(roa_t > roa_p if None not in (roa_t, roa_p) else None)                 # 3
    nilai(cfo_t > ni_t if None not in (cfo_t, ni_t) else None)                   # 4
    nilai(lev_t < lev_p if None not in (lev_t, lev_p) else None)                 # 5
    nilai(gm_t > gm_p if None not in (gm_t, gm_p) else None)                     # 8
    nilai(at_t > at_p if None not in (at_t, at_p) else None)                     # 9

    return (skor if n else None), n


def shares_masuk_akal(fd: dict) -> bool:
    """`shares` (yfinance `sharesOutstanding`) dicek silang ke `market_cap ÷
    last_price` — dua ruas independen dari `shares` sendiri. Ketemu 18 Agu
    2026 lewat q_eps: BBNI cs. (38 emiten, kebanyakan bank) punya `shares`
    yang KETINGGALAN pemecahan saham / korporasi — BBNI tersimpan 578,7 juta
    padahal tersirat dari market_cap/harga 37,26 MILIAR (rasio 0,0155x).
    `eps` tahunan BBNI tetap benar (554,9, dari `trailingEps` Yahoo langsung,
    bukan dibagi `shares`), tapi q_net_income/shares akan menghasilkan angka
    yang 60x lebih besar dari yang sebenarnya — salah, bukan sekadar beda
    pembulatan. Tak ada pembanding (mis. mcap/harga kosong) -> anggap oke,
    jangan diblokir tanpa bukti.

    SEJAK `shares_sumber == "idx"` ADA (`fetch_fundamental.py`, `saham_idx`),
    cek market_cap DILEWATI untuk emiten itu: angkanya sudah jumlah saham
    tercatat resmi bursa, dan justru `market_cap` Yahoo-lah yang basi di
    AISA (tersirat 3,81 miliar vs 9,31 miliar resmi — dikonfirmasi ulang oleh
    ekuitas/nilai buku DAN EPS laporan XBRL), LPPF, dan ZBRA. Tanpa
    pengecualian ini, ketiganya tetap terblokir setelah `shares`-nya dibetulkan.
    """
    if fd.get("shares_sumber") == "idx":
        return True
    saham = angka(fd.get("shares"))
    mcap = angka(fd.get("market_cap"))
    harga = angka(fd.get("last_price"))
    if not saham or not mcap or not harga or harga <= 0:
        return True
    tersirat = mcap / harga
    if tersirat <= 0:
        return True
    rasio = saham / tersirat
    return 0.5 <= rasio <= 2.0


def q_eps_baru(fd: dict) -> dict:
    """Hitung ULANG q_eps dari q_net_income (SUDAH IDR di berkas ini) / shares.

    Beda dari `lengkapi()` yang cuma mengisi ruas kosong: ini menimpa juga
    nilai yang SUDAH ADA kalau salah — lihat docstring modul. `q_net_income`
    dan `shares` ada di berkas yang sama, jadi nol permintaan tambahan.
    Kuartal yang bahannya tak ada (net income atau shares tak diketahui)
    memang tak masuk ke hasil — beda dengan laba kuartal SUNGGUHAN nol yang
    tetap membagi jadi 0,0 (dua "aku tak tahu" vs "labanya nol" tak boleh
    tertukar, sama seperti aturan #2 di docstring modul).

    `shares` sendiri bisa salah (lihat `shares_masuk_akal`) — kalau begitu,
    HASILNYA TAK DITULIS SAMA SEKALI (dict kosong), bukan angka yang cuma
    "kelihatan masuk akal". 2 emiten (BRMS, GIAA) kena ini bersamaan dengan
    bug currency: q_eps lama-nya (0,0) SAMA SALAHNYA, tapi menimpanya dengan
    angka besar-tapi-salah lebih berbahaya karena kelihatan meyakinkan.

    Sanity check KEDUA — hasilnya dibandingkan ke `eps` tahunan (trailingEps,
    dipercaya karena `pe = harga/eps` selalu konsisten dgn ruas `pe`). Kalau
    satu kuartal saja > 50x |eps tahunan| (atau > 100 kalau eps kecil), SELURUH
    berkas itu dilewati — bukan cuma kuartal itu, laporan boleh lengkap atau
    tak sama sekali. Ketemu di RIGS: q_net_income-nya sendiri korup ~11.000x
    (kemungkinan financial_currency salah dilabeli USD padahal datanya sudah
    IDR, jadi terkonversi DUA KALI) — `shares` di RIGS justru konsisten
    (rasio 1,0 ke market_cap), jadi guard di atas tak menangkapnya."""
    if not shares_masuk_akal(fd):
        return {}
    saham = angka(fd.get("shares"))
    qni = fd.get("q_net_income") or {}
    if not saham or not qni:
        return {}
    eps_thn = angka(fd.get("eps"))
    batas = max(abs(eps_thn) * 50, 100) if eps_thn is not None and abs(eps_thn) >= 1 else None
    out: dict = {}
    for y, qs in qni.items():
        baris = {}
        for q, v in (qs or {}).items():
            ni = angka(v)
            if ni is None:
                continue
            nilai = round(ni / saham, 2)
            if batas is not None and abs(nilai) > batas:
                return {}
            baris[q] = nilai
        if baris:
            out[y] = baris
    return out


# Kurs USD/IDR yang masuk akal. Bukan selera: seluruh 102 emiten pelapor
# non-IDR di bursa ini melapor USD, dan USD/IDR tak pernah keluar dari pita ini
# sepanjang riwayat yang kita simpan (2019-2026). Kurs di luar pita berarti
# bahan penurunannya yang rusak, bukan kursnya.
KURS_MIN, KURS_MAX = 5_000.0, 30_000.0
DIR_KEU = AKAR / "data-idx" / "json" / "keuangan"


def kurs_panen() -> float | None:
    """Kurs USD->IDR yang DIPAKAI `fetch_fundamental.py` di panen terakhir,
    dibaca ulang dari cakram. Nol jaringan, nol tebakan, nol asumsi.

    `keuangan/<K>.json` (yfinance) menyimpan nilai MENTAH dalam mata uang
    PELAPORAN; `fundamental/<K>.json` menyimpan pasangan tahunan yang sama
    tapi SUDAH rupiah (`konversi_dict_ke_idr`). Rasio keduanya = kursnya,
    persis — dan karena satu jalan panen memakai satu kurs untuk seluruh
    emiten, sebarannya nol. Terukur 20 Agu 2026: **17.876** dari 346
    pasangan, min == p25 == median == max.

    Diambil MEDIAN, bukan rata-rata: satu pasangan yang mata uangnya salah
    dilabeli tak boleh menggeser angka yang dipakai 12 emiten lain.
    """
    rasio = []
    for p in sorted(DIR_FUND.glob("*.json")):
        fd = json.loads(p.read_text(encoding="utf-8"))
        if (fd.get("financial_currency") or "IDR") == "IDR":
            continue
        pk = DIR_KEU / p.name
        if not pk.exists():
            continue
        hn = fd.get("hist_net_income") or {}
        for iso, per in (json.loads(pk.read_text(encoding="utf-8")).get("tahunan") or {}).items():
            mentah, idr = angka(per.get("net_income")), angka(hn.get(iso[:4]))
            if mentah and idr:
                rasio.append(abs(idr / mentah))
    if not rasio:
        return None
    rasio.sort()
    k = rasio[len(rasio) // 2]
    return k if KURS_MIN <= k <= KURS_MAX else None


def hist_eps_baru(fd: dict, idx: dict | None, kurs: float | None) -> tuple[dict, str] | None:
    """`hist_eps` yang benar — RUPIAH, tanpa presisi yang terbuang.

    Menggantikan blok lama "isi kalau kosong dari XBRL". Dua jalur, dan
    keduanya berjangkar pada ruas yang fungsi ini TIDAK sentuh, jadi
    idempoten: dijalankan berapa kali pun hasilnya sama, termasuk kalau
    jalan sebelumnya salah.

    1. **`hist_net_income` (SUDAH rupiah) / `shares`** — rumus yang persis
       sama dengan `fetch_fundamental.py`, cuma tanpa kerusakannya. Di sana
       net income DOLAR dibagi miliaran saham lalu `round(.,2)`: ARCI, ALMI,
       LEAD dkk. tersimpan **0,00** untuk SEMUA tahun, dan yang tidak nol
       tersimpan ~17.876x terlalu kecil di sebelah `hist_bv`/`hist_fcf`/
       `hist_net_income` yang sudah rupiah. Nol galat.
    2. **EPS tahunan XBRL** kalau yfinance tak punya laba tahunan sama
       sekali (12 emiten). Diambil UTUH — bukan `hist_net_income/shares` —
       karena EPS laporan resmi memakai rata-rata saham TERTIMBANG tahun itu,
       sedangkan jumlah saham yang kita punya cuma yang SEKARANG. Dikonversi
       memakai `mata_uang[<tanggal>]` laporan itu sendiri, dan dibulatkan
       SESUDAH dikonversi: `round(0,00058 USD, 2)` = 0,00 dan 0,00 x kurs
       tetap 0,00 — persis cara 12 berkas ini kehilangan angkanya.

    Jalur 1 dilewati kalau `hist_eps` yang ada sekarang berasal dari XBRL:
    laporan resmi menang atas turunan, sama seperti aturan #1 modul ini.
    """
    saham = angka(fd.get("shares"))
    hn = fd.get("hist_net_income") or {}
    dari_idx = (fd.get("asal_turunan") or {}).get("hist_eps") == IDX
    if hn and saham and not dari_idx:
        peta = {y: round(v / saham, 2) for y, v in hn.items() if angka(v)}
        if peta:
            return peta, TURUNAN
    # Jalur XBRL hanya untuk yang BELUM punya angka, atau yang angkanya
    # memang berasal dari sini (perlu dikonversi ulang). Aturan #1 modul ini:
    # angka yfinance yang sudah ada tak pernah ditimpa penambal.
    if idx and (dari_idx or kosong(fd.get("hist_eps"))):
        mu = idx.get("mata_uang") or {}
        bawaan = idx.get("currency") or "IDR"
        peta = {}
        for iso, per in (idx.get("tahunan") or {}).items():
            v = angka(per.get("eps"))
            if v is None:
                continue
            if mu.get(iso, bawaan) != "IDR":
                if not kurs:
                    continue
                v *= kurs
            peta[iso[:4]] = round(v, 2)
        if peta:
            return peta, IDX
    return None


def kosong(v) -> bool:
    """Ruas dianggap kosong kalau null, atau map/list tanpa isi (`hist_eps`
    yang gagal dihitung ditulis `{}`, bukan null — dua bentuk 'tidak tahu'
    yang sama)."""
    if v is None:
        return True
    if isinstance(v, (dict, list)):
        return len(v) == 0
    return False


def lengkapi(fd: dict, idx: dict | None, kurs: float | None = None) -> dict[str, str]:
    """Isi ruas kosong di `fd` DI TEMPAT. Balikan: {ruas: kode asal}."""
    asal: dict[str, str] = {}
    harga = angka(fd.get("last_price"))
    saham = angka(fd.get("shares"))
    ttm_ni = angka(fd.get("ttm_net_income"))

    # ── EPS (TTM) ────────────────────────────────────────────────────────
    # Urutan sengaja: laba TTM/saham DULU karena itu benar-benar 12 bulan
    # terakhir, sesuai label "EPS (TTM)" di layar. EPS tahunan XBRL baru
    # dipakai kalau laba TTM-nya pun tak ada — lebih jujur menampilkan EPS
    # tahun buku terakhir yang bertanda "resmi bursa" daripada tanda hubung.
    if kosong(fd.get("eps")):
        if ttm_ni is not None and saham:
            fd["eps"] = round(ttm_ni / saham, 2)
            asal["eps"] = TURUNAN
        else:
            v = tahunan_terbaru(idx, "eps")
            if v is not None:
                fd["eps"] = round(v, 2)
                asal["eps"] = IDX

    # ── P/E (TTM) ────────────────────────────────────────────────────────
    # EPS <= 0 SENGAJA dibiarkan tanpa P/E: emiten rugi tak punya rasio itu
    # (yfinance pun tak memberikannya). 278 dari 367 emiten ber-`pe` kosong
    # ada di golongan ini — itu kebenaran, bukan lubang data.
    eps = angka(fd.get("eps"))
    if kosong(fd.get("pe")) and harga and eps and eps > 0:
        fd["pe"] = round(harga / eps, 6)
        asal["pe"] = asal.get("eps", TURUNAN)
        if kosong(fd.get("earn_yield")):
            fd["earn_yield"] = round(eps / harga * 100, 2)
            asal["earn_yield"] = asal["pe"]

    # ── Dividend yield (%) ───────────────────────────────────────────────
    if kosong(fd.get("dividend_yield")) and harga:
        dps = dps_ttm(fd)
        if dps is not None:
            y = dps / harga * 100
            if y <= BATAS_DIV_YIELD:
                fd["dividend_yield"] = round(y, 2)
                asal["dividend_yield"] = TURUNAN
                if kosong(fd.get("dividend_ttm")):
                    fd["dividend_ttm"] = round(dps, 2)
                    asal["dividend_ttm"] = TURUNAN

    # ── DER (persen — skala `debtToEquity` yfinance, bukan rasio) ────────
    # Terukur di 514 emiten yang punya keduanya: der/der_q median 99,4x —
    # `der` persen, `der_q` rasio. Beda tipisnya karena periode (der tahunan
    # dari info, der_q kuartal terakhir), bukan karena skala.
    if kosong(fd.get("der")):
        der_q = angka(fd.get("der_q"))
        if der_q is not None:
            fd["der"] = round(der_q * 100, 3)
            asal["der"] = TURUNAN
        else:
            hutang, ekuitas = tahunan_terbaru(idx, "total_debt"), tahunan_terbaru(idx, "equity")
            if hutang is not None and ekuitas:
                fd["der"] = round(hutang / ekuitas * 100, 3)
                asal["der"] = IDX

    # ── ROE (rasio, bukan persen — skala `returnOnEquity` yfinance) ──────
    if kosong(fd.get("roe")):
        ekuitas = angka(fd.get("lq_equity"))
        bv, = (angka(fd.get("bv")),)
        if ekuitas is None and bv is not None and saham:
            ekuitas = bv * saham          # ekuitas = nilai buku/saham x saham
        if ttm_ni is not None and ekuitas:
            fd["roe"] = round(ttm_ni / ekuitas, 5)
            asal["roe"] = TURUNAN
        else:
            ni, eq = tahunan_terbaru(idx, "net_income"), tahunan_terbaru(idx, "equity")
            if ni is not None and eq:
                fd["roe"] = round(ni / eq, 5)
                asal["roe"] = IDX

    # ── EPS historis tahunan — TIMPA kalau beda, bukan cuma kalau kosong ──
    # (lihat `hist_eps_baru`: kelas bug yang sama dengan q_eps 18 Agu, tapi
    # angkanya tidak kepotong jadi 0,00 melainkan tersimpan ~17.876x terlalu
    # kecil — lebih berbahaya, karena "kecil" masih terbaca seperti angka.)
    heps = hist_eps_baru(fd, idx, kurs)
    if heps and heps[0] != (fd.get("hist_eps") or {}):
        fd["hist_eps"], asal["hist_eps"] = heps

    # ── EPS kuartalan — TIMPA kalau beda, bukan cuma kalau kosong ─────────
    # (lihat docstring modul + q_eps_baru: versi lama bisa 0,0 padahal
    # q_net_income-nya besar, bug currency utk pelapor non-IDR).
    qeps_baru = q_eps_baru(fd)
    if qeps_baru and qeps_baru != (fd.get("q_eps") or {}):
        fd["q_eps"] = qeps_baru
        asal["q_eps"] = TURUNAN

    # ── Piotroski F-Score parsial ────────────────────────────────────────
    if kosong(fd.get("f_score")) and idx:
        skor, n = f_score_xbrl(idx)
        if skor is not None:
            fd["f_score"] = skor
            fd["f_score_n"] = n
            asal["f_score"] = IDX

    return asal


def jalankan(verbose: bool = True) -> dict[str, int]:
    hitung: dict[str, int] = {}
    berubah = 0
    kurs = kurs_panen()
    if verbose:
        print(f"kurs panen terbaca: {kurs}")
    for berkas in sorted(DIR_FUND.glob("*.json")):
        kode = berkas.stem
        fd = json.loads(berkas.read_text(encoding="utf-8"))
        p_idx = DIR_IDX / f"{kode}.json"
        idx = json.loads(p_idx.read_text(encoding="utf-8")) if p_idx.exists() else None

        asal = lengkapi(fd, idx, kurs)
        # Tak ada yang ditambal -> berkas TIDAK disentuh sama sekali. Versi
        # pertama membuang `asal_turunan` lama di cabang ini dengan alasan
        # "fetch baru sudah mengisi aslinya" — salah, dan bikin skripnya tak
        # idempoten: jalan kedua tanpa fetch di antaranya menemukan seluruh
        # ruas sudah terisi (oleh jalan pertama), menyimpulkan tak ada yang
        # ditambal, lalu MENGHAPUS jejak asal 418 berkas. Jejaknya memang tak
        # pernah bisa basi: `fetch_fundamental.py` menulis tiap berkas dari
        # nol, jadi `asal_turunan` peninggalan lama mustahil selamat.
        if not asal:
            continue
        fd["asal_turunan"] = asal
        # separators sama persis dengan fetch_fundamental.py:1033 — kalau beda,
        # seluruh 967 berkas ikut berubah formatnya dan diff-nya jadi tak
        # terbaca walau isinya cuma bertambah satu ruas.
        berkas.write_text(
            json.dumps(fd, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        berubah += 1
        for r in asal:
            hitung[r] = hitung.get(r, 0) + 1

    if verbose:
        print(f"{berubah} berkas ditulis ulang")
        for r, n in sorted(hitung.items(), key=lambda x: -x[1]):
            print(f"  {r:16} +{n}")
    return hitung


def _uji() -> None:
    """Uji mandiri — angkanya bisa dicek tangan, bukan snapshot hasil sendiri."""

    # ACRO 17 Agu 2026: yfinance tak punya trailingEps/trailingPE/roe untuk
    # emiten ini, tapi laba TTM dan jumlah saham ADA di berkas yang sama.
    #   EPS = 7.635.135.488 / 3.469.345.537 = 2,2007...  -> 2,2
    #   P/E = 63 / 2,2                      = 28,636363...
    #   ROE = 7.635.135.488 / (52,4 x 3.469.345.537 = 181,79 M) = 0,04200
    acro = {
        "last_price": 63.0, "shares": 3469345537, "ttm_net_income": 7635135488,
        "bv": 52.4, "eps": None, "pe": None, "roe": None, "der": None,
        "der_q": None, "dividend_yield": None, "hist_eps": {}, "f_score": None,
        "div_history": [{"year": "2026", "ex_date": "01 Jul 26", "amount": 3.13},
                        {"year": "2025", "ex_date": "06 Jan 25", "amount": 22.61}],
        "updated": "2026-08-13 21:06",
    }
    idx_acro = {"tahunan": {
        "2025-12-31": {"eps": 3.04, "net_income": 10021677456.0, "equity": 179672242889.0,
                       "total_assets": 232014017709.0, "total_debt": 41048772000.0,
                       "revenue": 41872866308.0, "gross_profit": 20304217175.0,
                       "operating_cf": 3813674212.0},
        "2024-12-31": {"eps": 2.63, "net_income": 9112274242.0, "equity": 192113895712.0,
                       "total_assets": 244224132587.0, "total_debt": 45253600000.0,
                       "revenue": 43724769550.0, "gross_profit": 20568834039.0,
                       "operating_cf": 11674663118.0},
    }, "kuartal": {}}

    asal = lengkapi(acro, idx_acro)
    assert acro["eps"] == 2.2, acro["eps"]
    assert abs(acro["pe"] - 28.636364) < 1e-5, acro["pe"]
    assert abs(acro["roe"] - 0.042) < 5e-5, acro["roe"]
    assert asal["eps"] == TURUNAN and asal["pe"] == TURUNAN

    # Div yield TTM: hanya 3,13 (1 Jul 26) yang masuk 12 bulan terakhir dari
    # 13 Agu 2026 — 22,61 (6 Jan 25) SUDAH LEWAT. 3,13/63 = 4,968% -> 4,97.
    # Kalau `hist_dps` dipakai (berkunci tahun, tanpa tanggal) hasilnya sama
    # kebetulan di sini, tapi salah untuk emiten yang ganti frekuensi bagi.
    assert acro["dividend_yield"] == 4.97, acro["dividend_yield"]

    # hist_eps diambil utuh dari XBRL, ditandai resmi bursa.
    assert acro["hist_eps"] == {"2025": 3.04, "2024": 2.63}
    assert asal["hist_eps"] == IDX

    # F-Score parsial, dihitung tangan dari dua tahun buku di atas:
    #   1 ROA 4,32% > 0                                    -> 1
    #   2 CFO 3,81 M > 0                                   -> 1
    #   3 ROA 4,32% (2025) > 3,73% (2024) naik              -> 1
    #   4 CFO 3,81 M > laba bersih 10,02 M?  TIDAK          -> 0
    #   5 utang/aset 17,69% < 18,53% turun                  -> 1
    #   8 marjin kotor 48,49% > 47,04% naik                 -> 1
    #   9 perputaran aset 0,1805 > 0,1790 naik              -> 1
    # = 6 dari 7 komponen yang bisa dihitung (6 & 7 butuh aset lancar dan
    # jumlah saham — tak ada di XBRL, karena itu f_score_n = 7, bukan 9).
    assert acro["f_score"] == 6, acro["f_score"]
    assert acro["f_score_n"] == 7, acro["f_score_n"]

    # DER dari XBRL: 41.048.772.000 / 179.672.242.889 x 100 = 22,8465%
    assert acro["der"] == 22.846, acro["der"]
    assert asal["der"] == IDX

    # --- Yang TIDAK boleh terjadi -----------------------------------------
    # 1. Angka asli yfinance tak pernah ditimpa.
    asli = {"eps": 471.81, "pe": 13.458808, "ttm_net_income": 1, "shares": 1,
            "last_price": 6350.0, "roe": 0.21818, "der": 5.0, "der_q": 0.5,
            "dividend_yield": 5.61, "hist_eps": {"2025": 468.39}, "f_score": 4}
    salinan = dict(asli)
    assert lengkapi(salinan, idx_acro) == {}
    assert salinan == asli

    # 2. Pembilang/penyebut tak ada -> tetap null, TIDAK jadi 0.
    hampa = {"last_price": 100.0, "shares": None, "ttm_net_income": None,
             "eps": None, "pe": None, "roe": None, "der": None, "der_q": None,
             "dividend_yield": None, "div_history": [], "f_score": None}
    lengkapi(hampa, None)
    assert hampa["eps"] is None and hampa["pe"] is None
    assert hampa["roe"] is None and hampa["der"] is None
    assert hampa["dividend_yield"] is None and hampa["f_score"] is None

    # 3. Emiten RUGI tak dikarang P/E-nya (EPS negatif -> pe tetap null).
    rugi = {"last_price": 100.0, "shares": 1000, "ttm_net_income": -50000,
            "eps": None, "pe": None}
    lengkapi(rugi, None)
    assert rugi["eps"] == -50.0 and rugi["pe"] is None

    # 4. altman_z TIDAK PERNAH disentuh (lihat docstring modul).
    utuh = {"q_eps": {}, "altman_z": None, "last_price": 1.0}
    lengkapi(utuh, idx_acro)
    assert utuh["altman_z"] is None

    # --- hist_eps pelapor USD (20 Agu 2026) -------------------------------
    # ARCI apa adanya dari cakram: laba tahunan SUDAH rupiah di berkas yang
    # sama, tapi hist_eps tersimpan 0,00 untuk keempat tahunnya karena
    # fetch_fundamental membagi DOLAR lalu round(.,2).
    #   2025: 1.820.152.535.644 / 25.235.000.000 = 72,1281... -> 72,13
    arci = {"financial_currency": "USD", "shares": 25235000000,
            "hist_eps": {"2025": 0.0, "2024": 0.0},
            "hist_net_income": {"2025": 1820152535644.0, "2024": 186941005028.0}}
    peta, asal_h = hist_eps_baru(arci, None, 17876.0)
    assert peta == {"2025": 72.13, "2024": 7.41}, peta
    assert asal_h == TURUNAN
    # Idempoten: jangkarnya (hist_net_income, shares) tak ikut berubah.
    arci["hist_eps"] = peta
    assert hist_eps_baru(arci, None, 17876.0)[0] == peta

    # BOAT: yfinance tak punya laba tahunan sama sekali, jadi EPS diambil dari
    # XBRL — 0,00058 USD. Dibulatkan SEBELUM dikonversi hasilnya 0,00 (persis
    # cacat yang ditambal); dikonversi dulu: 0,00058 x 17.876 = 10,368 -> 10,37.
    boat = {"financial_currency": "USD", "shares": 3501680000,
            "hist_eps": {"2025": 0.0}, "hist_net_income": {},
            "asal_turunan": {"hist_eps": IDX}}
    idx_boat = {"currency": "USD", "mata_uang": {"2025-12-31": "USD"},
                "tahunan": {"2025-12-31": {"eps": 0.00058}}, "kuartal": {}}
    peta, asal_h = hist_eps_baru(boat, idx_boat, 17876.0)
    assert peta == {"2025": 10.37}, peta
    assert asal_h == IDX
    # Tanpa kurs, angkanya TIDAK dikarang — periodenya dilewati, bukan ditulis 0.
    assert hist_eps_baru(boat, idx_boat, None) is None

    # Pelapor rupiah tak tersentuh: hasilnya sama persis dengan yang tersimpan.
    idr = {"financial_currency": "IDR", "shares": 1000,
           "hist_eps": {"2025": 50.0}, "hist_net_income": {"2025": 50000.0}}
    assert hist_eps_baru(idr, None, 17876.0)[0] == {"2025": 50.0}

    # 4b. q_eps DITIMPA kalau salah — kasus nyata ARCI 18 Agu 2026: net income
    # kuartalan SUDAH IDR (532,585 miliar dkk.), 25,235 miliar saham, tapi
    # q_eps lama semuanya 0.0 (bug lama: dibagi dari net income MENTAH/USD
    # sebelum konversi). Harus jadi 21,11 / 22,2 / 17,42 / 7,29 — bukan 0.
    arci = {
        "shares": 25235000000, "last_price": 1200.0,
        "q_net_income": {"2026": {"Q1": 532585084428.0},
                          "2025": {"Q4": 560293259824.0, "Q2": 439516836604.0,
                                   "Q1": 183853873456.0}},
        "q_eps": {"2026": {"Q1": 0.0},
                  "2025": {"Q4": 0.0, "Q2": 0.0, "Q1": 0.0}},
    }
    asal_arci = lengkapi(arci, None)
    assert arci["q_eps"] == {"2026": {"Q1": 21.11},
                              "2025": {"Q4": 22.2, "Q2": 17.42, "Q1": 7.29}}, arci["q_eps"]
    assert asal_arci["q_eps"] == TURUNAN

    # 4c. Laba kuartal SUNGGUHAN nol -> q_eps tetap 0,0 (bukan null/dilewati) —
    # beda dari 4d di bawah (bahan tak ada -> tak disentuh sama sekali).
    labarugi_nol = {"shares": 1000, "q_net_income": {"2025": {"Q1": 0.0}}, "q_eps": {}}
    lengkapi(labarugi_nol, None)
    assert labarugi_nol["q_eps"] == {"2025": {"Q1": 0.0}}

    # 4d. shares tak ada -> q_eps TAK disentuh (tetap kosong, tak dikarang 0).
    tanpa_saham = {"shares": None, "q_net_income": {"2025": {"Q1": 100.0}}, "q_eps": {}}
    asal_tanpa_saham = lengkapi(tanpa_saham, None)
    assert tanpa_saham["q_eps"] == {}
    assert "q_eps" not in asal_tanpa_saham

    # 4f. shares TAK KONSISTEN dgn market_cap/harga (kasus nyata BBNI: 578,7
    # juta tersimpan vs 37,26 miliar tersirat, rasio 0,0155x) -> q_eps TAK
    # ditulis sama sekali, walau q_net_income & shares "ada". Angka yang
    # kelihatan masuk akal tapi salah 60x lebih berbahaya dari 0,0 yang
    # jelas-jelas mencurigakan.
    saham_salah = {"shares": 578683733, "market_cap": 134497043480576.0,
                    "last_price": 3610.0,
                    "q_net_income": {"2026": {"Q1": 5660764000000.0}}, "q_eps": {}}
    asal_saham_salah = lengkapi(saham_salah, None)
    assert saham_salah["q_eps"] == {}
    assert "q_eps" not in asal_saham_salah

    # 4f-bis. `shares_sumber == "idx"` MEMBATALKAN guard 4f — kasus nyata AISA:
    # shares 9.311.800.000 (ListedShares resmi bursa) vs market_cap/harga yang
    # cuma 3,81 miliar, rasio 2,45x. Di sini yang basi justru market_cap Yahoo,
    # dan tanpa pengecualian ini AISA tetap tanpa q_eps setelah dibetulkan.
    #   5.660.764.000.000 / 9.311.800.000 = 607,91...
    aisa = {"shares": 9311800000, "market_cap": 3805720129 * 386.0,
            "last_price": 386.0, "shares_sumber": "idx",
            "q_net_income": {"2026": {"Q1": 5660764000000.0}}, "q_eps": {}}
    assert lengkapi(aisa, None)["q_eps"] == TURUNAN
    assert aisa["q_eps"] == {"2026": {"Q1": 607.91}}, aisa["q_eps"]

    # 4g. q_net_income sendiri korup (kasus nyata RIGS: shares KONSISTEN ke
    # market_cap, jadi guard 4f tak nangkap, tapi hasilnya 2.653x eps tahunan
    # -> guard KEDUA yang harus menahannya). SELURUH berkas dilewati, bukan
    # cuma kuartal yang meleset.
    rigs = {"shares": 609130000, "market_cap": 420299702272.0, "last_price": 690.0,
            "eps": 141.85,
            "q_net_income": {"2026": {"Q1": 229302877922788.0}}, "q_eps": {}}
    asal_rigs = lengkapi(rigs, None)
    assert rigs["q_eps"] == {}
    assert "q_eps" not in asal_rigs

    # 4h. Satu kuartal besar tapi MASIH dalam batas wajar (kasus nyata TPIA:
    # laba sekali-jalan Q2 2025 -> q_eps kuartal itu 18,8x eps tahunan, di
    # bawah batas 50x) -> TETAP ditulis, bukan ditolak.
    tpia = {"shares": 86464496192, "market_cap": 178116857167872.0,
            "last_price": 2060.0, "eps": 14.26,
            "q_net_income": {"2025": {"Q2": 23210216276000.0}}, "q_eps": {}}
    asal_tpia = lengkapi(tpia, None)
    assert tpia["q_eps"] == {"2025": {"Q2": 268.44}}, tpia["q_eps"]
    assert asal_tpia["q_eps"] == TURUNAN

    # 4e. IDEMPOTEN: kalau q_eps SUDAH benar (mis. pelapor IDR, tak pernah
    # kena bug), jalan kedua tak menganggapnya berubah.
    sudah_benar = {"shares": 1000, "q_net_income": {"2025": {"Q1": 100.0}},
                    "q_eps": {"2025": {"Q1": 0.1}}}
    assert "q_eps" not in lengkapi(sudah_benar, None)

    # 5. IDEMPOTEN: jalan kedua atas hasil jalan pertama tak mengubah apa pun
    # dan tak menghapus apa pun. Versi pertama gagal di sini — ia membuang
    # `asal_turunan` 418 berkas karena mengira jejaknya basi.
    sebelum = dict(acro)
    assert lengkapi(acro, idx_acro) == {}
    assert acro == sebelum

    print("uji lengkapi_fundamental: LOLOS")


if __name__ == "__main__":
    if "--uji" in sys.argv:
        _uji()
    else:
        _uji()          # pengaman: jangan pernah menulis 967 berkas kalau logikanya rusak
        jalankan()
