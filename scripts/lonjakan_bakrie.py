# -*- coding: utf-8 -*-
"""Probabilitas LONJAKAN bulanan — grup Bakrie, sejauh data Yahoo menyimpan.

Kelanjutan `seasonality_bakrie.py`, yang berhenti di "berapa persen bulan naik".
Angka itu menyesatkan untuk saham seperti ini: mayoritas bulannya tidak bergerak
sama sekali (harga mentok Rp50, tidak ada transaksi), lalu sesekali meledak.
Median 0,00% di SEMUA bulan kalender adalah gejalanya.

Empat lapisan yang ditambahkan di sini:

1. BULAN BEKU DIBUANG DARI PENYEBUT.
   Bulan dengan perubahan harga persis 0% tidak memberi informasi apa pun soal
   peluang lonjakan; membiarkannya di penyebut menekan semua probabilitas ke
   bawah secara seragam. Porsinya dilaporkan terpisah — itu sendiri fakta
   penting tentang emiten ini.

2. LONJAKAN DIDEFINISIKAN EKSPLISIT, BERTINGKAT.
   +10% / +20% / +50% / +100% dalam sebulan. "Naik" saja terlalu longgar:
   naik 0,5% dan naik 80% dihitung sama.

3. UJI ACAK (PERMUTASI).
   Dengan 12 bulan kalender dan ratusan observasi, SELALU ada satu bulan yang
   terlihat paling bagus — meski datanya acak sepenuhnya. Label bulan diacak
   ribuan kali; kalau bulan juara sungguhan tidak mengungguli juara-acak,
   polanya kebetulan. Ini yang memisahkan temuan dari tebakan.

4. KONDISIONAL, BUKAN KALENDER SAJA.
   Peluang lonjakan diukur ulang dengan syarat: volume bulan sebelumnya di atas
   normal, dan arah tiga bulan terakhir. Untuk saham begini, keadaan pasar
   biasanya jauh lebih menentukan daripada nama bulannya.

Pembanding: IHSG (^JKSE) bulan yang sama, supaya "Desember bagus" bisa
dibedakan antara khas grup ini atau cuma ikut pasar.

Cara pakai:
  python scripts/lonjakan_bakrie.py
  python scripts/lonjakan_bakrie.py BUMI ENRG

Keluaran: data-idx/json/seasonality/bakrie_lonjakan.json + ringkasan di layar.
"""
import json
import random
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
KELUARAN = AKAR / "data-idx" / "json" / "seasonality"

EMITEN = {
    "BUMI": "Bumi Resources",
    "BNBR": "Bakrie & Brothers",
    "ELTY": "Bakrieland Development",
    "ENRG": "Energi Mega Persada",
    "UNSP": "Bakrie Sumatera Plantations",
    "DEWA": "Darma Henwa",
    "BRMS": "Bumi Resources Minerals",
    "VIVA": "Visi Media Asia",
    "MDIA": "Intermedia Capital",
}

BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
         "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
AMBANG = [10, 20, 50, 100]
PERMUTASI = 5000
BEKU = 0.5  # |return| di bawah ini dianggap tidak bergerak (persen)


def ambil(kode: str, percobaan: int = 3) -> list[dict]:
    """[{bulan, harga, volume}] terurut naik; bulan tanpa harga dibuang."""
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{kode}"
           f"?interval=1mo&range=max")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    galat = None
    for n in range(percobaan):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.load(r)
            break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            galat = e
            time.sleep(2 * (n + 1))
    else:
        raise RuntimeError(f"gagal setelah {percobaan} percobaan: {galat}")

    hasil = data.get("chart", {}).get("result")
    if not hasil:
        raise RuntimeError("Yahoo tidak mengembalikan seri harga")
    res = hasil[0]
    stempel = res.get("timestamp") or []
    kutipan = res["indicators"]["quote"][0]
    adj = res.get("indicators", {}).get("adjclose")
    harga = adj[0]["adjclose"] if adj else kutipan["close"]
    volume = kutipan.get("volume") or [None] * len(stempel)

    seri = []
    for t, h, v in zip(stempel, harga, volume):
        if h is None:
            continue
        seri.append({
            "bulan": datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m"),
            "harga": float(h),
            "volume": float(v) if v else 0.0,
        })
    return seri


