"""Sekali jalan: cek apakah idx.co.id menyediakan ringkasan broker harian.

Ini VERIFIKASI, bukan pemanenan. Hasilnya menentukan apakah halaman Broker
Summary bisa naik kelas dari Alpha (data tertanam 3 hari) jadi harian.
"""
from playwright.sync_api import sync_playwright

KANDIDAT = [
    "https://www.idx.co.id/primary/TradingSummary/GetBrokerSummary?date=20260604&start=1&length=10",
    "https://www.idx.co.id/primary/TradingSummary/GetStockSummary?date=20260604&start=1&length=10",
]

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.goto("https://www.idx.co.id/id/data-pasar/ringkasan-perdagangan", wait_until="networkidle", timeout=60000)
    for url in KANDIDAT:
        r = pg.request.get(url)
        print(url.split("?")[0], "->", r.status, r.text()[:200].replace("\n", " "))
    b.close()
