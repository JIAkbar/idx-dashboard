"""Ringkasan akhir panen + notifikasi Windows (#238 A).

Johan 23 Sep 2026: "dan .bat itu perlu di update sih misal kalau gagal ya
kasih tau, biar tidak diam-diam saja".

Sebelum ini tiap langkah bat yang gagal cuma mencetak satu baris
"(... gagal - lanjut)" di jendela cmd yang lalu tertutup sendiri, dan panen
broker yang tertunda karena jatah sumber (#218) tak menyebut angka apa pun.

Bat menulis satu baris "GAGAL: <langkah>" per kegagalan ke berkas ringkasan
(`call :gagal`). Skrip ini, di ujung bat:
  1. menambahkan kelengkapan broker per tanggal (7 hari terakhir) dari
     `tgl_broker_lubang.py --rinci` - dihitung dari berkas arsip, bukan log;
  2. mencetak ringkasannya ke jendela/log;
  3. memunculkan notifikasi Windows (toast lewat PowerShell bawaan);
  4. kalau ada yang gagal/bolong, membuka berkas ringkasan di Notepad supaya
     tetap terbaca walau jendela cmd sudah tertutup.

Selalu keluar 0: pelapor tidak boleh menggagalkan panen yang dilaporkannya.

Pakai:  python scripts/ringkas_panen.py <berkas-ringkasan> "<nama panen>"
Uji:    python scripts/ringkas_panen.py --uji
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
AMBANG = 0.95  # sama dengan AMBANG_LENGKAP di tgl_broker_lubang.py
POLA = re.compile(r"^\s*(\d{4}-\d{2}-\d{2}):\s+(.*?)(?:\s*/\s*bursa\s+(\d+))?\s*$")

TOAST_PS = r"""
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$x = $t.GetElementsByTagName('text')
$x.Item(0).AppendChild($t.CreateTextNode($env:PAPAN_JUDUL)) > $null
$x.Item(1).AppendChild($t.CreateTextNode($env:PAPAN_PESAN)) > $null
$app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($t))
"""


def broker_bolong(rinci: str) -> list[str]:
    """Baris `--rinci` -> daftar "17 Sep: reguler 384/963" untuk hari yang
    varian terkecilnya di bawah AMBANG x jumlah emiten bursa. Tanpa angka
    bursa (hari berjalan), acuannya jumlah terbesar yang tercatat di jendela."""
    baris = []
    for b in rinci.splitlines():
        m = POLA.match(b)
        if not m:
            continue
        n = {k: int(v) for k, v in re.findall(r"([\w-]+)=(\d+)", m.group(2))}
        if n:
            baris.append((m.group(1), n, int(m.group(3)) if m.group(3) else None))
    acuan_maks = max((max(n.values()) for _, n, _ in baris), default=0)
    hasil = []
    for tgl, n, bursa in baris:
        acuan = bursa or acuan_maks
        v_min = min(n, key=n.get)
        if acuan and n[v_min] < AMBANG * acuan:
            hasil.append(f"{tgl}: {v_min} {n[v_min]}/{acuan} emiten")
    return hasil


def toast(judul: str, pesan: str) -> None:
    env = dict(os.environ, PAPAN_JUDUL=judul, PAPAN_PESAN=pesan[:250])
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", TOAST_PS], env=env,
                       timeout=30, capture_output=True)
    except (OSError, subprocess.SubprocessError):
        pass  # notifikasi gagal tak boleh menggagalkan panen; ringkasan tetap tertulis


def main(berkas: Path, nama: str) -> int:
    try:
        gagal = [b[6:].strip() for b in berkas.read_text(encoding="utf-8", errors="replace").splitlines()
                 if b.startswith("GAGAL:")]
    except OSError:
        gagal = ["berkas ringkasan tak terbaca - langkah mana yang gagal tidak diketahui"]
    try:
        r = subprocess.run([sys.executable, str(AKAR / "scripts" / "tgl_broker_lubang.py"), "--rinci"],
                           cwd=AKAR, capture_output=True, text=True, encoding="utf-8", timeout=600)
        bolong = broker_bolong(r.stderr)
    except (OSError, subprocess.SubprocessError) as e:
        bolong = [f"kelengkapan broker tak terhitung ({type(e).__name__})"]

    isi = ["", f"== RINGKASAN {nama} =="]
    isi += [f"Langkah gagal: {len(gagal)}"] + [f"  - {g}" for g in gagal]
    isi += [f"Broker belum lengkap (7 hari terakhir): {len(bolong)} hari"] + [f"  - {b}" for b in bolong]
    if bolong:
        isi.append("  Hari yang bolong disusul otomatis di panen berikutnya (pemanen melewati berkas yang sudah ada).")
    teks = "\n".join(isi) + "\n"
    print(teks)
    try:
        with open(berkas, "a", encoding="utf-8") as f:
            f.write(teks)
    except OSError:
        pass

    if gagal or bolong:
        bagian = []
        if gagal:
            bagian.append(f"{len(gagal)} langkah gagal: " + ", ".join(gagal[:3]) + (" ..." if len(gagal) > 3 else ""))
        if bolong:
            bagian.append(f"broker belum lengkap {len(bolong)} hari")
        toast(f"PAPAN {nama}: ADA MASALAH", "; ".join(bagian) + ". Rincian di Notepad.")
        try:
            subprocess.Popen(["notepad.exe", str(berkas)])
        except OSError:
            pass
    else:
        toast(f"PAPAN {nama}: selesai", "Semua langkah jalan, broker 7 hari terakhir lengkap.")
    return 0


def uji() -> int:
    rinci = """  2026-09-16: reguler=962 asing=962 nego=962 nego-asing=962 tunai=962 tunai-asing=962 / bursa 963
  2026-09-17: reguler=384 asing=425 nego=387 nego-asing=385 tunai=341 tunai-asing=321 / bursa 963
  2026-09-23: reguler=0 asing=0 nego=0 nego-asing=0 tunai=0 tunai-asing=0
  2026-09-24: reguler=950 asing=950 nego=950 nego-asing=950 tunai=950 tunai-asing=950"""
    b = broker_bolong(rinci)
    # 16 Sep lengkap; 17 Sep varian terkecil tunai-asing; 23 Sep tanpa angka
    # bursa memakai acuan terbesar di jendela (962); 950/962 >= 95% -> lengkap.
    assert b == ["2026-09-17: tunai-asing 321/963 emiten", "2026-09-23: reguler 0/962 emiten"], b
    assert broker_bolong("") == []
    print("uji ringkas_panen: LOLOS 2 kasus")
    return 0


if __name__ == "__main__":
    if sys.argv[1:] == ["--uji"]:
        sys.exit(uji())
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(0)
    sys.exit(main(Path(sys.argv[1]), sys.argv[2]))