def olah(seri: list[dict]) -> list[dict]:
    """Ubah seri harga jadi observasi bulanan siap uji."""
    obs = []
    for i in range(1, len(seri)):
        sebelum, kini = seri[i - 1], seri[i]
        if sebelum["harga"] <= 0:
            continue
        ret = (kini["harga"] - sebelum["harga"]) / sebelum["harga"] * 100

        # Volume "normal" = median 12 bulan sebelumnya. Dipakai untuk memisahkan
        # bulan yang didahului lonjakan minat dari bulan sepi.
        jendela = [s["volume"] for s in seri[max(0, i - 12):i] if s["volume"] > 0]
        vol_normal = statistics.median(jendela) if len(jendela) >= 6 else None
        vol_ramai = (vol_normal is not None and sebelum["volume"] > vol_normal * 1.5)

        # Arah tiga bulan terakhir (momentum) — dihitung SEBELUM bulan berjalan,
        # jadi tidak bocor dari masa depan.
        if i >= 4 and seri[i - 4]["harga"] > 0:
            mom3 = (sebelum["harga"] - seri[i - 4]["harga"]) / seri[i - 4]["harga"] * 100
        else:
            mom3 = None

        obs.append({
            "bulan": kini["bulan"],
            "bulan_ke": int(kini["bulan"].split("-")[1]),
            "ret": ret,
            "beku": abs(ret) < BEKU,
            "vol_ramai": vol_ramai,
            "mom3": mom3,
        })
    return obs


def peluang(obs: list[dict], ambang: int) -> dict:
    """Peluang lonjakan ≥ambang per bulan kalender, bulan beku dibuang."""
    hasil = {}
    for b in range(1, 13):
        aktif = [o for o in obs if o["bulan_ke"] == b and not o["beku"]]
        semua = [o for o in obs if o["bulan_ke"] == b]
        if not semua:
            hasil[BULAN[b - 1]] = None
            continue
        lonjak = sum(1 for o in aktif if o["ret"] >= ambang)
        hasil[BULAN[b - 1]] = {
            "n_semua": len(semua),
            "n_aktif": len(aktif),
            "beku_persen": round((len(semua) - len(aktif)) / len(semua) * 100, 1),
            "lonjakan": lonjak,
            "peluang": round(lonjak / len(aktif) * 100, 1) if aktif else None,
        }
    return hasil


def uji_acak(obs: list[dict], ambang: int, ulang: int = PERMUTASI) -> dict:
    """Apakah bulan juara benar-benar menonjol, atau sekadar juara kebetulan?

    Label bulan diacak; tiap putaran dicatat peluang TERTINGGI diUnter 12 bulan.
    p = porsi putaran acak yang menyamai/melampaui juara sungguhan.
    """
    aktif = [o for o in obs if not o["beku"]]
    if len(aktif) < 60:
        return {"cukup_data": False}

    def puncak(label: list[int]) -> tuple[str, float]:
        ember: dict[int, list[int]] = {b: [] for b in range(1, 13)}
        for o, b in zip(aktif, label):
            ember[b].append(1 if o["ret"] >= ambang else 0)
        terbaik, nilai = None, -1.0
        for b, v in ember.items():
            if len(v) < 8:
                continue
            p = sum(v) / len(v) * 100
            if p > nilai:
                terbaik, nilai = b, p
        return (BULAN[terbaik - 1] if terbaik else "-"), nilai

    label_asli = [o["bulan_ke"] for o in aktif]
    juara, nilai_asli = puncak(label_asli)

    acak = list(label_asli)
    rng = random.Random(20260815)  # tetap, supaya hasilnya bisa diulang
    lebih = 0
    for _ in range(ulang):
        rng.shuffle(acak)
        _, nilai_acak = puncak(acak)
        if nilai_acak >= nilai_asli:
            lebih += 1
    return {
        "cukup_data": True,
        "juara": juara,
        "peluang_juara": round(nilai_asli, 1),
        "p_value": round(lebih / ulang, 4),
        "putaran": ulang,
    }


def bersyarat(obs: list[dict], ambang: int) -> dict:
    """Peluang lonjakan menurut keadaan, bukan menurut nama bulan."""
    aktif = [o for o in obs if not o["beku"]]

    def hitung(saring) -> dict | None:
        pilih = [o for o in aktif if saring(o)]
        if len(pilih) < 20:
            return None
        n = sum(1 for o in pilih if o["ret"] >= ambang)
        return {"n": len(pilih), "lonjakan": n, "peluang": round(n / len(pilih) * 100, 1)}

    return {
        "semua": hitung(lambda o: True),
        "volume_ramai": hitung(lambda o: o["vol_ramai"]),
        "volume_sepi": hitung(lambda o: not o["vol_ramai"]),
        "tren_naik_3bln": hitung(lambda o: o["mom3"] is not None and o["mom3"] > 0),
        "tren_turun_3bln": hitung(lambda o: o["mom3"] is not None and o["mom3"] <= 0),
    }


