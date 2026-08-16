# Panen kabar — otomatis, terpisah dari harga

`scripts/panen_kabar.py` menulis `data-idx/json/kabar.json` dari 4 sumber
(IDX berita, IDX pengumuman, IPOT News, Kontan RSS). Detail sumber & jebakan
header ada di docstring skrip itu sendiri.

## Kenapa jadwalnya terpisah dari harga

Harga (PDF IDX + OHLC) sekali sehari sudah cukup — bursa cuma tutup pembukuan
sekali. Kabar beda: judul baru muncul tiap jam selama bursa buka. Kalau kabar
cuma ikut jadwal harga (18:30 WIB), pembaca pagi-siang melihat kabar yang
sudah basi 10+ jam. Karena itu ada DUA jalur:

| Jalur | Isi | Kapan |
|---|---|---|
| `JALANKAN_OTOMATIS.bat` langkah [6/8] | Kabar + harga + PDF, satu paket | Sekali sehari, sore |
| `scripts\panen_kabar.ps1` | Kabar SAJA | Bisa lebih sering, tiap jam bursa |

Keduanya independen — kalau salah satu belum sempat dijadwalkan, yang lain
tetap jalan.

## Jalan manual

```
py -3.14 scripts\panen_kabar.py --batas 25
```

atau paket lengkap (commit lokal termasuk):

```
powershell -File scripts\panen_kabar.ps1
```

`--batas` itu jumlah item PER SUMBER yang diambil, bukan total — hasil akhir
lebih kecil karena judul kembar lintas sumber dibuang (Kontan & IPOT sering
memberitakan hal yang sama).

## Kenapa GitHub Actions tidak dipakai untuk bagian IDX

Dua dari empat sumber (`IDX berita`, `IDX pengumuman`) memanggil endpoint
`idx.co.id` yang **memblokir IP datacenter** — termasuk runner GitHub Actions
dan Netlify (lihat `docs/sumber-fundamental-idx.md`). Dari IP rumahan (mesin
ini) semua endpoint menjawab 200. Karena skrip ini menggabungkan 4 sumber
dalam satu berkas keluaran, memisah "yang IDX di Actions, yang non-IDX di
lokal" berarti dua jalur commit ke berkas yang sama — lebih rumit daripada
menjalankan semuanya lokal. IPOT dan Kontan tidak punya batasan ini, tapi
tetap ikut jalur lokal karena sudah digabung satu skrip.

## Menjadwalkan (schtasks — SIAP SALIN, JANGAN dijalankan tanpa izin)

Kabar tiap jam kerja bursa (09:00–16:00 WIB, Senin–Jumat):

```
schtasks /Create /TN "IDX-Kabar" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"C:\1-Johan\10. Pengembangan\IDX Statistik\scripts\panen_kabar.ps1\"" ^
  /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 09:00 /RI 60 /DU 07:00 /K
```

Hapus:

```
schtasks /Delete /TN "IDX-Kabar"
```

`JALANKAN_OTOMATIS.bat` (paket harga+kabar+PDF harian) punya perintah
schtasks sendiri di komentar bagian atas berkas itu — belum didaftarkan,
lihat `docs/rencana-berjalan.md` #148.

## Keterbatasan

Kedua jalur butuh mesin ini menyala saat jadwalnya jalan (Task Scheduler
Windows, bukan layanan cloud) — kalau PC mati/tidur, panen jam itu terlewat
dan menunggu jadwal berikutnya.
