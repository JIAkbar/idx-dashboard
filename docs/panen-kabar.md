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

## Stockbit Snips — arsip terpisah

`scripts/panen_snips.py` menulis `data-idx/json/snips.json` dari arsip
Stockbit Snips (`snips.stockbit.com`), buletin ringkas pasar modal Indonesia
dari Stockbit Investment Research.

**Kenapa dipisah dari `kabar.json`, bukan digabung jadi sumber ke-5:**
`kabar.json` punya retensi 7 hari (`--hari` di `panen_kabar.py`) — berkas itu
memang dirancang jadi jendela geser yang ditimpa tiap panen. Arsip Snips
justru mau disimpan **1 tahun**, supaya bisa ditelusuri ke belakang. Kalau
digabung, salah satu retensi harus mengalah — jadi lebih sederhana pisah
berkas, dan nanti digabung saat dipakai di halaman (bukan saat disimpan).

**Cara aksesnya:** situsnya Squarespace. Tak ada RSS (`/feed`, `/rss` semua
404), tapi tiap halaman koleksi menjawab JSON kalau diberi `?format=json` —
API bawaan Squarespace, bukan endpoint rahasia atau celah. Koleksi
`snips-terbaru` (ditemukan lewat `sitemap.xml`, yang menjawab 200) adalah
arsip utamanya. Paginasinya lewat parameter `offset=<epoch-ms>` yang dibalas
di `pagination.nextPageOffset` pada tiap halaman.

Diuji 16 Agustus 2026 dari IP rumahan: 238 item terpanen, rentang
2025-08-19 s.d. 2026-08-14 (hampir pas 12 bulan), ~15 halaman permintaan,
tak ada penolakan/blokir.

**Jalan manual:**

```
py -3.14 scripts\panen_snips.py            # arsip 365 hari (default)
py -3.14 scripts\panen_snips.py --hari 30  # arsip pendek, buat uji cepat
```

Bentuk tiap item sama dengan `kabar.json` (`sumber`, `jenis`, `judul`,
`tautan`, `waktu` ber-offset WIB, `emiten`) supaya gampang digabung di sisi
pembaca — `jenis` untuk Snips selalu `"snips"` dan `emiten` selalu kosong
(judulnya kadang menyebut kode saham, tapi ekstraksi otomatis belum
dikerjakan). Isi tulisannya sengaja TIDAK disalin, cuma metadata + tautan.

Belum dijadwalkan di Task Scheduler — jalan manual dulu sampai ritme
pembaruan arsipnya (perkiraan ~0,75 tulisan/hari) dipastikan cukup dipanen
mingguan, bukan harian seperti `kabar.json`.