def main() -> None:
    pilih = [k.upper() for k in sys.argv[1:]] or list(EMITEN)
    KELUARAN.mkdir(parents=True, exist_ok=True)

    semua_obs: list[dict] = []
    per_emiten, gagal = {}, {}

    for kode in pilih:
        try:
            seri = ambil(f"{kode}.JK")
        except Exception as e:  # noqa: BLE001
            gagal[kode] = str(e)
            print(f"  ✗ {kode} — {e}")
            continue
        if len(seri) < 36:
            gagal[kode] = f"cuma {len(seri)} bulan"
            print(f"  ✗ {kode} — {gagal[kode]}")
            continue
        obs = olah(seri)
        semua_obs += obs
        beku = sum(1 for o in obs if o["beku"])
        per_emiten[kode] = {
            "nama": EMITEN.get(kode, kode),
            "mulai": seri[0]["bulan"], "akhir": seri[-1]["bulan"],
            "n": len(obs),
            "beku_persen": round(beku / len(obs) * 100, 1),
            "lonjakan_20": sum(1 for o in obs if o["ret"] >= 20),
            "lonjakan_50": sum(1 for o in obs if o["ret"] >= 50),
            "terbaik": round(max(o["ret"] for o in obs), 1),
            "terburuk": round(min(o["ret"] for o in obs), 1),
        }
        print(f"  ✓ {kode:<6} {len(obs):>4} bulan · beku {per_emiten[kode]['beku_persen']:>5.1f}%"
              f" · ≥+20% {per_emiten[kode]['lonjakan_20']:>3}x · ≥+50% {per_emiten[kode]['lonjakan_50']:>2}x")
        time.sleep(1)

    # Pembanding pasar: IHSG bulan yang sama.
    try:
        ihsg = olah(ambil("^JKSE"))
        pasar = {o["bulan"]: o["ret"] for o in ihsg}
    except Exception as e:  # noqa: BLE001
        pasar, ihsg = {}, []
        print(f"  ! IHSG gagal diambil ({e}) — kolom ekses-pasar dikosongkan")

    keluaran = {
        "dibuat": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "definisi": {
            "beku": f"|perubahan| < {BEKU}% — dianggap tidak bergerak, dibuang dari penyebut",
            "ambang_lonjakan": AMBANG,
            "permutasi": PERMUTASI,
        },
        "per_emiten": per_emiten,
        "gagal": gagal,
        "peluang_per_bulan": {f"≥{a}%": peluang(semua_obs, a) for a in AMBANG},
        "uji_acak": {f"≥{a}%": uji_acak(semua_obs, a) for a in AMBANG},
        "bersyarat": {f"≥{a}%": bersyarat(semua_obs, a) for a in AMBANG},
    }
    if pasar:
        cocok = [(o["ret"], pasar[o["bulan"]]) for o in semua_obs if o["bulan"] in pasar]
        keluaran["pembanding_ihsg"] = {
            "n": len(cocok),
            "rata2_emiten": round(statistics.fmean(x for x, _ in cocok), 2),
            "rata2_ihsg": round(statistics.fmean(y for _, y in cocok), 2),
        }

    berkas = KELUARAN / "bakrie_lonjakan.json"
    berkas.write_text(json.dumps(keluaran, ensure_ascii=False, indent=2), encoding="utf-8")

    beku_total = sum(1 for o in semua_obs if o["beku"]) / len(semua_obs) * 100
    print(f"\n{len(semua_obs)} observasi · {beku_total:.1f}% bulan tidak bergerak sama sekali")
    print(f"Tersimpan: {berkas.relative_to(AKAR)}\n")

    print("PELUANG LONJAKAN per bulan kalender (bulan beku sudah dibuang):")
    print(f"  {'Bulan':<11} {'aktif':>6} {'≥+10%':>7} {'≥+20%':>7} {'≥+50%':>7}")
    for i, nama in enumerate(BULAN, start=1):
        b10 = keluaran["peluang_per_bulan"]["≥10%"][nama]
        if not b10:
            continue
        b20 = keluaran["peluang_per_bulan"]["≥20%"][nama]
        b50 = keluaran["peluang_per_bulan"]["≥50%"][nama]
        print(f"  {nama:<11} {b10['n_aktif']:>6} {b10['peluang']:>6.1f}% "
              f"{b20['peluang']:>6.1f}% {b50['peluang']:>6.1f}%")

    print("\nUJI ACAK — apakah bulan juara sungguhan menonjol?")
    for a in AMBANG:
        u = keluaran["uji_acak"][f"≥{a}%"]
        if not u.get("cukup_data"):
            continue
        vonis = "MENONJOL" if u["p_value"] < 0.05 else "bisa kebetulan"
        print(f"  ≥+{a}%: juara {u['juara']} ({u['peluang_juara']}%), p={u['p_value']:.4f} → {vonis}")

    print("\nPELUANG MENURUT KEADAAN (bukan menurut nama bulan):")
    for a in [20, 50]:
        c = keluaran["bersyarat"][f"≥{a}%"]
        print(f"  Ambang ≥+{a}%:")
        for label, kunci in [("semua bulan aktif", "semua"),
                             ("volume bulan lalu ramai", "volume_ramai"),
                             ("volume bulan lalu sepi", "volume_sepi"),
                             ("tren 3 bulan naik", "tren_naik_3bln"),
                             ("tren 3 bulan turun", "tren_turun_3bln")]:
            v = c[kunci]
            if v:
                print(f"    {label:<26} {v['peluang']:>5.1f}%  (n={v['n']})")


if __name__ == "__main__":
    main()
