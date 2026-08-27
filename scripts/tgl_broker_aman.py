"""Tanggal target panen broker yang HARI-TUNTAS — dipakai JALANKAN_BUKA_LAPTOP.bat.

Dulu logika ini satu-baris python di dalam `for /f` bat, dan karakter `<`
di `(kini.hour,kini.minute)<(16,30)` ditelan parser cmd sebagai redirection
("- was unexpected at this time", task keluar 0xFF dalam sedetik — ketahuan
saat uji sadar 27 Agu 2026, run perdana task). Logika bat bukan tempat
ekspresi; skrip kecil ini rumah yang benar.

Aturannya: tanggal bawaan pemanen broker = bar OHLC terakhir, dan langkah
[B] bat baru saja memperbaruinya — login saat bursa masih buka akan
mengarsip broker SETENGAH HARI tanpa galat. Sebelum 16:30 WIB, target
dipaksa ke hari bursa terakhir SEBELUM hari ini.
"""
import datetime
import json
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
d = json.load(open(AKAR / "data-idx" / "json" / "ohlc" / "BBCA.json", encoding="utf-8"))
bar = [b[0] for b in d.get("d", []) if b]
kini = datetime.datetime.now()
hari_ini = str(kini.date())
if (kini.hour, kini.minute) < (16, 30):
    bar = [t for t in bar if t < hari_ini]
print(bar[-1])
