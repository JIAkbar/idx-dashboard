# -*- coding: utf-8 -*-
"""Satu pintu jaringan untuk semua yang menyentuh idx.co.id.

KENAPA ADA (18 Agu 2026)
------------------------
Endpoint IDX mulai menolak `requests` — bukan karena alamat IP dan bukan
karena header. Terukur dari mesin ini hari ini:

    GetStockSummary?date=20260818  via requests (header peramban lengkap) -> 403
    URL yang sama              via curl_cffi impersonate=chrome124        -> 200, 963 baris
    GetNewsSearch              via requests -> 403 | via curl_cffi -> 200

Yang membedakan **sidik jari TLS**, satu lapis lebih dalam daripada header.
Menambah header, memperlambat laju, atau ganti IP tidak menyembuhkan apa pun.

Modul ini dibuat supaya perbaikan berikutnya (ganti `IMPERSONATE`, tambah
header baru, ubah pemanasan) cukup disunting DI SATU TEMPAT. Sebelumnya tiap
pemanen menyalin bloknya sendiri — persis pola yang membuat sebagian berkas
ketinggalan saat pola aslinya diperbaiki.

Pola aslinya dari `panen_keuangan_idx.py` (skrip pertama yang memakai
curl_cffi). Berkas itu sengaja TIDAK diubah: ia sudah jalan, dan menyentuh
pemanen yang sehat cuma menambah risiko.

YANG *TIDAK* BOLEH LEWAT SINI: Yahoo Finance. Yahoo tak bermasalah dengan
`requests`; menggantinya tak menyelesaikan apa pun dan bisa merusak yang sehat.

CATATAN 503 (bukan blokir): `/primary/StockData/GetSecurities` menjawab 503
Varnish lewat `requests` MAUPUN `curl_cffi`. Itu endpoint yang memang sudah
mati di sisi IDX, bukan gejala sidik jari. Penggantinya yang hidup:
`GetSecuritiesStock` (962 baris) dan `GetCompanyProfiles`.
"""
from __future__ import annotations

import time
from typing import Any

from curl_cffi import requests as cffi

# Sidik jari peramban yang ditiru. Diganti kalau IDX menolak lagi; daftar nilai
# sah ada di dokumentasi curl_cffi (chrome110..chrome124, dst).
IMPERSONATE = "chrome124"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")

# Kumpulan header yang benar-benar dikirim peramban — bukan tiga baris
# seadanya. Kurang salah satu dari sec-ch-ua*/Sec-Fetch-* pernah cukup untuk
# membuat sebagian endpoint menolak walau TLS-nya sudah benar.
HDR_PERAMBAN: dict[str, str] = {
    "User-Agent": UA,
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}
HDR_JSON = {**HDR_PERAMBAN, "Accept": "application/json, text/plain, */*"}
# Unduhan berkas GAGAL 406 kalau dikirim "Accept: application/json" —
# perlu header terpisah tanpa itu (pelajaran dari panen_keuangan_idx.py).
HDR_FILE = {**HDR_PERAMBAN}

BERANDA = "https://www.idx.co.id/id"
TUNGGU_ULANG = (5, 15, 45)   # backoff kalau 403/429/5xx atau gagal jaringan

_sesi: cffi.Session | None = None
_sudah_panas = False


def sesi() -> cffi.Session:
    """Sesi curl_cffi bersama (cookie ikut terbawa antar panggilan)."""
    global _sesi
    if _sesi is None:
        _sesi = cffi.Session(impersonate=IMPERSONATE)
    return _sesi


def panaskan() -> None:
    """Sentuh beranda sekali supaya cookie sesi terpasang.

    `ListedCompany/GetAnnouncement` menjawab 403 tanpa cookie sesi padahal
    endpoint tetangganya menerima permintaan polos — jadi pemanasan tetap
    dipertahankan walau TLS-nya sudah benar. Gagal memanaskan bukan alasan
    berhenti.
    """
    global _sudah_panas
    if _sudah_panas:
        return
    _sudah_panas = True
    try:
        sesi().get(BERANDA, headers={"User-Agent": UA}, timeout=30)
    except Exception:  # noqa: BLE001 — pemanasan opsional
        pass


def get(url: str, *, headers: dict | None = None, params: dict | None = None,
        timeout: int = 60, coba: int = 3, referer: str | None = None) -> Any:
    """GET ke idx.co.id lewat curl_cffi, dengan backoff.

    Mengembalikan objek respons (punya .status_code/.text/.content/.json()).
    Melempar RuntimeError kalau habis percobaan — pemanggil yang memutuskan
    apakah itu fatal atau cukup dihitung sebagai satu item gagal.
    """
    panaskan()
    h = {**(headers or HDR_JSON)}
    if referer:
        h["Referer"] = referer
    galat = None
    for i in range(coba):
        try:
            r = sesi().get(url, headers=h, params=params, timeout=timeout)
            if r.status_code == 200:
                return r
            galat = f"HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            galat = f"{type(e).__name__}: {e}"
        if i < coba - 1:
            time.sleep(TUNGGU_ULANG[min(i, len(TUNGGU_ULANG) - 1)])
    raise RuntimeError(f"gagal GET {url[:110]} — {galat}")


def demo() -> None:
    """Swauji: satu endpoint yang DULU 403 lewat `requests` harus 200 di sini."""
    r = get("https://www.idx.co.id/primary/TradingSummary/GetStockSummary",
            params={"date": "20260818", "start": 0, "length": 20},
            referer="https://www.idx.co.id/id/data-pasar/ringkasan-perdagangan")
    assert r.status_code == 200, r.status_code
    n = len(r.json().get("data") or [])
    assert n > 0, "GetStockSummary 200 tapi kosong"
    print(f"idx_net: swauji lolos — GetStockSummary HTTP 200, {n} baris")


if __name__ == "__main__":
    demo()
